"""Mix the score: music bed + sound effects placed on the film's events (same bar grid as index.html).
Writes score.wav (the studio plays it) and audio/cues.json.

    python3 tools/mix.py
"""
import json, pathlib, subprocess
import numpy as np

R = pathlib.Path(__file__).resolve().parent.parent
SR = 48000
BAR = 2.97222; Q = BAR / 4; E8 = BAR / 8; S16 = BAR / 16
b = lambda k: k * BAR


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


music = load(R / 'audio' / 'music.wav')
N = len(music)
fx = {p.stem: load(p) for p in (R / 'audio' / 'sfx').glob('*.mp3')}
cues = []
cue = lambda t, name, gain=1.0: cues.append((round(t, 3), name, gain))

# hook: the pixel blinks, the r resolves, the scan passes
cue(0.0, 'pixel_tick', 0.8); cue(0.16, 'pixel_tick', 0.6)
for k, t in enumerate([0.36, 0.48, 0.6, 0.72, 0.84]): cue(t, 'pixel_tick', 0.45 + 0.08 * k)
cue(0.95, 'scan_sweep', 0.7); cue(1.36, 'whoosh', 0.6)
# feel: twelve prints land, the pile slides away, cut-out letters, the snap
for i in range(12): cue(b(0.5) + i * E8 * 0.62, 'paper_slap', 0.55 + 0.3 * ((i * 7) % 5) / 5)
feel_len = b(2) - b(0.5)
cue(b(0.5) + feel_len - 1.05, 'whoosh', 0.7)
cue(b(0.5) + feel_len - 2.0, 'typing', 0.5)
cue(b(0.5) + feel_len - 0.75, 'paper_tear', 0.8)
# measure: boxes snap on, code types, the curve draws, counters run
cue(b(2), 'counter', 0.35)
for i in range(4):
    t0 = b(2) + i * BAR
    for j in range(3): cue(t0 + Q * 0.5 + j * Q * 0.75, 'box_snap', 0.8)
    cue(t0 + 0.2, 'typing', 0.25)
    cue(t0 + Q * 2.6, 'scan_sweep', 0.35)
cue(b(5) + BAR * 0.5, 'glitch', 0.7); cue(b(5) + BAR * 0.75, 'glitch', 0.5)
cue(b(6) - 3.0, 'riser', 0.75)
# the drop
cue(b(6), 'impact', 1.0)
# compile
cue(b(7), 'whoosh', 0.7)
cue(b(7) + (b(12) - b(7)) * 0.55, 'whoosh', 0.6)
cue(b(7) + (b(12) - b(7)) * 0.6, 'typing', 0.45)
# rebuild: a seam and a score per pair
per = (b(16) - b(12)) / 6
for i in range(6):
    cue(b(12) + i * per + per * 0.28, 'seam', 0.75)
    cue(b(12) + i * per + per * 0.45, 'counter', 0.3)
# portals: a deep whoosh as each material opens, then the wall
plen = b(19) - b(16)
for x in (0.0, 0.437, 0.563): cue(b(16) + x * plen * 0.86, 'portal', 0.75)
cue(b(16) + plen * 0.82, 'whoosh', 0.6)
# outro: the collapse, the r, the chime
cue(b(19), 'whoosh', 0.55)
for k in range(4): cue(b(19) + 0.72 + k * 0.16, 'pixel_tick', 0.45)
cue(b(19) + 1.3, 'chime', 0.8)

out = np.zeros_like(music)
duck = np.ones(N, np.float32)
for t, name, g in cues:
    s = fx[name]; i = int(t * SR); e = min(N, i + len(s))
    if i >= N: continue
    out[i:e] += s[:e - i] * g * 0.55
    if name == 'impact':  # the music makes room for the hit
        d = np.ones(N, np.float32); k = int(0.9 * SR)
        d[i:i + k] = np.minimum(d[i:i + k], 0.55 + 0.45 * np.linspace(0, 1, len(d[i:i + k])))
        duck = np.minimum(duck, d)
mix = music * duck[:, None] * 0.9 + out
peak = np.abs(mix).max()
mix = mix / max(peak, 1e-6) * 0.89  # about −1 dBFS
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', '-c:a', 'pcm_s16le', str(R / 'score.wav')], input=mix.astype(np.float32).tobytes())
json.dump([{'t': t, 'sfx': n, 'gain': g} for t, n, g in sorted(cues)], open(R / 'audio' / 'cues.json', 'w'), indent=1)
print(f'{len(cues)} cues, peak {peak:.2f} → score.wav')
