// Local use over stdio: claude mcp add relume -- npm --prefix <repo> run -s stdio
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './tools.js';

await buildServer(process.env.RELUME_BASE_URL || 'http://localhost:8790').connect(new StdioServerTransport());
