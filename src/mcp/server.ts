// HTTP: the MCP endpoint (stateless Streamable HTTP), skill downloads (tar.gz), and a catalogue page.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { buildServer, VERSION, STARTED } from './tools.js';
import { entryDir, readJson } from '../catalog/catalog.js';
import { skillName } from '../skill/compile.js';
import { catalogPage } from './site.js';

const PORT = +(process.env.PORT || 8790);
const LANDING = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'site', 'index.html');
const BASE = process.env.RELUME_BASE_URL || `http://localhost:${PORT}`;
// keys: RELUME_KEYS=key1,key2 — empty means open (local use)
const KEYS = new Set((process.env.RELUME_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean));
const authorized = (req: IncomingMessage) => !KEYS.size || KEYS.has((req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim());

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => { const c: Buffer[] = []; req.on('data', (d: Buffer) => c.push(d)); req.on('end', () => resolve(Buffer.concat(c))); req.on('error', reject); });
}

async function handleMcp(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') { res.writeHead(405, { allow: 'POST, DELETE' }).end(); return; }
  const body = await readBody(req);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const webReq = new Request(new URL(req.url ?? '/', BASE), { method: req.method, headers, body: req.method === 'POST' ? new Uint8Array(body) : undefined });
  const server = buildServer(BASE, KEYS.size ? req.headers.authorization : undefined);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    const out = await transport.handleRequest(webReq);
    const h: Record<string, string> = {};
    out.headers.forEach((v, k) => (h[k] = v));
    res.writeHead(out.status, h);
    res.end(Buffer.from(await out.arrayBuffer()));
  } finally {
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}

function handleSkill(res: ServerResponse, slug: string) {
  if (!/^[a-z0-9.-]+$/.test(slug) || !existsSync(join(entryDir(slug), 'dna.json'))) { res.writeHead(404).end('no such entry'); return; }
  const name = skillName(readJson(join(entryDir(slug), 'dna.json')));
  res.writeHead(200, { 'content-type': 'application/gzip', 'content-disposition': `attachment; filename="${name}.tar.gz"` });
  spawn('tar', ['czf', '-', '-C', join(entryDir(slug), 'skill'), name]).stdout.pipe(res);
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', BASE);
    if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, version: VERSION, started: STARTED })); return; }
    if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(readFileSync(LANDING)); return; }
    if (url.pathname === '/catalog') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(catalogPage()); return; }
    const shot = url.pathname.match(/^\/shot\/([a-z0-9.-]+)\/([a-z0-9-]+)\/([a-z-]+)\.jpg$/);
    if (shot) { const f = join(entryDir(shot[1]), 'pages', shot[2], `shot-${shot[3]}.jpg`); if (existsSync(f)) { res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'max-age=3600' }).end(readFileSync(f)); return; } }
    if (!authorized(req)) { res.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Authorization: Bearer <key> required' }, id: null })); return; }
    if (url.pathname === '/api/mcp') return await handleMcp(req, res);
    const m = url.pathname.match(/^\/skills\/([^/]+)\.tar\.gz$/);
    if (m) return handleSkill(res, decodeURIComponent(m[1]));
    res.writeHead(404).end('not found');
  } catch (e) {
    if (!res.headersSent) res.writeHead(500).end((e as Error).message);
  }
}).listen(PORT, () => console.log(`relume on ${BASE} — landing at /, catalogue at /catalog, MCP at /api/mcp`));
