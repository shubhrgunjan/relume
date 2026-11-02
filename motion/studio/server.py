"""relume motion studio: a live view of the work. Serves the dashboard, the state (work/progress) and the media
(work/), with byte ranges so videos scrub.

    python3 motion/studio/server.py        → http://127.0.0.1:4400
"""
import json, os, re, sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / 'work'
PORT = int(os.environ.get('PORT', 4400))


def state():
    p = WORK / 'progress'
    s = json.loads((p / 'state.json').read_text()) if (p / 'state.json').exists() else {}
    ev = []
    if (p / 'events.jsonl').exists():
        for l in (p / 'events.jsonl').read_text().splitlines()[-300:]:
            try: ev.append(json.loads(l))
            except Exception: pass
    s['events'] = ev[::-1]
    return s


class H(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        path = self.path.split('?')[0]
        if path in ('/', '/index.html'):
            return self.file(ROOT / 'studio' / 'index.html')
        if path == '/api/state':
            b = json.dumps(state()).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b); return
        if path.startswith('/work/'):
            f = (WORK / path[6:]).resolve()
            if WORK.resolve() in f.parents and f.is_file(): return self.file(f)
        if path.startswith('/projects/'):
            f = (ROOT / path[1:]).resolve()
            if (ROOT / 'projects').resolve() in f.parents and f.is_file(): return self.file(f)
        self.send_error(404)

    def file(self, f: Path):
        size = f.stat().st_size
        ctype = self.guess_type(str(f))
        rng = self.headers.get('Range')
        with open(f, 'rb') as fh:
            if rng and (m := re.match(r'bytes=(\d*)-(\d*)', rng)):
                a = int(m[1]) if m[1] else max(0, size - int(m[2]))
                b = int(m[2]) if m[1] and m[2] else size - 1
                b = min(b, size - 1)
                self.send_response(206); self.send_header('Content-Range', f'bytes {a}-{b}/{size}')
                self.send_header('Accept-Ranges', 'bytes'); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(b - a + 1)); self.end_headers()
                fh.seek(a); left = b - a + 1
                while left > 0:
                    chunk = fh.read(min(1 << 16, left))
                    if not chunk: break
                    try: self.wfile.write(chunk)
                    except (BrokenPipeError, ConnectionResetError): return
                    left -= len(chunk)
                return
            self.send_response(200); self.send_header('Accept-Ranges', 'bytes'); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(size)); self.end_headers()
            try:
                while chunk := fh.read(1 << 16): self.wfile.write(chunk)
            except (BrokenPipeError, ConnectionResetError): pass


if __name__ == '__main__':
    print(f'relume motion studio → http://127.0.0.1:{PORT}', file=sys.stderr)
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
