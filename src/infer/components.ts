// Components: buttons, links, inputs, cards, badges, navigation, footer, hero — clustered into variants by style
// signature, each with its resting style, hover/focus states and transitions, and a reference crop.
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { parseColor, rgbaCss, contrast, over, normalizeColors, normalizeRadius, colorsIn } from '../lib/csscolor.js';
import { px } from './tokens.js';
import type { Evidence, Row, Harvest } from './evidence.js';
import { visibleRows } from './evidence.js';

export interface ComponentVariant {
  kind: string; name: string; count: number; pages: string[];
  style: Record<string, string>;
  size: { height: number; minWidth: number; paddingX: string; paddingY: string };
  hover?: { changes: Record<string, [string, string]>; transitions: any[]; children: any[] };
  focus?: any;
  samples: string[];
  crop?: string;
  example: { page: string; id: number; box: number[] };
}

const col = (v: string) => { const c = parseColor(v); return c && c.a > 0.02 ? rgbaCss(c) : 'transparent'; };

/** Split a computed list on top-level commas (cubic-bezier(…) keeps its own). */
export function splitList(v: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of v) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Zip computed transition-* lists into a valid shorthand; 'none' when nothing actually transitions. */
export function transitionCss(s: Record<string, string>): string {
  const props = splitList(s.transitionProperty || ''), durs = splitList(s.transitionDuration || ''), fns = splitList(s.transitionTimingFunction || ''), dels = splitList(s.transitionDelay || '');
  const parts: string[] = [];
  props.forEach((p, i) => {
    const d = durs[i % durs.length] || '0s';
    if (parseFloat(d) === 0 || p === 'none') return;
    const del = dels[i % dels.length] || '0s';
    parts.push(`${p} ${d} ${fns[i % fns.length] || 'ease'}${parseFloat(del) ? ' ' + del : ''}`);
  });
  return parts.length ? parts.join(', ') : 'none';
}

function styleOf(r: Row): Record<string, string> {
  const s = r.s;
  const o: Record<string, string> = {
    background: s.backgroundImage !== 'none' && /gradient/.test(s.backgroundImage) ? s.backgroundImage.slice(0, 200) : col(s.backgroundColor),
    color: col(s.color),
    border: px(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none' ? `${s.borderTopWidth} ${s.borderTopStyle} ${col(s.borderTopColor)}` : 'none',
    radius: s.borderTopLeftRadius,
    shadow: s.boxShadow,
    font: `${s.fontWeight} ${s.fontSize}/${s.lineHeight}`,
    family: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    letterSpacing: s.letterSpacing,
    textTransform: s.textTransform,
    padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
    gap: s.columnGap,
    transition: transitionCss(s),
    backdrop: s.backdropFilter,
    cursor: s.cursor,
  };
  if (r.before) o['::before'] = JSON.stringify(r.before).slice(0, 300);
  if (r.after) o['::after'] = JSON.stringify(r.after).slice(0, 300);
  if (o.radius) o.radius = normalizeRadius(o.radius);
  for (const k of ['background', 'border', 'shadow', 'color']) if (o[k]) o[k] = normalizeColors(o[k]);
  for (const k of Object.keys(o)) if (o[k] === 'none' || o[k] === 'normal' || o[k] === 'auto' || o[k] === '0px' || o[k] === 'transparent' && k !== 'background') delete o[k];
  return o;
}

function classify(r: Row, h: Harvest, pageBg: string): string | null {
  const s = r.s;
  const [x, y, w, hh] = r.box;
  const vw = h.viewport[0];
  const bg = parseColor(s.backgroundColor);
  const hasBg = !!bg && bg.a > 0.02 && col(s.backgroundColor) !== pageBg || /gradient/.test(s.backgroundImage);
  const hasBorder = px(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none' || px(s.borderBottomWidth) > 0 && s.borderTopStyle !== 'none';
  const hasShadow = s.boxShadow && s.boxShadow !== 'none';
  const interactive = r.tag === 'a' || r.tag === 'button' || r.role === 'button' || s.cursor === 'pointer';
  if (r.tag === 'header' || (r.tag === 'nav' && y < 120 && w > vw * 0.6)) return 'navbar';
  if (r.tag === 'footer') return 'footer';
  if (/^(input|textarea|select)$/.test(r.tag) && !/^(checkbox|radio|submit|button|hidden|range)$/.test(r.type || '')) return 'input';
  if (interactive && (hasBg || hasBorder || hasShadow) && hh >= 20 && hh <= 80 && w <= 480 && px(s.paddingLeft) >= 4) return 'button';
  if (r.tag === 'a' && !hasBg && !hasBorder && r.chars > 0 && hh < 60) return 'link';
  if (!interactive && (hasBg || hasBorder) && hh <= 34 && hh >= 14 && r.chars > 0 && r.chars <= 28 && px(s.borderTopLeftRadius) >= 3) return 'badge';
  if ((hasBg || hasBorder || hasShadow) && w >= 140 && hh >= 90 && hh < 1200 && w < vw * 0.92) return 'card';
  void x;
  return null;
}

function signature(kind: string, r: Row) {
  const s = r.s;
  const base = [kind, col(s.backgroundColor), s.backgroundImage.slice(0, 40), col(s.color), s.borderTopWidth, col(s.borderTopColor), s.borderTopLeftRadius, s.boxShadow.slice(0, 60)];
  if (kind === 'button' || kind === 'badge' || kind === 'input') base.push(s.fontSize, s.fontWeight);
  if (kind === 'link') return [kind, col(s.color), s.fontSize, s.fontWeight, s.textDecorationLine, s.textTransform].join('|');
  return base.join('|');
}

export async function inferComponents(ev: Evidence, outDir: string, accent?: string) {
  const groups = new Map<string, { kind: string; rows: { r: Row; page: string; h: Harvest }[] }>();
  for (const p of ev.pages) {
    const h = p.harvests.desktop;
    const pageBg = col(h.body.backgroundColor) !== 'transparent' ? col(h.body.backgroundColor) : col(h.body.htmlBackground);
    const rows = visibleRows(h);
    const kids = new Map<number, number>();
    for (const r of rows) kids.set(r.pid, (kids.get(r.pid) || 0) + 1);
    for (const r of rows) {
      const kind = classify(r, h, pageBg);
      if (!kind) continue;
      const sig = signature(kind, r);
      const g = groups.get(sig) || { kind, rows: [] };
      g.rows.push({ r, page: p.key, h });
      groups.set(sig, g);
    }
  }
  // cards must repeat to count as a component; one-off boxes are layout
  const variants: ComponentVariant[] = [];
  const byKind = new Map<string, ComponentVariant[]>();
  for (const g of [...groups.values()].sort((a, b) => b.rows.length - a.rows.length)) {
    if (g.kind === 'card' && g.rows.length < 2) continue;
    if (g.kind === 'link' && g.rows.length < 3) continue;
    if (g.kind === 'navbar' && (byKind.get('navbar')?.length || 0) >= 1) continue;
    const ex = g.rows.find((x) => x.r.box[1] < 20000) || g.rows[0];
    const st = styleOf(ex.r);
    const v: ComponentVariant = {
      kind: g.kind, name: '', count: g.rows.length, pages: [...new Set(g.rows.map((x) => x.page))],
      style: st,
      size: { height: ex.r.box[3], minWidth: Math.min(...g.rows.map((x) => x.r.box[2])), paddingX: ex.r.s.paddingLeft, paddingY: ex.r.s.paddingTop },
      samples: [...new Set(g.rows.map((x) => x.r.text || x.r.aria || '').filter(Boolean))].slice(0, 5),
      example: { page: ex.page, id: ex.r.id, box: ex.r.box },
    };
    (v as any)._ids = g.rows.map((x) => x.page + ':' + x.r.id);
    const list = byKind.get(g.kind) || [];
    if (list.length >= (g.kind === 'card' ? 8 : g.kind === 'link' ? 4 : 6)) continue;
    list.push(v);
    byKind.set(g.kind, list);
  }
  // names: primary = the button filled with the accent (or the strongest fill), secondary/ghost by fill and border
  for (const [kind, list] of byKind) {
    if (kind === 'button') {
      // the primary action wears the brand colour: the filled button nearest the accent, if one is close
      const acc = accent ? parseColor(accent) : null;
      const near = (v: ComponentVariant) => { const c = parseColor(v.style.background); return c && acc && c.a > 0.9 ? Math.hypot(c.r - acc.r, c.g - acc.g, c.b - acc.b) : Infinity; };
      const accentBtn = acc ? [...list].filter((v) => near(v) < 40).sort((a, b) => b.count - a.count)[0] : undefined;
      const filled = list.filter((v) => v.style.background && v.style.background !== 'transparent');
      const pageBg = parseColor(ev.pages[0].harvests.desktop.body.backgroundColor)?.a ? parseColor(ev.pages[0].harvests.desktop.body.backgroundColor)! : parseColor(ev.pages[0].harvests.desktop.body.htmlBackground) || { r: 255, g: 255, b: 255, a: 1 };
      // a gradient fill counts by its first stop; small chips (nav pills, <32px) are not the primary action
      const fillOf = (v: ComponentVariant) => parseColor(v.style.background) || parseColor(colorsIn(v.style.background || '')[0]);
      const strength = (v: ComponentVariant) => { const c = fillOf(v); if (!c) return 0; const k = contrast(c.a < 1 ? over(c, pageBg) : c, pageBg) * Math.min(1, c.a * 2); return k * (v.size.height >= 32 ? 1 : 0.2); };
      const primary = accentBtn && accentBtn.size.height >= 32 ? accentBtn : [...filled].sort((a, b) => strength(b) - strength(a))[0];
      let n = 1;
      for (const v of list) {
        if (v === primary) v.name = 'button-primary';
        else if (v.style.background && v.style.background !== 'transparent') v.name = n === 1 ? 'button-secondary' : `button-secondary-${n}`, n++;
        else if (v.style.border) v.name = 'button-outline';
        else v.name = 'button-ghost';
      }
    }
    const seen = new Map<string, number>();
    for (const v of list) {
      if (!v.name) v.name = kind;
      const c = (seen.get(v.name) || 0) + 1; seen.set(v.name, c);
      if (c > 1) v.name = `${v.name}-${c}`;
      variants.push(v);
    }
  }
  // crops from the full-page desktop shots
  const cropDir = join(outDir, 'components');
  mkdirSync(cropDir, { recursive: true });
  for (const v of variants) {
    const page = ev.pages.find((p) => p.key === v.example.page)!;
    const shot = join(page.dir, 'shot-desktop.jpg');
    if (!existsSync(shot)) continue;
    try {
      const meta = await sharp(shot).metadata();
      const [x, y, w, h] = v.example.box;
      const pad = 16;
      const left = Math.max(0, x - pad), top = Math.max(0, y - pad);
      const width = Math.min(meta.width! - left, w + pad * 2), height = Math.min(meta.height! - top, h + pad * 2, 1400);
      if (width < 8 || height < 8 || top >= meta.height!) continue;
      const file = `${v.name}.jpg`;
      await sharp(shot).extract({ left, top, width, height }).jpeg({ quality: 85 }).toFile(join(cropDir, file));
      v.crop = `components/${file}`;
    } catch {}
  }
  return variants;
}

/** Attach measured hover/focus behaviour to the variants whose elements were hovered. */
export function attachStates(variants: ComponentVariant[], hover: any[]) {
  for (const v of variants) {
    const ids: string[] = (v as any)._ids || [];
    const h = hover.find((x) => ids.includes(x.page + ':' + x.id));
    if (h) {
      if (Object.keys(h.changes).length || h.children.length) v.hover = { changes: h.changes, transitions: h.transitions, children: h.children };
      if (h.focus) v.focus = h.focus;
    }
    delete (v as any)._ids;
  }
  return variants;
}
