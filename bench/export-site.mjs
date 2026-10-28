// Export source/recreation pairs for the landing page's live comparison: synced recordings (both made by the
// same crawl choreography), phase marks, hero shots, both DNAs side by side and the check report.
// Usage: node bench/export-site.mjs <out-dir> <id>:<source-slug>:<recreation-url-path>[:<check-dir>] …
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const [out, ...pairs] = process.argv.slice(2);
const CAT = join(process.cwd(), 'data', 'catalog');
const gz = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
mkdirSync(join(out, 'media'), { recursive: true });

function latestCheck(slug, urlPath) {
  const dir = join(CAT, slug, 'checks');
  const runs = readdirSync(dir).filter((d) => statSync(join(dir, d)).isDirectory()).sort().reverse();
  for (const r of runs) {
    const c = JSON.parse(readFileSync(join(dir, r, 'crawl.json'), 'utf8'));
    if (c.home.includes(urlPath) && existsSync(join(dir, r, 'report.json'))) return join(dir, r);
  }
  throw new Error(`no check of ${urlPath} against ${slug}`);
}

function firstPage(dir) {
  const c = JSON.parse(readFileSync(join(dir, 'crawl.json'), 'utf8'));
  const p = c.pages.find((x) => x.ok && existsSync(join(dir, 'pages', x.key, 'motion.webm')));
  return { key: p.key, url: p.url, dir: join(dir, 'pages', p.key) };
}

function video(src, dst, seconds = 48) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-t', String(seconds), '-vf', 'scale=960:-2,fps=30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', dst]);
}
function shot(src, dst) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', 'crop=iw:min(ih\\,iw*0.625):0:0,scale=960:-2', '-q:v', '5', dst]);
}

// marks are page-clock ms; the recording starts when the page is created, a beat before navigation, so align on
// the first mark ('loaded') with the measured load time
function marks(motionGz) {
  const m = gz(motionGz);
  const loaded = m.marks.find((k) => k.label === 'loaded')?.t ?? 0;
  const pick = (re) => m.marks.find((k) => re.test(k.label));
  const phases = [['load', pick(/^loaded$/)], ['wheel test', pick(/^wheel:single/)], ['scroll pass', pick(/^scroll:start/)], ['hover pass', pick(/^hover:/)]]
    .filter(([, k]) => k).map(([name, k]) => ({ name, t: +(k.t / 1000).toFixed(2) }));
  return { loadedAt: +(loaded / 1000).toFixed(2), phases };
}

function summary(dna) {
  const t = (role) => dna.color.tokens.find((x) => x.role === role)?.value;
  const head = dna.typography.styles.find((s) => /^(display|h1)$/.test(s.name)) || dna.typography.styles[0];
  const body = dna.typography.styles.find((s) => s.name === 'body');
  const rec = (dna.motion.patterns || []).filter((p) => ['load', 'scroll'].includes(p.trigger) && !/^(circle|path|svg|g)\b/.test(p.targets[0] || '')).sort((a, b) => b.count - a.count)[0];
  return {
    url: dna.source.url, scheme: dna.color.scheme,
    colors: dna.color.tokens.slice(0, 8).map((x) => ({ name: x.name, value: x.value, role: x.role, share: x.share })),
    roles: { background: t('background'), text: t('text'), accent: t('accent'), surface: t('surface'), border: t('border') },
    fonts: dna.typography.families.map((f) => f.google || f.family),
    head: head && { size: head.size, weight: head.weight, tracking: head.letterSpacingEm, family: head.family },
    body: body && { size: body.size, leading: body.lineHeightRatio },
    radii: dna.shape.radii.slice(0, 5).map((r) => r.css),
    grid: dna.spacing.base, section: dna.spacing.sections.desktop?.median ?? null,
    container: dna.layout.containers.desktop?.[0]?.value ?? null,
    scroll: dna.motion.scroll ? { kind: dna.motion.scroll.kind, lerp: dna.motion.scroll.lerp ?? null, settle: dna.motion.scroll.settleMs } : null,
    durations: dna.motion.durations.slice(0, 5).map((d) => d.ms),
    easings: dna.motion.easings.filter((e) => !e.spring).slice(0, 3).map((e) => e.css),
    springs: dna.motion.easings.filter((e) => e.spring).length,
    signature: rec ? { trigger: rec.trigger, props: rec.props, from: rec.from, to: rec.to, duration: rec.duration, easing: rec.easing.length > 50 ? 'spring (linear())' : rec.easing, stagger: rec.stagger ?? null } : null,
    feel: dna.feel.notes.slice(0, 4),
  };
}

// boxes on the hero for the measurement overlay: the headline, the primary action, the nav and a line of body
// copy, each labelled with what relume measured there (1440×900 page coordinates)
function annotations(pageDir) {
  const h = gz(join(pageDir, 'harvest-desktop.json.gz'));
  const vh = h.viewport[1], vw = h.viewport[0];
  const px = (v) => parseFloat(v) || 0;
  const vis = h.rows.filter((r) => r.box[1] >= 0 && r.box[1] + r.box[3] <= vh && r.box[2] > 0 && +r.s.opacity > 0.05);
  const out = [];
  const head = vis.filter((r) => r.chars > 3).sort((a, b) => px(b.s.fontSize) - px(a.s.fontSize))[0];
  if (head) out.push({ kind: 'headline', box: head.box, label: `${px(head.s.fontSize)}px / ${head.s.fontWeight} · ${(px(head.s.letterSpacing) / px(head.s.fontSize)).toFixed(3)}em` });
  const btn = vis.filter((r) => /^(a|button)$/.test(r.tag) && r.box[3] >= 24 && r.box[3] <= 64 && r.box[2] < 320 && r.s.backgroundColor !== 'rgba(0, 0, 0, 0)' && r.box[1] > 60)
    .sort((a, b) => b.box[2] * b.box[3] - a.box[2] * a.box[3])[0];
  if (btn) out.push({ kind: 'action', box: btn.box, label: `${btn.s.backgroundColor.replace(/\s/g, '')} · r ${btn.s.borderTopLeftRadius} · ${btn.s.transitionDuration}` });
  const nav = vis.filter((r) => /^(header|nav)$/.test(r.tag) && r.box[1] < 40 && r.box[2] > vw * 0.5)[0];
  if (nav) out.push({ kind: 'nav', box: nav.box, label: `${nav.box[3]}px · ${nav.s.backdropFilter !== 'none' ? nav.s.backdropFilter : nav.s.backgroundColor.replace(/\s/g, '')}` });
  const body = vis.filter((r) => r.chars > 40 && px(r.s.fontSize) <= 22 && r !== head).sort((a, b) => a.box[1] - b.box[1])[0];
  if (body) out.push({ kind: 'body', box: body.box, label: `${px(body.s.fontSize)}/${(px(body.s.lineHeight) / px(body.s.fontSize)).toFixed(2)} · ${body.s.color.replace(/\s/g, '')}` });
  return { viewport: [vw, vh], items: out };
}

const result = [];
for (const spec of pairs) {
  const [id, slug, urlPath, checkDirArg] = spec.split(':');
  const src = firstPage(join(CAT, slug));
  const checkDir = checkDirArg ? join(CAT, slug, 'checks', checkDirArg) : latestCheck(slug, urlPath);
  const rec = firstPage(checkDir);
  const report = JSON.parse(readFileSync(join(checkDir, 'report.json'), 'utf8'));
  video(join(src.dir, 'motion.webm'), join(out, 'media', `${id}-source.mp4`));
  video(join(rec.dir, 'motion.webm'), join(out, 'media', `${id}-recreation.mp4`));
  shot(join(src.dir, 'shot-desktop.jpg'), join(out, 'media', `${id}-source.jpg`));
  shot(join(rec.dir, 'shot-desktop.jpg'), join(out, 'media', `${id}-recreation.jpg`));
  result.push({
    id, slug, recreationPath: urlPath,
    source: { ...summary(JSON.parse(readFileSync(join(CAT, slug, 'dna.json'), 'utf8'))), page: src.url, marks: marks(join(src.dir, 'motion.json.gz')), annotations: annotations(src.dir) },
    recreation: { ...summary(JSON.parse(readFileSync(join(checkDir, 'dna.json'), 'utf8'))), marks: marks(join(rec.dir, 'motion.json.gz')), annotations: annotations(rec.dir) },
    report: { overall: report.overall, pass: report.pass, scores: report.scores, findings: report.findings.slice(0, 6).map((f) => ({ dimension: f.dimension, message: f.message, fix: f.fix })), at: report.at },
  });
  console.log(`${id}: ${slug} vs ${urlPath} → ${report.overall}/100`);
}
writeFileSync(join(out, 'compare.json'), JSON.stringify(result, null, 1));
