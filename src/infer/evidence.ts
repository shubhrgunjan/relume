// Load a catalogue entry's raw evidence and parse its stylesheets into the authored facts computed styles lose:
// custom properties per scope (light/dark), @font-face sources, @media breakpoints, @keyframes.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postcss from 'postcss';
import { readGz, readJson } from '../catalog/catalog.js';

export interface Row {
  id: number; pid: number; tag: string; box: [number, number, number, number]; chars: number; text: string;
  href?: string; type?: string; role?: string; aria?: string; cls: string; kids: number;
  s: Record<string, string>;
  media?: { src: string; nw: number; nh: number; autoplay?: boolean; loop?: boolean };
  canvas?: { ctx: string; w: number; h: number };
  svg?: { viewBox: string | null; paths: number; strokeW: string; fillAttr: string | null; strokeAttr: string | null };
  before?: Record<string, string>; after?: Record<string, string>;
}
export interface Harvest {
  url: string; title: string; viewport: [number, number]; docHeight: number;
  body: { backgroundColor: string; htmlBackground: string; color: string; fontFamily: string };
  rootVars: Record<string, string>; fonts: { family: string; weight: string; style: string; status: string }[];
  rows: Row[];
}
export interface Motion {
  marks: { t: number; label: string; scrollY: number }[];
  elements: { tag: string; cls: string; text: string }[];
  tracks: { id: number; why: string; samples: any[][] }[];
  anims: Anim[];
  scroll: [number, number, number][];
  wheel: [number, number][];
  hovers: { id: number; before: Record<string, string> | null; during: Record<string, string> | null; focus?: Record<string, string> | null }[];
  texts?: any[][];
  libraries: Record<string, any>;
}
export interface Anim {
  t: number; kind: string; name: string; target: number; pseudo?: string; props: string[];
  keyframes: Record<string, any>[]; delay: number; duration: number; easing: string; iterations: number;
  direction?: string; fill?: string; timeline?: string;
}
export interface PageEvidence {
  key: string; url: string; dir: string;
  harvests: Record<string, Harvest>; // desktop, tablet, mobile, desktop-dark
  motion?: Motion;
}
export interface CssFacts {
  vars: { name: string; value: string; scope: 'root' | 'dark' | 'other'; selector: string }[];
  fontFaces: { family: string; weight: string; style: string; src: string; host: string }[];
  breakpoints: { value: number; kind: 'min' | 'max'; count: number }[];
  keyframes: Record<string, string>;
  darkStrategy: 'media' | 'class' | 'none';
}
export interface Evidence {
  slug: string; dir: string; home: string; pages: PageEvidence[]; css: CssFacts;
}

export function loadEvidence(dir: string, slug: string): Evidence {
  const crawl = readJson(join(dir, 'crawl.json'));
  const pages: PageEvidence[] = [];
  const cssTexts: { url: string; text: string }[] = [];
  const seenSheets = new Set<string>();
  const seenPages = new Set<string>();
  for (const p of crawl.pages) {
    if (!p.ok) continue;
    const pdir = join(dir, 'pages', p.key);
    if (!existsSync(pdir)) continue;
    const harvests: Record<string, Harvest> = {};
    for (const f of readdirSync(pdir)) {
      const m = f.match(/^harvest-(.+)\.json\.gz$/);
      if (m) harvests[m[1]] = readGz(join(pdir, f));
    }
    if (!harvests.desktop) continue;
    // the same document reached by two URLs (/, /homepage) would double-count everything
    const sig = harvests.desktop.title + '|' + harvests.desktop.rows.length + '|' + harvests.desktop.docHeight;
    if (seenPages.has(sig)) continue;
    seenPages.add(sig);
    const motion = existsSync(join(pdir, 'motion.json.gz')) ? readGz<Motion>(join(pdir, 'motion.json.gz')) : undefined;
    if (existsSync(join(pdir, 'css.json.gz'))) {
      for (const s of readGz<{ url: string; text: string }[]>(join(pdir, 'css.json.gz'))) {
        const k = s.url || s.text.slice(0, 500);
        if (seenSheets.has(k)) continue;
        seenSheets.add(k);
        cssTexts.push(s);
      }
    }
    pages.push({ key: p.key, url: p.url, dir: pdir, harvests, motion });
  }
  return { slug, dir, home: crawl.home, pages, css: parseCss(cssTexts) };
}

function parseCss(sheets: { url: string; text: string }[]): CssFacts {
  const vars: CssFacts['vars'] = [];
  const fontFaces: CssFacts['fontFaces'] = [];
  const bp = new Map<string, number>();
  const keyframes: Record<string, string> = {};
  let darkMedia = 0, darkClass = 0;
  for (const sheet of sheets) {
    let root: postcss.Root;
    try { root = postcss.parse(sheet.text); } catch { continue; }
    root.walkAtRules((at) => {
      if (at.name === 'media') {
        for (const m of at.params.matchAll(/(min|max)-width\s*:\s*([\d.]+)(px|em|rem)/g)) {
          const v = parseFloat(m[2]) * (m[3] === 'px' ? 1 : 16);
          const k = `${m[1]}:${Math.round(v)}`;
          bp.set(k, (bp.get(k) || 0) + 1);
        }
        for (const m of at.params.matchAll(/width\s*(>=|<=|>|<)\s*([\d.]+)(px|em|rem)/g)) {
          const v = parseFloat(m[2]) * (m[3] === 'px' ? 1 : 16);
          const k = `${m[1].startsWith('>') ? 'min' : 'max'}:${Math.round(v)}`;
          bp.set(k, (bp.get(k) || 0) + 1);
        }
      } else if (at.name === 'font-face') {
        const d: Record<string, string> = {};
        at.walkDecls((decl) => { d[decl.prop] = decl.value; });
        const fam = (d['font-family'] || '').replace(/["']/g, '').trim();
        const src = d['src'] || '';
        const url = src.match(/url\(["']?([^"')]+)/)?.[1] || '';
        let host = 'self-hosted';
        if (/fonts\.gstatic\.com|fonts\.googleapis/.test(src)) host = 'google-fonts';
        else if (/typekit|use\.adobe/.test(src)) host = 'adobe-fonts';
        else if (/fontshare/.test(src)) host = 'fontshare';
        else if (/cloud\.typography|hco\.com/.test(src)) host = 'hoefler';
        else if (/fonts\.com|monotype/.test(src)) host = 'monotype';
        else if (/framerusercontent|framer\.com/.test(src)) host = 'framer';
        if (fam) fontFaces.push({ family: fam, weight: d['font-weight'] || '400', style: d['font-style'] || 'normal', src: url.slice(0, 200), host });
      } else if (/keyframes$/.test(at.name)) {
        if (Object.keys(keyframes).length < 300) keyframes[at.params] = at.nodes?.map((n) => n.toString()).join(' ').replace(/\s+/g, ' ').slice(0, 600) || '';
      }
    });
    root.walkRules((rule) => {
      const parentMedia = rule.parent?.type === 'atrule' ? (rule.parent as postcss.AtRule).params : '';
      const isDarkMedia = /prefers-color-scheme\s*:\s*dark/.test(parentMedia);
      const isDarkSel = /(\.dark\b|\[data-theme=["']?dark|\[data-mode=["']?dark|\.theme-dark|\[class~=["']?dark)/.test(rule.selector);
      const isRoot = /^(:root|html|:host|body)(\s*,\s*(:root|html|:host|body))*$/.test(rule.selector.trim());
      rule.walkDecls(/^--/, (decl) => {
        if (vars.length > 20000) return;
        const scope = isDarkMedia || isDarkSel ? 'dark' : isRoot && !parentMedia ? 'root' : 'other';
        if (scope === 'dark') { if (isDarkMedia) darkMedia++; else darkClass++; }
        vars.push({ name: decl.prop, value: decl.value.trim().slice(0, 200), scope, selector: rule.selector.slice(0, 80) });
      });
    });
  }
  const breakpoints = [...bp.entries()].map(([k, count]) => ({ kind: k.split(':')[0] as 'min' | 'max', value: +k.split(':')[1], count })).sort((a, b) => b.count - a.count);
  return { vars, fontFaces, breakpoints, keyframes, darkStrategy: darkMedia > darkClass ? 'media' : darkClass > 0 ? 'class' : 'none' };
}

/** Rows that are actually visible at their harvest (non-zero box, opacity above zero along the way). */
export function visibleRows(h: Harvest) {
  return h.rows.filter((r) => +r.s.opacity > 0.01 && r.box[2] > 0 && r.box[3] > 0);
}
