// The catalogue as a page: every measured language with its swatches, type, motion signature, feel and checks.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listEntries, entryDir } from '../catalog/catalog.js';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function catalogPage() {
  const entries = listEntries().filter((e) => e.dna).sort((a, b) => b.at.localeCompare(a.at));
  const cards = entries.map((e) => {
    const d = e.dna;
    const t = (role: string) => d.color.tokens.find((x: any) => x.role === role)?.value;
    const sw = d.color.tokens.slice(0, 12).map((c: any) => `<span class="sw" style="background:${esc(c.value)}" title="${esc(c.name)} ${esc(c.value)} · ${c.share}%"></span>`).join('');
    const head = d.typography.styles.find((s: any) => /^(display|h1|h2)$/.test(s.name)) || d.typography.styles[0];
    const motion = (d.motion.patterns as any[]).filter((p) => p.trigger !== 'loop').slice(0, 4).map((p) => `<li><b>${esc(p.trigger)}</b> ${esc(p.props.join('+'))} · ${p.duration}ms <code>${esc(p.easing.length > 34 ? 'spring' : p.easing)}</code>${p.stagger ? ` · stagger ${p.stagger}ms` : ''}</li>`).join('');
    const checksFile = join(entryDir(e.slug), 'checks', 'index.jsonl');
    const checks = existsSync(checksFile) ? readFileSync(checksFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    const best = checks.length ? Math.max(...checks.map((c) => c.overall)) : null;
    const key = d.source.pages[0].key;
    return `<article class="card">
  <a class="shot" href="/shot/${esc(e.slug)}/${esc(key)}/desktop.jpg" style="background:${esc(t('background'))}"><img loading="lazy" src="/shot/${esc(e.slug)}/${esc(key)}/desktop.jpg" alt=""></a>
  <div class="body">
    <h2>${esc(new URL(d.source.url).hostname)}</h2>
    <p class="meta">${esc(d.color.scheme)} · ${d.source.pages.length} pages · ${esc(d.source.crawledAt.slice(0, 10))} · scroll ${esc(d.motion.scroll?.kind ?? '?')}${d.motion.scroll?.kind === 'smooth' ? ` (lerp ${d.motion.scroll.lerp})` : ''}</p>
    <div class="sws">${sw}</div>
    <p class="type" style="font-family:${esc(head?.family)}, system-ui; font-weight:${head?.weight}; letter-spacing:${head?.letterSpacingEm}em">${esc(d.typography.families.map((f: any) => f.family).join(' + '))}</p>
    <p class="meta">${esc(head?.name)} ${head?.size}/${head?.weight} · body ${esc(d.typography.styles.find((s: any) => s.name === 'body')?.size)}px · grid ${d.spacing.base}px · radii ${esc(d.shape.radii.slice(0, 4).map((r: any) => r.css).join(' '))}</p>
    <ul class="motion">${motion}</ul>
    <ul class="notes">${d.feel.notes.slice(0, 4).map((n: string) => `<li>${esc(n)}</li>`).join('')}</ul>
    <p class="meta">${checks.length ? `${checks.length} check${checks.length > 1 ? 's' : ''}, best ${best}/100` : 'no checks yet'} · <code>${esc(e.slug)}</code></p>
  </div>
</article>`;
  }).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>relume catalogue</title>
<style>
:root { --bg: #f6f6f4; --fg: #141414; --muted: #6b6b6b; --line: #e2e2de; --card: #ffffff; }
@media (prefers-color-scheme: dark) { :root { --bg: #0e0e0f; --fg: #ededed; --muted: #8d8d8d; --line: #232325; --card: #161618; } }
* { box-sizing: border-box; } body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; }
header { padding: 40px 24px 16px; max-width: 1280px; margin: 0 auto; } h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; } header p { color: var(--muted); margin: 6px 0 0; }
main { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 20px; padding: 16px 24px 64px; max-width: 1280px; margin: 0 auto; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.shot { display: block; height: 220px; overflow: hidden; } .shot img { width: 100%; display: block; }
.body { padding: 16px 18px 18px; } h2 { margin: 0; font-size: 18px; } .meta { color: var(--muted); margin: 4px 0; font-size: 12.5px; }
.sws { display: flex; gap: 4px; margin: 12px 0; flex-wrap: wrap; } .sw { width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--line); }
.type { font-size: 20px; margin: 8px 0 2px; } ul { margin: 10px 0; padding-left: 18px; } li { margin: 2px 0; font-size: 12.5px; } code { font-size: 11.5px; }
.notes li { color: var(--muted); }
</style></head><body>
<header><h1>relume catalogue</h1><p>${entries.length} measured design language${entries.length === 1 ? '' : 's'} — tokens, components and motion read from live sites, compiled into agent skills.</p></header>
<main>${cards || '<p>No entries yet — call extract_site.</p>'}</main></body></html>`;
}
