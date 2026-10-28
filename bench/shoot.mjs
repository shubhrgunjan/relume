// Screenshot a page at scroll fractions (desktop + mobile) to review a build.
import { chromium } from 'playwright';
const [url, out = 'shots', ...fr] = process.argv.slice(2);
const fractions = fr.length ? fr.map(Number) : [0, 0.08, 0.2, 0.3, 0.42, 0.55, 0.68, 0.8, 0.95];
const b = await chromium.launch();
for (const [name, w, h] of [['d', 1440, 900], ['m', 390, 844]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2600);
  const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (const f of fractions) {
    await p.evaluate((y) => scrollTo(0, y), Math.round(H * f));
    await p.waitForTimeout(1400);
    await p.screenshot({ path: `${out}/${name}-${String(Math.round(f * 100)).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 70 });
  }
  console.log(name, 'height', H, 'errors', JSON.stringify(errs));
}
await b.close();
