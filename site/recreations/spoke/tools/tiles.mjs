// Renders Spoke's four looping icon tiles (the source's 3D tiles are 170×170 looping videos).
// node tiles.mjs <outdir>  → wheel.mp4, cassette.mp4, crank.mp4, computer.mp4 (+ .jpg posters)
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] || 'media';
const S = 340, N = 72; // 340px renders, shown at 170px; 72 frames at 24fps = 3s loop
const rad = (d) => (d * Math.PI) / 180;

const tile = (glow) => `
  <defs>
    <linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2b2e"/><stop offset=".55" stop-color="#121214"/><stop offset="1" stop-color="#070708"/></linearGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".4" stop-color="#ffffff" stop-opacity=".04"/><stop offset="1" stop-color="#ffffff" stop-opacity=".1"/></linearGradient>
    <radialGradient id="g" cx=".5" cy=".86" r=".42"><stop offset="0" stop-color="${glow}" stop-opacity=".9"/><stop offset=".5" stop-color="${glow}" stop-opacity=".25"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
    <linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f4f4"/><stop offset=".35" stop-color="#8c8c90"/><stop offset=".6" stop-color="#2a2a2d"/><stop offset=".85" stop-color="#9a9a9e"/><stop offset="1" stop-color="#3a3a3d"/></linearGradient>
    <linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a5a5e"/><stop offset="1" stop-color="#101012"/></linearGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="#000"/>
  <rect x="20" y="20" width="300" height="300" rx="64" fill="url(#t)"/>
  <rect x="20" y="20" width="300" height="300" rx="64" fill="url(#g)"/>
  <rect x="20.5" y="20.5" width="299" height="299" rx="63.5" fill="none" stroke="url(#edge)" stroke-width="2"/>`;

// a bicycle wheel seen at an angle: rim, tyre, 24 tangent spokes, hub; turns one spoke gap per loop
function wheel(f) {
  const a = (f / N) * 15;
  let sp = '';
  for (let i = 0; i < 24; i++) {
    const t = rad(a + i * 15), h = rad(a + i * 15 + (i % 2 ? 30 : -30));
    sp += `<line x1="${Math.cos(h) * 12}" y1="${Math.sin(h) * 12}" x2="${Math.cos(t) * 84}" y2="${Math.sin(t) * 84}" stroke="#bdbdc2" stroke-opacity=".75" stroke-width="1.6"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${tile('#e8a23c')}
    <g transform="translate(170 168) rotate(-18) scale(.82 1)">
      <circle r="104" fill="none" stroke="#0c0c0d" stroke-width="22"/>
      <circle r="104" fill="none" stroke="url(#d)" stroke-width="18"/>
      <circle r="88" fill="none" stroke="url(#m)" stroke-width="9"/>
      ${sp}
      <circle r="16" fill="url(#m)"/><circle r="6" fill="#111"/>
    </g></svg>`;
}

// a cassette: stacked cogs with teeth, turning one tooth per loop
function cassette(f) {
  let s = '';
  const cogs = [[96, 36], [82, 30], [68, 25], [54, 20]];
  cogs.forEach(([r, n], k) => {
    const a = (f / N) * (360 / n);
    let p = '';
    for (let i = 0; i < n; i++) {
      const t0 = rad(a + (i * 360) / n), t1 = rad(a + ((i + 0.5) * 360) / n);
      p += `${i ? 'L' : 'M'}${(Math.cos(t0) * r).toFixed(1)} ${(Math.sin(t0) * r).toFixed(1)} L${(Math.cos(t0) * (r + 7)).toFixed(1)} ${(Math.sin(t0) * (r + 7)).toFixed(1)} L${(Math.cos(t1) * (r + 7)).toFixed(1)} ${(Math.sin(t1) * (r + 7)).toFixed(1)} L${(Math.cos(t1) * r).toFixed(1)} ${(Math.sin(t1) * r).toFixed(1)}`;
    }
    s += `<g transform="translate(${k * 7} ${-k * 4})"><path d="${p}Z" fill="${k % 2 ? 'url(#m)' : 'url(#d)'}" stroke="#000" stroke-opacity=".5"/><circle r="${r - 10}" fill="#0d0d0f"/></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${tile('#8b5cf6')}
    <g transform="translate(160 176) scale(.9 .8) rotate(-12)">${s}<circle r="14" fill="url(#m)"/></g></svg>`;
}

// a crankset: chainring and crank arm with pedal, one turn per loop
function crank(f) {
  const a = (f / N) * 360;
  let teeth = '';
  for (let i = 0; i < 44; i++) { const t = rad(i * (360 / 44)); teeth += `<rect x="-2.5" y="-82" width="5" height="9" rx="1" fill="#9a9aa0" transform="rotate(${(i * 360) / 44})"/>`; void t; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${tile('#22d3ee')}
    <g transform="translate(170 172) scale(.86 .9)">
      <g transform="rotate(${a})">
        ${teeth}
        <circle r="74" fill="url(#d)" stroke="#000" stroke-opacity=".6"/>
        <circle r="74" fill="none" stroke="url(#m)" stroke-width="5"/>
        ${[0, 72, 144, 216, 288].map((r) => `<path d="M-9 -20 L9 -20 L5 -64 L-5 -64Z" fill="url(#m)" transform="rotate(${r})"/>`).join('')}
        <rect x="-11" y="-6" width="22" height="104" rx="11" fill="url(#m)" transform="rotate(180)"/>
      </g>
      <g transform="rotate(${a}) translate(0 -98) rotate(${-a})"><rect x="-30" y="-9" width="60" height="18" rx="5" fill="#1b1b1e" stroke="#8a8a90" stroke-opacity=".7"/></g>
      <circle r="18" fill="url(#m)"/><circle r="7" fill="#0c0c0d"/>
    </g></svg>`;
}

// a ride computer: a rounded device with a speed dial whose needle sweeps and settles
function computer(f) {
  const u = f / N, v = 0.5 - 0.5 * Math.cos(u * 2 * Math.PI);
  const ang = -120 + 200 * v, kmh = Math.round(18 + 24 * v);
  let ticks = '';
  for (let i = 0; i <= 20; i++) { const t = -120 + i * 12; ticks += `<line x1="0" y1="-62" x2="0" y2="${i % 5 ? -56 : -50}" stroke="#8d8d92" stroke-width="${i % 5 ? 1.2 : 2}" transform="rotate(${t})"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${tile('#22c55e')}
    <g transform="translate(170 166)">
      <rect x="-86" y="-96" width="172" height="196" rx="38" fill="url(#d)" stroke="url(#m)" stroke-width="3"/>
      <rect x="-70" y="-80" width="140" height="150" rx="26" fill="#060607"/>
      <g transform="translate(0 4)">${ticks}
        <path d="M0 0 L-3 -6 L0 -58 L3 -6Z" fill="#43fea4" transform="rotate(${ang})"/>
        <circle r="7" fill="url(#m)"/>
        <text y="40" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-size="20" fill="#ebeced">${kmh}</text>
        <text y="56" text-anchor="middle" font-family="DejaVu Sans Mono, monospace" font-size="9" fill="#6c6c6c">KM/H</text>
      </g>
    </g></svg>`;
}

mkdirSync(OUT, { recursive: true });
for (const [name, fn] of [['wheel', wheel], ['cassette', cassette], ['crank', crank], ['computer', computer]]) {
  const dir = join(OUT, `_${name}`);
  mkdirSync(dir, { recursive: true });
  for (let f = 0; f < N; f++) await sharp(Buffer.from(fn(f))).png().toFile(join(dir, `${String(f).padStart(3, '0')}.png`));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '24', '-i', join(dir, '%03d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', join(OUT, `${name}.mp4`)]);
  await sharp(join(dir, '000.png')).jpeg({ quality: 82 }).toFile(join(OUT, `${name}.jpg`));
  rmSync(dir, { recursive: true });
  console.log(name);
}
