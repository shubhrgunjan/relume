// Turn measured motion patterns into recipes an agent can paste: grouped by what moves together, with exact
// durations, curves (springs kept as linear()), delays, stagger and scroll entry points.
import type { MotionPattern } from '../infer/motion.js';

export interface Recipe {
  id: string; name: string; trigger: MotionPattern['trigger']; duration: number; easing: string; easingApprox?: string;
  delay: number; stagger?: number; entry?: number; count: number; from: string; to: string; props: string[];
  transitionCss: string; keyframesCss?: string; targets: string[]; scrollRatio?: number; iterations?: number | string; source: string;
}

const CSS_PROP: Record<string, string> = { backgroundColor: 'background-color', borderTopColor: 'border-color', boxShadow: 'box-shadow', clipPath: 'clip-path', 'clip-path': 'clip-path', strokeDashoffset: 'stroke-dashoffset' };
const kebab = (p: string) => CSS_PROP[p] || p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

/** {x, y, scale, rotate, opacity, filter, transform…} → CSS declarations. */
export function declsOf(v: Record<string, string | number>): Record<string, string> {
  const out: Record<string, string> = {};
  const t: string[] = [];
  if (v.transform !== undefined) t.push(String(v.transform));
  if (v.x !== undefined || v.y !== undefined) t.push(`translate(${v.x ?? 0}px, ${v.y ?? 0}px)`);
  if (v.scale !== undefined) t.push(`scale(${v.scale})`);
  if (v.rotate !== undefined) t.push(`rotate(${v.rotate}deg)`);
  if (t.length) out.transform = t.join(' ');
  for (const [k, val] of Object.entries(v)) {
    if (['transform', 'x', 'y', 'scale', 'rotate', 'width', 'height'].includes(k)) continue;
    out[kebab(k)] = String(val);
  }
  // numbers from tracked boxes need a unit; keyframe strings ("50px") already carry one
  const len = (x: string | number) => (typeof x === 'number' || /^-?[\d.]+$/.test(String(x)) ? `${x}px` : String(x));
  if (v.width !== undefined) out.width = len(v.width);
  if (v.height !== undefined) out.height = len(v.height);
  return out;
}

const declStr = (d: Record<string, string>) => Object.entries(d).map(([k, v]) => `${k}: ${v};`).join(' ');

export function buildRecipes(patterns: MotionPattern[]): Recipe[] {
  // patterns that hit the same targets with the same clock are one motion (opacity + blur + translate)
  const groups = new Map<string, MotionPattern[]>();
  for (const p of patterns) {
    if (p.trigger === 'hover-exit' || p.trigger === 'state') continue;
    const key = [p.trigger, p.targets[0], p.duration, p.easing, p.delay, p.source === 'js' ? p.id : ''].join('|');
    const g = groups.get(key) || [];
    g.push(p);
    groups.set(key, g);
  }
  let recipes: Recipe[] = [];
  let n = 0;
  for (const g of groups.values()) {
    const p0 = g[0];
    const from: Record<string, string | number> = {}, to: Record<string, string | number> = {};
    for (const p of g) { Object.assign(from, p.from); Object.assign(to, p.to); }
    // something that fades to nothing as it loads or scrolls into view is leaving (a loader, a hint going away),
    // not an entrance: as a reveal recipe it would make the agent's element vanish
    if ((p0.trigger === 'scroll' || p0.trigger === 'load') && to.opacity !== undefined && +to.opacity <= 0.05 && +(from.opacity ?? 1) > +to.opacity) continue;
    const fromD = declsOf(from), toD = declsOf(to);
    const props = [...new Set(g.flatMap((p) => p.props.map(kebab)))];
    const cssProps = [...new Set([...Object.keys(fromD), ...Object.keys(toD)])];
    const count = Math.max(...g.map((p) => p.count));
    const stagger = g.find((p) => p.stagger)?.stagger;
    const entry = g.find((p) => p.entry !== undefined)?.entry;
    const name = nameOf(p0.trigger, cssProps, from, to, n++);
    const transitionCss = cssProps.map((cp) => `${cp} ${p0.duration}ms ${p0.easing}${p0.delay ? ` ${p0.delay}ms` : ''}`).join(',\n    ');
    let keyframesCss: string | undefined;
    if (p0.trigger === 'load' || p0.trigger === 'loop') {
      keyframesCss = p0.keyframes
        ? `@keyframes ${name} { ${p0.keyframes} }`
        : `@keyframes ${name} {\n  from { ${declStr(fromD)} }\n  to { ${declStr(toD)} }\n}`;
    }
    recipes.push({
      id: g.map((p) => p.id).join('+'), name, trigger: p0.trigger, duration: p0.duration, easing: p0.easing, easingApprox: g.find((p) => p.easingApprox)?.easingApprox,
      delay: p0.delay, stagger, entry, count, from: declStr(fromD), to: declStr(toD), props: cssProps.length ? cssProps : props,
      transitionCss, keyframesCss, targets: [...new Set(g.flatMap((p) => p.targets))].slice(0, 4), scrollRatio: p0.scrollRatio, iterations: p0.iterations, source: p0.source,
    });
  }
  const order: Record<string, number> = { load: 0, scroll: 1, 'scroll-linked': 2, hover: 3, focus: 4, loop: 5 };
  // ambient loops are numerous and repetitive (spinners, dots); keep the distinct, most-used few
  const loops = recipes.filter((r) => r.trigger === 'loop').sort((a, b) => b.count - a.count);
  const keepLoops = new Set<Recipe>();
  const seenLoop = new Set<string>();
  for (const r of loops) { const k = r.props.join() + r.duration; if (seenLoop.has(k)) continue; seenLoop.add(k); keepLoops.add(r); if (keepLoops.size >= 6) break; }
  recipes = recipes.filter((r) => r.trigger !== 'loop' || keepLoops.has(r));
  return recipes.sort((a, b) => (order[a.trigger] ?? 9) - (order[b.trigger] ?? 9) || b.count - a.count);
}

function nameOf(trigger: string, props: string[], from: Record<string, any>, to: Record<string, any>, i: number) {
  const parts: string[] = [];
  if (props.includes('opacity') && +from.opacity < +to.opacity) parts.push('fade');
  if (props.includes('opacity') && +from.opacity > +to.opacity) parts.push('fade-out');
  if (props.includes('filter') && /blur/.test(String(from.filter))) parts.push('blur');
  if (props.includes('transform')) {
    const t = JSON.stringify(from);
    if (/"y"|translateY|translate\(/.test(t)) parts.push(Number(from.y ?? 1) >= 0 && !/translateY\(-/.test(t) ? 'up' : 'down');
    else if (/"x"|translateX/.test(t)) parts.push('slide');
    if (/scale/.test(t)) parts.push('scale');
    if (/rotate/.test(t)) parts.push('spin');
  }
  if (props.some((p) => /color/.test(p))) parts.push('tint');
  if (props.includes('clip-path')) parts.push('wipe');
  if (!parts.length) parts.push(props[0]?.replace(/[^a-z]/gi, '') || 'motion');
  const pre = trigger === 'load' ? 'intro' : trigger === 'scroll' ? 'reveal' : trigger === 'scroll-linked' ? 'parallax' : trigger;
  return `${pre}-${parts.join('-')}-${i + 1}`;
}
