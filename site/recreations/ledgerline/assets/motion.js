// Motion runtime measured from https://stripe.com by relume. Import once on every page.
// Scroll reveals start when an element's top crosses the measured fraction of the viewport height.
const ENTRY = {"reveal-tint-46":0.33,"reveal-tint-47":0.18,"reveal-tint-48":0.11,"reveal-tint-49":0.41,"reveal-fade-down-50":0.85,"reveal-slide-51":0.85,"reveal-fade-52":1,"reveal-scale-53":1,"reveal-wipe-54":0.05};
const DEFAULT_ENTRY = 0.58;

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


// The source scrolls natively (one wheel notch = 0px, no smoothing). Keep it that way.
export function initSmoothScroll() { return null; }

export function initMotion() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in')); return; }
  initSmoothScroll();
  initReveals();
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMotion); else initMotion();
}
