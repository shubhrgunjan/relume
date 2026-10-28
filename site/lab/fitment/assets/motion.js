// Motion runtime measured from https://openhorizon.so/ by relume. Import once on every page.
// Scroll reveals start when an element's top crosses the measured fraction of the viewport height.
const ENTRY = {"reveal-fade-6":0.83,"reveal-fade-7":0.7,"reveal-fade-blur-8":0.85,"reveal-fade-out-9":0.85,"reveal-tint-10":0.85,"reveal-fade-11":0.85,"reveal-width-12":0.85,"reveal-tint-13":0.72,"reveal-fade-out-blur-tint-14":0.85,"reveal-fade-out-15":0.85,"reveal-fade-blur-tint-16":0.85,"reveal-fade-17":0.85,"reveal-tint-18":0.85,"reveal-tint-19":0.85,"reveal-left-20":0.85,"reveal-gridtemplaterows-21":0.85,"reveal-tint-22":0.85,"reveal-fade-out-23":0.85,"reveal-down-24":0.85,"reveal-fade-out-25":0.85};
const DEFAULT_ENTRY = 0.83;

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
