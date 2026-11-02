// Call the relume motion MCP over HTTP, the way an agent would. Prints text results; saves images to ./mcp-out/.
//   node bin/mcp-call.mjs <tool> '<json args>'        (MCP_URL defaults to http://localhost:8792/api/mcp)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const [tool, args = '{}'] = process.argv.slice(2);
const client = new Client({ name: 'mcp-call', version: '0' });
await client.connect(new StreamableHTTPClientTransport(new URL(process.env.MCP_URL || 'http://localhost:8792/api/mcp')));
if (!tool || tool === 'list') { const t = await client.listTools(); console.log(t.tools.map((x) => `${x.name}: ${x.description.slice(0, 90)}`).join('\n')); process.exit(0); }
const r = await client.callTool({ name: tool, arguments: JSON.parse(args) });
let n = 0;
for (const c of r.content) {
  if (c.type === 'text') console.log(c.text);
  if (c.type === 'image') { mkdirSync('mcp-out', { recursive: true }); const f = `mcp-out/${tool}-${n++}.jpg`; writeFileSync(f, Buffer.from(c.data, 'base64')); console.log(`[image → ${f}]`); }
}
if (r.isError) process.exit(1);
await client.close();
