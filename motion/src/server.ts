// HTTP: the MCP endpoint (stateless Streamable HTTP) on :8792.
import { createServer, type IncomingMessage } from 'node:http';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { buildServer, VERSION } from './tools.js';

const PORT = +(process.env.PORT || 8792);
const BASE = `http://localhost:${PORT}`;
const body = (req: IncomingMessage): Promise<Buffer> => new Promise((ok, no) => { const c: Buffer[] = []; req.on('data', (d: Buffer) => c.push(d)); req.on('end', () => ok(Buffer.concat(c))); req.on('error', no); });

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', BASE);
    if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, name: 'relume-motion', version: VERSION })); return; }
    if (url.pathname !== '/api/mcp') { res.writeHead(404).end('not found'); return; }
    if (req.method !== 'POST' && req.method !== 'DELETE') { res.writeHead(405, { allow: 'POST, DELETE' }).end(); return; }
    const b = await body(req), headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const server = buildServer(), transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    try {
      const out = await transport.handleRequest(new Request(new URL(req.url ?? '/', BASE), { method: req.method, headers, body: req.method === 'POST' ? new Uint8Array(b) : undefined }));
      const h: Record<string, string> = {}; out.headers.forEach((v, k) => (h[k] = v));
      res.writeHead(out.status, h).end(Buffer.from(await out.arrayBuffer()));
    } finally { await transport.close().catch(() => {}); await server.close().catch(() => {}); }
  } catch (e) { if (!res.headersSent) res.writeHead(500).end((e as Error).message); }
}).listen(PORT, () => console.log(`relume motion MCP on ${BASE}/api/mcp`));
