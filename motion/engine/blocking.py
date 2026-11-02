"""Blocking: the big masses of a reference frame, as numbers an agent can build from.
The frame is reduced to a few tones (k-means on lightness), split into connected regions, and each region large
enough to matter is reported with its bounding box, centroid, area, colour and outline (convex hull), in the
coordinates of the target frame. Optionally writes an annotated image.

    python3 engine/blocking.py <study dir> <t seconds> [--size 1280x720] [--tones 4] [--image out.jpg]
"""
import json, subprocess, sys
import numpy as np
from scipy.ndimage import label, gaussian_filter
from scipy.spatial import ConvexHull

study_dir, t = sys.argv[1], float(sys.argv[2])
arg = lambda k, d: sys.argv[sys.argv.index('--' + k) + 1] if '--' + k in sys.argv else d
W, H = map(int, arg('size', '1280x720').split('x')); K = int(arg('tones', 4)); img_out = arg('image', None)
S = json.load(open(f'{study_dir}/study.json'))
video = study_dir.rstrip('/') + '.mp4'
w, h = 160, 90
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', '-vf', f'scale={w}:{h}:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
rgb = np.frombuffer(raw, np.uint8).reshape(h, w, 3).astype(np.float32)
L = gaussian_filter(rgb.mean(2), 1.0)
# tones: k-means on lightness
c = np.percentile(L, np.linspace(5, 95, K))
for _ in range(25):
    a = np.abs(L[..., None] - c).argmin(-1); c = np.array([L[a == j].mean() if (a == j).any() else c[j] for j in range(K)])
sx, sy = W / w, H / h
regions = []
for j in np.argsort(c):
    lab, n = label(a == j)
    for r in range(1, n + 1):
        ys, xs = np.nonzero(lab == r)
        if len(xs) < w * h * 0.006: continue
        col = rgb[ys, xs].mean(0)
        pts = np.stack([xs, ys], 1).astype(float)
        try: hull = pts[ConvexHull(pts).vertices]
        except Exception: hull = pts[[0, -1]]
        regions.append({
            'tone': int(np.where(np.argsort(c) == j)[0][0]), 'lightness': round(float(c[j] / 2.55), 1), 'hex': '#' + ''.join(f'{int(v):02x}' for v in col),
            'area': round(len(xs) / (w * h), 3), 'bbox': [round(xs.min() * sx), round(ys.min() * sy), round((xs.max() + 1) * sx), round((ys.max() + 1) * sy)],
            'centroid': [round(xs.mean() * sx), round(ys.mean() * sy)], 'hull': [[round(x * sx), round(y * sy)] for x, y in hull[:: max(1, len(hull) // 12)]],
        })
regions.sort(key=lambda r: -r['area'])
shot = next((s['i'] for s in S['shots'] if s['t'] <= t < s['t'] + s['dur']), None)
out = {'t': t, 'shot': shot, 'size': [W, H], 'tones': [round(float(v / 2.55), 1) for v in np.sort(c)], 'regions': regions[:24]}
if img_out:
    from PIL import Image, ImageDraw
    big = Image.fromarray(rgb.astype(np.uint8)).resize((W, H), Image.NEAREST).convert('RGB'); d = ImageDraw.Draw(big)
    for k, r in enumerate(out['regions']):
        d.polygon([tuple(p) for p in r['hull']], outline=(192, 246, 60)); d.text((r['centroid'][0], r['centroid'][1]), f"{k}", fill=(255, 40, 40))
    for x in range(0, W, 160): d.line([(x, 0), (x, H)], fill=(255, 255, 255, 60))
    for y in range(0, H, 120): d.line([(0, y), (W, y)], fill=(255, 255, 255, 60))
    big.save(img_out, quality=85)
print(json.dumps(out))
