#!/usr/bin/env node
/**
 * Refresh tools.snapshot.json from the live PkgSeek MCP endpoint.
 * Usage: npm run sync-tools   (PKGSEEK_API_URL overrides the default base)
 */
import { writeFileSync } from 'node:fs';

const apiBase = (process.env.PKGSEEK_API_URL ?? 'https://api.pkgseek.com').replace(/\/+$/, '');
const response = await fetch(`${apiBase}/mcp`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) {
  throw new Error(`tools/list failed: HTTP ${response.status}`);
}
const message = await response.json();
const tools = message?.result?.tools;
if (!Array.isArray(tools) || tools.length === 0) {
  throw new Error('tools/list returned no tools');
}
for (const tool of tools) {
  if (typeof tool?.name !== 'string' || typeof tool?.inputSchema !== 'object' || tool.inputSchema === null) {
    throw new Error(`malformed tool definition: ${JSON.stringify(tool).slice(0, 200)}`);
  }
}
const path = new URL('../tools.snapshot.json', import.meta.url);
writeFileSync(path, `${JSON.stringify(tools, null, 2)}\n`);
console.log(`wrote ${tools.length} tools to tools.snapshot.json`);
