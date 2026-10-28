// Compare a candidate page's DNA with a source DNA: is it in the same design language? Scores each dimension
// 0–100 and lists concrete fixes, worst first. Works for new pages (distribution match, not pixel match).
import type { DNA } from '../infer/dna.js';
import { parseColor } from '../lib/csscolor.js';
import { de2000, rgbToLab, type Lab } from '../lib/color.js';
import { curveDistance, NAMED, type Bezier } from '../lib/easing.js';

export interface Finding { dimension: string; severity: number; message: string; fix: string }
export interface Report {
  source: string; candidate: string; at: string;
  scores: Record<string, number>; overall: number; pass: boolean;
  findings: Finding[];
}

const labOf = (v: string): { lab: Lab; a: number } | null => { const c = parseColor(v); return c ? { lab: rgbToLab(Math.round(c.r), Math.round(c.g), Math.round(c.b)), a: c.a } : null; };
const r1 = (v: number) => Math.round(v * 10) / 10;

function bezierOf(css: string): Bezier | null {
  if (NAMED[css]) return NAMED[css];
  const m = css.match(/cubic-bezier\(([^)]+)\)/);
  return m ? (m[1].split(',').map(Number) as Bezier) : null;
}
/** How different two CSS easings look: 0 identical … 1 unrelated. Springs compare by their stops. */
export function easingDistance(a: string, b: string): number {
  if (a === b) return 0;
  const ba = bezierOf(a), bb = bezierOf(b);
  if (ba && bb) return curveDistance(ba, bb);
  const stops = (s: string) => [...s.matchAll(/(-?[\d.]+)\s+([\d.]+)%/g)].map((m) => [+m[2] / 100, +m[1]] as [number, number]);
  const sample = (s: string, x: number) => {
    const bz = bezierOf(s);
    if (bz) { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const t = (lo + hi) / 2; const cx = 3 * bz[0] * t * (1 - t) ** 2 + 3 * bz[2] * t * t * (1 - t) + t ** 3; if (cx < x) lo = t; else hi = t; } const t = (lo + hi) / 2; return 3 * bz[1] * t * (1 - t) ** 2 + 3 * bz[3] * t * t * (1 - t) + t ** 3; }
    const st = stops(s); if (st.length < 2) return x;
    for (let i = 1; i < st.length; i++) if (st[i][0] >= x) { const [x0, y0] = st[i - 1], [x1, y1] = st[i]; return y0 + ((x - x0) / Math.max(1e-6, x1 - x0)) * (y1 - y0); }
    return st[st.length - 1][1];
  };
  let m = 0;
  for (let i = 0; i <= 40; i++) m = Math.max(m, Math.abs(sample(a, i / 40) - sample(b, i / 40)));
  return m;
}

export function compareDna(src: DNA, cand: DNA): Report {
  const F: Finding[] = [];
  const S: Record<string, number> = {};

  // ---- colour: how much of the candidate's paint sits on the source palette
  const srcCols = src.color.tokens.map((t) => ({ t, l: labOf(t.value)! })).filter((x) => x.l);
  let on = 0, tot = 0;
  for (const t of cand.color.tokens) {
    const l = labOf(t.value); if (!l) continue;
    const best = srcCols.map((s) => ({ s, d: de2000(s.l.lab, l.lab) + Math.abs(s.l.a - l.a) * 25 })).sort((a, b) => a.d - b.d)[0];
    tot += t.share;
    if (best && best.d <= 2.5) on += t.share;
    else if (t.share >= 0.5) F.push({ dimension: 'color', severity: Math.min(10, t.share / 2 + (best?.d ?? 10) / 4), message: `${t.value} (${t.role}, ${t.share}% of paint) is not in the source palette — nearest ${best?.s.t.name} ${best?.s.t.value} (ΔE ${r1(best?.d ?? 0)})`, fix: `Replace with var(--color-${best?.s.t.name})` });
  }
  S.color = tot ? Math.round((on / tot) * 100) : 0;
  for (const role of ['background', 'text', 'accent']) {
    const a = src.color.tokens.find((t) => t.role === role), b = cand.color.tokens.find((t) => t.role === role);
    if (!a || !b) continue;
    const d = de2000(labOf(a.value)!.lab, labOf(b.value)!.lab);
    if (d > 2) { F.push({ dimension: 'color', severity: role === 'accent' ? 6 : 9, message: `${role} is ${b.value}, source ${role} is ${a.value} (ΔE ${r1(d)})`, fix: `Use ${a.value} for ${role}` }); S.color = Math.max(0, S.color - (role === 'background' ? 25 : 12)); }
  }

  // ---- typography: share of candidate text set in one of the source's styles
  // a source family is matched by its own name, its Google Fonts name or its open substitute
  const srcFam = new Set(src.typography.families.flatMap((f) => [f.family, (f as any).google || '', f.substitute || '', f.family.replace(/\s+(variable|vf|var)$/i, '')].map((x) => x.toLowerCase())).filter(Boolean));
  let tOn = 0, tTot = 0;
  for (const s of cand.typography.styles) {
    tTot += s.share;
    const famOk = srcFam.has(s.family.toLowerCase()) || [...srcFam].some((f) => s.family.toLowerCase().startsWith(f));
    // the closest source style, not the first one within tolerance: 15px/300 body must not be judged as 16px/300
    const match = src.typography.styles.filter((x) => Math.abs(x.size - s.size) <= 1 && Math.abs(x.weight - s.weight) <= 60)
      .sort((a, b) => (Math.abs(a.size - s.size) * 10 + Math.abs(a.weight - s.weight) / 10 + Math.abs(a.lineHeightRatio - s.lineHeightRatio) * 20) - (Math.abs(b.size - s.size) * 10 + Math.abs(b.weight - s.weight) / 10 + Math.abs(b.lineHeightRatio - s.lineHeightRatio) * 20))[0];
    const lhOk = match && (s.lineHeight === 'normal' || match.lineHeight === 'normal' || Math.abs(match.lineHeightRatio - s.lineHeightRatio) <= 0.08);
    const lsOk = match && Math.abs(match.letterSpacingEm - s.letterSpacingEm) <= 0.012;
    if (famOk && match && lhOk && lsOk) { tOn += s.share; continue; }
    if (s.share < 1) continue;
    if (!famOk) F.push({ dimension: 'type', severity: 7, message: `"${s.family}" is not a source family (${[...srcFam].join(', ')})`, fix: 'Use var(--font-sans) / var(--font-mono)' });
    else if (!match) { const near = [...src.typography.styles].sort((a, b) => Math.abs(a.size - s.size) - Math.abs(b.size - s.size))[0]; F.push({ dimension: 'type', severity: 3 + s.share / 5, message: `${s.size}px/${s.weight} (“${s.sample.slice(0, 30)}”) matches no source style`, fix: `Use .text-${near.name} (${near.size}px/${near.weight})` }); }
    else if (!lhOk) F.push({ dimension: 'type', severity: 2 + s.share / 8, message: `${s.size}px text has line-height ${s.lineHeightRatio}; source ${match.name} uses ${match.lineHeightRatio}`, fix: `line-height: ${match.lineHeightRatio}` });
    else F.push({ dimension: 'type', severity: 2 + s.share / 8, message: `${s.size}px text tracked ${s.letterSpacingEm}em; source ${match.name} uses ${match.letterSpacingEm}em`, fix: `letter-spacing: ${match.letterSpacingEm}em` });
  }
  S.type = tTot ? Math.round((tOn / tTot) * 100) : 0;

  // ---- spacing, radii, shadows
  const scale = new Set(src.spacing.scale);
  const onScale = cand.spacing.top.filter((x) => scale.has(x.value) || [...scale].some((v) => Math.abs(v - x.value) <= 1) || x.value % src.spacing.base === 0).reduce((s, x) => s + x.share, 0);
  const allTop = cand.spacing.top.reduce((s, x) => s + x.share, 0) || 1;
  S.spacing = Math.round((onScale / allTop) * 100);
  const sp = src.spacing.sections.desktop?.median, cp = cand.spacing.sections.desktop?.median;
  if (sp && cp && Math.abs(sp - cp) / sp > 0.2) { F.push({ dimension: 'spacing', severity: 5, message: `sections padded ${cp}px vertically; source uses ~${sp}px`, fix: `padding-block: ${sp}px on sections (desktop)` }); S.spacing = Math.max(0, S.spacing - 15); }
  const srcR = new Set(src.shape.radii.map((r) => r.value));
  const rOk = cand.shape.radii.filter((r) => srcR.has(r.value) || [...srcR].some((v) => Math.abs(v - r.value) <= 1)).reduce((s, r) => s + r.count, 0);
  const rTot = cand.shape.radii.reduce((s, r) => s + r.count, 0) || 1;
  S.shape = Math.round((rOk / rTot) * 100);
  for (const r of cand.shape.radii) if (!srcR.has(r.value) && ![...srcR].some((v) => Math.abs(v - r.value) <= 1) && r.count >= 2) F.push({ dimension: 'shape', severity: 3, message: `radius ${r.css} (×${r.count}) is not a source radius`, fix: `Use one of ${[...srcR].map((v) => (v === 9999 ? 'full' : v + 'px')).join(', ')}` });
  if (!src.shape.shadows.length && cand.shape.shadows.length) { F.push({ dimension: 'shape', severity: 5, message: `uses ${cand.shape.shadows.length} box-shadows; the source has none`, fix: 'Remove shadows; separate with the border tokens' }); S.shape = Math.max(0, S.shape - 20); }

  // ---- layout
  let lay = 100;
  const sc = src.layout.containers.desktop?.[0]?.value, cc = cand.layout.containers.desktop?.[0]?.value;
  if (sc && cc && Math.abs(sc - cc) / sc > 0.05) { lay -= 25; F.push({ dimension: 'layout', severity: 5, message: `content width ${cc}px; source ${sc}px`, fix: `max-width: ${sc}px` }); }
  for (const vp of ['desktop', 'mobile']) {
    const a = src.layout.gutters[vp], b = cand.layout.gutters[vp];
    if (a != null && b != null && Math.abs(a - b) > 4) { lay -= 15; F.push({ dimension: 'layout', severity: 4, message: `${vp} gutter ${b}px; source ${a}px`, fix: `padding-inline: ${a}px at ${vp}` }); }
  }
  S.layout = Math.max(0, lay);

  // ---- motion: every source behaviour should exist in the candidate with the same clock and curve
  const mScore: number[] = [];
  const ss = src.motion.scroll, cs = cand.motion.scroll;
  if (ss && cs) {
    if (ss.kind !== cs.kind) { mScore.push(0); F.push({ dimension: 'motion', severity: 9, message: `scrolling is ${cs.kind}; source is ${ss.kind}${ss.kind === 'smooth' ? ` (${ss.library}, lerp ${ss.lerp})` : ''}`, fix: ss.kind === 'smooth' ? `initSmoothScroll() from motion.js (lerp ${ss.lerp})` : 'Remove smooth scrolling' }); }
    else if (ss.kind === 'smooth') { const d = Math.abs((ss.settleMs || 0) - (cs.settleMs || 0)) / Math.max(1, ss.settleMs || 1); mScore.push(Math.max(0, 100 - d * 150)); if (d > 0.15) F.push({ dimension: 'motion', severity: 6, message: `scroll settles in ${cs.settleMs}ms; source ${ss.settleMs}ms`, fix: `lerp ${ss.lerp}` }); }
    else mScore.push(100);
  }
  // one animation may carry several properties (CSS @keyframes) where the source ran one per property (WAAPI):
  // compare per property so packaging never counts as a difference
  const norm = (x: string) => (/^(x|y|transform|scale|rotate|translate)$/.test(x) ? 'transform' : x);
  const explode = (list: any[]) => list.flatMap((p) => [...new Set((p.props as string[]).map(norm))].map((prop) => ({ ...p, props: [prop], key: `${p.trigger}:${prop}` })));
  const candByKind = new Map<string, any[]>();
  for (const p of explode(cand.motion.patterns as any[])) { if (!candByKind.has(p.key)) candByKind.set(p.key, []); candByKind.get(p.key)!.push(p); }
  // the language is the motion on text, controls, cards and sections; illustration and menu internals are content
  const isContent = (p: any) => /^(circle|path|svg|g|rect|line|polyline|polygon|canvas|img|video)\b/.test(p.targets[0] || '') || /^nav\b/.test(p.targets[0] || '') && p.trigger === 'hover';
  const seenKey = new Set<string>();
  // an instant flip (0ms, steps()) is a state change such as a menu unmounting, not motion anyone feels
  const isInstant = (p: any) => p.duration === 0 || /^steps\(/.test(p.easing);
  const important = explode((src.motion.patterns as any[]).filter((p) => ['load', 'scroll', 'hover', 'scroll-linked'].includes(p.trigger) && !isContent(p) && !isInstant(p)))
    .sort((a, b) => b.count - a.count).filter((p) => { if (seenKey.has(p.key)) return false; seenKey.add(p.key); return true; }).slice(0, 12);
  for (const p of important) {
    const c = candByKind.get(p.key);
    const label = `${p.trigger} ${p.props.join('+')} on ${p.targets[0]}`;
    if (!c?.length) {
      // only behaviours the source uses repeatedly are part of its language
      if (p.count >= 2 || p.trigger === 'load') { mScore.push(0); F.push({ dimension: 'motion', severity: p.trigger === 'hover' ? 4 : 7, message: `missing: ${label} (×${p.count}) — ${JSON.stringify(p.from)} → ${JSON.stringify(p.to)}`, fix: `${p.duration}ms ${p.easing.slice(0, 60)}${p.delay ? ` delay ${p.delay}ms` : ''}${p.stagger ? ` stagger ${p.stagger}ms` : ''}` }); }
      continue;
    }
    const best = c.map((x) => ({ x, dd: Math.abs(x.duration - p.duration) / Math.max(1, p.duration), de: easingDistance(p.easing, x.easing) })).sort((a, b) => a.dd + a.de * 2 - (b.dd + b.de * 2))[0];
    let s = 100;
    if (best.dd > 0.1) { s -= Math.min(50, best.dd * 100); F.push({ dimension: 'motion', severity: 5, message: `${label}: ${best.x.duration}ms; source ${p.duration}ms`, fix: `duration ${p.duration}ms` }); }
    if (best.de > 0.06) { s -= Math.min(40, best.de * 200); F.push({ dimension: 'motion', severity: 5, message: `${label}: curve ${best.x.easing.slice(0, 50)}; source ${p.easing.slice(0, 50)} (differs by ${r1(best.de * 100)}%)`, fix: `easing ${p.easing.length > 80 ? 'var(--ease-spring-…) from tokens.css' : p.easing}` }); }
    if (p.stagger && p.trigger !== 'hover' && Math.abs((best.x.stagger || 0) - p.stagger) > Math.max(10, p.stagger * 0.25)) { s -= 15; F.push({ dimension: 'motion', severity: 3, message: `${label}: stagger ${best.x.stagger ?? 0}ms; source ${p.stagger}ms`, fix: `--i stagger ${p.stagger}ms` }); }
    if (p.entry !== undefined && best.x.entry !== undefined && Math.abs(p.entry - best.x.entry) > 0.12) { s -= 10; F.push({ dimension: 'motion', severity: 3, message: `${label}: starts at ${Math.round(best.x.entry * 100)}% of viewport; source ${Math.round(p.entry * 100)}%`, fix: 'use motion.js reveal entry' }); }
    for (const k of ['opacity', 'y', 'x', 'scale', 'filter']) {
      const a = p.from[k], b = best.x.from[k];
      if (a !== undefined && b !== undefined && String(a) !== String(b) && !(typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= Math.max(2, Math.abs(a) * 0.2))) { s -= 10; F.push({ dimension: 'motion', severity: 3, message: `${label}: starts from ${k} ${b}; source ${a}`, fix: `${k}: ${a}` }); }
    }
    mScore.push(Math.max(0, s));
  }
  S.motion = mScore.length ? Math.round(mScore.reduce((a, b) => a + b, 0) / mScore.length) : 100;

  // ---- feel: the measured character numbers
  const fm = src.feel.metrics as any, cm = cand.feel.metrics as any;
  let feel = 100;
  const near = (k: string, tol: number, what: string, fix: string) => {
    const a = fm[k], b = cm[k];
    if (typeof a !== 'number' || typeof b !== 'number') return;
    const d = Math.abs(a - b) / Math.max(Math.abs(a), 1e-6);
    if (d > tol) { feel -= Math.min(20, d * 40); F.push({ dimension: 'feel', severity: 3, message: `${what}: ${r1(b)} vs source ${r1(a)}`, fix }); }
  };
  near('chromaShare', 0.8, 'colourfulness (chromatic share %)', 'Ration colour as the source does');
  near('surfaceRadius', 0.3, 'surface radius', `Use ${fm.surfaceRadius}px on surfaces`);
  near('headingTracking', 0.5, 'headline tracking (em)', `letter-spacing ${fm.headingTracking}em on headlines`);
  near('avgEntranceMs', 0.3, 'average entrance duration (ms)', 'Match the measured entrance timings');
  if (fm.pillButtons !== cm.pillButtons) { feel -= 10; F.push({ dimension: 'feel', severity: 4, message: `buttons are ${cm.pillButtons ? '' : 'not '}pills; source buttons are ${fm.pillButtons ? '' : 'not '}pills`, fix: fm.pillButtons ? 'border-radius: 9999px on buttons' : 'Use the measured button radius' }); }
  if (fm.scheme !== cm.scheme) { feel -= 40; F.push({ dimension: 'feel', severity: 10, message: `${cm.scheme} page; source is ${fm.scheme}`, fix: `Use the ${fm.scheme} scheme tokens` }); }
  S.feel = Math.max(0, Math.round(feel));

  // ---- composition: is the page built out of the same kinds of things, in the same proportions?
  const sc0 = (src as any).composition?.pages?.[0], cc0 = (cand as any).composition?.pages?.[0];
  if (sc0 && cc0) {
    const coarse = (k: string) => k.replace(/^feature: split intro \+ product UI|^product UI showcase/, 'product-ui').replace(/^hero.*/, 'hero').replace(/ with illustrations/, '');
    const a = sc0.sections.map((x: any) => coarse(x.kind)), b = cc0.sections.map((x: any) => coarse(x.kind));
    // sequence similarity: edit distance over section kinds
    const D = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    const seq = 1 - D[a.length][b.length] / Math.max(a.length, b.length);
    const vis = Math.min(1, cc0.totals.visualShare / Math.max(0.05, sc0.totals.visualShare));
    const dens = Math.min(1, cc0.totals.elementsPerScreen / Math.max(1, sc0.totals.elementsPerScreen));
    const kindsSrc = Object.keys(sc0.totals.kinds).filter((k) => !['avatar', 'form', 'image'].includes(k));
    const covered = kindsSrc.filter((k) => cc0.totals.kinds[k]).length / Math.max(1, kindsSrc.length);
    S.composition = Math.round((seq * 0.3 + vis * 0.3 + dens * 0.15 + covered * 0.25) * 100);
    if (vis < 0.7) F.push({ dimension: 'composition', severity: 9, message: `visuals cover ${Math.round(cc0.totals.visualShare * 100)}% of the page; the source covers ${Math.round(sc0.totals.visualShare * 100)}% with product UI, illustrations and data`, fix: 'Build the visual blocks the blueprint lists for each section' });
    for (const k of kindsSrc.filter((k) => !cc0.totals.kinds[k])) F.push({ dimension: 'composition', severity: k === 'ui-mock' ? 9 : 6, message: `no ${k} anywhere; the source has ${sc0.totals.kinds[k]}`, fix: k === 'ui-mock' ? 'Build product UI in HTML using the measured UI grammar (blueprint.md)' : `Add ${k} where the blueprint places them` });
    if (seq < 0.7) F.push({ dimension: 'composition', severity: 7, message: `section sequence differs: source ${a.join(' → ')}; yours ${b.join(' → ')}`, fix: 'Follow the section order in blueprint.md' });
    if (dens < 0.6) F.push({ dimension: 'composition', severity: 6, message: `${cc0.totals.elementsPerScreen} elements per screen; the source has ${sc0.totals.elementsPerScreen}`, fix: 'Match the source density: every section carries detailed content, not only headings' });
  }
  const W: Record<string, number> = S.composition !== undefined
    ? { color: 0.12, type: 0.12, spacing: 0.08, shape: 0.08, layout: 0.08, motion: 0.15, feel: 0.07, composition: 0.3 }
    : { color: 0.2, type: 0.2, spacing: 0.1, shape: 0.1, layout: 0.1, motion: 0.2, feel: 0.1 };
  const overall = Math.round(Object.entries(W).reduce((s, [k, w]) => s + (S[k] ?? 0) * w, 0));
  const findings = F.sort((a, b) => b.severity - a.severity).slice(0, 40);
  return { source: src.source.url, candidate: cand.source.url, at: new Date().toISOString(), scores: S, overall, pass: Object.values(S).every((v) => v >= 85) && !findings.some((f) => f.severity >= 8), findings };
}
