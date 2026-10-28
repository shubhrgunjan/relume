// Compile an entry's dna.json into an Agent Skill directory: SKILL.md + references/ + assets/ + scripts/.
import { mkdirSync, writeFileSync, copyFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DNA } from '../infer/dna.js';
import { parseColor } from '../lib/csscolor.js';
import { baseFamily } from '../infer/tokens.js';
import { buildRecipes, type Recipe } from './motion-recipes.js';

const HERE = dirname(fileURLToPath(import.meta.url));

export function skillName(dna: DNA) {
  const host = new URL(dna.source.url).hostname.replace(/^www\./, '').split('.').slice(0, -1).join('-') || 'site';
  return `${host}-design-language`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64);
}

const fmt = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : String(v));
const table = (head: string[], rows: (string | number | undefined)[][]) =>
  `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n` + rows.map((r) => `| ${r.map((c) => fmt(c).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`).join('\n');

function cssVarName(name: string) { return '--' + name.replace(/[^a-z0-9-]/gi, '-').toLowerCase(); }

export function compileSkill(dna: DNA, entryDir: string) {
  const name = skillName(dna);
  const out = join(entryDir, 'skill', name);
  if (existsSync(out)) rmSync(out, { recursive: true });
  for (const d of ['references', 'assets', 'assets/reference', 'scripts']) mkdirSync(join(out, d), { recursive: true });
  const recipes = buildRecipes(dna.motion.patterns as any);
  const host = new URL(dna.source.url).hostname;

  writeFileSync(join(out, 'assets', 'tokens.css'), tokensCss(dna));
  writeFileSync(join(out, 'assets', 'tailwind.css'), tailwindCss(dna));
  writeFileSync(join(out, 'assets', 'tokens.json'), JSON.stringify(dtcg(dna), null, 2));
  writeFileSync(join(out, 'assets', 'motion.css'), motionCss(dna, recipes));
  writeFileSync(join(out, 'assets', 'motion.js'), motionJs(dna, recipes));
  writeFileSync(join(out, 'assets', 'DESIGN.md'), designMd(dna, host));
  writeFileSync(join(out, 'references', 'tokens.md'), tokensMd(dna));
  writeFileSync(join(out, 'references', 'components.md'), componentsMd(dna));
  writeFileSync(join(out, 'references', 'motion.md'), motionMd(dna, recipes));
  writeFileSync(join(out, 'references', 'layout.md'), layoutMd(dna));
  writeFileSync(join(out, 'scripts', 'lint.mjs'), readFileSync(join(HERE, 'lint-template.mjs'), 'utf8'));
  // reference shots: the look, for the agent's eyes only — never ship them in a build
  for (const p of dna.source.pages.slice(0, 3)) for (const vp of ['desktop', 'mobile']) {
    const src = join(entryDir, 'pages', p.key, `shot-${vp}.jpg`);
    if (existsSync(src)) copyFileSync(src, join(out, 'assets', 'reference', `${p.key}-${vp}.jpg`));
  }
  for (const c of dna.components) if (c.crop && existsSync(join(entryDir, c.crop))) copyFileSync(join(entryDir, c.crop), join(out, 'assets', 'reference', c.crop.split('/').pop()!));
  writeFileSync(join(out, 'SKILL.md'), skillMd(dna, name, host, recipes));
  return out;
}

// ------------------------------------------------------------------ SKILL.md

function skillMd(dna: DNA, name: string, host: string, recipes: Recipe[]) {
  const t = (role: string) => dna.color.tokens.find((x) => x.role === role);
  const fam = dna.typography.families;
  const famLine = fam.map((f) => `**${f.family}**${(f as any).google && (f as any).google !== f.family ? ` (= ${(f as any).google} on Google Fonts)` : ''}${f.substitute ? ` (use **${f.substitute}** unless you hold a licence)` : ''} for ${f.roles.slice(0, 4).join(', ')} — \`var(${fontVar(dna, f.family)})\``).join('; ');
  const radii = dna.shape.radii.slice(0, 5).map((r) => r.css).join(', ');
  const durations = dna.motion.durations.slice(0, 5).map((d) => d.ms + 'ms').join(', ');
  const easings = dna.motion.easings.filter((e) => !e.spring).slice(0, 3).map((e) => '`' + e.css + '`').join(', ');
  const springs = dna.motion.easings.filter((e) => e.spring).length;
  const sc = dna.motion.scroll;
  const btn = dna.components.find((c) => c.name === 'button-primary');
  const desc = `Build UI in the design language measured from ${host}: ${dna.feel.notes[0].replace(/\.$/, '')}. Use whenever creating or restyling pages, sections or components that should look and move like ${host} — colours, type, spacing, components and motion come from measurement, not guesswork.`.slice(0, 1020);
  const dos: string[] = [];
  const donts: string[] = [];
  dos.push(`Use only the colour tokens in \`assets/tokens.css\`; the accent (${fmt(t('accent')?.value)}) covers ≤${Math.max(1, Math.round((t('accent')?.share || 1) * 3))}% of any screen.`);
  dos.push(`Set text with the named styles (\`.text-body\`, \`.text-${dna.typography.styles[0]?.name}\` …); never invent sizes between them.`);
  dos.push(`Space on the ${dna.spacing.base}px grid (${dna.spacing.top.slice(0, 6).map((x) => x.value).join(', ')} are the workhorses); sections get ~${dna.spacing.sections.desktop?.median ?? '—'}px vertical padding on desktop.`);
  if (dna.feel.metrics.hairlines && !dna.feel.metrics.shadows) donts.push('Do not use drop shadows for depth; separate surfaces with the hairline border tokens.');
  if (dna.feel.metrics.shadows) dos.push('Reuse the measured shadows verbatim; they are layered, not single blurs.');
  if (dna.feel.metrics.glass) dos.push('Floating chrome (nav, popovers) uses the measured backdrop blur over a translucent fill.');
  donts.push(`Do not use radii outside ${radii}.`);
  donts.push(`Do not use durations or curves that are not in the motion tokens (${durations}).`);
  if (sc?.kind === 'native') donts.push('Do not add smooth-scroll libraries; the source scrolls natively.');
  else if (sc) dos.push(`Install the measured smooth scroll (${sc.library}, lerp ${sc.lerp}) via \`assets/motion.js\`.`);
  donts.push('Do not copy the source’s logo, product names, photography, illustrations or copy; describe your own product in this language.');

  return `---
name: ${name}
description: ${JSON.stringify(desc)}
---

# ${host} design language

Measured from ${dna.source.url} (${dna.source.pages.length} page${dna.source.pages.length === 1 ? '' : 's'} at ${['desktop', 'tablet', 'mobile', 'desktop-dark'].filter((v) => dna.source.viewports.includes(v)).join(', ')}) on ${dna.source.crawledAt.slice(0, 10)} by relume. Every value here was read from the live site — computed styles, stylesheets, animations and a frame-by-frame motion recording — so treat them as facts, not suggestions.

## The feel
${dna.feel.notes.map((n) => `- ${n}`).join('\n')}

## Setup
1. Copy \`assets/tokens.css\` (plain CSS variables, text styles, component classes, \`.container\` and \`.section\` with the measured width, gutters and rhythm — use them, don't re-derive) into the project; with Tailwind v4 also import \`assets/tailwind.css\` after \`@import "tailwindcss"\`.
2. Add \`assets/motion.css\` and \`assets/motion.js\` (scroll reveals, intro choreography, stagger and scroll feel, all with measured timings).
3. Fonts: ${famLine}.${googleFonts(dna) ? `\n   Load the open ones: \`${googleFonts(dna)}\`` : ''}

## Core tokens
- Background ${fmt(t('background')?.value)}, text ${fmt(t('text')?.value)} / ${fmt(t('text-secondary')?.value)} / ${fmt(t('text-tertiary')?.value)}, accent ${fmt(t('accent')?.value)}, surface ${fmt(t('surface')?.value)}, border ${fmt(t('border')?.value)}.${dna.color.darkMode.supported ? ` A dark scheme exists (${dna.color.darkMode.strategy}).` : ''}
- Type scale ${dna.typography.scale.ratio ? `≈${dna.typography.scale.ratio}${dna.typography.scale.name ? ` (${dna.typography.scale.name})` : ''} from ${dna.typography.scale.base}px` : 'custom'}: ${dna.typography.styles.slice(0, 8).map((s) => `${s.name} ${s.size}/${s.weight}`).join(', ')}.
- Radii ${radii}. Spacing grid ${dna.spacing.base}px. Container ${dna.layout.containers.desktop?.[0]?.value ?? '—'}px, gutters ${dna.layout.gutters.desktop ?? '—'} / ${dna.layout.gutters.tablet ?? '—'} / ${dna.layout.gutters.mobile ?? '—'}px (desktop / tablet / mobile).
- Motion: ${durations}; curves ${easings}${springs ? ` plus ${springs} spring curve${springs === 1 ? '' : 's'} (kept exact as \`linear()\`)` : ''}. Scroll: ${sc ? (sc.kind === 'native' ? 'native' : `smoothed (${sc.library}, lerp ${sc.lerp}, settles in ${sc.settleMs}ms)`) : 'not measured'}.
${btn ? `- Primary action: ${btn.style.background} / ${btn.style.color}, radius ${btn.style.radius ?? "0"}, ${btn.style.font}${btn.hover ? `; on hover ${Object.entries(btn.hover.changes).map(([k, v]) => `${k} → ${v[1]}`).join(', ')}` : ''}.` : ''}

## Do
${dos.map((d) => `- ${d}`).join('\n')}

## Don't
${donts.map((d) => `- ${d}`).join('\n')}

## Motion signature
${recipes.filter((r) => r.trigger !== 'loop').slice(0, 6).map((r) => `- **${r.name}** (${r.trigger}${r.count > 1 ? `, ×${r.count}` : ''}): ${r.from || '—'} → ${r.to || '—'} over ${r.duration}ms \`${r.easing.length > 60 ? 'spring (see motion.md)' : r.easing}\`${r.delay ? `, delay ${r.delay}ms` : ''}${r.stagger ? `, stagger ${r.stagger}ms` : ''}${r.entry !== undefined ? `, starts when the element's top is at ${Math.round(r.entry * 100)}% of the viewport` : ''}.`).join('\n')}

## Workflow
1. Read \`references/tokens.md\` and \`references/components.md\` before writing UI; open the images in \`assets/reference/\` to see the look.
2. Build with the component classes and text styles; take motion from \`references/motion.md\` (exact CSS per pattern).
3. Run \`node scripts/lint.mjs <your files…>\` and fix every off-system colour, size, radius, duration and curve it reports.
4. If the relume MCP server is connected, call \`check_style\` with your page's URL: it re-measures your page and compares its DNA (tokens and motion) with this one. Fix what it reports until it passes.

## References
- \`references/tokens.md\` — every colour (with dark values and the source’s own variable names), text style (with fluid sizes), spacing, radius, border, shadow, gradient.
- \`references/components.md\` — buttons, links, inputs, cards, badges, navigation, footer: resting style, hover/focus states and transitions.
- \`references/motion.md\` — scroll feel, intro choreography, scroll reveals, hover motion, loops; exact CSS.
- \`references/layout.md\` — containers, gutters, grids, breakpoints, section rhythm, density.
- \`assets/DESIGN.md\` — the same system in Google's DESIGN.md format, for other tools.
`;
}

/** One CSS variable per family: the body family is --font-sans, a mono family --font-mono, others by name. */
export function fontVar(dna: DNA, family: string) {
  const f = dna.typography.families.find((x) => x.family === family);
  if (!f) return '--font-sans';
  const body = dna.typography.styles.find((s) => s.name === 'body')?.family;
  if (family === body) return '--font-sans';
  if (f.roles.some((r) => r.startsWith('mono')) || /mono|code/i.test(family)) return '--font-mono';
  return cssVarName('font-' + baseFamily(family));
}

function googleFonts(dna: DNA) {
  // exact weights in use (rounded to the hundreds Google serves); a range would fail the whole request for a
  // single-weight family such as Anton
  const want = new Map<string, Set<number>>();
  for (const f of dna.typography.families) {
    const name = (f as any).google || f.substitute;
    if (!name || /^(system-ui|-apple-system|helvetica|arial|sans-serif)/i.test(name)) continue;
    const w = want.get(name) || new Set<number>();
    for (const x of f.weights) w.add(Math.min(900, Math.max(100, Math.round(x / 100) * 100)));
    want.set(name, w);
  }
  if (!want.size) return '';
  return `<link href="https://fonts.googleapis.com/css2?${[...want].map(([n, w]) => `family=${n.replace(/ /g, '+')}:wght@${[...w].sort((a, b) => a - b).join(';')}`).join('&')}&display=swap" rel="stylesheet">`;
}

// ------------------------------------------------------------------ CSS

function tokensCss(dna: DNA) {
  const L: string[] = [`/* ${dna.source.url} — measured by relume on ${dna.source.crawledAt.slice(0, 10)} */`, ':root {'];
  for (const t of dna.color.tokens) L.push(`  ${cssVarName('color-' + t.name)}: ${t.value};${t.aliases.length ? ` /* source: ${t.aliases.slice(0, 2).join(', ')} */` : ''}`);
  for (const f of dna.typography.families) {
    const names = [...new Set([(f as any).google, f.substitute, f.family, baseFamily(f.family)].filter(Boolean) as string[])];
    const mono = f.roles.some((r) => r.startsWith('mono'));
    L.push(`  ${fontVar(dna, f.family)}: ${names.map((n) => JSON.stringify(n)).join(', ')}, ${mono ? 'ui-monospace, monospace' : 'ui-sans-serif, system-ui, sans-serif'};`);
  }
  for (const s of dna.typography.styles) {
    const size = s.fluid?.css?.startsWith('clamp') ? s.fluid.css : `${s.size / 16}rem`;
    L.push(`  ${cssVarName('text-' + s.name)}: ${size};`);
  }
  dna.spacing.scale.filter((v) => v % dna.spacing.base === 0 || v < 4).forEach((v) => L.push(`  --space-${String(v).replace('.', '_')}: ${v}px;`));
  dna.shape.radii.forEach((r, i) => L.push(`  --radius-${r.value === 9999 ? 'full' : i + 1}: ${r.css};`));
  dna.shape.shadows.slice(0, 5).forEach((s, i) => L.push(`  --shadow-${i + 1}: ${s.value};`));
  dna.shape.borders.slice(0, 4).forEach((b, i) => L.push(`  --border-${i + 1}: ${b.value};`));
  dna.motion.durations.slice(0, 8).forEach((d) => L.push(`  --duration-${d.ms}: ${d.ms}ms;`));
  dna.motion.easings.slice(0, 8).forEach((e, i) => L.push(`  --ease-${e.spring ? 'spring-' + (i + 1) : i + 1}: ${e.css};`));
  if (dna.layout.containers.desktop?.[0]) L.push(`  --container: ${dna.layout.containers.desktop[0].value}px;`);
  for (const vp of ['desktop', 'tablet', 'mobile']) if (dna.layout.gutters[vp] != null) L.push(`  --gutter-${vp}: ${dna.layout.gutters[vp]}px;`);
  L.push('}');
  const dark = dna.color.tokens.filter((t) => t.dark);
  if (dark.length) {
    const sel = dna.color.darkMode.strategy === 'class' ? '.dark, [data-theme="dark"]' : '@media (prefers-color-scheme: dark) { :root';
    L.push('', `${sel} {`);
    for (const t of dark) L.push(`  ${cssVarName('color-' + t.name)}: ${t.dark};`);
    L.push(dna.color.darkMode.strategy === 'class' ? '}' : '} }');
  }
  L.push('', `html { background: var(--color-background); color: var(--color-text); font-family: var(--font-sans); -webkit-font-smoothing: antialiased; }`);
  // the measured content width is a border-box width: the container includes its gutters
  const bpT = dna.layout.breakpoints.find((b: { kind: string; value: number }) => b.kind === 'max' && b.value >= 700 && b.value <= 1100)?.value ?? 834;
  const bpM = dna.layout.breakpoints.find((b: { kind: string; value: number }) => b.kind === 'max' && b.value < 700)?.value ?? 640;
  L.push(`.container { box-sizing: border-box; width: 100%; max-width: var(--container); margin-inline: auto; padding-inline: var(--gutter-desktop); }`);
  L.push(`@media (max-width: ${bpT}px) { .container { padding-inline: var(--gutter-tablet); } }`);
  L.push(`@media (max-width: ${bpM}px) { .container { padding-inline: var(--gutter-mobile); } }`);
  if (dna.spacing.sections.desktop?.median) L.push(`.section { padding-block: ${dna.spacing.sections.desktop.median}px; }${dna.spacing.sections.mobile?.median ? ` @media (max-width: ${bpM}px) { .section { padding-block: ${dna.spacing.sections.mobile.median}px; } }` : ''}`);
  L.push('', '/* text styles */');
  for (const s of dna.typography.styles) {
    const famVar = `var(${fontVar(dna, s.family)})`;
    L.push(`.text-${s.name} { font-family: ${famVar}; font-size: var(${cssVarName('text-' + s.name)}); font-weight: ${s.weight}; line-height: ${s.lineHeight === 'normal' ? 'normal' : s.lineHeightRatio}; letter-spacing: ${s.letterSpacingEm}em;${s.transform !== 'none' ? ` text-transform: ${s.transform};` : ''}${s.features ? ` font-feature-settings: ${s.features};` : ''} }`);
    if (s.fluid && !s.fluid.css.startsWith('clamp')) {
      const bp = dna.layout.breakpoints.find((b: { kind: string; value: number }) => b.kind === 'max')?.value ?? 768;
      L.push(`@media (max-width: ${bp}px) { .text-${s.name} { font-size: ${s.fluid.mobile / 16}rem; } }`);
    }
  }
  L.push('', '/* components — resting style, hover and focus exactly as measured */');
  for (const c of dna.components) {
    if (['navbar', 'footer'].includes(c.kind)) continue;
    const st = c.style;
    const d: string[] = [];
    if (st.background && st.background !== 'transparent') d.push(`background: ${st.background}`);
    if (st.color) d.push(`color: ${st.color}`);
    if (st.border) d.push(`border: ${st.border}`);
    if (st.radius) d.push(`border-radius: ${st.radius}`);
    if (st.shadow) d.push(`box-shadow: ${st.shadow}`);
    if (st.font) d.push(`font: ${st.font} var(${fontVar(dna, st.family || '')})`);
    if (st.letterSpacing) d.push(`letter-spacing: ${st.letterSpacing}`);
    if (st.textTransform) d.push(`text-transform: ${st.textTransform}`);
    if (st.padding && c.kind !== 'card') d.push(`padding: ${st.padding}`);
    if (c.kind === 'button' || c.kind === 'badge') d.push('display: inline-flex', 'align-items: center', `gap: ${st.gap || '8px'}`, `height: ${c.size.height}px`);
    if (st.transition) d.push(`transition: ${st.transition}`);
    if (st.backdrop) d.push(`backdrop-filter: ${st.backdrop}`);
    L.push(`.${c.name} { ${d.join('; ')}; }`);
    if (c.hover) {
      const h = Object.entries(c.hover.changes).filter(([k]) => !k.startsWith('::')).map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()).replace('border-top-color', 'border-color')}: ${v[1]}`);
      if (h.length) L.push(`.${c.name}:hover { ${h.join('; ')}; }`);
    }
    if (c.focus) L.push(`.${c.name}:focus-visible { outline: ${c.focus.outline}; outline-offset: ${c.focus.offset};${c.focus.boxShadow ? ` box-shadow: ${c.focus.boxShadow};` : ''} }`);
  }
  return L.join('\n') + '\n';
}

function tailwindCss(dna: DNA) {
  const L = ['/* Tailwind v4: @import "tailwindcss"; @import "./tokens.css"; @import "./tailwind.css"; */', '@theme inline {'];
  for (const t of dna.color.tokens) L.push(`  --color-${t.name}: var(${cssVarName('color-' + t.name)});`);
  L.push('  --font-sans: var(--font-sans);', '  --font-mono: var(--font-mono);');
  for (const s of dna.typography.styles) {
    L.push(`  --text-${s.name}: var(${cssVarName('text-' + s.name)});`);
    L.push(`  --text-${s.name}--line-height: ${s.lineHeight === 'normal' ? 'normal' : s.lineHeightRatio};`);
    L.push(`  --text-${s.name}--letter-spacing: ${s.letterSpacingEm}em;`);
    L.push(`  --text-${s.name}--font-weight: ${s.weight};`);
  }
  L.push(`  --spacing: ${dna.spacing.base === 8 ? 4 : dna.spacing.base}px;`);
  dna.shape.radii.forEach((r, i) => L.push(`  --radius-${r.value === 9999 ? 'full' : ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'][i]}: ${r.css};`));
  dna.shape.shadows.slice(0, 5).forEach((s, i) => L.push(`  --shadow-${['sm', 'md', 'lg', 'xl', '2xl'][i]}: ${s.value};`));
  dna.motion.easings.filter((e) => !e.spring).slice(0, 4).forEach((e, i) => L.push(`  --ease-${['brand', 'brand-2', 'brand-3', 'brand-4'][i]}: ${e.css};`));
  L.push('}');
  return L.join('\n') + '\n';
}

function dtcg(dna: DNA) {
  const color: Record<string, any> = { $type: 'color' };
  for (const t of dna.color.tokens) {
    const c = parseColor(t.value)!;
    color[t.name] = {
      $value: { colorSpace: 'srgb', components: [c.r / 255, c.g / 255, c.b / 255].map((v) => +v.toFixed(4)), alpha: +c.a.toFixed(3), hex: t.hex },
      $description: `${t.role}; ${t.share}% of painted weight`,
      ...(t.dark ? { $extensions: { 'dev.relume': { dark: t.dark } } } : {}),
    };
  }
  const typography: Record<string, any> = { $type: 'typography' };
  for (const s of dna.typography.styles) typography[s.name] = {
    $value: { fontFamily: [s.family], fontSize: { value: s.size, unit: 'px' }, fontWeight: s.weight, lineHeight: s.lineHeight === 'normal' ? 1.2 : s.lineHeightRatio, letterSpacing: { value: s.letterSpacingEm, unit: 'em' } },
    ...(s.fluid ? { $extensions: { 'dev.relume': { fluid: s.fluid } } } : {}),
  };
  const dimension: Record<string, any> = { $type: 'dimension' };
  for (const v of dna.spacing.scale) dimension[`space-${String(v).replace('.', '_')}`] = { $value: { value: v, unit: 'px' } };
  for (const [i, r] of dna.shape.radii.entries()) dimension[`radius-${r.value === 9999 ? 'full' : i + 1}`] = { $value: { value: r.value, unit: 'px' } };
  const duration: Record<string, any> = { $type: 'duration' };
  for (const d of dna.motion.durations) duration[`duration-${d.ms}`] = { $value: { value: d.ms, unit: 'ms' } };
  const easing: Record<string, any> = { $type: 'cubicBezier' };
  dna.motion.easings.forEach((e, i) => {
    const m = e.css.match(/cubic-bezier\(([^)]+)\)/);
    const named: Record<string, number[]> = { ease: [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1], 'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1], linear: [0, 0, 1, 1] };
    const v = m ? m[1].split(',').map(Number) : named[e.css];
    if (v) easing[`ease-${i + 1}`] = { $value: v };
    else easing[`ease-${i + 1}`] = { $value: [0, 0, 1, 1], $extensions: { 'dev.relume': { css: e.css } }, $description: 'spring / custom curve — use the CSS value in extensions' };
  });
  const shadow: Record<string, any> = {};
  dna.shape.shadows.forEach((s, i) => { shadow[`shadow-${i + 1}`] = { $type: 'shadow', $value: s.value, $description: 'CSS box-shadow, verbatim' }; });
  return { $description: `Design tokens measured from ${dna.source.url} by relume (DTCG 2025.10)`, color, typography, dimension, duration, easing, shadow };
}

// ------------------------------------------------------------------ motion assets

function motionCss(dna: DNA, recipes: Recipe[]) {
  const L = [`/* motion measured from ${dna.source.url}. Reveal: add data-reveal="<name>" (and style="--i: n" for stagger order); motion.js adds .is-in. */`];
  L.push('@media (prefers-reduced-motion: reduce) { [data-reveal], [data-intro] { transition: none !important; animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; } }');
  for (const r of recipes) {
    if (r.trigger === 'scroll') {
      L.push(`/* ${r.name}: ${r.targets[0]} (×${r.count}) */`);
      L.push(`[data-reveal="${r.name}"] { ${r.from} transition: ${r.transitionCss.replace(/\n\s*/g, ' ')};${r.stagger ? ` transition-delay: calc(${r.delay}ms + var(--i, 0) * ${r.stagger}ms);` : ''} }`);
      L.push(`[data-reveal="${r.name}"].is-in { ${r.to} }`);
    } else if (r.trigger === 'load') {
      L.push(`/* ${r.name}: ${r.targets[0]} (×${r.count}) */`);
      if (r.keyframesCss) L.push(r.keyframesCss);
      L.push(`[data-intro="${r.name}"] { animation: ${r.name} ${r.duration}ms ${r.easing} both; animation-delay: calc(${r.delay}ms${r.stagger ? ` + var(--i, 0) * ${r.stagger}ms` : ''}); }`);
    } else if (r.trigger === 'loop') {
      if (r.keyframesCss) L.push(`/* ${r.name}: ${r.targets[0]} */`, r.keyframesCss, `.${r.name} { animation: ${r.name} ${r.duration}ms ${r.easing} infinite; }`);
    } else if (r.trigger === 'hover') {
      L.push(`/* hover ${r.name}: ${r.targets[0]} — ${r.from} → ${r.to} */`, `.${r.name} { transition: ${r.transitionCss.replace(/\n\s*/g, ' ').replace(/ \d+ms$/, '')}; }`);
    }
  }
  return L.join('\n') + '\n';
}

function motionJs(dna: DNA, recipes: Recipe[]) {
  const sc = dna.motion.scroll;
  const reveals = recipes.filter((r) => r.trigger === 'scroll');
  const entries: Record<string, number> = {};
  for (const r of reveals) entries[r.name] = Math.max(0.05, Math.min(1, r.entry ?? 0.85));
  const parallax = recipes.filter((r) => r.trigger === 'scroll-linked' && r.scrollRatio);
  return `// Motion runtime measured from ${dna.source.url} by relume. Import once on every page.
// Scroll reveals start when an element's top crosses the measured fraction of the viewport height.
const ENTRY = ${JSON.stringify(entries)};
const DEFAULT_ENTRY = ${reveals.length ? +(reveals.reduce((s, r) => s + (r.entry ?? 0.85), 0) / reveals.length).toFixed(2) : 0.85};

export function initReveals(root = document) {
  const els = [...root.querySelectorAll('[data-reveal]')];
  const byEntry = new Map();
  for (const el of els) {
    const e = ENTRY[el.dataset.reveal] ?? DEFAULT_ENTRY;
    if (!byEntry.has(e)) byEntry.set(e, []);
    byEntry.get(e).push(el);
  }
  for (const [entry, list] of byEntry) {
    const io = new IntersectionObserver((records) => {
      for (const r of records) if (r.isIntersecting) { r.target.classList.add('is-in'); io.unobserve(r.target); }
    }, { rootMargin: \`0px 0px \${-Math.round((1 - entry) * 100)}% 0px\` });
    list.forEach((el) => io.observe(el));
  }
}
${parallax.length ? `
// Scroll-linked motion: property change per px scrolled, as measured.
const PARALLAX = ${JSON.stringify(Object.fromEntries(parallax.map((p) => [p.name, p.scrollRatio])))};
export function initParallax() {
  const els = [...document.querySelectorAll('[data-parallax]')];
  const tick = () => { for (const el of els) { const k = PARALLAX[el.dataset.parallax] ?? 0; const r = el.getBoundingClientRect(); el.style.transform = \`translate3d(0, \${(r.top + r.height / 2 - innerHeight / 2) * k}px, 0)\`; } requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
` : ''}
${sc?.kind === 'smooth' ? `
// Smooth scrolling as measured: one wheel notch moves ${sc.perNotchPx}px and settles in ~${sc.settleMs}ms
// (exponential approach, lerp ≈ ${sc.lerp} per frame${sc.options ? `; source options ${JSON.stringify(sc.options)}` : ''}).
// npm i lenis
import Lenis from 'lenis';
export function initSmoothScroll() {
  const lenis = new Lenis({ lerp: ${sc.options?.lerp ?? sc.lerp ?? 0.1}, wheelMultiplier: ${sc.options?.wheelMultiplier ?? +(sc.perNotchPx / 100).toFixed(2)}, smoothWheel: true });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  return lenis;
}
` : `
// The source scrolls natively (one wheel notch = ${sc?.perNotchPx ?? 100}px, no smoothing). Keep it that way.
export function initSmoothScroll() { return null; }
`}
export function initMotion() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in')); return; }
  initSmoothScroll();
  initReveals();${parallax.length ? '\n  initParallax();' : ''}
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMotion); else initMotion();
}
`;
}

// ------------------------------------------------------------------ references

function tokensMd(dna: DNA) {
  const c = dna.color, ty = dna.typography;
  return `# Tokens

## Colour (${c.scheme} scheme${c.darkMode.supported ? `, dark mode via ${c.darkMode.strategy}` : ''})
Ordered by painted weight (area × use). \`aliases\` are the source's own custom properties holding the same value.

${table(['token', 'value', 'role', 'share', 'used for', 'dark', 'source aliases'], c.tokens.map((t) => [t.name, `\`${t.value}\``, t.role, t.share + '%', Object.entries(t.uses).filter(([, v]) => v > 10).map(([k]) => k).join(', '), t.dark ? `\`${t.dark}\`` : '', t.aliases.slice(0, 3).join(' ')]))}
${c.gradients.length ? `\n### Gradients\n${c.gradients.map((g) => `- \`${g}\``).join('\n')}\n` : ''}
## Typography
${table(['family', 'share', 'weights', 'source', 'licence', 'substitute'], ty.families.map((f) => [f.family, f.share + '%', f.weights.join(' '), f.host, f.license, f.substitute]))}

${table(['style', 'family', 'size', 'weight', 'line-height', 'tracking', 'case', 'share', 'responsive', 'sample'], ty.styles.map((s) => [s.name, s.family, s.size + 'px', s.weight, s.lineHeight === 'normal' ? 'normal' : `${s.lineHeight}px (${s.lineHeightRatio})`, s.letterSpacingEm + 'em', s.transform, s.share + '%', s.fluid ? `${s.fluid.mobile}→${s.fluid.tablet}→${s.fluid.desktop}px` : '', s.sample.slice(0, 40)]))}

Scale: ${ty.scale.ratio ? `ratio ${ty.scale.ratio}${ty.scale.name ? ` (${ty.scale.name})` : ''}, base ${ty.scale.base}px, fit ${ty.scale.fit}` : 'not modular'}. Sizes in use: ${(ty.scale as any).sizes?.join(', ')}.

## Spacing
Grid ${dna.spacing.base}px (${dna.spacing.coverage}% of measured paddings, margins and gaps sit on it${dna.spacing.offGrid?.length ? `; common off-grid values: ${dna.spacing.offGrid.join(', ')}` : ''}).

${table(['value', 'share'], dna.spacing.top.map((x) => [x.value + 'px', x.share + '%']))}

## Radii
${table(['radius', 'count', 'on'], dna.shape.radii.map((r) => [r.css, r.count, r.on.join(', ')]))}

## Borders
${table(['border', 'count'], dna.shape.borders.map((b) => [`\`${b.value}\``, b.count]))}

## Shadows
${dna.shape.shadows.length ? table(['shadow', 'count', 'on'], dna.shape.shadows.map((s) => [`\`${s.value}\``, s.count, s.on.join(', ')])) : 'None.'}
${dna.shape.backdrop.length ? `\n## Backdrop\n${dna.shape.backdrop.map((b) => `- \`${b.value}\` (×${b.count})`).join('\n')}\n` : ''}`;
}

function componentsMd(dna: DNA) {
  const L = ['# Components', '', 'Each variant is the clustered style of every element that looked the same across the crawled pages. Classes of the same name are in `assets/tokens.css`. Crops are in `assets/reference/`.', ''];
  for (const c of dna.components) {
    L.push(`## ${c.name} (${c.kind}, ×${c.count})`);
    if (c.crop) L.push(`![${c.name}](../assets/reference/${c.crop.split('/').pop()})`);
    if (c.samples.length) L.push(`Examples: ${c.samples.slice(0, 4).map((s) => `“${s.slice(0, 40)}”`).join(', ')}`);
    L.push('', table(['property', 'value'], Object.entries(c.style).map(([k, v]) => [k, `\`${v}\``])));
    L.push(`Size: ${c.size.height}px tall, from ${c.size.minWidth}px wide, padding ${c.size.paddingY} × ${c.size.paddingX}.`);
    if (c.hover) {
      L.push('', '**Hover**', table(['property', 'rest', 'hover'], Object.entries(c.hover.changes).map(([k, v]) => [k, `\`${v[0]}\``, `\`${v[1]}\``])));
      if (c.hover.transitions.length) L.push('Transitions: ' + c.hover.transitions.map((t: any) => `${t.props.join(', ')} ${t.duration}ms ${t.easing}${t.delay ? ` +${t.delay}ms` : ''}`).join('; '));
      if (c.hover.children.length) L.push('Inside it: ' + c.hover.children.map((t: any) => `${t.target} — ${t.props.join(', ')} ${t.duration}ms ${t.easing}`).join('; '));
    }
    if (c.focus) L.push('', `**Focus-visible**: outline \`${c.focus.outline}\`, offset ${c.focus.offset}${c.focus.boxShadow ? `, shadow \`${c.focus.boxShadow}\`` : ''}`);
    L.push('');
  }
  return L.join('\n');
}

function motionMd(dna: DNA, recipes: Recipe[]) {
  const m = dna.motion, sc = m.scroll;
  const L = ['# Motion', ''];
  L.push('## Scroll feel');
  if (sc) {
    L.push(sc.kind === 'native'
      ? `Native scrolling: one wheel notch moves ${sc.perNotchPx}px instantly. Do not add smoothing.`
      : `Smoothed scrolling (${sc.library}). One notch moves ${sc.perNotchPx}px, reaches 90% in ${sc.t90Ms}ms and settles in ${sc.settleMs}ms — an exponential approach with time constant ${sc.tauMs}ms (lerp ≈ ${sc.lerp}/frame at 60fps)${sc.asDuration ? `, or as a duration curve ${sc.asDuration}` : ''}.${sc.options ? ` Library options read from the page: \`${JSON.stringify(sc.options)}\`.` : ''}`);
    if (sc.snap) L.push(`Scroll snapping: \`${sc.snap}\`.`);
  } else L.push('Not measured.');
  L.push('', '## Tokens', table(['duration', 'uses'], m.durations.map((d) => [d.ms + 'ms', d.count])), '', table(['curve', 'uses', 'kind'], m.easings.map((e) => [`\`${e.css.length > 80 ? e.css.slice(0, 80) + '…' : e.css}\``, e.count, e.spring ? 'spring (CSS linear())' : 'bezier'])));
  const springs = m.easings.filter((e) => e.spring);
  if (springs.length) L.push('', 'Spring curves, exact (paste as-is; supported in all evergreen browsers):', ...springs.map((s) => '```css\n' + s.css + '\n```'));
  if (m.libraries && Object.keys(m.libraries).length) L.push('', `Libraries detected: ${Object.entries(m.libraries).filter(([k, v]) => v && !['scrollBehavior', 'scrollSnap', 'generator'].includes(k)).map(([k]) => k).join(', ') || 'none'}${m.libraries.generator ? ` (generator: ${m.libraries.generator})` : ''}.`);
  const sect = (title: string, trig: string, how: string) => {
    const rs = recipes.filter((r) => r.trigger === trig);
    if (!rs.length) return;
    L.push('', `## ${title}`, how, '');
    for (const r of rs.slice(0, 14)) {
      L.push(`### ${r.name} — ×${r.count}`, `Seen on: ${r.targets.join('; ')}`);
      L.push(`- from \`${r.from || '—'}\` to \`${r.to || '—'}\``);
      L.push(`- ${r.duration}ms, \`${r.easing.length > 70 ? r.easing.slice(0, 70) + '…' : r.easing}\`${r.easingApprox ? ` (bezier fallback \`${r.easingApprox}\`)` : ''}${r.delay ? `, delay ${r.delay}ms` : ''}${r.stagger ? `, stagger ${r.stagger}ms between siblings` : ''}${r.entry !== undefined ? `, starts at ${Math.round(r.entry * 100)}% viewport` : ''}${r.scrollRatio !== undefined ? `, moves ${r.scrollRatio}px per px scrolled` : ''}${r.iterations === 'infinite' ? ', loops forever' : ''} — source: ${r.source}`);
      if (r.keyframesCss) L.push('```css\n' + r.keyframesCss + '\n```');
      else if (trig === 'scroll') L.push('```css\n' + `[data-reveal="${r.name}"] { ${r.from} transition: ${r.transitionCss}; }\n[data-reveal="${r.name}"].is-in { ${r.to} }` + '\n```');
      else L.push('```css\n' + `transition: ${r.transitionCss};` + '\n```');
    }
  };
  if (m.intro.length) {
    L.push('', '## Intro choreography (ms after load)');
    const seen = new Set<string>();
    for (const i of m.intro) { const k = i.key + i.desc; if (seen.has(k)) continue; seen.add(k); L.push(`- ${i.t}ms — ${i.desc} (${recipes.find((r) => r.id.split('+').includes(i.key))?.name ?? i.key})`); if (seen.size > 20) break; }
  }
  sect('Load / intro', 'load', 'Plays once when the page loads. Use `data-intro="<name>"` with motion.css; set `--i` for stagger order.');
  sect('Scroll reveals', 'scroll', 'Triggered as elements enter the viewport. Use `data-reveal="<name>"`; motion.js observes them at the measured entry point.');
  sect('Scroll-linked', 'scroll-linked', 'Follows the scroll position continuously (parallax/scrub). Use `data-parallax="<name>"`.');
  sect('Hover', 'hover', 'Measured by hovering every distinct interactive element.');
  sect('Loops', 'loop', 'Ambient, infinite animations.');
  return L.join('\n') + '\n';
}

function layoutMd(dna: DNA) {
  const l = dna.layout, sp = dna.spacing.sections;
  return `# Layout

## Containers
${table(['viewport', 'content widths (most used first)', 'gutter'], ['desktop', 'tablet', 'mobile'].map((v) => [v, (l.containers[v] || []).map((c: any) => c.value + 'px').join(', '), l.gutters[v] != null ? l.gutters[v] + 'px' : '']))}

## Breakpoints (from the stylesheets)
${l.breakpoints.map((b: any) => `- ${b.kind}-width ${b.value}px (×${b.count})`).join('\n') || 'None found.'}

## Grids
${l.grids.map((g: any) => `- ${g.pattern} (×${g.count})`).join('\n') || 'None.'}

## Section rhythm
${table(['viewport', 'section padding-y (common)', 'median', 'gap between sections'], Object.entries(sp).map(([k, v]: [string, any]) => [k, v.paddingY.map((x: number) => x + 'px').join(', '), v.median + 'px', v.gap + 'px']))}

## Density
- First screen: ${l.density.firstScreenWords} words, text covers ${l.density.firstScreenTextCoverage}% of it.
- Home page is ${l.density.pageHeightScreens} screens tall at desktop.
`;
}

function designMd(dna: DNA, host: string) {
  const y: string[] = ['---', `name: ${host}`, 'colors:'];
  for (const t of dna.color.tokens.slice(0, 24)) y.push(`  ${t.name}: "${t.value}"`);
  y.push('typography:');
  for (const s of dna.typography.styles.slice(0, 14)) y.push(`  ${s.name}:`, `    fontFamily: "${s.family}"`, `    fontSize: ${s.size}px`, `    fontWeight: ${s.weight}`, `    lineHeight: ${s.lineHeight === 'normal' ? 'normal' : s.lineHeightRatio}`, `    letterSpacing: ${s.letterSpacingEm}em`);
  y.push('rounded:');
  dna.shape.radii.slice(0, 6).forEach((r, i) => y.push(`  ${r.value === 9999 ? 'full' : ['sm', 'md', 'lg', 'xl', '2xl', '3xl'][i]}: ${r.css}`));
  y.push('spacing:');
  dna.spacing.top.slice(0, 8).sort((a, b) => a.value - b.value).forEach((s, i) => y.push(`  "${i + 1}": ${s.value}px`));
  y.push('components:');
  for (const c of dna.components.filter((c) => c.kind === 'button' || c.kind === 'card').slice(0, 6)) {
    y.push(`  ${c.name}:`);
    if (c.style.background) y.push(`    backgroundColor: "${c.style.background.slice(0, 80)}"`);
    if (c.style.color) y.push(`    textColor: "${c.style.color}"`);
    if (c.style.radius) y.push(`    rounded: ${c.style.radius}`);
    if (c.style.padding) y.push(`    padding: ${c.style.padding}`);
  }
  y.push('---', '', `# ${host}`, '', '## Overview', dna.feel.notes.join(' '), '', '## Colors', dna.color.tokens.slice(0, 10).map((t) => `- **${t.name}** \`${t.value}\` — ${t.role}`).join('\n'), '', '## Typography', dna.typography.families.map((f) => `- ${f.family}${f.substitute ? ` (open substitute: ${f.substitute})` : ''}`).join('\n'), '', '## Motion', `Durations ${dna.motion.durations.slice(0, 5).map((d) => d.ms + 'ms').join(', ')}; curves ${dna.motion.easings.filter((e) => !e.spring).slice(0, 3).map((e) => e.css).join(', ')}.`, '', "## Do's and Don'ts", '- Use the tokens above only.', '- Keep motion within the measured durations and curves.', '- Never reuse the source brand’s logo, imagery or copy.', '');
  return y.join('\n');
}
