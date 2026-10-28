# relume MCP — real-world test log

Each test drives relume only through its MCP endpoint (`extract_site` → `job_status` → `get_skill` /
`see_reference` / `get_dna` → build → `check_style` → fix), the way an outside agent would. Every rough edge
becomes an issue below, and each fix is linked to the commit that made it.

## Test 1 — openhorizon.so → a car-parts site (28 Oct 2026)

Brief: same design language as openhorizon.so, product about car parts instead of robots. Private: not added to
the catalogue. Built by Claude acting as the agent, using only what the MCP returns.

### Issues found

| # | where | issue | status |
|---|---|---|---|
| 1 | `extract_site` | No way to measure a site without publishing it to the catalogue. | fixed: `catalog: false` writes a private marker; private entries are hidden from `search_catalog`, the catalogue page and exports, but every tool still works on the slug. |
| 2 | server | A running server keeps old code; nothing reports its version or when it was built. | fixed: the version carries the newest source file's time (`0.1.0+YYYYMMDDhhmm`), reported in the MCP server info and on `/health` with the start time. |
| 3 | client | This Claude Code session had no relume MCP registered, so the test calls the endpoint over HTTP JSON-RPC (`bench/mcp.sh`). Register it for real use: `claude mcp add --transport http relume http://agx-thor:8790/api/mcp`. | noted |
| 4 | skill | Pill radii print as `3.35544e+07px` (the browser's clamp of 9999px) in component classes, the UI grammar and SKILL.md, and the lint rejects the real value. | fixed: radii ≥ 9999px are written `9999px` everywhere. |
| 5 | skill | SKILL.md says "sections get ~—px vertical padding" when no section rhythm was measured. | fixed: the line points to the blueprint crops instead. |
| 6 | skill | The CSS keyword `ui-monospace` is treated as a font family (with a licence substitute), and two mono families both write `--font-mono`, so the second silently wins. | fixed: generic keywords are skipped when naming a stack's family; only the main mono family is `--font-mono`, others get their own variable. |
| 7 | skill | "Primary action" is a 21px nav pill; the hero's real primary CTA (dark 3D button) is filed as `button-secondary`. | fixed: gradient fills count by their first stop and chips under 32px cannot be the primary action. |
| 8 | skill | Motion signature lists no-op recipes (grid rows 12px → 12px, blur 0 → none). | fixed: a change to an equivalent value is dropped. |
| 9 | skill | Colours inside the UI grammar and shadow tokens stay as `lab(…)` strings instead of hex/rgb. | fixed: every skill file is written with lab/oklab/oklch/lch/color() converted to hex or `rgb(… / a)`. |
| 10 | blueprint | A looping hero carousel is reported as six separate 1860×1046 images. | fixed: carousel duplicates collapse to one block. |
| 11 | extraction | Image-based art (the pixel landscape) has no measured palette; an agent has to invent the sky and grass colours (the build derived them from token mixes). | fixed: every section crop and image/illustration block carries its measured pixel palette in the blueprint. |
| 12 | blueprint | The closing blue CTA band and pixel-landscape footer (≈1,500px) are missing from the blueprint; section detection stopped at "Recently shipped". The first build missed them because of it. | fixed: sections outside `<main>` and closing bands are detected. |
| 13 | checker | Timer-driven status lines that cycle with a blur ("Loading the map…") are filed as *hover* motion because they ran during the hover pass. | fixed: changes outside the hovered element are filed as autonomous state, and the dwell pass records them as behaviour. |

### Result

Built by Claude from `get_skill` + `see_reference` + the blueprint, checked three times with `check_style`:

| pass | overall | color | type | spacing | shape | layout | motion | feel | composition |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 79 | 88 | 31 | 100 | 100 | 100 | 67 | 67 | 86 |
| 2 | 93 | 100 | 80 | 100 | 100 | 100 | 89 | 100 | 91 |
| 3 | 94 | 100 | 82 | 100 | 100 | 100 | 88 | 100 | 94 |

Pass 1 failures were the agent's (own line-heights, the brand green used as accent, no status-line motion, a section merged into the hero). Pass 3 added the closing band the blueprint missed (issue 12) after a visual side-by-side. Page: `site/lab/fitment/` (http://localhost:4321/lab/fitment/), not in the catalogue.

### After test 1: behaviour

A screen recording of the source next to the build showed what the scores hid: the build was a still picture of a
site that moves (scripted hero demo, typing terminal, one-of-four active robots, drifting cloud layers, mask-faded
panels, a layered footer). Diagnosis in `docs/study-openhorizon-behaviour.md`. relume now dwells on each section,
records text and `src` changes and masks, infers behaviour (typewriter, active sets, staged reveals, progress, drift
and parallax layers from video), hands it to the agent as a narrative plus filmstrip (`see_behaviour`), and scores
it as its own dimension. The old build re-scored **63** under the new checker (behaviour 8).

Further fixes found while re-checking: the content edge preferred a narrow centred column (x 393) over the container
(x 144); `bench/restart-server.sh` failed over plain SSH (node not on PATH).
