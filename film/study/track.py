"""Analyse a music track for the cut: tempo, downbeat grid, per-bar energy and low end, section boundaries
(novelty), and the best 60 s window (sparse start, a lift, low end saved for the end). Writes <name>-track.json and
<name>-track.png.

    python3 track.py <audio> <outdir> [film_seconds=60]
"""
import json, subprocess, sys, os
import numpy as np
from scipy.signal import stft, find_peaks
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
FILM = float(sys.argv[3]) if len(sys.argv) > 3 else 60.0
name = os.path.splitext(os.path.basename(src))[0]
sr = 22050
y = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True).stdout, np.int16).astype(np.float32) / 32768
dur = len(y) / sr
hop = 512
f, t, Z = stft(y, fs=sr, nperseg=2048, noverlap=2048 - hop)
mag = np.abs(Z)
flux = np.maximum(0, np.diff(np.log1p(mag * 100), axis=1)).sum(0)
flux = (flux - flux.mean()) / (flux.std() + 1e-9)
fr = sr / hop
# tempo: autocorrelation of onset strength, 80–170 BPM, folded to 110–150 where ambiguous
ac = np.correlate(flux, flux, 'full')[len(flux) - 1:]
lags = np.arange(len(ac)) / fr
ok = (lags > 60 / 170) & (lags < 60 / 80)
beat = float(lags[ok][np.argmax(ac[ok])])
bpm = 60 / beat
while bpm < 105: bpm *= 2; beat /= 2
while bpm > 160: bpm /= 2; beat *= 2
# phase: the beat offset that collects the most onset energy
best = (0, -1)
for ph in np.linspace(0, beat, 48, endpoint=False):
    idx = ((np.arange(ph, dur, beat)) * fr).astype(int)
    idx = idx[idx < len(flux)]
    s = flux[idx].sum()
    if s > best[1]: best = (ph, s)
phase = best[0]
bar = beat * 4
# downbeat: of the 4 beat positions, the one whose low end hits hardest
low = mag[(f > 30) & (f < 150)].sum(0)
def at(tt): i = int(tt * fr); return low[min(max(i, 0), len(low) - 1)]
db = max(range(4), key=lambda k: sum(at(phase + k * beat + j * bar) for j in range(int(dur / bar))))
d0 = phase + db * beat
bars = np.arange(d0, dur - 0.01, bar)
P = mag ** 2
band = lambda a, b: P[(f >= a) & (f < b)].sum(0)
tot, sub, hi = P.sum(0) + 1e-12, band(20, 120), band(4000, 11000)
def mean_in(x, a, b): m = (t >= a) & (t < b); return float(x[m].mean()) if m.any() else 0.0
rows = []
for k, b0 in enumerate(bars):
    b1 = b0 + bar
    rows.append({'bar': k, 't': round(float(b0), 3), 'loud': round(10 * np.log10(mean_in(tot, b0, b1) + 1e-12), 1), 'sub': round(mean_in(sub, b0, b1) / (mean_in(tot, b0, b1) + 1e-12) * 100, 1), 'air': round(mean_in(hi, b0, b1) / (mean_in(tot, b0, b1) + 1e-12) * 100, 1)})
# sections: novelty between consecutive 4-bar blocks of the spectrum
spec_bar = np.array([np.log1p(mag[:, (t >= b) & (t < b + bar)].mean(1)) for b in bars])
nov = [0.0] + [float(np.linalg.norm(spec_bar[i] - spec_bar[i - 1])) for i in range(1, len(spec_bar))]
nov = np.array(nov)
sec_idx = [i for i in find_peaks(nov, distance=4, height=np.percentile(nov, 70))[0]]
sections = [round(float(bars[i]), 2) for i in sec_idx]
# best window: N bars ~ FILM seconds, starting on a section boundary or bar 0; score = quiet start, energy rise,
# strongest low end in the last quarter, ends near a section boundary
N = int(round(FILM / bar))
loud = np.array([r['loud'] for r in rows]); subs = np.array([r['sub'] for r in rows])
cands = []
for s in range(0, max(1, len(rows) - N + 1)):
    w = loud[s:s + N]
    if len(w) < N: break
    q = max(1, N // 4)
    score = (w[-q:].mean() - w[:q].mean()) * 1.0 + (subs[s + N - q:s + N].mean() - subs[s:s + q].mean()) * 0.15 + (2 if s in [0] + sec_idx else 0) + (2 if (s + N) in sec_idx or s + N >= len(rows) - 1 else 0)
    cands.append((round(float(score), 2), s))
cands.sort(reverse=True)
win = cands[0][1] if cands else 0
res = {'name': name, 'duration': round(dur, 2), 'bpm': round(bpm, 2), 'beat': round(beat, 4), 'bar': round(bar, 4), 'firstDownbeat': round(float(d0), 3),
       'sections': sections, 'window': {'startBar': int(win), 'start': rows[win]['t'] if rows else 0, 'bars': N, 'seconds': round(N * bar, 2)}, 'topWindows': cands[:5], 'bars': rows}
json.dump(res, open(os.path.join(out, name + '-track.json'), 'w'), indent=1)
# picture: loudness and sub per bar, sections, the chosen window
W, H = 1600, 220
im = Image.new('RGB', (W, H), (20, 17, 21)); d = ImageDraw.Draw(im)
X = lambda tt: int(tt / dur * (W - 1))
lo, hi_ = loud.min(), loud.max()
for r in rows:
    h = int((r['loud'] - lo) / (hi_ - lo + 1e-9) * 140)
    d.rectangle([X(r['t']), 160 - h, X(r['t'] + bar) - 1, 160], fill=(80, 120, 160))
    sh = int(min(r['sub'], 60) / 60 * 40)
    d.rectangle([X(r['t']), 200 - sh, X(r['t'] + bar) - 1, 200], fill=(238, 144, 112))
for s in sections: d.line([(X(s), 0), (X(s), 205)], fill=(240, 240, 240))
if rows:
    a, b = rows[win]['t'], rows[win]['t'] + N * bar
    d.rectangle([X(a), 2, X(b), 14], fill=(192, 246, 60))
for s in range(0, int(dur) + 1, 10): d.text((X(s) + 2, 206), f'{s}s', fill=(200, 200, 200))
im.save(os.path.join(out, name + '-track.png'))
print(json.dumps({k: res[k] for k in ['name', 'duration', 'bpm', 'bar', 'firstDownbeat', 'sections', 'window', 'topWindows']}))
