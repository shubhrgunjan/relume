"""Sound-design profile of a film, per 2 s window: band energies (sub/bass/low-mid/high-mid/air), spectral flatness
(noise vs tone), onset density, dominant pitch class, plus a key estimate and whether cuts follow the tempo grid.

    python3 audio.py <video> <analysis.json from analyze.py>
"""
import json, subprocess, sys
import numpy as np
from scipy.signal import stft

video, meta = sys.argv[1], json.load(open(sys.argv[2]))
sr = 22050
y = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True).stdout, np.int16).astype(np.float32) / 32768
f, t, Z = stft(y, fs=sr, nperseg=4096, noverlap=4096 - 1024)
P = np.abs(Z) ** 2
bands = {'sub <60': (20, 60), 'bass 60-250': (60, 250), 'lowmid 250-2k': (250, 2000), 'himid 2-6k': (2000, 6000), 'air >6k': (6000, 11000)}
NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
# chroma: fold 80–2000 Hz bins onto pitch classes
sel = (f > 80) & (f < 2000)
pc = (np.round(12 * np.log2(f[sel] / 261.63)) % 12).astype(int)
chroma_t = np.zeros((12, P.shape[1]))
for k in range(12): chroma_t[k] = P[sel][pc == k].sum(0)
flux = np.maximum(0, np.diff(np.log1p(np.abs(Z) * 100), axis=1)).sum(0)
rows = []
win = 2.0
for w0 in np.arange(0, t[-1], win):
    m = (t >= w0) & (t < w0 + win)
    if not m.any(): continue
    Pw = P[:, m]
    tot = Pw.sum() + 1e-12
    be = {k: round(float(Pw[(f >= a) & (f < b)].sum() / tot * 100), 1) for k, (a, b) in bands.items()}
    spec = Pw.mean(1) + 1e-12
    flat = float(np.exp(np.log(spec).mean()) / spec.mean())
    fm = m[1:] if len(m) > len(flux) else m[:len(flux)]
    dens = int((flux[fm] > np.percentile(flux, 90)).sum())
    ch = chroma_t[:, m].sum(1)
    rows.append({'t': round(float(w0), 1), 'loud': round(float(10 * np.log10(tot / m.sum() + 1e-12)), 1), **be, 'flat': round(flat, 3), 'hits': dens, 'pitch': NOTES[int(ch.argmax())]})
# key: Krumhansl profiles against overall chroma
maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
mnr = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
c = chroma_t.sum(1); c = c / c.sum()
best = max(((np.corrcoef(np.roll(p, k), c)[0, 1], f'{NOTES[k]} {name}') for k in range(12) for p, name in ((maj, 'major'), (mnr, 'minor'))))
# cuts against the beat grid: phase of each cut within the beat
beat = meta['beatSec']
cuts = [s['start'] for s in meta['shotList'][1:]]
phase = [((c0 % beat) / beat) for c0 in cuts]
on_grid = sum(1 for p in phase if p < 0.12 or p > 0.88 or abs(p - 0.5) < 0.12)
print(json.dumps({'key': best[1], 'keyFit': round(float(best[0]), 2), 'cutsOnBeatOrHalf': f'{on_grid}/{len(cuts)}', 'bpm': meta['bpm']}))
print('t     loud  sub  bass lowmid himid air   flat  hits pitch')
for r in rows: print(f"{r['t']:5.1f} {r['loud']:5.1f} {r['sub <60']:4.1f} {r['bass 60-250']:5.1f} {r['lowmid 250-2k']:6.1f} {r['himid 2-6k']:5.1f} {r['air >6k']:4.1f} {r['flat']:6.3f} {r['hits']:4d}  {r['pitch']}")
