// The catalogue: one directory per converted site under data/catalog/<slug>/, growing with every extraction.
//   crawl.json            pages visited, libraries seen
//   pages/<key>/          raw evidence: harvest-<viewport>.json.gz, motion.json.gz, css.json.gz, shots, motion.webm
//   dna.json              the inferred design language
//   skill/                the compiled agent skill
//   checks/               verification runs against this entry
import { existsSync, readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';

export const DATA = resolve(process.env.RELUME_DATA || 'data');
export const CATALOG = join(DATA, 'catalog');

export function slugFor(url: string) {
  const u = new URL(url);
  const path = u.pathname.replace(/\/$/, '');
  return (u.hostname.replace(/^www\./, '') + (path ? path.replace(/[^a-z0-9]+/gi, '-') : '')).toLowerCase().replace(/[^a-z0-9.-]+/g, '-').slice(0, 80);
}

export function entryDir(slug: string) {
  const d = join(CATALOG, slug);
  mkdirSync(d, { recursive: true });
  return d;
}

export function readGz<T = any>(path: string): T {
  return JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'));
}

export function readJson<T = any>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function listEntries() {
  if (!existsSync(CATALOG)) return [];
  return readdirSync(CATALOG)
    .filter((s) => existsSync(join(CATALOG, s, 'crawl.json')))
    .map((slug) => {
      const c = readJson(join(CATALOG, slug, 'crawl.json'));
      const dna = existsSync(join(CATALOG, slug, 'dna.json')) ? readJson(join(CATALOG, slug, 'dna.json')) : null;
      return { slug, url: c.home as string, at: c.at as string, pages: c.pages.length as number, dna };
    });
}
