// check_style: measure a candidate page with the same pipeline as the source, compare DNA, keep the report in
// the entry's checks/ so the catalogue remembers which parts of each language agents get wrong.
import { appendFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { crawlSite, DEFAULT_VIEWPORTS } from '../crawl/crawl.js';
import { buildDna, type DNA } from '../infer/dna.js';
import { entryDir, readJson } from '../catalog/catalog.js';
import { compareDna, type Report } from './compare.js';

export async function checkStyle(slug: string, url: string, log: (m: string) => void = () => {}) {
  const src: DNA = readJson(join(entryDir(slug), 'dna.json'));
  const id = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(entryDir(slug), 'checks', id);
  mkdirSync(dir, { recursive: true });
  await crawlSite(url, dir, { maxPages: 1, viewports: DEFAULT_VIEWPORTS, dark: false, hoverLimit: 20, log });
  const cand = await buildDna(dir, slug + '-check');
  const report = compareDna(src, cand);
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report, null, 1));
  writeFileSync(join(dir, 'report.md'), reportMd(report));
  appendFileSync(join(entryDir(slug), 'checks', 'index.jsonl'), JSON.stringify({ id, url, overall: report.overall, scores: report.scores, pass: report.pass, top: report.findings.slice(0, 8).map((f) => f.dimension + ': ' + f.message) }) + '\n');
  return { id, dir, report };
}

export function reportMd(r: Report) {
  const bar = (v: number) => '█'.repeat(Math.round(v / 10)) + '░'.repeat(10 - Math.round(v / 10));
  return `# Style check: ${r.candidate} vs ${r.source}

**Overall ${r.overall}/100 — ${r.pass ? 'PASS' : 'NOT YET'}** (pass = every dimension ≥ 85 and no severe finding)

${Object.entries(r.scores).map(([k, v]) => `- ${k.padEnd(8)} ${bar(v)} ${v}`).join('\n')}

## Fix first
${r.findings.map((f, i) => `${i + 1}. [${f.dimension}] ${f.message}\n   → ${f.fix}`).join('\n') || 'Nothing to fix.'}
`;
}

/** What agents most often get wrong for this language: the catalogue's memory of past checks. */
export function pitfalls(slug: string) {
  const f = join(entryDir(slug), 'checks', 'index.jsonl');
  if (!existsSync(f)) return [];
  const counts = new Map<string, number>();
  for (const line of readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
    const c = JSON.parse(line);
    for (const t of c.top as string[]) { const k = t.replace(/[\d.]+(px|ms|%)?/g, 'N').slice(0, 120); counts.set(k, (counts.get(k) || 0) + 1); }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([pattern, n]) => ({ pattern, n }));
}
