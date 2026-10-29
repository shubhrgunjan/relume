// Behaviour: what each section *does* when you watch it. Built from the dwell pass (each stretch of the page held
// still in view) and the scroll pass: DOM evidence (text, structure, style tracks, animations) for scripted
// behaviour, and the recorded video for what the DOM cannot see (canvas/background drift, parallax layers).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Motion, PageEvidence, Row } from './evidence.js';
import type { Blueprint } from './sections.js';

export interface BehaviourItem {
  kind: 'typewriter' | 'cycling-text' | 'staged-reveal' | 'active-one-of-n' | 'mover' | 'progress' | 'loop' | 'frame-swap' | 'mask-fade' | 'drift' | 'parallax' | 'autoplay-media' | 'animated-region' | '3d-scene';
  what: string;           // short description of the element(s)
  params: Record<string, any>;
  box?: [number, number, number, number];
}
export interface SectionBehaviour { narrative: string[]; items: BehaviourItem[]; filmstrip?: string; window?: [number, number] }

const r0 = Math.round, r2 = (v: number) => Math.round(v * 100) / 100;
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const cv = (a: number[]) => { if (a.length < 2) return 1; const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) / Math.max(1e-6, m); };

function describe(m: Motion, rows: Map<number, Row>, id: number) {
  const e = m.elements[id];
  const r = rows.get(id);
  if (!e) { if (!r) return 'a container'; const c = r.cls.split(/\s+/).filter((c) => c && c.length < 24 && !/[A-Z0-9]{5,}|__/.test(c)).slice(0, 2).join('.'); return `${r.tag}${c ? '.' + c : ''} ${r.box[2]}×${r.box[3]}`; }
  const cls = e.cls.split(/\s+/).filter((c) => c && c.length < 24 && !/[A-Z0-9]{5,}|__|^[a-z0-9-]{0,3}$/.test(c)).slice(0, 2).join('.');
  const file = r?.media?.src ? ` (${r.media.src.split('/').pop()!.split('?')[0].replace(/\.[a-z0-9_~-]{6,}\./i, '.').slice(0, 40)})` : '';
  return `${e.tag}${cls ? '.' + cls : ''}${file}${e.text ? ` “${e.text.slice(0, 28)}”` : ''}${r ? ` ${r.box[2]}×${r.box[3]}` : ''}`;
}

/** Windows of time when one stretch of the page was held still in view. */
function dwellWindows(m: Motion) {
  const out: { y: number; t0: number; t1: number }[] = [];
  const marks = m.marks.filter((k) => k.label.startsWith('dwell:'));
  for (let i = 0; i < marks.length - 1; i++) {
    const y = +marks[i].label.slice(6);
    if (Number.isFinite(y)) out.push({ y, t0: marks[i].t, t1: marks[i + 1].t - 300 });
  }
  return out;
}

// ---------------------------------------------------------------- DOM detectors

function domBehaviours(m: Motion, rows: Map<number, Row>, t0: number, t1: number, viewTop: number, vh: number): BehaviourItem[] {
  const items: BehaviourItem[] = [];
  // only what was on screen: an element's box from its own track inside the window, else its resting box
  const trackBox = new Map<number, number[]>();
  for (const tr of m.tracks) for (const s of tr.samples) if (s[0] >= t0 && s[0] <= t1) { trackBox.set(tr.id, [+s[5], +s[6], +s[7], +s[8]]); break; }
  const fixed = (id: number) => /fixed|sticky/.test(rows.get(id)?.s.position || '');
  const onScreen = (id: number) => {
    if (fixed(id)) return true;
    let b = trackBox.get(id) || rows.get(id)?.box as number[] | undefined;
    let p = rows.get(id)?.pid;
    for (let k = 0; !b && p !== undefined && p >= 0 && k < 8; k++) { b = trackBox.get(p) || rows.get(p)?.box as number[] | undefined; p = rows.get(p)?.pid; }
    return !!b && b[1] < viewTop + vh && b[1] + b[3] > viewTop;
  };
  const texts = (m.texts || []).filter((x) => x[0] >= t0 && x[0] <= t1 && onScreen(x[1]));
  const byEl = new Map<number, any[][]>();
  for (const x of texts) { if (!byEl.has(x[1])) byEl.set(x[1], []); byEl.get(x[1])!.push(x); }
  const boxOf = (id: number) => rows.get(id)?.box;

  for (const [id, ev] of byEl) {
    const tx = ev.filter((e) => e[2] === 'text');
    // typewriter: the text grows by a few characters at a time
    // typing speed is measured inside bursts (pauses between commands are not typing)
    let grow = 0;
    const rates: number[] = [];
    let sample = '';
    for (let i = 1; i < tx.length; i++) {
      const a = tx[i - 1][3] as string, b = tx[i][3] as string, dt = tx[i][0] - tx[i - 1][0];
      if (b.length > a.length && b.length - a.length <= 4 && b.startsWith(a.slice(0, Math.max(0, a.length - 1))) && dt > 0 && dt < 400) { grow++; rates.push((b.length - a.length) / (dt / 1000)); sample = b; }
    }
    if (grow >= 5) items.push({ kind: 'typewriter', what: describe(m, rows, id), params: { charsPerSecond: r0(median(rates)), sample: sample.slice(0, 80) }, box: boxOf(id) });
    // cycling text: a small set of values that recur
    const vals = tx.map((e) => e[3] as string).filter(Boolean);
    const distinct = [...new Set(vals)];
    if (!grow && vals.length >= 4 && distinct.length >= 2 && distinct.length <= Math.max(2, vals.length - 1)) {
      const gaps = tx.slice(1).map((e, i) => e[0] - tx[i][0]);
      items.push({ kind: 'cycling-text', what: describe(m, rows, id), params: { values: distinct.slice(0, 8), intervalMs: r0(median(gaps)) }, box: boxOf(id) });
    }
    // staged reveal: children appended one after another
    const ch = ev.filter((e) => e[2] === 'children').map((e) => [e[0], e[3]] as [number, number]);
    const ups = ch.filter((c, i) => i > 0 && c[1] > ch[i - 1][1]);
    if (ups.length >= 3) {
      const gaps = ups.slice(1).map((c, i) => c[0] - ups[i][0]);
      items.push({ kind: 'staged-reveal', what: describe(m, rows, id), params: { steps: ups.length + 1, intervalMs: r0(median(gaps)), maxChildren: Math.max(...ch.map((c) => c[1])) }, box: boxOf(id) });
    }
    const src = ev.filter((e) => e[2] === 'src');
    if (src.length >= 4) items.push({ kind: 'frame-swap', what: describe(m, rows, id), params: { frames: new Set(src.map((e) => e[3])).size, fps: r2(src.length / ((src[src.length - 1][0] - src[0][0]) / 1000 || 1)) }, box: boxOf(id) });
  }

  // style tracks inside the window
  const tracks = m.tracks.filter((tr) => tr.samples.length > 2 && tr.samples[tr.samples.length - 1][0] >= t0 && tr.samples[0][0] <= t1 && onScreen(tr.id));
  // siblings that change state together: a set where one is "on" and the rest are dimmed (opacity or a CSS
  // filter such as grayscale/brightness/opacity()), or items that fade in from nothing one after another
  const level = (s: any[]) => { const f = String(s[4] || 'none'); const fo = f.match(/opacity\(([\d.]+)\)/); const gr = f.match(/grayscale\(([\d.]+)\)/); const br = f.match(/brightness\(([\d.]+)\)/); return +s[2] * (fo ? +fo[1] : 1) * (gr ? 1 - 0.5 * +gr[1] : 1) * (br ? Math.min(1, +br[1]) : 1); };
  // group by shared class list (a set of cards in separate columns) and fall back to the parent
  const bySib = new Map<string, typeof tracks>();
  const seen = new Set<number>();
  for (const tr of tracks) {
    if (seen.has(tr.id)) continue;
    const lv = tr.samples.map(level);
    if (Math.max(...lv) - Math.min(...lv) < 0.15) continue;
    seen.add(tr.id);
    const cls = (m.elements[tr.id]?.cls || '').split(/\s+/).filter((c) => c && !/^(opacity|grayscale|brightness|is-|active|on$)/.test(c)).sort().join(' ');
    const key = cls ? `c:${m.elements[tr.id]?.tag}.${cls}` : `p:${rows.get(tr.id)?.pid ?? -2}`;
    if (!bySib.has(key)) bySib.set(key, []);
    bySib.get(key)!.push(tr);
  }
  for (const [key, g] of bySib) {
    const pid = key.startsWith('p:') ? +key.slice(2) : (rows.get(g[0].id)?.pid ?? -1);
    if (g.length < 3) continue;
    const hi = median(g.map((tr) => Math.max(...tr.samples.map(level))));
    const lo = median(g.map((tr) => Math.min(...tr.samples.map(level))));
    const ups = g.flatMap((tr) => tr.samples.filter((s, i) => i > 0 && level(s) > (hi + lo) / 2 && level(tr.samples[i - 1]) <= (hi + lo) / 2).map((s) => s[0])).sort((a, b) => a - b);
    const gaps = ups.slice(1).map((t, i) => t - ups[i]).filter((d) => d > 60);
    const viaFilter = g.some((tr) => tr.samples.some((s) => /grayscale|brightness|opacity\(/.test(String(s[4]))));
    if (lo < 0.06) items.push({ kind: 'staged-reveal', what: `${g.length} children of ${describe(m, rows, pid)}`, params: { steps: g.length, intervalMs: gaps.length ? r0(median(gaps)) : null, fadeIn: true }, box: boxOf(pid) });
    else items.push({ kind: 'active-one-of-n', what: `${g.length} siblings of ${describe(m, rows, pid)}`, params: { members: g.length, activeLevel: r2(hi), dimmedLevel: r2(lo), via: viaFilter ? 'filter' : 'opacity', switchEveryMs: gaps.length ? r0(median(gaps)) : null }, box: boxOf(pid) });
  }
  // movers and progress bars
  for (const tr of tracks) {
    const xs = tr.samples.map((s) => +s[5]), ys = tr.samples.map((s) => +s[6]), ws = tr.samples.map((s) => +s[7]);
    const moved = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const el = m.elements[tr.id];
    const transformed = new Set(tr.samples.map((s) => String(s[1]))).size > 2;
    const big = (+tr.samples[0][7]) * (+tr.samples[0][8]) > 120 * 60;
    if (moved > 40 && el && !/^(html|body)$/.test(el.tag) && (transformed || big && /^attr:style|^anim|^waapi/.test(tr.why))) {
      const stops = new Set(tr.samples.map((s) => `${Math.round(+s[5] / 40)},${Math.round(+s[6] / 40)}`)).size;
      if (stops >= 2) items.push({ kind: 'mover', what: describe(m, rows, tr.id), params: { distancePx: r0(moved), positions: stops, by: transformed ? 'transform' : 'position' }, box: boxOf(tr.id) });
    }
    // a progress bar fills, then resets for the next run: take the longest stretch where the width only grows
    let best = [0, 0], a0 = 0;
    for (let i = 1; i <= ws.length; i++) if (i === ws.length || ws[i] < ws[i - 1] - 0.5) { if (ws[i - 1] - ws[a0] > ws[best[1]] - ws[best[0]]) best = [a0, i - 1]; a0 = i; }
    const span = ws[best[1]] - ws[best[0]];
    if (span > 30 && (rows.get(tr.id)?.box[3] ?? 99) <= 8) {
      const run = tr.samples.slice(best[0], best[1] + 1);
      const t = run.filter((s, i) => i > 0 && +s[7] !== +run[i - 1][7]).map((s) => s[0]);
      items.push({ kind: 'progress', what: describe(m, rows, tr.id), params: { fromPx: r0(ws[best[0]]), toPx: r0(ws[best[1]]), durationMs: t.length ? r0(t[t.length - 1] - run[0][0]) : 0 }, box: boxOf(tr.id) });
    }
  }
  // loops: the same element changing again and again on a steady clock
  const starts = new Map<number, number[]>();
  for (const a of m.anims) if (a.t >= t0 && a.t <= t1 && a.target >= 0) { if (!starts.has(a.target)) starts.set(a.target, []); starts.get(a.target)!.push(a.t); }
  for (const tr of tracks) { if (!starts.has(tr.id)) starts.set(tr.id, []); starts.get(tr.id)!.push(tr.samples[0][0]); }
  const loops: BehaviourItem[] = [];
  for (const [id, ts] of starts) {
    const u = [...new Set(ts.map((t) => Math.round(t / 50) * 50))].sort((a, b) => a - b);
    if (u.length < 3) continue;
    const gaps = u.slice(1).map((t, i) => t - u[i]).filter((d) => d > 200);
    if (gaps.length >= 2 && cv(gaps) < 0.3) loops.push({ kind: 'loop', what: describe(m, rows, id), params: { periodMs: r0(median(gaps)), repeats: gaps.length + 1 }, box: boxOf(id) });
  }
  items.push(...loops.sort((a, b) => b.params.repeats - a.params.repeats).slice(0, 4));
  // one entry per kind and target; the biggest movers only
  const movers = items.filter((i) => i.kind === 'mover').sort((a, b) => b.params.distancePx - a.params.distancePx).slice(0, 3);
  return [...items.filter((i) => i.kind !== 'mover'), ...movers];
}

// ---------------------------------------------------------------- pixel detectors (video)

interface Frames { w: number; h: number; frames: Uint8Array[]; times: number[] }

function grayFrames(video: string, fromS: number, durS: number, fps: number, w = 320, h = 200): Frames | null {
  try {
    const buf = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(Math.max(0, fromS)), '-t', String(durS), '-i', video, '-vf', `fps=${fps},scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: 1 << 28 });
    const n = Math.floor(buf.length / (w * h));
    const frames: Uint8Array[] = [];
    for (let i = 0; i < n; i++) frames.push(new Uint8Array(buf.buffer, buf.byteOffset + i * w * h, w * h));
    return { w, h, frames, times: frames.map((_, i) => fromS + i / fps) };
  } catch { return null; }
}

/** How much a page box keeps changing on screen while held still: mean absolute frame difference inside it. */
function regionActivity(video: string, fromS: number, durS: number, box: number[], scrollY: number, vw: number, vh: number) {
  const f = grayFrames(video, fromS, Math.min(durS, 8), 4);
  if (!f || f.frames.length < 4) return null;
  const sx = f.w / vw, sy = f.h / vh;
  const x0 = Math.max(0, Math.round(box[0] * sx)), x1 = Math.min(f.w, Math.round((box[0] + box[2]) * sx));
  const y0 = Math.max(0, Math.round((box[1] - scrollY) * sy)), y1 = Math.min(f.h, Math.round((box[1] + box[3] - scrollY) * sy));
  if (x1 - x0 < 8 || y1 - y0 < 8) return null;
  const diffs: number[] = [];
  for (let i = 1; i < f.frames.length; i++) {
    let d = 0, n = 0;
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { d += Math.abs(f.frames[i][y * f.w + x] - f.frames[i - 1][y * f.w + x]); n++; }
    diffs.push(d / Math.max(1, n));
  }
  const level = +median(diffs).toFixed(2);
  // changing in most steps, not one blip
  return { level, changing: diffs.filter((d) => d > 0.6).length >= diffs.length * 0.6 };
}

/** Best integer shift (dx, dy) of tile b relative to a, by sum of absolute differences. */
function matchShift(a: Uint8Array, b: Uint8Array, w: number, x0: number, y0: number, tw: number, th: number, R: number, onlyY = false) {
  let best = { dx: 0, dy: 0, err: Infinity }, base = 0;
  for (let dy = -R; dy <= R; dy++) for (let dx = onlyY ? 0 : -R; dx <= (onlyY ? 0 : R); dx++) {
    let e = 0, n = 0;
    for (let y = y0; y < y0 + th; y += 2) for (let x = x0; x < x0 + tw; x += 2) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || xx < 0 || xx >= w || yy * w + xx >= b.length) continue;
      e += Math.abs(a[y * w + x] - b[yy * w + xx]); n++;
    }
    e /= Math.max(1, n);
    if (dx === 0 && dy === 0) base = e;
    if (e < best.err) best = { dx, dy, err: e };
  }
  return { ...best, base };
}

/** Regions that move on their own while the page is still (clouds, marquees, canvases): speed and direction. */
function driftRegions(f: Frames, pagePxPerFramePx: number): BehaviourItem[] {
  const { w, h, frames } = f;
  if (frames.length < 6) return [];
  const TW = 40, TH = 25, out: { x: number; y: number; vx: number; vy: number }[] = [];
  const fps = frames.length > 1 ? 1 / (f.times[1] - f.times[0]) : 4;
  // compare frames ~2s apart on long windows, closer on short ones (at least four comparisons)
  const step = Math.max(1, Math.min(Math.round(fps * 2), Math.floor((frames.length - 1) / 4)));
  for (let y0 = 0; y0 + TH <= h; y0 += TH) for (let x0 = 0; x0 + TW <= w; x0 += TW) {
    const vs: [number, number][] = [];
    let texture = 0;
    for (let i = 0; i + step < frames.length; i += step) {
      const r = matchShift(frames[i], frames[i + step], w, x0, y0, TW, TH, 7);
      if (r.base - r.err > 1.5 && (r.dx || r.dy)) vs.push([r.dx, r.dy]);
      texture += r.base;
    }
    if (vs.length >= 3 && texture > 2) {
      const vx = median(vs.map((v) => v[0])), vy = median(vs.map((v) => v[1]));
      // steady: same direction and nearly the same shift each time (a flicker or a periodic texture is not)
      if ((vx || vy) && vs.filter((v) => Math.sign(v[0]) === Math.sign(vx) && Math.sign(v[1]) === Math.sign(vy) && Math.abs(v[0] - vx) <= 1 && Math.abs(v[1] - vy) <= 1).length >= vs.length * 0.7) {
        const dt = (f.times[step] - f.times[0]);
        out.push({ x: x0, y: y0, vx: vx / dt, vy: vy / dt });
      }
    }
  }
  if (out.length < 2) return [];
  // merge tiles moving the same way into regions
  const groups = new Map<string, typeof out>();
  for (const t of out) { const k = `${Math.sign(Math.round(t.vx))},${Math.sign(Math.round(t.vy))}`; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(t); }
  const items: BehaviourItem[] = [];
  for (const [k, g] of groups) {
    if (g.length < 2) continue;
    const x0 = Math.min(...g.map((t) => t.x)), y0 = Math.min(...g.map((t) => t.y)), x1 = Math.max(...g.map((t) => t.x + TW)), y1 = Math.max(...g.map((t) => t.y + TH));
    const vx = median(g.map((t) => t.vx)) * pagePxPerFramePx, vy = median(g.map((t) => t.vy)) * pagePxPerFramePx;
    const dir = Math.abs(vx) >= Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
    items.push({ kind: 'drift', what: `${g.length} tiles of the viewport (${k})`, params: { direction: dir, pxPerSecond: r0(Math.hypot(vx, vy)), viewportBox: [r0(x0 * pagePxPerFramePx), r0(y0 * pagePxPerFramePx), r0((x1 - x0) * pagePxPerFramePx), r0((y1 - y0) * pagePxPerFramePx)] } });
  }
  // equal speeds in opposite directions at once is aliasing on a repeating pattern (dotted grid, dashed line)
  const speedOf = (i: BehaviourItem) => i.params.pxPerSecond as number;
  const opposite: Record<string, string> = { left: 'right', right: 'left', up: 'down', down: 'up' };
  return items.filter((a) => !items.some((b) => b !== a && b.params.direction === opposite[a.params.direction] && Math.abs(speedOf(a) - speedOf(b)) <= Math.max(3, speedOf(a) * 0.2)));
}

/** During the scroll pass: regions whose content moves slower or faster than the page scrolls (parallax). */
function parallaxRegions(f: Frames, scrollAt: (tS: number) => number, pagePxPerFramePx: number): BehaviourItem[] {
  const { w, h, frames, times } = f;
  const TW = 80, TH = 20, rows: { y: number; ratio: number }[] = [];
  for (let y0 = 0; y0 + TH <= h; y0 += TH) for (let x0 = 0; x0 + TW <= w; x0 += TW) {
    const ratios: number[] = [];
    for (let i = 0; i + 1 < frames.length; i++) {
      const dScroll = (scrollAt(times[i + 1]) - scrollAt(times[i])) / pagePxPerFramePx;
      if (Math.abs(dScroll) < 2 || Math.abs(dScroll) > 60) continue;
      const r = matchShift(frames[i], frames[i + 1], w, x0, y0, TW, TH, Math.ceil(Math.abs(dScroll)) + 6, true);
      if (r.base - r.err < 2) continue;
      ratios.push(-r.dy / dScroll);
    }
    if (ratios.length >= 4) rows.push({ y: y0, ratio: median(ratios) });
  }
  const odd = rows.filter((r) => r.ratio > 0.05 && r.ratio < 0.85);
  if (odd.length < 2) return [];
  const bands = new Map<number, number[]>();
  for (const r of odd) { const k = Math.round(r.ratio * 10) / 10; if (!bands.has(k)) bands.set(k, []); bands.get(k)!.push(r.y); }
  return [...bands.entries()].filter(([, ys]) => ys.length >= 2).map(([ratio, ys]) => ({ kind: 'parallax' as const, what: `layer moving at ${ratio}× scroll`, params: { speedRatio: ratio, layers: bands.size, viewportBand: [r0(Math.min(...ys) * pagePxPerFramePx), r0((Math.max(...ys) + TH) * pagePxPerFramePx)] } }));
}

function activeSets(m: Motion, rows: Map<number, Row>): BehaviourItem[] {
  const level = (s: any[]) => { const f = String(s[4] || 'none'); const fo = f.match(/opacity\(([\d.]+)\)/); const gr = f.match(/grayscale\(([\d.]+)\)/); const br = f.match(/brightness\(([\d.]+)\)/); return +s[2] * (fo ? +fo[1] : 1) * (gr ? 1 - 0.5 * +gr[1] : 1) * (br ? Math.min(1, +br[1]) : 1); };
  const norm = (cls: string) => cls.split(/\s+/).filter((c) => c && !/^(opacity|grayscale|brightness|saturate|is-|active|on$|selected)/.test(c)).sort().join(' ');
  const groups = new Map<string, { flips: { t: number; up: boolean; id: number }[]; hi: number[]; lo: number[]; viaFilter: boolean }>();
  for (const tr of m.tracks) {
    const lv = tr.samples.map(level);
    const hi = Math.max(...lv), lo = Math.min(...lv);
    if (hi - lo < 0.25 || lo < 0.06) continue;
    const e = m.elements[tr.id];
    if (!e) continue;
    const key = `${e.tag}.${norm(e.cls)}`;
    const g = groups.get(key) || { flips: [], hi: [], lo: [], viaFilter: false };
    g.hi.push(hi); g.lo.push(lo);
    g.flips.push({ t: tr.samples[0][0], up: lv[lv.length - 1] > lv[0], id: tr.id });
    g.viaFilter ||= tr.samples.some((s) => /grayscale|brightness|opacity\(/.test(String(s[4])));
    groups.set(key, g);
  }
  const out: BehaviourItem[] = [];
  for (const [key, g] of groups) {
    const ups = g.flips.filter((f) => f.up).map((f) => f.t).sort((a, b) => a - b);
    if (ups.length < 2 || !g.flips.some((f) => !f.up)) continue;
    // members: every harvested element with the same class signature
    const cls = key.slice(key.indexOf('.') + 1);
    const members = [...rows.values()].filter((r) => norm(r.cls) === cls && `${r.tag}.` === key.slice(0, key.indexOf('.') + 1));
    const ids = new Set(g.flips.map((f) => f.id));
    if (Math.max(members.length, ids.size) < 3) continue;
    const gaps = ups.slice(1).map((t, i) => t - ups[i]).filter((d) => d > 500);
    const boxes = members.length ? members.map((r) => r.box) : [];
    const box: [number, number, number, number] | undefined = boxes.length ? [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[0] + b[2])) - Math.min(...boxes.map((b) => b[0])), Math.max(...boxes.map((b) => b[1] + b[3])) - Math.min(...boxes.map((b) => b[1]))] : undefined;
    out.push({ kind: 'active-one-of-n', what: `${Math.max(members.length, ids.size)} × ${key.split(' ').slice(0, 3).join(' ')}`, params: { members: Math.max(members.length, ids.size), activeLevel: r2(median(g.hi)), dimmedLevel: r2(median(g.lo)), via: g.viaFilter ? 'opacity + filter (grayscale)' : 'opacity', switchEveryMs: gaps.length ? r0(median(gaps)) : null }, box });
  }
  return out;
}

/** Video time minus page time, from the magenta 6×6 flashes the probe paints at key marks. */
function syncOffset(video: string, m: Motion): number | null {
  try {
    const fps = 20;
    const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', video, '-vf', `fps=${fps},crop=8:8:0:0,scale=2:2`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
    const n = Math.floor(buf.length / 12);
    const hits: number[] = [];
    for (let i = 0; i < n; i++) { const r = buf[i * 12], g = buf[i * 12 + 1], b = buf[i * 12 + 2]; if (r > 200 && g < 80 && b > 200 && (!hits.length || i / fps - hits[hits.length - 1] > 1)) hits.push(i / fps); }
    const marks = m.marks.filter((k) => /^(loaded|scroll:start|scroll:end|dwell:end)$/.test(k.label)).map((k) => k.t / 1000);
    if (!hits.length || !marks.length) return null;
    // the flashes and the marks come in the same order: take the median of the pairwise differences
    const k = Math.min(hits.length, marks.length);
    const diffs = Array.from({ length: k }, (_, i) => hits[i] - marks[i]).sort((a, b) => a - b);
    return diffs[diffs.length >> 1];
  } catch { return null; }
}

// ---------------------------------------------------------------- per page

export function pageBehaviour(page: PageEvidence, bp: Blueprint, entryDir: string): { sections: (SectionBehaviour | null)[]; page: BehaviourItem[] } {
  const m = page.motion;
  const empty = { sections: bp.sections.map(() => null), page: [] as BehaviourItem[] };
  if (!m) return empty;
  const h = page.harvests.desktop;
  const rows = new Map(h.rows.map((r) => [r.id, r]));
  const vh = h.viewport[1], vw = h.viewport[0];
  const video = join(page.dir, 'motion.webm');
  const loaded = m.marks.find((k) => k.label === 'loaded')?.t ?? 0;
  // align the video clock to the page clock using the probe's magenta sync flashes; fall back to ~1s
  const offset = existsSync(video) ? syncOffset(video, m) : null;
  const vt = (t: number) => t / 1000 + (offset ?? (1.0 - loaded / 1000));
  const scale = vw / 320;
  const secOf = (y: number) => { let best = -1, ov = 0; bp.sections.forEach((s, i) => { const o = Math.min(s.box[1] + s.box[3], y + vh) - Math.max(s.box[1], y); if (o > ov) { ov = o; best = i; } }); return best; };
  // an element that has a box belongs to the section it sits in, whichever dwell stop happened to see it
  const secAt = (box?: number[], fallback = -1) => { if (!box) return fallback; let best = fallback, ov = 0; bp.sections.forEach((s, i) => { const o = Math.min(s.box[1] + s.box[3], box[1] + box[3]) - Math.max(s.box[1], box[1]); if (o > ov) { ov = o; best = i; } }); return best; };
  const out: (SectionBehaviour | null)[] = bp.sections.map(() => null);
  const get = (i: number) => (out[i] = out[i] || { narrative: [], items: [] });
  mkdirSync(join(entryDir, 'sections'), { recursive: true });

  for (const win of dwellWindows(m)) {
    const si = secOf(win.y);
    if (si < 0) continue;
    const items = domBehaviours(m, rows, win.t0, win.t1, win.y, vh);
    if (existsSync(video)) {
      const f = grayFrames(video, vt(win.t0), (win.t1 - win.t0) / 1000, 4);
      if (f) items.push(...driftRegions(f, scale));
    }
    // masks: static, but part of how the section looks while it sits there
    for (const r of h.rows) {
      const mk = r.s.maskImage && r.s.maskImage !== 'none' ? r.s.maskImage : r.s.webkitMaskImage && r.s.webkitMaskImage !== 'none' ? r.s.webkitMaskImage : '';
      if (mk && /gradient/.test(mk) && r.box[1] < win.y + vh && r.box[1] + r.box[3] > win.y && r.box[2] * r.box[3] > 20000) items.push({ kind: 'mask-fade', what: describe(m, rows, r.id), params: { mask: mk.slice(0, 160) }, box: r.box });
    }
    for (const r of h.rows) if (r.media?.autoplay && r.box[1] < win.y + vh && r.box[1] + r.box[3] > win.y) items.push({ kind: 'autoplay-media', what: describe(m, rows, r.id), params: { loop: !!r.media.loop }, box: r.box });
    // live drawing surfaces: a WebGL canvas is a 3D scene; any canvas whose pixels keep changing is animated
    // (rotation, morphing and shading changes are invisible to drift detection, which only sees sliding)
    for (const r of h.rows) {
      if (r.tag !== 'canvas' || r.box[2] * r.box[3] < 120 * 120 || !(r.box[1] < win.y + vh && r.box[1] + r.box[3] > win.y)) continue;
      const gl = /webgl/i.test(r.canvas?.ctx || '');
      const act = existsSync(video) ? regionActivity(video, vt(win.t0), (win.t1 - win.t0) / 1000, r.box, win.y, vw, vh) : null;
      if (gl) items.push({ kind: '3d-scene', what: describe(m, rows, r.id), params: { context: r.canvas!.ctx, moving: act ? act.changing : null, activity: act?.level ?? null, library: m.libraries.three ? `three.js r${m.libraries.three}` : m.libraries.spline ? 'spline' : null }, box: r.box });
      else if (act?.changing) items.push({ kind: 'animated-region', what: describe(m, rows, r.id), params: { activity: act.level, source: 'canvas' }, box: r.box });
    }
    for (const it of items) { const tb = get(secAt(it.box, si)); if (!tb.items.some((x) => x.kind === it.kind && x.what === it.what)) tb.items.push(it); }
    const sb = get(si);
    if (!sb.window) {
      sb.window = [win.t0, win.t1];
      // filmstrip: six moments of the dwell, so an agent can see the section move
      if (existsSync(video)) {
        const file = `sections/${page.key}-behaviour-${String(si).padStart(2, '0')}.jpg`;
        const dur = Math.max(1, (win.t1 - win.t0) / 1000);
        try { execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, vt(win.t0))), '-t', String(dur), '-i', video, '-vf', `fps=${(6 / dur).toFixed(3)},scale=480:-2,tile=3x2:padding=4:color=gray`, '-frames:v', '1', '-q:v', '5', join(entryDir, file)]); sb.filmstrip = file; } catch {}
      }
    }
  }

  // layers that travel steadily on their own (cloud bands, marquees): from the DOM, any element whose position
  // changes at a near-constant speed while the page is still. Same image file = same layer.
  const layers = new Map<string, { speeds: number[]; box?: [number, number, number, number]; what: string }>();
  for (const tr of m.tracks) {
    const S = tr.samples;
    if (S.length < 30) continue;
    const t0 = S[0][0], t1 = S[S.length - 1][0];
    if (t1 - t0 < 3000) continue;
    const dx = +S[S.length - 1][5] - +S[0][5], dy = +S[S.length - 1][6] - +S[0][6];
    const sp = Math.hypot(dx, dy) / ((t1 - t0) / 1000);
    if (sp < 2 || sp > 400) continue;
    // steady: every eighth of the track sits near the straight line between the ends, and the element moves in
    // most of those stretches (a follower that jumps now and then, or a progress line riding it, is not a layer)
    const dist = Math.hypot(dx, dy);
    let steady = true, moving = 0;
    for (let q = 1; q <= 8; q++) {
      const a = S[Math.floor((S.length - 1) * (q - 1) / 8)], b = S[Math.floor((S.length - 1) * q / 8)], frac = (b[0] - t0) / (t1 - t0);
      if (Math.hypot(+b[5] - (+S[0][5] + dx * frac), +b[6] - (+S[0][6] + dy * frac)) > Math.max(30, dist * 0.25)) steady = false;
      if (Math.hypot(+b[5] - +a[5], +b[6] - +a[6]) > dist / 16) moving++;
    }
    if (!steady || moving < 7) continue;
    const name = describe(m, rows, tr.id);
    // copies of one layer share a name and a speed; two layers can share a class but not a speed
    const key = name.replace(/\s\d+×\d+$/, '') + '@' + Math.round(Math.log(sp) / Math.log(1.25));
    const L = layers.get(key) || { speeds: [], what: name, box: rows.get(tr.id)?.box };
    L.speeds.push(Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) * sp : Math.sign(dy) * sp);
    layers.set(key, L);
  }
  const layerItems = [...layers.values()].map((L) => { const v = median(L.speeds); return { kind: 'drift' as const, what: L.what, params: { direction: v < 0 ? 'left' : 'right', pxPerSecond: r0(Math.abs(v)), copies: L.speeds.length, source: 'dom' }, box: L.box }; });
  for (const it of layerItems) {
    const si = secAt(it.box);
    if (si >= 0) { const sb = get(si); sb.items.push(it); }
  }
  // several layers at different speeds in one place is depth
  for (const [si, sb] of out.entries()) {
    if (!sb) continue;
    const d = sb.items.filter((i) => i.kind === 'drift' && i.params.source === 'dom');
    const speeds = [...new Set(d.map((i) => i.params.pxPerSecond))];
    if (speeds.length >= 2) sb.items.push({ kind: 'parallax', what: `${d.length} drifting layers`, params: { speedRatio: r2(Math.min(...speeds) / Math.max(...speeds)), layers: speeds.length, viewportBand: [0, vh], speeds: speeds.sort((a, b) => a - b), timeBased: true } });
    void si;
  }

  // dim/active sets run on long cycles (a turn can outlast any one watch): detect them over the whole recording.
  // Members are every element sharing the flipping elements' class signature; the period comes from all flips.
  for (const it of activeSets(m, rows)) {
    const si = secAt(it.box);
    if (si >= 0) { const sb = get(si); if (!sb.items.some((x) => x.kind === it.kind && x.what === it.what)) sb.items.push(it); }
  }

  // parallax: the steady scroll pass
  const pageItems: BehaviourItem[] = [];
  // measured over the slow sweeps (fallback: the reading-pace scroll pass)
  const scrollAt = (tS: number) => { const t = (tS - (offset ?? (1.0 - loaded / 1000))) * 1000; let y = 0; for (const s of m.scroll) { if (s[0] > t) break; y = s[2]; } return y; };
  const sweeps: [number, number][] = [];
  m.marks.forEach((k, i) => { if (k.label === 'sweep:start') { const e = m.marks.slice(i).find((x) => x.label === 'sweep:end'); if (e) sweeps.push([k.t, e.t]); } });
  if (!sweeps.length) { const s0 = m.marks.find((k) => k.label === 'scroll:start')?.t, s1 = m.marks.find((k) => k.label === 'scroll:end')?.t; if (s0 && s1) sweeps.push([s0 + 1000, Math.min(s1, s0 + 30000)]); }
  if (existsSync(video)) for (const [a, b] of sweeps) {
    const f = grayFrames(video, vt(a), (b - a) / 1000, 8);
    if (!f) continue;
    for (const it of parallaxRegions(f, scrollAt, scale)) {
      // where on the page this layer sits: the viewport band at the middle of the sweep
      const mid = scrollAt(vt((a + b) / 2));
      const band = it.params.viewportBand as number[];
      it.box = [0, Math.round(mid + band[0]), vw, Math.round(band[1] - band[0])];
      pageItems.push(it);
      const si = secOf(it.box[1] - vh * 0.3);
      if (si >= 0) { const sb = get(si); sb.items.push(it); }
    }
  }

  for (const sb of out) {
    if (!sb) continue;
    const sets = sb.items.filter((i) => i.kind === 'active-one-of-n').sort((a, b) => b.params.members - a.params.members);
    const keep: BehaviourItem[] = [];
    for (const a of sets) if (!keep.some((k) => k.params.switchEveryMs && a.params.switchEveryMs && Math.abs(k.params.switchEveryMs - a.params.switchEveryMs) < k.params.switchEveryMs * 0.1)) keep.push(a);
    sb.items = [...sb.items.filter((i) => i.kind !== 'active-one-of-n'), ...keep];
    sb.narrative = narrate(sb.items);
  }
  return { sections: out, page: pageItems };
}

// what a visitor notices first comes first
const PRIORITY: BehaviourItem['kind'][] = ['3d-scene', 'animated-region', 'active-one-of-n', 'typewriter', 'parallax', 'drift', 'mover', 'cycling-text', 'staged-reveal', 'progress', 'frame-swap', 'autoplay-media', 'mask-fade', 'loop'];

function narrate(items: BehaviourItem[]): string[] {
  const n: string[] = [];
  for (const it of [...items].sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))) {
    const p = it.params;
    if (it.kind === 'typewriter') n.push(`Text types itself out at ~${p.charsPerSecond} characters/s (“${String(p.sample).slice(0, 48)}…”).`);
    else if (it.kind === 'cycling-text') n.push(`A label cycles through ${p.values.length} values every ~${p.intervalMs}ms: ${p.values.slice(0, 4).map((v: string) => `“${v.slice(0, 28)}”`).join(', ')}.`);
    else if (it.kind === 'staged-reveal') n.push(`Items appear one at a time (${p.steps} steps${p.intervalMs ? `, ~${p.intervalMs}ms apart` : ''}${p.fadeIn ? ', fading in' : ''}) in ${it.what}.`);
    else if (it.kind === 'active-one-of-n') n.push(`One of ${p.members} siblings is active at a time; the others are dimmed (${p.via}, level ${p.dimmedLevel} vs ${p.activeLevel})${p.switchEveryMs ? `; the active one changes every ~${p.switchEveryMs}ms` : ''}.`);
    else if (it.kind === 'mover') n.push(`${it.what} moves between ${p.positions} positions (up to ${p.distancePx}px).`);
    else if (it.kind === 'progress') n.push(`A progress bar grows from ${p.fromPx}px to ${p.toPx}px over ${p.durationMs}ms.`);
    else if (it.kind === 'loop') n.push(`${it.what} repeats every ~${p.periodMs}ms.`);
    else if (it.kind === 'frame-swap') n.push(`An image swaps frames (${p.frames} frames, ${p.fps} fps): a sprite or frame animation.`);
    else if (it.kind === 'mask-fade') n.push(`${it.what} fades out through a gradient mask (${String(p.mask).slice(0, 70)}).`);
    else if (it.kind === 'drift') n.push(p.source === 'dom' ? `${it.what} drifts ${p.direction} at ~${p.pxPerSecond}px/s, looping (${p.copies} cop${p.copies === 1 ? 'y' : 'ies'}).` : `Part of the view drifts ${p.direction} at ~${p.pxPerSecond}px/s on its own (painted motion: canvas, background or image).`);
    else if (it.kind === 'parallax') n.push(p.timeBased ? `Depth: ${p.layers} layers drift at different speeds (${p.speeds.join(', ')} px/s): the farther layer moves slower.` : `A layer (viewport rows ${p.viewportBand[0]}–${p.viewportBand[1]}px) moves at ${p.speedRatio}× the scroll speed: parallax depth (${p.layers} distinct speeds).`);
    else if (it.kind === 'autoplay-media') n.push(`${it.what} is autoplaying video${p.loop ? ' on a loop' : ''}.`);
    else if (it.kind === '3d-scene') n.push(`${it.what} is a live 3D scene (${p.context}${p.library ? `, ${p.library}` : ''})${p.moving ? ', moving continuously' : ''}. Rebuild it as real 3D (three.js), not a still image.`);
    else if (it.kind === 'animated-region') n.push(`${it.what} keeps changing on its own (canvas animation); recreate the motion, not a frame of it.`);
  }
  return [...new Set(n)].slice(0, 18);
}
