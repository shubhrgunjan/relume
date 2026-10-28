# Study: what relume missed on openhorizon.so, and why

Source: a screen recording comparing openhorizon.so with the Fitment Labs recreation (28 Oct 2026).

## What the site actually does

| Where | What a visitor experiences | What relume captured |
|---|---|---|
| Hero sky | Pixel clouds drift sideways continuously. | Nothing (painted in canvas/background, invisible to the DOM probe). |
| Hero card | A scripted demo cycling through four robots: the active robot is solid, the rest are faded; a green glow pulses under the active one and its label gains a green dot. A terminal moves to sit above the active robot, a command **types out character by character**, status steps dissolve in one by one, a **Run** button waits, "Running · step 1…4 of 4" advances with a green progress line while **the robot animates** (the mobile base's arm extends and carries the mug), then "Delivered · skill saved", then the next robot. | "4 images, a ui-mock, a terminal" — a static picture. Motion became a handful of disconnected "patterns" (blur-in 300ms, stagger 331ms). |
| Robots | Shaded technical renders (images), each with active/faded states. | "image" with no crop, no style, no states. |
| Product panels, terminals | Bottom edges fade into the page through a gradient mask. | Not harvested at all (`mask-image` was not in the probe's property list). |
| Footer landscape | Layered pixel scene (sky, clouds, far hills, near hills, trees) moving at different speeds while scrolling: parallax depth. | One flat section; the blueprint even missed it. |
| Feature lists, cards | Arrows slide in on hover; plan steps carry coloured tags. | Partly (hover transitions measured, never tied to the component). |

## Why

1. **relume observes moments, not behaviour.** The crawler loads, scrolls past at reading pace and hovers. A 20-second scripted loop is never watched long enough to be seen as a loop; its pieces are filed as unrelated "patterns".
2. **No text tracking.** Typing, cycling status lines and counters are text changes; the probe records styles and boxes, not text.
3. **Pixels are ignored for motion.** Canvas, background-image and image-sequence motion (drifting clouds, parallax layers, sprite animation) never appear in the DOM, so they are invisible.
4. **Images are opaque.** The blueprint says "image" without showing it, so an agent cannot see that the robots are shaded renders, nor that they have active/faded states.
5. **Missing properties.** `mask-image`, background position and `src` swaps were not recorded.
6. **No narrative.** The agent got numbers and a static crop. It never saw the section move, so it built a still.
7. **The checker could not tell.** No dimension scores behaviour, so a still page scored 94.

## Fixes

1. Dwell recording: hold every section in view for several seconds while recording (DOM tracks, text changes, video).
2. Probe: text mutations, `src` swaps, `mask-image` / `background-position`.
3. Behaviour inference per section: loops and their period, typewriter (chars/s), one-of-N active/faded sets (levels), followers, progress bars, staged reveals; and from the video, region drift (clouds) and scroll parallax per layer.
4. Blueprint: each section gets a behaviour narrative, measured parameters and a filmstrip; images are cropped so an agent can see them (carousel duplicates removed).
5. MCP: `see_behaviour` returns a section's filmstrip.
6. Checker: a `behaviour` dimension.
7. The 13 issues from test 1.
