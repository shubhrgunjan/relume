// Static design tokens from harvested computed styles: colour (with roles), typography (with fluid sizes),
// spacing, shape (radii, borders, shadows, blur) and layout (containers, gutters, grids, breakpoints, rhythm).
import { de2000, rgbToLab, type Lab } from '../lib/color.js';
import { parseColor, rgbaCss, rgbaHex, colorsIn, over, contrast, normalizeColors, type RGBA } from '../lib/csscolor.js';
import type { Evidence, Harvest, Row } from './evidence.js';
import { visibleRows } from './evidence.js';
import { readFileSync } from 'node:fs';

const GOOGLE = new Map<string, string>((JSON.parse(readFileSync(new URL('./google-fonts.json', import.meta.url), 'utf8')) as string[]).map((f) => [f.toLowerCase(), f]));
/** The Google Fonts family a computed name refers to: "Inter Variable", "GeistSans", "anton-regular" all resolve. */
export function googleFamily(name: string): string | undefined {
  const b = name.replace(/[-_]?(variable|vf|var|web|regular|webfont)$/i, '').replace(/[-_]/g, ' ').trim();
  const split = b.replace(/([a-z])([A-Z])/g, '$1 $2');
  for (const c of [name, b, split, split.replace(/\s+(sans|text|display)$/i, ''), b.replace(/\s+(text|display)$/i, '')]) { const hit = GOOGLE.get(c.toLowerCase().trim()); if (hit) return hit; }
  return undefined;
}

export const px = (v: string | undefined) => (v && /px$/.test(v) ? parseFloat(v) : v === '0' ? 0 : NaN);
const r1 = (v: number) => Math.round(v * 10) / 10;
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

// ---------------------------------------------------------------- colour

export interface ColorToken {
  name: string; value: string; hex: string; alpha: number; role: string;
  weight: number; share: number; uses: Record<string, number>; aliases: string[]; dark?: string;
}

interface ColorObs { c: RGBA; w: number; use: 'bg' | 'text' | 'border' | 'shadow' | 'gradient' | 'icon' | 'accent-fill' }

function lab(c: RGBA): Lab { return rgbToLab(Math.round(c.r), Math.round(c.g), Math.round(c.b)); }
function chroma(c: RGBA) { const l = lab(c); return Math.hypot(l[1], l[2]); }

function observeColors(h: Harvest): ColorObs[] {
  const rows = visibleRows(h);
  const out: ColorObs[] = [];
  const kids = new Map<number, Row[]>();
  for (const r of rows) { if (!kids.has(r.pid)) kids.set(r.pid, []); kids.get(r.pid)!.push(r); }
  const pageBg = parseColor(h.body.backgroundColor)?.a ? parseColor(h.body.backgroundColor)! : parseColor(h.body.htmlBackground)?.a ? parseColor(h.body.htmlBackground)! : { r: 255, g: 255, b: 255, a: 1 };
  out.push({ c: pageBg, w: h.viewport[0] * h.docHeight * 0.5, use: 'bg' });
  for (const r of rows) {
    const s = r.s;
    const area = r.box[2] * r.box[3];
    const bg = parseColor(s.backgroundColor);
    if (bg && bg.a > 0.02) {
      // visible area: minus children that paint their own opaque background
      let covered = 0;
      for (const k of kids.get(r.id) || []) { const kb = parseColor(k.s.backgroundColor); if (kb && kb.a > 0.9) covered += k.box[2] * k.box[3]; }
      const interactive = /^(a|button)$/.test(r.tag) || r.role === 'button' || s.cursor === 'pointer';
      out.push({ c: bg, w: Math.max(area * 0.05, area - covered), use: interactive && area < 60000 ? 'accent-fill' : 'bg' });
    }
    if (r.chars > 0) {
      const c = parseColor(s.color);
      const fs = px(s.fontSize) || 16;
      if (c && c.a > 0.02) out.push({ c, w: r.chars * fs * fs * 0.6, use: 'text' });
      // chromatic link text is accent evidence
      if (c && r.tag === 'a' && c.a > 0.5) out.push({ c, w: r.chars * fs * fs * 0.6, use: 'accent-fill' });
    }
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const bw = px(s[`border${side}Width`]);
      if (bw > 0 && s.borderTopStyle !== 'none') {
        const c = parseColor(s[`border${side}Color`]);
        const len = side === 'Top' || side === 'Bottom' ? r.box[2] : r.box[3];
        if (c && c.a > 0.02) out.push({ c, w: bw * len * 8, use: 'border' });
      }
    }
    if (s.boxShadow && s.boxShadow !== 'none') for (const cs of colorsIn(s.boxShadow)) { const c = parseColor(cs); if (c && c.a > 0.02) out.push({ c, w: Math.sqrt(area) * 4, use: 'shadow' }); }
    if (s.backgroundImage && /gradient/.test(s.backgroundImage)) for (const cs of colorsIn(s.backgroundImage)) { const c = parseColor(cs); if (c && c.a > 0.02) out.push({ c, w: area / 4, use: 'gradient' }); }
    if (r.svg) {
      const fill = parseColor(s.fill), stroke = parseColor(s.stroke);
      const c = stroke && stroke.a > 0 && r.svg.strokeAttr !== 'none' ? stroke : fill;
      if (c && c.a > 0.02) out.push({ c, w: Math.min(area, 576) * 0.3, use: 'icon' });
    }
  }
  return out;
}

interface Cluster { c: RGBA; lab: Lab; w: number; uses: Record<string, number>; members: number }

function clusterColors(obs: ColorObs[]): Cluster[] {
  // total weight per exact colour first, so each cluster is represented by its most-used exact value
  const exact = new Map<string, { c: RGBA; w: number; uses: Record<string, number>; members: number }>();
  for (const o of obs) {
    const k = `${Math.round(o.c.r)},${Math.round(o.c.g)},${Math.round(o.c.b)},${o.c.a.toFixed(2)}`;
    const e = exact.get(k) || { c: o.c, w: 0, uses: {}, members: 0 };
    e.w += o.w; e.members++; e.uses[o.use] = (e.uses[o.use] || 0) + o.w;
    exact.set(k, e);
  }
  const clusters: Cluster[] = [];
  for (const e of [...exact.values()].sort((a, b) => b.w - a.w)) {
    const l = lab(e.c);
    let hit = clusters.find((k) => Math.abs(k.c.a - e.c.a) < 0.04 && de2000(k.lab, l) < 1.2);
    if (!hit) { hit = { c: e.c, lab: l, w: 0, uses: {}, members: 0 }; clusters.push(hit); }
    hit.w += e.w; hit.members += e.members;
    for (const [u, w] of Object.entries(e.uses)) hit.uses[u] = (hit.uses[u] || 0) + w;
  }
  return clusters.sort((a, b) => b.w - a.w);
}

const HUES: [number, string][] = [[20, 'red'], [45, 'orange'], [70, 'amber'], [100, 'yellow'], [140, 'lime'], [165, 'green'], [195, 'teal'], [230, 'cyan'], [265, 'blue'], [290, 'indigo'], [320, 'violet'], [345, 'pink'], [360, 'red']];
function hueName(c: RGBA) {
  const l = lab(c);
  if (Math.hypot(l[1], l[2]) < 8) return l[0] > 96 ? 'white' : l[0] < 6 ? 'black' : 'gray';
  let h = (Math.atan2(l[2], l[1]) * 180) / Math.PI; if (h < 0) h += 360;
  return HUES.find(([lim]) => h <= lim)![1];
}

export function inferColors(ev: Evidence) {
  const obs: ColorObs[] = [];
  for (const p of ev.pages) obs.push(...observeColors(p.harvests.desktop));
  // focus rings are drawn in the brand colour more reliably than anything else
  for (const p of ev.pages) for (const h of p.motion?.hovers || []) {
    const c = parseColor(h.focus?.outlineColor);
    if (c && c.a > 0.5 && h.focus?.outlineStyle !== 'none') obs.push({ c, w: 40000, use: 'accent-fill' });
  }
  const clusters = clusterColors(obs).filter((k) => k.w > 0);
  const total = clusters.reduce((s, k) => s + k.w, 0);
  const significant = clusters.filter((k) => k.w / total > 0.0005 || (k.uses['accent-fill'] || 0) > 0).slice(0, 40);

  // authored names: custom properties whose resolved value matches a cluster
  const home = ev.pages[0].harvests.desktop;
  const varColors: { name: string; c: RGBA }[] = [];
  for (const [name, value] of Object.entries(home.rootVars)) {
    const c = parseColor(value);
    if (c) varColors.push({ name, c });
  }

  const pageBg = significant.find((k) => k.c.a > 0.99 && (k.uses.bg || 0) > k.w * 0.5) || significant[0];
  const dark = pageBg.lab[0] < 45;
  const used = new Set<Cluster>();
  const role = new Map<Cluster, string>();
  const take = (k: Cluster | undefined, name: string) => { if (k && !used.has(k)) { used.add(k); role.set(k, name); } };
  take(pageBg, 'background');
  const texts = significant.filter((k) => (k.uses.text || 0) > k.w * 0.3 && !used.has(k)).sort((a, b) => (b.uses.text || 0) - (a.uses.text || 0));
  const bgRgb = pageBg.c;
  const textByContrast = texts.map((k) => ({ k, cr: contrast(k.c.a < 1 ? over(k.c, bgRgb) : k.c, bgRgb) })).filter((t) => t.cr > 1.6);
  const strongText = textByContrast.slice(0, 4).sort((a, b) => b.cr - a.cr);
  if (strongText[0]) take(strongText[0].k, 'text');
  const rest = textByContrast.filter((t) => !used.has(t.k)).sort((a, b) => (b.k.uses.text || 0) - (a.k.uses.text || 0)).slice(0, 3).sort((a, b) => b.cr - a.cr);
  ['text-secondary', 'text-tertiary', 'text-quaternary'].forEach((n, i) => rest[i] && rest[i].k.c.a > 0 && take(rest[i].k, n));
  // accent: the most-used chromatic colour on interactive fills, else the most-used chromatic overall
  const chromatic = significant.filter((k) => !used.has(k) && chroma(k.c) > 18 && k.c.a > 0.5);
  const accentScore = (k: Cluster) => ((k.uses['accent-fill'] || 0) * 3 + k.w * 0.2) * Math.min(1, k.members / 4);
  const accent = chromatic.sort((a, b) => accentScore(b) - accentScore(a))[0];
  take(accent, 'accent');
  const surfaces = significant.filter((k) => !used.has(k) && ((k.uses.bg || 0) + (k.uses['accent-fill'] || 0)) > k.w * 0.5 && chroma(k.c) < 18);
  surfaces.slice(0, 4).forEach((k, i) => take(k, i === 0 ? 'surface' : `surface-${i + 1}`));
  const borders = significant.filter((k) => !used.has(k) && (k.uses.border || 0) > k.w * 0.4);
  borders.slice(0, 3).forEach((k, i) => take(k, i === 0 ? 'border' : `border-${i + 1}`));
  const shadows = significant.filter((k) => !used.has(k) && (k.uses.shadow || 0) > k.w * 0.5);
  shadows.slice(0, 2).forEach((k, i) => take(k, i === 0 ? 'shadow' : 'shadow-2'));

  const nameCount = new Map<string, number>();
  const tokens: ColorToken[] = significant.map((k) => {
    let name = role.get(k);
    if (!name) {
      const base = (k.c.a < 0.99 ? `${hueName(k.c)}-a${Math.round(k.c.a * 100)}` : `${hueName(k.c)}-${Math.round(k.lab[0] / 10) * 100 || 50}`);
      const n = (nameCount.get(base) || 0) + 1; nameCount.set(base, n);
      name = n > 1 ? `${base}-${n}` : base;
    }
    const aliases = varColors.filter((v) => Math.abs(v.c.a - k.c.a) < 0.02 && de2000(lab(v.c), k.lab) < 0.8).map((v) => v.name).slice(0, 6);
    const uses: Record<string, number> = {};
    for (const [u, w] of Object.entries(k.uses)) uses[u] = pct(w, k.w);
    return { name, value: rgbaCss(k.c), hex: rgbaHex(k.c), alpha: +k.c.a.toFixed(3), role: role.get(k) || 'palette', weight: Math.round(k.w), share: pct(k.w, total), uses, aliases };
  });

  // dark mode: map light tokens to their counterparts by element role in the dark harvest
  const darkH = ev.pages[0].harvests['desktop-dark'];
  let darkMode: { supported: boolean; strategy: string; background?: string; text?: string } = { supported: false, strategy: ev.css.darkStrategy };
  if (darkH) {
    const lb = parseColor(home.body.backgroundColor)?.a ? home.body.backgroundColor : home.body.htmlBackground;
    const db = parseColor(darkH.body.backgroundColor)?.a ? darkH.body.backgroundColor : darkH.body.htmlBackground;
    const lc = parseColor(lb), dc = parseColor(db);
    if (lc && dc && de2000(lab(lc), lab(dc)) > 10) {
      darkMode = { supported: true, strategy: ev.css.darkStrategy, background: rgbaCss(dc), text: rgbaCss(parseColor(darkH.body.color)!) };
      const darkClusters = clusterColors(observeColors(darkH));
      // pair by element: same text content + tag at both schemes
      const lightById = new Map(home.rows.map((r) => [r.tag + '|' + r.text, r]));
      const pairs = new Map<string, Map<string, number>>();
      for (const r of darkH.rows) {
        const l = r.text && lightById.get(r.tag + '|' + r.text);
        if (!l) continue;
        for (const prop of ['color', 'backgroundColor', 'borderTopColor']) {
          const a = parseColor(l.s[prop]), b = parseColor(r.s[prop]);
          if (!a || !b || a.a < 0.02) continue;
          const t = tokens.find((t) => { const tc = parseColor(t.value)!; return Math.abs(tc.a - a.a) < 0.04 && de2000(lab(tc), lab(a)) < 1.6; });
          if (!t) continue;
          const m = pairs.get(t.name) || new Map(); m.set(rgbaCss(b), (m.get(rgbaCss(b)) || 0) + 1); pairs.set(t.name, m);
        }
      }
      for (const t of tokens) {
        const m = pairs.get(t.name);
        if (m) t.dark = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
      }
      const bgTok = tokens.find((t) => t.role === 'background');
      if (bgTok) bgTok.dark = rgbaCss(dc);
      void darkClusters;
    }
  }

  const gradients = new Map<string, number>();
  for (const p of ev.pages) for (const r of visibleRows(p.harvests.desktop)) {
    const bi = r.s.backgroundImage;
    if (bi && /gradient/.test(bi)) gradients.set(bi, (gradients.get(bi) || 0) + r.box[2] * r.box[3]);
  }
  return {
    scheme: dark ? 'dark' : 'light',
    tokens,
    darkMode,
    gradients: [...gradients.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([value]) => value.slice(0, 400)),
  };
}

// ---------------------------------------------------------------- typography

export interface TextStyle {
  name: string; family: string; stack: string; size: number; weight: number; lineHeight: number | 'normal'; lineHeightRatio: number;
  letterSpacing: number; letterSpacingEm: number; transform: string; italic: boolean; features?: string;
  share: number; tags: Record<string, number>; sample: string; fluid?: { mobile: number; tablet: number; desktop: number; css: string };
}

const GENERIC = /^(ui-monospace|ui-sans-serif|ui-serif|ui-rounded|monospace|sans-serif|serif|system-ui|-apple-system|blinkmacsystemfont|cursive|fantasy|emoji|math|fangsong)$/i;
/** The first real family in a stack; a stack that starts with a generic keyword names its first real one after it. */
function primaryFamily(stack: string) {
  const fams = stack.split(',').map((f) => f.trim().replace(/["']/g, '')).filter(Boolean);
  return fams.find((f) => !GENERIC.test(f)) || (/mono/i.test(stack) ? 'monospace' : fams[0]);
}

const WEIGHT_NAMES: [number, string][] = [[150, 'thin'], [250, 'extralight'], [350, 'light'], [450, 'regular'], [550, 'medium'], [650, 'semibold'], [750, 'bold'], [850, 'extrabold'], [1000, 'black']];
const weightName = (w: number) => WEIGHT_NAMES.find(([lim]) => w < lim)![1];

export function inferTypography(ev: Evidence) {
  // one style per family/size/weight/case; line-height and tracking take their dominant value
  type Acc = { rows: Row[]; w: number; tags: Record<string, number>; lh: Map<string, number>; ls: Map<number, number> };
  const map = new Map<string, Acc>();
  let total = 0;
  for (const p of ev.pages) for (const r of visibleRows(p.harvests.desktop)) {
    if (!r.chars) continue;
    const s = r.s;
    const size = r1(px(s.fontSize));
    const key = [primaryFamily(s.fontFamily), size, s.fontWeight, s.textTransform, s.fontStyle].join('|');
    const w = r.chars;
    total += w;
    const e: Acc = map.get(key) || { rows: [], w: 0, tags: {}, lh: new Map(), ls: new Map() };
    e.rows.push(r); e.w += w;
    const tag = /^h[1-6]$/.test(r.tag) ? r.tag : /^(a|button)$/.test(r.tag) ? r.tag : r.tag === 'p' ? 'p' : 'other';
    e.tags[tag] = (e.tags[tag] || 0) + w;
    const lh = px(s.lineHeight);
    const lhk = isNaN(lh) ? 'normal' : String(r1(lh));
    e.lh.set(lhk, (e.lh.get(lhk) || 0) + w);
    const ls = r1(px(s.letterSpacing) || 0);
    e.ls.set(ls, (e.ls.get(ls) || 0) + w);
    map.set(key, e);
  }
  const top = <K,>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const rowsByStyle = new Map<TextStyle, Row[]>();
  let styles: TextStyle[] = [...map.entries()].map(([key, e]) => {
    const [family, size, weight, transform, fstyle] = key.split('|');
    const s0 = e.rows[0].s;
    const sizeN = +size;
    const lhk = top(e.lh);
    const lhN = lhk === 'normal' ? 'normal' as const : +lhk;
    const ls = top(e.ls);
    const tagPct: Record<string, number> = {};
    for (const [t, w] of Object.entries(e.tags)) tagPct[t] = pct(w, e.w);
    const sample = e.rows.map((r) => r.text).sort((a, b) => b.length - a.length)[0].slice(0, 60);
    const st: TextStyle = {
      name: '', family, stack: s0.fontFamily, size: sizeN, weight: +weight, lineHeight: lhN,
      lineHeightRatio: lhN === 'normal' ? 1.2 : +(lhN / sizeN).toFixed(3), letterSpacing: ls, letterSpacingEm: +(ls / sizeN).toFixed(3),
      transform, italic: fstyle === 'italic', features: s0.fontFeatureSettings !== 'normal' ? s0.fontFeatureSettings : undefined,
      share: pct(e.w, total), tags: tagPct, sample,
    };
    rowsByStyle.set(st, e.rows);
    return st;
  }).filter((s) => s.share >= 0.4 || Object.keys(s.tags).some((t) => /^h[1-3]$/.test(t) && s.tags[t] > 30));
  styles.sort((a, b) => b.size - a.size || b.weight - a.weight);

  // names: body = most text; headings by their dominant h-tag; the rest by size tier, with a weight suffix
  // when one size comes in several weights
  const body = [...styles].filter((s) => s.size >= 12 && s.size <= 22 && !/mono|code/i.test(s.stack)).sort((a, b) => b.share - a.share)[0];
  const bs = body?.size || 16;
  const used = new Set<string>();
  const assign = (s: TextStyle, n: string) => {
    let name = n;
    if (used.has(name)) name = `${n}-${weightName(s.weight)}`;
    let i = 2; const b2 = name; while (used.has(name)) name = `${b2}-${i++}`;
    used.add(name); s.name = name;
  };
  if (body) assign(body, 'body');
  for (const s of styles) {
    if (s.name) continue;
    const topTag = Object.entries(s.tags).sort((a, b) => b[1] - a[1])[0][0];
    if (/mono|code|consol|courier/i.test(s.stack)) assign(s, s.size >= bs ? 'mono' : 'mono-sm');
    else if (/^h[1-6]$/.test(topTag) && s.size > bs) assign(s, topTag);
    else if (s.size >= bs * 2.6) assign(s, 'display');
    else if (s.size >= bs * 1.6) assign(s, 'title-lg');
    else if (s.size > bs * 1.12) assign(s, 'title');
    else if (Math.abs(s.size - bs) <= 1) assign(s, s.transform === 'uppercase' ? 'label-caps' : (topTag === 'button' || topTag === 'a') ? 'label' : 'body');
    else if (s.size > bs) assign(s, 'body-lg');
    else if (s.size >= bs * 0.85) assign(s, s.transform === 'uppercase' ? 'overline' : 'small');
    else if (s.size >= bs * 0.75) assign(s, s.transform === 'uppercase' ? 'overline' : 'caption');
    else assign(s, 'micro');
  }

  // fluid sizes: the same text at mobile / tablet / desktop
  const home = ev.pages[0].harvests;
  if (home.mobile) {
    const byText = (h: Harvest) => new Map(h.rows.filter((r) => r.chars > 6).map((r) => [r.tag + '|' + r.text, px(r.s.fontSize)]));
    const mob = byText(home.mobile), tab = home.tablet ? byText(home.tablet) : new Map();
    for (const s of styles) {
      const rows = rowsByStyle.get(s) || [];
      const m: number[] = [], t: number[] = [];
      for (const r of rows) { const k = r.tag + '|' + r.text; if (mob.has(k)) m.push(mob.get(k)!); if (tab.has(k)) t.push(tab.get(k)!); }
      if (!m.length) continue;
      const med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1];
      const mobile = r1(med(m)), tablet = t.length ? r1(med(t)) : NaN, desktop = s.size;
      if (Math.abs(mobile - desktop) < 0.5) continue;
      const vwM = home.mobile.viewport[0], vwD = home.desktop.viewport[0];
      const slope = (desktop - mobile) / (vwD - vwM);
      const intercept = mobile - slope * vwM;
      // stepped (breakpoint) if tablet equals one end; fluid if tablet sits on the line
      const onLine = !isNaN(tablet) && home.tablet && Math.abs(intercept + slope * home.tablet.viewport[0] - tablet) < 1.2;
      // clamp() needs min ≤ max even when text grows on small screens
      const lo = Math.min(mobile, desktop), hi = Math.max(mobile, desktop);
      const css = onLine ? `clamp(${lo / 16}rem, ${r1(intercept / 16 * 100) / 100}rem + ${r1(slope * 100 * 100) / 100}vw, ${hi / 16}rem)` : `${mobile}px → ${desktop}px at breakpoints`;
      s.fluid = { mobile, tablet: isNaN(tablet) ? mobile : tablet, desktop, css };
    }
  }

  // families and where they come from
  const famShare = new Map<string, number>();
  for (const s of styles) famShare.set(s.family, (famShare.get(s.family) || 0) + s.share);
  const families = [...famShare.entries()].sort((a, b) => b[1] - a[1]).map(([family, share]) => {
    const faces = ev.css.fontFaces.filter((f) => f.family.toLowerCase() === family.toLowerCase());
    const weights = [...new Set(styles.filter((s) => s.family === family).map((s) => s.weight))].sort((a, b) => a - b);
    const loaded = ev.pages[0].harvests.desktop.fonts.some((f) => f.family.toLowerCase() === family.toLowerCase() && f.status === 'loaded');
    const roles = styles.filter((s) => s.family === family).map((s) => s.name);
    const google = googleFamily(family);
    return { family, share: r1(share), weights, roles, host: faces[0]?.host || (loaded ? 'unknown' : 'system'), google, license: google ? 'open (Google Fonts) — load it from Google Fonts or self-host' : licenseOf(family, faces[0]?.host), substitute: google ? undefined : substituteFor(family) };
  });

  const sizes = [...new Set(styles.map((s) => s.size))].sort((a, b) => a - b);
  return { families, styles, scale: modularScale(sizes, body?.size || 16) };
}

const OPEN = /^(inter|inter display|geist|geist mono|manrope|dm sans|dm mono|dm serif.*|space grotesk|space mono|ibm plex.*|roboto.*|open sans|lato|poppins|montserrat|work sans|figtree|plus jakarta sans|outfit|sora|jetbrains mono|fira.*|source.*|noto.*|instrument sans|instrument serif|fraunces|playfair display|lora|merriweather|syne|archivo.*|bricolage grotesque|onest|hanken grotesk|schibsted grotesk|nunito.*|raleway|rubik|karla|libre.*|eb garamond|cormorant.*|crimson.*|spectral|newsreader|mona sans|hubot sans|public sans|be vietnam pro|urbanist|lexend.*|red hat.*|albert sans|epilogue|unbounded|familjen grotesk|chivo.*|commit mono|martian mono)$/i;
const FREE_NONOPEN = /^(satoshi|general sans|cabinet grotesk|clash display|clash grotesk|switzer|supreme|zodiak|erode|chillax|ranade|sentient|gambarino|boska|author|panchang|tanker|excon|bespoke.*)$/i;

export const baseFamily = (f: string) => f.replace(/\s+(variable|vf|var|web|text|display)$/i, '').trim();

function licenseOf(family: string, host?: string) {
  family = baseFamily(family);
  if (OPEN.test(family) || host === 'google-fonts') return 'open (OFL/Apache) — safe to self-host';
  if (FREE_NONOPEN.test(family) || host === 'fontshare') return 'free (ITF Free Font License, Fontshare) — check terms';
  if (/^(system-ui|-apple-system|blinkmacsystemfont|segoe ui|helvetica|arial|sans-serif|serif|monospace|ui-.*|sf pro.*|georgia|times.*|menlo|monaco|consolas)$/i.test(family)) return 'system';
  return 'likely commercial — do not copy the font files; license it or use the substitute';
}

function substituteFor(family: string): string | undefined {
  family = baseFamily(family);
  if (OPEN.test(family)) return undefined;
  const f = family.toLowerCase();
  const table: [RegExp, string][] = [
    [/söhne|sohne|neue haas|helvetica|aktiv|graphik|suisse int|untitled sans|founders grotesk|sf pro|basis grotesque/, 'Inter'],
    [/circular|cereal|gilroy|product sans|google sans|euclid circular|avenir|futura|brandon/, 'Plus Jakarta Sans'],
    [/gt america|gt walsheim|apercu|calibre|neue montreal|pp neue montreal|abc diatype|diatype|matter/, 'Geist'],
    [/gt super|tiempos|canela|reckless|editorial new|pp editorial|signifier|lyon/, 'Instrument Serif'],
    [/berkeley mono|sf mono|operator mono|söhne mono|gt america mono|abc diatype mono/, 'JetBrains Mono'],
    [/mabry|moderat|national|atlas grotesk|aeonik|termina|right grotesk|everett/, 'Hanken Grotesk'],
  ];
  for (const [re, sub] of table) if (re.test(f)) return sub;
  if (/mono/.test(f)) return 'Geist Mono';
  if (/serif|garamond|caslon|baskerville|didot|bodoni/.test(f)) return 'Newsreader';
  return 'Inter';
}

function modularScale(sizes: number[], base: number) {
  const big = sizes.filter((s) => s >= base);
  if (big.length < 3) return { base, ratio: null as number | null, fit: 0 };
  // ratio that best explains each size as base·r^k for integer k
  let best = { ratio: 1.2, err: Infinity };
  for (let r = 1.067; r <= 1.62; r += 0.001) {
    let err = 0;
    for (const s of big) { const k = Math.round(Math.log(s / base) / Math.log(r)); err += Math.abs(Math.log(s / (base * r ** k))); }
    if (err < best.err) best = { ratio: r, err };
  }
  const named: [number, string][] = [[1.067, 'minor second'], [1.125, 'major second'], [1.2, 'minor third'], [1.25, 'major third'], [1.333, 'perfect fourth'], [1.414, 'augmented fourth'], [1.5, 'perfect fifth'], [1.618, 'golden ratio']];
  const near = named.find(([v]) => Math.abs(v - best.ratio) < 0.012);
  const fit = +(1 - best.err / big.length / 0.05).toFixed(2);
  return { base, ratio: +best.ratio.toFixed(3), name: near?.[1], fit: Math.max(0, fit), sizes };
}

// ---------------------------------------------------------------- spacing, shape, layout

function histogram(values: number[]) {
  const m = new Map<number, number>();
  for (const v of values) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function inferSpacing(ev: Evidence) {
  const vals: number[] = [];
  for (const p of ev.pages) for (const r of visibleRows(p.harvests.desktop)) {
    for (const k of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
      const v = px(r.s[k]);
      if (v > 0 && v <= 320) vals.push(Math.round(v * 2) / 2);
    }
  }
  const hist = histogram(vals);
  const n = vals.length || 1;
  let base = 1;
  const cov = (b: number) => vals.filter((v) => v % b === 0).length / n;
  for (const [b, need] of [[8, 0.85], [4, 0.75], [6, 0.85], [5, 0.85], [2, 0.8]] as [number, number][]) { if (cov(b) >= need) { base = b; break; } }
  const coverage = pct(vals.filter((v) => v % base === 0).length, n);
  const offGrid = hist.filter(([v, c]) => v % base !== 0 && c / n > 0.02).map(([v]) => v);
  const scale = hist.filter(([, c]) => c / n >= 0.005).map(([v]) => v).sort((a, b) => a - b);
  return { base, coverage, coverage4: pct(cov(4) * n, n), coverage8: pct(cov(8) * n, n), offGrid, scale, top: hist.slice(0, 16).map(([value, count]) => ({ value, share: pct(count, n) })), sections: sectionRhythm(ev) };
}

/** Vertical rhythm of page sections: full-width blocks and the padding/gaps between them, per viewport. */
function sectionRhythm(ev: Evidence) {
  const out: Record<string, { paddingY: number[]; median: number; gap: number }> = {};
  for (const vpName of ['desktop', 'tablet', 'mobile']) {
    const pads: number[] = [];
    const gaps: number[] = [];
    for (const p of ev.pages) {
      const h = p.harvests[vpName];
      if (!h) continue;
      const vw = h.viewport[0];
      const sections = h.rows.filter((r) => (r.tag === 'section' || r.tag === 'footer' || (r.tag === 'div' && r.pid >= -1)) && r.box[2] >= vw * 0.9 && r.box[3] >= 160 && r.box[3] < h.docHeight * 0.8);
      // keep the outermost full-width blocks: those whose parent is not itself a kept section
      const ids = new Set(sections.map((s) => s.id));
      const top = sections.filter((s) => !ids.has(s.pid) && s.tag !== 'div' || (s.tag === 'div' && !ids.has(s.pid) && px(s.s.paddingTop) >= 32));
      for (const s of top) { const pt = px(s.s.paddingTop), pb = px(s.s.paddingBottom); if (pt >= 16) pads.push(pt); if (pb >= 16) pads.push(pb); }
      const sorted = top.sort((a, b) => a.box[1] - b.box[1]);
      for (let i = 1; i < sorted.length; i++) { const g = sorted[i].box[1] - (sorted[i - 1].box[1] + sorted[i - 1].box[3]); if (g > 0 && g < 400) gaps.push(g); }
    }
    if (!pads.length) continue;
    pads.sort((a, b) => a - b);
    gaps.sort((a, b) => a - b);
    out[vpName] = { paddingY: histogram(pads).slice(0, 5).map(([v]) => v), median: pads[pads.length >> 1], gap: gaps.length ? gaps[gaps.length >> 1] : 0 };
  }
  return out;
}

export function inferShape(ev: Evidence) {
  const radii: number[] = [], borders: string[] = [], shadows: Map<string, { count: number; tags: Set<string> }> = new Map(), blurs: string[] = [];
  const radiusTags = new Map<string, Set<string>>();
  for (const p of ev.pages) for (const r of visibleRows(p.harvests.desktop)) {
    const s = r.s;
    const rad = px(s.borderTopLeftRadius);
    const paints = (parseColor(s.backgroundColor)?.a || 0) > 0.02 || px(s.borderTopWidth) > 0 || s.boxShadow !== 'none' || r.tag === 'img' || r.tag === 'video';
    if (paints && rad > 0) {
      const v = rad >= Math.min(r.box[2], r.box[3]) / 2 - 0.5 ? 9999 : r1(rad);
      radii.push(v);
      const k = String(v); if (!radiusTags.has(k)) radiusTags.set(k, new Set()); radiusTags.get(k)!.add(r.tag === 'a' || r.tag === 'button' ? 'button' : r.tag === 'img' || r.tag === 'video' ? 'media' : r.box[3] < 40 ? 'small' : 'surface');
    }
    for (const side of ['Top', 'Bottom', 'Left', 'Right']) {
      const bw = px(s[`border${side}Width`]);
      if (bw > 0 && s.borderTopStyle !== 'none') { const c = parseColor(s[`border${side}Color`]); if (c && c.a > 0.02) borders.push(`${bw}px ${s.borderTopStyle} ${rgbaCss(c)}`); }
    }
    if (s.boxShadow && s.boxShadow !== 'none') { const v = normalizeColors(s.boxShadow); const e = shadows.get(v) || { count: 0, tags: new Set() }; e.count++; e.tags.add(r.tag); shadows.set(v, e); }
    if (s.backdropFilter && s.backdropFilter !== 'none') blurs.push(s.backdropFilter);
  }
  const rh = histogram(radii);
  // the radius a viewer reads as "the" surface radius: area-weighted over large painted surfaces
  const surf: [number, number][] = [];
  for (const p of ev.pages) for (const r of visibleRows(p.harvests.desktop)) {
    const area = r.box[2] * r.box[3], rad = px(r.s.borderTopLeftRadius);
    const paints = (parseColor(r.s.backgroundColor)?.a || 0) > 0.02 || px(r.s.borderTopWidth) > 0 || r.s.boxShadow !== 'none';
    // cards and panels, not page-wide bands (those are square by nature and would drown every card)
    if (paints && area > 20000 && r.box[2] < p.harvests.desktop.viewport[0] * 0.9 && rad < Math.min(r.box[2], r.box[3]) / 2 - 0.5) surf.push([rad, area]);
  }
  surf.sort((a, b) => a[0] - b[0]);
  const half = surf.reduce((t, x) => t + x[1], 0) / 2;
  let acc = 0, surfaceRadius = 0;
  for (const [rad, a] of surf) { acc += a; if (acc >= half) { surfaceRadius = r1(rad); break; } }
  return {
    surfaceRadius,
    radii: rh.filter(([, c], i) => i < 3 || c >= 3).slice(0, 8).map(([value, count]) => ({ value, css: value === 9999 ? '9999px' : `${value}px`, count, on: [...(radiusTags.get(String(value)) || [])] })),
    borders: histogram(borders as any).slice(0, 8).map(([value, count]) => ({ value: value as unknown as string, count })),
    shadows: [...shadows.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 8).map(([value, e]) => ({ value, count: e.count, on: [...e.tags].slice(0, 5) })),
    backdrop: histogram(blurs as any).slice(0, 4).map(([value, count]) => ({ value: value as unknown as string, count })),
  };
}

export function inferLayout(ev: Evidence) {
  const out: any = { containers: {}, gutters: {}, grids: [], breakpoints: [] };
  for (const vpName of ['desktop', 'tablet', 'mobile']) {
    const widths: number[] = [], gut: number[] = [];
    for (const p of ev.pages) {
      const h = p.harvests[vpName];
      if (!h) continue;
      const vw = h.viewport[0];
      for (const r of h.rows) {
        const [x, , w, hh] = r.box;
        if (hh < 40 || w < 200) continue;
        const centered = Math.abs(x - (vw - (x + w))) <= 2;
        if (centered && w < vw - 8 && (r.s.maxWidth !== 'none' || r.s.marginLeft === r.s.marginRight && px(r.s.marginLeft) > 0)) widths.push(Math.round(w));
        if (w >= vw - 1 && px(r.s.paddingLeft) > 0 && px(r.s.paddingLeft) === px(r.s.paddingRight)) gut.push(px(r.s.paddingLeft));
        if (centered && w < vw && w >= vw - 120) gut.push(Math.round(x));
      }
    }
    out.containers[vpName] = histogram(widths).slice(0, 4).map(([value, count]) => ({ value, count }));
    // the content edge: where left-aligned text actually starts, weighted by how much text starts there
    const lefts = new Map<number, number>();
    for (const p of ev.pages) { const hh = p.harvests[vpName]; if (!hh) continue; for (const r of hh.rows) { const cx = r.box[0] + r.box[2] / 2; if (r.chars > 20 && r.box[0] > 0 && r.box[0] < hh.viewport[0] / 3 && r.s.textAlign !== 'center' && Math.abs(cx - hh.viewport[0] / 2) > 24) lefts.set(Math.round(r.box[0]), (lefts.get(Math.round(r.box[0])) || 0) + r.chars); } }
    // a narrow centred column inside the container also starts text further in; the container edge is the
    // outermost one that carries a comparable amount of text
    const ranked = [...lefts.entries()].sort((a, b) => b[1] - a[1]);
    const edge = ranked.filter(([, n]) => n >= (ranked[0]?.[1] ?? 0) * 0.5).sort((a, b) => a[0] - b[0])[0]?.[0];
    const vwv = ev.pages[0].harvests[vpName]?.viewport[0];
    if (edge !== undefined && vwv) { out.contentEdge = out.contentEdge || {}; out.contentEdge[vpName] = { left: edge, width: vwv - 2 * edge }; }
    out.gutters[vpName] = histogram(gut).slice(0, 3).map(([value]) => value)[0] ?? null;
  }
  const grids = new Map<string, number>();
  for (const p of ev.pages) for (const r of visibleRows(p.harvests.desktop)) {
    if (r.s.display === 'grid' && r.s.gridTemplateColumns && r.s.gridTemplateColumns !== 'none') {
      const cols = r.s.gridTemplateColumns.split(' ').filter((t) => /px$/.test(t)).length;
      if (cols >= 2) { const k = `${cols} cols, gap ${r.s.columnGap}`; grids.set(k, (grids.get(k) || 0) + 1); }
    } else if (r.s.display === 'flex' && r.s.flexDirection === 'row' && r.kids >= 3 && r.box[2] > 500) {
      const kids = p.harvests.desktop.rows.filter((k) => k.pid === r.id);
      const ws = kids.map((k) => k.box[2]);
      if (kids.length >= 3 && Math.max(...ws) - Math.min(...ws) < 4) { const k = `${kids.length} equal flex columns, gap ${r.s.columnGap}`; grids.set(k, (grids.get(k) || 0) + 1); }
    }
  }
  out.grids = [...grids.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([pattern, count]) => ({ pattern, count }));
  out.breakpoints = ev.css.breakpoints.filter((b) => b.value >= 320 && b.value <= 2000).slice(0, 8);
  // density: share of the first screen covered by text, and how many words a section carries
  const h = ev.pages[0].harvests.desktop;
  const fold = h.rows.filter((r) => r.box[1] < h.viewport[1] && r.chars > 0);
  const textArea = fold.reduce((s, r) => s + Math.min(r.box[2] * r.box[3], h.viewport[0] * 200), 0);
  out.density = { firstScreenTextCoverage: pct(textArea, h.viewport[0] * h.viewport[1]), firstScreenWords: fold.reduce((s, r) => s + r.text.split(/\s+/).filter(Boolean).length, 0), pageHeightScreens: r1(h.docHeight / h.viewport[1]) };
  return out;
}
