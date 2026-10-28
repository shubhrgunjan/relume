// Review renders of the landing page: desktop and mobile at scroll fractions, plus the compare dialog.
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch();
for (const [name, w, h] of [['d', 1440, 900], ['m', 390, 844]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
  const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const at = async (y, tag) => { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(1600); await p.screenshot({ path: `${out}/${name}-${tag}.jpg`, type: 'jpeg', quality: 70 }); };
  const top = (id) => p.evaluate((id) => document.getElementById(id).getBoundingClientRect().top + scrollY, id);
  const span = (id) => p.evaluate((id) => document.getElementById(id).offsetHeight - innerHeight, id);
  await at(0, '00-hero');
  await at(await top('hero') + (await span('hero')) * 0.6, '01-hero-swap');
  await at(await top('hero') + (await span('hero')) * 0.95, '02-hero-done');
  await at(await top('tunnel') + (await span('tunnel')) * 0.4, '03-tunnel');
  await at(await top('catalog') + 60, '04-catalog');
  await at(await top('burst') + (await span('burst')) * 0.5, '05-burst');
  await at(await top('dna') + (await span('dna')) * 0.5, '06-dna');
  await at(await top('check') + (await span('check')) * 0.8, '07-check');
  await at(await top('kaleido') + (await span('kaleido')) * 0.6, '08-kaleido');
  await at(H, '09-end');
  if (name === 'd') {
    await p.evaluate(async () => { document.querySelector('[data-open]').click(); });
    await p.waitForTimeout(6000);
    await p.screenshot({ path: `${out}/${name}-10-compare.jpg`, type: 'jpeg', quality: 70 });
    await p.click('.tabs button[data-mode="live"]'); await p.waitForTimeout(3500);
    await p.screenshot({ path: `${out}/${name}-11-live.jpg`, type: 'jpeg', quality: 70 });
  }
  console.log(name, 'errors', JSON.stringify(errs.slice(0, 5)));
}
await b.close();
