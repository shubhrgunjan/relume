// Crawl a site into raw evidence: per page, a desktop motion pass (load, wheel probe, scroll pass, hover pass,
// recorded on video) and static harvests at mobile/tablet/desktop and in dark mode, plus every stylesheet's text.
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROBE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'probe.js'), 'utf8');

export interface CrawlOptions {
  maxPages: number;
  viewports: { name: string; w: number; h: number }[];
  dark: boolean;
  hoverLimit: number;
  log: (msg: string) => void;
}

export const DEFAULT_VIEWPORTS = [
  { name: 'desktop', w: 1440, h: 900 },
  { name: 'tablet', w: 834, h: 1112 },
  { name: 'mobile', w: 390, h: 844 },
];

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

export function writeGz(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, gzipSync(JSON.stringify(data)));
}

/** Pick representative pages: home first, then one URL per distinct first path segment, nav links preferred. */
export async function discoverPages(page: Page, home: string, max: number): Promise<string[]> {
  const origin = new URL(home).origin;
  const links: { href: string; inNav: boolean }[] = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')].map((a) => ({
      href: (a as HTMLAnchorElement).href,
      inNav: !!a.closest('nav, header, footer, [role=navigation]'),
    })),
  );
  let sitemap: string[] = [];
  try {
    const res = await page.request.get(origin + '/sitemap.xml', { timeout: 8000 });
    if (res.ok()) sitemap = [...(await res.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]).slice(0, 2000);
  } catch {}
  const clean = (u: string) => { try { const x = new URL(u, origin); x.hash = ''; x.search = ''; return x.origin === origin ? x.href.replace(/\/$/, '') : null; } catch { return null; } };
  const skip = /\.(pdf|png|jpe?g|gif|svg|webp|zip|xml|json|txt|mp4)$|\/(login|signin|sign-in|signup|sign-up|cart|checkout|account|legal|privacy|terms|cookies?)(\/|$)/i;
  const out = [clean(home) ?? home];
  const bySeg = new Set<string>(['']);
  const ordered = [...links.filter((l) => l.inNav), ...links.filter((l) => !l.inNav), ...sitemap.map((href) => ({ href, inNav: false }))];
  for (const l of ordered) {
    const u = clean(l.href);
    if (!u || skip.test(u) || out.includes(u)) continue;
    const segs = new URL(u).pathname.split('/').filter(Boolean);
    // one per template: blog/a and blog/b share a template, keep the first; depth-2 pages count separately
    const key = segs.length > 1 ? segs[0] + '/*' : segs[0] ?? '';
    if (bySeg.has(key)) continue;
    bySeg.add(key);
    out.push(u);
    if (out.length >= max) break;
  }
  return out;
}

async function settle(page: Page, ms = 2500) {
  try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch {}
  try { await page.evaluate(() => document.fonts?.ready); } catch {}
  await page.waitForTimeout(ms);
}

async function closeOverlays(page: Page) {
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(150); }
  await page.mouse.click(4, Math.round((page.viewportSize()?.height || 900) / 2)).catch(() => {});
  await page.waitForTimeout(400);
}

async function dismissOverlays(page: Page) {
  // cookie banners hide the design; click the obvious accept/close and move on
  for (const sel of ['button:has-text("Accept all")', 'button:has-text("Accept")', 'button:has-text("Allow all")', 'button:has-text("I agree")', 'button:has-text("Got it")', '[aria-label="Close"]', '#onetrust-accept-btn-handler']) {
    try { const b = page.locator(sel).first(); if (await b.isVisible({ timeout: 300 })) { await b.click({ timeout: 1000 }); await page.waitForTimeout(500); return; } } catch {}
  }
}

/** Wheel the page to the bottom at a steady reading pace, as a person would, so scroll-driven motion fires. */
async function scrollPass(page: Page, stepPx = 100, everyMs = 70, capMs = 70000) {
  // wheel from the right edge so content scrolling past does not get hovered (hover motion is measured separately)
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width - 3, Math.round(vp.height / 2));
  const t0 = Date.now();
  let last = -1, still = 0;
  while (Date.now() - t0 < capMs) {
    await page.mouse.wheel(0, stepPx);
    await page.waitForTimeout(everyMs);
    const y = await page.evaluate(() => Math.round(scrollY));
    if (Math.abs(y - last) < 2) { if (++still > 25) break; } else still = 0;
    last = y;
  }
}

async function toTop(page: Page) {
  await page.evaluate(() => {
    const l = (window as any).lenis || (window as any).__lenis;
    if (l?.scrollTo) l.scrollTo(0, { immediate: true }); else window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  });
  await page.waitForTimeout(1200);
}

/** Pick hover candidates: visible interactive things, one per distinct style signature. */
async function hoverCandidates(page: Page, limit: number) {
  return page.evaluate((limit) => {
    const R = (window as any).__relume;
    const els = [...document.querySelectorAll('a, button, [role=button], [role=tab], input, select, textarea, [tabindex], summary, label, li, article, [class*=card i]')];
    for (const el of document.body.getElementsByTagName('*')) if (getComputedStyle(el).cursor === 'pointer' && !els.includes(el)) els.push(el);
    const seen = new Set<string>();
    const out: { id: number; sig: string }[] = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.height < 12 || r.width > innerWidth * 0.95 && r.height > 400) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const interactive = cs.cursor === 'pointer' || /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName);
      if (!interactive) continue;
      const sig = [el.tagName, cs.backgroundColor, cs.color, cs.borderTopLeftRadius, cs.borderTopWidth, cs.fontSize, cs.transitionProperty, Math.round(r.height / 8)].join('|');
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push({ id: R.idOf(el), sig });
      if (out.length >= limit) break;
    }
    return out;
  }, limit);
}

async function hoverPass(page: Page, limit: number, log: (m: string) => void) {
  const cands = await hoverCandidates(page, limit);
  const results: { id: number; before: any; during: any; focus?: any }[] = [];
  const snap = (id: number) => page.evaluate((id) => {
    const el = document.querySelector(`[data-relume-id="${id}"]`);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const k = ['color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'boxShadow', 'transform', 'opacity', 'textDecorationLine', 'outlineStyle', 'outlineColor', 'outlineWidth', 'outlineOffset', 'filter', 'scale', 'translate'];
    const o: Record<string, string> = {};
    for (const p of k) o[p] = (cs as any)[p];
    const after = getComputedStyle(el, '::after'), before = getComputedStyle(el, '::before');
    o['::after.transform'] = after.transform; o['::after.opacity'] = after.opacity; o['::after.width'] = after.width;
    o['::before.transform'] = before.transform; o['::before.opacity'] = before.opacity; o['::before.width'] = before.width;
    // children that change on hover (icon arrows, image zoom) are caught by the motion recorder
    return o;
  }, id);
  for (const c of cands) {
    try {
      const loc = page.locator(`[data-relume-id="${c.id}"]`).first();
      await loc.scrollIntoViewIfNeeded({ timeout: 2000 });
      await page.waitForTimeout(500);
      const box = await loc.boundingBox();
      if (!box) continue;
      await page.mouse.move(5, 5);
      await page.waitForTimeout(250);
      const before = await snap(c.id);
      await page.evaluate((id) => (window as any).__relume.mark('hover:' + id), c.id);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
      await page.waitForTimeout(900);
      const during = await snap(c.id);
      await page.evaluate((id) => (window as any).__relume.mark('unhover:' + id), c.id);
      await page.mouse.move(5, 5, { steps: 4 });
      await page.waitForTimeout(700);
      // keyboard focus ring, without a click
      const focus = await page.evaluate((id) => {
        const el = document.querySelector(`[data-relume-id="${id}"]`) as HTMLElement | null;
        if (!el || typeof el.focus !== 'function') return null;
        el.focus({ focusVisible: true } as any);
        if (document.activeElement !== el) return null;
        const cs = getComputedStyle(el);
        const o = { outlineStyle: cs.outlineStyle, outlineColor: cs.outlineColor, outlineWidth: cs.outlineWidth, outlineOffset: cs.outlineOffset, boxShadow: cs.boxShadow, backgroundColor: cs.backgroundColor, borderTopColor: cs.borderTopColor };
        el.blur();
        return o;
      }, c.id);
      results.push({ id: c.id, before, during, focus });
    } catch (e) {
      log(`  hover ${c.id} skipped: ${(e as Error).message.split('\n')[0]}`);
    }
  }
  return results;
}

/** Wheel probe: one notch and a quick burst, sampling scrollY every frame. Measures the scroll "feel". */
async function wheelProbe(page: Page) {
  await toTop(page);
  const vp = page.viewportSize()!;
  await page.mouse.move(vp.width - 3, Math.round(vp.height / 2));
  await page.evaluate(() => (window as any).__relume.mark('wheel:single'));
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(1800);
  await page.evaluate(() => (window as any).__relume.mark('wheel:burst'));
  for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(30); }
  await page.waitForTimeout(2200);
  await page.evaluate(() => (window as any).__relume.mark('wheel:end'));
}

async function attachCss(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const sheets = new Map<string, { url: string; origin: string; inline: boolean }>();
  cdp.on('CSS.styleSheetAdded', (e: any) => sheets.set(e.header.styleSheetId, { url: e.header.sourceURL, origin: e.header.origin, inline: e.header.isInline }));
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  return async () => {
    const out: { url: string; inline: boolean; text: string }[] = [];
    for (const [id, h] of sheets) {
      if (h.origin !== 'regular') continue;
      try { const { text } = await cdp.send('CSS.getStyleSheetText', { styleSheetId: id }) as any; if (text) out.push({ url: h.url, inline: h.inline, text: text.slice(0, 3_000_000) }); } catch {}
    }
    return out;
  };
}

async function screenshot(page: Page, path: string) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  mkdirSync(dirname(path), { recursive: true });
  try {
    await page.screenshot({ path, fullPage: h < 20000, type: 'jpeg', quality: 82, timeout: 30000 });
  } catch {
    await page.screenshot({ path, type: 'jpeg', quality: 82 });
  }
}

/** Desktop motion pass + full harvest for one page. */
async function motionVisit(browser: Browser, url: string, dir: string, opt: CrawlOptions, isHome: boolean) {
  const vp = opt.viewports[0];
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, userAgent: UA, recordVideo: { dir: join(dir, 'video-tmp'), size: { width: 1280, height: 800 } }, reducedMotion: 'no-preference', colorScheme: 'light' });
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  const cssText = await attachCss(page);
  const t0 = Date.now();
  const lap = (what: string) => opt.log(`  ${what} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => (window as any).__relume.mark('loaded'));
  await settle(page, 3000);
  await dismissOverlays(page);
  lap('loaded');
  if (isHome) { await wheelProbe(page); lap('wheel probe'); }
  await toTop(page);
  await page.evaluate(() => (window as any).__relume.mark('scroll:start'));
  await scrollPass(page);
  await page.evaluate(() => (window as any).__relume.mark('scroll:end'));
  lap('scroll pass');
  await page.waitForTimeout(1500);
  await toTop(page);
  const hovers = await hoverPass(page, opt.hoverLimit, opt.log);
  lap(`hover pass (${hovers.length})`);
  // hovering can open menus and modals; close them so they are not captured as page content
  await closeOverlays(page);
  await toTop(page);
  const harvest = await page.evaluate(() => (window as any).__relume.harvest());
  const libraries = await page.evaluate(() => (window as any).__relume.libraries());
  const motion = await page.evaluate(() => (window as any).__relume.collect());
  const css = await cssText();
  lap(`harvest (frames ${motion.stats?.frames}, over budget ${motion.stats?.overBudget}, peak tracks ${motion.stats?.maxActive})`);
  await screenshot(page, join(dir, `shot-${vp.name}.jpg`));
  const video = page.video();
  await ctx.close();
  if (video) { try { renameSync(await video.path(), join(dir, 'motion.webm')); } catch {} }
  writeGz(join(dir, `harvest-${vp.name}.json.gz`), harvest);
  writeGz(join(dir, 'motion.json.gz'), { ...motion, hovers, libraries });
  writeGz(join(dir, 'css.json.gz'), css);
  return { rows: harvest.rows.length, tracks: motion.tracks.length, anims: motion.anims.length, css: css.length, libraries, sig: `${harvest.title}|${harvest.docHeight}|${harvest.rows.length}` };
}

async function staticVisit(browser: Browser, url: string, dir: string, vp: { name: string; w: number; h: number }, scheme: 'light' | 'dark') {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, userAgent: UA, colorScheme: scheme, isMobile: vp.w < 600, hasTouch: vp.w < 600, deviceScaleFactor: 1 });
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await settle(page, 2000);
  await dismissOverlays(page);
  // fast pass to trigger lazy content and one-shot reveals before measuring
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.7) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
  await page.waitForTimeout(1500);
  const harvest = await page.evaluate(() => (window as any).__relume.harvest());
  const tag = scheme === 'dark' ? `${vp.name}-dark` : vp.name;
  await screenshot(page, join(dir, `shot-${tag}.jpg`));
  await ctx.close();
  writeGz(join(dir, `harvest-${tag}.json.gz`), harvest);
  return harvest.rows.length;
}

export function pageKey(url: string) {
  const p = new URL(url).pathname.replace(/\/$/, '');
  return p ? p.slice(1).replace(/[^a-z0-9]+/gi, '-').slice(0, 60) : 'home';
}

export async function crawlSite(home: string, outDir: string, opt: CrawlOptions) {
  const browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--disable-blink-features=AutomationControlled'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
    const p = await ctx.newPage();
    await p.goto(home, { waitUntil: 'load', timeout: 60000 });
    await settle(p, 1000);
    const pages = await discoverPages(p, p.url(), opt.maxPages * 2 + 2);
    await ctx.close();
    opt.log(`candidates: ${pages.join(', ')}`);
    const summary: any[] = [];
    const sigs = new Set<string>();
    for (const [i, url] of pages.entries()) {
      if (summary.filter((s) => s.ok).length >= opt.maxPages) break;
      // two URLs can share a key (/ and /home); never let the second one touch the first one's evidence
      if (summary.some((s) => s.key === pageKey(url))) continue;
      const dir = join(outDir, 'pages', pageKey(url));
      opt.log(`[${summary.filter((s) => s.ok).length + 1}/${opt.maxPages}] ${url}`);
      try {
        const m = await motionVisit(browser, url, dir, opt, i === 0);
        // the same document under another URL (/ and /homepage) adds nothing
        if (sigs.has(m.sig)) { opt.log('  duplicate of an earlier page, skipped'); rmSync(dir, { recursive: true, force: true }); continue; }
        sigs.add(m.sig);
        opt.log(`  desktop: ${m.rows} elements, ${m.tracks} motion tracks, ${m.anims} animations, ${m.css} stylesheets`);
        const stat: Record<string, number> = { desktop: m.rows };
        for (const vp of opt.viewports.slice(1)) stat[vp.name] = await staticVisit(browser, url, dir, vp, 'light');
        if (opt.dark && i === 0) stat['desktop-dark'] = await staticVisit(browser, url, dir, opt.viewports[0], 'dark');
        summary.push({ url, key: pageKey(url), ok: true, stat, libraries: m.libraries });
      } catch (e) {
        opt.log(`  failed: ${(e as Error).message.split('\n')[0]}`);
        summary.push({ url, key: pageKey(url), ok: false, error: (e as Error).message.split('\n')[0] });
      }
      try { for (const f of readdirSync(join(dir, 'video-tmp'))) renameSync(join(dir, 'video-tmp', f), join(dir, 'extra-' + f)); } catch {}
    }
    writeFileSync(join(outDir, 'crawl.json'), JSON.stringify({ home, at: new Date().toISOString(), pages: summary }, null, 2));
    return summary;
  } finally {
    await browser.close();
  }
}
