/**
 * dsh-plugin-pkgseek — PkgSeek intelligence as native DeepSeek Harness tools.
 *
 * A thin adapter over the hosted PkgSeek MCP-over-HTTP endpoint: at load time
 * it fetches `tools/list` and registers one native DSH tool per definition
 * (names prefixed `pkgseek_`); every call is forwarded as `tools/call`. A
 * bundled snapshot keeps the plugin loadable when the API is unreachable.
 */
import { readFileSync } from 'node:fs';
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { buildTool, selectTools } from './adapter.js';
import { McpHttpClient, type McpToolDef } from './mcp-client.js';
import { buildGuidance, PROMPT_SECTION_NAME, PROMPT_SECTION_ORDER, type PromptSectionRegistry } from './prompt.js';

export const name = 'pkgseek';
export const inject = ['tools'];

export interface Config {
  /** Base URL of a PkgSeek API deployment; `/mcp` is appended. */
  apiBase: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
  /** Register the pkgseek_* usage guidance as a system-prompt section. */
  promptGuidance: boolean;
  /** Refresh the tool list from the live endpoint at load time. */
  refreshTools: boolean;
  /** Allowlist of unprefixed upstream tool names; empty registers all. */
  enabledTools: string[];
}

export const Config: Schema = Schema.object({
  apiBase: Schema.string().default('https://api.pkgseek.com'),
  timeoutMs: Schema.number().default(20000),
  promptGuidance: Schema.boolean().default(true),
  refreshTools: Schema.boolean().default(true),
  enabledTools: Schema.array(Schema.string()).default([]),
});

function loadSnapshot(): McpToolDef[] {
  const url = new URL('../tools.snapshot.json', import.meta.url);
  const parsed: unknown = JSON.parse(readFileSync(url, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('tools.snapshot.json is missing or empty; run `npm run sync-tools`');
  }
  return parsed as McpToolDef[];
}

export async function apply(ctx: Context, config: Config) {
  const client = new McpHttpClient(config.apiBase, config.timeoutMs);

  let tools: McpToolDef[];
  if (config.refreshTools) {
    try {
      tools = await client.listTools();
    } catch (error) {
      console.warn(`[pkgseek] live tools/list failed, falling back to bundled snapshot: ${(error as Error).message}`);
      tools = loadSnapshot();
    }
  } else {
    tools = loadSnapshot();
  }

  const selected = selectTools(tools, config.enabledTools);
  for (const tool of selected) {
    ctx.tools.register(buildTool(tool, client, config.timeoutMs));
  }

  if (config.promptGuidance && selected.length > 0) {
    const registry = ctx.get('systemPrompt') as PromptSectionRegistry | undefined;
    if (typeof registry?.section === 'function') {
      registry.section({
        name: PROMPT_SECTION_NAME,
        order: PROMPT_SECTION_ORDER,
        text: buildGuidance(new Set(selected.map((tool) => tool.name))),
      });
    } else {
      console.warn('[pkgseek] systemPrompt service unavailable; skipping prompt guidance');
    }
  }
}
