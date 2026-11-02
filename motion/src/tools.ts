// relume motion: the MCP surface. Give it a reference video; it measures the style (rhythm, cadence, palette,
// texture, camera, sound, shot by shot), compiles it into STYLE.md, renders the agent's composition and scores the
// result against the reference, worst first. Long work (study, render, compare) runs as jobs.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const WORK = join(ROOT, 'work');
const REFS = join(WORK, 'refs'), RENDERS = join(WORK, 'renders');
export const VERSION = '0.1.0';
type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };
const text = (t: string): Content => ({ type: 'text', text: t });
const json = (v: unknown): Content => text(JSON.stringify(v, null, 1));
const fail = (m: string) => ({ content: [text(m)], isError: true });
const img = async (f: string, w = 960): Promise<Content> => ({ type: 'image', data: (await sharp(f).resize({ width: w }).jpeg({ quality: 82 }).toBuffer()).toString('base64'), mimeType: 'image/jpeg' });
const slugOf = (s: string) => basename(s).replace(/\.[a-z0-9]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ref';
const study = (slug: string) => JSON.parse(readFileSync(join(REFS, slug, 'study.json'), 'utf8'));

// ---- jobs
interface Job { id: string; kind: 'study' | 'render' | 'compare'; slug: string; state: 'running' | 'done' | 'failed'; log: string[]; started: number; result?: any; error?: string }
const jobs = new Map<string, Job>();
function exec(cmd: string, args: string[], log: (m: string) => void): Promise<void> {
  return new Promise((ok, no) => {
    const p = spawn(cmd, args, { cwd: ROOT });
    const line = (b: Buffer) => b.toString().split('\n').filter(Boolean).forEach(log);
    p.stdout.on('data', line); p.stderr.on('data', line);
    p.on('close', (c) => (c === 0 ? ok() : no(new Error(`${basename(args[0])} exited ${c}`))));
  });
}
function start(kind: Job['kind'], slug: string, work: (log: (m: string) => void) => Promise<any>) {
  const job: Job = { id: kind[0] + Date.now().toString(36), kind, slug, state: 'running', log: [], started: Date.now() };
  jobs.set(job.id, job);
  void work((m) => { job.log.push(m); if (job.log.length > 300) job.log.shift(); }).then((r) => { job.result = r; job.state = 'done'; }, (e) => { job.state = 'failed'; job.error = (e as Error).message; });
  return job;
}
const wait = async (j: Job, s = 0) => { for (const end = Date.now() + s * 1000; j.state === 'running' && Date.now() < end;) await new Promise((r) => setTimeout(r, 1000)); };

export const INSTRUCTIONS = `relume motion rebuilds the style of a reference video for new content. Flow:
1. study_video with the reference (a path or URL). It is a job: wait with job_status({ job, wait: 55 }).
2. get_style: STYLE.md gives the format, rhythm (every cut frame), cadence (how many frames each drawing holds), palette, texture, camera and sound, then a shot-by-shot table. Look at every shot with see_shot before building it.
3. Write a composition: one HTML page that sets window.DURATION and window.seek(t, frame) and draws each frame as a pure function of time (no timers, no CSS animations, no wall clock). Keep the reference's timeline exactly, quantise motion to the measured cadence, and give every surface the measured texture. Use your own content: never the source's logo, product, imagery or copy.
4. render it (a job), then compare against the reference (a job). compare scores rhythm, layout, tone, colour, texture, motion and audio per shot and lists what is off, worst first; see_compare shows any shot side by side. Fix the worst findings and repeat until it holds up.`;

export function buildServer() {
  const server = new McpServer({ name: 'relume-motion', version: VERSION }, { instructions: INSTRUCTIONS });
  const RO = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };
  const W = { readOnlyHint: false, idempotentHint: false, openWorldHint: false };
  const wrap = <A,>(fn: (a: A) => Promise<{ content: Content[]; isError?: boolean }>) => async (a: A) => { try { return await fn(a); } catch (e) { return fail((e as Error).message.split('\n')[0]); } };
  const has = (slug: string) => existsSync(join(REFS, slug, 'study.json'));

  server.registerTool('study_video', {
    title: 'Study a reference video', description: 'Measure a reference video: shots and exact cut frames, stop-motion cadence, camera drift, tone, palette, texture, layout and sound, shot by shot; compiles STYLE.md. A job (1–3 minutes for a minute of video): wait with job_status({ job, wait: 55 }).',
    inputSchema: { source: z.string().describe('a video file path on this machine, or an http(s) URL to a video file'), slug: z.string().optional() }, annotations: { ...W, openWorldHint: true },
  }, wrap(async ({ source, slug }) => {
    const s = slug || slugOf(source);
    mkdirSync(join(REFS, s), { recursive: true });
    const video = join(REFS, `${s}.mp4`);
    const job = start('study', s, async (log) => {
      if (/^https?:/.test(source)) await exec('curl', ['-fsSL', '-o', video, source], log);
      else if (resolve(source) !== video) { if (!existsSync(source)) throw new Error(`no file ${source}`); copyFileSync(source, video); }
      await exec('python3', [join(ROOT, 'engine/study.py'), video, join(REFS, s)], log);
      await exec('python3', [join(ROOT, 'engine/style.py'), join(REFS, s)], log);
      const st = study(s);
      return { slug: s, shots: st.rhythm.shots, duration: st.duration, fps: st.fps, cadence: st.cadence.on };
    });
    return { content: [text(`Studying ${source} as "${s}". Wait with job_status({ job: "${job.id}", wait: 55 }), then get_style("${s}").`), json({ job: job.id, slug: s })] };
  }));

  server.registerTool('job_status', {
    title: 'Job status', description: 'State and result of a study, render or compare job. Pass wait (seconds, up to 55) to block until it finishes.',
    inputSchema: { job: z.string(), wait: z.number().int().min(0).max(55).optional() }, annotations: RO,
  }, wrap(async ({ job, wait: w }) => {
    const j = jobs.get(job); if (!j) return fail(`no job ${job}`);
    await wait(j, w || 0);
    const base = { job: j.id, kind: j.kind, slug: j.slug, state: j.state, seconds: Math.round((Date.now() - j.started) / 1000), log: j.log.slice(-6), error: j.error };
    if (j.state === 'done' && j.kind === 'compare') { const r = j.result; return { content: [text(`overall ${r.overall}/100 · ${Object.entries(r.scores).map(([k, v]) => `${k} ${v}`).join(' · ')}\n\nWorst first:\n${r.findings.slice(0, 15).map((f: string) => '- ' + f).join('\n')}`), json({ ...base, report: r.reportPath })] }; }
    return { content: [json({ ...base, result: j.result })] };
  }));

  server.registerTool('list_styles', { title: 'Studied videos', description: 'Reference videos that have been studied.', inputSchema: {}, annotations: RO }, wrap(async () => {
    const all = existsSync(REFS) ? readdirSync(REFS).filter(has).map((s) => { const st = study(s); return { slug: s, source: st.source, duration: st.duration, fps: st.fps, shots: st.rhythm.shots, cadence: st.cadence.on }; }) : [];
    return { content: [json(all)] };
  }));

  server.registerTool('get_style', {
    title: 'Get the style', description: 'STYLE.md for a studied video: format, every cut frame, cadence, palette, texture, camera, sound and the shot-by-shot table. Pass shot to get one shot\'s full measurement (palette with weights, layout map, keyframe paths).',
    inputSchema: { slug: z.string(), shot: z.number().int().optional() }, annotations: RO,
  }, wrap(async ({ slug, shot }) => {
    if (!has(slug)) return fail(`${slug} is not studied yet: study_video first`);
    if (shot) { const s = study(slug).shots.find((x: any) => x.i === shot); return s ? { content: [json(s)] } : fail(`no shot ${shot}`); }
    return { content: [text(readFileSync(join(REFS, slug, 'STYLE.md'), 'utf8'))] };
  }));

  server.registerTool('see_shot', {
    title: 'See a shot', description: 'The first, middle and last frame of a shot of the reference (or one of them).',
    inputSchema: { slug: z.string(), shot: z.number().int(), frame: z.enum(['a', 'm', 'z', 'all']).optional() }, annotations: RO,
  }, wrap(async ({ slug, shot, frame }) => {
    const s = study(slug).shots.find((x: any) => x.i === shot); if (!s) return fail(`no shot ${shot}`);
    const which = frame && frame !== 'all' ? [frame] : ['a', 'm', 'z'];
    const content: Content[] = [text(`shot ${shot}: ${s.t}s, ${s.dur}s, on ${s.cadence.on}s, L ${s.tone.L}, chroma ${s.chroma}, palette ${s.palette.slice(0, 4).map((p: any) => p.hex).join(' ')}`)];
    for (const w of which) content.push(await img(join(REFS, slug, `keyframes/${String(shot).padStart(3, '0')}-${w}.jpg`), which.length > 1 ? 640 : 960));
    return { content };
  }));

  server.registerTool('get_blocking', {
    title: 'Blocking of a moment', description: 'The big masses of the reference at a moment, as numbers to build from: each region\'s bounding box, centroid, area, colour and outline (convex hull) in your frame\'s coordinates, plus an annotated image. Place masses from this rather than by eye: layout is scored frame by frame. Call it at the start, middle and end of a shot to get its motion too.',
    inputSchema: { slug: z.string(), t: z.number().describe('time in seconds'), size: z.string().optional().describe('your frame, WxH (default 1280x720)'), tones: z.number().int().min(2).max(8).optional() }, annotations: RO,
  }, wrap(async ({ slug, t, size, tones }) => {
    if (!has(slug)) return fail(`${slug} is not studied yet`);
    const out = join(WORK, 'tmp', `blocking-${slug}-${t}.jpg`); mkdirSync(dirname(out), { recursive: true });
    let txt = ''; await exec('python3', [join(ROOT, 'engine/blocking.py'), join(REFS, slug), String(t), '--size', size || '1280x720', '--tones', String(tones || 4), '--image', out], (m) => (txt += m));
    return { content: [await img(out, 960), text(txt)] };
  }));

  server.registerTool('render', {
    title: 'Render a composition', description: 'Render a composition (an HTML page with window.DURATION and window.seek(t, frame)) to an mp4 at the reference\'s frame rate. A job.',
    inputSchema: { page: z.string().describe('path to the composition HTML'), slug: z.string().optional().describe('reference slug, for fps and size'), out: z.string().optional(), audio: z.string().optional(), size: z.string().optional().describe('WxH, default 1280x720') }, annotations: W,
  }, wrap(async ({ page, slug, out, audio, size }) => {
    const fps = slug && has(slug) ? study(slug).fps : 24;
    const dest = resolve(out || join(RENDERS, `${slugOf(dirname(page))}-${Date.now().toString(36)}.mp4`)); mkdirSync(dirname(dest), { recursive: true });
    const job = start('render', slug || '', async (log) => { await exec('node', [join(ROOT, 'engine/render.cjs'), '--page', resolve(page), '--out', dest, '--fps', String(fps), '--size', size || '1280x720', ...(audio ? ['--audio', resolve(audio)] : [])], log); return { video: dest }; });
    return { content: [text(`Rendering at ${fps} fps. Wait with job_status({ job: "${job.id}", wait: 55 }), then compare.`), json({ job: job.id, out: dest })] };
  }));

  server.registerTool('compare', {
    title: 'Compare a clone with the reference', description: 'Score a rendered clone against a studied reference, per shot: rhythm, layout, tone, colour, texture, motion, audio; with findings worst first. A job (about a minute).',
    inputSchema: { slug: z.string(), video: z.string() }, annotations: W,
  }, wrap(async ({ slug, video }) => {
    if (!has(slug)) return fail(`${slug} is not studied yet`);
    const out = join(RENDERS, `${basename(video, '.mp4')}.check`);
    const job = start('compare', slug, async (log) => { await exec('python3', [join(ROOT, 'engine/compare.py'), join(REFS, slug), resolve(video), out], log); return { ...JSON.parse(readFileSync(join(out, 'report.json'), 'utf8')), reportPath: join(out, 'report.json') }; });
    return { content: [text(`Comparing. Wait with job_status({ job: "${job.id}", wait: 55 }).`), json({ job: job.id })] };
  }));

  server.registerTool('see_compare', {
    title: 'See a shot side by side', description: 'Reference (left) and clone (right) at the middle of a shot, from a compare report.',
    inputSchema: { slug: z.string(), report: z.string().describe('report.json path from compare'), shot: z.number().int() }, annotations: RO,
  }, wrap(async ({ slug, report, shot }) => {
    const ref = join(REFS, slug, `keyframes/${String(shot).padStart(3, '0')}-m.jpg`), cl = join(dirname(report), 'thumbs', `${String(shot).padStart(3, '0')}.jpg`);
    const r = JSON.parse(readFileSync(report, 'utf8')).shots.find((x: any) => x.i === shot);
    const [a, b] = await Promise.all([sharp(ref).resize(640, 360).toBuffer(), sharp(cl).resize(640, 360).toBuffer()]);
    const both = await sharp({ create: { width: 1290, height: 360, channels: 3, background: '#000' } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: 650, top: 0 }]).jpeg({ quality: 82 }).toBuffer();
    return { content: [{ type: 'image', data: both.toString('base64'), mimeType: 'image/jpeg' }, json(r)] };
  }));

  return server;
}
