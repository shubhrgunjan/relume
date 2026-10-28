// Parse any computed CSS colour (rgb/rgba/hex/oklch/oklab/lab/lch/color()) into sRGB 0..255 plus alpha.
import { hex } from './color.js';

export interface RGBA { r: number; g: number; b: number; a: number }

const clamp = (v: number) => Math.max(0, Math.min(255, v));
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function linearToRgba(lr: number, lg: number, lb: number, a: number): RGBA {
  return { r: clamp(toGamma(lr) * 255), g: clamp(toGamma(lg) * 255), b: clamp(toGamma(lb) * 255), a };
}

function oklabToRgba(L: number, A: number, B: number, a: number): RGBA {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return linearToRgba(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s, a);
}

function labToRgba(L: number, A: number, B: number, a: number): RGBA {
  // CIE Lab (D50) -> XYZ D50 -> XYZ D65 (Bradford) -> linear sRGB
  const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200;
  const e = 216 / 24389, k = 24389 / 27;
  const xr = fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k;
  const yr = L > k * e ? fy ** 3 : L / k;
  const zr = fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k;
  const X = xr * 0.96422, Y = yr, Z = zr * 0.82521;
  const x = 0.9554734527042182 * X - 0.023098536874261423 * Y + 0.0632593086610217 * Z;
  const y = -0.028369706963208136 * X + 1.0099954580058226 * Y + 0.021041398966943008 * Z;
  const z = 0.012314001688319899 * X - 0.020507696433808273 * Y + 1.3303659366080753 * Z;
  return linearToRgba(3.2409699419 * x - 1.5373831776 * y - 0.4986107603 * z, -0.9692436363 * x + 1.8759675015 * y + 0.0415550574 * z, 0.0556300797 * x - 0.2039769589 * y + 1.0569715142 * z, a);
}

function p3ToRgba(r: number, g: number, b: number, a: number): RGBA {
  const R = toLinear(r), G = toLinear(g), B = toLinear(b);
  // linear P3 -> XYZ D65 -> linear sRGB
  const X = 0.4865709486 * R + 0.2656676932 * G + 0.1982172852 * B;
  const Y = 0.2289745641 * R + 0.6917385218 * G + 0.0792869141 * B;
  const Z = 0.0451133819 * G + 1.0439443689 * B;
  return linearToRgba(3.2409699419 * X - 1.5373831776 * Y - 0.4986107603 * Z, -0.9692436363 * X + 1.8759675015 * Y + 0.0415550574 * Z, 0.0556300797 * X - 0.2039769589 * Y + 1.0569715142 * Z, a);
}

const num = (s: string, pctScale = 1) => (s.endsWith('%') ? (parseFloat(s) / 100) * pctScale : parseFloat(s));

export function parseColor(input: string | undefined | null): RGBA | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  if (s === 'transparent' || s === 'none' || s === 'currentcolor') return s === 'transparent' ? { r: 0, g: 0, b: 0, a: 0 } : null;
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    const v = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: v(0), g: v(2), b: v(4), a: h.length === 8 ? v(6) / 255 : 1 };
  }
  const m = s.match(/^([a-z-]+)\((.*)\)$/);
  if (!m) return null;
  const fn = m[1];
  const parts = m[2].replace(/,/g, ' ').replace(/\//g, ' / ').split(/\s+/).filter(Boolean);
  const slash = parts.indexOf('/');
  let alpha = 1;
  let comps = parts;
  if (slash >= 0) { alpha = num(parts[slash + 1]); comps = parts.slice(0, slash); }
  if ((fn === 'rgb' || fn === 'rgba') && comps.length >= 3) {
    if (comps.length === 4) alpha = num(comps[3]);
    return { r: clamp(num(comps[0], 255)), g: clamp(num(comps[1], 255)), b: clamp(num(comps[2], 255)), a: alpha };
  }
  if (fn === 'oklch') { const L = num(comps[0]), C = num(comps[1], 0.4), H = (parseFloat(comps[2]) || 0) * Math.PI / 180; return oklabToRgba(L, C * Math.cos(H), C * Math.sin(H), alpha); }
  if (fn === 'oklab') return oklabToRgba(num(comps[0]), num(comps[1], 0.4), num(comps[2], 0.4), alpha);
  if (fn === 'lab') return labToRgba(num(comps[0], 100), num(comps[1], 125), num(comps[2], 125), alpha);
  if (fn === 'lch') { const L = num(comps[0], 100), C = num(comps[1], 150), H = (parseFloat(comps[2]) || 0) * Math.PI / 180; return labToRgba(L, C * Math.cos(H), C * Math.sin(H), alpha); }
  if (fn === 'color') {
    const space = comps[0];
    const [a, b, c] = comps.slice(1, 4).map((v) => num(v));
    if (space === 'srgb') return { r: clamp(a * 255), g: clamp(b * 255), b: clamp(c * 255), a: alpha };
    if (space === 'srgb-linear') return linearToRgba(a, b, c, alpha);
    if (space === 'display-p3') return p3ToRgba(a, b, c, alpha);
    return null;
  }
  if (fn === 'hsl' || fn === 'hsla') {
    if (comps.length === 4) alpha = num(comps[3]);
    const H = parseFloat(comps[0]) / 360, S = num(comps[1]), L = num(comps[2]);
    const f = (n: number) => { const k = (n + H * 12) % 12; const a2 = S * Math.min(L, 1 - L); return L - a2 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return { r: clamp(f(0) * 255), g: clamp(f(8) * 255), b: clamp(f(4) * 255), a: alpha };
  }
  return null;
}

export function rgbaHex(c: RGBA): string {
  return hex(c.r, c.g, c.b);
}

/** Colour as a CSS string: hex when opaque, rgb(r g b / a) otherwise. */
export function rgbaCss(c: RGBA): string {
  if (c.a >= 0.995) return rgbaHex(c);
  return `rgb(${Math.round(c.r)} ${Math.round(c.g)} ${Math.round(c.b)} / ${+c.a.toFixed(3)})`;
}

/** Composite a translucent colour over an opaque backdrop. */
export function over(c: RGBA, bg: RGBA): RGBA {
  return { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a), a: 1 };
}

/** Every colour literal inside a longer value (box-shadow, gradients). */
export function colorsIn(value: string): string[] {
  return value.match(/(rgba?|oklch|oklab|lab|lch|hsla?|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi) || [];
}

/** WCAG contrast ratio between two opaque colours. */
export function contrast(a: RGBA, b: RGBA): number {
  const lum = (c: RGBA) => 0.2126 * toLinear(c.r / 255) + 0.7152 * toLinear(c.g / 255) + 0.0722 * toLinear(c.b / 255);
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Rewrite lab()/oklab()/oklch()/lch()/color() inside any CSS value as hex or rgb(… / a), keeping the rest. */
export function normalizeColors(value: string): string {
  if (!value || !/(lab|lch|oklab|oklch|color)\(/i.test(value)) return value;
  return value.replace(/(oklab|oklch|lab|lch|color)\([^()]*\)/gi, (m) => { const c = parseColor(m); return c ? rgbaCss(c) : m; });
}

/** Browsers clamp "infinite" radii to 3.35544e+07px; that is a pill, written 9999px. */
export function normalizeRadius(v: string): string {
  if (!v) return v;
  return v.replace(/(\d+(?:\.\d+)?)(e\+?\d+)?px/g, (m, n, e) => (parseFloat(n + (e || '')) >= 9999 ? '9999px' : m));
}
