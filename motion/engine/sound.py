"""Compose an original sound bed in the measured style of a reference: its tempo on its own beat phase, its band
balance (sub / bass / low-mid / high-mid / air), and textural hits where the reference has hits. Nothing is copied:
the music is synthesised here, the hits come from a sound library.

    python3 engine/sound.py <study dir> <out.wav> [--sfx dir]
"""
import json, os, subprocess, sys, glob
import numpy as np
from scipy.signal import stft, butter, sosfilt

study_dir, out = sys.argv[1], sys.argv[2]
sfx_dir = sys.argv[sys.argv.index('--sfx') + 1] if '--sfx' in sys.argv else None
S = json.load(open(f'{study_dir}/study.json')); A = S['audio']
SR = 48000; dur = S['duration']; N = int(dur * SR); t = np.arange(N) / SR
ref = os.path.join(os.path.dirname(study_dir.rstrip('/')), os.path.basename(study_dir.rstrip('/')) + '.mp4')

# ---------------------------------------------------------------- the reference's beat grid (tempo and phase)
sr = 22050
y = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', ref, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True).stdout, np.int16).astype(np.float32) / 32768
f, tt, Z = stft(y, fs=sr, nperseg=1024, noverlap=768); M = np.log1p(np.abs(Z) * 100)
low = np.maximum(0, np.diff(M[f < 150], axis=1)).sum(0); fr = sr / 256
period = 60 / A['bpm']
offs = np.arange(0, period, 1 / fr)
phase = offs[int(np.argmax([low[np.clip(np.round(np.arange(o, dur, period) * fr).astype(int), 0, len(low) - 1)].sum() for o in offs]))]
beats = np.arange(phase, dur, period)
loud = np.array(A['loudness']); env_ref = np.interp(t, np.arange(len(loud)) / 10, 10 ** (loud / 20))  # the reference's loudness shape
env_ref = env_ref / (env_ref.max() + 1e-9)

# ---------------------------------------------------------------- synthesis
lp = lambda x, hz, o=2: sosfilt(butter(o, hz, 'low', fs=SR, output='sos'), x)
bp = lambda x, a, b, o=2: sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
hp = lambda x, hz, o=2: sosfilt(butter(o, hz, 'high', fs=SR, output='sos'), x)
rng = np.random.default_rng(7)
# layers, built separately so their gains can be solved against the reference's band balance
L = {}
def kick_at(buf, at, gain=1.0):
    n = int(0.42 * SR); k = np.arange(n) / SR; fq = 64 + 90 * np.exp(-k * 28); ph = 2 * np.pi * np.cumsum(fq) / SR
    s = np.sin(ph) * np.exp(-k * 7.5) * gain; i = int(at * SR); e = min(N, i + n); buf[i:e] += s[:e - i]
L['kick'] = np.zeros(N)
for b in beats: kick_at(L['kick'], b)
# bass: E minor, eighth-note pulses, a soft saw through a low-pass
notes = [41.2, 41.2, 49.0, 36.7]
bass = np.zeros(N)
for k, b in enumerate(np.arange(phase, dur, period / 2)):
    hz = notes[int(k / 8) % 4] * 2; n = int(period / 2 * SR * 0.92); kk = np.arange(n) / SR
    saw = 2 * ((kk * hz) % 1) - 1; s_ = (saw * 0.6 + np.sin(2 * np.pi * hz * kk)) * np.exp(-kk * 5) * (0.9 if k % 2 == 0 else 0.6)
    i = int(b * SR); e = min(N, i + n); bass[i:e] += s_[:e - i]
L['bass'] = lp(bass, 260)
# pad: E minor chord tones with a slow swell: the low-mid body
pad = sum(np.sin(2 * np.pi * hz * t + rng.random() * 6) * w for hz, w in [(164.8, 0.5), (196.0, 0.35), (246.9, 0.3), (329.6, 0.18), (523.3, 0.08)])
L['pad'] = bp(pad * (0.55 + 0.45 * np.sin(2 * np.pi * t / (period * 16)) ** 2), 200, 1800)
# hats on the off-beats, and a bed of paper rustle for the upper bands
hats = np.zeros(N)
for b in np.arange(phase + period / 2, dur, period):
    n = int(0.05 * SR); s_ = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 90); i = int(b * SR); e = min(N, i + n); hats[i:e] += s_[:e - i]
L['hats'] = hp(hats, 6000)
rustle = rng.standard_normal(N) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * t / (period * 2))))
L['himid'] = bp(rustle, 2000, 6000); L['air'] = hp(rustle, 6000)
L['kick'] = hp(L['kick'], 58)
# hits: a library sound plus a sharp broadband transient, so each lands as a hit
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).copy()
lib = {os.path.splitext(os.path.basename(p))[0]: load(p) for p in glob.glob(f'{sfx_dir}/*.mp3')} if sfx_dir else {}
order = [k for k in ('paper_slap', 'paper_tear', 'box_snap', 'scan_sweep', 'whoosh') if k in lib]
hit = np.zeros(N)
for j, h in enumerate(A['hits']):
    i = int(h * SR)
    if order: s_ = lib[order[j % len(order)]]; i0 = max(0, i - int(0.01 * SR)); e = min(N, i0 + len(s_)); hit[i0:e] += s_[:e - i0] / (np.abs(s_).max() + 1e-9)
    n = int(0.03 * SR); tr = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 160); e = min(N, i + n); hit[i:e] += tr[:e - i] * 1.2
L['hits'] = hit

# solve the gains: each layer's band power at unit level; mix power is the gain-squared-weighted sum, so
# non-negative least squares on squared gains matches the reference's band balance
from scipy.optimize import nnls
fq = np.fft.rfftfreq(N // 2 * 2, 1 / SR)
bands = {'sub': (20, 60), 'bass': (60, 250), 'lowmid': (250, 2000), 'himid': (2000, 6000), 'air': (6000, 11000)}
names = list(L)
U = {n: L[n] / (np.sqrt((L[n] ** 2).mean()) + 1e-9) for n in names}      # unit RMS
Bu = np.array([[(np.abs(np.fft.rfft(U[n][: N // 2 * 2])) ** 2)[(fq >= a) & (fq < b)].sum() for n in names] for a, b in bands.values()])
target = np.array([A['bands'][k] for k in bands]) / 100
x, _ = nnls(Bu / Bu.sum(0).mean(), target)
# hits and kicks must stay audible as events: give them a floor, then refit the rest around them
for keep in ('hits', 'kick'):
    j = names.index(keep); x[j] = max(x[j], 0.06)
fixed = sum(Bu[:, j] * x[j] for j, n in enumerate(names) if n in ('hits', 'kick')) / Bu.sum(0).mean()
free = [j for j, n in enumerate(names) if n not in ('hits', 'kick')]
xf, _ = nnls((Bu / Bu.sum(0).mean())[:, free], np.maximum(0, target * (1 + fixed.sum()) - fixed))
for k, j in enumerate(free): x[j] = xf[k]
mix = sum(U[n] * np.sqrt(x[j]) for j, n in enumerate(names))
mix = mix * (0.4 + 0.6 * env_ref)
pw = np.abs(np.fft.rfft(mix[: N // 2 * 2])) ** 2
print('bands', {k: round(float(pw[(fq >= a) & (fq < b)].sum() / pw.sum() * 100), 1) for k, (a, b) in bands.items()}, 'target', A['bands'])
mix = mix / (np.abs(mix).max() + 1e-9) * 0.85
fade = np.clip((dur - t) / 1.2, 0, 1); mix *= fade
st = np.stack([mix, mix], 1).astype(np.float32)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', '-c:a', 'pcm_s16le', out], input=st.tobytes())
print(f'sound: {dur:.1f}s, {A["bpm"]} BPM, phase {phase:.3f}s, {len(beats)} beats, {len(A["hits"])} hits → {out}')
