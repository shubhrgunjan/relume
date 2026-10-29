// Renders index.html frame by frame. Every frame is seek(t): no wall-clock animation anywhere.
//   node render.js --stills 1.2,4.5,...      → stills/t_<t>.jpg
//   node render.js --fps 120 --workers 10    → frames/f_000000.jpg ...
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = +arg('fps', 120), WORKERS = +arg('workers', 10);
const FROM = +arg('from', 0), TO = arg('to', null);
const stills = arg('stills', null);
const url = 'file://' + path.join(__dirname, 'index.html');

async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('pageerror', e.message));
  await page.goto(url);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
  });
  return page;
}

(async () => {
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb', '--font-render-hinting=none'] });
  if (stills) {
    fs.mkdirSync(path.join(__dirname, 'stills'), { recursive: true });
    const page = await open(browser);
    for (const s of stills.split(',')) {
      const t = +s;
      await page.evaluate(([t, f]) => window.seek(t, f), [t, Math.round(t * 60)]);
      await page.screenshot({ path: path.join(__dirname, 'stills', `t_${s}.jpg`), type: 'jpeg', quality: 90 });
    }
    await browser.close();
    return;
  }
  const dur = await (await open(browser)).evaluate(() => window.DURATION);
  const last = Math.round((TO != null ? +TO : dur) * FPS), first = Math.round(FROM * FPS);
  const out = path.join(__dirname, 'frames');
  fs.mkdirSync(out, { recursive: true });
  const per = Math.ceil((last - first) / WORKERS);
  const t0 = Date.now();
  let done = 0;
  await Promise.all([...Array(WORKERS)].map(async (_, w) => {
    const page = await open(browser);
    for (let f = first + w * per; f < Math.min(last, first + (w + 1) * per); f++) {
      await page.evaluate(([t, f]) => window.seek(t, f), [f / FPS, Math.floor(f * 60 / FPS)]);
      await page.screenshot({ path: path.join(out, `f_${String(f).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 95 });
      if (++done % 300 === 0) console.log(`${done}/${last - first} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));
  console.log(`rendered ${last - first} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await browser.close();
})();
