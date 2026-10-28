// Timing-curve fitting: cubic-bezier evaluation, Nelder-Mead, and fitting start/duration/easing to a
// progress track sampled from a clip.

export type Bezier = [number, number, number, number];

export const NAMED: Record<string, Bezier> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
};

/** y for x on a CSS cubic-bezier (Newton with bisection fallback). */
export function bezierAt([x1, y1, x2, y2]: Bezier, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const dsx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const e = sx(t) - x;
    if (Math.abs(e) < 1e-6) break;
    const d = dsx(t);
    if (Math.abs(d) < 1e-6) break;
    t -= e / d;
  }
  if (t < 0 || t > 1 || Math.abs(sx(t) - x) > 1e-4) {
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
  }
  return ((ay * t + by) * t + cy) * t;
}

/** Largest vertical gap between two curves over x in [0,1]: how different two easings look. */
export function curveDistance(a: Bezier, b: Bezier): number {
  let m = 0;
  for (let i = 0; i <= 40; i++) m = Math.max(m, Math.abs(bezierAt(a, i / 40) - bezierAt(b, i / 40)));
  return m;
}

export function bezierCss(b: Bezier): string {
  for (const [name, v] of Object.entries(NAMED)) if (curveDistance(v, b) < 0.012) return name;
  return `cubic-bezier(${b.map((v) => +v.toFixed(2)).join(',')})`;
}

/** Plain Nelder-Mead minimiser. */
export function nelderMead(f: (x: number[]) => number, x0: number[], step: number[], iters = 400, tol = 1e-7): { x: number[]; fx: number } {
  const n = x0.length;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += step[i]; simplex.push(p); }
  let values = simplex.map(f);
  for (let k = 0; k < iters; k++) {
    const order = values.map((v, i) => i).sort((a, b) => values[a] - values[b]);
    simplex = order.map((i) => simplex[i]);
    values = order.map((i) => values[i]);
    if (Math.abs(values[n] - values[0]) < tol) break;
    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
    const pt = (s: number) => c.map((v, j) => v + s * (simplex[n][j] - v));
    const r = pt(-1), fr = f(r);
    if (fr < values[0]) {
      const e = pt(-2), fe = f(e);
      if (fe < fr) { simplex[n] = e; values[n] = fe; } else { simplex[n] = r; values[n] = fr; }
    } else if (fr < values[n - 1]) {
      simplex[n] = r; values[n] = fr;
    } else {
      const ct = pt(fr < values[n] ? -0.5 : 0.5), fc = f(ct);
      if (fc < Math.min(fr, values[n])) { simplex[n] = ct; values[n] = fc; }
      else {
        for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); values[i] = f(simplex[i]); }
      }
    }
  }
  const best = values.indexOf(Math.min(...values));
  return { x: simplex[best], fx: values[best] };
}

export interface TimingFit {
  start: number; // seconds
  duration: number; // seconds
  easing: string; // CSS
  bezier?: Bezier;
  steps?: boolean;
  rmse: number; // in progress units (0..1)
  overshoot: number; // max excursion past the end value, in progress units
  samples: number;
}

/**
 * Fit progress samples p(t) (0 at the start value, 1 at the end) with a delay, a duration and a
 * cubic-bezier. Samples are point samples at frame times; the fit works in continuous time, so start and
 * duration come out finer than one frame.
 */
export function fitTiming(ts: number[], ps: number[], frameDt: number): TimingFit | null {
  const n = ts.length;
  if (n < 3) return null;
  // first and last sample that clearly left the end values
  let i0 = ps.findIndex((p) => p > 0.04);
  let i1 = n - 1 - [...ps].reverse().findIndex((p) => p < 0.96);
  if (i0 < 0 || i1 >= n || i1 < 0) return null;
  if (i1 < i0) i1 = i0;
  const moving = i1 - i0 + 1;
  // A change that completes between two frames is a step (instant), not an eased move.
  if (moving <= 1 && (ps[i0] > 0.9 || (i0 > 0 && ps[i0 - 1] < 0.1 && ps[Math.min(n - 1, i0 + 1)] > 0.9))) {
    const before = Math.max(0, i0 - 1);
    return { start: (ts[before] + ts[i0]) / 2, duration: 0, easing: 'steps(1, end)', steps: true, rmse: 0, overshoot: 0, samples: n };
  }
  const t0Guess = ts[Math.max(0, i0 - 1)];
  const t1Guess = ts[Math.min(n - 1, i1 + 1)];
  const dGuess = Math.max(frameDt, t1Guess - t0Guess);
  const model = (x: number[], t: number) => {
    const [t0, d, x1, y1, x2, y2] = x;
    return bezierAt([x1, y1, x2, y2], (t - t0) / d);
  };
  const loss = (x: number[]) => {
    const [t0, d, x1, y1, x2, y2] = x;
    if (d <= frameDt * 0.5 || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1 || y1 < -1.5 || y1 > 2.5 || y2 < -1.5 || y2 > 2.5) return 1e9;
    let e = 0;
    for (let i = 0; i < n; i++) e += (model(x, ts[i]) - ps[i]) ** 2;
    // mild prior toward the smallest duration that explains the data (the tails are flat either way)
    return e / n + 1e-8 * (d / Math.max(dGuess, 1e-3)); // tie-break only
  };
  let best: { x: number[]; fx: number } | null = null;
  // starting shapes: the named curves plus the ease-out families UI motion favours (their long flat tails
  // make the 96% crossing a poor guide to duration, hence the longer starting durations)
  const SEEDS: Bezier[] = [...Object.values(NAMED), [0.2, 0.8, 0.2, 1], [0.3, 0.7, 0.3, 1], [0.16, 1, 0.3, 1], [0, 0, 0.2, 1], [0.2, 0, 0, 1]];
  for (const init of SEEDS) {
    for (const [a, b] of [[0, 1], [-0.5, 1.2], [0.4, 0.8], [0, 1.5], [0, 2]]) {
      const t0 = t0Guess + a * frameDt;
      const d = dGuess * b;
      const r = nelderMead(loss, [t0, d, ...init], [frameDt * 0.5, dGuess * 0.15, 0.1, 0.1, 0.1, 0.1], 600);
      if (!best || r.fx < best.fx) best = r;
    }
  }
  // Prefer a named curve when it explains the samples about as well: the free fit trades duration against
  // the shape of a flat tail, and designers mostly reach for the named ones.
  let chosen = best!;
  for (const init of Object.values(NAMED)) {
    const fixed = (x: number[]) => loss([x[0], x[1], ...init]);
    let nb: { x: number[]; fx: number } | null = null;
    for (const [a, b] of [[0, 1], [-0.5, 1.2], [0.4, 0.8]]) {
      const r = nelderMead(fixed, [t0Guess + a * frameDt, dGuess * b], [frameDt * 0.5, dGuess * 0.15], 300);
      if (!nb || r.fx < nb.fx) nb = r;
    }
    const cand = { x: [nb!.x[0], nb!.x[1], ...init], fx: nb!.fx };
    if (cand.fx <= best!.fx * 1.25 + 2e-5 && (chosen === best || cand.fx < chosen.fx)) chosen = cand;
  }
  best = chosen;
  const [t0, d, x1, y1, x2, y2] = best.x;
  const bz: Bezier = [x1, y1, x2, y2];
  let rm = 0;
  for (let i = 0; i < n; i++) rm += (model(best.x, ts[i]) - ps[i]) ** 2;
  const overshoot = Math.max(0, ...ps.map((p) => p - 1));
  return { start: t0, duration: d, easing: bezierCss(bz), bezier: bz, rmse: Math.sqrt(rm / n), overshoot, samples: n };
}

/**
 * Like fitTiming, but the start value is unknown (an element that slides in from off-screen, or fades in
 * while travelling): v(t) = to + D·(1 - E((t - t0)/d)). For each candidate timing, D has a closed form,
 * so only the timing and the curve are searched.
 */
export function fitTimingFrom(ts: number[], vs: number[], to: number, frameDt: number, seed?: { start: number; duration: number }): (TimingFit & { from: number }) | null {
  const n = ts.length;
  if (n < 4) return null;
  const solveD = (x: number[]) => {
    const [t0, d, x1, y1, x2, y2] = x;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { const w = 1 - bezierAt([x1, y1, x2, y2], (ts[i] - t0) / d); num += (vs[i] - to) * w; den += w * w; }
    return den > 1e-9 ? num / den : 0;
  };
  const scale = Math.max(1e-6, Math.max(...vs.map((v) => Math.abs(v - to))));
  const loss = (x: number[]) => {
    const [t0, d, x1, y1, x2, y2] = x;
    if (d <= frameDt * 0.5 || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1 || y1 < -1.5 || y1 > 2.5 || y2 < -1.5 || y2 > 2.5) return 1e9;
    const D = solveD(x);
    let e = 0;
    for (let i = 0; i < n; i++) e += ((vs[i] - to - D * (1 - bezierAt([x1, y1, x2, y2], (ts[i] - t0) / d))) / scale) ** 2;
    return e / n;
  };
  const tGuess = seed?.start ?? ts[0] - frameDt;
  const dGuess = seed?.duration ?? Math.max(frameDt * 2, ts[n - 1] - ts[0]);
  const SEEDS: Bezier[] = [...Object.values(NAMED), [0.2, 0.8, 0.2, 1], [0.3, 0.7, 0.3, 1], [0, 0, 0.2, 1]];
  let best: { x: number[]; fx: number } | null = null;
  for (const init of SEEDS) {
    for (const [a, b] of [[0, 1], [-0.1, 1.3], [-0.25, 1.6], [0.05, 0.8]]) {
      const r = nelderMead(loss, [tGuess + a * dGuess, dGuess * b, ...init], [frameDt, dGuess * 0.2, 0.1, 0.1, 0.1, 0.1], 500);
      if (!best || r.fx < best.fx) best = r;
    }
  }
  // prefer a named curve that explains it about as well
  for (const init of Object.values(NAMED)) {
    const fixed = (x: number[]) => loss([x[0], x[1], ...init]);
    const r = nelderMead(fixed, [best!.x[0], best!.x[1]], [frameDt, dGuess * 0.2], 300);
    if (r.fx <= best!.fx * 1.25 + 2e-5) { best = { x: [r.x[0], r.x[1], ...init], fx: r.fx }; break; }
  }
  const [t0, d, x1, y1, x2, y2] = best!.x;
  const bz: Bezier = [x1, y1, x2, y2];
  const D = solveD(best!.x);
  return { start: t0, duration: d, easing: bezierCss(bz), bezier: bz, rmse: Math.sqrt(best!.fx) , overshoot: 0, samples: n, from: to + D };
}
