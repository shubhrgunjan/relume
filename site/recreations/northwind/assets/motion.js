// Motion runtime measured from https://vercel.com by relume. Import once on every page.
// Scroll reveals start when an element's top crosses the measured fraction of the viewport height.
const ENTRY = {"reveal-fade-out-8":0.35,"reveal-tint-9":0.2,"reveal-tint-10":0.47,"reveal-fade-11":0.85,"reveal-fade-12":0.85,"reveal-fade-tint-13":0.85,"reveal-fade-out-14":1,"reveal-fade-out-15":1,"reveal-fade-16":0.85,"reveal-fade-17":0.35,"reveal-fade-18":0.85,"reveal-tint-19":0.85,"reveal-tint-20":0.85,"reveal-tint-21":0.85,"reveal-fade-out-scale-22":0.63,"reveal-fade-out-23":0.43,"reveal-fade-out-24":0.47};
const DEFAULT_ENTRY = 0.69;

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


// The source scrolls natively (one wheel notch = 100px, no smoothing). Keep it that way.
export function initSmoothScroll() { return null; }

export function initMotion() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in')); return; }
  initSmoothScroll();
  initReveals();
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMotion); else initMotion();
}
