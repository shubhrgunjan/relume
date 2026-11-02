"""Score a clone against a studied reference, shot by shot, and say what is off, worst first.
The clone is expected on the same timeline (same length and fps): this measures how faithfully it rebuilds the style
and the choreography, with its own content.

    python3 engine/compare.py <study dir> <clone.mp4> <out dir>

Dimensions (0–100): rhythm (cuts on the same frames), layout (where the masses sit, frame by frame), tone (lightness
distribution), colour (chroma and hue distribution), texture (grain and paper/brush detail), motion (energy curve,
stop-motion cadence, camera drift), audio (onset envelope, hits, band balance). Writes report.json and thumbs/.
"""
import json, os, subprocess, sys
import numpy as np
from scipy.ndimage import gaussian_filter
from scipy.signal import find_peaks, stft

sys.path.insert(0, os.path.dirname(__file__))
study_dir, clip, out = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(f'{out}/thumbs', exist_ok=True)
run = lambda a: subprocess.run(a, capture_output=True)
S = json.load(open(f'{study_dir}/study.json'))
fps = S['fps']
REF = np.load(f'{study_dir}/frames.npz')['lab'].astype(np.float32)
n = len(REF)

from PIL import Image


def frames_rgb(path, w, h, fps_=None):
    vf = (f'fps={fps_},' if fps_ else '') + f'scale={w}:{h}:flags=area'
    raw = run(['ffmpeg', '-v', 'error', '-i', path, '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.float32) / 255


def lab(rgb):
    c = np.where(rgb > 0.04045, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


CAND = lab(frames_rgb(clip, 160, 90, fps))
if len(CAND) < n: CAND = np.concatenate([CAND, np.repeat(CAND[-1:] if len(CAND) else np.zeros((1, 90, 160, 3)), n - len(CAND), 0)])
CAND = CAND[:n]
GR, GC = REF[..., 0], CAND[..., 0]
dR, dC = np.abs(np.diff(GR, axis=0)).mean(axis=(1, 2)), np.abs(np.diff(GC, axis=0)).mean(axis=(1, 2))

# cuts in the clone, detected the same way as in the study
med = np.array([np.median(dC[max(0, i - 12):i + 12]) for i in range(len(dC))])
cc = []
for c in [i + 1 for i in range(len(dC)) if dC[i] > max(7, med[i] * 3.2)]:
    if not cc or c - cc[-1] > 2: cc.append(c)
cc = np.array(cc)
clamp = lambda v, a=0.0, b=1.0: float(min(b, max(a, v)))
key = lambda t, path, w=640, h=360: run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', clip, '-frames:v', '1', '-vf', f'scale={w}:{h}', '-q:v', '3', path])


def runs_of(d):
    rs, r = [], 1
    for s in d < 0.35:
        if s: r += 1
        else: rs.append(r); r = 1
    rs.append(r); return rs


def hist_int(a, b, bins, rng):
    ha, _ = np.histogramdd(a, bins=bins, range=rng); hb, _ = np.histogramdd(b, bins=bins, range=rng)
    ha /= ha.sum() + 1e-9; hb /= hb.sum() + 1e-9
    return float(np.minimum(ha, hb).sum())


shots, notes = [], []
for s in S['shots']:
    a = int(round(s['t'] * fps)); b = min(n, a + s['frames']); i = s['i']
    if b <= a: continue
    R, Cn = REF[a:b], CAND[a:b]
    # rhythm: the cut that opens this shot exists in the clone, within a frame
    if a == 0: rhy = 100.0
    else:
        off = int(np.min(np.abs(cc - a))) if len(cc) else 99
        rhy = 100.0 if off <= 1 else 60.0 if off <= 3 else 0.0
    # layout: blurred lightness maps, frame by frame (correlation of masses, and how far off they are)
    br, bc = gaussian_filter(R[..., 0], (0, 3, 3)), gaussian_filter(Cn[..., 0], (0, 3, 3))
    cors = [np.corrcoef(x.ravel(), y.ravel())[0, 1] if x.std() > 0.5 and y.std() > 0.5 else (1.0 if abs(x.mean() - y.mean()) < 5 else 0.0) for x, y in zip(br, bc)]
    mad = float(np.abs(br - bc).mean())
    lay = 100 * clamp(0.65 * clamp(np.nanmean(cors)) + 0.35 * (1 - mad / 35))
    # tone: lightness histogram overlap plus mean and contrast
    LR, LC = R[..., 0].reshape(-1, 1)[::7], Cn[..., 0].reshape(-1, 1)[::7]
    tone = 100 * clamp(0.6 * hist_int(LR, LC, (20,), [(0, 100)]) + 0.4 * (1 - abs(float(LR.mean() - LC.mean())) / 30))
    # colour: a/b histogram overlap plus mean chroma
    abR, abC = R[..., 1:].reshape(-1, 2)[::7], Cn[..., 1:].reshape(-1, 2)[::7]
    chR, chC = float(np.hypot(*abR.T).mean()), float(np.hypot(*abC.T).mean())
    col = 100 * clamp(0.5 * hist_int(abR, abC, (12, 12), [(-30, 30), (-30, 30)]) + 0.5 * np.exp(-abs(chR - chC) / 5))
    # texture: grain and detail on the middle frame at 640×360, against the reference keyframe
    mid_t = s['t'] + s['dur'] / 2
    th = f'{out}/thumbs/{i:03d}.jpg'; key(mid_t, th, 320, 180)
    mk = f'{out}/mid.jpg'; key(mid_t, mk)
    g = np.asarray(Image.open(mk).convert('L'), np.float32) if os.path.exists(mk) else np.zeros((360, 640))
    cg, cd = float(np.std(g - gaussian_filter(g, 1.2))), float(np.std(gaussian_filter(g, 1.5) - gaussian_filter(g, 6)))
    rg, rd = s['texture']['grain'], s['texture']['detail']
    tex = 100 * clamp(0.5 * np.exp(-abs(np.log((cg + 0.3) / (rg + 0.3))) * 1.4) + 0.5 * np.exp(-abs(np.log((cd + 0.3) / (rd + 0.3))) * 1.4))
    # motion: energy curve shape and level, and the stop-motion cadence
    er, ec = dR[a:b - 1], dC[a:b - 1]
    if len(er) >= 4 and er.std() > 0.05 and ec.std() > 0.05: shape = clamp((np.corrcoef(er, ec)[0, 1] + 0.2) / 1.2)
    else: shape = float(np.exp(-abs(er.mean() - ec.mean()) / 1.5)) if len(er) else 1.0
    level = float(np.exp(-abs(np.log((ec.mean() + 0.2) / (er.mean() + 0.2))))) if len(er) else 1.0
    on_c = int(round(np.median(runs_of(ec)))) if len(ec) else s['cadence']['on']
    cad = 1.0 if on_c == s['cadence']['on'] or s['frames'] <= 4 else 0.4
    mot = 100 * (0.4 * shape + 0.35 * level + 0.25 * cad)
    dims = {'rhythm': round(rhy), 'layout': round(lay), 'tone': round(tone), 'colour': round(col), 'texture': round(tex), 'motion': round(mot)}
    score = round(0.1 * rhy + 0.27 * lay + 0.15 * tone + 0.13 * col + 0.15 * tex + 0.2 * mot)
    # what is off, in measured terms
    f = []
    w = max(0.4, s['dur'])
    if rhy < 100: f.append((100 - rhy, f"cut into shot {i} should land at {s['t']:.2f}s (frame {a})"))
    if lay < 70: f.append((100 - lay, f"layout: the masses do not match the reference (correlation {np.nanmean(cors):.2f}, off by {mad:.0f} L)"))
    dl = float(LC.mean() - LR.mean())
    if tone < 75: f.append((100 - tone, f"tone: {'too light' if dl > 0 else 'too dark'} (L {LC.mean():.0f} vs {LR.mean():.0f})"))
    if col < 75: f.append((100 - col, f"colour: chroma {chC:.0f} vs {chR:.0f}" + (' (needs the lilac/sage/rose tints)' if chC < chR else ' (too saturated)')))
    if tex < 75: f.append((100 - tex, f"texture: grain {cg:.1f} vs {rg:.1f}, detail {cd:.1f} vs {rd:.1f}" + (' (add paper, pencil, charcoal)' if cd < rd else ' (too busy)')))
    if mot < 70: f.append((100 - mot, f"motion: energy {ec.mean() if len(ec) else 0:.1f} vs {er.mean() if len(er) else 0:.1f}, held on {on_c}s vs {s['cadence']['on']}s, curve match {shape:.2f}"))
    for gap, msg in f: notes.append((gap * w, f"shot {i} ({s['t']:.2f}s, {s['dur']:.2f}s): {msg}"))
    shots.append({'i': i, 't': s['t'], 'score': score, 'dims': dims, 'thumb': None, 'w': w})
    print(f'shot {i:2d} {score:3d}  ' + ' '.join(f'{k[:3]} {v:3d}' for k, v in dims.items()), flush=True)

# ---------------------------------------------------------------- sound
audio = 0
ref_audio = S.get('audio')
sr = 22050
y = np.frombuffer(run(['ffmpeg', '-v', 'error', '-i', clip, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-']).stdout, np.int16).astype(np.float32) / 32768
if ref_audio and len(y) > sr:
    hop = 512; f_, tt, Z = stft(y, fs=sr, nperseg=2048, noverlap=2048 - hop); mag = np.abs(Z)
    flux = np.maximum(0, np.diff(np.log1p(mag * 100), axis=1)).sum(0); flux = (flux - flux.mean()) / (flux.std() + 1e-9); frs = sr / hop
    fl = flux[:: int(frs / 10)]; rf = np.array(ref_audio['flux']); m = min(len(fl), len(rf))
    env = clamp((np.corrcoef(fl[:m], rf[:m])[0, 1] + 0.1) / 0.8) if m > 10 else 0
    hits = [float(tt[1:][h]) for h in find_peaks(flux, height=3.2, distance=int(frs * 0.25))[0]]
    rh = np.array(ref_audio['hits']); hit = (sum(1 for h in hits if len(rh) and np.min(np.abs(rh - h)) < 0.1) / max(1, len(rh)))
    P = mag ** 2; tot = P.sum() + 1e-12
    bands = {'sub': (20, 60), 'bass': (60, 250), 'lowmid': (250, 2000), 'himid': (2000, 6000), 'air': (6000, 11000)}
    bc = {k: P[(f_ >= lo) & (f_ < hi)].sum() / tot * 100 for k, (lo, hi) in bands.items()}
    bal = clamp(1 - sum(abs(bc[k] - ref_audio['bands'][k]) for k in bands) / 100)
    audio = round(100 * (0.45 * env + 0.3 * hit + 0.25 * bal))
    if audio < 75: notes.append(((100 - audio) * 6, f"audio: onset envelope match {env:.2f}, hits matched {hit:.0%}, band balance {bal:.2f}"))
else:
    notes.append((600, 'audio: the clone has no sound yet'))

for s in shots: s['thumb'] = os.path.relpath(f'{out}/thumbs/{s["i"]:03d}.jpg', os.path.join(out, '..', '..'))
W = np.array([s['w'] for s in shots])
scores = {d: round(float(np.average([s['dims'][d] for s in shots], weights=W))) for d in ('rhythm', 'layout', 'tone', 'colour', 'texture', 'motion')}
scores['audio'] = audio
weights = {'rhythm': 0.12, 'layout': 0.22, 'tone': 0.12, 'colour': 0.12, 'texture': 0.13, 'motion': 0.17, 'audio': 0.12}
overall = round(sum(scores[k] * w for k, w in weights.items()))
notes.sort(key=lambda x: -x[0])
rep = {'clip': os.path.basename(clip), 'overall': overall, 'scores': scores, 'cutsFound': len(cc), 'cutsRef': len(S['rhythm']['cuts']),
       'shots': [{k: v for k, v in s.items() if k != 'w'} for s in shots], 'findings': [m for _, m in notes[:30]]}
json.dump(rep, open(f'{out}/report.json', 'w'), indent=1)
if os.path.exists(f'{out}/mid.jpg'): os.remove(f'{out}/mid.jpg')
print(f"overall {overall}  " + '  '.join(f'{k} {v}' for k, v in scores.items()))
