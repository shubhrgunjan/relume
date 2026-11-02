// relume motion launch film: the Harvey II film's style, shot for shot, for our own story.
// Story: the chaos of footage and references → the measured style → the product → "Footage" becomes "Motion." → r.
// Each shot of window.REF (measured cut frames) maps to a scene; scenes draw from quantised time (on 2s).
const g = document.getElementById('c').getContext('2d');
const fx = document.getElementById('fx').getContext('2d');
const UI = document.getElementById('ui');
const { rect, piece, disc, brush, spline, box, paper, hatch, charcoal, drybrush, fillTex, tornPath, prog, lerp, clamp, ease, out, rng } = K;
const W = 1280, H = 720, FPS = REF.fps;
window.DURATION = REF.duration;

// ---------------------------------------------------------------- palette (measured: STYLE.md)
const P = {
  paper: '#f1eff2', white: '#f8f6f9', g1: '#d9d8d9', g2: '#c6c2c4', g3: '#a3a0a5', g4: '#7d787a', g5: '#545057', ink: '#27272a',
  lilac: '#565071', lilacPale: '#b9b2c6', lilacMid: '#8d86a0', rose: '#8b7676', rosePale: '#d9c6c6', sage: '#b6c2bd', olive: '#69694f',
  blue: '#d5dde1', green: '#2d3632', beige: '#d8d6cc', plum: '#211b2b', slate: '#6c6f86', teal: '#5f9a8d',
};
// textures, built once
const T = {
  paper: () => paper('#f3f1f4', 3, { grain: 34, mottle: 0.7, fibre: 1.6 }), paperW: () => paper('#f8f6f9', 4, { grain: 28, mottle: 0.45, fibre: 1.3 }), grey: () => paper('#cfcbd0', 8), greyD: () => paper('#9e9a9f', 21, { mottle: 0.8 }),
  rose: () => charcoal('#8b7676', 31, { grain: 26 }), roseP: () => paper(P.rosePale, 32), olive: () => charcoal('#636149', 33, { grain: 50 }), ink: () => charcoal('#1f1d21', 34),
  lilac: () => paper(P.lilac, 35, { mottle: 0.6 }), lilacP: () => paper(P.lilacPale, 36), blue: () => paper(P.blue, 37), hatchD: () => hatch('#e7e5e8', '#2b282d', 38, { spacing: 3.5, alpha: 0.75 }),
  hatchL: () => hatch('#ecebed', '#4b474d', 39, { spacing: 5, alpha: 0.45 }), charL: () => charcoal('#8d8a8f', 40, { grain: 30 }), charM: () => charcoal('#55525a', 41), charD: () => charcoal('#2a282c', 42),
  plum: () => drybrush(P.plum, '#5b5175', 43, { bands: 7, angle: 0.45 }), green: () => paper(P.green, 44, { mottle: 0.7 }), beige: () => paper(P.beige, 45), sage: () => paper(P.sage, 46),
  slate: () => paper(P.slate, 47, { mottle: 0.6 }), teal: () => charcoal('#5f9a8d', 48, { grain: 30 }), rose2: () => paper('#c9b1b0', 49, { mottle: 0.7 }), stone: () => paper('#bdbcbe', 50, { mottle: 0.9, cell: 120 }),
  g1: () => paper(P.g1, 51), g2: () => paper(P.g2, 52), g3: () => paper(P.g3, 53, { mottle: 0.7 }), g4: () => paper(P.g4, 54, { mottle: 0.7 }), g5: () => charcoal(P.g5, 55, { grain: 24 }),
};
const tex = new Proxy({}, { get: (_, k) => T[k]() });
const bg = (t) => { g.drawImage(t, 0, 0); };
const solid = (pts, t, o = {}) => piece(g, pts, t, { shadow: false, rough: 0.6, ...o });
const line = (x0, y0, x1, y1, w = 1, c = 'rgba(30,28,32,.75)') => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
const frameSq = (x, y, s, w = 1) => { g.strokeStyle = 'rgba(30,28,32,.7)'; g.lineWidth = w; g.strokeRect(x, y, s, s); };
const R8 = ['11011110', '11111111', '11100011', '11000000', '11000000', '11000000', '11000000', '11000000'];

/** small pieces that change on every drawing inside a region: the constant life of stop-motion collage */
function pops(f, n, [x0, y0, x1, y1], seed = 1, pal = null) {
  const r = rng(Math.floor(f / 2) * 97 + seed), set = pal || [tex.ink, tex.charM, tex.g2, tex.charL, tex.lilacP, tex.rose];
  for (let j = 0; j < n; j++) { const w = 10 + r() * 50, h = 6 + r() * 34; piece(g, rect(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), w, h), set[j % set.length], { seed: seed * 50 + j, shadow: r() < 0.5 }); }
}

// ---------------------------------------------------------------- UI (DOM), built once
const ui = {};
const mk = (id, css, html) => { const e = document.createElement('div'); e.id = id; e.style.cssText = css; e.innerHTML = html; UI.appendChild(e); ui[id] = e; return e; };
const icon = `<span class="ico">${'1101111111100011'.split('').map((v) => `<i class="${v === '1' ? '' : 'o'}"></i>`).join('')}</span>`;
mk('home', 'left:0;top:0;width:1000px;height:520px', `<div class="win" style="position:absolute;inset:0">
  <div class="side" style="width:150px;padding:16px 14px;font-size:12px;line-height:2.1"><div class="serif" style="font-size:17px;margin-bottom:8px">relume motion</div>New edit<br>References<br>Styles<br>Renders<br><br><span style="opacity:.5">Recent</span><br>Launch film<br>Reel cut</div>
  <div style="position:absolute;left:150px;right:0;top:0;bottom:0">
    <div style="position:absolute;left:0;right:0;top:0;height:40px;border-bottom:1px solid #eeecef"></div>
    <div class="serif" id="homeH" style="position:absolute;left:0;right:0;top:130px;text-align:center;font-size:34px">Good evening, Shubhr</div>
    <div style="position:absolute;left:150px;right:150px;top:200px;height:96px;border-radius:12px;box-shadow:0 0 0 1px #e4e2e6;padding:16px;font-size:14px;color:#77727b">Edit my launch footage in the style of <b style="color:#1d1b1f;font-weight:500">harvey.mp4</b>…<div style="position:absolute;left:16px;bottom:12px;display:flex;gap:8px"><span class="chipui" style="padding:5px 10px;font-size:11px">＋ Footage</span><span class="chipui" style="padding:5px 10px;font-size:11px">Reference</span></div></div>
    <div style="position:absolute;left:150px;right:150px;top:330px;display:flex;gap:10px;font-size:11px">${['Study a reference', 'Match the rhythm', 'Compare a cut'].map((s) => `<span class="chipui" style="padding:7px 10px;font-size:11px">${s}</span>`).join('')}</div>
  </div></div>`);
mk('node', 'left:0;top:0;width:1280px;height:720px', `
  <div class="panel" style="position:absolute;left:256px;top:304px;width:160px;background:#161417;color:#eee;font-size:10px;line-height:1.75;padding:8px 12px">References<br><span style="opacity:.75">▪ harvey.mp4<br>▪ figma-anthem.mp4<br>▪ reel-04.mp4<br>▪ View all</span></div>
  <div style="position:absolute;left:536px;top:264px;width:208px;height:192px;border-radius:10px;background:#c7d0d2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px"><div style="display:flex;align-items:center;gap:10px">${icon}<span class="serif" style="font-size:26px">Launch film</span></div><span class="chipui" style="padding:4px 9px;font-size:10px">47 shots · on 2s</span></div>
  <div class="panel" style="position:absolute;left:864px;top:304px;width:160px;background:#161417;color:#eee;font-size:10px;line-height:1.75;padding:8px 12px">Shots<br><span style="opacity:.75">• Opening collage<br>• Cube, measured<br>• Footage → Motion.<br>• The r</span></div>
  <div class="panel" style="position:absolute;left:560px;top:30px;width:160px;padding:10px 12px;font-size:10px;line-height:1.8">Style<br><span style="opacity:.6">rhythm · cadence · palette</span></div>
  <div class="panel" style="position:absolute;left:560px;top:600px;width:160px;padding:10px 12px;font-size:10px;line-height:1.8">Render<br><span style="opacity:.6">60.1 s · 24 fps</span></div>`);
mk('search', 'left:0;top:0;width:1000px;height:590px', `<div class="win" style="position:absolute;inset:0">
  <div class="side" style="width:26px;left:14px;top:14px;bottom:14px;border-radius:7px"></div>
  <div class="serif" style="position:absolute;left:0;right:0;top:170px;text-align:center;font-size:30px">What are we cutting today?</div>
  <div style="position:absolute;left:300px;width:400px;top:235px;border-radius:10px;box-shadow:0 8px 24px rgb(30 25 35 / .1), 0 0 0 1px #e8e6ea;font-size:12px">
    <div style="padding:11px 14px;color:#88838c;border-bottom:1px solid #eeecef">⌕&nbsp; Search references and edits</div>
    ${[['REF-0412', 'harvey-launch.mp4 · collage, on 2s'], ['REF-0388', 'figma-anthem.mp4 · pixel, 30 fps'], ['EDIT-0091', 'relume launch · draft 3']].map(([a, b], i) => `<div class="srow" style="display:flex;gap:16px;padding:10px 14px"><span style="color:#55505a;width:76px">${a}</span><span style="display:flex;gap:8px;align-items:center"><i style="width:12px;height:12px;border-radius:3px;background:#3d4a46"></i>${b}</span></div>`).join('')}
  </div>
  <svg id="cursor" style="position:absolute;left:0;top:0" width="18" height="26" viewBox="0 0 36 56"><path d="M2 2v44l11-11 9 19 7-3-9-19h15z" fill="#fff" stroke="#111" stroke-width="3" stroke-linejoin="round"/></svg></div>`);
mk('diag', 'left:0;top:0;width:1280px;height:720px', `
  <div class="chipui" style="position:absolute;left:150px;top:60px;max-width:300px;white-space:normal;line-height:1.5;font-size:12px;padding:12px 16px">Find every cut, hold each drawing for two frames, and keep the paper texture.</div>
  <div class="panel" style="position:absolute;left:870px;top:400px;width:230px;padding:12px 14px;line-height:2.1;font-size:11px"><b style="font-weight:500">relume motion is measuring</b><br>☑ rhythm · 47 cuts<br>☑ cadence · on 2s<br>☐ palette · 8 colours</div>`);
mk('chips', 'left:0;top:0;width:1280px;height:720px', `
  <span class="chipui" style="position:absolute;left:880px;top:150px">◎&nbsp; On 2s — hold each drawing</span>
  <span class="chipui" style="position:absolute;left:140px;top:215px">◎&nbsp; …cut at 8.667 s, frame 208</span>`);
mk('chips2', 'left:0;top:0;width:1280px;height:720px', `
  <span class="chipui" style="position:absolute;left:200px;top:440px">▣&nbsp; Your References</span>
  <span class="chipui" style="position:absolute;left:760px;top:115px">▣&nbsp; Your Styles</span>
  <span class="chipui" style="position:absolute;left:600px;top:600px">▣&nbsp; Your Renders</span>`);
mk('chips3', 'left:0;top:0;width:1280px;height:720px', `
  <span class="chipui" style="position:absolute;left:470px;top:110px">◎&nbsp; Study harvey.mp4</span>
  <span class="chipui" style="position:absolute;left:330px;top:300px">◎&nbsp; The user wants holds on twos</span>
  <span class="chipui" style="position:absolute;left:800px;top:300px">◎&nbsp; Cut on the measured frames</span>
  <span class="chipui" style="position:absolute;left:330px;top:400px">◎&nbsp; Match the paper texture</span>
  <span class="chipui" style="position:absolute;left:800px;top:400px">◎&nbsp; Compare against the reference</span>
  <span class="chipui" style="position:absolute;left:520px;top:600px">◎&nbsp; The user prefers quiet endings</span>`);
mk('list', 'left:0;top:0;width:1280px;height:720px', `
  <div class="panel" style="position:absolute;left:140px;top:30px;width:330px;font-size:11px">${[['harvey-launch.mp4', 'MP4'], ['figma-anthem.mp4', 'MP4'], ['launch-footage_take3.mov', 'MOV'], ['vo-draft_v2.wav', 'WAV'], ['shotlist_final.csv', 'CSV']].map(([a, b]) => `<div class="row"><span style="flex:1">▸ ${a}</span><span style="color:#8a858e">${b}</span></div>`).join('')}</div>
  <div style="position:absolute;left:730px;top:400px;width:330px;font-size:12px;line-height:1.6;color:#3a363d"><b style="font-weight:500">◇ Matching</b><br>I'll start by studying the reference frame by frame, then cut your footage on the same frames.<br><br><b style="font-weight:500">◇ Holding on twos</b><br>Each drawing stays for two frames, like the original.</div>`);
mk('panels', 'left:0;top:0;width:1280px;height:720px', `
  <div class="panel" style="position:absolute;left:510px;top:-6px;width:260px"><div class="hd">Shots</div>${['Opening collage · 2.42 s', 'Cube, measured · 0.17 s', 'Footage → Motion. · 2.83 s'].map((s) => `<div class="row">${s}</div>`).join('')}</div>
  <div class="panel" style="position:absolute;left:20px;top:290px;width:270px"><div class="hd">Edits</div>${[['Cut on the reference frames', 'Done', ''], ['Hold drawings on twos', 'To do', 'b'], ['Match paper texture', 'In progress', 'y']].map(([a, b, c]) => `<div class="row"><span style="flex:1">${a}</span><span class="tag ${c}">${b}</span></div>`).join('')}</div>
  <div class="panel" style="position:absolute;left:990px;top:290px;width:270px"><div class="hd">Measured</div>${['Rhythm · 47 cuts, median 0.75 s', 'Palette · paper greys, lilac, sage', 'Texture · grain 8.1, detail 14.4'].map((s) => `<div class="row">${s}</div>`).join('')}</div>
  <div class="panel" style="position:absolute;left:510px;top:560px;width:260px"><div class="hd">Notes</div>${['Keep the long holds on the product', 'Micro-shots are four frames', 'End on one mark, room to breathe'].map((s) => `<div class="row">${s}</div>`).join('')}</div>`);
mk('app', 'left:0;top:0;width:1100px;height:720px', `<div class="win" style="position:absolute;inset:0;border-radius:0">
  <div class="side" style="width:190px;padding:20px 18px;font-size:12px;line-height:2.2"><div class="serif" style="font-size:19px;margin-bottom:10px">relume motion</div>＋ New<br>◇ References<br>◇ Styles<br>◇ Renders<br>◇ Library<br><br><span style="opacity:.5">Projects</span><br><span style="background:#2e3a36;padding:3px 8px;border-radius:5px">Launch film | relume</span><br>Reel cut<br>Brand loop</div>
  <div style="position:absolute;left:190px;right:0;top:0;height:110px;background:#c9d3cf;padding:22px 28px;box-sizing:border-box"><div style="display:flex;align-items:center;gap:12px">${icon}<span class="serif" style="font-size:24px">Launch film | relume</span></div><div style="display:flex;gap:22px;margin-top:16px;font-size:12px;color:#4d4a50"><b style="color:#1d1b1f;font-weight:500">Study</b><span>Style</span><span>Render</span><span>Compare</span><span>Activity</span></div></div>
  <div id="appBody" style="position:absolute;left:190px;right:0;top:110px;padding:22px 28px;font-size:12px">
    <span class="chipui" style="background:#161417;color:#fff;padding:7px 12px">Add references</span>
    <div style="margin-top:22px;color:#77727b">Jobs ↓</div>
    ${[['Study harvey.mp4', '47 shots, cadence on 2s, 136 BPM'], ['Compile the style', 'STYLE.md: rhythm, palette, texture, camera'], ['Render the launch film', '60.1 s at 24 fps, collage on canvas'], ['Compare against the reference', 'rhythm, layout, tone, colour, texture, motion']].map(([a, b]) => `<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #efedf0"><span style="color:#3d6b4a">⟳</span><div><div style="font-weight:500">${a}</div><div style="color:#8a858e;margin-top:2px">${b}</div></div></div>`).join('')}
  </div></div>`);
mk('logo', 'left:0;top:0;width:1280px;height:720px', '');
const showUI = (id, css = {}) => { const e = ui[id]; e.style.display = 'block'; Object.assign(e.style, css); return e; };

// ---------------------------------------------------------------- scenes, by shot number
/** shot i's window: [start, end) in seconds, and progress p of quantised time through it */
const S = (i) => REF.shots[i - 1];
const span = (i, j = i) => [S(i).t, S(j).t + S(j).dur];
const pin = (t, i, j = i) => { const [a, b] = span(i, j); return clamp((t - a) / (b - a)); };

// 1–3 · the opening: references and footage in pieces, an ink loop drawing itself, the camera drifting
function opening(t, i, f) {
  bg(tex.paper);
  if (i === 1) {
    const p = pin(t, 1); g.save(); g.translate(40 * p, 0);
    solid([[264, -20], [1300, -20], [1300, 664], [760, 664], [264, 300]], tex.grey);
    [[552, 112, '#7b6a6c'], [756, 120, '#645050'], [928, 120, '#645150'], [1172, 88, '#91868b']].forEach(([x, y, c], k) => { g.beginPath(); g.arc(x, -10, [112, 84, 88, 108][k], 0, Math.PI); g.closePath(); fillTex(g, K.charcoal(c, 640 + k, { grain: 26 })); });
    piece(g, [[930, -10], [1290, -10], [1290, 190], [960, 210]], hatch('#e9e3e3', '#6f5858', 61, { spacing: 4, angle: -1.3, alpha: 0.7 }), { seed: 3 });
    piece(g, [[-10, 470], [200, 464], [336, 730], [-10, 730]], tex.olive, { seed: 4, rough: 3 });
    piece(g, rect(-6, 250, 46, 22), tex.ink, { seed: 5 }); piece(g, rect(-6, 380, 70, 34), tex.ink, { seed: 6 });
    piece(g, [[440, 380], [520, 372], [560, 395], [540, 420], [450, 418], [430, 400]], tex.paperW, { seed: 7, blur: 4, shadowAlpha: 0.5 });
    g.strokeStyle = 'rgba(20,18,22,.8)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-10, 60); g.lineTo(200, 10); g.lineTo(240, 80); g.lineTo(60, 120); g.stroke();
    brush(g, spline([[280, 260], [330, 380], [440, 520], [560, 560], [600, 450], [520, 380], [450, 450], [520, 580], [700, 600], [830, 560]]), { width: 46, seed: 8, progress: clamp((t - 0.3) / 1.0) });
    g.restore();
  } else if (i === 2) {
    const p = pin(t, 2), k = Math.floor((t - S(2).t) / 0.167);
    g.save(); g.translate(-8 * p, 32 * p);
    piece(g, [[-20, 380], [900, 368], [920, 560], [880, 740], [-20, 740]], tex.blue, { seed: 11, rough: 3 }); piece(g, rect(920, -10, 370, 300), tex.g1, { seed: 9 }); piece(g, rect(936, -10, 350, 250), K.charcoal('#a6a2a0', 10, { grain: 24 }), { seed: 10 }); piece(g, rect(-10, 496, 266, 88), tex.ink, { seed: 19 });
    brush(g, K.ellipsePts(560, 820, 330, 300, 60, Math.PI * 1.05, Math.PI * 1.95), { width: 30, seed: 12 });
    pops(f, 8, [40, 260, 900, 440], 21);
    if (k >= 1) K.type(g, 'Reference sets the rhythm: cut on the frame,', 70, 200, { size: 13, font: "700 13px 'Courier Prime', monospace", wear: 0.2 });
    if (k >= 1) K.type(g, 'hold each drawing for two, and keep the paper', 70, 217, { size: 13, font: "700 13px 'Courier Prime', monospace", wear: 0.2 });
    if (k >= 2) K.type(g, 'on every surface, the way it was made.', 70, 234, { size: 13, font: "700 13px 'Courier Prime', monospace", wear: 0.2 });
    if (k >= 3) { line(300, 110, 900, 40); line(560, 250, 760, 170); line(700, 60, 1000, 160, 0.8); }
    if (k >= 4) { g.fillStyle = '#8b7676'; [[430, 175], [450, 175], [470, 175]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, -1.2, 1.2); g.fill(); }); disc(g, 720, 200, 24, tex.charL, { seed: 13 }); }
    if (k >= 5) { piece(g, rect(880, 95, 26, 140), tex.g2, { seed: 14 }); brush(g, spline([[640, 230], [700, 190], [760, 205]]), { width: 7, seed: 15 }); }
    if (k >= 7) { piece(g, rect(-10, 330, 40, 120), tex.charM, { seed: 16 }); piece(g, rect(140, 340, 70, 60), hatch('#ece9ec', '#3b373d', 62, { spacing: 4, angle: 0.9 }), { seed: 17 }); }
    if (k >= 10) { // the pink card arrives top right
      piece(g, rect(500, 190, 290, 120), tex.roseP, { seed: 18 }); piece(g, rect(800, 120, 290, 220), tex.g1, { seed: 19 });
      for (let b = 0; b < 16; b++) line(520 + b * 7, 225, 520 + b * 7, 255, b % 3 ? 2 : 3.5, '#2a272c');
      g.strokeStyle = '#2a272c'; g.lineWidth = 1; g.strokeRect(800, 230, 300, 90); K.type(g, 'M', 820, 310, { size: 52 });
      piece(g, rect(550, 160, 60, 32), tex.rose, { seed: 20 }); piece(g, rect(450, 310, 46, 46), tex.charD, { seed: 21 });
    }
    g.restore();
  } else {
    // a long drift across the collage: the content moves left and down as new pieces are laid in
    const p = ease(pin(t, 3)), k = Math.floor((t - S(3).t) / 0.167);
    g.save(); g.translate(260 - 200 * p, -140 - 300 * p); pops(f, 10, [-200, 380, 500, 900], 31);
    piece(g, rect(500, 190, 290, 120), tex.roseP, { seed: 18 }); piece(g, rect(800, 120, 290, 220), tex.g1, { seed: 19 });
    for (let b = 0; b < 16; b++) line(520 + b * 7, 225, 520 + b * 7, 255, b % 3 ? 2 : 3.5, '#2a272c');
    g.strokeStyle = '#2a272c'; g.lineWidth = 1; g.strokeRect(800, 230, 300, 90); K.type(g, 'M', 820, 310, { size: 52 });
    piece(g, rect(550, 160, 60, 32), tex.rose, { seed: 20 }); piece(g, rect(450, 310, 46, 46), tex.charD, { seed: 21 });
    g.strokeStyle = '#1d1b1f'; g.lineWidth = 6; g.beginPath(); g.arc(60, 455, 11, 0, 7); g.stroke();
    piece(g, K.ellipsePts(240, 410, 26, 40), tex.hatchL, { seed: 22, shadow: false });
    [[100, 380, 70], [100, 395, 40], [130, 410, 55]].forEach(([x, y, w]) => line(x, y, x + w, y, 5, '#1d1b1f'));
    if (k >= 4) { piece(g, rect(820, -260, 470, 90), tex.g1, { seed: 23 }); brush(g, spline([[880, -230], [940, -250], [920, -200], [990, -240], [960, -190], [1040, -230], [1010, -180]]), { width: 9, seed: 24 }); piece(g, rect(1000, -170, 380, 40), tex.paperW, { seed: 25 }); K.type(g, 'frame 0208 · cut · hold 2', 1015, -142, { size: 14, font: "700 14px 'Libre Caslon Text', serif" }); }
    piece(g, [[-260, 300], [240, 250], [300, 560], [-260, 620]], tex.stone, { seed: 630 }); piece(g, rect(-200, 640, 420, 70), tex.hatchL, { seed: 631 });
    pops(f, 16, [600, -200, 1400, 200], 33);
    for (let j = 0; j < Math.min(30, 12 + k); j++) { const r2 = rng(600 + j); piece(g, rect(-120 + r2() * 520, 420 + r2() * 300, 20 + r2() * 60, 8 + r2() * 26), [tex.ink, tex.charM, tex.g2, tex.charL][j % 4], { seed: 610 + j }); }
    if (k >= 8) { piece(g, [[400, -40], [560, -60], [570, -20], [410, 0]], tex.charL, { seed: 26 }); piece(g, K.ellipsePts(580, 40, 40, 28), tex.blue, { seed: 27 }); brush(g, spline([[260, 60], [290, 10], [340, 0], [360, 40]]), { width: 14, seed: 28, ink: '#7b6463' }); }
    if (k >= 12) { piece(g, rect(640, -90, 120, 70), tex.g2, { seed: 29 }); piece(g, [[300, 140], [390, 120], [420, 160], [320, 185]], tex.rose, { seed: 30 }); }
    g.restore();
  }
}

// 4–9 · a drawn cube turns in the middle of a frame of collage; the collage changes every few frames
function cubeFrame(t, i, f) {
  bg(tex.paper);
  const r = rng(i * 13), sw = (a, b) => (r() < 0.5 ? a : b);
  // each micro-shot re-lays the frame: the whole border shifts and some pieces change
  const jump = [[0, 0], [-60, 30], [40, -20], [-30, -40], [70, 20], [0, 0]][i - 4] || [0, 0]; g.save(); g.translate(jump[0], jump[1]);
  // border collage: grey tiles down the left and right, panels at the bottom
  [[0, 120, 120, 30], [0, 150, 60, 80], [20, 230, 110, 70], [0, 300, 140, 110], [10, 410, 90, 60], [0, 470, 120, 50], [60, 520, 70, 40]].forEach(([x, y, w, h], k) => piece(g, rect(x, y, w + r() * 10, h), k % 2 ? tex.g1 : tex.stone, { seed: 70 + k, shadow: false }));
  [[1160, 40, 90, 200], [1190, 240, 90, 120], [1150, 360, 130, 90], [1170, 450, 110, 160]].forEach(([x, y, w, h], k) => piece(g, rect(x, y, w, h), k % 2 ? tex.stone : tex.g1, { seed: 80 + k, shadow: false }));
  [[150, 0, 160, 50], [330, 10, 120, 70], [470, 30, 80, 40], [600, 0, 130, 40], [800, 30, 140, 50], [960, 0, 140, 30]].forEach(([x, y, w, h], k) => piece(g, rect(x, y, w, h), [tex.g1, tex.stone, tex.charL][k % 3], { seed: 90 + k + i, shadow: false }));
  piece(g, rect(-10, 150, 190, 75), tex.lilac, { seed: 100 }); [[10, 170, 140, 30]].forEach(([x, y, w, h]) => { g.strokeStyle = '#e9e7ee'; g.lineWidth = 1.2; g.strokeRect(x, y, w, h); g.strokeRect(x + 6, y + 6, w - 12, h - 12); });
  piece(g, rect(980, 500, 260, 60), tex.lilac, { seed: 101 }); g.strokeStyle = '#e9e7ee'; g.strokeRect(995, 512, 230, 36); g.strokeRect(1003, 520, 214, 20);
  piece(g, rect(300, 655, 320, 40), tex.lilacP, { seed: 102 }); g.strokeStyle = '#6e6884'; g.strokeRect(312, 663, 296, 24);
  piece(g, rect(840, 560, 150, 170), tex.g5, { seed: 103 }); [[915, 615], [915, 690]].forEach(([x, y]) => disc(g, x, y, 50, tex.blue, { seed: 104, shadow: false, ry: 40 }));
  [[70, 560, 22, 160], [100, 600, 22, 120], [140, 580, 26, 140]].forEach(([x, y, w, h], k) => piece(g, rect(x, y, w, h), k === 1 ? tex.charL : tex.ink, { seed: 110 + k }));
  pops(f, 26, [0, 0, 1280, 140], 70 + i); pops(f, 14, [0, 560, 1280, 720], 80 + i); pops(f, 10, [0, 140, 180, 560], 90 + i); pops(f, 10, [1100, 140, 1280, 560], 95 + i);
  // the micro-shots swap a few pieces each time
  if (i >= 5) { piece(g, rect(700, 160, 120, 30), tex.lilacP, { seed: 120 + i }); for (let b = 0; b < 3; b++) line(712, 168 + b * 8, 800, 168 + b * 8, 4, '#4d4766'); }
  if (i >= 6) { piece(g, rect(160, 95, 120, 50), tex.charM, { seed: 121 }); piece(g, rect(1050, 590, 110, 60), tex.blue, { seed: 122 }); }
  if (i >= 7) { piece(g, rect(240, 40, 70, 60), tex.ink, { seed: 123 }); piece(g, rect(740, 230, 160, 40), tex.g4, { seed: 124 }); }
  K.type(g, '5', 1080, 700, { size: 20, font: "400 20px 'Libre Caslon Text', serif" });
  if (i % 2) { piece(g, rect(420, 470, 260, 160), tex.g5, { seed: 140 + i }); piece(g, rect(820, 80, 200, 120), tex.lilac, { seed: 141 + i }); } else { piece(g, rect(300, 120, 180, 130), tex.charM, { seed: 142 + i }); piece(g, rect(760, 460, 220, 110), tex.g4, { seed: 143 + i }); }
  g.restore();
  // the cube: a quarter turn, settling square-on just before the UI arrives
  const p = pin(t, 4, 8), settle = ease(prog(t, 10.25, 10.6));
  const yaw = lerp(0.55 + p * 1.2, 0, settle), pitch = lerp(0.5 - p * 0.25, 0, settle), sz = lerp(150, 170, settle);
  box(g, { cx: 640, cy: 330, sx: sz, sy: sz, sz, yaw, pitch, roll: lerp(0.35, 0, settle), tex: [tex.charL, tex.charM, tex.charD] });
  if (i <= 5) for (let k = 0; k < 5; k++) piece(g, K.ellipsePts(560 - k * 34, 420 + k * 18, 9 - k, 4), tex.ink, { seed: 130 + k, shadow: false });
}

// 9–10 · the product appears: a white card over hatched slabs and lilac frames, then the app
function homeUI(t, i, f) {
  bg(tex.paper);
  if (i === 10) g.translate(-70, 40);
  disc(g, 70, 70, 190, tex.charD, { seed: 140, shadow: false });
  piece(g, rect(700, -10, 600, 120), tex.lilac, { seed: 141 }); g.strokeStyle = '#d9d5e2'; g.lineWidth = 1.4; for (let k = 0; k < 3; k++) g.strokeRect(720 + k * 14, 8 + k * 12, 540 - k * 28, 84 - k * 24);
  piece(g, [[-20, 330], [150, 260], [330, 330], [330, 720], [-20, 720]], tex.hatchD, { seed: 142 });
  piece(g, [[860, 330], [1040, 260], [1300, 330], [1300, 720], [860, 720]], tex.hatchD, { seed: 143 });
  piece(g, rect(-10, 410, 300, 70), tex.lilac, { seed: 144 }); piece(g, rect(-10, 620, 330, 60), tex.lilac, { seed: 145 });
  // the card: blank on shot 9, grows into the app window during shot 10
  if (i === 10) { piece(g, rect(380, 520, 520, 210), tex.hatchD, { seed: 147 }); piece(g, rect(0, 0, 330, 260), tex.lilac, { seed: 148 }); }
  const grow = i === 9 ? 0 : ease(prog(t, 11.6, 12.4));
  const w = i === 9 ? 370 : lerp(680, 1180, grow), h = i === 9 ? 270 : lerp(570, 690, grow), x = i === 9 ? 455 : lerp(300, 10, grow), y = i === 9 ? 160 : lerp(80, 25, grow);
  if (grow <= 0.02) { piece(g, rect(x, y, w, h), tex.paperW, { seed: 146, shadow: true, blur: 18, shadowAlpha: 0.25 }); if (i === 10) K.type(g, 'Hi S.', 610, 330, { size: 20, font: "400 20px Newsreader, serif" }); }
  else { const e = showUI('home'); const s = w / 1000; e.style.transform = `translate(${x}px,${y}px) scale(${w / 1000}, ${h / 520})`; e.style.transformOrigin = '0 0'; ui.home.querySelector('#homeH').textContent = 'Good evening, Shubhr'.slice(0, Math.floor(prog(t, 11.9, 12.8) * 20) + 1); }
}

// 11 · the project as a node: references and shots around it, drawn solids in the corners
function nodeUI(t, i, f) {
  bg(tex.paper);
  const z = lerp(1.04, 0.97, pin(t, 11)); g.save(); g.translate(640, 360); g.scale(z, z); g.translate(-640, -360);
  // measured: mostly white paper; cubes inset at the corners; grey arch pieces below them
  [[184, 540], [1100, 532]].forEach(([x, y], k) => piece(g, K.ellipsePts(x, y, 136, 124, 40, 0, Math.PI * 2), K.charcoal('#c9c4c7', 650 + k, { grain: 20 }), { seed: 652 + k, shadow: false }));
  [[204, 188, 0.8], [1076, 188, 2.4]].forEach(([x, y, a]) => box(g, { cx: x, cy: y, sx: 150, sy: 150, sz: 150, yaw: a, pitch: 0.55, tex: [tex.g1, tex.charL, tex.charM] }));
  [[264, 590, 0.6], [1016, 590, 2.6]].forEach(([x, y, a]) => box(g, { cx: x, cy: y, sx: 70, sy: 70, sz: 70, yaw: a, pitch: 0.7, tex: [tex.g1, tex.charL, tex.charM] }));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; line(640 + Math.cos(a) * 140, 350 + Math.sin(a) * 120, 640 + Math.cos(a) * 520, 350 + Math.sin(a) * 300, 0.6, 'rgba(60,55,65,.35)'); }
  g.restore();
  const e = showUI('node'); e.style.transform = `scale(${z})`;
}

// 12–14 · standing slabs of drawn stone receding into grey, the camera sliding along them
function slab(ex, ey, ew, eh, dx, dy, k) {
  const shade = (y0, y1, a, b) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  const side = [[ex + ew, ey], [ex + ew + dx, ey + dy], [ex + ew + dx, ey + dy + eh * 0.85], [ex + ew, ey + eh]];
  const path = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
  path(side); fillTex(g, K.charcoal('#77757a', 160 + k, { grain: 34 })); path(side); g.fillStyle = shade(ey + dy, ey + eh, 'rgba(255,255,255,0.1)', 'rgba(20,18,22,0.45)'); g.fill();
  path([[ex, ey], [ex + ew, ey], [ex + ew, ey + eh], [ex, ey + eh]]); fillTex(g, K.charcoal('#3a383c', 170 + k, { grain: 30 }));
  path([[ex, ey], [ex + ew, ey], [ex + ew, ey + eh], [ex, ey + eh]]); g.fillStyle = shade(ey, ey + eh, 'rgba(110,108,112,0.3)', 'rgba(10,10,12,0.55)'); g.fill();
  path([[ex, ey], [ex + ew, ey], [ex + ew + dx, ey + dy], [ex + dx, ey + dy]]); fillTex(g, paper('#e4e2e5', 180 + k, { mottle: 0.45 }));
}
// measured (blocking at the middle of shots 12 and 14): end face [x, y, w, h], top recedes by [dx, dy]
const SLABS12 = [[-200, 288, 200, 300, 248, -128], [256, 320, 168, 264, 256, -144], [856, 376, 216, 296, 0, -192]];
const SLABS14 = [[-80, 320, 184, 296, 160, -150], [288, 368, 184, 288, 376, -192], [760, 400, 192, 248, 136, -200], [1088, 424, 192, 288, 40, -192]];
function slabs(t, i, f) {
  bg(paper('#9e9c9f', 160, { mottle: 0.95, cell: 160 }));
  const gr = g.createLinearGradient(0, 160, 0, 420); gr.addColorStop(0, 'rgba(98,96,99,0)'); gr.addColorStop(1, 'rgba(98,96,99,1)');
  g.fillStyle = gr; g.fillRect(0, 160, W, 560);
  const set = i === 12 ? SLABS12 : SLABS14, sx = i === 12 ? 0 : i === 13 ? -150 : (ease(pin(t, 14)) - 0.5) * 207;
  g.save(); g.translate(sx, 0); set.forEach(([ex, ey, ew, eh, dx, dy], k) => slab(ex, ey, ew, eh, dx, dy, k + (i === 14 ? 10 : 0))); g.restore();
}

// 15–19 · white shelves gliding down over one long diagonal shadow; their tracks are measured from the reference
// (top edge of each shelf in px at 1280×720, by time), so the masses land where the reference has them
const TRACK = (pts, t) => { if (t <= pts[0][0]) return pts[0][1]; for (let k = 1; k < pts.length; k++) if (t <= pts[k][0]) return lerp(pts[k - 1][1], pts[k][1], (t - pts[k - 1][0]) / (pts[k][0] - pts[k - 1][0])); return pts[pts.length - 1][1]; };
const SHELF = [
  [[17.375, -494], [17.5, -336], [17.667, -230], [17.833, -140], [17.958, -100], [18.0, -70], [18.458, 24], [18.833, 118]],
  [[17.375, -164], [17.458, -86], [17.5, -6], [17.625, 52], [17.667, 96], [17.792, 134], [17.833, 164], [17.958, 190], [18.0, 212], [18.458, 274], [18.833, 296]],
  [[17.375, 166], [17.458, 270], [17.5, 326], [17.625, 368], [17.667, 400], [17.792, 428], [17.833, 452], [17.958, 472], [18.0, 488], [18.458, 536], [18.833, 478]],
  [[17.375, 496], [17.458, 600], [17.5, 662], [17.625, 700], [17.667, 730], [18.0, 800]],
];
function shelves(t, i, f) {
  bg(paper('#8f8d90', 170, { mottle: 0.9, cell: 140 }));
  solid([[-10, -10], [1050, -10], [760, 730], [-10, 730]], K.charcoal('#2a282c', 171, { w: 1280, h: 720, grain: 28 }));
  SHELF.forEach((tr, k) => {
    const y = TRACK(tr, t);
    solid([[0, y + 40], [120, y - 40], [120, y + 80], [0, y + 160]], tex.g3, { seed: 190 + k });
    solid([[200, y - 46], [1080, y - 46], [1110, y], [170, y]], paper('#9a989b', 172 + k), { seed: 200 + k });
    solid([[170, y], [1110, y], [1110, y + 126], [170, y + 126]], paper('#e9e7ea', 180 + k, { mottle: 0.4 }), { seed: 210 + k });
  });
}

// 20 · the search: a question, three references, a click
function searchUI(t, i, f) {
  bg(tex.paper);
  const p = pin(t, 20), s = lerp(1, 1.06, p);
  const e = showUI('search'); e.style.transform = `translate(${140 - 30 * p}px,${60 + 10 * p}px) scale(${s})`; e.style.transformOrigin = '0 0';
  const c = ease(prog(t, 19.6, 20.6)), cur = ui.search.querySelector('#cursor');
  cur.style.transform = `translate(${lerp(760, 470, c)}px,${lerp(470, 330, c)}px)`;
  [...ui.search.querySelectorAll('.srow')].forEach((r, k) => (r.style.background = k === 1 && t > 20.4 ? '#f0f3f1' : ''));
}

// 21–23 · the dark disc: it shrinks into a frame, becomes a diagram, then a collage of squares
function discs(t, i, f) {
  if (i === 21) { bg(tex.paper); disc(g, 640, 300, 560, tex.plum, { seed: 190, shadow: false }); return; }
  if (i === 22) { bg(tex.paper); piece(g, K.ellipsePts(870, 560, 120, 160), tex.hatchL, { seed: 191, shadow: false }); disc(g, 600, 320, 300, tex.plum, { seed: 192 }); return; }
  // measured with get_blocking every 0.8 s: one object at the centre the whole shot, seen three ways
  const lt = t - S(23).t;
  bg(tex.paper);
  const tunnel = (x0, y0, x1, y1, ix0, iy0, ix1, iy1, top) => {
    solid([[x0, y0], [ix0, iy0], [ix0, iy1], [x0, y1]], K.charcoal('#3f3338', 500, { grain: 30 }));                 // left wall, dark
    solid([[x1, y0], [ix1, iy0], [ix1, iy1], [x1, y1]], K.hatch('#d9d7da', '#77737a', 501, { spacing: 3.5, angle: 1.57, alpha: 0.5 })); // right wall, light
    solid([[x0, y1], [ix0, iy1], [ix1, iy1], [x1, y1]], K.charcoal('#a4a0a2', 502, { grain: 22 }));                 // floor
    solid([[x0, y0], [x1, y0], [ix1, iy0], [ix0, iy0]], top);                                                      // top wall
    solid([[ix0, iy0], [ix1, iy0], [ix1, iy1], [ix0, iy1]], tex.paperW);
    g.strokeStyle = 'rgba(30,28,32,.55)'; g.lineWidth = 1; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  };
  if (lt < 0.6) {
    solid(rect(392, 112, 496, 496), K.charcoal('#6d6a6f', 503, { grain: 26 })); solid(rect(406, 126, 468, 468), tex.paperW);
    piece(g, K.ellipsePts(700, 420, 50, 70), tex.hatchL, { seed: 504, shadow: false }); disc(g, 640, 360, 52, tex.plum, { seed: 505 });
  } else if (lt < 2.4) {
    g.strokeStyle = 'rgba(30,28,32,.6)'; g.lineWidth = 1; g.strokeRect(392, 112, 496, 496);
    tunnel(432, 152, 856, 568, 568, 288, 712, 432, K.charcoal('#5b585d', 506, { grain: 28 })); disc(g, 640, 360, 22, tex.ink, { seed: 507 });
    if (lt > 1.6) { line(0, 700, 1280, -40, 0.8, 'rgba(40,36,44,.45)'); showUI('diag'); }
  } else {
    // the diagram: lines, arcs, dots and panels laid in around a smaller box
    const k = Math.floor((lt - 2.4) / 0.5);
    line(0, 390, 1280, 390, 0.8, 'rgba(40,36,44,.45)'); line(420, 0, 420, 720, 0.8, 'rgba(40,36,44,.4)'); line(870, 0, 870, 720, 0.8, 'rgba(40,36,44,.4)');
    line(0, 650, 1280, -30, 0.9, 'rgba(40,36,44,.55)'); line(0, 740, 1280, 60, 0.9, 'rgba(40,36,44,.5)');
    g.strokeStyle = 'rgba(40,36,44,.35)'; g.lineWidth = 0.8; g.beginPath(); g.arc(560, 40, 230, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(560, 40, 190, 0, Math.PI); g.stroke();
    tunnel(448, 176, 808, 512, 576, 288, 712, 432, tex.green); disc(g, 644, 360, 22, tex.ink, { seed: 508 });
    [[50, 170], [430, 250], [1110, 180], [520, 680]].forEach(([x, y], j) => { if (j <= k) disc(g, x, y, 8, tex.ink, { seed: 509 + j, shadow: false }); });
    if (k >= 1) { piece(g, rect(-10, -10, 180, 546), K.charcoal('#cfcbc8', 512, { grain: 20 }), { seed: 513 }); for (let j = 0; j < 9; j++) line(20, 300 + j * 18, 120, 300 + j * 18, 1, 'rgba(60,55,65,.4)'); }
    if (k >= 1) { piece(g, rect(900, -10, 270, 100), K.hatch('#e2e0e3', '#5b575d', 514, { spacing: 4, angle: 1.57 }), { seed: 515 }); piece(g, rect(870, 610, 410, 120), K.charcoal('#d7d5d8', 516, { grain: 20 }), { seed: 517 }); }
    if (k >= 2) { solid([[300, 720], [330, 630], [345, 720]], tex.lilac); piece(g, rect(110, 520, 90, 130), tex.lilacP, { seed: 518 }); }
    if (k >= 5) { piece(g, rect(1100, 200, 180, 330), tex.paperW, { seed: 519 }); for (let j = 0; j < 7; j++) solid(rect(1120, 220 + j * 44, 140, 22), tex.lilac, { seed: 520 + j }); }
    if (lt < 3.6) showUI('diag'); else { const e = showUI('chips2'); }
  }
}
function squaresRow(t, step) {
  piece(g, rect(260, 220, 220, 250), K.charcoal('#8c8790', 210, { grain: 30 }), { seed: 210 });
  piece(g, rect(830, 220, 220, 250), tex.charL, { seed: 211 });
  piece(g, rect(470, 225, 160, 240), tex.paperW, { seed: 212 }); disc(g, 550, 340, 70, tex.ink, { seed: 213 });
  g.strokeStyle = 'rgba(230,226,232,.85)'; g.lineWidth = 7; for (let k = 0; k < 9; k++) { const a = k * 0.7; g.beginPath(); g.moveTo(550, 340); g.lineTo(550 + Math.cos(a) * 62, 340 + Math.sin(a) * 62); g.stroke(); }
  if (step >= 1) { piece(g, rect(640, 225, 200, 240), tex.rose2, { seed: 214 }); disc(g, 740, 345, 70, tex.plum, { seed: 215 }); }
  if (step >= 2) for (let k = 0; k < 8; k++) disc(g, 550 + Math.cos(k * 0.8) * 95, 340 + Math.sin(k * 0.8) * 95, 6, tex.g2, { seed: 216 + k, shadow: false });
  [[470, 470, 80, 70], [550, 540, 80, 70], [470, 610, 80, 80], [300, 620, 60, 60]].forEach(([x, y, w, h], k) => piece(g, rect(x, y, w, h), tex.ink, { seed: 220 + k }));
}

// 24–25 · the squares, re-laid on each drawing
function squares(t, i, f) {
  const lt = t - S(24).t, step = i === 24 ? 1 : 1 + Math.floor(f / 2) % 3;
  g.save(); if (i === 25) g.translate(-150, -40 * pin(t, 25) - 60);
  solid(rect(-10, -60, 650, 840), tex.beige); solid(rect(620, -60, 690, 840), tex.green);
  piece(g, [[620, -60], [1300, -60], [1300, 40], [900, 70], [620, 50]], tex.lilac, { seed: 201 }); piece(g, [[620, 660], [1300, 640], [1300, 780], [620, 780]], tex.lilac, { seed: 202 });
  squaresRow(t, step); if (i === 25) pops(f, 6, [250, 470, 900, 700], 25, [tex.ink, tex.charD]); g.restore();
}

// 26–27 · a hexagon opened like a box, on grid paper, a small cube with a dot inside
function hexBox(t, i, f) {
  bg(tex.paperW);
  g.strokeStyle = 'rgba(60,55,65,.25)'; g.lineWidth = 0.7; for (let x = 0; x < 400; x += 46) line(x, 0, x, 720, 0.7, 'rgba(60,55,65,.25)'); for (let y = 0; y < 720; y += 46) line(0, y, 400, y, 0.7, 'rgba(60,55,65,.25)');
  if (i === 27) {
    solid(rect(640, -10, 650, 740), K.charcoal('#646061', 236, { grain: 26 })); solid([[-10, 168], [632, 720], [-10, 720]], paper('#ede8e9', 237));
    piece(g, [[792, 720], [1200, 288], [1290, 300], [1290, 730]], K.charcoal('#7c7871', 238, { grain: 30 }), { shadow: false });
    solid([[72, -10], [1216, -10], [640, 704]], tex.green);
    solid([[630, 160], [768, 240], [630, 320], [496, 240]], paper('#ded8dc', 233)); solid([[496, 240], [630, 320], [630, 488], [496, 408]], K.charcoal('#6e6080', 234, { grain: 30 })); solid([[768, 240], [630, 320], [630, 488], [768, 408]], K.charcoal('#989397', 239, { grain: 26 }));
    disc(g, 630, 320, 22, tex.ink, { seed: 235 });
    brush(g, spline([[40, 260], [60, 330], [80, 270], [100, 340], [120, 280], [140, 350]]), { width: 8, seed: 236, ink: '#2b292d' }); return;
  }
  const z = lerp(1, 1.12, pin(t, 26)); g.save(); g.translate(640, 330); g.scale(z, z); g.translate(-640, -330);
  solid([[290, 60], [990, 60], [990, 520], [640, 720], [290, 520]], tex.lilac);
  solid([[290, 60], [990, 60], [820, 160], [460, 160]], tex.green); solid([[820, 160], [990, 60], [990, 520], [820, 420]], paper('#ddd5d8', 230));
  solid([[460, 160], [820, 160], [820, 420], [640, 520], [460, 420]], tex.paperW);
  piece(g, rect(990, 0, 300, 720), K.charcoal('#77755f', 231, { grain: 30 }), { seed: 232, shadow: false });
  // the small cube with a dot: three faces in lilac, grey and stone
  solid([[640, 230], [730, 280], [640, 330], [550, 280]], paper('#d6cbd6', 233)); solid([[550, 280], [640, 330], [640, 430], [550, 380]], K.charcoal('#6e6080', 234, { grain: 30 })); solid([[730, 280], [640, 330], [640, 430], [730, 380]], tex.charL);
  disc(g, 640, 330, 15, tex.ink, { seed: 235 });
  g.restore();
  brush(g, spline([[40, 60], [60, 130], [80, 70], [100, 140], [120, 80], [140, 150]]), { width: 8, seed: 236, ink: '#2b292d' });
  for (let k = 0; k < 3; k++) disc(g, 440 + k * 46, 480, 5, tex.ink, { seed: 237 + k, shadow: false });
  brush(g, spline([[960, 640], [1040, 570], [1100, 520]]), { width: 22, seed: 240 });
}

// 28–30 · torn bands, a triangle of paper, the cube again; then a mirrored pattern
function torn(t, i, f) {
  bg(tex.paperW);
  if (i === 30) {
    [[0, 0], [1280, 0], [0, 720], [1280, 720]].forEach(([x, y], k) => disc(g, x, y, 260, k % 2 ? tex.lilacP : paper('#b9b2c2', 250 + k), { seed: 250 + k, shadow: false }));
    [[640, -40], [640, 760]].forEach(([x, y], k) => piece(g, K.ellipsePts(x, y, 200, 90), tex.green, { seed: 254 + k, shadow: false }));
    solid([[0, 200], [640, 330], [0, 460]], paper('#e8e6e2', 256)); solid([[1280, 200], [640, 330], [1280, 460]], paper('#e8e6e2', 257));
  } else {
    if (i === 28) { bg(paper('#c9c3ca', 259, { mottle: 0.5 })); piece(g, [[-10, -10], [470, -10], [460, 150], [200, 190], [-10, 170]], tex.charD, { seed: 258, rough: 5 }); solid([[24, 160], [250, 160], [632, 720], [400, 720]], tex.paperW); solid([[696, 720], [900, 256], [1112, 256], [930, 720]], tex.paperW); solid([[0, 300], [320, 720], [-10, 720]], paper('#d3cdce', 257)); solid([[880, 300], [1280, 300], [1080, 560]], K.charcoal('#a8a2ad', 256, { grain: 20 })); piece(g, K.ellipsePts(1160, 300, 120, 160, 30, 1.57, 4.71), tex.slate, { seed: 255, shadow: false }); piece(g, rect(300, 260, 140, 260), K.hatch('#ecebed', '#3b373d', 67, { spacing: 4, angle: 0 }), { seed: 254 }); brush(g, spline([[40, 90], [90, 30], [150, 60], [170, 120], [230, 40], [300, 70], [310, 120]]), { width: 28, seed: 253 });
      solid([[592, 280], [692, 330], [592, 380], [492, 330]], paper('#ddd2dc', 270)); solid([[492, 330], [592, 380], [592, 490], [492, 440]], K.charcoal('#625775', 271, { grain: 30 })); solid([[692, 330], [592, 380], [592, 490], [692, 440]], tex.charL); disc(g, 592, 380, 20, tex.ink, { seed: 272 }); return; }
    piece(g, [[-10, -10], [1290, -10], [1290, 60], [1000, 90], [700, 70], [400, 120], [-10, 80]], tex.g2, { seed: 260, rough: 4 });
    piece(g, [[-10, 70], [1290, 50], [1290, 130], [900, 150], [600, 130], [300, 170], [-10, 150]], tex.paperW, { seed: 261, rough: 5 });
    solid([[-60, 140], [460, 140], [200, 720]], paper('#e3e1e4', 262)); solid([[820, 140], [1340, 140], [1080, 720]], paper('#e3e1e4', 263)); solid([[-10, 300], [200, 720], [-10, 720]], paper('#cfcbd0', 268));
    disc(g, 1090, 210, 110, tex.slate, { seed: 264, shadow: false });
    piece(g, [[-10, 640], [300, 600], [500, 650], [800, 610], [1290, 650], [1290, 730], [-10, 730]], tex.olive, { seed: 265, rough: 6 });
    if (i === 29) { bg(tex.paperW); piece(g, rect(1000, 0, 280, 120), tex.g2, { seed: 269 }); solid([[120, 40], [1160, 40], [640, 690]], tex.paperW); piece(g, rect(640, 300, 340, 60), tex.lilacP, { seed: 270 }); g.strokeStyle = 'rgba(40,36,44,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(120, 40); g.lineTo(1160, 40); g.lineTo(640, 690); g.closePath(); g.stroke(); for (let y = 120; y < 600; y += 80) line(120 + (y - 40) * 0.8, y, 1160 - (y - 40) * 0.8, y, 0.7, 'rgba(40,36,44,.4)'); piece(g, rect(280, 300, 300, 60), hatch('#d9d7da', '#3b373d', 65, { spacing: 3, angle: 0 }), { seed: 266 }); brush(g, spline([[200, 160], [180, 80], [260, 50], [330, 90], [300, 150]]), { width: 26, seed: 267 }); }
  }
  const y0 = i === 30 ? 330 : 300;
  solid([[640, y0 - 70], [700, y0 - 35], [640, y0], [580, y0 - 35]], paper('#ddd2dc', 270)); solid([[580, y0 - 35], [640, y0], [640, y0 + 70], [580, y0 + 35]], K.charcoal('#625775', 271, { grain: 30 })); solid([[700, y0 - 35], [640, y0], [640, y0 + 70], [700, y0 + 35]], i === 30 ? tex.green : tex.charL);
  disc(g, 640, y0, 13, tex.ink, { seed: 272 });
}

// 31–34 · footage in letters: cut-out type, scattered, then one word in clean ink
const LET = [['F', 60, 560, 300, 0], ['L', 560, 600, 420, 0], ['R', 760, 230, 260, 0], ['M', 1040, 260, 210, 0], ['O', 40, 760, 420, 0], ['G', 900, 640, 150, 0], ['E', 300, 620, 200, 0]];
function letters(t, i, f) {
  bg(tex.paperW);
  if (i === 34 && t > S(34).t + 1.4) { K.type(g, 'Motion.', 640, 380, { size: 64, align: 'center', seed: 5, font: "400 64px 'Libre Caslon Text', serif" }); return; }
  const jig = rng(Math.floor(f / 2) * 7);
  if (i === 34) { // "Mo" gathering: two big letters and pieces
    piece(g, rect(400, 250, 140, 230), tex.charM, { seed: 280 }); K.type(g, 'M', 380, 480, { size: 300, font: "700 300px 'Libre Caslon Text', serif", ink: '#2a282c' });
    K.type(g, 'o', 640, 480, { size: 260, font: "400 260px 'Libre Caslon Text', serif", ink: '#2a282c' }); piece(g, rect(880, 380, 80, 120), tex.rose, { seed: 281 }); piece(g, rect(650, 210, 120, 140), tex.ink, { seed: 282 });
    for (let k = 0; k < 5; k++) line(720 + k * 18, 590 + jig() * 20, 760 + k * 22, 520, 1, '#2a282c');
    return;
  }
  const shift = [0, 0, 0, 0, 0][i - 31] ?? 0, mv = i === 32 ? [-90, 40] : i === 33 ? [60, -50] : [0, 0];
  g.translate(mv[0], mv[1]);
  LET.forEach(([ch, x, y, s, tx], k) => { const dx = (jig() - 0.5) * 6 + shift; K.type(g, ch, x + dx, y, { size: s, font: `700 ${s}px 'Libre Caslon Text', serif`, ink: '#252327', seed: k }); });
  piece(g, rect(780, 0, 260, 300), tex.charD, { seed: 290 }); piece(g, rect(200, 420, 260, 140), tex.charM, { seed: 297 }); piece(g, [[680, 160], [760, 140], [780, 330], [690, 340]], tex.charM, { seed: 291 });
  piece(g, rect(190, 250, 400, 42), tex.g1, { seed: 292 }); K.type(g, i >= 32 ? 'F O O T A' : 'O O T A', 210, 282, { size: 22, font: "700 22px 'Courier Prime', monospace", tracking: 12, ink: '#4d4950' });
  if (i >= 32) { piece(g, rect(540, 430, 300, 36), tex.beige, { seed: 293 }); K.type(g, 'G E', 640, 458, { size: 20, font: "700 20px 'Courier Prime', monospace", tracking: 14, ink: '#4d4950' }); }
  piece(g, rect(0, 0, 70, 150), tex.ink, { seed: 294 }); piece(g, rect(30, 20, 120, 60), K.hatch('#ecebed', '#6a656d', 66, { spacing: 7, angle: 0 }), { seed: 295 });
  for (let k = 0; k < 4; k++) piece(g, rect(560 + k * 22 + jig() * 4, 410 + (k % 2) * 16, 14, 14), tex.ink, { seed: 296 + k, shadow: false });
}

// 35–36 · the ellipse: quarters of paper around a small framed dot; prompts float in
function ellipse(t, i, f) {
  bg(tex.paperW);
  if (i === 36 && t > S(36).t + 1.4) {
    disc(g, 1100, -60, 360, tex.sage, { shadow: false }); disc(g, 1140, 40, 250, tex.paperW, { shadow: false });
    [[130, 150], [190, 150]].forEach(([x, y], k) => piece(g, K.ellipsePts(x, y, 28, 60), tex.lilacP, { seed: 620 + k }));
    piece(g, rect(0, 470, 300, 250), K.hatch('#ebe9ec', '#5b575d', 68, { spacing: 4, angle: 0.3 }), { seed: 298 }); piece(g, rect(-10, 190, 380, 60), tex.lilacP, { seed: 621 });
    solid(rect(560, 0, 160, 120), tex.g2); piece(g, rect(760, 440, 90, 90), tex.charL, { seed: 622 }); piece(g, rect(560, 470, 90, 90), tex.g1, { seed: 623 }); piece(g, rect(750, 260, 90, 90), tex.g1, { seed: 624 });
    disc(g, 640, 410, 120, tex.paperW, { seed: 625 }); g.strokeStyle = 'rgba(30,28,32,.6)'; g.lineWidth = 1.2; g.beginPath(); g.arc(640, 410, 120, 0, 7); g.stroke();
    solid([[640, 330], [720, 410], [640, 490], [560, 410]], K.charcoal('#857d8d', 626, { grain: 26 })); solid([[640, 360], [690, 410], [640, 460], [590, 410]], tex.paperW); disc(g, 640, 410, 14, tex.ink, { seed: 627 });
    return;
  }
  const shrink = 0, sx = 1, cx = 640, cy = 330;
  g.save(); g.translate(cx, cy); g.scale(sx, sx); g.translate(-cx, -cy);
  disc(g, cx, cy, 760, paper('#e0dde2', 300), { ry: 400, shadow: false });
  const Q = [[tex.lilacP, -Math.PI, -Math.PI / 2], [tex.rose2, -Math.PI / 2, 0], [tex.beige, 0, Math.PI / 2], [tex.paperW, Math.PI / 2, Math.PI]];
  Q.forEach(([tx, a0, a1], k) => solid([[cx, cy], ...K.ellipsePts(cx, cy, 610, 340, 30, a0, a1)], tx, { seed: 301 + k }));
  if (i === 36 || (i === 35 && t > S(35).t + 0.35)) {
    const r = rng(37 + Math.floor(f / 4)); for (let k = 0; k < 46; k++) { const a = r() * 6.28, d = r() * 0.85; piece(g, rect(cx + Math.cos(a) * 440 * d - 50, cy + Math.sin(a) * 250 * d - 40, 100, 80), [tex.teal, tex.hatchD, tex.g4, tex.lilac, tex.rose2, tex.charM, tex.paperW][k % 7], { seed: 310 + k, shadow: false }); }
    disc(g, 470, 330, 34, tex.plum, { seed: 330 });
  }
  g.restore();
  solid(rect(cx - 22, cy - 22, 44, 44), tex.paperW); g.strokeStyle = 'rgba(30,28,32,.6)'; g.strokeRect(cx - 22, cy - 22, 44, 44); disc(g, cx, cy, 6, tex.ink, { seed: 331, shadow: false });
  [[30, 40], [1220, 40], [30, 650], [1220, 650]].forEach(([x, y], k) => { for (let j = 0; j < 4; j++) piece(g, rect(x + (j % 2) * 26, y + Math.floor(j / 2) * 26, 22, 22), j % 3 ? tex.g2 : tex.charM, { seed: 340 + k * 4 + j, shadow: false }); });
  if (i === 36 && shrink > 0.5) { box(g, { cx: 1150, cy: 560, sx: 110, sy: 110, sz: 110, yaw: 0.5, pitch: 0.4, tex: [tex.g1, tex.charL, tex.charM] }); box(g, { cx: 140, cy: 120, sx: 80, sy: 80, sz: 80, yaw: 0.8, pitch: 0.4, tex: [tex.g1, tex.charL, tex.charM] }); }
  if (i === 36 && shrink < 0.6) showUI('chips');
}

// 37–39 · a ring of segments around a framed dot; it thins and opens; then the references listed
function ring(t, i, f) {
  bg(tex.paperW);
  const p = i === 37 ? 0 : i === 38 ? 0.35 : ease(prog(t, S(39).t, S(39).t + 0.8));
  const R0 = i === 37 ? 900 : i === 38 ? 420 : lerp(420, 250, p), R1 = i === 37 ? 430 : i === 38 ? 175 : lerp(175, 205, p), cx = 640, cy = i === 38 ? 330 : 360;
  const seg = [[tex.g2, -2.6, -1.6], [paper('#3d3433', 350), -1.75, -1.3], [tex.slate, -1.3, -0.2], [K.charcoal('#857d93', 351, { grain: 26 }), 0, 1.2], [tex.sage, 1.4, 2.4], [tex.beige, 2.4, 3.6]];
  const rotA = i === 38 ? 0.9 : 0;
  if (i < 39 || p < 1) seg.forEach(([tx, a0, a1], k) => { a0 += rotA; a1 += rotA; if (i === 39 && k % 2) return; const pts = [...K.ellipsePts(cx, cy, R0, R0, 24, a0, a1), ...K.ellipsePts(cx, cy, R1, R1, 24, a1, a0)]; solid(pts, tx, { seed: 352 + k }); });
  // the framed dot: a bevelled square
  const s = i === 39 ? 170 : i === 37 ? 190 : 150; solid(rect(cx - s / 2, cy - s / 2, s, s), tex.g4); solid(rect(cx - s / 2 + s * 0.14, cy - s / 2 + s * 0.14, s * 0.72, s * 0.72), tex.paperW); disc(g, cx, cy, s * 0.12, tex.ink, { seed: 360, shadow: false });
  for (let k = 0; k < 4; k++) disc(g, cx + Math.cos(k * 1.57) * 22, cy + Math.sin(k * 1.57) * 22, 2, tex.ink, { seed: 361 + k, shadow: false });
  if (i === 39 && p >= 1) {
    showUI('list');
    piece(g, rect(930, 560, 350, 170), tex.lilacP, { seed: 370 }); piece(g, rect(560, 500, 80, 70), tex.hatchD, { seed: 371 });
    [[860, 120], [880, 150], [900, 180]].forEach(([x, y], k) => piece(g, rect(x, y, 26, 26), tex.green, { seed: 372 + k, shadow: false }));
    for (let k = 0; k < 7; k++) line(1000 + k * 6, 300 + k * 5, 1120 - k * 3, 380 - k * 9, 0.8, '#2a282c');
  }
}

// 40–42 · the measured film as panels around the framed dot; drawn solids at the corners
function panels(t, i, f) {
  bg(tex.paperW);
  const zz = i === 41 ? 1.55 : i === 42 ? lerp(1.1, 1, ease(pin(t, 42))) : 1; g.translate(640, 360); g.scale(zz, zz); g.translate(-640, -360);
  const pastel = i === 42 && t > S(42).t + 1.1;
  if (pastel) { [[184, 180, '#c4cfd0', 0.8], [1096, 184, '#b6a3a3', 2.4], [184, 532, '#d4c4c6', -0.8], [1100, 536, '#c3cacd', 3.9]].forEach(([x, y, c, a], k) => box(g, { cx: x, cy: y, sx: 230, sy: 230, sz: 230, yaw: a, pitch: 0.5, tex: [paper(c, 660 + k), K.charcoal(c, 664 + k, { grain: 18 }), K.charcoal(K.mix(c, '#2a282c', 0.5), 668 + k, { grain: 20 })] })); const s2 = 232; solid(rect(640 - s2 / 2, 360 - s2 / 2, s2, s2), K.charcoal('#474448', 672, { grain: 24 })); solid(rect(640 - s2 / 2 + 40, 360 - s2 / 2 + 40, s2 - 80, s2 - 80), tex.paperW); disc(g, 640, 360, 28, tex.ink, { seed: 673 }); showUI('chips3'); return; }
  [[0, 0, 2.2], [1280, 0, 0.9], [0, 720, -2.2], [1280, 720, -0.9]].forEach(([x, y, a], k) => {
    piece(g, rect(x - 380, y - 300, 760, 600), pastel ? [tex.sage, tex.rose2, tex.lilacP, tex.beige][k] : K.hatch('#bdbabe', '#2f2c31', 385 + k, { spacing: 3.5, alpha: 0.7 }), { seed: 380 + k, shadow: false });
  });
  solid(rect(280, 70, 720, 580), tex.paperW); [[280, 360], [1000, 360]].forEach(([x, y]) => solid(K.ellipsePts(x, y, 150, 190, 40), tex.paperW)); [[640, 70], [640, 650]].forEach(([x, y]) => solid(K.ellipsePts(x, y, 260, 110, 40), tex.paperW));
  [[150, 110, 0.8], [1130, 110, 2.4], [150, 610, -0.8], [1130, 610, 3.9]].forEach(([x, y, a], k) => box(g, { cx: x, cy: y, sx: 130, sy: 130, sz: 130, yaw: a, pitch: 0.55, tex: pastel ? [tex.blue, tex.rose2, tex.charM] : [tex.g1, tex.charL, tex.charM] }));
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; line(640 + Math.cos(a) * 90, 360 + Math.sin(a) * 90, 640 + Math.cos(a) * 340, 360 + Math.sin(a) * 260, 0.6, 'rgba(60,55,65,.35)'); }
  const s = 210; solid(rect(640 - s / 2, 360 - s / 2, s, s), K.charcoal('#77747a', 391, { grain: 26 })); solid(rect(640 - s / 2 + 30, 360 - s / 2 + 30, s - 60, s - 60), tex.paperW); disc(g, 640, 360, 26, tex.ink, { seed: 390 });
  if (!pastel) showUI('panels');
}

// 43–45 · the app: a project header slides in, the sidebar, then the whole app over strips of collage
function app(t, i, f) {
  bg(tex.paperW);
  if (i === 43) { piece(g, rect(-10, -10, 60, 740), tex.green, { seed: 399, shadow: false }); piece(g, rect(50, -10, 170, 740), tex.paperW, { seed: 400, shadow: false }); piece(g, rect(216, -10, 170, 740), tex.ink, { seed: 401, shadow: false }); const e = showUI('app'); e.style.transform = 'translate(90px,0) scale(1.55)'; e.style.transformOrigin = '0 0'; e.querySelector('.side').style.visibility = 'hidden'; return; }
  // strips behind
  piece(g, rect(-10, -10, 150, 740), tex.green, { seed: 402, shadow: false }); [[60, 180], [60, 380], [60, 580]].forEach(([x, y], k) => piece(g, K.ellipsePts(x, y, 50, 80, 30, -1.57, 1.57), tex.paperW, { seed: 403 + k, shadow: false }));
  piece(g, rect(1180, -10, 110, 740), tex.hatchD, { seed: 406, shadow: false });
  if (i === 44) { const e = showUI('app'); e.querySelector('.side').style.visibility = 'visible'; const k = ease(prog(t, S(44).t, S(44).t + 0.8)); e.style.transform = `translate(${lerp(240, 150, k)}px,${lerp(0, 40, k)}px) scale(${lerp(1, 0.86, k)})`; e.style.transformOrigin = '0 0'; return; }
  piece(g, rect(-10, -10, 1300, 90), tex.lilac, { seed: 407, shadow: false }); piece(g, rect(-10, 640, 1300, 90), tex.rose2, { seed: 408, shadow: false });
  const e = showUI('app'); e.querySelector('.side').style.visibility = 'visible'; e.style.transform = 'translate(170px,70px) scale(0.86)'; e.style.transformOrigin = '0 0';
}

// 46 · a dark room of charcoal; a dark tile drops into grey
function room(t, i, f) {
  const lt = t - S(46).t;
  if (lt < 0.7) { bg(K.charcoal('#2b292d', 410, { w: 1280, h: 720, grain: 30 })); solid([[930, 0], [1280, 0], [1280, 720], [930, 560]], K.charcoal('#4a474c', 411, { w: 1280, h: 720 })); solid([[0, 560], [930, 560], [1280, 720], [0, 720]], K.charcoal('#38363b', 412, { w: 1280, h: 720 })); }
  else { bg(K.charcoal('#555256', 413, { w: 1280, h: 720, grain: 26 })); solid(rect(184, -10, 808, 740), K.charcoal('#636164', 414, { w: 1280, h: 720, grain: 22 })); const k = ease(prog(lt, 0.7, 2.6)), sw = Math.sin(lt * 9) * 14; g.save(); g.filter = 'blur(2.5px)'; g.translate(640, 360); g.rotate(sw * 0.004); g.translate(-640 + sw, -360 + k * 120 - 60); solid(rect(512, 312, 280, 248), tex.charD); solid(rect(504, 152, 288, 160), K.charcoal('#535054', 415, { grain: 20 })); g.restore(); }
  K.vignette(g, 0.5);
}

// 47 · the mark: drawn planes around it, then paper and the r, inked
function mark(t, i, f) {
  const lt = t - S(47).t;
  bg(tex.paper);
  if (lt < 0.4) {
    [[[640, 140], [760, 210], [640, 280], [520, 210]], [[300, 230], [470, 300], [470, 470], [300, 400]], [[980, 230], [810, 300], [810, 470], [980, 400]], [[300, 480], [470, 410], [470, 600], [300, 680]], [[980, 480], [810, 410], [810, 600], [980, 680]], [[640, 600], [760, 650], [640, 720], [520, 650]]]
      .forEach((pts, k) => solid(pts, [tex.ink, tex.g2, tex.g1, tex.g5, tex.g4, tex.g2][k], { seed: 420 + k }));
  }
  // the r, inked like a stamp: 8×8 squares
  const c = 13, x0 = 640 - 4 * c, y0 = 352 - 4 * c;
  R8.forEach((row, y) => [...row].forEach((v, x) => { if (v === '1') piece(g, rect(x0 + x * c + 0.6, y0 + y * c + 0.6, c - 1.2, c - 1.2), tex.ink, { seed: 430 + x + y * 8, shadow: false, rough: 0.4 }); }));
}

// ---------------------------------------------------------------- the clock
const SCENE = [];
const on = (from, to, fn) => { for (let i = from; i <= to; i++) SCENE[i] = fn; };
on(1, 3, opening); on(4, 8, cubeFrame); on(9, 10, homeUI); on(11, 11, nodeUI); on(12, 14, slabs); on(15, 19, shelves); on(20, 20, searchUI);
on(21, 23, discs); on(24, 25, squares); on(26, 27, hexBox); on(28, 30, torn); on(31, 34, letters); on(35, 36, ellipse); on(37, 39, ring); on(40, 42, panels); on(43, 45, app); on(46, 46, room); on(47, 47, mark);

window.seek = (t, frame = Math.round(t * FPS)) => {
  const sh = REF.shots.findLast((s) => frame >= s.f) || REF.shots[0];
  const fq = sh.f + K.q(frame - sh.f, sh.on || 2);         // stop-motion: hold each drawing for `on` frames
  const tq = fq / FPS;
  for (const e of Object.values(ui)) e.style.display = 'none';
  const bo = K.boil(fq);
  g.save(); g.translate(bo.x, bo.y); SCENE[sh.i](tq, sh.i, fq); g.restore();
  g.fillStyle = bo.light > 0 ? `rgba(255,255,255,${bo.light})` : `rgba(20,18,24,${-bo.light})`; g.fillRect(0, 0, W, H);
  K.vignette(g, 0.1);
  fx.clearRect(0, 0, W, H); K.filmGrain(fx, fq, 0.06);
};
window.READY = document.fonts.ready.then(() => { for (const k of Object.keys(T)) T[k](); });
window.READY.then(() => window.seek(0, 0));
