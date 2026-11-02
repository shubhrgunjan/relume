// relume motion · collage kit. Analog paper collage drawn procedurally on a 2D canvas: paper with fibre and
// mottling, pencil hatching, charcoal, dry-brush ink, torn edges, drawn 3D solids, letterpress type, and a
// stop-motion clock. Textures are built once (K.ready) and reused; every draw is a pure function of its inputs.
(function () {
  const K = {};
  K.W = 1280; K.H = 720;
  K.rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let x = Math.imul(seed ^ (seed >>> 15), 1 | seed); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  K.clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  K.lerp = (a, b, k) => a + (b - a) * k;
  K.prog = (t, a, b) => K.clamp((t - a) / (b - a));
  K.ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  K.out = (k) => 1 - Math.pow(1 - k, 3);
  /** stop-motion: the frame a drawing was made on (animated on `on`s) */
  K.q = (frame, on = 2) => Math.floor(frame / on) * on;
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  K.canvas = canvas;
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  K.hex = hex;
  K.mix = (a, b, k) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

  // ---------------------------------------------------------------- noise
  /** smooth value noise as a canvas: random cells scaled up with smoothing, several octaves */
  function noise(w, h, cell, seed, octaves = 3) {
    const out = canvas(w, h), g = out.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    const r = K.rng(seed);
    for (let o = 0; o < octaves; o++) {
      const cw = Math.max(2, Math.ceil(w / (cell / 2 ** o))), ch = Math.max(2, Math.ceil(h / (cell / 2 ** o)));
      const s = canvas(cw, ch), sg = s.getContext('2d'), d = sg.createImageData(cw, ch);
      for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      sg.putImageData(d, 0, 0);
      g.globalAlpha = 0.55 / (o + 1); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(s, 0, 0, w, h);
    }
    g.globalAlpha = 1; return out;
  }
  K.noise = noise;
  /** add per-pixel grain to a canvas, in place */
  function grain(c, amount, seed, cell = 1) {
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), r = K.rng(seed), W_ = c.width;
    const cw = Math.ceil(c.width / cell), cells = new Float32Array(cw * Math.ceil(c.height / cell)).map(() => (r() - 0.5) * amount);
    for (let i = 0, p = 0; i < d.data.length; i += 4, p++) { const x = p % W_, y = (p / W_) | 0, n = cells[((y / cell) | 0) * cw + ((x / cell) | 0)] + (cell > 1 ? (r() - 0.5) * amount * 0.35 : 0); d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; }
    g.putImageData(d, 0, 0); return c;
  }

  // ---------------------------------------------------------------- surfaces (cached)
  const cache = new Map();
  const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

  /** paper: a base colour, soft mottling, fibres light and dark, grain */
  K.paper = (base, seed = 1, o = {}) => memo(`p:${base}:${seed}:${JSON.stringify(o)}`, () => {
    const w = o.w || 1280, h = o.h || 720, c = canvas(w, h), g = c.getContext('2d'), r = K.rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = o.mottle ?? 0.5; g.drawImage(noise(w, h, o.cell || 260, seed), 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const fib = o.fibre ?? 1;
    for (let i = 0; i < 1600 * fib * (w * h) / (1280 * 720); i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI * 2, L = 4 + r() * 22;
      g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.12 + r() * 0.2})` : `rgba(60,55,65,${0.04 + r() * 0.07})`; g.lineWidth = 0.5 + r() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * L * 0.5 + (r() - 0.5) * 4, x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke();
    }
    return grain(c, o.grain ?? 22, seed + 7, o.cell2 ?? 2);
  });

  /** pencil hatching over a base: parallel strokes with pressure and wobble */
  K.hatch = (base, ink, seed = 1, o = {}) => memo(`h:${base}:${ink}:${seed}:${JSON.stringify(o)}`, () => {
    const w = o.w || 800, h = o.h || 800, c = canvas(w, h), g = c.getContext('2d'), r = K.rng(seed);
    if (base) { g.drawImage(K.paper(base, seed, { w, h, mottle: 0.3, fibre: 0.5 }), 0, 0); }
    const ang = o.angle ?? -0.9, sp = o.spacing ?? 5, dens = o.density ?? 0.85, [R, G, B] = hex(ink);
    g.save(); g.translate(w / 2, h / 2); g.rotate(ang);
    const D = Math.hypot(w, h);
    for (let y = -D / 2; y < D / 2; y += sp * (0.7 + r() * 0.6)) {
      if (r() > dens) continue;
      let x = -D / 2 + r() * 30;
      while (x < D / 2) {
        const L = 40 + r() * 160, p = 0.25 + r() * 0.6;
        g.strokeStyle = `rgba(${R},${G},${B},${p * (o.alpha ?? 0.55)})`; g.lineWidth = 0.6 + r() * (o.weight ?? 1.1);
        g.beginPath(); g.moveTo(x, y + (r() - 0.5) * 1.5); g.lineTo(x + L, y + (r() - 0.5) * 2.5); g.stroke();
        x += L + r() * 10;
      }
    }
    g.restore();
    return grain(c, 10, seed + 3);
  });

  /** charcoal: dense, grainy, uneven dark with streaks */
  K.charcoal = (ink, seed = 1, o = {}) => memo(`c:${ink}:${seed}:${JSON.stringify(o)}`, () => {
    const w = o.w || 800, h = o.h || 800, c = canvas(w, h), g = c.getContext('2d'), r = K.rng(seed);
    g.fillStyle = ink; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.7; g.drawImage(noise(w, h, 120, seed, 4), 0, 0);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    const ang = o.angle ?? -0.6;
    for (let i = 0; i < 1600; i++) {
      const x = r() * w, y = r() * h, L = 10 + r() * 60;
      g.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.03 + r() * 0.06})` : `rgba(0,0,0,${0.05 + r() * 0.08})`; g.lineWidth = 1 + r() * 3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L); g.stroke();
    }
    return grain(c, o.grain ?? 40, seed + 5);
  });

  /** dry brush: bands of a lighter ink dragged across a dark ground (the striped plum disc) */
  K.drybrush = (ground, ink, seed = 1, o = {}) => memo(`d:${ground}:${ink}:${seed}:${JSON.stringify(o)}`, () => {
    const w = o.w || 900, h = o.h || 900, c = canvas(w, h), g = c.getContext('2d'), r = K.rng(seed), [R, G, B] = hex(ink);
    g.fillStyle = ground; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2); g.rotate(o.angle ?? 0.5);
    const bands = o.bands ?? 6, D = Math.hypot(w, h);
    for (let b = 0; b < bands; b++) {
      const y0 = -D / 2 + (b + 0.5) * (D / bands), bw = D / bands * 0.45;
      for (let i = 0; i < 2600; i++) {
        const x = -D / 2 + r() * D, y = y0 + (r() - 0.5) * bw * (0.6 + r()), L = 8 + r() * 50;
        g.strokeStyle = `rgba(${R},${G},${B},${0.05 + r() * 0.16})`; g.lineWidth = 1 + r() * 3;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y + (r() - 0.5) * 3); g.stroke();
      }
    }
    g.restore();
    return grain(c, 30, seed + 9);
  });

  // ---------------------------------------------------------------- pieces
  /** a polygon with torn, slightly wavy edges (subdivided and jittered), as a path */
  K.tornPath = (g, pts, rough = 2.5, seed = 1) => {
    const r = K.rng(seed); g.beginPath();
    pts.forEach(([x0, y0], i) => {
      const [x1, y1] = pts[(i + 1) % pts.length], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L / 9));
      const ph = r() * 6.28, ph2 = r() * 6.28;
      for (let k = 0; k < n; k++) { const u = k / n, j = (Math.sin(u * 5 + ph) * 0.6 + Math.sin(u * 13 + ph2) * 0.3 + (r() - 0.5) * 0.5) * rough; const nx = -(y1 - y0) / L, ny = (x1 - x0) / L; const x = x0 + (x1 - x0) * u + nx * j, y = y0 + (y1 - y0) * u + ny * j; i === 0 && k === 0 ? g.moveTo(x, y) : g.lineTo(x, y); }
    });
    g.closePath();
  };
  /** draw a texture filling a path (the path must be built on g already) */
  K.fillTex = (g, tex, ox = 0, oy = 0, scale = 1) => { g.save(); g.clip(); g.translate(ox, oy); g.scale(scale, scale); const p = g.createPattern(tex, 'repeat'); g.fillStyle = p; g.fillRect(-ox / scale - 10, -oy / scale - 10, (K.W + 20) / scale, (K.H + 20) / scale); g.restore(); };
  /** a paper piece: a torn polygon in a texture, with a soft contact shadow */
  K.piece = (g, pts, tex, o = {}) => {
    const seed = o.seed ?? 1;
    if (o.shadow !== false) { g.save(); g.shadowColor = `rgba(30,25,35,${o.shadowAlpha ?? 0.18})`; g.shadowBlur = o.blur ?? 6; g.shadowOffsetX = 1.5; g.shadowOffsetY = 2.5; K.tornPath(g, pts, o.rough ?? 1.6, seed); g.fillStyle = '#000'; g.globalAlpha = 0.5; g.fill(); g.restore(); }
    K.tornPath(g, pts, o.rough ?? 1.6, seed); K.fillTex(g, tex, o.ox ?? 0, o.oy ?? 0, o.scale ?? 1);
  };
  K.rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  K.ellipsePts = (cx, cy, rx, ry, n = 72, a0 = 0, a1 = Math.PI * 2) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p; };
  K.disc = (g, cx, cy, rad, tex, o = {}) => K.piece(g, K.ellipsePts(cx, cy, rad, o.ry ?? rad, Math.max(24, rad / 3)), tex, o);

  /** an ink stroke along points, dry-brushed: a dense core, ragged bristle streaks at its edges, tapered ends;
      drawn up to `progress` of its length */
  K.brush = (g, pts, o = {}) => {
    const w = o.width ?? 16, ink = o.ink ?? '#141215', seed = o.seed ?? 1, p = o.progress ?? 1, r = K.rng(seed), [R, G, B] = hex(ink);
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = cum[cum.length - 1], end = tot * p;
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    // the inked core, tapered: a run of short segments whose width follows the taper
    for (let i = 1; i < pts.length; i++) {
      if (cum[i - 1] > end) break;
      const u0 = cum[i - 1] / tot, taper = Math.min(1, u0 * 8, (1 - u0) * 5 + 0.25);
      const fx = cum[i] > end ? (end - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1) : 1, [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      g.strokeStyle = `rgba(${R},${G},${B},0.93)`; g.lineWidth = w * 0.72 * taper;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fx); g.stroke();
    }
    // stamp along the path: each stamp is a short dab of bristles across the stroke's width
    const bristles = [...Array(Math.round(w * 1.4))].map(() => ({ o: (r() - 0.5) * 2, a: 0.5 + r() * 0.5, dry: r() }));
    for (let i = 1; i < pts.length; i++) {
      if (cum[i - 1] > end) break;
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = cum[i] - cum[i - 1] || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      const u0 = cum[i - 1] / tot, taper = Math.min(1, u0 * 8, (1 - u0) * 5 + 0.25) * (0.85 + 0.15 * Math.sin(u0 * 23 + seed));
      const fx = cum[i] > end ? (end - cum[i - 1]) / L : 1;
      for (const b of bristles) {
        // dry bristles skip in streaks toward the stroke's edges
        if (b.dry > 0.55 && Math.abs(b.o) > 0.55 && Math.sin(cum[i - 1] * 0.08 + b.dry * 40) > 0.25) continue;
        const off = b.o * w / 2 * taper;
        g.strokeStyle = `rgba(${R},${G},${B},${b.a})`; g.lineWidth = Math.max(0.8, w / bristles.length * 2.6);
        g.beginPath(); g.moveTo(x0 + nx * off, y0 + ny * off); g.lineTo(x0 + (x1 - x0) * fx + nx * off, y0 + (y1 - y0) * fx + ny * off); g.stroke();
      }
    }
    g.restore();
  };
  /** a smooth path from control points (Catmull-Rom), sampled */
  K.spline = (cp, n = 12) => { const out = []; for (let i = 0; i < cp.length - 1; i++) { const p0 = cp[Math.max(0, i - 1)], p1 = cp[i], p2 = cp[i + 1], p3 = cp[Math.min(cp.length - 1, i + 2)]; for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3))); } } out.push(cp[cp.length - 1]); return out; };

  // ---------------------------------------------------------------- drawn solids
  /** rotate a point by yaw (y), pitch (x), roll (z) */
  const rot = ([x, y, z], yaw, pitch, roll) => { let c = Math.cos(yaw), s = Math.sin(yaw); [x, z] = [x * c + z * s, -x * s + z * c]; c = Math.cos(pitch); s = Math.sin(pitch); [y, z] = [y * c - z * s, y * s + z * c]; c = Math.cos(roll); s = Math.sin(roll); [x, y] = [x * c - y * s, x * s + y * c]; return [x, y, z]; };
  K.rot = rot;
  /** a cuboid, drawn: visible faces filled with textures by how much they face the light, pencil edges */
  K.box = (g, o) => {
    const { cx, cy, sx = 100, sy = 100, sz = 100, yaw = 0, pitch = 0, roll = 0, persp = 1600 } = o;
    const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(([x, y, z]) => rot([x * sx / 2, y * sy / 2, z * sz / 2], yaw, pitch, roll));
    const P = V.map(([x, y, z]) => { const k = persp / (persp + z); return [cx + x * k, cy + y * k, z]; });
    const F = [[0, 1, 2, 3, [0, 0, -1]], [5, 4, 7, 6, [0, 0, 1]], [4, 0, 3, 7, [-1, 0, 0]], [1, 5, 6, 2, [1, 0, 0]], [4, 5, 1, 0, [0, -1, 0]], [3, 2, 6, 7, [0, 1, 0]]];
    const light = o.light || [-0.5, -0.8, -0.4];
    const faces = F.map(([a, b, c, d, n]) => { const N = rot(n, yaw, pitch, roll); const z = (P[a][2] + P[b][2] + P[c][2] + P[d][2]) / 4; return { pts: [P[a], P[b], P[c], P[d]].map((p) => [p[0], p[1]]), N, z, lit: N[0] * light[0] + N[1] * light[1] + N[2] * light[2] }; }).filter((f) => f.N[2] < -0.02).sort((a, b) => b.z - a.z);
    const tex = o.tex || [];
    for (const f of faces) {
      const k = f.lit > 0.35 ? 0 : f.lit > -0.2 ? 1 : 2;
      g.beginPath(); f.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
      K.fillTex(g, tex[k] || tex[0], o.ox ?? 0, o.oy ?? 0, o.scale ?? 1);
      if (o.edge !== false) { g.beginPath(); f.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.strokeStyle = o.edge || 'rgba(30,28,32,.55)'; g.lineWidth = o.edgeW ?? 1; g.stroke(); }
    }
    return faces;
  };

  // ---------------------------------------------------------------- type
  /** letterpress type: ink with uneven coverage and a slightly ragged edge */
  K.type = (g, text, x, y, o = {}) => {
    const size = o.size ?? 64, font = o.font ?? `400 ${size}px 'Libre Caslon Text', serif`;
    const c = canvas(Math.ceil(size * text.length * 0.9 + 40), Math.ceil(size * 1.6)), h = c.getContext('2d');
    h.font = font; h.textBaseline = 'alphabetic'; h.fillStyle = o.ink ?? '#1b191d'; h.fillText(text, 20, size * 1.15);
    if (o.tracking) { h.clearRect(0, 0, c.width, c.height); let xx = 20; for (const ch of text) { h.fillText(ch, xx, size * 1.15); xx += h.measureText(ch).width + o.tracking; } }
    h.globalCompositeOperation = 'destination-out';
    const rs = K.rng(o.seed ?? 3), nw = (o.wear ?? 0.35) * c.width * c.height / 60;
    for (let i = 0; i < nw; i++) { h.globalAlpha = 0.3 + rs() * 0.7; h.beginPath(); h.arc(rs() * c.width, rs() * c.height, 0.4 + rs() * 1.3, 0, 7); h.fill(); }
    h.globalAlpha = 1;
    h.globalCompositeOperation = 'source-over';
    const align = o.align ?? 'left', mw = (h.font = font, h.measureText(text).width + (o.tracking || 0) * text.length);
    g.drawImage(c, x - 20 - (align === 'center' ? mw / 2 : 0), y - size * 1.15);
    return mw;
  };

  // ---------------------------------------------------------------- the frame
  /** film grain over everything, new each drawing */
  let grainTile = null;
  K.filmGrain = (g, frame, amount = 0.07) => {
    if (!grainTile) { grainTile = grain(Object.assign(canvas(256, 256), {}), 0, 1); const gg = grainTile.getContext('2d'); const d = gg.createImageData(256, 256), r = K.rng(5); for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } gg.putImageData(d, 0, 0); }
    const r = K.rng(frame + 11); g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = amount; g.translate(-Math.floor(r() * 256), -Math.floor(r() * 256)); g.fillStyle = g.createPattern(grainTile, 'repeat'); g.fillRect(0, 0, K.W + 256, K.H + 256); g.restore();
  };
  /** a gentle vignette like a scanned sheet under a lamp */
  K.vignette = (g, a = 0.12) => { const v = g.createRadialGradient(K.W / 2, K.H / 2, K.H * 0.35, K.W / 2, K.H / 2, K.W * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(20,18,24,${a})`); g.fillStyle = v; g.fillRect(0, 0, K.W, K.H); };

  /** stop-motion boil: each new drawing is re-photographed, a fraction of a pixel off and a touch brighter or darker */
  K.boil = (frameq, amount = 1) => { const r = K.rng(frameq * 31 + 7); return { x: (r() - 0.5) * 1.6 * amount, y: (r() - 0.5) * 1.6 * amount, light: (r() - 0.5) * 0.05 * amount }; };
  window.K = K;
})();
