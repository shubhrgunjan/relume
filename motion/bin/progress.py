"""Report progress to the studio (work/progress): log a line, set the phase, record an iteration.

    python3 motion/bin/progress.py log "message" [--kind info|work|score|warn]
    python3 motion/bin/progress.py phase <id> <state: todo|active|done> [--title T] [--detail D]
    python3 motion/bin/progress.py set <key> <json value>
    python3 motion/bin/progress.py iteration <report.json> [--video work/renders/x.mp4] [--note "what changed"]
"""
import json, sys, time
from pathlib import Path

P = Path(__file__).resolve().parent.parent / 'work' / 'progress'
P.mkdir(parents=True, exist_ok=True)
SF = P / 'state.json'


def load():
    return json.loads(SF.read_text()) if SF.exists() else {'started': time.time(), 'phases': [], 'iterations': [], 'project': {}}


def save(s):
    s['updated'] = time.time()
    tmp = SF.with_suffix('.tmp'); tmp.write_text(json.dumps(s, indent=1)); tmp.replace(SF)


def opt(name, default=None):
    a = sys.argv
    return a[a.index('--' + name) + 1] if '--' + name in a else default


def log(msg, kind='info'):
    with open(P / 'events.jsonl', 'a') as f: f.write(json.dumps({'t': time.time(), 'kind': kind, 'msg': msg}) + '\n')


cmd = sys.argv[1]
if cmd == 'log':
    log(sys.argv[2], opt('kind', 'info'))
elif cmd == 'phase':
    s = load(); pid, st = sys.argv[2], sys.argv[3]
    ph = next((p for p in s['phases'] if p['id'] == pid), None)
    if not ph: ph = {'id': pid, 'title': pid}; s['phases'].append(ph)
    ph['state'] = st
    if opt('title'): ph['title'] = opt('title')
    if opt('detail') is not None: ph['detail'] = opt('detail')
    ph['at'] = time.time(); save(s)
    if st == 'active': log(f"▶ {ph['title']}", 'phase')
    if st == 'done': log(f"✓ {ph['title']}", 'phase')
elif cmd == 'set':
    s = load(); s[sys.argv[2]] = json.loads(sys.argv[3]); save(s)
elif cmd == 'iteration':
    s = load(); r = json.loads(Path(sys.argv[2]).read_text())
    it = {'n': len(s['iterations']) + 1, 't': time.time(), 'overall': r.get('overall'), 'scores': r.get('scores'), 'video': opt('video'), 'note': opt('note', ''), 'report': sys.argv[2].split('work/', 1)[-1], 'shots': r.get('shots', []), 'findings': r.get('findings', [])}
    s['iterations'].append(it); save(s)
    log(f"iteration {it['n']}: {it['overall']}/100 — {it['note']}", 'score')
