// Raw RGB image helpers: crop, scale, encode, SSIM, sampling. Everything works on packed rgb24 buffers.
import sharp from 'sharp';

import { hex, luma } from './color.js';

export type Box = [number, number, number, number]; // x, y, w, h

export interface Img {
  w: number;
  h: number;
  data: Buffer;
}

export function crop(img: Img, [x, y, w, h]: Box): Img {
  x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
  w = Math.max(1, Math.min(img.w - x, Math.round(w))); h = Math.max(1, Math.min(img.h - y, Math.round(h)));
  const out = Buffer.alloc(w * h * 3);
  for (let r = 0; r < h; r++) img.data.copy(out, r * w * 3, ((y + r) * img.w + x) * 3, ((y + r) * img.w + x + w) * 3);
  return { w, h, data: out };
}

export async function resize(img: Img, w: number, h: number, kernel: 'nearest' | 'lanczos3' | 'mitchell' = 'lanczos3'): Promise<Img> {
  if (img.w === w && img.h === h) return img;
  const data = await sharp(img.data, { raw: { width: img.w, height: img.h, channels: 3 } })
    .resize(w, h, { fit: 'fill', kernel }).raw().toBuffer();
  return { w, h, data };
}

export async function toPng(img: Img): Promise<Buffer> {
  return sharp(img.data, { raw: { width: img.w, height: img.h, channels: 3 } }).png({ compressionLevel: 6 }).toBuffer();
}

export async function toWebp(img: Img, quality = 88): Promise<Buffer> {
  return sharp(img.data, { raw: { width: img.w, height: img.h, channels: 3 } }).webp({ quality }).toBuffer();
}

/** Decode any image file/buffer into rgb24 (alpha flattened onto white unless a background is given). */
export async function readImage(src: string | Buffer, background = '#ffffff'): Promise<Img> {
  const { data, info } = await sharp(src).flatten({ background }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data };
}

export function lumaPlane(img: Img): Float32Array {
  const n = img.w * img.h;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = luma(img.data[i * 3], img.data[i * 3 + 1], img.data[i * 3 + 2]);
  return out;
}

export function px(img: Img, x: number, y: number): [number, number, number] {
  const i = (Math.min(img.h - 1, Math.max(0, y | 0)) * img.w + Math.min(img.w - 1, Math.max(0, x | 0))) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

export function pxHex(img: Img, x: number, y: number): string {
  return hex(...px(img, x, y));
}

/**
 * Mean SSIM on luma with an 8x8 sliding window (stride 4). Returns the mean and a coarse map
 * (one value per window) so callers can find where two images disagree.
 */
export function ssim(a: Img, b: Img): { score: number; map: Float32Array; mw: number; mh: number } {
  if (a.w !== b.w || a.h !== b.h) throw new Error('ssim needs equal sizes');
  const la = lumaPlane(a), lb = lumaPlane(b);
  const W = 8, S = 4;
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
  const mw = Math.max(1, Math.floor((a.w - W) / S) + 1), mh = Math.max(1, Math.floor((a.h - W) / S) + 1);
  const map = new Float32Array(mw * mh);
  let sum = 0;
  for (let my = 0; my < mh; my++) {
    for (let mx = 0; mx < mw; mx++) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      const x0 = mx * S, y0 = my * S;
      const ww = Math.min(W, a.w - x0), hh = Math.min(W, a.h - y0);
      for (let y = 0; y < hh; y++) {
        let o = (y0 + y) * a.w + x0;
        for (let x = 0; x < ww; x++, o++) {
          const va = la[o], vb = lb[o];
          sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb;
        }
      }
      const n = ww * hh;
      const ma = sa / n, mb = sb / n;
      const va = saa / n - ma * ma, vb = sbb / n - mb * mb, cov = sab / n - ma * mb;
      const s = ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      map[my * mw + mx] = s;
      sum += s;
    }
  }
  return { score: sum / (mw * mh), map, mw, mh };
}

/** Mean absolute RGB difference, 0..255. */
export function meanAbsDiff(a: Img, b: Img): number {
  let s = 0;
  for (let i = 0; i < a.data.length; i++) s += Math.abs(a.data[i] - b.data[i]);
  return s / a.data.length;
}

/** Place images side by side with a gap and labels drawn as thin bars (labels go in the JSON alongside). */
export async function sideBySide(imgs: Img[], gap = 8, bg: [number, number, number] = [128, 128, 128]): Promise<Img> {
  const h = Math.max(...imgs.map((i) => i.h));
  const w = imgs.reduce((s, i) => s + i.w, 0) + gap * (imgs.length - 1);
  const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { out[i * 3] = bg[0]; out[i * 3 + 1] = bg[1]; out[i * 3 + 2] = bg[2]; }
  let x0 = 0;
  for (const im of imgs) {
    for (let y = 0; y < im.h; y++) im.data.copy(out, (y * w + x0) * 3, y * im.w * 3, (y + 1) * im.w * 3);
    x0 += im.w + gap;
  }
  return { w, h, data: out };
}


/** Upscale small crops with nearest-neighbour so individual pixels stay readable. */
export async function zoomUp(img: Img, minSide = 480): Promise<Img> {
  const k = Math.max(1, Math.min(16, Math.floor(minSide / Math.max(1, Math.min(img.w, img.h)))));
  return k === 1 ? img : resize(img, img.w * k, img.h * k, 'nearest');
}

export function clampBox([x, y, w, h]: Box, W: number, H: number): Box {
  const x0 = Math.max(0, Math.min(W - 1, Math.round(x))), y0 = Math.max(0, Math.min(H - 1, Math.round(y)));
  return [x0, y0, Math.max(1, Math.min(W - x0, Math.round(w))), Math.max(1, Math.min(H - y0, Math.round(h)))];
}

export function iou(a: Box, b: Box): number {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const u = a[2] * a[3] + b[2] * b[3] - inter;
  return u > 0 ? inter / u : 0;
}
