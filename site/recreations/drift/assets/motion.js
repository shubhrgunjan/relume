// Motion runtime measured from https://lenis.darkroom.engineering by relume. Import once on every page.
// Scroll reveals start when an element's top crosses the measured fraction of the viewport height.
const ENTRY = {"reveal-tint-13":0.85,"reveal-scale-14":0.48,"reveal-fade-15":0.66,"reveal-tint-16":0.73,"reveal-fade-out-17":0.34,"reveal-scale-18":0.7,"reveal-translate-19":0.9,"reveal-fade-20":0.47,"reveal-tint-21":0.85,"reveal-scale-22":0.52,"reveal-fade-23":0.92,"reveal-tint-24":0.43,"reveal-fade-25":0.45,"reveal-scale-26":0.53,"reveal-fade-27":0.85,"reveal-scale-28":0.44,"reveal-scale-29":0.43,"reveal-scale-30":0.49,"reveal-fill-31":0.85,"reveal-scale-32":0.48,"reveal-tint-33":0.25,"reveal-scale-34":0.85,"reveal-scale-35":0.49,"reveal-fade-36":0.11,"reveal-scale-37":0.49,"reveal-fade-out-38":0.09,"reveal-fade-out-39":0.4,"reveal-fade-scale-40":0.47,"reveal-fade-out-41":0.85,"reveal-scale-42":0.49,"reveal-tint-43":0.46,"reveal-tint-44":0.46,"reveal-tint-45":0.52};
const DEFAULT_ENTRY = 0.55;

export function initReveals(root = document) {
  const els = [...root.querySelectorAll('[data-reveal]')];
  const byEntry = new Map();
  for (const el of els) {
    const e = ENTRY[el.dataset.reveal] ?? DEFAULT_ENTRY;
    if (!byEntry.has(e)) byEntry.set(e, []);
    byEntry.get(e).push(el);
  }
  for (const [entry, list] of byEntry) {
    const io = new IntersectionObserver((records) => {
      for (const r of records) if (r.isIntersecting) { r.target.classList.add('is-in'); io.unobserve(r.target); }
    }, { rootMargin: `0px 0px ${-Math.round((1 - entry) * 100)}% 0px` });
    list.forEach((el) => io.observe(el));
  }
}


// Smooth scrolling as measured: one wheel notch moves 100px and settles in ~530ms
// (exponential approach, lerp ≈ 0.13 per frame).
// npm i lenis
import Lenis from 'lenis';
export function initSmoothScroll() {
  const lenis = new Lenis({ lerp: 0.13, wheelMultiplier: 1, smoothWheel: true });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  return lenis;
}

export function initMotion() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in')); return; }
  initSmoothScroll();
  initReveals();
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMotion); else initMotion();
}
