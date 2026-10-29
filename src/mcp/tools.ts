// The relume MCP surface. Long work (extracting a site, checking a page) runs as a job; everything else reads
// the catalogue. One server per request (HTTP) or per process (stdio).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { crawlSite, DEFAULT_VIEWPORTS } from '../crawl/crawl.js';
import { buildDna } from '../infer/dna.js';
import { compileSkill, skillName } from '../skill/compile.js';
import { checkStyle, pitfalls, reportMd } from '../verify/check.js';
import { compareDna } from '../verify/compare.js';
import { entryDir, listEntries, readJson, slugFor, CATALOG } from '../catalog/catalog.js';

// version + the newest source file's time, so a client can tell a stale server from a fresh one (issue 2)
export const BUILT = (() => { try { const root = join(dirname(fileURLToPath(import.meta.url)), '..'); let t = 0; const walk = (d: string) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) walk(p); else t = Math.max(t, statSync(p).mtimeMs); } }; walk(root); return new Date(t).toISOString().slice(0, 16).replace(/[-:T]/g, ''); } catch { return 'unknown'; } })();
export const VERSION = `0.1.0+${BUILT}`;
export const STARTED = new Date().toISOString();
type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };
const text = (t: string): Content => ({ type: 'text', text: t });
const json = (v: unknown): Content => text(JSON.stringify(v, null, 1));
const fail = (msg: string) => ({ content: [text(msg)], isError: true });

// ---- jobs ------------------------------------------------------------------------------------------
interface Job { id: string; kind: 'extract' | 'check'; slug: string; url: string; state: 'running' | 'done' | 'failed'; log: string[]; started: number; result?: any; error?: string; pages?: number }
const jobs = new Map<string, Job>();
/** The running extraction of a slug, if any: tools that read the language wait for it rather than serve a half-measured one. */
export const busy = (slug: string) => [...jobs.values()].find((j) => j.kind === 'extract' && j.slug === slug && j.state === 'running');
/** Where a job is and roughly how long is left, from its log (page i of n, then the phases of the first page). */
function progress(j: Job) {
  const secs = Math.round((Date.now() - j.started) / 1000);
  const pages = [...j.log].reverse().map((l) => l.match(/^\[(\d+)\/(\d+)\]/)).find(Boolean);
  const i = pages ? +pages[1] : 0, n = pages ? +pages[2] : (j.pages || 4);
  const last = j.log[j.log.length - 1] || 'starting';
  const phase = /dwell/.test(last) ? 'watching each section move' : /hover/.test(last) ? 'hovering every control' : /scroll/.test(last) ? 'recording the scroll' : /harvest/.test(last) ? 'measuring every element' : /^\[/.test(last) ? 'loading a page' : /skill|infer/.test(last) ? 'compiling the skill' : 'crawling';
  // the first page also gets the long behaviour watch; then other pages, other viewports, inference
  const total = j.kind === 'check' ? 360 : 420 + Math.max(0, n - 1) * 100 + 150;
  return { page: i ? `${i} of ${n}` : undefined, phase, elapsedSeconds: secs, etaMinutes: Math.max(1, Math.round((total - secs) / 60)) };
}
let running = 0;
const queue: (() => Promise<void>)[] = [];
const MAX_PARALLEL = +(process.env.RELUME_PARALLEL || 2);
function enqueue(job: Job, work: (log: (m: string) => void) => Promise<any>) {
  jobs.set(job.id, job);
  const run = async () => {
    running++;
    try { job.result = await work((m) => { job.log.push(m); if (job.log.length > 200) job.log.shift(); }); job.state = 'done'; }
    catch (e) { job.state = 'failed'; job.error = (e as Error).message.split('\n')[0]; }
    finally { running--; const next = queue.shift(); if (next) void next(); }
  };
  if (running < MAX_PARALLEL) void run(); else queue.push(run);
}

function entrySummary(slug: string) {
  const dna = readJson(join(entryDir(slug), 'dna.json'));
  const t = (role: string) => dna.color.tokens.find((x: any) => x.role === role)?.value;
  return {
    slug, url: dna.source.url, measured: dna.source.crawledAt.slice(0, 10), pages: dna.source.pages.length,
    scheme: dna.color.scheme, background: t('background'), text: t('text'), accent: t('accent'),
    fonts: dna.typography.families.map((f: any) => f.family), scroll: dna.motion.scroll?.kind, libraries: Object.keys(dna.motion.libraries || {}).filter((k) => dna.motion.libraries[k] && !['scrollBehavior', 'scrollSnap'].includes(k)),
    feel: dna.feel.notes,
  };
}

const SECTIONS = ['color', 'typography', 'spacing', 'shape', 'layout', 'components', 'motion', 'feel', 'source'] as const;

export const INSTRUCTIONS = `relume turns a live website into a measured design language and an agent skill. Give it a URL: it crawls representative pages at desktop, tablet, mobile and dark mode, records every animation, transition and scroll response frame by frame, and infers colour roles, type styles (with fluid sizes), spacing grid, radii, borders, shadows, layout, components with hover/focus states, and motion (intro choreography, scroll reveals with entry points and stagger, hover timing, springs, smooth-scroll feel). It compiles that into a skill (SKILL.md + tokens.css + Tailwind theme + DTCG tokens + motion.css/motion.js + references + a lint script).

Flow: search_catalog first — the site may already be measured. Otherwise extract_site (a job, 5–15 minutes) and wait for it with job_status (pass wait: 55 to block until it moves on).

Do not design, write markup or styles, or pick colours, fonts or layouts until the extraction is done and you have read the skill (get_skill, then references/blueprint.md). The whole point is to build from measurement instead of guessing; a draft written while relume is measuring is a guess you will have to throw away. While you wait, only work out the content (product, copy, sections you need). Install the skill with get_skill (it gives a one-line curl | tar into .claude/skills/) or read get_dna for raw values. Build. Then check_style with your page's URL (also a job): it measures your page with the same pipeline and scores colour, type, spacing, shape, layout, motion and feel against the source, with concrete fixes worst-first. Iterate until it passes. A check needs a URL this server can reach.

The catalogue grows with every extraction, and every check is remembered: get_pitfalls shows what agents most often get wrong for a language. Build in the language, never with the source's logo, imagery, product names or copy; fonts marked commercial come with an open substitute.`;

export function buildServer(baseUrl: string, authHeader?: string) {
  const server = new McpServer({ name: 'relume', version: VERSION }, { instructions: INSTRUCTIONS });
  const RO = { readOnlyHint: true, idempotentHint: true, openWorldHint: false };
  const has = (slug: string) => existsSync(join(CATALOG, slug, 'dna.json'));
  const measuring = async (slug: string) => {
    for (const end = Date.now() + 50_000; busy(slug) && Date.now() < end;) await new Promise((r) => setTimeout(r, 1000));
    const j = busy(slug);
    if (!j) return null;
    const p = progress(j);
    return { content: [text(`${slug} is still being measured (${p.phase}, about ${p.etaMinutes} min left). Its language is not ready: do not design or build from guesses meanwhile. Wait with job_status({ job: "${j.id}", wait: 55 }), then call this again.`)], isError: true };
  };
  const wrap = <A,>(fn: (a: A) => Promise<{ content: Content[]; isError?: boolean }>) => async (a: A) => { try { return await fn(a); } catch (e) { return fail((e as Error).message.split('\n')[0]); } };

  server.registerTool('search_catalog', {
    title: 'Search measured sites', description: 'List catalogue entries (measured sites with a compiled skill), optionally filtered by text: a host, scheme (dark/light), font, library (lenis, gsap…) or feel word.',
    inputSchema: { query: z.string().optional() }, annotations: RO,
  }, wrap(async ({ query }) => {
    const all = listEntries().filter((e) => e.dna).map((e) => entrySummary(e.slug));
    const q = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
    const hits = q.length ? all.filter((e) => q.every((w) => JSON.stringify(e).toLowerCase().includes(w))) : all;
    return { content: [json({ count: hits.length, entries: hits })] };
  }));

  server.registerTool('extract_site', {
    title: 'Measure a site', description: 'Crawl a website and compile its design language into a skill. Runs as a job (typically 5–15 minutes); wait for it with job_status({ job, wait: 55 }) and do not start designing or building until it is done. By default the result joins the public catalogue; pass catalog: false to keep it private (every tool still works on its slug). Re-extracting an existing slug refreshes it.',
    inputSchema: { url: z.string().url(), pages: z.number().int().min(1).max(10).optional().describe('representative pages to crawl (default 4, at least 3: one page misses most of a language)'), slug: z.string().optional(), catalog: z.boolean().optional().describe('false keeps this entry out of the catalogue') },
    annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  }, wrap(async ({ url, pages, slug, catalog }) => {
    const s = slug || slugFor(url);
    const running = busy(s);
    if (running) return { content: [text(`${s} is already being measured (job ${running.id}). Wait for it: job_status({ job: "${running.id}", wait: 55 }).`), json({ job: running.id, slug: s, state: 'running', ...progress(running) })] };
    pages = Math.max(3, pages ?? 4);
    const job: Job = { id: 'x' + Date.now().toString(36), kind: 'extract', slug: s, url, state: 'running', log: [], started: Date.now(), pages };
    if (catalog === false) writeFileSync(join(entryDir(s), 'private.json'), JSON.stringify({ private: true, at: new Date().toISOString() }));
    enqueue(job, async (log) => {
      await crawlSite(url, entryDir(s), { maxPages: pages, viewports: DEFAULT_VIEWPORTS, dark: true, hoverLimit: 25, log });
      const dna = await buildDna(entryDir(s), s);
      const out = compileSkill(dna, entryDir(s));
      return { slug: s, skill: skillName(dna), notes: dna.feel.notes, skillDir: out };
    });
    const p = progress(job);
    const few = '';
    return { content: [
      text(`relume is measuring ${url} (about ${p.etaMinutes} minutes).${few}\n\nDo not start designing or building yet: no layout, colours, fonts, markup or styles until this job is done and you have read the skill. Anything built now is a guess. Meanwhile, only plan the content.\n\nWait with job_status({ job: "${job.id}", wait: 55 }); repeat until state is "done", then call get_skill("${s}") and read references/blueprint.md first.`),
      json({ job: job.id, slug: s, state: 'running', private: catalog === false, etaMinutes: p.etaMinutes, doNotBuildYet: true, next: { tool: 'job_status', args: { job: job.id, wait: 55 } } }),
    ] };
  }));

  server.registerTool('job_status', {
    title: 'Job status', description: 'State, progress and result of an extract_site or check_style job. Pass wait (seconds, up to 55) to block until the job finishes or the time is up, instead of polling in a loop.', inputSchema: { job: z.string(), wait: z.number().int().min(0).max(55).optional().describe('seconds to wait for the job to finish before answering') }, annotations: RO,
  }, wrap(async ({ job, wait }) => {
    const j = jobs.get(job);
    if (!j) return fail(`no job ${job} (jobs are kept until the server restarts; search_catalog shows finished extractions)`);
    for (const end = Date.now() + (wait || 0) * 1000; j.state === 'running' && Date.now() < end;) await new Promise((r) => setTimeout(r, 1000));
    if (j.state === 'running') {
      const p = progress(j);
      const what = j.kind === 'extract' ? `Still measuring${p.page ? ` page ${p.page}` : ''}: ${p.phase} (${Math.round(p.elapsedSeconds / 60)} min so far, about ${p.etaMinutes} min left). Do not start designing or building yet.` : `Still checking your page: ${p.phase} (about ${p.etaMinutes} min left).`;
      return { content: [text(`${what} Call job_status({ job: "${j.id}", wait: 55 }) again.`), json({ job: j.id, kind: j.kind, slug: j.slug, state: j.state, ...p, log: j.log.slice(-5), doNotBuildYet: j.kind === 'extract', next: { tool: 'job_status', args: { job: j.id, wait: 55 } } })] };
    }
    if (j.state === 'done' && j.kind === 'extract') return { content: [text(`Done: ${j.slug} is measured. Now call get_skill("${j.slug}"), install it, and read references/blueprint.md before writing any code; use see_behaviour for every section that moves.`), json({ job: j.id, kind: j.kind, slug: j.slug, state: j.state, seconds: Math.round((Date.now() - j.started) / 1000), result: j.result, next: { tool: 'get_skill', args: { slug: j.slug } } })] };
    const base = { job: j.id, kind: j.kind, slug: j.slug, url: j.url, state: j.state, seconds: Math.round((Date.now() - j.started) / 1000), log: j.log.slice(-8), error: j.error };
    if (j.state === 'done' && j.kind === 'check') return { content: [text(reportMd(j.result.report)), json({ ...base, checkId: j.result.id })] };
    return { content: [json({ ...base, result: j.result })] };
  }));

  server.registerTool('get_dna', {
    title: 'Design DNA', description: `Measured design language of a catalogue entry. Pick a section (${SECTIONS.join(', ')}) — the whole DNA is large.`,
    inputSchema: { slug: z.string(), section: z.enum(SECTIONS).optional() }, annotations: RO,
  }, wrap(async ({ slug, section }) => {
    { const w = await measuring(slug); if (w) return w; }
    if (!has(slug)) return fail(`no entry ${slug}; search_catalog lists entries`);
    const dna = readJson(join(entryDir(slug), 'dna.json'));
    if (!section) return { content: [json({ ...entrySummary(slug), sections: SECTIONS, sizes: Object.fromEntries(SECTIONS.map((k) => [k, JSON.stringify(dna[k] ?? null).length])) })] };
    let v = dna[section];
    if (section === 'motion') v = { ...v, scroll: v.scroll ? { ...v.scroll, trace: undefined } : null };
    return { content: [json(v)] };
  }));

  server.registerTool('get_skill', {
    title: 'Get the skill', description: 'The compiled agent skill for an entry: SKILL.md inline, the file list, and a one-line command that installs the whole skill into .claude/skills/. Read other files with get_skill_file.',
    inputSchema: { slug: z.string() }, annotations: RO,
  }, wrap(async ({ slug }) => {
    { const w = await measuring(slug); if (w) return w; }
    if (!has(slug)) return fail(`no entry ${slug}`);
    const dna = readJson(join(entryDir(slug), 'dna.json'));
    const name = skillName(dna);
    const dir = join(entryDir(slug), 'skill', name);
    if (!existsSync(dir)) compileSkill(dna, entryDir(slug));
    const files: string[] = [];
    const walk = (d: string, rel = '') => { for (const f of readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(join(d, f.name), rel + f.name + '/') : files.push(rel + f.name); };
    walk(dir);
    const auth = authHeader ? ` -H "Authorization: ${authHeader}"` : '';
    return { content: [
      text(`Install: mkdir -p .claude/skills && curl -sf${auth} ${baseUrl}/skills/${encodeURIComponent(slug)}.tar.gz | tar xz -C .claude/skills/\n\nFiles (${name}/): ${files.join(', ')}`),
      text(readFileSync(join(dir, 'SKILL.md'), 'utf8')),
    ] };
  }));

  server.registerTool('get_skill_file', {
    title: 'Read a skill file', description: 'One text file from an entry\'s skill (e.g. references/motion.md, assets/tokens.css, assets/motion.js).',
    inputSchema: { slug: z.string(), path: z.string() }, annotations: RO,
  }, wrap(async ({ slug, path }) => {
    { const w = await measuring(slug); if (w) return w; }
    if (!has(slug)) return fail(`no entry ${slug}`);
    const dna = readJson(join(entryDir(slug), 'dna.json'));
    const dir = join(entryDir(slug), 'skill', skillName(dna));
    const clean = normalize(path).replace(/^(\.\.(\/|\\|$))+/, '');
    const f = join(dir, clean);
    if (!f.startsWith(dir) || !existsSync(f)) return fail(`no file ${path}`);
    if (/\.(jpg|png|webp)$/.test(f)) return fail('images: use see_reference');
    return { content: [text(readFileSync(f, 'utf8'))] };
  }));

  server.registerTool('see_reference', {
    title: 'See the source', description: 'Look at the measured site: a page screenshot (page key + viewport desktop|tablet|mobile|desktop-dark, cropped to a vertical window) or a component crop (component name from get_dna components).',
    inputSchema: { slug: z.string(), page: z.string().optional(), viewport: z.string().optional(), top: z.number().optional().describe('px from the top of the page'), height: z.number().optional(), component: z.string().optional() }, annotations: RO,
  }, wrap(async ({ slug, page, viewport, top, height, component }) => {
    { const w = await measuring(slug); if (w) return w; }
    if (!has(slug)) return fail(`no entry ${slug}`);
    const dir = entryDir(slug);
    let file: string, crop: { top: number; height: number } | undefined;
    if (component) file = join(dir, 'components', `${component}.jpg`);
    else {
      const dna = readJson(join(dir, 'dna.json'));
      const key = page || dna.source.pages[0].key;
      file = join(dir, 'pages', key, `shot-${viewport || 'desktop'}.jpg`);
      crop = { top: top ?? 0, height: height ?? 1600 };
    }
    if (!existsSync(file)) return fail('no such reference');
    let img = sharp(file);
    const meta = await img.metadata();
    if (crop) { const t = Math.min(Math.max(0, crop.top), meta.height! - 1); img = img.extract({ left: 0, top: t, width: meta.width!, height: Math.min(crop.height, meta.height! - t) }); }
    const buf = await img.resize({ width: Math.min(meta.width!, 1280), withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    return { content: [{ type: 'image', data: buf.toString('base64'), mimeType: 'image/jpeg' }, text(crop ? `page height ${meta.height}px; showing ${crop.top}–${crop.top + crop.height}` : component!)] };
  }));

  server.registerTool('see_behaviour', {
    title: 'See a section move', description: 'A filmstrip (six moments of the section held still in view) plus its measured behaviour: what types, cycles, dims, drifts, follows or loops, with speeds and periods. Look at this before building any section that moves on its own.',
    inputSchema: { slug: z.string(), page: z.string().optional().describe('page key (default: home)'), section: z.number().int().min(1).describe('section number, as in blueprint.md') }, annotations: RO,
  }, wrap(async ({ slug, page, section }) => {
    { const w = await measuring(slug); if (w) return w; }
    if (!has(slug)) return fail(`no entry ${slug}`);
    const dna = readJson(join(entryDir(slug), 'dna.json'));
    const pg = (dna.composition?.pages || []).find((p: any) => p.key === (page || dna.composition.pages[0]?.key));
    const sec = pg?.sections?.[section - 1];
    if (!sec) return fail(`no section ${section} on ${page || 'the first page'}`);
    const content: Content[] = [];
    const film = sec.behaviour?.filmstrip ? join(entryDir(slug), sec.behaviour.filmstrip) : null;
    if (film && existsSync(film)) content.push({ type: 'image', data: (await sharp(film).jpeg({ quality: 80 }).toBuffer()).toString('base64'), mimeType: 'image/jpeg' });
    content.push(json({ section: section, kind: sec.kind, narrative: sec.behaviour?.narrative || ['Nothing moves on its own here.'], measured: sec.behaviour?.items || [] }));
    return { content };
  }));

  server.registerTool('check_style', {
    title: 'Check a page against a language', description: 'Measure your page (a URL this server can reach) with the same pipeline and compare its DNA to the entry: scores for colour, type, spacing, shape, layout, motion, feel, composition and behaviour, plus fixes worst-first. Runs as a job (~3–12 min); poll job_status. A build checked against a public entry joins the catalogue as its recreation (pass catalog: false to opt out).',
    inputSchema: { slug: z.string(), url: z.string().url(), catalog: z.boolean().optional().describe('false keeps this build out of the public catalogue (by default a build checked against a public entry is listed as its recreation)') }, annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
  }, wrap(async ({ slug, url, catalog }) => {
    { const w = await measuring(slug); if (w) return w; }
    if (!has(slug)) return fail(`no entry ${slug}`);
    const job: Job = { id: 'c' + Date.now().toString(36), kind: 'check', slug, url, state: 'running', log: [], started: Date.now() };
    enqueue(job, (log) => checkStyle(slug, url, log, { catalog }));
    return { content: [json({ job: job.id, state: 'running', next: 'job_status' })] };
  }));

  server.registerTool('get_pitfalls', {
    title: 'Common misses', description: 'What past checks against this entry most often flagged — read before building.', inputSchema: { slug: z.string() }, annotations: RO,
  }, wrap(async ({ slug }) => { const w = await measuring(slug); if (w) return w; return { content: [json(pitfalls(slug))] }; }));

  server.registerTool('compare_entries', {
    title: 'Compare two languages', description: 'Score how close two catalogue entries\' design languages are (calibration, or picking a reference).', inputSchema: { a: z.string(), b: z.string() }, annotations: RO,
  }, wrap(async ({ a, b }) => {
    if (!has(a) || !has(b)) return fail('both entries must exist');
    return { content: [text(reportMd(compareDna(readJson(join(entryDir(a), 'dna.json')), readJson(join(entryDir(b), 'dna.json')))))] };
  }));

  server.registerPrompt('build_in_language', {
    title: 'Build in a measured language', description: 'Build a page in a catalogue entry\'s design language and iterate until check_style passes.',
    argsSchema: { slug: z.string(), page: z.string().describe('what to build, e.g. "a pricing page for a note-taking app"') },
  }, ({ slug, page }) => ({ messages: [{ role: 'user', content: { type: 'text', text: `Build ${page} in the design language of relume entry "${slug}".\n0. If ${slug} is not in the catalogue yet, extract_site it and wait for the job with job_status({ job, wait: 55 }) until it is done. Do not design or write any code before that.\n1. get_skill ${slug} and install it; read SKILL.md, references/blueprint.md (every section, in order, with its behaviour), tokens.md, components.md and motion.md; get_pitfalls ${slug}; see_behaviour for each section that moves.\n2. Look at the source with see_reference (desktop and mobile) to absorb the feel.\n3. Build with assets/tokens.css, motion.css and motion.js — every colour, size, radius, duration and curve from the tokens; intro and scroll reveals exactly as measured. Never reuse the source's logo, imagery, product names or copy.\n4. Run scripts/lint.mjs on your files and fix everything.\n5. Serve the page where relume can reach it and call check_style; fix the findings worst-first and re-check until it passes.` } }] }));

  return server;
}
