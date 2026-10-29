// Render the link-preview card (site/og.jpg, 1200×630) from site/og/card.html with one catalogue pair.
// Usage: node bench/og-card.mjs <site-base-url> <pair-id> <out.jpg>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const [base, id = 'spoke', out = 'site/og.jpg'] = process.argv.slice(2);
const pairs = JSON.parse(readFileSync('site/data/compare.json', 'utf8'));
const d = pairs.find((p) => p.id === id) || pairs[0];
const host = new URL(d.source.url).hostname.replace(/^www\./, '');
const q = new URLSearchParams({ a: `${base}/media/${d.id}-source.jpg`, b: `${base}/media/${d.id}-recreation.jpg`, ta: `${host} · measured`, tb: `${d.name || d.id} · built with relume`, s: String(d.report.overall) });
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await p.goto(`${base}/og/card.html?${q}`, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(500);
const png = await p.screenshot({ type: 'png' });
await b.close();
// WhatsApp drops previews over ~300 KB
await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
console.log(out);
