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
  const MAX_ELEMENTS = 20000, MAX_ACTIVE = 400, QUIET_FRAMES = 45, MAX_SAMPLES = 900;

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
  function idOf(el) {
    let id = ids.get(el);
    if (id === undefined) {
      if (R.elements.length >= MAX_ELEMENTS) return -1;
      id = R.elements.length;
      ids.set(el, id);
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
    if (R.tracks.size >= MAX_ACTIVE) return;
    R.tracks.set(id, { id, why, el, samples: [[now(), ...read(el)]], quiet: 0 });
  }
  R.track = track;

  function frame() {
    const t = now();
    R.scroll.push([Math.round(t * 10) / 10, scrollX, Math.round(scrollY * 10) / 10]);
    for (const [id, tr] of R.tracks) {
      const v = read(tr.el);
      const last = tr.samples[tr.samples.length - 1];
      if (same(v, last.slice(1))) tr.quiet++;
      else { tr.quiet = 0; }
      tr.samples.push([Math.round(t * 10) / 10, ...v]);
      if (tr.quiet >= QUIET_FRAMES || tr.samples.length >= MAX_SAMPLES) {
        R.tracks.delete(id);
        // trim the quiet tail but keep one settled sample
        const s = tr.samples.slice(0, tr.samples.length - tr.quiet + 1);
        if (s.length > 2) R.done.push({ id, why: tr.why, samples: s });
      }
    }
    if (R.scroll.length > 60000) R.scroll.splice(0, 30000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  new MutationObserver((list) => {
    for (const m of list) if (m.type === 'attributes') track(m.target, 'attr:' + m.attributeName);
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['style', 'class', 'data-state', 'aria-expanded', 'open', 'hidden'] });

  // ---- animation ledger -------------------------------------------------------------------------
  const seen = new WeakSet();
  function ledger() {
    let list = [];
    try { list = document.getAnimations(); } catch {}
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

  // WAAPI created by libraries (Framer Motion, Motion One) — tag the source
  const animate = Element.prototype.animate;
  Element.prototype.animate = function (...args) { track(this, 'waapi'); return animate.apply(this, args); };

  R.mark = (label) => R.marks.push({ t: Math.round(now()), label, scrollY });

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
  ];
  R.harvest = () => {
    const rows = [];
    const all = document.body ? document.body.getElementsByTagName('*') : [];
    const vw = innerWidth, vh = innerHeight;
    const pidOf = (el) => { const p = el.parentElement; return p && p !== document.body ? idOf(p) : -1; };
    const add = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return;
      const id = idOf(el);
      if (id < 0) return;
      let text = '', chars = 0;
      for (const n of el.childNodes) if (n.nodeType === 3) { const s = n.textContent.replace(/\s+/g, ' ').trim(); if (s) { text += (text ? ' ' : '') + s; chars += s.length; } }
      const row = {
        id, pid: pidOf(el), tag: el.tagName.toLowerCase(),
        box: [Math.round(r.x + scrollX), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)],
        chars, text: text.slice(0, 120),
        href: el.tagName === 'A' ? el.getAttribute('href') : undefined,
        type: el.getAttribute('type') || undefined,
        role: el.getAttribute('role') || undefined,
        aria: el.getAttribute('aria-label') || undefined,
        cls: (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '').slice(0, 200),
        kids: el.children.length,
        s: {},
      };
      for (const p of PROPS) row.s[p] = cs[p];
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
    return { marks: R.marks, elements: R.elements, tracks: R.done, anims: R.anims, scroll: R.scroll, wheel: R.wheel };
  };
})();
