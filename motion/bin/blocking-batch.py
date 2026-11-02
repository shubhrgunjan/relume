"""Blocking for several shots at once (middle of each): prints regions, writes annotated images and all.json.
    python3 bin/blocking-batch.py <study dir> <outdir> 7 9 12 ...
"""
import json, subprocess, sys, os
sd, od, want = sys.argv[1], sys.argv[2], [int(x) for x in sys.argv[3:]]
os.makedirs(od, exist_ok=True)
S = json.load(open(f'{sd}/study.json'))['shots']; out = {}
for i in want:
    s = S[i - 1]; t = round(s['t'] + s['dur'] / 2, 3)
    d = json.loads(subprocess.run(['python3', 'engine/blocking.py', sd, str(t), '--image', f'{od}/{i:03d}.jpg'], capture_output=True, text=True).stdout)
    out[i] = d; print(f"#{i} t={t} tones {d['tones']}")
    for x in d['regions'][:9]: print('   ', x['hex'], x['area'], x['bbox'])
json.dump(out, open(f'{od}/all.json', 'w'))
