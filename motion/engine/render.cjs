// Render a composition to video. A composition is an HTML page that sets window.DURATION and window.seek(t, frame)
// and draws every frame as a function of t (no wall clock). Frames are written as JPEGs and encoded with ffmpeg.
//   node engine/render.cjs --page projects/x/index.html --out work/renders/x.mp4 [--fps 24] [--size 1280x720]
//                          [--audio file] [--workers 6] [--from 0 --to 10] [--stills 1.2,3.4 --stills-dir dir]
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PAGE = path.resolve(arg('page')), OUT = arg('out') && path.resolve(arg('out'));
const FPS = +arg('fps', 24), WORKERS = +arg('workers', 6);
const [W, H] = arg('size', '1280x720').split('x').map(Number);
const stills = arg('stills', null);

async function open(browser) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console', m.text()));
  await page.goto('file://' + PAGE);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    if (window.READY) await window.READY;          // compositions may build textures before the first frame
  });
  return page;
}

(async () => {
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-gpu-vsync'] });
  if (stills) {
    const dir = path.resolve(arg('stills-dir', path.join(path.dirname(PAGE), 'stills')));
    fs.mkdirSync(dir, { recursive: true });
    const page = await open(browser);
    for (const s of stills.split(',')) { await page.evaluate(([t, f]) => window.seek(t, f), [+s, Math.round(+s * FPS)]); await page.screenshot({ path: path.join(dir, `t_${s}.jpg`), type: 'jpeg', quality: 90 }); }
    await browser.close(); return;
  }
  const dur = await (await open(browser)).evaluate(() => window.DURATION);
  const first = Math.round(+arg('from', 0) * FPS), last = Math.round(+(arg('to', null) ?? dur) * FPS);
  const frames = path.join(path.dirname(OUT), path.basename(OUT, '.mp4') + '.frames');
  fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
  const per = Math.ceil((last - first) / WORKERS), t0 = Date.now(); let done = 0;
  await Promise.all([...Array(WORKERS)].map(async (_, w) => {
    const page = await open(browser);
    for (let f = first + w * per; f < Math.min(last, first + (w + 1) * per); f++) {
      await page.evaluate(([t, f]) => window.seek(t, f), [f / FPS, f]);
      await page.screenshot({ path: path.join(frames, `f_${String(f - first).padStart(6, '0')}.jpg`), type: 'jpeg', quality: 94 });
      if (++done % 240 === 0) console.log(`${done}/${last - first} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));
  await browser.close();
  const audio = arg('audio', null);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f_%06d.jpg'), ...(audio ? ['-i', audio] : []),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : []), '-movflags', '+faststart', OUT]);
  fs.rmSync(frames, { recursive: true, force: true });
  console.log(`rendered ${last - first} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${OUT}`);
})();
