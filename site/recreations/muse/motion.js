// Motion runtime measured from https://www.cosmos.so by relume. Import once on every page.
// Scroll reveals start when an element's top crosses the measured fraction of the viewport height.
const ENTRY = {"reveal-fade-39":0.84,"reveal-fade-blur-40":0.85,"reveal-fade-blur-scale-41":1,"reveal-fade-42":0.85,"reveal-scale-43":0.9,"reveal-scale-44":0.56,"reveal-scale-45":0.22,"reveal-fade-blur-46":0.85,"reveal-fade-47":0.05,"reveal-fade-48":0.05,"reveal-tint-49":0.66,"reveal-translate-50":0.66,"reveal-tint-51":0.58,"reveal-tint-52":0.47,"reveal-width-53":0.22,"reveal-width-54":0.22,"reveal-width-55":0.33,"reveal-width-56":0.33};
const DEFAULT_ENTRY = 0.52;

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
