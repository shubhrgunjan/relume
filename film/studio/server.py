#!/usr/bin/env python3
"""lookap reel studio: live preview of the composition, Claude's activity, notes, approve-to-render.

  python3 server.py            → http://127.0.0.1:8765

Files (all next to this script's parent, in ../v2 and ./data):
  ../index.html             the composition, previewed live in an iframe
  data/activity.jsonl          what Claude is doing (Claude appends)
  data/notes.jsonl             your change requests (the page appends, Claude marks them done)
  data/approve.json            written when you press Approve
  data/render.json             render progress (Claude writes)
"""
import json, os, time, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.normpath(os.path.join(ROOT, '..'))
DATA = os.path.join(ROOT, 'data')
os.makedirs(DATA, exist_ok=True)
lock = threading.Lock()


def read_jsonl(name):
    p = os.path.join(DATA, name)
    if not os.path.exists(p):
        return []
    out = []
    with open(p) as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except ValueError:
                    pass
    return out


def read_json(name, default=None):
    p = os.path.join(DATA, name)
    try:
        with open(p) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def proj_version():
    m = 0
    for d, _, fs in os.walk(PROJ):
        if any(k in d for k in ('frames', 'stills', 'studio', 'audio')):
            continue
        for f in fs:
            if f.endswith(('.html', '.js', '.css', '.png', '.jpg', '.wav', '.json')):
                try:
                    m = max(m, os.path.getmtime(os.path.join(d, f)))
                except OSError:
                    pass
    return m


class H(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def translate_path(self, path):
        u = urlparse(path).path
        if u.startswith('/proj/'):
            return os.path.join(PROJ, u[len('/proj/'):])
        if u == '/' or u == '':
            return os.path.join(ROOT, 'studio.html')
        return os.path.join(ROOT, u.lstrip('/'))

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        u = urlparse(self.path).path
        if u == '/api/state':
            return self._json({
                'version': proj_version(),
                'activity': read_jsonl('activity.jsonl')[-200:],
                'notes': read_jsonl('notes.jsonl'),
                'done': read_json('done.json', {}),
                'approve': read_json('approve.json'),
                'render': read_json('render.json'),
                'now': time.time(),
            })
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path).path
        n = int(self.headers.get('Content-Length') or 0)
        try:
            body = json.loads(self.rfile.read(n) or b'{}')
        except ValueError:
            return self._json({'error': 'bad json'}, 400)
        with lock:
            if u == '/api/note':
                text = str(body.get('text', '')).strip()[:2000]
                if not text:
                    return self._json({'error': 'empty'}, 400)
                note = {'id': int(time.time() * 1000), 'at': body.get('at'), 'text': text, 'ts': time.time()}
                with open(os.path.join(DATA, 'notes.jsonl'), 'a') as f:
                    f.write(json.dumps(note) + '\n')
                return self._json(note)
            if u == '/api/approve':
                a = {'ts': time.time(), 'version': proj_version(), 'comment': str(body.get('comment', ''))[:500]}
                with open(os.path.join(DATA, 'approve.json'), 'w') as f:
                    json.dump(a, f)
                with open(os.path.join(DATA, 'notes.jsonl'), 'a') as f:
                    f.write(json.dumps({'id': int(time.time() * 1000), 'at': None, 'text': 'APPROVED FOR RENDER', 'ts': time.time(), 'approve': True}) + '\n')
                return self._json(a)
        return self._json({'error': 'not found'}, 404)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8765))
    print(f'studio on http://127.0.0.1:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
