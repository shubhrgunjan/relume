# relume motion

An MCP server that measures the style of a reference video and helps an agent rebuild it, shot for shot, with new
content, then scores the result against the reference.

- `src/` — the MCP server (`study_video`, `get_style`, `see_shot`, `get_blocking`, `render`, `compare`,
  `see_compare`, `job_status`). HTTP on :8792 (`node --import tsx src/server.ts`) or stdio (`src/stdio.ts`).
- `engine/` — `study.py` (shots, cadence, camera, tone, palette, texture, layout, sound), `style.py` (STYLE.md),
  `blocking.py` (the big masses of any moment, as numbers), `render.cjs` (composition → video),
  `compare.py` (per-shot scores and findings), `sound.py` (an original bed in the reference's measured sound).
- `runtime/collage.js` — the collage kit: paper, pencil, charcoal, dry brush, torn edges, drawn solids, letterpress,
  stop-motion clock and boil.
- `projects/harvey-relume/` — the first test: the Harvey II launch film's style, rebuilt for relume motion.
- `studio/` — the live progress site (`python3 studio/server.py` → http://127.0.0.1:4400).
- `bin/iterate.sh` — one loop: render on the Thor, compare, pull results into the studio.
