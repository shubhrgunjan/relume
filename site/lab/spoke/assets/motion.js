// Motion runtime measured from https://resend.com by relume. Import once on every page.
// Scroll reveals start when an element's top crosses the measured fraction of the viewport height.
const ENTRY = {"reveal-fade-18":0.91,"reveal-fade-out-19":0.85,"reveal-fade-20":0.85,"reveal-fade-out-tint-21":1,"reveal-fade-down-22":0.85,"reveal-fade-23":0.85,"reveal-fade-24":0.93,"reveal-tint-25":0.71,"reveal-boxshadow-26":0.91,"reveal-tint-27":1,"reveal-boxshadow-28":1,"reveal-fade-up-scale-29":0.66,"reveal-down-30":0.66,"reveal-down-31":0.66,"reveal-down-32":0.71,"reveal-down-33":0.77,"reveal-down-34":0.82,"reveal-down-35":0.87,"reveal-down-36":0.93,"reveal-down-37":0.98,"reveal-down-38":1,"reveal-down-39":1,"reveal-down-40":1,"reveal-down-41":1,"reveal-down-42":1,"reveal-down-43":1,"reveal-fade-out-44":0.85};
const DEFAULT_ENTRY = 0.93;

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
