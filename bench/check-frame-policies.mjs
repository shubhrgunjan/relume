// Refresh before publishing catalogue changes: node bench/check-frame-policies.mjs
import { readFile, writeFile } from 'node:fs/promises';
const pairs = JSON.parse(await readFile(new URL('../site/data/compare.json', import.meta.url), 'utf8'));
const origin = 'https://relume.shubhrgunjan.me';
const entries = await Promise.all(pairs.map(async d => {
  const url = d.source.page || d.source.url;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RelumeComparison/1.0)' } });
    const csp = res.headers.get('content-security-policy') || '';
    const ancestors = [...csp.matchAll(/(?:^|[;,])\s*frame-ancestors\s+([^;,]*)/gi)].map(m => m[1].trim().split(/\s+/));
    const xfo = (res.headers.get('x-frame-options') || '').toUpperCase();
    // Be conservative for unsupported source expressions: use separate live windows.
    // CSP frame-ancestors overrides X-Frame-Options when both are present.
    const allowed = ancestors.length ? ancestors.every(tokens => tokens.includes('*') || tokens.includes(origin) || (tokens.includes("'self'") && new URL(res.url).origin === origin)) : !/DENY|SAMEORIGIN/.test(xfo);
    await res.body?.cancel();
    return [d.id, { url, embeddable: res.ok ? allowed : null, checkedAt: new Date().toISOString() }];
  } catch { return [d.id, { url, embeddable: null, checkedAt: new Date().toISOString() }]; }
}));
const result = Object.fromEntries(entries);
await writeFile(new URL('../site/data/frame-policies.json', import.meta.url), JSON.stringify(result, null, 2)+'\n');
console.log(result);
