"""Compile a study into STYLE.md: the style as rules an editing agent follows, plus the shot-by-shot blueprint.

    python3 engine/style.py <study dir>
"""
import json, sys
from pathlib import Path

d = Path(sys.argv[1]); S = json.loads((d / 'study.json').read_text())
sh, R, A = S['shots'], S['rhythm'], S.get('audio') or {}
fmt = lambda t: f'{t:.2f}s'
light = [p for p in S['palette'] if p['lab'][0] > 70]; dark = [p for p in S['palette'] if p['lab'][0] < 40]
tints = sorted({p['hex'] for s in sh for p in s['palette'] if (p['lab'][1] ** 2 + p['lab'][2] ** 2) ** 0.5 > 6 and p['w'] > 0.04})[:12]
on = S['cadence']['on']
pans = [s for s in sh if abs(s['pan'][0]) + abs(s['pan'][1]) > 40]

md = f"""# Style: {S['source']}

Measured from the video, frame by frame. Rebuild on the same timeline: same cuts on the same frames, same holds,
same cadence, same palette and texture, with your own content. Never reuse the source's logo, product, imagery or copy.

## Format
- {S['width']}×{S['height']}, {S['fps']:g} fps, {S['duration']:.2f}s, {S['frames']} frames.

## Rhythm
- {R['shots']} shots. Mean {R['mean']:.2f}s, median {R['median']:.2f}s.
- {R['micro']} micro-shots of 0.25s or less (usually 4 frames): flashes between ideas. {R['holds']} holds of 2s or more: where the eye rests.
- Cut frames (keep them exact): {', '.join(f"{c:.3f}" for c in R['cuts'])}.

## Cadence
- Animated on {on}s: each drawing is held for {on} frames (measured mean hold {S['cadence']['heldFor']:.2f} frames).
  Quantise time inside every shot: `tq = Math.floor(frame / {on}) * {on} / fps`. Nothing moves smoothly frame to frame;
  motion reads as hand-made stop-motion. Only real UI recordings may run on ones.
- Camera: mostly locked off. {len(pans)} shots drift (pan over {', '.join(f"#{s['i']}" for s in pans[:8]) or 'none'}).

## Palette
- Whole film, by area: {', '.join(f"{p['hex']} ({p['w']:.0%})" for p in S['palette'])}.
- Paper and light ground: {', '.join(p['hex'] for p in light)}. Ink and darks: {', '.join(p['hex'] for p in dark) or 'none'}.
- Tints that carry the colour (used in pieces, never as flat fills): {', '.join(tints)}.

## Texture
- Mean grain {S['texture']['grain']:.1f} and paper/brush detail {S['texture']['detail']:.1f} (std of fine and medium
  band-pass at 640×360; a flat digital frame measures under 1). Every surface carries paper fibre, pencil, charcoal or
  print texture. No clean vector fills.

## Sound
""" + (f"""- {A.get('bpm')} BPM. Band balance: {', '.join(f"{k} {v}%" for k, v in A.get('bands', {}).items())}.
- Hits (transients) at: {', '.join(f"{h:.2f}" for h in A.get('hits', [])[:40])}.
- {A.get('cutsOnOnset')} of {len(R['cuts'])} cuts land on an onset.
""" if A else "- No audio track.\n") + """
## Shot by shot
Keyframes are in keyframes/NNN-a|m|z.jpg (first, middle, last frame). Look at each with see_shot before building it.

| # | at | length | on | lightness (p5–p95) | chroma | grain / detail | pan px | main colours |
|---|---:|---:|---:|---|---:|---|---|---|
""" + '\n'.join(f"| {s['i']} | {fmt(s['t'])} | {fmt(s['dur'])} | {s['cadence']['on']} | {s['tone']['L']:.0f} ({s['tone']['p5']:.0f}–{s['tone']['p95']:.0f}) | {s['chroma']:.0f} | {s['texture']['grain']:.1f} / {s['texture']['detail']:.1f} | {s['pan'][0]:.0f},{s['pan'][1]:.0f} | {' '.join(p['hex'] for p in s['palette'][:4])} |" for s in sh) + """

## Checking
Render the clone at the same length and fps and call compare: it scores rhythm, layout, tone, colour, texture,
motion and audio per shot against this study and lists what is off, worst first. Fix and compare again.
"""
(d / 'STYLE.md').write_text(md)
print(f'STYLE.md: {len(md)} chars')
