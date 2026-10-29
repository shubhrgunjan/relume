// Spoke's hero render: a dark chrome chainring at an angle with soft light streaks (1440×900, the source's hero
// image size; its pixels are ~84% #040404 and ~10% #151515, so the scene stays almost black).
import sharp from 'sharp';
const out = process.argv[2] || 'hero.jpg';
const W = 1440, H = 900;
let teeth = '', bolts = '', holes = '';
for (let i = 0; i < 52; i++) teeth += `<path d="M-7 -250 L7 -250 L5 -272 L-5 -272Z" transform="rotate(${(i * 360) / 52})" fill="url(#chrome)"/>`;
for (let i = 0; i < 5; i++) bolts += `<g transform="rotate(${i * 72}) translate(0 -150)"><circle r="16" fill="url(#chrome)"/><circle r="7" fill="#050505"/></g>`;
for (let i = 0; i < 5; i++) holes += `<path d="M-46 -205 Q0 -232 46 -205 L30 -150 Q0 -162 -30 -150Z" transform="rotate(${i * 72 + 36})" fill="#020202"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs>
  <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#3c3c3e"/><stop offset=".3" stop-color="#151516"/><stop offset=".48" stop-color="#6a6a6d"/><stop offset=".56" stop-color="#1a1a1b"/><stop offset=".8" stop-color="#0b0b0c"/><stop offset="1" stop-color="#2c2c2e"/>
  </linearGradient>
  <linearGradient id="face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d1d1f"/><stop offset=".5" stop-color="#0a0a0b"/><stop offset="1" stop-color="#161617"/></linearGradient>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="38"/></filter>
  <filter id="soft2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter>
  <radialGradient id="spot" cx=".78" cy=".06" r=".5"><stop offset="0" stop-color="#3a3a3a" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="#030303"/>
<rect width="${W}" height="${H}" fill="url(#spot)"/>
<path d="M-100 560 C 300 470, 760 520, 1540 330" stroke="#5a5a5a" stroke-opacity=".35" stroke-width="70" fill="none" filter="url(#soft)"/>
<path d="M-100 610 C 380 540, 820 560, 1540 420" stroke="#8a8a8a" stroke-opacity=".22" stroke-width="10" fill="none" filter="url(#soft2)"/>
<path d="M-100 700 C 420 650, 900 700, 1540 560" stroke="#4a4a4a" stroke-opacity=".25" stroke-width="40" fill="none" filter="url(#soft)"/>
<g transform="translate(1010 360) rotate(-24) scale(.62 .9)">
  <ellipse cx="18" cy="14" rx="285" ry="285" fill="#000" opacity=".8" filter="url(#soft2)"/>
  ${teeth}
  <circle r="252" fill="url(#face)" stroke="#2e2e30" stroke-width="2"/>
  <circle r="236" fill="none" stroke="url(#chrome)" stroke-width="6"/>
  ${holes}
  <circle r="120" fill="url(#chrome)"/>
  <circle r="100" fill="#0a0a0b"/>
  ${bolts}
  <circle r="46" fill="url(#chrome)"/><circle r="20" fill="#020202"/>
  <path d="M-200 -120 A 236 236 0 0 1 120 -205" stroke="#cfcfcf" stroke-opacity=".35" stroke-width="3" fill="none" filter="url(#soft2)"/>
</g>
</svg>`;
await sharp(Buffer.from(svg)).jpeg({ quality: 84 }).toFile(out);
console.log(out);
