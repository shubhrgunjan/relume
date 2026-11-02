"""Study a reference video: everything an editor needs to rebuild it in the same style.
Per shot: timing, stop-motion cadence (how long each drawing is held), camera drift, tone, palette (Lab k-means),
texture (grain and paper detail), a coarse layout map and keyframes. Globally: rhythm, tempo, beats, hits, sound.

    python3 engine/study.py <video> <outdir>

Writes <outdir>/study.json, keyframes/ (first, middle, last of each shot), thumbs/, and frames.npz (every frame at
160×90 in Lab, the cache that compare.py scores a clone against).
"""
import json, os, subprocess, sys
import numpy as np
from scipy.ndimage import gaussian_filter
from scipy.signal import find_peaks, stft

video, out = sys.argv[1], sys.argv[2]
os.makedirs(f'{out}/keyframes', exist_ok=True); os.makedirs(f'{out}/thumbs', exist_ok=True)
run = lambda a: subprocess.run(a, capture_output=True)

probe = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', video]).stdout)
W0, H0 = probe['streams'][0]['width'], probe['streams'][0]['height']
num, den = probe['streams'][0]['r_frame_rate'].split('/'); fps = float(num) / float(den)
dur = float(probe['format']['duration'])


def frames_rgb(path, w, h, fps_=None):
    vf = (f'fps={fps_},' if fps_ else '') + f'scale={w}:{h}:flags=area'
    raw = run(['ffmpeg', '-v', 'error', '-i', path, '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.float32) / 255


def lab(rgb):
    """sRGB (0–1) → CIE Lab, D65"""
    c = np.where(rgb > 0.04045, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def lab2hex(L):
    fy = (L[0] + 16) / 116; fx = fy + L[1] / 500; fz = fy - L[2] / 200
    inv = lambda f: f ** 3 if f ** 3 > 0.008856 else (f - 16 / 116) / 7.787
    xyz = np.array([inv(fx) * 0.95047, inv(fy), inv(fz) * 1.08883])
    M = np.array([[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]])
    c = M @ xyz; c = np.where(c > 0.0031308, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055, 12.92 * c)
    return '#' + ''.join(f'{int(round(np.clip(v, 0, 1) * 255)):02x}' for v in c)


def kmeans(X, k=6, it=20, seed=0):
    r = np.random.default_rng(seed); C = X[r.choice(len(X), k, replace=False)]
    for _ in range(it):
        d = ((X[:, None] - C[None]) ** 2).sum(-1); a = d.argmin(1)
        C = np.array([X[a == j].mean(0) if (a == j).any() else C[j] for j in range(k)])
    w = np.bincount(a, minlength=k) / len(a)
    o = np.argsort(-w); return C[o], w[o]


# ---------------------------------------------------------------- every frame, small, in Lab
F = frames_rgb(video, 160, 90)
LAB = lab(F)
n = len(F)
G = LAB[..., 0]                                                   # lightness 0–100
diff = np.abs(np.diff(G, axis=0)).mean(axis=(1, 2))               # change per frame (L units)
np.savez_compressed(f'{out}/frames.npz', lab=LAB.astype(np.float16), fps=fps)

# cuts: a jump far above the local level; a gradual run of change counts as a dissolve
med = np.array([np.median(diff[max(0, i - 12):i + 12]) for i in range(len(diff))])
cut = [i + 1 for i in range(len(diff)) if diff[i] > max(7, med[i] * 3.2)]
cuts = []
for c in cut:
    if not cuts or c - cuts[-1] > 2: cuts.append(c)
bounds = [0] + cuts + [n]


def phase_shift(a, b):
    """global translation between two frames (pixels at 160×90), by phase correlation"""
    A, B = np.fft.fft2(a - a.mean()), np.fft.fft2(b - b.mean())
    R = A * np.conj(B); R /= np.abs(R) + 1e-9
    r = np.abs(np.fft.ifft2(R)); y, x = np.unravel_index(r.argmax(), r.shape)
    if y > a.shape[0] / 2: y -= a.shape[0]
    if x > a.shape[1] / 2: x -= a.shape[1]
    return float(x), float(y), float(r.max())


# ---------------------------------------------------------------- per shot
key = lambda t, path, w=640, h=360: run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', '-vf', f'scale={w}:{h}', '-q:v', '3', path])
shots = []
for k, (a, b) in enumerate(zip(bounds[:-1], bounds[1:])):
    if b <= a: continue
    i = k + 1; seg = G[a:b]; d = diff[a:b - 1] if b - a > 1 else np.array([0.0])
    # stop-motion cadence: runs of (near) identical frames = a drawing held for that many frames
    same = d < 0.35
    runs, r_ = [], 1
    for s in same:
        if s: r_ += 1
        else: runs.append(r_); r_ = 1
    runs.append(r_)
    drawings = len(runs)
    # camera: summed translation across the shot (only where frames are not held)
    sh = [phase_shift(G[j], G[j + 1]) for j in range(a, b - 1)] if b - a > 1 else []
    pan = [round(sum(s[0] for s in sh) * W0 / 160, 1), round(sum(s[1] for s in sh) * H0 / 90, 1)] if sh else [0, 0]
    mid = (a + b) // 2
    # palette over three frames of the shot
    px = np.concatenate([LAB[j].reshape(-1, 3) for j in sorted({a, mid, b - 1})])
    C, w = kmeans(px[:: max(1, len(px) // 6000)], 6)
    # texture at full resolution on the middle frame: grain (fine) and paper/brush detail (medium)
    tm = (mid + 0.5) / fps
    kp = [f'keyframes/{i:03d}-{p}.jpg' for p in ('a', 'm', 'z')]
    for t_, p in zip([(a + 0.5) / fps, tm, min((b - 0.5) / fps, dur - 0.15)], kp): key(t_, f'{out}/{p}')
    key(tm, f'{out}/thumbs/{i:03d}.jpg', 320, 180)
    from PIL import Image
    g = np.asarray(Image.open(f'{out}/{kp[1]}').convert('L'), np.float32)
    grain = float(np.std(g - gaussian_filter(g, 1.2)))
    detail = float(np.std(gaussian_filter(g, 1.5) - gaussian_filter(g, 6)))
    edges = float((np.hypot(*np.gradient(gaussian_filter(g, 1))) > 18).mean())
    L = seg.reshape(-1)
    shots.append({
        'i': i, 't': round(a / fps, 3), 'dur': round((b - a) / fps, 3), 'frames': int(b - a),
        'cadence': {'drawings': drawings, 'heldFor': round(float(np.mean(runs)), 2), 'on': int(round(np.median(runs)))},
        'motion': round(float(d.mean()), 2), 'pan': pan,
        'tone': {'L': round(float(L.mean()), 1), 'p5': round(float(np.percentile(L, 5)), 1), 'p95': round(float(np.percentile(L, 95)), 1)},
        'chroma': round(float(np.hypot(LAB[a:b, ..., 1], LAB[a:b, ..., 2]).mean()), 1),
        'palette': [{'hex': lab2hex(c), 'lab': [round(float(v), 1) for v in c], 'w': round(float(x), 3)} for c, x in zip(C, w)],
        'texture': {'grain': round(grain, 2), 'detail': round(detail, 2), 'edges': round(edges, 3)},
        'layout': np.round(gaussian_filter(G[mid], 2)[::10, ::10], 1).tolist(),
        'keyframes': kp, 'thumb': f'thumbs/{i:03d}.jpg',
    })
    print(f'shot {i:2d}  {a / fps:6.2f}s  {(b - a) / fps:5.2f}s  on {shots[-1]["cadence"]["on"]}s  L {shots[-1]["tone"]["L"]}', flush=True)

# ---------------------------------------------------------------- sound
sr = 22050
y = np.frombuffer(run(['ffmpeg', '-v', 'error', '-i', video, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-']).stdout, np.int16).astype(np.float32) / 32768
audio = None
if len(y) > sr:
    hop = 512; f, tt, Z = stft(y, fs=sr, nperseg=2048, noverlap=2048 - hop); mag = np.abs(Z)
    flux = np.maximum(0, np.diff(np.log1p(mag * 100), axis=1)).sum(0); flux = (flux - flux.mean()) / (flux.std() + 1e-9); ft = tt[1:]; frs = sr / hop
    ac = np.correlate(flux, flux, 'full')[len(flux) - 1:]; lags = np.arange(len(ac)) / frs; ok = (lags > 60 / 180) & (lags < 60 / 70); lag = lags[ok][ac[ok].argmax()]
    hits = [round(float(ft[h]), 2) for h in find_peaks(flux, height=3.2, distance=int(frs * 0.25))[0]]
    onsets = ft[find_peaks(flux, height=1.0, distance=int(frs * 0.1))[0]]
    bands = {'sub': (20, 60), 'bass': (60, 250), 'lowmid': (250, 2000), 'himid': (2000, 6000), 'air': (6000, 11000)}
    P = mag ** 2; tot = P.sum() + 1e-12
    env = np.sqrt(np.convolve(y ** 2, np.ones(sr // 10) / (sr // 10), 'same'))[:: sr // 10]
    audio = {'bpm': round(60 / float(lag), 1), 'hits': hits, 'bands': {k: round(float(P[(f >= lo) & (f < hi)].sum() / tot * 100), 1) for k, (lo, hi) in bands.items()},
             'loudness': [round(float(20 * np.log10(v + 1e-9)), 1) for v in env], 'flux': [round(float(v), 2) for v in flux[:: int(frs / 10)]]}
    cut_t = np.array([s['t'] for s in shots[1:]])
    audio['cutsOnOnset'] = int(sum(1 for c in cut_t if np.min(np.abs(onsets - c)) < 0.06)) if len(onsets) else 0

# ---------------------------------------------------------------- the whole film
allpx = LAB[::6, ::3, ::3].reshape(-1, 3)
C, w = kmeans(allpx[:: max(1, len(allpx) // 20000)], 8)
lens = np.array([s['dur'] for s in shots])
res = {
    'source': os.path.basename(video), 'width': W0, 'height': H0, 'fps': fps, 'duration': round(dur, 3), 'frames': n,
    'rhythm': {'shots': len(shots), 'mean': round(float(lens.mean()), 3), 'median': round(float(np.median(lens)), 3),
               'micro': int((lens <= 0.25).sum()), 'holds': int((lens >= 2).sum()), 'cuts': [s['t'] for s in shots[1:]]},
    'palette': [{'hex': lab2hex(c), 'lab': [round(float(v), 1) for v in c], 'w': round(float(x), 3)} for c, x in zip(C, w)],
    'cadence': {'on': int(np.median([s['cadence']['on'] for s in shots])), 'heldFor': round(float(np.mean([s['cadence']['heldFor'] for s in shots])), 2)},
    'texture': {k: round(float(np.mean([s['texture'][k] for s in shots])), 3) for k in ('grain', 'detail', 'edges')},
    'audio': audio, 'shots': shots,
}
json.dump(res, open(f'{out}/study.json', 'w'), indent=1)
print(f"{len(shots)} shots · {res['rhythm']['median']}s median · on {res['cadence']['on']}s · bpm {audio and audio['bpm']}")
