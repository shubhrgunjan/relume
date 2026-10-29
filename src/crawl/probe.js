// Injected before any page script runs (addInitScript). Three jobs:
//  1. motion recorder — every element whose style/class changes, or that a WAAPI/CSS animation targets, is
//     sampled every frame (transform, opacity, clip-path, filter, box) until it settles, so JS-driven motion
//     (GSAP, Framer Motion, Lenis, custom rAF) is measured the same way as CSS motion;
//  2. animation ledger — every Animation object the page ever creates, with its exact keyframes and timing;
//  3. harvest() — computed styles of every visible element, in columns, for token and component inference.
(() => {
  if (window.__relume) return;
  const now = () => performance.now();
  const R = (window.__relume = {
    version: 1,
    marks: [],          // {t, label} — phases the crawler announces (load, scroll-start, hover:12 …)
    elements: [],       // id -> descriptor
    tracks: new Map(),  // id -> {samples: [[t, ...values]], quiet}
    done: [],           // finished tracks
    anims: [],          // animation ledger
    scroll: [],         // [t, scrollX, scrollY] every frame
    wheel: [],          // [t, deltaY] as the page received it
  });
  const ids = new WeakMap();
  const HARD_MAX = 120000, MAX_ELEMENTS = 20000, MAX_ACTIVE = 200, QUIET_FRAMES = 45, MAX_SAMPLES = 600;

  function describe(el) {
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute?.('class') || '';
    let text = '';
    for (const n of el.childNodes) if (n.nodeType === 3) text += n.textContent;
    return {
      tag: el.tagName.toLowerCase(),
      cls: cls.slice(0, 160),
      text: text.trim().replace(/\s+/g, ' ').slice(0, 80),
      role: el.getAttribute?.('role') || undefined,
    };
  }
  const refs = [];
  // tracking may only use MAX_ELEMENTS ids; the harvest (what the page is made of) may always id what it measures,
  // up to a hard ceiling — on busy pages tracking used to exhaust the ids and the harvest silently lost elements
  function idOf(el, harvest) {
    let id = ids.get(el);
    if (id === undefined) {
      if (R.elements.length >= (harvest ? HARD_MAX : MAX_ELEMENTS)) return -1;
      id = R.elements.length;
      ids.set(el, id);
      refs[id] = new WeakRef(el);
      R.elements.push(describe(el));
      try { el.setAttribute('data-relume-id', String(id)); } catch {}
    }
    return id;
  }
  R.idOf = idOf;

  // ---- motion recorder --------------------------------------------------------------------------
  function read(el) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return [
      cs.transform, +cs.opacity, cs.clipPath, cs.filter,
      Math.round((r.x + scrollX) * 10) / 10, Math.round((r.y + scrollY) * 10) / 10,
      Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10,
      cs.backgroundColor, cs.color, cs.boxShadow, cs.borderColor,
    ];
  }
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  function track(el, why) {
    if (!(el instanceof Element)) return;
    const id = idOf(el);
    if (id < 0) return;
    const tr = R.tracks.get(id);
    if (tr) { tr.quiet = 0; return; }
    if (R.tracks.size >= MAX_ACTIVE) {
      // full: make room by dropping a track nobody can see (off screen) or the smallest one, if the newcomer is
      // on screen and larger — busy pages used to lose every animation that started after the first 200
      const r = el.getBoundingClientRect();
      const onScreen = (b) => b.bottom > 0 && b.top < innerHeight && b.width > 0;
      if (!onScreen(r)) { R.stats.dropped = (R.stats.dropped || 0) + 1; return; }
      let victim = null, va = Infinity, off = false;
      for (const [tid, t] of R.tracks) { const b = t.el.getBoundingClientRect(); if (!onScreen(b)) { victim = tid; off = true; break; } const a = b.width * b.height; if (a < va) { va = a; victim = tid; } }
      // evict an off-screen track, or the smallest on-screen one if the newcomer is bigger
      if (victim === null || (!off && va >= r.width * r.height)) { R.stats.dropped = (R.stats.dropped || 0) + 1; return; }
      const v = R.tracks.get(victim); R.tracks.delete(victim);
      if (v.samples.length > 2) R.done.push({ id: v.id, why: v.why, samples: v.samples });
    }
    R.tracks.set(id, { id, why, el, samples: [[now(), ...read(el)]], quiet: 0 });
  }
  R.track = track;

  // Sampling budget: reading styles of many elements every frame can starve a busy page (and make the crawl
  // crawl). Each frame gets BUDGET_MS; tracks not reached this frame are read next frame, round-robin.
  const BUDGET_MS = 4;
  let cursor = 0;
  R.stats = { frames: 0, overBudget: 0, maxActive: 0 };
  function frame() {
    const t = now();
    R.scroll.push([Math.round(t * 10) / 10, scrollX, Math.round(scrollY * 10) / 10]);
    R.stats.frames++;
    R.stats.maxActive = Math.max(R.stats.maxActive, R.tracks.size);
    const list = [...R.tracks.values()];
    const n = list.length;
    let done = 0;
    for (let k = 0; k < n; k++) {
      const tr = list[(cursor + k) % n];
      const id = tr.id;
      if (k > 0 && now() - t > BUDGET_MS) { R.stats.overBudget++; cursor = (cursor + k) % Math.max(1, n); break; }
      done++;
      const v = read(tr.el);
      const last = tr.samples[tr.samples.length - 1];
      if (same(v, last.slice(1))) tr.quiet++;
      else { tr.quiet = 0; }
      tr.lastT = t;
      tr.samples.push([Math.round(t * 10) / 10, ...v]);
      if (tr.quiet >= QUIET_FRAMES || tr.samples.length >= MAX_SAMPLES) {
        R.tracks.delete(id);
        // trim the quiet tail but keep one settled sample
        const s = tr.samples.slice(0, tr.samples.length - tr.quiet + 1);
        if (s.length > 2) R.done.push({ id, why: tr.why, samples: s });
      }
    }
    if (done === n) cursor = 0;
    if (R.scroll.length > 60000) R.scroll.splice(0, 30000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // text and structure changes are behaviour too: typing, cycling status lines, steps appended one by one,
  // image frames swapped. Recorded per element as [t, id, kind, value].
  R.texts = [];
  const lastText = new WeakMap();
  const textOf = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  const noteText = (el) => {
    if (!(el instanceof Element) || R.texts.length > 20000) return;
    const v = textOf(el);
    if (lastText.get(el) === v) return;
    lastText.set(el, v);
    const id = idOf(el);
    if (id >= 0) R.texts.push([Math.round(now()), id, 'text', v]);
  };
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'attributes') {
        if (m.attributeName === 'src' || m.attributeName === 'srcset') { const id = idOf(m.target); if (id >= 0 && R.texts.length < 20000) R.texts.push([Math.round(now()), id, 'src', String(m.target.getAttribute('src') || '').slice(-80)]); }
        track(m.target, 'attr:' + m.attributeName);
      } else if (m.type === 'characterData') noteText(m.target.parentElement);
      else if (m.type === 'childList') {
        const el = m.target;
        if (el instanceof Element && (m.addedNodes.length || m.removedNodes.length)) {
          const id = idOf(el);
          if (id >= 0 && R.texts.length < 20000) R.texts.push([Math.round(now()), id, 'children', el.children.length]);
          noteText(el);
          for (const n of m.addedNodes) if (n instanceof Element) track(n, 'added');
        }
      }
    }
  }).observe(document, { subtree: true, attributes: true, characterData: true, childList: true, attributeFilter: ['style', 'class', 'data-state', 'aria-expanded', 'open', 'hidden', 'src', 'srcset'] });

  // ---- animation ledger -------------------------------------------------------------------------
  const seen = new WeakSet();
  const retracked = new Map();
  function ledger() {
    let list = [];
    try { list = document.getAnimations(); } catch {}
    // long or endless animations (drifting layers, marquees) start at load, often off screen, and outlive a
    // track's sample cap: whenever one is on screen and untracked, record a fresh segment of it
    const t = now();
    for (const a of list) {
      if (!seen.has(a) || a.playState !== 'running') continue;
      const tg = a.effect && a.effect.target;
      if (!(tg instanceof Element)) continue;
      let tm = {}; try { tm = a.effect.getTiming(); } catch {}
      if (!(tm.iterations === Infinity || +tm.duration > 3000)) continue;
      const id = idOf(tg);
      if (id < 0 || R.tracks.has(id) || t - (retracked.get(id) || 0) < 1500) continue;
      const r = tg.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight && r.width > 0) { retracked.set(id, t); track(tg, 'anim-live'); }
    }
    for (const a of list) {
      if (seen.has(a)) continue;
      seen.add(a);
      const eff = a.effect;
      const target = eff && eff.target;
      if (target instanceof Element) track(target, 'anim');
      let kf = [], timing = {};
      try { kf = eff.getKeyframes(); } catch {}
      try { timing = eff.getTiming(); } catch {}
      const props = [...new Set(kf.flatMap((k) => Object.keys(k)))].filter((k) => !['offset', 'easing', 'composite', 'computedOffset'].includes(k));
      R.anims.push({
        t: Math.round(now()),
        kind: a.constructor.name, // CSSAnimation | CSSTransition | Animation
        name: a.animationName || a.transitionProperty || a.id || '',
        target: target instanceof Element ? idOf(target) : -1,
        pseudo: eff && eff.pseudoElement || undefined,
        props,
        keyframes: kf.map((k) => { const o = { offset: k.computedOffset, easing: k.easing }; for (const p of props) if (k[p] !== undefined) o[p] = String(k[p]); return o; }),
        delay: timing.delay, duration: timing.duration, easing: timing.easing, iterations: timing.iterations,
        direction: timing.direction, fill: timing.fill,
        timeline: a.timeline && a.timeline !== document.timeline ? a.timeline.constructor.name : undefined,
      });
    }
  }
  setInterval(ledger, 40);
  document.addEventListener('transitionrun', (e) => { track(e.target, 'transition'); ledger(); }, true);
  document.addEventListener('animationstart', (e) => { track(e.target, 'animation'); ledger(); }, true);
  window.addEventListener('wheel', (e) => R.wheel.push([Math.round(now()), e.deltaY]), { capture: true, passive: true });

  // which drawing API each canvas uses (webgl = a live 3D scene), learned from the page's own getContext calls
  const canvasKinds = new WeakMap();
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) { const c = getContext.call(this, type, ...rest); if (c && !canvasKinds.has(this)) canvasKinds.set(this, String(type)); return c; };

  // WAAPI created by libraries (Framer Motion, Motion One) — tag the source
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (...args) { track(this, 'waapi'); return animate.apply(this, args); };

  // sync flash: a 6×6 magenta square in the top-left corner for 300ms, so the video clock can be aligned to the
  // page clock exactly (behaviour analysis finds these frames)
  R.flash = () => {
    const d = document.createElement('div');
    d.setAttribute('style', 'position:fixed;left:0;top:0;width:6px;height:6px;background:#ff00ff;z-index:2147483647;pointer-events:none');
    (document.body || document.documentElement).appendChild(d);
    setTimeout(() => d.remove(), 300);
  };
  // how much the page did on its own, since t, to elements that are on screen now (not elsewhere on the page)
  R.localActivity = (t) => {
    const vis = (id) => { const el = refs[id]?.deref(); if (!el) return false; const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };
    let n = 0;
    for (const x of R.texts) if (x[0] >= t && vis(x[1])) n++;
    for (const a of R.anims) if (a.t >= t && a.target >= 0 && vis(a.target)) n++;
    for (const tr of R.done) if (tr.samples[0][0] >= t && vis(tr.id)) n++;
    for (const [id, tr] of R.tracks) if (tr.samples[0][0] >= t && vis(id)) n++;
    return n;
  };
  R.now = () => now();
  R.mark = (label) => { R.marks.push({ t: Math.round(now()), label, scrollY }); if (/^(loaded|scroll:start|scroll:end|dwell:end)$/.test(label)) R.flash(); };

  // ---- library detection ------------------------------------------------------------------------
  R.libraries = () => {
    const out = {};
    const html = document.documentElement;
    const meta = document.querySelector('meta[name="generator"]');
    if (meta) out.generator = meta.content;
    if (window.gsap) {
      out.gsap = { version: window.gsap.version };
      try {
        const ST = window.ScrollTrigger || window.gsap.plugins?.scrollTrigger;
        if (ST?.getAll) out.gsap.scrollTriggers = ST.getAll().slice(0, 200).map((st) => ({
          trigger: st.trigger instanceof Element ? idOf(st.trigger) : null,
          start: st.start, end: st.end, scrub: st.vars?.scrub, pin: !!st.vars?.pin, toggleActions: st.vars?.toggleActions,
          animation: st.animation ? { duration: st.animation.duration?.(), ease: st.animation.vars?.ease, targets: (st.animation.targets?.() || []).slice(0, 20).map((t) => t instanceof Element ? idOf(t) : null) } : null,
        }));
      } catch {}
      try {
        out.gsap.tweens = window.gsap.globalTimeline.getChildren(true, true, false).slice(0, 300).map((tw) => ({
          duration: tw.duration(), delay: tw.delay(), ease: typeof tw.vars.ease === 'string' ? tw.vars.ease : tw.vars.ease ? 'custom' : 'power1.out(default)',
          stagger: tw.vars.stagger, props: Object.keys(tw.vars).filter((k) => !['ease', 'duration', 'delay', 'stagger', 'onComplete', 'onUpdate', 'scrollTrigger', 'overwrite', 'id'].includes(k)),
          targets: (tw.targets?.() || []).slice(0, 10).map((t) => t instanceof Element ? idOf(t) : null),
        }));
      } catch {}
    }
    if (window.Lenis || window.lenis || html.classList.contains('lenis')) {
      const l = window.lenis || window.__lenis;
      out.lenis = { present: true, options: l?.options ? { lerp: l.options.lerp, duration: l.options.duration, smoothWheel: l.options.smoothWheel, wheelMultiplier: l.options.wheelMultiplier } : undefined };
    }
    if (html.classList.contains('has-scroll-smooth') || document.querySelector('[data-scroll-container]')) out.locomotive = true;
    if (document.querySelector('[data-framer-name], [data-framer-component-type]') || /framer/i.test(out.generator || '')) out.framer = true;
    if (html.hasAttribute('data-wf-site') || window.Webflow) {
      out.webflow = { present: true };
      try {
        const st = window.Webflow.require('ix2').store.getState();
        const ix = st.ixData;
        if (ix) out.webflow.ix2 = { events: Object.values(ix.events || {}).slice(0, 200), actionLists: Object.values(ix.actionLists || {}).slice(0, 200) };
      } catch {}
    }
    if (document.querySelector('[data-aos]')) out.aos = { count: document.querySelectorAll('[data-aos]').length, kinds: [...new Set([...document.querySelectorAll('[data-aos]')].map((e) => e.getAttribute('data-aos')))].slice(0, 20) };
    if (document.querySelector('[data-projection-id], [style*="--framer"]')) out.framerMotion = true;
    if (window.THREE || window.__THREE__) out.three = window.__THREE__ || true;
    if (document.querySelector('spline-viewer, canvas[data-engine*="spline" i]')) out.spline = true;
    if (window.lottie || window.bodymovin || document.querySelector('lottie-player, dotlottie-player')) out.lottie = true;
    if (document.querySelector('canvas')) out.canvas = [...document.querySelectorAll('canvas')].filter((c) => c.width * c.height > 40000).length;
    if (window.barba) out.barba = true;
    if (window.Swiper || document.querySelector('.swiper')) out.swiper = true;
    if (window.next || document.getElementById('__next') || window.__NEXT_DATA__) out.next = true;
    if (document.querySelector('[class*=":"]') || /\b(px|py|mt|mb)-\d/.test(document.body?.innerHTML.slice(0, 200000) || '')) out.tailwindLike = true;
    out.scrollBehavior = getComputedStyle(html).scrollBehavior;
    out.scrollSnap = getComputedStyle(html).scrollSnapType !== 'none' ? getComputedStyle(html).scrollSnapType : undefined;
    return out;
  };

  // ---- harvest ----------------------------------------------------------------------------------
  const PROPS = [
    'display', 'position', 'color', 'backgroundColor', 'backgroundImage', 'backgroundSize',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopStyle', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor',
    'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius',
    'boxShadow', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
    'textTransform', 'textDecorationLine', 'textAlign', 'fontFeatureSettings', 'fontVariationSettings',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'rowGap', 'columnGap',
    'flexDirection', 'flexWrap', 'justifyContent', 'alignItems', 'gridTemplateColumns',
    'width', 'maxWidth', 'height', 'opacity', 'zIndex', 'overflow', 'cursor', 'objectFit', 'aspectRatio',
    'transitionProperty', 'transitionDuration', 'transitionTimingFunction', 'transitionDelay',
    'animationName', 'animationDuration', 'animationTimingFunction', 'animationIterationCount',
    'backdropFilter', 'filter', 'mixBlendMode', 'outlineWidth', 'outlineColor', 'outlineOffset', 'outlineStyle',
    'transform', 'fill', 'stroke', 'strokeWidth', 'textShadow', 'whiteSpace', 'textWrap',
    'maskImage', 'webkitMaskImage', 'backgroundPosition', 'backgroundRepeat', 'imageRendering',
  ];
  R.harvest = () => {
    const rows = [];
    const all = document.body ? document.body.getElementsByTagName('*') : [];
    const vw = innerWidth, vh = innerHeight;
    const pidOf = (el) => { const p = el.parentElement; return p && p !== document.body ? idOf(p, true) : -1; };
    const add = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      const id = idOf(el, true);
      if (id < 0) return;
      let text = '', chars = 0;
      for (const n of el.childNodes) if (n.nodeType === 3) { const s = n.textContent.replace(/\s+/g, ' ').trim(); if (s) { text += (text ? ' ' : '') + s; chars += s.length; } }
      const row = {
        id, pid: pidOf(el), tag: el.tagName.toLowerCase(),
        box: [Math.round(r.x + scrollX), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)],
        chars, text: text.slice(0, 120),
        href: el.tagName === 'A' ? el.getAttribute('href') : undefined,
        type: el.getAttribute('type') || undefined,
        ph: (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') ? (el.getAttribute('placeholder') || undefined) : undefined,
        role: el.getAttribute('role') || undefined,
        aria: el.getAttribute('aria-label') || undefined,
        cls: (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '').slice(0, 200),
        kids: el.children.length,
        s: {},
      };
      for (const p of PROPS) row.s[p] = cs[p];
      if (el.tagName === 'CANVAS') {
        row.canvas = { ctx: canvasKinds.get(el) || 'none', w: el.width, h: el.height };
      }
      if (el.tagName === 'IMG' || el.tagName === 'VIDEO' || el.tagName === 'PICTURE') {
        row.media = { src: (el.currentSrc || el.src || '').slice(0, 300), nw: el.naturalWidth || el.videoWidth || 0, nh: el.naturalHeight || el.videoHeight || 0, autoplay: el.autoplay, loop: el.loop };
      }
      if (el.tagName === 'svg' || el instanceof SVGSVGElement) {
        row.svg = { viewBox: el.getAttribute('viewBox'), paths: el.querySelectorAll('path,circle,rect,line,polyline,polygon').length, strokeW: el.getAttribute('stroke-width') || cs.strokeWidth, fillAttr: el.getAttribute('fill'), strokeAttr: el.getAttribute('stroke') };
        rows.push(row);
        return 'skip-children';
      }
      // pseudo elements carry a lot of design (underlines, overlays, icons)
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(el, pseudo);
        if (ps.content && ps.content !== 'none' && ps.content !== 'normal') {
          row[pseudo === '::before' ? 'before' : 'after'] = { content: ps.content.slice(0, 40), backgroundColor: ps.backgroundColor, width: ps.width, height: ps.height, position: ps.position, transform: ps.transform, transitionProperty: ps.transitionProperty, transitionDuration: ps.transitionDuration, transitionTimingFunction: ps.transitionTimingFunction, borderRadius: ps.borderTopLeftRadius, opacity: ps.opacity, backgroundImage: ps.backgroundImage };
        }
      }
      rows.push(row);
    };
    const walk = (root) => {
      for (const el of root.children) {
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'HEAD'].includes(el.tagName)) continue;
        if (rows.length >= MAX_ELEMENTS) return;
        if (add(el) === 'skip-children') continue;
        walk(el);
      }
    };
    if (document.body) { add(document.body); walk(document.body); }
    const fonts = [];
    try { for (const f of document.fonts) fonts.push({ family: f.family.replace(/["']/g, ''), weight: f.weight, style: f.style, status: f.status, display: f.display }); } catch {}
    const bodyCs = getComputedStyle(document.body);
    return {
      url: location.href, title: document.title, lang: document.documentElement.lang,
      viewport: [vw, vh], docHeight: document.documentElement.scrollHeight, dpr: devicePixelRatio,
      body: { backgroundColor: bodyCs.backgroundColor, htmlBackground: getComputedStyle(document.documentElement).backgroundColor, color: bodyCs.color, fontFamily: bodyCs.fontFamily },
      rootVars: rootVars(),
      fonts, rows,
    };
  };
  function rootVars() {
    const out = {};
    const cs = getComputedStyle(document.documentElement);
    for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (p.startsWith('--')) out[p] = cs.getPropertyValue(p).trim().slice(0, 200); }
    return out;
  }

  // everything the crawler pulls at the end of a page visit
  R.collect = () => {
    for (const [id, tr] of R.tracks) if (tr.samples.length > 2) R.done.push({ id, why: tr.why, samples: tr.samples });
    R.tracks.clear();
    ledger();
    return { marks: R.marks, elements: R.elements, tracks: R.done, anims: R.anims, scroll: R.scroll, wheel: R.wheel, stats: R.stats, texts: R.texts };
  };
})();
