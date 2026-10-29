// Composition: the page as an ordered list of sections, each with its layout pattern and what it is made of —
// product UI, illustrations, data visualisation, logos, code, cards, testimonials, text — and how much of the
// screen those take. Tokens say what things look like; this says what a page *is*.
import type { Harvest, Row } from './evidence.js';
import { parseColor, normalizeColors, normalizeRadius, rgbaCss } from '../lib/csscolor.js';

export type ContentKind = 'ui-mock' | 'illustration' | 'dataviz' | 'logos' | 'image' | 'avatar' | 'code' | 'cards' | 'testimonial' | 'tabs' | 'form' | 'video' | '3d-scene' | 'canvas-art';

export interface Block { kind: ContentKind; box: [number, number, number, number]; detail: string; count?: number; crop?: string; palette?: { hex: string; share: number }[]; asset?: { natural?: [number, number]; density?: number; format?: string; render?: string; loop?: boolean }; opacity?: number }
export interface Section {
  index: number; kind: string; box: [number, number, number, number];
  layout: 'hero' | 'split' | 'centered' | 'stacked' | 'grid' | 'columns';
  heading?: { text: string; size: number; weight: number; x: number; width: number };
  copyChars: number; columns: number;
  blocks: Block[];
  visualShare: number;   // share of the section's area covered by non-text visuals
  elements: number;      // painted elements: density
  background?: string;
}
export interface UiGrammar {
  panels: number; fontSizes: [number, number][]; rowHeights: [number, number][]; iconSizes: [number, number][];
  avatar?: number; chips?: { height: number; radius: string; font: string; samples: string[] };
  panelSurface?: { background: string; border: string; radius: string; shadow: string };
  sidebarWidth?: number; textColors: [string, number][]; statusColors: string[];
}
export interface Blueprint {
  pageHeight: number; viewport: [number, number];
  sections: Section[]; ui?: UiGrammar;
  totals: { visualShare: number; elementsPerScreen: number; kinds: Record<string, number> };
}

const px = (v?: string) => (v ? parseFloat(v) || 0 : 0);
const area = (b: number[]) => Math.max(0, b[2]) * Math.max(0, b[3]);
const inside = (a: number[], b: number[]) => a[0] >= b[0] - 2 && a[1] >= b[1] - 2 && a[0] + a[2] <= b[0] + b[2] + 2 && a[1] + a[3] <= b[1] + b[3] + 2;
const mono = (r: Row) => /mono|code|courier|consol/i.test(r.s.fontFamily || '');
const paints = (r: Row) => (parseColor(r.s.backgroundColor)?.a || 0) > 0.02 || px(r.s.borderTopWidth) > 0 || (r.s.boxShadow && r.s.boxShadow !== 'none');

export function blueprint(h: Harvest): Blueprint {
  const vw = h.viewport[0], vh = h.viewport[1];
  const rows = h.rows.filter((r) => r.box[2] > 0 && r.box[3] > 0 && +r.s.opacity > 0.01);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const kids = new Map<number, Row[]>();
  for (const r of rows) { if (!kids.has(r.pid)) kids.set(r.pid, []); kids.get(r.pid)!.push(r); }
  const descendants = (id: number, out: Row[] = []): Row[] => { for (const k of kids.get(id) || []) { out.push(k); descendants(k.id, out); } return out; };

  // ---- sections: descend through wrappers to the first vertical stack of wide blocks that spans the page
  const wide = (r: Row) => r.box[2] >= vw * 0.55 && r.box[3] >= 40;
  function stackOf(parentId: number, depth = 0): Row[] {
    const ch = (kids.get(parentId) || []).filter(wide).sort((a, b) => a.box[1] - b.box[1]);
    const span = ch.reduce((s, r) => s + r.box[3], 0);
    if (ch.length >= 3 && span >= h.docHeight * 0.6) return ch;
    const big = ch.sort((a, b) => b.box[3] - a.box[3])[0];
    if (big && depth < 12) return stackOf(big.id, depth + 1);
    return ch;
  }
  let secs = stackOf(-1);
  // split blocks taller than ~2.4 screens that are themselves stacks (a <main> holding every section)
  for (let pass = 0; pass < 3; pass++) {
    const next: Row[] = [];
    for (const s of secs) {
      const inner = s.box[3] > vh * 2.4 ? (kids.get(s.id) || []).filter(wide).sort((a, b) => a.box[1] - b.box[1]) : [];
      if (inner.length >= 2 && inner.reduce((t, r) => t + r.box[3], 0) >= s.box[3] * 0.6) next.push(...inner); else next.push(s);
    }
    secs = next;
  }
  // a fixed/sticky header is chrome, not a section
  secs = secs.filter((s) => !(/fixed|sticky/.test(s.s.position) && s.box[3] < 120));
  // wide blocks outside the stack (a closing band or footer next to <main>) are sections too
  const covered = (r: Row) => secs.some((s) => Math.min(s.box[1] + s.box[3], r.box[1] + r.box[3]) - Math.max(s.box[1], r.box[1]) > r.box[3] * 0.5);
  const containsSec = (r: Row) => secs.some((s) => inside(s.box, r.box));
  const extra = rows.filter((r) => r.box[2] >= vw * 0.9 && r.box[3] >= 120 && !/fixed|sticky/.test(r.s.position) && r.box[1] >= 0 && !covered(r) && !containsSec(r))
    .sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3]);
  for (const r of extra) if (!covered(r) && !secs.some((s) => inside(r.box, s.box))) secs.push(r);
  secs.sort((a, b) => a.box[1] - b.box[1]);

  const sections: Section[] = secs.map((sec, index) => {
    const all = descendants(sec.id).filter((r) => inside(r.box, sec.box) || r.box[1] < sec.box[1] + sec.box[3]);
    const blocks: Block[] = [];
    const claimed = new Set<number>();
    const claim = (r: Row) => { claimed.add(r.id); for (const d of descendants(r.id)) claimed.add(d.id); };

    // product UI: a painted panel holding many small text rows (≥14 text elements ≤14px) — an app rendered in HTML
    const panels = all.filter((r) => paints(r) && area(r.box) > vw * vh * 0.06).sort((a, b) => area(a.box) - area(b.box));
    for (const p of panels) {
      if (claimed.has(p.id)) continue;
      const d = descendants(p.id);
      const small = d.filter((r) => r.chars > 0 && px(r.s.fontSize) <= 14).length;
      const icons = d.filter((r) => r.svg || r.tag === 'img').length;
      if (small >= 14 && icons >= 3) {
        const rowsInPanel = new Set(d.filter((r) => r.chars > 0).map((r) => Math.round(r.box[1] / 8))).size;
        blocks.push({ kind: 'ui-mock', box: p.box, detail: `${small} UI labels, ${icons} icons, ~${rowsInPanel} rows`, count: small });
        claim(p);
      }
    }
    // code: monospace text spanning several lines
    for (const r of all) {
      if (claimed.has(r.id) || !mono(r)) continue;
      const lines = descendants(r.id).filter((x) => x.chars > 0).length + (r.chars > 0 ? 1 : 0);
      if (lines >= 4 && r.box[3] >= 60) { blocks.push({ kind: 'code', box: r.box, detail: `${lines} mono lines` }); claim(r); }
    }
    // svg: line illustration (many paths, large), data viz (many small marks) or a logo/icon
    const svgs = all.filter((r) => r.svg && !claimed.has(r.id));
    for (const s of svgs) {
      const a = area(s.box), paths = s.svg!.paths;
      if (a > 120 * 120 && paths >= 40) { blocks.push({ kind: paths > 150 && s.box[3] < s.box[2] * 0.9 ? 'dataviz' : 'illustration', box: s.box, detail: `svg, ${paths} shapes, ${s.box[2]}×${s.box[3]}` }); claim(s); }
      else if (a > 100 * 100 && paths >= 6) { blocks.push({ kind: 'illustration', box: s.box, detail: `svg, ${paths} shapes` }); claim(s); }
    }
    for (const c of all.filter((r) => r.tag === 'canvas' && area(r.box) > 120 * 120)) {
      const gl = /webgl/i.test(c.canvas?.ctx || '');
      // a canvas filling much of its section is drawn art (often animated: floating objects, particles), not a chart
      const art = !gl && area(c.box) > area(sec.box) * 0.35;
      blocks.push({ kind: gl ? '3d-scene' : art ? 'canvas-art' : 'dataviz', box: c.box, detail: gl ? `live ${c.canvas!.ctx} canvas ${c.box[2]}×${c.box[3]}` : art ? `drawn canvas ${c.box[2]}×${c.box[3]} behind the content (see its behaviour: what it draws and how it moves)` : `canvas ${c.box[2]}×${c.box[3]}` }); claim(c);
    }
    for (const v of all.filter((r) => r.tag === 'video' && area(r.box) > 160 * 90)) { blocks.push({ kind: 'video', box: v.box, detail: `video ${v.box[2]}×${v.box[3]}`, asset: assetOf(v) }); claim(v); }
    // images: avatars (small, round), logos (row of similar small marks), photos/screens
    const imgs = all.filter((r) => (r.tag === 'img' || r.tag === 'picture') && !claimed.has(r.id));
    // a carousel repeats the same image at the same size and height: report it once, with how many copies
    const seenImg = new Map<string, Block>();
    for (const i of imgs) {
      const key = `${i.box[2]}x${i.box[3]}@${Math.round(i.box[1] / 8)}`;
      const dup = i.box[2] > 64 && seenImg.get(key);
      if (dup) { dup.count = (dup.count || 1) + 1; dup.detail = `${i.box[2]}×${i.box[3]}, ×${dup.count} (carousel/loop)`; claim(i); continue; }
      const round = px(i.s.borderTopLeftRadius) >= Math.min(i.box[2], i.box[3]) / 2 - 1;
      if (i.box[2] <= 64 && i.box[3] <= 64) { if (round || Math.abs(i.box[2] - i.box[3]) < 2) blocks.push({ kind: 'avatar', box: i.box, detail: `${i.box[2]}px` }); }
      else if (area(i.box) > 160 * 100) { const b: Block = { kind: 'image', box: i.box, detail: `${i.box[2]}×${i.box[3]}`, opacity: +i.s.opacity < 0.95 ? +i.s.opacity : undefined, asset: assetOf(i) } as Block; blocks.push(b); seenImg.set(key, b); }
      claim(i);
    }
    // logos: ≥4 small marks (svg/img, 16–64px tall) on one baseline
    const marks = all.filter((r) => (r.svg || r.tag === 'img') && r.box[3] >= 14 && r.box[3] <= 64 && r.box[2] >= 40);
    const lines = new Map<number, Row[]>();
    for (const m of marks) { const k = Math.round((m.box[1] + m.box[3] / 2) / 24); if (!lines.has(k)) lines.set(k, []); lines.get(k)!.push(m); }
    // wordmarks set as text count too: ≥4 short, display-size, unlinked labels on one baseline
    for (const r of all) if (r.chars > 1 && r.chars <= 16 && px(r.s.fontSize) >= 17 && r.tag !== 'a' && !/^h[1-6]$/.test(r.tag) && !claimed.has(r.id)) { const k = Math.round((r.box[1] + r.box[3] / 2) / 24); if (!lines.has(k)) lines.set(k, []); if (!lines.get(k)!.some((m) => Math.abs(m.box[0] - r.box[0]) < 40)) lines.get(k)!.push(r); }
    for (const l of lines.values()) if (l.length >= 4 && Math.max(...l.map((m) => m.box[0] + m.box[2])) - Math.min(...l.map((m) => m.box[0])) > vw * 0.5) {
      const x0 = Math.min(...l.map((m) => m.box[0])), x1 = Math.max(...l.map((m) => m.box[0] + m.box[2])), y0 = Math.min(...l.map((m) => m.box[1])), y1 = Math.max(...l.map((m) => m.box[1] + m.box[3]));
      blocks.push({ kind: 'logos', box: [x0, y0, x1 - x0, y1 - y0], detail: `${l.length} marks in a row`, count: l.length });
    }
    // repeated cards: ≥2 painted siblings of similar size
    const sibs = new Map<number, Row[]>();
    for (const r of all) if (!claimed.has(r.id) && paints(r) && r.box[2] >= 160 && r.box[3] >= 100 && r.box[2] < vw * 0.9) { if (!sibs.has(r.pid)) sibs.set(r.pid, []); sibs.get(r.pid)!.push(r); }
    for (const g of sibs.values()) {
      if (g.length < 2) continue;
      const w = g.map((r) => r.box[2]);
      if (Math.max(...w) - Math.min(...w) > Math.max(...w) * 0.35) continue;
      const hasQuote = g.some((r) => descendants(r.id).some((d) => /[“”"]/.test(d.text) && d.chars > 40));
      const x0 = Math.min(...g.map((r) => r.box[0])), y0 = Math.min(...g.map((r) => r.box[1]));
      blocks.push({ kind: hasQuote ? 'testimonial' : 'cards', box: [x0, y0, Math.max(...g.map((r) => r.box[0] + r.box[2])) - x0, Math.max(...g.map((r) => r.box[1] + r.box[3])) - y0], detail: `${g.length} × ${Math.round(w[0])}×${Math.round(g[0].box[3])}${hasQuote ? ', quotes' : ''}`, count: g.length });
      for (const r of g) claim(r);
    }
    // testimonials: a painted surface carrying a long quotation, whatever its neighbours look like
    for (const r of all) {
      if (claimed.has(r.id) || !paints(r) || r.box[2] < 240 || r.box[3] < 140) continue;
      const d = descendants(r.id);
      // a testimonial is a quotation set large (≥18px), not a chat message beside an avatar
      const big = d.filter((x) => x.chars > 50 && px(x.s.fontSize) >= 18);
      const quote = big.some((x) => /^[“"]/.test(x.text) || /[”"]$/.test(x.text)) || (big.length >= 1 && d.some((x) => (x.tag === 'img' || x.svg) && x.box[2] <= 64 && Math.abs(x.box[2] - x.box[3]) < 2) && d.some((x) => x.chars > 3 && x.chars < 40 && px(x.s.fontSize) <= 15));
      if (quote && d.length < 40) { blocks.push({ kind: 'testimonial', box: r.box, detail: `quote card ${r.box[2]}×${r.box[3]}, ${r.s.backgroundColor}` }); claim(r); }
    }
    // agent / app panels too small to be a full product UI still are UI, not cards
    for (const p of panels) {
      if (claimed.has(p.id)) continue;
      const d = descendants(p.id);
      const small = d.filter((r) => r.chars > 0 && px(r.s.fontSize) <= 14).length;
      if (small >= 6 && d.some((r) => r.svg || r.tag === 'img') && area(p.box) > 300 * 160) { blocks.push({ kind: 'ui-mock', box: p.box, detail: `${small} UI labels (panel)`, count: small }); claim(p); }
    }
    // tab / sub-feature rows: ≥3 short links side by side or stacked, small type
    const shortLinks = all.filter((r) => (r.tag === 'a' || r.tag === 'button') && r.chars > 0 && r.chars < 32 && px(r.s.fontSize) <= 15 && !claimed.has(r.id));
    if (shortLinks.length >= 4 && index > 0) {
      const y0 = Math.min(...shortLinks.map((r) => r.box[1]));
      if (y0 > sec.box[1] + sec.box[3] * 0.5) blocks.push({ kind: 'tabs', box: [sec.box[0], y0, sec.box[2], sec.box[1] + sec.box[3] - y0], detail: `${shortLinks.length} sub-feature links`, count: shortLinks.length });
    }
    // a field is the designed thing around the <input>: its pill, border, shadow, icon and button, with the
    // placeholder it shows. A prominent one (hero search) is often the site's signature control
    const fields = all.filter((r) => (r.tag === 'input' || r.tag === 'textarea' || r.role === 'searchbox' || r.role === 'combobox') && r.box[2] >= 100 && r.type !== 'hidden' && r.type !== 'checkbox' && r.type !== 'radio');
    const shown = new Set<number>();
    for (const f of fields) {
      let shell: Row = f;
      for (let p = f.pid, k = 0; p >= 0 && k < 5; k++) {
        const a = byId.get(p); if (!a) break;
        const styled = (parseColor(a.s.backgroundColor)?.a ?? 0) > 0.02 || px(a.s.borderTopWidth) > 0 || (a.s.boxShadow && a.s.boxShadow !== 'none') || /gradient/.test(a.s.backgroundImage || '');
        if (a.box[2] > f.box[2] * 1.8 + 240 || a.box[3] > f.box[3] * 3 + 48) break;
        if (styled) { shell = a; break; }
        p = a.pid;
      }
      if (shown.has(shell.id)) continue;
      shown.add(shell.id);
      const inner = descendants(shell.id);
      const icon = inner.some((d) => d.svg || (d.tag === 'img' && d.box[2] <= 32));
      const button = inner.find((d) => (d.tag === 'button' || d.tag === 'a') && d !== f);
      const ph = f.ph || inner.filter((d) => d.chars > 0 && d.tag !== 'button').map((d) => d.text).join(' ').slice(0, 60);
      const st = shell.s;
      const bits = [`${shell.box[2]}×${shell.box[3]}`, `radius ${normalizeRadius(st.borderTopLeftRadius)}`, (parseColor(st.backgroundColor)?.a ?? 0) > 0.02 ? `background ${normalizeColors(st.backgroundColor)}` : '', px(st.borderTopWidth) ? `border ${st.borderTopWidth} ${normalizeColors(st.borderTopColor)}` : '', st.boxShadow && st.boxShadow !== 'none' ? `shadow ${normalizeColors(st.boxShadow).slice(0, 90)}` : '', `text ${f.s.fontSize}`, icon ? 'with an icon' : '', button ? `button “${(button.text || button.aria || '').slice(0, 20)}”` : '', ph ? `placeholder “${ph}”` : ''].filter(Boolean);
      const big = shell.box[2] >= 320 && index === 0;
      blocks.push({ kind: 'form', box: shell.box, detail: `${big ? 'signature search/input field' : f.tag === 'textarea' ? 'text area' : 'input field'}: ${bits.join(', ')}` });
    }

    // heading, copy and layout pattern
    const texts = all.filter((r) => r.chars > 0 && !claimed.has(r.id));
    const head = [...texts].sort((a, b) => px(b.s.fontSize) - px(a.s.fontSize))[0];
    const copyChars = texts.reduce((s, r) => s + r.chars, 0);
    const headRow = head && px(head.s.fontSize) >= 24 ? head : undefined;
    const paras = texts.filter((r) => r !== headRow && r.chars > 60);
    let layout: Section['layout'] = 'stacked';
    const cx = (r: Row) => r.box[0] + r.box[2] / 2;
    if (index === 0) layout = 'hero';
    else if (headRow && paras.some((p) => p.box[0] > headRow.box[0] + headRow.box[2] * 0.6 && Math.abs(p.box[1] - headRow.box[1]) < 160)) layout = 'split';
    else if (headRow && Math.abs(cx(headRow) - vw / 2) < vw * 0.06 && headRow.s.textAlign === 'center') layout = 'centered';
    const colsGuess = Math.max(1, ...blocks.filter((b) => b.kind === 'cards' || b.kind === 'testimonial').map((b) => b.count || 1), new Set(blocks.filter((b) => b.kind === 'illustration').map((b) => Math.round(b.box[1] / 80))).size === 1 ? blocks.filter((b) => b.kind === 'illustration').length : 1);
    if (layout === 'stacked' && colsGuess >= 3) layout = 'columns';
    // union of visual blocks on a 16px grid, clipped to the section: overlapping panels count once
    const occ = new Set<number>();
    const [sx, sy, sw, sh] = sec.box;
    for (const b of blocks) {
      if (['tabs', 'form', 'cards', 'testimonial', 'avatar'].includes(b.kind)) continue;
      const x0 = Math.max(0, Math.floor(b.box[0] / 16)), x1 = Math.min(Math.ceil(vw / 16), Math.ceil((b.box[0] + b.box[2]) / 16));
      const y0 = Math.max(Math.floor(sy / 16), Math.floor(b.box[1] / 16)), y1 = Math.min(Math.ceil((sy + sh) / 16), Math.ceil((b.box[1] + b.box[3]) / 16));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) occ.add(y * 1000 + x);
    }
    const visualArea = occ.size * 256;
    void sw; void sx;
    const bg = parseColor(sec.s.backgroundColor);
    const footer = sec.tag === 'footer' || index === secs.length - 1 && texts.filter((r) => r.tag === 'a').length >= 12;
    const kinds = new Set(blocks.map((b) => b.kind));
    const kind = footer ? 'footer'
      : index === 0 ? (kinds.has('ui-mock') ? 'hero + product UI' : kinds.has('illustration') || kinds.has('image') ? 'hero + visual' : 'hero')
      : kinds.has('logos') && copyChars < 200 ? 'logo strip'
      : kinds.has('testimonial') ? 'testimonials'
      : kinds.has('ui-mock') && layout === 'split' ? 'feature: split intro + product UI'
      : kinds.has('ui-mock') ? 'product UI showcase'
      : kinds.has('code') ? 'code'
      : (kinds.has('illustration') && colsGuess >= 3) ? 'feature trio with illustrations'
      : kinds.has('cards') ? 'card row'
      : kinds.has('dataviz') ? 'data visualisation'
      : headRow && px(headRow.s.fontSize) >= 30 && copyChars < 400 && !blocks.length ? (texts.some((r) => r.tag === 'a' || r.tag === 'button') ? 'call to action' : 'statement')
      : 'content';
    return {
      index, kind, box: sec.box, layout,
      heading: headRow ? { text: headRow.text.slice(0, 80), size: px(headRow.s.fontSize), weight: +headRow.s.fontWeight, x: headRow.box[0], width: headRow.box[2] } : undefined,
      copyChars, columns: colsGuess, blocks,
      visualShare: Math.round(Math.min(1, visualArea / Math.max(1, area(sec.box))) * 100) / 100,
      elements: all.filter((r) => r.chars > 0 || r.svg || paints(r)).length,
      background: bg && bg.a > 0.02 ? sec.s.backgroundColor : undefined,
    };
  });

  const ui = uiGrammar(sections.flatMap((s) => s.blocks.filter((b) => b.kind === 'ui-mock')), rows, descendants);
  const totalArea = sections.reduce((s, x) => s + area(x.box), 0) || 1;
  const kindsCount: Record<string, number> = {};
  for (const s of sections) for (const b of s.blocks) kindsCount[b.kind] = (kindsCount[b.kind] || 0) + 1;
  return {
    pageHeight: h.docHeight, viewport: [vw, vh], sections, ui,
    totals: {
      visualShare: Math.round(sections.reduce((s, x) => s + x.visualShare * area(x.box), 0) / totalArea * 100) / 100,
      elementsPerScreen: Math.round(sections.reduce((s, x) => s + x.elements, 0) / Math.max(1, h.docHeight / vh)),
      kinds: kindsCount,
    },
  };
}

const top = <K,>(m: Map<K, number>, n = 6) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
function uiGrammar(panels: Block[], rows: Row[], _desc: (id: number) => Row[]): UiGrammar | undefined {
  if (!panels.length) return undefined;
  const inPanel = rows.filter((r) => panels.some((p) => inside(r.box, p.box)));
  const fs = new Map<number, number>(), rh = new Map<number, number>(), ic = new Map<number, number>(), tc = new Map<string, number>();
  for (const r of inPanel) {
    if (r.chars > 0) { fs.set(px(r.s.fontSize), (fs.get(px(r.s.fontSize)) || 0) + 1); tc.set(r.s.color, (tc.get(r.s.color) || 0) + 1); }
    if (r.svg && r.box[2] <= 24 && r.box[3] <= 24) ic.set(Math.round(r.box[2]), (ic.get(Math.round(r.box[2])) || 0) + 1);
    // list rows: painted or flex rows 24–56px tall, wider than half their panel
    if (r.s.display === 'flex' && r.box[3] >= 24 && r.box[3] <= 56 && r.box[2] >= 160) rh.set(Math.round(r.box[3]), (rh.get(Math.round(r.box[3])) || 0) + 1);
  }
  const avatars = inPanel.filter((r) => (r.tag === 'img' || r.svg) && r.box[2] <= 32 && Math.abs(r.box[2] - r.box[3]) < 1 && px(r.s.borderTopLeftRadius) >= r.box[2] / 2 - 1);
  const chipRows = inPanel.filter((r) => paints(r) && r.chars > 0 && r.chars <= 20 && r.box[3] >= 14 && r.box[3] <= 28);
  const chip = chipRows[0];
  const biggest = panels.sort((a, b) => area(b.box) - area(a.box))[0];
  const surf = rows.find((r) => r.box[0] === biggest.box[0] && r.box[1] === biggest.box[1] && r.box[2] === biggest.box[2]);
  const side = inPanel.filter((r) => Math.abs(r.box[0] - biggest.box[0]) < 4 && r.box[3] > biggest.box[3] * 0.7 && r.box[2] < 300 && r.box[2] > 140)[0];
  // status colours: chromatic fills/strokes/colours on small icons and dots inside the UI, by frequency
  const sc = new Map<string, number>();
  for (const r of inPanel) {
    if (!(r.svg || (r.box[2] <= 16 && r.box[3] <= 16))) continue;
    for (const c of [r.s.color, r.s.fill, r.s.stroke, r.s.backgroundColor]) {
      const p = parseColor(c); if (!p || p.a < 0.6) continue;
      const mx = Math.max(p.r, p.g, p.b), mn = Math.min(p.r, p.g, p.b);
      if (mx - mn > 60) { const k = `#${[p.r, p.g, p.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`; sc.set(k, (sc.get(k) || 0) + 1); }
    }
  }
  const status = top(sc, 8).map(([c]) => c);
  return {
    panels: panels.length, fontSizes: top(fs), rowHeights: top(rh), iconSizes: top(ic, 4),
    avatar: avatars.length ? Math.round(avatars[0].box[2]) : undefined,
    chips: chip ? { height: chip.box[3], radius: normalizeRadius(chip.s.borderTopLeftRadius), font: `${chip.s.fontWeight} ${chip.s.fontSize}`, samples: chipRows.slice(0, 6).map((c) => c.text) } : undefined,
    panelSurface: surf ? { background: normalizeColors(surf.s.backgroundColor), border: normalizeColors(`${surf.s.borderTopWidth} ${surf.s.borderTopColor}`), radius: normalizeRadius(surf.s.borderTopLeftRadius), shadow: normalizeColors(surf.s.boxShadow) } : undefined,
    sidebarWidth: side?.box[2], textColors: top(tc, 5).map(([c, n]) => { const p = parseColor(c); return [p ? rgbaCss(p) : c, n] as [string, number]; }), statusColors: status,
  };
}

/** The quality bar of a media asset: its own pixel size, how dense it is on screen, the file format. */
function assetOf(r: Row): Block['asset'] {
  const m = r.media;
  if (!m) return undefined;
  const src = decodeURIComponent(m.src || '');
  const file = (src.match(/url=([^&]+)/)?.[1] || src).split('?')[0];
  const format = file.match(/\.(avif|webp|png|jpe?g|gif|svg|mp4|webm|mov)$/i)?.[1]?.toLowerCase();
  return { natural: m.nw && m.nh ? [m.nw, m.nh] : undefined, density: m.nw && r.box[2] ? +(m.nw / r.box[2]).toFixed(2) : undefined, format, loop: m.loop || undefined };
}
