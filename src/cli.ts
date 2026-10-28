// relume CLI: extract a site into the catalogue, re-run inference, compile skills, list entries.
import { crawlSite, DEFAULT_VIEWPORTS } from './crawl/crawl.js';
import { entryDir, slugFor, listEntries } from './catalog/catalog.js';
import { buildDna } from './infer/dna.js';
import { compileSkill } from './skill/compile.js';
import { checkStyle, reportMd } from './verify/check.js';
import { compareDna } from './verify/compare.js';
import { readJson } from './catalog/catalog.js';
import { join } from 'node:path';

const [cmd, ...rest] = process.argv.slice(2);
const flags: Record<string, string> = {};
const args: string[] = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { const k = rest[i].slice(2); flags[k] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true'; }
  else args.push(rest[i]);
}
const log = (m: string) => console.log(m);

async function main() {
  switch (cmd) {
    case 'crawl': {
      const url = args[0];
      const slug = flags.slug || slugFor(url);
      const t = Date.now();
      await crawlSite(url, entryDir(slug), {
        maxPages: +(flags.pages || 5), viewports: DEFAULT_VIEWPORTS, dark: flags.dark !== 'false',
        hoverLimit: +(flags.hovers || 30), log,
      });
      log(`crawled ${slug} in ${((Date.now() - t) / 1000).toFixed(0)}s`);
      break;
    }
    case 'infer': {
      const slug = args[0];
      const t = Date.now();
      const dna = await buildDna(entryDir(slug), slug);
      log(`dna for ${slug}: ${dna.color.tokens.length} colours, ${dna.typography.styles.length} text styles, ${dna.components.length} components, ${dna.motion.patterns.length} motion patterns (${Date.now() - t}ms)`);
      for (const n of dna.feel.notes) log('  · ' + n);
      break;
    }
    case 'skill': {
      const slug = args[0];
      const out = compileSkill(readJson(join(entryDir(slug), 'dna.json')), entryDir(slug));
      log(`skill: ${out}`);
      break;
    }
    case 'extract': {
      const url = args[0];
      const slug = flags.slug || slugFor(url);
      const t = Date.now();
      await crawlSite(url, entryDir(slug), { maxPages: +(flags.pages || 5), viewports: DEFAULT_VIEWPORTS, dark: flags.dark !== 'false', hoverLimit: +(flags.hovers || 30), log });
      const dna = await buildDna(entryDir(slug), slug);
      for (const n of dna.feel.notes) log('  · ' + n);
      log(`skill: ${compileSkill(dna, entryDir(slug))} (${((Date.now() - t) / 1000).toFixed(0)}s)`);
      break;
    }
    case 'check': {
      const { report } = await checkStyle(args[0], args[1], log);
      log(reportMd(report));
      break;
    }
    case 'compare': {
      // compare two catalogue entries' DNA directly (calibration: unrelated sites should score low)
      const r = compareDna(readJson(join(entryDir(args[0]), 'dna.json')), readJson(join(entryDir(args[1]), 'dna.json')));
      log(reportMd(r));
      break;
    }
    case 'list':
      for (const e of listEntries()) log(`${e.slug.padEnd(32)} ${e.url}`);
      break;
    default:
      log('usage: relume extract <url> [--pages 5] [--hovers 30] [--dark false] | crawl <url> | infer <slug> | skill <slug> | list');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
