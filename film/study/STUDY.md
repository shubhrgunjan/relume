# Study: two reference films for the relume film

Sources: Harvey II launch film and the Figma brand anthem film (both 60 s, 1276×720, stereo AAC). Measured on the
Thor with `analyze.py` (shots, motion, cuts, tempo, hits) and `audio.py` (band energy, noise vs tone, key, cut-to-beat).
Contact sheets: `out/*-shots.jpg`; timelines: `out/*-timeline.png`; fine sequences: `seq/*.jpg`.

## The numbers

| | Harvey | Figma |
|---|---|---|
| frame rate | 24 fps | 30 fps |
| shots | 49 | 99 |
| average / median shot | 1.23 s / 0.75 s | 0.61 s / **0.17 s** |
| longest holds | 6.75 s (product UI), 3–3.4 s | 5.3 s (opening), 4.9 s (code), 4.2 s |
| music tempo | ~136 BPM | ~129 BPM |
| key (estimate) | E minor | E minor |
| cuts on a beat or half-beat | 22 / 48 | 45 / 98 |
| loudness | flat, about −18 dB the whole way | flat, about −17 dB |
| ending | 2 s soft hold, then fade | logo on black, 3.7 s, music tails off |

## Harvey: analog collage

- **Look:** scanned paper (grain, fibres), torn edges, charcoal and pencil hatching, ink brush loops, letterpress serif
  type, monochrome greys with lilac, sage and dusty rose. 3D forms (cubes, slabs, extruded arcs) are *drawn*, shaded
  with pencil texture, never glossy.
- **Motion:** stop-motion. Many shots are 4 frames (0.17 s) because the collage is animated on twos and threes:
  pieces pop in, a brush stroke draws itself frame by frame, shapes swap. Cubes rotate slowly in 3D. Type is built
  from mismatched cut-out letters that resolve into one clean word (“Information” → “Intelligence.”).
- **Product:** the real Harvey UI held 2–7 s inside the collage (screens framed by collage shapes, a cursor clicking,
  panels sliding), then torn away. Story: chaos of documents → order → the product.
- **Sound:** steady pulsing music, heavy in bass and low mids, with *noise* textures (paper rustle, scratch, tear;
  spectral flatness up to 0.2 and a lift in the air band) exactly on collage transitions at ~10, 26–28, 32–34, 38 and
  52 s. Cuts follow the animation's rhythm, not strictly the beat.

## Figma: digital anthem

- **Look:** near-black ground, saturated palette (volt yellow-green, pink, sky blue, orange, purple), pixel and
  dither treatments, monospace code, giant numerals, simple vector diagrams, then photographic plates (forest road,
  sea, clouds, galaxy) used as portals.
- **Motion:** relentless invention at 0.13–0.17 s per shot, held together by continuity of *one object*:
  - pixel clouds assemble in a dither pattern (opening, 5 s hold), cut to a film strip of running hares (Muybridge);
  - the hare is pixelated and tracked with yellow dots (motion capture), exploded into a 3D tunnel of grey pixel
    planes, with code (`const speed`, `motion.accelerate()`, `animation.playbackRate`) and counters (20, 24, 02);
  - everything collapses to a dot, a dotted line traces an orange ∞ ribbon, which becomes a stack of cards
    (diagram studies: circles, springs, starbursts) receding in depth, multiplying into a kaleidoscope;
  - a black chain of rounded squares wriggles across pink, then a burst of tiles and patterns, a symmetric pattern
    tile becomes a picture inside nested frames that zoom through forest → sea → clouds → galaxy (portals);
  - Figma logo on black.
- **Sound:** clean, tonal synth music (very low noise, little air), no sub-bass for the first 12 s, sub enters
  ~12–26 s, biggest sub/low end at 46–58 s for the portal finale. Hits are musical, not foley.

## What makes both feel expensive

1. One idea per beat and a single thread of continuity (a shape, a dot, a frame) carried through every cut.
2. Texture everywhere: grain, dither, scan noise, never a flat vector on a flat colour.
3. Rhythm: micro-shots (4–5 frames) punctuated by long holds where the eye rests on the product or a key image.
4. Product shown as itself (real UI), framed by the art direction rather than replaced by it.
5. Sound treated as design: steady bed, textural hits on transitions, low end saved for the climax.
6. A quiet, confident ending: one word or one logo, room to breathe.

## What this means for relume

relume's world is already Figma-adjacent: volt, pixels and dither (the Dither r), motion curves, code, real sites
measured and rebuilt. The film can be a **digital anthem with an analog edge**: famous sites dissolving into
measurement (boxes, curves, tracked dots), compiled into a skill (tokens, code), and resolving into new sites
(the catalogue recreations, which we already have as real recordings), ending on the Dither r.
