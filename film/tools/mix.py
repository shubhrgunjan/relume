"""Mix the film's sound: voice + sound design, no music (the music is added later, so leave room for it).
Cues are placed from the voice's word timings, the same way index.html times its shots.
Writes score.wav (the studio plays it) and audio/cues.json.

    python3 tools/mix.py [voice=brian] [duration]
"""
import json, pathlib, subprocess, sys
import numpy as np

R = pathlib.Path(__file__).resolve().parent.parent
SR = 48000
VOICE = sys.argv[1] if len(sys.argv) > 1 else 'brian'
VO_AT = 1.5  # the voice starts after the pixel hook (VO_AT in index.html)


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


vo = load(R / 'vo' / f'{VOICE}.mp3')
words = [dict(w, k=''.join(c for c in w['w'].lower() if c.isalpha() or c == "'"), t=w['start'] + VO_AT) for w in json.load(open(R / 'vo' / f'{VOICE}.json'))['words']]


def at(phrase, nth=0):
    """film time of the nth occurrence of a phrase (mirrors at() in index.html)"""
    ks, seen = phrase.split(), 0
    for i in range(len(words) - len(ks) + 1):
        if all(words[i + j]['k'] == k for j, k in enumerate(ks)):
            if seen == nth: return words[i]['t']
            seen += 1
    raise KeyError(phrase)


DUR = float(sys.argv[2]) if len(sys.argv) > 2 else None
fx = {p.stem: load(p) for p in (R / 'audio' / 'sfx').glob('*.mp3')}
cues = []
cue = lambda t, name, gain=1.0: cues.append((round(t, 3), name, gain))

T = dict(feel=at('every website'), moves=at('the way it moves'), type=at('the weight'), colour=at('the colours'),
         prompt=at('most of that'), title=at('relume measures'), visit=at('it visits'),
         scrolls=at('it scrolls'), hovers=at('hovers'), watches=at('watches'), lang=at('then it turns'), tokens=at('colours', 1),
         builds=at('then your agent'), resend=at('a bike'), linear=at('an incident'), cosmos=at('a beauty'), check=at('and relume'),
         tag=at('give your'), end=at('relume', 2))
DUR = DUR or T['end'] + 4.3  # DURATION in index.html
N = int(DUR * SR)
B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

# hook: the pixel lights, the r assembles in Bayer order, light passes, we dive in
cue(0.04, 'pixel_tick', 0.9)
for d in sorted(set(B4))[::3]: cue(0.42 + d / 16 * 0.32, 'pixel_tick', 0.35 + d / 40)
cue(0.95, 'scan_sweep', 0.6)
cue(T['feel'] - 0.42, 'whoosh', 0.8)
# feel: the wall pulls back out of the dive
cue(T['feel'] + 0.05, 'portal', 0.35)
# moves: the curve draws, the word rides it
cue(T['moves'] - 0.2, 'whoosh', 0.5)
cue(T['moves'] + 0.05, 'scan_sweep', 0.45)
cue(T['moves'] + 0.3, 'seam', 0.55)
# type: the Aa lands, the guides tick on
cue(T['type'] - 0.1, 'box_snap', 0.8)
for i in range(3): cue(T['type'] + 0.05 + i * 0.12, 'pixel_tick', 0.4)
# colour: a snap as each dropper takes its colour, a swish as it flies to the palette
cue(T['colour'] - 0.15, 'whoosh', 0.45)
for i, w in enumerate(['the colours', 'colours', 'it', 'chooses']):
    t0 = at(w, 1 if w == 'it' else 0) - 0.05
    cue(t0, 'box_snap', 0.6); cue(t0 + 0.45, 'seam', 0.3)
# prompt: a plain request is typed, the rich things fall flat
cue(T['prompt'] - 0.3, 'whoosh', 0.45)
cue(T['prompt'], 'typing', 0.45)
for i in range(8): cue(T['prompt'] - 0.3 + 0.5 + i * 0.12 + 0.78, 'pixel_tick', 0.25)
cue(T['prompt'] + 1.4, 'glitch', 0.3)
# title: a riser into the r, a hit, the ruler counts
cue(T['title'] - 0.15 - 3.0, 'riser', 0.4)
cue(T['title'] - 0.15, 'impact', 0.75)
cue(T['title'] + 0.05, 'counter', 0.35)
# visit: the browser flies in, the cursor clicks, the page scrolls
cue(T['visit'] - 0.2, 'whoosh', 0.6)
cue(T['visit'] - 0.2 + 1.05, 'pixel_tick', 0.7)
cue(T['visit'] - 0.2 + 1.2, 'seam', 0.35)

cue(T['scrolls'] - 0.05, 'scan_sweep', 0.4)
cue(T['hovers'] + 0.25, 'box_snap', 0.65)
# watches: the window becomes a frame, the strip runs, frames counted
cue(T['watches'] - 0.15, 'whoosh', 0.5)
cue(T['watches'] + 0.35, 'counter', 0.4)
for i in range(6): cue(T['watches'] + 0.5 + i * 0.28, 'pixel_tick', 0.22)
# lang: the frames break into pixels and stream into the skill, lines type in, the agent picks it up
cue(T['lang'] - 0.25, 'glitch', 0.4)
cue(T['lang'] - 0.1, 'scan_sweep', 0.4)
cue(T['lang'] + 0.3, 'typing', 0.35); cue(T['lang'] + 1.8, 'typing', 0.3)
cue(at('agent'), 'chime', 0.25)
# tokens: a whip and a hit on each word
for w, n in (('colours', 1), ('type', 1), ('spacing', 0), ('motion', 0), ('behaviour', 0)):
    t0 = at(w, n) - 0.12
    cue(t0 - 0.08, 'whoosh', 0.55); cue(t0 + 0.05, 'box_snap', 0.6)
cue(at('behaviour') + 0.75, 'pixel_tick', 0.6)  # the button press
# build: typing, the page assembles in pixels
cue(T['builds'] - 0.25, 'whoosh', 0.5)
cue(T['builds'], 'typing', 0.45)
cue(T['builds'] + 0.9, 'counter', 0.3)
for i in range(8): cue(T['builds'] + 0.9 + i * 0.25, 'pixel_tick', 0.2)
# pairs: a seam per pair, a snap when the source arrives, a tick for the score
for k, src in (('resend', 'resend'), ('linear', 'linear'), ('cosmos', 'cosmos')):
    cue(T[k] - 0.45, 'seam', 0.7 if k != 'resend' else 0.4)
    cue(at(src) - 0.1, 'whoosh', 0.35); cue(at(src) + 0.35, 'box_snap', 0.5)
# check: the scan, boxes snapping, the score counting
cue(T['check'] - 0.2, 'whoosh', 0.5)
cue(T['check'] + 0.15, 'scan_sweep', 0.6)
for i in range(4): cue(T['check'] + 0.4 + i * 0.25, 'box_snap', 0.35)
cue(T['check'] + 1.3, 'counter', 0.5)
# tag and end: a breath, then the r assembles and the chime
cue(T['tag'] - 0.3, 'portal', 0.3)
cue(T['end'] - 3.0, 'riser', 0.25)
cue(T['end'] - 0.15, 'whoosh', 0.45)
for k in range(5): cue(T['end'] - 0.1 + k * 0.08, 'pixel_tick', 0.4)
cue(T['end'] + 0.75, 'scan_sweep', 0.4)
cue(T['end'] + 0.9, 'chime', 0.8)

# ambient bed: low filtered noise breathing slowly, no melody, so the music has room later
r = np.random.default_rng(3)
noise = r.standard_normal((N, 2)).astype(np.float32)
k = int(SR * 0.004); bed = np.cumsum(noise, 0); bed = (bed[k:] - bed[:-k])[:N]  # moving average: a soft low-pass
bed = np.vstack([bed, np.zeros((N - len(bed), 2), np.float32)])
bed -= np.convolve(bed[:, 0], np.ones(2400) / 2400, 'same')[:, None]  # remove rumble
bed /= np.abs(bed).max() + 1e-6
tt = np.arange(N) / SR
bed *= (0.5 + 0.5 * np.sin(tt * 2 * np.pi / 7.0))[:, None] * 0.5 + 0.5
bed *= np.clip(tt / 1.2, 0, 1)[:, None] * 0.05

out = np.zeros((N, 2), np.float32)
for t, name, g in cues:
    s = fx[name]; i = int(t * SR); e = min(N, i + len(s))
    if 0 <= i < N: out[i:e] += s[:e - i] * g * 0.5
# the voice leads; the effects dip a little under each word
v = np.zeros((N, 2), np.float32); i = int(VO_AT * SR); e = min(N, i + len(vo)); v[i:e] = vo[:e - i]
env = np.convolve(np.abs(v[:, 0]), np.ones(4800) / 4800, 'same')
duck = 1 - 0.35 * np.clip(env / (env.max() + 1e-6) * 4, 0, 1)
mix = v * 1.0 + (out + bed) * duck[:, None]
peak = np.abs(mix).max()
mix = mix / max(peak, 1e-6) * 0.79  # about −2 dBFS, headroom for the music
wav = lambda a, f: subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', '-c:a', 'pcm_s16le', str(f)], input=a.astype(np.float32).tobytes())
wav(mix, R / 'score.wav')
# stems at the same gain as the mix, so music can be laid under them and they still sum to score.wav
g = 0.79 / max(peak, 1e-6)
wav(v * g, R / 'audio' / 'stem-voice.wav'); wav((out + bed) * duck[:, None] * g, R / 'audio' / 'stem-sfx.wav')
json.dump([{'t': t, 'sfx': n, 'gain': g} for t, n, g in sorted(cues)], open(R / 'audio' / 'cues.json', 'w'), indent=1)
print(f'{len(cues)} cues, {DUR:.1f}s, peak {peak:.2f} → score.wav')
