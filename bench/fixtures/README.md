# Calibration fixtures

Pages with known ground truth, measured by the real crawler to keep relume's readings honest.

| fixture | truth | measured before correction | after |
|---|---|---|---|
| lenis-0.1.html | Lenis lerp 0.1 (τ 167ms) | τ 155ms → lerp 0.11 | 0.10 |
| lenis-0.2.html | Lenis lerp 0.2 (τ 83ms) | τ 70ms → lerp 0.24 | 0.20 |

The wheel probe reads `scrollY` one frame callback before the scroller's own, so τ comes out ~12.5ms short at
every setting; `src/infer/motion.ts` adds it back. Re-run after any probe change:

    npm run -s cli -- crawl http://localhost:8801/calib/lenis-0.1.html --slug calib-lenis-0.1 --pages 1 --hovers 0 --dark false
