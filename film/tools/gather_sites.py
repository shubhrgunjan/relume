"""Gather the film's real material on the Thor: for each measured site, its hero (1440×900) and a tall page strip,
and the same for its recreation (latest registered check). Writes pairs.json.

    python3 gather_sites.py <catalog dir> <out dir>
"""
import json, os, subprocess, sys

CAT, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)


def cut(src, dst_hero, dst_page):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', 'crop=1440:900:0:0', '-q:v', '2', dst_hero])
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', 'crop=1440:min(ih\\,5400):0:0', '-q:v', '3', dst_page])


pairs = []
for slug in ['linear.app', 'stripe.com', 'vercel.com', 'resend.com', 'cosmos.so', 'lenis.darkroom.engineering']:
    short = slug.split('.')[0]
    # the first page the crawl visited is the home page (its key is not always 'home', e.g. stripe.com → 'in')
    first = json.load(open(f'{CAT}/{slug}/crawl.json'))['pages'][0]['key']
    src = f'{CAT}/{slug}/pages/{first}/shot-desktop.jpg'
    if not os.path.exists(src):
        continue
    cut(src, f'{out}/{short}-src-hero.jpg', f'{out}/{short}-src-page.jpg')
    entry = {'source': slug, 'short': short, 'name': None}
    f = f'{CAT}/{slug}/recreations.json'
    if os.path.exists(f):
        r = json.load(open(f))[-1]
        pages = f'{CAT}/{slug}/checks/{r["checkId"]}/pages'
        if os.path.isdir(pages):
            shot = f'{pages}/{sorted(os.listdir(pages))[0]}/shot-desktop.jpg'
            if os.path.exists(shot):
                cut(shot, f'{out}/{short}-rec-hero.jpg', f'{out}/{short}-rec-page.jpg')
                entry.update(name=r['name'], score=r['overall'])
    # a few measured facts for on-screen labels
    dna = json.load(open(f'{CAT}/{slug}/dna.json'))
    head = next((s for s in dna['typography']['styles'] if s['name'] in ('h1', 'display')), dna['typography']['styles'][0])
    entry['facts'] = {
        'accent': next((t['value'] for t in dna['color']['tokens'] if t['role'] == 'accent'), None),
        'background': next((t['value'] for t in dna['color']['tokens'] if t['role'] == 'background'), None),
        'colors': [t['value'] for t in dna['color']['tokens'][:6]],
        'head': f"{head['size']}px / {head['weight']}",
        'font': (dna['typography']['families'][0].get('google') or dna['typography']['families'][0]['family']),
        'radius': (dna['shape']['radii'][0]['css'] if dna['shape']['radii'] else None),
        'easing': next((e['css'] for e in dna['motion']['easings'] if not e.get('spring')), None),
        'duration': (dna['motion']['durations'][0]['ms'] if dna['motion']['durations'] else None),
    }
    pairs.append(entry)
json.dump(pairs, open(f'{out}/pairs.json', 'w'), indent=1)
print(json.dumps([{k: p.get(k) for k in ('short', 'name', 'score')} for p in pairs]))
