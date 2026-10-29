"""Study a reference film: shots, motion energy, music tempo and beats, transients (sound design), and how cuts
sit on the beat. Writes <name>.json, a per-shot contact sheet and a timeline strip to the output folder.

    python3 analyze.py <video> <outdir>
"""
import json, subprocess, sys, os, re
import numpy as np
from scipy.signal import find_peaks, stft
from PIL import Image, ImageDraw, ImageFont

video, out = sys.argv[1], sys.argv[2]
name = os.path.splitext(os.path.basename(video))[0]
os.makedirs(out, exist_ok=True)

def run(args, **kw):
    return subprocess.run(args, capture_output=True, **kw)

# ---------------------------------------------------------------- video: frames as small grey images
probe = json.loads(run(['ffprobe', '-v', 'error', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', video]).stdout)
dur = float(probe['format']['duration'])
num, den = probe['streams'][0]['r_frame_rate'].split('/')
fps = float(num) / float(den)
W, H = 160, 90
raw = run(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'scale={W}:{H},format=gray', '-f', 'rawvideo', '-']).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
n = len(frames)
t_of = lambda i: i / fps
diff = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))          # motion energy per frame
# hard cuts: a frame difference far above its neighbourhood
med = np.array([np.median(diff[max(0, i - 12):i + 12]) for i in range(len(diff))])
cut_idx = [i + 1 for i in range(len(diff)) if diff[i] > max(18, med[i] * 3.2)]
cuts = []
for i in cut_idx:
    if not cuts or i - cuts[-1] > fps * 0.12:
        cuts.append(i)
bounds = [0] + cuts + [n]
shots = [{'i': k + 1, 'start': round(t_of(a), 3), 'end': round(t_of(b), 3), 'len': round((b - a) / fps, 3),
          'motion': round(float(diff[a:max(a + 1, b - 1)].mean()), 2), 'luma': round(float(frames[a:b].mean()), 1)}
         for k, (a, b) in enumerate(zip(bounds[:-1], bounds[1:])) if b > a]

# ---------------------------------------------------------------- audio: onsets, tempo, beats, transients
sr = 22050
pcm = run(['ffmpeg', '-v', 'error', '-i', video, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-']).stdout
y = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
hop = 512
f, tt, Z = stft(y, fs=sr, nperseg=2048, noverlap=2048 - hop)
mag = np.abs(Z)
logm = np.log1p(mag * 100)
flux = np.maximum(0, np.diff(logm, axis=1)).sum(axis=0)              # spectral flux = onset strength
flux = (flux - flux.mean()) / (flux.std() + 1e-9)
ft = tt[1:]
frame_rate = sr / hop
# tempo: autocorrelation of the onset envelope between 70 and 180 BPM
ac = np.correlate(flux, flux, mode='full')[len(flux) - 1:]
lags = np.arange(len(ac)) / frame_rate
ok = (lags > 60 / 180) & (lags < 60 / 70)
lag = lags[ok][np.argmax(ac[ok])]
bpm = 60 / lag
# beats: onset peaks at least ~0.7 beat apart
peaks, props = find_peaks(flux, height=0.8, distance=int(frame_rate * lag * 0.7))
beats = [round(float(ft[p]), 3) for p in peaks]
# loud, sharp transients = hits / sound effects
hits, hp = find_peaks(flux, height=3.2, distance=int(frame_rate * 0.25))
rms = np.sqrt(np.convolve(y ** 2, np.ones(sr // 10) / (sr // 10), mode='same'))[:: sr // 10]
cent = (f[:, None] * mag).sum(0) / (mag.sum(0) + 1e-9)                # brightness over time
# how many cuts land on (within 60 ms of) an onset peak
onset_t = ft[find_peaks(flux, height=1.0, distance=int(frame_rate * 0.1))[0]]
cut_t = [t_of(c) for c in cuts]
on_beat = sum(1 for c in cut_t if len(onset_t) and np.min(np.abs(onset_t - c)) < 0.06)
silences = []
quiet = rms < (rms.max() * 0.04)
for k in range(len(quiet)):
    if quiet[k] and (k == 0 or not quiet[k - 1]): s0 = k
    if quiet[k] and (k == len(quiet) - 1 or not quiet[k + 1]) and (k - s0) >= 3: silences.append([round(s0 / 10, 1), round(k / 10, 1)])

res = {'name': name, 'duration': round(dur, 2), 'fps': fps, 'shots': len(shots), 'avgShot': round(dur / max(1, len(shots)), 2),
       'medianShot': round(float(np.median([s['len'] for s in shots])), 2), 'bpm': round(float(bpm), 1), 'beatSec': round(float(lag), 3),
       'cutsOnOnset': f'{on_beat}/{len(cuts)}', 'hits': [round(float(ft[h]), 2) for h in hits], 'silences': silences,
       'loudness': [round(float(v), 3) for v in rms], 'brightness': [round(float(v)) for v in cent[:: int(frame_rate / 2)]],
       'shotList': shots, 'beats': beats}
json.dump(res, open(os.path.join(out, name + '.json'), 'w'), indent=1)

# ---------------------------------------------------------------- contact sheet: middle frame of every shot
cols, tw, th = 6, 320, 180
full = lambda t: run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', '-vf', f'scale={tw}:{th}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']).stdout
rows = (len(shots) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 22)), (20, 17, 21))
d = ImageDraw.Draw(sheet)
for k, s in enumerate(shots):
    b = full((s['start'] + s['end']) / 2)
    if len(b) == tw * th * 3:
        sheet.paste(Image.frombytes('RGB', (tw, th), b), ((k % cols) * tw, (k // cols) * (th + 22)))
    d.text(((k % cols) * tw + 6, (k // cols) * (th + 22) + th + 4), f"#{s['i']} {s['start']:.2f}s  {s['len']:.2f}s  m{s['motion']}", fill=(220, 220, 220))
sheet.save(os.path.join(out, name + '-shots.jpg'), quality=82)

# ---------------------------------------------------------------- timeline: loudness, onsets, cuts, hits
TW, TH = 1800, 260
tl = Image.new('RGB', (TW, TH), (20, 17, 21))
d = ImageDraw.Draw(tl)
X = lambda t: int(t / dur * (TW - 1))
for k, v in enumerate(rms):
    h = int(v / (rms.max() + 1e-9) * 110)
    d.line([(X(k / 10), 130 - h), (X(k / 10), 130 + h)], fill=(80, 120, 160))
for k, v in enumerate(flux[::2]):
    if v > 0: d.line([(X(ft[k * 2]), 250), (X(ft[k * 2]), 250 - int(min(v, 8) * 10))], fill=(110, 110, 110))
for c in cut_t: d.line([(X(c), 0), (X(c), 140)], fill=(192, 246, 60))
for h in res['hits']: d.ellipse([X(h) - 4, 4, X(h) + 4, 12], fill=(238, 144, 112))
for s in range(0, int(dur) + 1, 5): d.text((X(s) + 2, 236), f'{s}s', fill=(200, 200, 200))
tl.save(os.path.join(out, name + '-timeline.png'))
print(json.dumps({k: res[k] for k in ['name', 'duration', 'fps', 'shots', 'avgShot', 'medianShot', 'bpm', 'beatSec', 'cutsOnOnset', 'silences']}), '\nhits', res['hits'])
