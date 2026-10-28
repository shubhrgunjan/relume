// Assemble an entry's design DNA from its evidence and write dna.json.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEvidence } from './evidence.js';
import { inferColors, inferTypography, inferSpacing, inferShape, inferLayout } from './tokens.js';
import { inferComponents, attachStates } from './components.js';
import { inferMotion } from './motion.js';
import { blueprint } from './sections.js';
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { parseColor, contrast } from '../lib/csscolor.js';
import { rgbToLab } from '../lib/color.js';
import { readJson } from '../catalog/catalog.js';

export type DNA = Awaited<ReturnType<typeof buildDna>>;

export async function buildDna(dir: string, slug: string) {
  const ev = loadEvidence(dir, slug);
  if (!ev.pages.length) throw new Error('no usable pages in ' + dir);
  const crawl = readJson(join(dir, 'crawl.json'));
  const color = inferColors(ev);
  const typography = inferTypography(ev);
  const spacing = inferSpacing(ev);
  const shape = inferShape(ev);
  const layout = inferLayout(ev);
  const motion = inferMotion(ev);
  const accent = color.tokens.find((t) => t.role === 'accent')?.value;
  const components = attachStates(await inferComponents(ev, dir, accent), motion.hover);
  // composition: every page as an ordered blueprint of sections, with a crop of each for the skill
  const composition = { pages: [] as any[] };
  mkdirSync(join(dir, 'sections'), { recursive: true });
  for (const p of ev.pages) {
    const bp = blueprint(p.harvests.desktop);
    const shot = join(p.dir, 'shot-desktop.jpg');
    if (existsSync(shot)) {
      const meta = await sharp(shot).metadata();
      for (const s of bp.sections) {
        const top = Math.max(0, Math.round(s.box[1])), height = Math.min(Math.round(s.box[3]), (meta.height || 0) - top, 1800);
        if (height < 24 || top >= (meta.height || 0)) continue;
        const file = `sections/${p.key}-${String(s.index).padStart(2, '0')}.jpg`;
        try { await sharp(shot).extract({ left: 0, top, width: meta.width!, height }).resize({ width: 960 }).jpeg({ quality: 78 }).toFile(join(dir, file)); (s as any).crop = file; } catch {}
      }
    }
    composition.pages.push({ key: p.key, url: p.url, ...bp });
  }
  const feel = feelOf({ color, typography, spacing, shape, layout, motion });
  const dna = {
    version: 1,
    source: { url: ev.home, slug, crawledAt: crawl.at, pages: ev.pages.map((p) => ({ key: p.key, url: p.url, title: p.harvests.desktop.title })), viewports: Object.keys(ev.pages[0].harvests) },
    color, typography, spacing, shape, layout, components, motion, composition, feel,
  };
  writeFileSync(join(dir, 'dna.json'), JSON.stringify(dna, null, 1));
  return dna;
}

/** Measured "feel" — numbers first, then plain-language notes derived from them (no model guesses). */
function feelOf(d: any) {
  const tok = (role: string) => d.color.tokens.find((t: any) => t.role === role);
  const bg = parseColor(tok('background')?.value), fg = parseColor(tok('text')?.value);
  const cr = bg && fg ? +contrast(bg, fg).toFixed(1) : null;
  const chromatic = d.color.tokens.filter((t: any) => { const c = parseColor(t.value); if (!c) return false; const l = rgbToLab(Math.round(c.r), Math.round(c.g), Math.round(c.b)); return Math.hypot(l[1], l[2]) > 18; });
  const chromaShare = +chromatic.reduce((s: number, t: any) => s + t.share, 0).toFixed(1);
  const radii = d.shape.radii.filter((r: any) => r.value !== 9999);
  const surfaceRadius = d.shape.surfaceRadius ?? radii.find((r: any) => r.on.includes('surface'))?.value ?? 0;
  const pill = d.shape.radii.some((r: any) => r.value === 9999 && r.on.includes('button'));
  const heading = d.typography.styles.find((s: any) => /^(display|h1)$/.test(s.name)) || d.typography.styles[0];
  const body = d.typography.styles.find((s: any) => s.name === 'body');
  const pats = d.motion.patterns as any[];
  const entrance = pats.filter((p) => p.trigger === 'scroll' || p.trigger === 'load');
  const avgDur = entrance.length ? Math.round(entrance.reduce((s, p) => s + p.duration * p.count, 0) / entrance.reduce((s, p) => s + p.count, 0)) : 0;
  const springs = pats.filter((p) => /^linear\(/.test(p.easing)).length;
  const metrics = {
    scheme: d.color.scheme, textContrast: cr, chromaShare, accentCount: chromatic.length,
    surfaceRadius, pillButtons: pill, shadows: d.shape.shadows.length, hairlines: d.shape.borders.length, glass: d.shape.backdrop.length > 0,
    headingSize: heading?.size, headingWeight: heading?.weight, headingTracking: heading?.letterSpacingEm, bodySize: body?.size, bodyLeading: body?.lineHeightRatio,
    typeScaleRatio: d.typography.scale.ratio, families: d.typography.families.length,
    sectionPadding: d.spacing.sections.desktop?.median, spacingBase: d.spacing.base,
    firstScreenWords: d.layout.density.firstScreenWords,
    motionPatterns: pats.length, entranceMotions: entrance.length, avgEntranceMs: avgDur, springs, smoothScroll: d.motion.scroll?.kind === 'smooth',
    hoverEffects: d.motion.hover.length,
  };
  const notes: string[] = [];
  notes.push(`${metrics.scheme === 'dark' ? 'Dark' : 'Light'} interface${chromaShare < 5 ? ', almost entirely neutral — colour is rationed' : chromaShare < 20 ? ', mostly neutral with a restrained accent' : ', colour-forward'} (chromatic share ${chromaShare}%).`);
  if (cr) notes.push(cr > 15 ? `Maximum-contrast text (${cr}:1).` : cr > 9 ? `High-contrast text (${cr}:1), softened slightly off pure black/white.` : `Softened text contrast (${cr}:1) — the primary text is deliberately not full strength.`);
  if (heading) notes.push(`Headlines ${heading.size}px / ${heading.weight}${heading.letterSpacingEm < -0.01 ? `, tightly tracked (${heading.letterSpacingEm}em)` : heading.letterSpacingEm > 0.02 ? `, open tracking (${heading.letterSpacingEm}em)` : ''}; body ${body?.size}px at ${body?.lineHeightRatio} leading.`);
  notes.push(surfaceRadius >= 16 ? `Soft, rounded surfaces (${surfaceRadius}px).` : surfaceRadius >= 6 ? `Moderately rounded surfaces (${surfaceRadius}px).` : `Crisp, near-square geometry (${surfaceRadius}px).`);
  if (metrics.hairlines && !metrics.shadows) notes.push('Depth comes from hairline borders, not shadows.');
  else if (metrics.shadows > 2) notes.push('Layered shadows carry depth.');
  if (metrics.glass) notes.push('Translucent, blurred (glass) layers are part of the language.');
  if (metrics.sectionPadding) notes.push(`Generous vertical rhythm: sections breathe with ~${metrics.sectionPadding}px padding on desktop.`);
  if (pats.length) notes.push(`${entrance.length ? `Entrances run ~${avgDur}ms` : 'Few entrances'}${springs ? `, with spring physics (${springs} spring curves)` : ''}${metrics.smoothScroll ? `; scrolling is smoothed (${d.motion.scroll.library}, lerp ${d.motion.scroll.lerp ?? '?'})` : '; native scrolling'}.`);
  return { metrics, notes };
}
