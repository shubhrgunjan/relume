// Local use over stdio: claude mcp add relume-motion -- node --import tsx <repo>/motion/src/stdio.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './tools.js';

await buildServer().connect(new StdioServerTransport());
