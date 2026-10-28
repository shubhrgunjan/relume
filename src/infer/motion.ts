// Motion and feel: what moves, when (load / scroll / hover / loop / scroll-linked), how far, how long, on what
// curve, with what stagger, and how the page itself responds to the wheel.
import { fitTiming, bezierCss, type Bezier } from '../lib/easing.js';
import type { Evidence, Motion, Anim, Row } from './evidence.js';

const r0 = Math.round;
// properties that change state but not what anyone sees move
const NON_VISUAL = /^(overflow|overflowX|overflowY|visibility|zIndex|pointerEvents|display|contentVisibility|cursor|userSelect|willChange|touchAction|scrollBehavior)$/;
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface MotionPattern {
  id: string;
  trigger: 'load' | 'scroll' | 'hover' | 'hover-exit' | 'focus' | 'loop' | 'scroll-linked' | 'state';
  source: 'css-animation' | 'css-transition' | 'waapi' | 'js';
  props: string[];
  from: Record<string, string | number>;
  to: Record<string, string | number>;
  duration: number; // ms
  easing: string;   // exact CSS (cubic-bezier / linear() spring / steps)
  easingApprox?: string; // cubic-bezier fallback for a spring
  delay: number;
  stagger?: number;
  iterations?: number | string;
  entry?: number; // scroll reveals: element top as a fraction of the viewport when the motion starts
  scrollRatio?: number; // scroll-linked: property change per px scrolled
  count: number;
  targets: string[]; // short descriptions of example targets
  keyframes?: string; // @keyframes body when known
  pages: string[];
}

function phaseAt(m: Motion, t: number): { phase: string; ref?: number; markT: number } {
  let cur = { label: 'before-load', t: 0 };
  for (const mk of m.marks) { if (mk.t <= t + 5) cur = mk; else break; }
  const l = cur.label;
  if (l === 'loaded') return { phase: 'load', markT: cur.t };
  if (l.startsWith('wheel') || l === 'scroll:start') return { phase: 'scroll', markT: cur.t };
  if (l === 'scroll:end') return { phase: t - cur.t < 1500 ? 'scroll' : 'idle', markT: cur.t };
  if (l.startsWith('hover:')) return { phase: 'hover', ref: +l.slice(6), markT: cur.t };
  if (l.startsWith('unhover:')) return { phase: 'hover-exit', ref: +l.slice(8), markT: cur.t };
  return { phase: 'load', markT: cur.t };
}

function describe(m: Motion, id: number, rows: Map<number, Row>) {
  const e = m.elements[id];
  if (!e) return '?';
  const r = rows.get(id);
  const cls = e.cls.split(/\s+/).filter((c) => c && !/^[a-z0-9_-]{0,3}$|[A-Z0-9]{5,}|__|_[a-zA-Z0-9]{5}$/.test(c)).slice(0, 2).join('.');
  const size = r ? ` ${r.box[2]}×${r.box[3]}` : '';
  return `${e.tag}${cls ? '.' + cls : ''}${e.text ? ` “${e.text.slice(0, 24)}”` : ''}${size}`;
}

function parseMatrix(t: string) {
  if (!t || t === 'none') return { tx: 0, ty: 0, scale: 1, rot: 0 };
  const m = t.match(/matrix(3d)?\(([^)]+)\)/);
  if (!m) return { tx: 0, ty: 0, scale: 1, rot: 0 };
  const v = m[2].split(',').map(Number);
  if (m[1]) return { tx: v[12], ty: v[13], scale: Math.hypot(v[0], v[1], v[2]), rot: (Math.atan2(v[1], v[0]) * 180) / Math.PI };
  return { tx: v[4], ty: v[5], scale: Math.hypot(v[0], v[1]), rot: (Math.atan2(v[1], v[0]) * 180) / Math.PI };
}

/** Fold a keyframe's transform string into readable translate/scale/rotate. */
function readableTransform(t: string) {
  const p = parseMatrix(t);
  const o: Record<string, number> = {};
  if (Math.abs(p.tx) > 0.5) o.x = r0(p.tx);
  if (Math.abs(p.ty) > 0.5) o.y = r0(p.ty);
  if (Math.abs(p.scale - 1) > 0.005) o.scale = r2(p.scale);
  if (Math.abs(p.rot) > 0.5) o.rotate = r0(p.rot);
  // never clip a CSS value: a cut-off value is invalid CSS and takes the rest of the stylesheet with it
  if (!t.startsWith('matrix') && t !== 'none') return { transform: t } as Record<string, any>;
  return o;
}

function kfValues(k: Record<string, any>, props: string[]) {
  const out: Record<string, string | number> = {};
  for (const p of props) {
    const v = k[p];
    if (v === undefined) continue;
    if (p === 'transform') Object.assign(out, readableTransform(String(v)));
    else if (p === 'opacity') out.opacity = r2(+v);
    else out[p] = String(v);
  }
  return out;
}

/** A spring written as linear(...) — sample it and fit a bezier so there is a fallback and an overshoot reading. */
function springInfo(easing: string) {
  const stops = [...easing.matchAll(/(-?[\d.]+)\s+([\d.]+)%/g)].map((m) => [+m[2] / 100, +m[1]] as [number, number]);
  if (stops.length < 4) return null;
  const ts = stops.map((s) => s[0]), ps = stops.map((s) => s[1]);
  const fit = fitTiming(ts, ps, 0.01);
  return { overshoot: r2(Math.max(0, ...ps.map((p) => p - 1))), approx: fit?.bezier ? bezierCss(fit.bezier) : undefined };
}

export function inferMotion(ev: Evidence) {
  const patterns = new Map<string, MotionPattern>();
  const hoverEffects: any[] = [];
  const intro: { t: number; desc: string; key: string }[] = [];
  let scroll: any = null;
  const libraries: Record<string, any> = {};

  for (const page of ev.pages) {
    const m = page.motion;
    if (!m) continue;
    Object.assign(libraries, m.libraries);
    const rows = new Map(page.harvests.desktop.rows.map((r) => [r.id, r]));
    const vh = page.harvests.desktop.viewport[1];
    const loadedT = m.marks.find((k) => k.label === 'loaded')?.t ?? 0;
    const scrollAt = (t: number) => { let y = 0; for (const s of m.scroll) { if (s[0] > t) break; y = s[2]; } return y; };
    const ledgerTargets = new Set<number>();

    const add = (key: string, base: Omit<MotionPattern, 'count' | 'targets' | 'pages' | 'id'>, target: string, starts?: { t: number; parent: number }) => {
      let p = patterns.get(key);
      if (!p) { p = { id: `m${patterns.size + 1}`, ...base, count: 0, targets: [], pages: [] }; patterns.set(key, p); (p as any)._starts = []; }
      p.count++;
      if (p.targets.length < 4 && !p.targets.includes(target)) p.targets.push(target);
      if (!p.pages.includes(page.key)) p.pages.push(page.key);
      if (starts) (p as any)._starts.push(starts);
      return p;
    };

    // ---- the animation ledger: exact keyframes and timing
    for (const a of m.anims) {
      if (a.target >= 0) ledgerTargets.add(a.target);
      const ph = phaseAt(m, a.t);
      const infinite = a.iterations === null || a.iterations === Infinity || (a.iterations as any) === 'Infinity' || a.iterations > 50;
      let trigger: MotionPattern['trigger'] = infinite ? 'loop' : ph.phase === 'hover' ? 'hover' : ph.phase === 'hover-exit' ? 'hover-exit' : ph.phase === 'scroll' ? 'scroll' : ph.phase === 'idle' ? 'state' : 'load';
      if (a.timeline && /Scroll|View/.test(a.timeline)) trigger = 'scroll-linked';
      const props = a.props.filter((p) => !/^(--|offset|composite)/.test(p) && !NON_VISUAL.test(p));
      if (!props.length) continue;
      const kf = a.keyframes;
      const from = kf.length ? kfValues(kf[0], props) : {};
      const to = kf.length ? kfValues(kf[kf.length - 1], props) : {};
      const source = a.kind === 'CSSAnimation' ? 'css-animation' : a.kind === 'CSSTransition' ? 'css-transition' : 'waapi';
      // per-keyframe easing (CSS animations put it on the keyframes) wins over the effect's linear default
      let easing = a.easing === 'linear' && kf[0]?.easing && kf[0].easing !== 'linear' ? kf[0].easing : a.easing;
      if (/^linear\(/.test(easing)) easing = easing.replace(/(\d+\.\d{3,})%/g, (_: string, v: string) => `${+(+v).toFixed(2)}%`);
      const dur = r0(+a.duration || 0);
      if (dur <= 0 && !infinite) continue;
      const fromKey = JSON.stringify(from), toKey = JSON.stringify(to);
      // a transition between equivalent values (background-position 0px → 0%) is shorthand noise, not motion
      if (!infinite && source === 'css-transition' && props.every((p) => /^background(Position|Size|Repeat)/.test(p))) continue;
      if (!infinite && fromKey === toKey && props.every((p) => p === 'opacity' || p === 'transform')) continue;
      const key = [trigger, source, props.sort().join(','), dur, easing, trigger === 'hover' || trigger === 'hover-exit' ? '' : fromKey + toKey, a.name].join('|');
      const target = describe(m, a.target, rows);
      let entry: number | undefined;
      if (trigger === 'scroll' && a.target >= 0) {
        // where the element was when it started moving: its own track if recorded, else its resting box —
        // never for fixed/sticky elements, whose position is the viewport's
        const r = rows.get(a.target);
        const tr = m.tracks.find((x) => x.id === a.target && x.samples[0][0] <= a.t + 50);
        const y = tr ? tr.samples.reduce((acc, s) => (s[0] <= a.t ? s[6] : acc), tr.samples[0][6]) : r?.box[1];
        if (y !== undefined && r && !/fixed|sticky/.test(r.s.position)) { const e = (y - scrollAt(a.t)) / vh; if (e > -0.2 && e < 1.5) entry = r2(e); }
      }
      const sp = /^linear\(/.test(easing) ? springInfo(easing) : null;
      const p = add(key, {
        trigger, source, props, from, to, duration: dur, easing, easingApprox: sp?.approx, delay: r0(+a.delay || 0),
        iterations: infinite ? 'infinite' : a.iterations, entry,
        keyframes: a.kind === 'CSSAnimation' ? ev.css.keyframes[a.name] : undefined,
      }, target, { t: a.t + (+a.delay || 0), parent: rows.get(a.target)?.pid ?? -1 });
      if (entry !== undefined) (p as any)._entries = [...((p as any)._entries || []), entry];
      if (trigger === 'load' && a.t - loadedT < 10000) intro.push({ t: a.t - loadedT + (+a.delay || 0), desc: target, key: p.id });
    }

    // ---- JS-driven motion the ledger never saw: fit the recorded per-frame tracks
    for (const tr of m.tracks) {
      if (ledgerTargets.has(tr.id)) continue;
      const S = tr.samples;
      if (S.length < 4) continue;
      const el = m.elements[tr.id];
      if (!el || el.tag === 'html' || el.tag === 'body') continue;
      const series: Record<string, number[]> = { x: [], y: [], scale: [], rotate: [], opacity: [], width: [], height: [] };
      const ts: number[] = [];
      for (const s of S) {
        const mtx = parseMatrix(s[1]);
        ts.push(s[0]);
        series.x.push(mtx.tx); series.y.push(mtx.ty); series.scale.push(mtx.scale); series.rotate.push(mtx.rot);
        series.opacity.push(s[2]); series.width.push(s[7]); series.height.push(s[8]);
      }
      const changed = Object.entries(series).filter(([k, v]) => {
        const span = Math.max(...v) - Math.min(...v);
        return k === 'opacity' ? span > 0.05 : k === 'scale' ? span > 0.01 : k === 'rotate' ? span > 1 : span > 1.5;
      });
      const clipChanged = new Set(S.map((s) => s[3])).size > 2;
      if (!changed.length && !clipChanged) continue;
      const main = changed.sort((a, b) => {
        const norm = (k: string, v: number[]) => (Math.max(...v) - Math.min(...v)) / (k === 'opacity' ? 1 : k === 'scale' ? 0.2 : k === 'rotate' ? 45 : 60);
        return norm(b[0], b[1]) - norm(a[0], a[1]);
      })[0];
      const ph = phaseAt(m, ts[0]);
      // scroll-linked: the value follows scrollY rather than settling on its own clock
      let trigger: MotionPattern['trigger'] = ph.phase === 'hover' ? 'hover' : ph.phase === 'hover-exit' ? 'hover-exit' : ph.phase === 'scroll' ? 'scroll' : ph.phase === 'idle' ? 'state' : 'load';
      let scrollRatio: number | undefined;
      if (main) {
        const sy = ts.map((t) => scrollAt(t));
        const v = main[1];
        const n = v.length, mx = sy.reduce((a, b) => a + b, 0) / n, my = v.reduce((a, b) => a + b, 0) / n;
        let sxy = 0, sxx = 0, syy = 0;
        for (let i = 0; i < n; i++) { sxy += (sy[i] - mx) * (v[i] - my); sxx += (sy[i] - mx) ** 2; syy += (v[i] - my) ** 2; }
        const corr = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
        if (Math.abs(corr) > 0.97 && ts[ts.length - 1] - ts[0] > 1200 && sxx > 0) { trigger = 'scroll-linked'; scrollRatio = +(sxy / sxx).toFixed(3); }
      }
      // an element collapsing to 0×0 in one frame is being unmounted, not animated
      const last = S[S.length - 1];
      if (last[7] === 0 && last[8] === 0 && S.length < 8) continue;
      const props = [...changed.map(([k]) => k), ...(clipChanged ? ['clip-path'] : [])];
      const from: Record<string, number | string> = {}, to: Record<string, number | string> = {};
      for (const [k, v] of changed) { from[k] = r2(v[0]); to[k] = r2(v[v.length - 1]); }
      if (clipChanged) { from['clip-path'] = S[0][3]; to['clip-path'] = S[S.length - 1][3]; }
      let duration = r0(ts[ts.length - 1] - ts[0]);
      let easing = 'linear';
      if (main && trigger !== 'scroll-linked') {
        const v = main[1], v0 = v[0], v1 = v[v.length - 1];
        if (Math.abs(v1 - v0) > 1e-6) {
          const prog = v.map((x) => (x - v0) / (v1 - v0));
          const fit = fitTiming(ts.map((t) => (t - ts[0]) / 1000), prog, 1 / 60);
          if (fit) { duration = r0(fit.duration * 1000); easing = fit.easing; }
        }
      }
      const target = describe(m, tr.id, rows);
      const key = ['js', trigger, props.sort().join(','), Math.round(duration / 50) * 50, easing, trigger === 'scroll-linked' ? Math.round((scrollRatio || 0) * 20) : JSON.stringify(from) + JSON.stringify(to)].join('|');
      let entry: number | undefined;
      if (trigger === 'scroll' && !/fixed|sticky/.test(rows.get(tr.id)?.s.position || '')) { const e = (S[0][6] - scrollAt(ts[0])) / vh; if (e > -0.2 && e < 1.5) entry = r2(e); }
      const p = add(key, { trigger, source: 'js', props, from, to, duration, easing, delay: 0, scrollRatio, entry }, target, { t: ts[0], parent: rows.get(tr.id)?.pid ?? -1 });
      if (entry !== undefined) (p as any)._entries = [...((p as any)._entries || []), entry];
      if (trigger === 'load' && ts[0] - loadedT < 10000) intro.push({ t: r0(ts[0] - loadedT), desc: target, key: p.id });
    }

    // ---- hover: before/during state diffs per hovered element, with the transitions that carried them
    for (const h of m.hovers) {
      if (!h.before || !h.during) continue;
      const changes: Record<string, [string, string]> = {};
      for (const k of Object.keys(h.during)) if (h.before[k] !== h.during[k]) changes[k] = [h.before[k], h.during[k]];
      const hoverMark = m.marks.find((k) => k.label === 'hover:' + h.id);
      const unMark = m.marks.find((k) => k.label === 'unhover:' + h.id);
      const trans = hoverMark ? m.anims.filter((a) => a.t >= hoverMark.t && a.t < (unMark?.t ?? hoverMark.t + 1000)) : [];
      const children = trans.filter((a) => a.target !== h.id).map((a) => ({ target: describe(m, a.target, rows), props: a.props, duration: r0(a.duration), easing: a.easing }));
      const own = trans.filter((a) => a.target === h.id).map((a) => ({ props: a.props, duration: r0(a.duration), easing: a.easing, delay: r0(a.delay) }));
      const focus = h.focus ? { outline: `${h.focus.outlineWidth} ${h.focus.outlineStyle} ${h.focus.outlineColor}`, offset: h.focus.outlineOffset, boxShadow: h.focus.boxShadow !== 'none' ? h.focus.boxShadow : undefined } : undefined;
      if (Object.keys(changes).length || children.length || focus) hoverEffects.push({ id: h.id, page: page.key, target: describe(m, h.id, rows), changes, transitions: own, children: children.slice(0, 6), focus });
    }

    // ---- scroll feel: the wheel probe (home page only)
    const w1 = m.marks.find((k) => k.label === 'wheel:single'), w2 = m.marks.find((k) => k.label === 'wheel:burst');
    if (w1 && w2 && !scroll) {
      const seg = m.scroll.filter((s) => s[0] >= w1.t && s[0] < w2.t);
      const y0 = seg[0]?.[2] ?? 0, yf = seg[seg.length - 1]?.[2] ?? 0;
      const dist = yf - y0;
      const moveStart = seg.find((s) => s[2] !== y0)?.[0] ?? w1.t;
      const t90 = seg.find((s) => (s[2] - y0) >= dist * 0.9)?.[0] ?? moveStart;
      const t99 = seg.find((s) => (s[2] - y0) >= dist * 0.99)?.[0] ?? moveStart;
      const smooth = dist > 0 && t90 - moveStart > 60;
      let lerp: number | undefined, tau: number | undefined, curve: string | undefined;
      if (smooth) {
        // exponential approach (lerp-style smoothing): ln(1 - p) = -t/τ
        let sxy = 0, sxx = 0;
        for (const s of seg) { const p = (s[2] - y0) / dist; const t = s[0] - moveStart; if (p > 0.02 && p < 0.97 && t > 0) { sxy += t * Math.log(1 - p); sxx += t * t; } }
        tau = sxx > 0 ? -sxx / sxy : undefined;
        // Lenis-style damping is frame-rate independent: x += (target - x)·(1 - e^(-60·lerp·dt)), so τ = 1/(60·lerp)
        // calibrated against Lenis at known lerp 0.1 and 0.2 (bench/fixtures): the probe samples scrollY one
        // frame callback ahead of the scroller's own, which shortens τ by a constant ~12.5ms
        if (tau) { tau += 12.5; lerp = r2(1000 / (60 * tau)); }
        const fit = fitTiming(seg.map((s) => (s[0] - moveStart) / 1000), seg.map((s) => (s[2] - y0) / dist), 1 / 60);
        if (fit) curve = `${r0(fit.duration * 1000)}ms ${fit.easing}`;
      }
      const lib = libraries.lenis ? 'lenis' : libraries.locomotive ? 'locomotive-scroll' : libraries.gsap?.scrollTriggers?.length && smooth ? 'gsap-scrollsmoother?' : smooth ? 'custom smooth scroll' : 'native';
      scroll = {
        kind: smooth ? 'smooth' : 'native', library: lib, perNotchPx: r0(dist), settleMs: r0(t99 - moveStart), t90Ms: r0(t90 - moveStart),
        lerp, tauMs: tau ? r0(tau) : undefined, asDuration: curve, options: libraries.lenis?.options,
        scrollBehavior: libraries.scrollBehavior, snap: libraries.scrollSnap,
        trace: seg.slice(0, 120).map((s) => [r0(s[0] - w1.t), r0(s[2] - y0)]),
      };
    }
  }

  // stagger and entry per pattern
  const list = [...patterns.values()];
  for (const p of list) {
    const starts: { t: number; parent: number }[] = (p as any)._starts || [];
    const byParent = new Map<number, number[]>();
    for (const s of starts) { if (!byParent.has(s.parent)) byParent.set(s.parent, []); byParent.get(s.parent)!.push(s.t); }
    const diffs: number[] = [];
    for (const arr of byParent.values()) { if (arr.length < 3) continue; arr.sort((a, b) => a - b); for (let i = 1; i < arr.length; i++) { const d = arr[i] - arr[i - 1]; if (d > 8 && d < 600) diffs.push(d); } }
    if (diffs.length >= 2) { diffs.sort((a, b) => a - b); p.stagger = r0(diffs[diffs.length >> 1]); }
    const entries: number[] = (p as any)._entries || [];
    if (entries.length) { entries.sort((a, b) => a - b); p.entry = entries[entries.length >> 1]; }
    delete (p as any)._starts; delete (p as any)._entries;
  }

  const order: Record<string, number> = { load: 0, scroll: 1, 'scroll-linked': 2, hover: 3, focus: 4, loop: 5, state: 6, 'hover-exit': 7 };
  list.sort((a, b) => order[a.trigger] - order[b.trigger] || b.count - a.count);
  const tally = (f: (p: MotionPattern) => string | number) => {
    const m = new Map<string | number, number>();
    for (const p of list) if (p.trigger !== 'loop') m.set(f(p), (m.get(f(p)) || 0) + p.count);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  intro.sort((a, b) => a.t - b.t);
  return {
    scroll,
    libraries,
    durations: tally((p) => p.duration).filter(([d]) => +d > 0).slice(0, 10).map(([ms, count]) => ({ ms: +ms, count })),
    easings: tally((p) => p.easing).slice(0, 10).map(([css, count]) => ({ css: String(css), count, spring: /^linear\(/.test(String(css)) })),
    patterns: list.filter((p) => p.trigger !== 'hover-exit' || p.count > 2).slice(0, 80),
    hover: hoverEffects,
    intro: intro.slice(0, 60),
  };
}
