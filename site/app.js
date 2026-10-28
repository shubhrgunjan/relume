// relume landing: scroll-scrubbed scenes, the catalogue of recreations and a synced live comparison.
import Lenis from 'https://cdn.jsdelivr.net/npm/lenis@1.1.20/dist/lenis.mjs';

const C = { ink: '#141115', ink2: '#1c181d', paper: '#f2f0f3', lime: '#c4f46e', volt: '#c0f63c', forest: '#4a7a56', lilac: '#f4dcf8', plum: '#9c78a8', salmon: '#ee9070', sky: '#3fa0e8', sun: '#f5e14a', chip: '#8c8496', line: '#3a343c' };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 4);
const BAYER = [0,48,12,60,3,51,15,63,32,16,44,28,35,19,47,31,8,56,4,52,11,59,7,55,40,24,36,20,43,27,39,23,2,50,14,62,1,49,13,61,34,18,46,30,33,17,45,29,10,58,6,54,9,57,5,53,42,26,38,22,41,25,37,21].map((v) => v / 64);
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v); };
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;
const rgbC = {};
const rgb = (h) => rgbC[h] || (rgbC[h] = [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// findings read as sentences: drop generated class chains and inline JSON
const tidy = (m) => String(m || '').replace(/\b([a-z][a-z0-9]*)(?:\.[A-Za-z_][\w-]*)+/g, '$1').replace(/\{[^{}]*\}/g, '').replace(/\s+—\s+→\s+/g, ' ').replace(/\(×\d+\)\s*—?\s*/g, '').replace(/\s{2,}/g, ' ').trim();
const DIMS = ['color', 'type', 'spacing', 'shape', 'layout', 'motion', 'feel'];
const NAMES = { linear: 'Tessera', stripe: 'Ledgerline', vercel: 'Northwind Edge', lenis: 'Drift' };
const SOURCES = { linear: 'linear.app', stripe: 'stripe.com', vercel: 'vercel.com', lenis: 'lenis.dev' };

// smooth scrolling, as the best sites in the catalogue do it (lenis.dev measured at lerp 0.14)
const lenis = reduce ? null : new Lenis({ lerp: 0.12 });
document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const t = document.querySelector(a.getAttribute('href'));
  if (!t) return;
  e.preventDefault();
  lenis ? lenis.scrollTo(t, { duration: 1.4 }) : t.scrollIntoView();
}));

const data = await fetch('data/compare.json').then((r) => r.json()).catch(() => []);
const lead = data.find((d) => d.id === 'linear') || data[0];

// ---------- frame loop: sticky scenes read a damped progress
const scenes = {};
const reg = (id, fn) => { scenes[id] = { el: document.getElementById(id), p: 0, fn }; };
let lastY = scrollY, vel = 0;
const t0 = performance.now();
function frame(now) {
  const t = (now - t0) / 1000, vh = innerHeight;
  lenis?.raf(now);
  vel = lerp(vel, scrollY - lastY, 0.15); lastY = scrollY;
  nav.classList.toggle('scrolled', scrollY > 40);
  for (const s of Object.values(scenes)) {
    const r = s.el.getBoundingClientRect();
    const target = clamp(-r.top / Math.max(1, r.height - vh));
    s.p = reduce ? target : lerp(s.p, target, 0.14);
    if (r.bottom > -vh * 0.2 && r.top < vh * 1.2) s.fn(s.p, t);
  }
  requestAnimationFrame(frame);
}
const nav = document.getElementById('nav');
function pixelCanvas(cv, cell) {
  const ctx = cv.getContext('2d'), st = { cv, ctx, w: 1, h: 1, cell };
  const fit = () => { const r = cv.getBoundingClientRect(); st.w = Math.max(1, Math.round(r.width / st.cell)); st.h = Math.max(1, Math.round(r.height / st.cell)); cv.width = st.w; cv.height = st.h; };
  fit(); addEventListener('resize', fit);
  return st;
}
function setEcho(el, txt) {
  if (el.dataset.v === txt) return;
  el.dataset.v = txt;
  el.innerHTML = [3, 2, 1].map((k) => `<span style="transform:translate(${-k * 10}px, ${k * 9}px)">${txt}</span>`).join('') + `<b>${txt}</b>`;
}
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
const watch = () => document.querySelectorAll('[data-wipe]:not(.in),[data-rise]:not(.in)').forEach((el) => io.observe(el));

// =========== 1. HERO: linear.app measured, dissolving into Tessera; the boxes land on the same measurements
const heroA = document.getElementById('heroA'), heroB = document.getElementById('heroB'), annot = document.getElementById('annot');
const urlEl = document.getElementById('heroUrl'), stateEl = document.getElementById('heroState');
const mask = pixelCanvas(document.getElementById('heroMask'), 6);
let heroBoxes = [];
if (lead) {
  heroA.src = `media/${lead.id}-source.jpg`;
  heroB.src = `media/${lead.id}-recreation.jpg`;
  heroBoxes = lead.source.annotations.items.map((a) => {
    const d = document.createElement('div');
    d.className = `box k-${a.kind}`;
    d.innerHTML = `<span>${esc(a.label)}</span>`;
    annot.appendChild(d);
    return { el: d, a, b: lead.recreation.annotations.items.find((x) => x.kind === a.kind) };
  });
}
const place = (el, box, vp) => { el.style.left = (box[0] / vp[0] * 100) + '%'; el.style.top = (box[1] / vp[1] * 100) + '%'; el.style.width = (box[2] / vp[0] * 100) + '%'; el.style.height = (box[3] / vp[1] * 100) + '%'; };
const PHASES = ['measuring linear.app', 'measured', 'building from the skill', 'recreated'];
let heroPhase = -1;
reg('hero', (p, t) => {
  if (!lead) return;
  const { ctx, w, h } = mask;
  // 0 → 0.4: the original resolves out of a dither and its measurements appear; 0.42 → 0.72: a pixel front
  // sweeps the recreation in and the boxes slide onto its matching elements; past 0.74 the check score counts up
  const intro = reduce ? 1 : clamp((t - 0.2) / 1.8);
  const swap = clamp((p - 0.42) / 0.3);
  const phase = intro < 1 ? 0 : swap <= 0 ? 1 : swap < 1 ? 2 : 3;
  if (phase !== heroPhase) {
    heroPhase = phase;
    const recreated = phase >= 2;
    urlEl.innerHTML = recreated ? `<b>tessera</b> <em>· built from the linear.app skill</em>` : `<b>linear.app</b> <span>· measured by relume</span>`;
    stateEl.innerHTML = `<span class="chip${recreated ? '' : ' dim'}">${PHASES[phase]}</span>`;
    heroBoxes.forEach(({ el, a, b }) => { const s = recreated && b ? b : a; place(el, s.box, lead.source.annotations.viewport); el.querySelector('span').textContent = s.label; });
  }
  const front = swap * 1.35;
  heroB.style.opacity = swap > 0 ? '1' : '0';
  heroB.style.clipPath = swap >= 1 ? 'none' : `polygon(0 0, ${front * 100}% 0, ${front * 100 - 35}% 100%, 0 100%)`;
  const img = ctx.createImageData(w, h), d = img.data, ink = rgb(C.ink), volt = rgb(C.volt), paper = rgb(C.paper);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const th = BAYER[(y & 7) * 8 + (x & 7)], u = x / w, v = y / h, k = (y * w + x) * 4;
    if (easeOut(intro) * 1.4 - Math.hypot(u - 0.5, v - 0.4) < th) { d[k] = ink[0]; d[k + 1] = ink[1]; d[k + 2] = ink[2]; d[k + 3] = 255; continue; }
    // a dithered seam rides the front of the swap
    const edge = front - (u + v * 0.35);
    if (swap > 0 && swap < 1 && edge > -0.04 && edge < 0.02 + th * 0.04) { const c = th > 0.5 ? volt : paper; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
  annot.style.opacity = intro >= 1 ? '1' : '0';
  document.getElementById('heroScore').classList.toggle('on', swap >= 1);
  document.getElementById('heroScoreN').textContent = String(Math.round(lead.report.overall * clamp((p - 0.74) / 0.12))).padStart(2, '0');
});

// =========== 2. TUNNEL: the pipeline as nested windows
const STEPS = [
  ['crawl.ts', 'Crawl', 'Representative pages at desktop, tablet, mobile and dark mode, one per template.', `<u>const</u> pages = <i>await</i> discoverPages(home, 4)\n<u>for</u> (vp <u>of</u> [1440, 834, 390])\n  harvest(page, vp)\nharvest(page, 1440, <i>'dark'</i>)`],
  ['probe.js', 'Record', 'Anything that moves is sampled every frame until it settles, and every animation is logged with its keyframes.', `requestAnimationFrame(frame)\n<u>for</u> (tr <u>of</u> tracks)\n  tr.samples.push(read(tr.el))\ndocument.getAnimations()`],
  ['wheel.probe', 'Feel the scroll', 'One wheel notch, sampled per frame: native or smoothed, and the lerp that reproduces it.', `mouse.wheel(0, 100)\nt90 = <i>309ms</i>  settle = <i>548ms</i>\nlerp = 1000 / (60 · τ) = <i>0.14</i>`],
  ['hover.pass', 'Touch everything', 'Every distinct button, link and card is hovered and focused, transitions included.', `.button-primary:hover\n  background <i>#ffffff</i>\n  <i>160ms</i> cubic-bezier(.25,.46,.45,.94)\n:focus-visible <i>1px #5e69d1</i>`],
  ['tokens.ts', 'Infer the language', 'Colour roles by painted area, type with fluid sizes, the grid, radii, borders and shadows.', `--color-surface: <i>#0f1011</i>\n  <u>/* source: --color-bg-level-1 */</u>\n--radius-2: <i>9px</i>`],
  ['motion.ts', 'Name the motion', 'Intros, reveals with entry points and stagger, scroll-linked moves, springs kept exact.', `intro-fade-blur-up-1\n  opacity 0 · blur(<i>10px</i>) · y <i>20%</i>\n  <i>1000ms</i>  stagger <i>34ms</i>`],
  ['SKILL.md', 'Compile a skill', 'SKILL.md, tokens.css, Tailwind theme, DTCG tokens, motion.css, motion.js and a lint script.', `linear-design-language/\n  SKILL.md\n  assets/tokens.css  motion.js\n  scripts/lint.mjs`],
  ['check.ts', 'Check the work', "Your agent's page is measured by the same pipeline and scored dimension by dimension.", `check_style(<i>'linear.app'</i>, url)\nlayout <i>100</i>  type <i>93</i>\nmotion <i>58</i> → fix first`],
];
const PALS = [[C.sky, C.paper], [C.lime, C.forest], [C.salmon, C.ink], [C.lilac, C.plum], [C.paper, C.chip], [C.volt, C.ink], [C.forest, C.lime], [C.lilac, C.ink]];
const vp = document.getElementById('tunnelVp'), stepsEl = document.getElementById('steps'), tEcho = document.getElementById('tunnelEcho'), tHead = document.getElementById('tunnelHead');
const wins = STEPS.map(([file, title, text, code], i) => {
  const w = document.createElement('div');
  w.className = 'win';
  w.innerHTML = `<div class="wbar"><em></em><span>${file}</span><em></em></div><div class="body"><pre>${code}</pre><canvas width="40" height="40"></canvas></div>`;
  vp.appendChild(w);
  const s = document.createElement('div');
  s.className = 'step';
  s.innerHTML = `<span class="chip dim">${String(i + 1).padStart(2, '0')} / ${file}</span><h3 class="disp">${title}</h3><p>${text}</p>`;
  stepsEl.appendChild(s);
  const cv = w.querySelector('canvas'), cx = cv.getContext('2d'), im = cx.createImageData(40, 40), pal = PALS[i];
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) { const n = fbm(x / 8 + i * 3, y / 8 + i), c = rgb(n > 0.46 + BAYER[(y & 7) * 8 + (x & 7)] * 0.2 ? pal[0] : pal[1]), k = (y * 40 + x) * 4; im.data[k] = c[0]; im.data[k + 1] = c[1]; im.data[k + 2] = c[2]; im.data[k + 3] = 255; }
  cx.putImageData(im, 0, 0);
  return { w, s };
});
reg('tunnel', (p) => {
  const N = wins.length, cam = p * (N - 0.15);
  wins.forEach(({ w, s }, i) => {
    const z = i - cam, scale = z > -0.95 ? 1 / (1 + z * 0.45) : 0;
    w.style.transform = `translate(${-5 * z}vw, ${-4 * z}vh) scale(${scale.toFixed(4)})`;
    w.style.opacity = (z < -0.55 ? clamp((z + 0.95) / 0.4) : z > 6 ? clamp(7 - z) : 1).toFixed(3);
    w.style.zIndex = String(100 - i);
    s.classList.toggle('on', Math.min(N - 1, Math.round(cam)) === i && cam > 0.25);
  });
  tHead.classList.toggle('gone', cam > 0.25);
  setEcho(tEcho, String(Math.min(N, Math.round(cam) + 1)).padStart(2, '0'));
});

// =========== 3. CATALOGUE: drag-to-compare pairs and the synced live comparison
const pairsEl = document.getElementById('pairs');
const hostOf = (d) => new URL(d.source.url).hostname.replace(/^www\./, '');
for (const d of data) {
  const a = document.createElement('article');
  a.className = 'pair';
  a.setAttribute('data-rise', '');
  const host = hostOf(d), name = NAMES[d.id] || d.id, path = d.recreationPath.replace(/^\//, '');
  a.innerHTML = `<div class="split" tabindex="0" role="slider" aria-label="Compare ${esc(host)} with ${esc(name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
      <img src="media/${d.id}-source.jpg" alt="${esc(host)} as measured"><img class="rec" src="media/${d.id}-recreation.jpg" alt="${esc(name)}, built from the ${esc(host)} skill">
      <div class="handle"></div><span class="tag l">${esc(host)}</span><span class="tag r">${esc(name)}</span></div>
    <div class="meta">
      <div class="title"><h3>${esc(host)} → ${esc(name)}<small>${esc(d.source.fonts.join(' · '))}${d.source.head ? ` · ${d.source.head.size}/${d.source.head.weight}` : ''} · scroll ${esc(d.source.scroll?.kind ?? '—')}</small></h3>
        <div class="score"><b>${d.report.overall}</b><span>check score</span></div></div>
      <div class="dims">${DIMS.map((k) => `<div style="--v:${d.report.scores[k]}%;--c:${d.report.scores[k] < 85 ? C.salmon : C.volt}"><i></i>${k.slice(0, 5)} ${d.report.scores[k]}</div>`).join('')}</div>
      <div class="row"><a class="btn solid" href="compare.html#${d.id}">Compare side by side <i>→</i></a><a class="btn line" href="recreations/${path}/" target="_blank" rel="noopener">Open ${esc(name)} ↗</a></div>
    </div>`;
  pairsEl.appendChild(a);
  const split = a.querySelector('.split');
  const set = (v) => { v = clamp(v, 0.02, 0.98); split.style.setProperty('--cut', (v * 100).toFixed(1) + '%'); split.setAttribute('aria-valuenow', String(Math.round(v * 100))); };
  split.addEventListener('pointermove', (e) => { const r = split.getBoundingClientRect(); set((e.clientX - r.left) / r.width); });
  split.addEventListener('pointerleave', () => set(0.5));
  split.addEventListener('keydown', (e) => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); set(+split.getAttribute('aria-valuenow') / 100 + (e.key === 'ArrowLeft' ? -0.05 : 0.05)); });
}
for (const id of Object.keys(NAMES).filter((k) => !data.some((d) => d.id === k))) {
  const a = document.createElement('article');
  a.className = 'pair pending';
  a.setAttribute('data-rise', '');
  a.innerHTML = `<div class="split"><span class="chip ghost">${esc(NAMES[id])} is being built from the ${esc(SOURCES[id])} skill</span></div><div class="meta"><div class="title"><h3>${esc(SOURCES[id])} → ${esc(NAMES[id])}<small>recreation in progress</small></h3><div class="score"><b>··</b><span>check score</span></div></div></div>`;
  pairsEl.appendChild(a);
}

// =========== 4. BURST: the film's collage warp; scroll speed is motion.accelerate()
const burst = pixelCanvas(document.getElementById('burstCanvas'), 2);
const TILE = [C.sky, C.lime, C.lilac, C.salmon, C.sun, C.plum, C.paper, C.forest, '#e8443a', '#2b2f9e', '#5df07a', '#f0b8f8'];
const newTile = (z) => ({ x: (Math.random() - 0.5) * 2.4, y: (Math.random() - 0.5) * 1.6, z: z ?? 6, w: 0.04 + Math.random() * 0.16, h: 0.03 + Math.random() * 0.12, c: TILE[(Math.random() * TILE.length) | 0], dith: Math.random() < 0.3 });
const tiles = Array.from({ length: 460 }, () => newTile(Math.random() * 6));
let lastB = 0;
reg('burst', (p, t) => {
  const { ctx, w, h } = burst, dt = Math.min(0.05, t - lastB || 0.016);
  lastB = t;
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, w, h);
  const speed = reduce ? 0 : 0.35 + Math.min(4, Math.abs(vel) * 0.06) + p * 1.2, cx = w / 2, cy = h * 0.38, f = Math.min(w, h) * 0.55;
  tiles.sort((a, b) => b.z - a.z);
  for (const tl of tiles) {
    tl.z -= dt * speed;
    if (tl.z < 0.08) Object.assign(tl, newTile(6));
    const sx = cx + (tl.x / tl.z) * f, sy = cy + (tl.y / tl.z) * f, sw = (tl.w / tl.z) * f, sh = (tl.h / tl.z) * f;
    if (sx + sw < 0 || sx > w || sy + sh < 0 || sy > h) continue;
    ctx.globalAlpha = clamp((6 - tl.z) / 1.5);
    ctx.fillStyle = tl.c; ctx.fillRect(sx | 0, sy | 0, Math.max(1, sw | 0), Math.max(1, sh | 0));
    if (tl.dith && sw > 6) { ctx.fillStyle = C.ink; for (let yy = 0; yy < sh; yy += 3) for (let xx = (yy / 3) & 1; xx < sw; xx += 3) ctx.fillRect((sx + xx) | 0, (sy + yy) | 0, 1, 1); }
  }
  ctx.globalAlpha = 1;
});

// =========== 5. DNA deck (linear.app, measured)
const bez = (b) => { let s = ''; for (let i = 0; i <= 48; i++) { const t = i / 48, x = 3 * b[0] * t * (1 - t) ** 2 + 3 * b[2] * t * t * (1 - t) + t ** 3, y = 3 * b[1] * t * (1 - t) ** 2 + 3 * b[3] * t * t * (1 - t) + t ** 3; s += `${i ? 'L' : 'M'}${(x * 100).toFixed(2)},${(100 - y * 100).toFixed(2)}`; } return s; };
const lenisTrace = [[42, 0], [147, 0], [246, 53], [344, 78], [446, 89], [560, 96], [662, 98], [773, 99], [871, 100], [1100, 100]].map(([ms, y], i) => `${i ? 'L' : 'M'}${(ms / 1100 * 100).toFixed(1)},${(100 - y).toFixed(1)}`).join('');
const LC = [['background', '#08090a'], ['surface', '#0f1011'], ['accent', '#5e69d1'], ['text', '#f7f8f8'], ['text-2', '#d0d6e0'], ['text-3', '#8a8f98'], ['text-4', '#62666d'], ['border', '#ffffff14']];
const CARDS = [
  ['c-color', 'Colour', 'linear.app · 25 tokens by painted area', `<div class="sw-grid">${LC.map(([n, v]) => `<div style="background:${v};color:${/^#(0|1|5|6)|14$/.test(v) ? '#f2f0f3' : '#141115'}">${n}</div>`).join('')}</div><pre>background ← --color-bg-primary\nsurface    ← --color-bg-level-1\naccent     ← the focus ring</pre>`],
  ['c-type', 'Type', 'display · 64px · 510 · −0.022em', `<div class="type-big">Aa→</div><dl class="spec"><dt>family</dt><dd>Inter (open)</dd><dt>mono</dt><dd>Berkeley Mono → JetBrains Mono</dd><dt>body</dt><dd>15px / 1.6</dd><dt>display</dt><dd>38px mobile → 64px desktop</dd></dl>`],
  ['c-motion', 'Motion', 'hero intro · 9 lines', `<div class="fill"><svg viewBox="-4 -8 108 116" preserveAspectRatio="none"><path d="M0,100 L100,0" stroke="#4a7a56" stroke-dasharray="2 3" fill="none" vector-effect="non-scaling-stroke"/><path d="${bez([0.25, 0.1, 0.25, 1])}" stroke="#141115" stroke-width="3" fill="none" vector-effect="non-scaling-stroke"/></svg></div><pre>opacity 0 · blur(10px) · translateY(20%)\n1000ms cubic-bezier(.25,.1,.25,1)\ndelay 400ms · stagger 34ms</pre>`],
  ['c-scroll', 'Scroll feel', 'one wheel notch', `<div class="fill"><svg viewBox="-4 -8 108 116" preserveAspectRatio="none"><path d="M0,100 L4,100 L4,0 L100,0" stroke="#141115" stroke-dasharray="2 3" fill="none" vector-effect="non-scaling-stroke"/><path d="${lenisTrace}" stroke="#141115" stroke-width="3" fill="none" vector-effect="non-scaling-stroke"/></svg></div><pre>dashed: linear.app, native, 1 frame\nsolid: lenis.dev, 90% in 309ms\n→ new Lenis({ lerp: 0.14 })</pre>`],
  ['c-skill', 'The skill', 'linear-design-language/', `<pre>SKILL.md\nreferences/\n  tokens.md   components.md\n  motion.md   layout.md\nassets/\n  tokens.css  tailwind.css\n  tokens.json (DTCG 2025.10)\n  motion.css  motion.js\n  DESIGN.md   reference/*.jpg\nscripts/lint.mjs</pre>`],
];
const deck = document.getElementById('deck');
const cards = CARDS.map(([cls, title, src, body]) => { const c = document.createElement('article'); c.className = 'card ' + cls; c.innerHTML = `<div><h4>${title}</h4><div class="src">${src}</div></div>${body}`; deck.appendChild(c); return c; });
reg('dna', (p) => {
  const n = cards.length, W = innerWidth, cw = Math.min(400, W * 0.78), narrow = W < 900;
  const fan = easeOut(clamp(p * 1.5)), sweep = clamp((p - 0.2) / 0.75);
  cards.forEach((c, i) => {
    const k = i - sweep * (n - 1), baseX = narrow ? 0 : Math.min(W * 0.2, W / 2 - cw / 2 - 40), step = narrow ? cw * 0.9 : cw * 0.82;
    c.style.transform = `translate3d(${lerp(baseX + 30, baseX + k * step, fan).toFixed(1)}px, ${(narrow ? innerHeight * 0.2 : innerHeight * 0.05).toFixed(1)}px, ${lerp(-i * 50, -Math.abs(k) * 240, fan).toFixed(1)}px) rotateY(${(narrow ? -k * 8 : lerp(-6, -k * 14 - 4, fan)).toFixed(2)}deg)`;
    c.style.zIndex = String(100 - Math.round(Math.abs(k) * 10));
    c.style.opacity = Math.abs(k) > 3 ? '0' : '1';
  });
});

// =========== 6. CHECK: the chain on lilac; the report of the real Tessera run fills in
const chain = document.getElementById('chain'), cctx = chain.getContext('2d');
const fitChain = () => { const r = chain.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio); chain.width = r.width * dpr; chain.height = r.height * dpr; cctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
fitChain(); addEventListener('resize', fitChain);
const reportEl = document.getElementById('report');
if (lead) {
  reportEl.innerHTML = `<div class="head"><span>${esc(NAMES[lead.id])} ⟶ ${esc(hostOf(lead))}</span><span>real run · ${esc(lead.report.at.slice(0, 10))}</span></div>
    <div class="total"><b id="ov">00</b><span>${lead.report.pass ? 'passes' : 'not yet: motion is the gap'}</span></div>
    <div class="bars" id="rbars">${DIMS.map((k) => `<div><span>${k}</span><i style="--v:0%;--c:${lead.report.scores[k] < 85 ? C.salmon : C.volt}"></i><span>··</span></div>`).join('')}</div>
    <div class="fix"><b>fix first</b>${esc(tidy(lead.report.findings[0]?.message || 'nothing').slice(0, 150))}</div>
    <div class="cal">calibration, unrelated sites scored against linear.app: stripe 36 · vercel 41 · lenis 50</div>`;
}
const rr = (x, y, w, h, r) => { cctx.beginPath(); cctx.roundRect ? cctx.roundRect(x, y, w, h, r) : cctx.rect(x, y, w, h); };
reg('check', (p, t) => {
  const W = chain.clientWidth, H = chain.clientHeight, n = 14, head = clamp(p * 1.35);
  cctx.clearRect(0, 0, W, H);
  for (let i = 0; i < n; i++) {
    const k = head - i * 0.045;
    if (k <= 0) continue;
    const s = 0.25 + (1 - i / n) * 0.75, x = lerp(-0.05, 1.05, k) * W, y = H * (0.88 - 0.5 * k + Math.sin(k * 9 + t * 0.6) * 0.035), size = (20 + 120 * s * (0.35 + k)) * Math.min(1, W / 1200);
    cctx.save(); cctx.translate(x, y); cctx.rotate(-0.42 + Math.sin(i + t * 0.5) * 0.05);
    cctx.fillStyle = C.sky; rr(-size / 2 - 4, -size * 0.38 - 4, size + 8, size * 0.76 + 8, size * 0.24); cctx.fill();
    cctx.fillStyle = C.ink; rr(-size / 2, -size * 0.38, size, size * 0.76, size * 0.22); cctx.fill();
    cctx.restore();
  }
  if (!lead) return;
  const rows = document.querySelectorAll('#rbars > div');
  DIMS.forEach((k, i) => { const f = clamp((p - 0.15 - i * 0.06) / 0.12), v = Math.round(lead.report.scores[k] * f); rows[i].querySelector('i').style.setProperty('--v', v + '%'); rows[i].lastElementChild.textContent = f > 0 ? String(v) : '··'; });
  document.getElementById('ov').textContent = String(Math.round(lead.report.overall * clamp((p - 0.15) / 0.55))).padStart(2, '0');
});

// =========== 7. KALEIDOSCOPE
const kal = pixelCanvas(document.getElementById('kCanvas'), innerWidth < 700 ? 7 : 9);
reg('kaleido', (p, t) => {
  const { ctx, w, h } = kal;
  ctx.fillStyle = C.lime; ctx.fillRect(0, 0, w, h);
  const cx = (w - 1) / 2, cy = (h - 1) / 2.8, phase = p * 3 + (reduce ? 0 : t * 0.08);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let dx = Math.abs(x - cx), dy = Math.abs(y - cy);
    if (dy > dx) [dx, dy] = [dy, dx];
    const r = Math.hypot(dx, dy);
    if (r >= Math.min(w, h) * (0.2 + p * 0.45)) continue;
    const v = Math.sin(Math.floor(r / 2.2 - phase * 2) * 1.7 + Math.atan2(dy, dx) * 5 + phase) + Math.cos(dx * 0.55 - phase * 1.3) * Math.sin(dy * 0.55 + phase);
    const col = v > 1.1 ? C.ink : v > 0.55 ? C.forest : v < -1.2 ? C.lilac : v < -0.8 ? C.paper : null;
    if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
  }
});

// =========== logo, copy button, cursor trail
const lg = document.getElementById('logo'), lctx = lg.getContext('2d'), LW = 48;
lg.width = LW; lg.height = LW;
const pts = [];
for (const [col, kind, ox, oy] of [[C.salmon, 'c', 6, 6], [C.volt, 's', 26, 6], [C.sky, 's', 6, 26], [C.plum, 'c', 26, 26]]) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (kind === 'c' && Math.hypot(x - 7.5, y - 7.5) > 8) continue; pts.push({ col, tx: ox + x, ty: oy + y, sx: Math.random() * LW, sy: Math.random() * LW + LW, d: Math.random() * 0.35 }); }
let logoP = reduce ? 1 : 0, logoGo = false;
new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) logoGo = true; }), { threshold: 0.4 }).observe(lg);
(function drawLogo() { if (logoGo) logoP = Math.min(1, logoP + 0.012); lctx.clearRect(0, 0, LW, LW); for (const q of pts) { const k = easeOut(clamp((logoP - q.d) / 0.65)); lctx.fillStyle = q.col; lctx.fillRect(Math.round(lerp(q.sx, q.tx, k)), Math.round(lerp(q.sy, q.ty, k)), 1, 1); } requestAnimationFrame(drawLogo); })();
const copyBtn = document.getElementById('copy'), cmdEl = document.getElementById('cmd');
copyBtn.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(cmdEl.textContent); copyBtn.textContent = 'copied'; }
  catch { const r = document.createRange(); r.selectNodeContents(cmdEl); getSelection().removeAllRanges(); getSelection().addRange(r); copyBtn.textContent = 'selected'; }
  setTimeout(() => (copyBtn.textContent = 'copy'), 1400);
});
const trail = document.getElementById('trail'), tctx = trail.getContext('2d');
const fitTrail = () => { trail.width = innerWidth; trail.height = innerHeight; };
fitTrail(); addEventListener('resize', fitTrail);
const dots = [];
if (!reduce && matchMedia('(pointer: fine)').matches) addEventListener('pointermove', (e) => { dots.push({ x: Math.round(e.clientX / 6) * 6, y: Math.round(e.clientY / 6) * 6, life: 1, c: [C.volt, C.salmon, C.sky, C.lilac][(Math.random() * 4) | 0] }); if (dots.length > 60) dots.shift(); });
(function drawTrail() { tctx.clearRect(0, 0, trail.width, trail.height); for (const d of dots) { d.life -= 0.035; if (d.life <= 0) continue; tctx.globalAlpha = d.life; tctx.fillStyle = d.c; tctx.fillRect(d.x - 3, d.y - 3, 6, 6); } tctx.globalAlpha = 1; requestAnimationFrame(drawTrail); })();

watch();
requestAnimationFrame(frame);
