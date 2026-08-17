/**
 * Minimal JSON-RPC 2.0 client for the PkgSeek MCP-over-HTTP endpoint.
 *
 * The hosted API speaks `initialize` / `tools/list` / `tools/call` at
 * `POST {apiBase}/mcp` (see `crates/api/src/mcp.rs` in the pkgseek repo).
 * Zero dependencies: global `fetch` only.
 */

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface McpToolDef {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonValue & { type?: string };
}

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

const MAX_ERROR_EXCERPT = 500;

/**
 * Combine an optional caller signal with a per-request timeout into one
 * AbortController. AbortSignal.any needs Node 20; this works on Node 18.
 */
function linkSignals(timeoutMs: number, caller?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs);
  const onAbort = () => controller.abort(caller?.reason);
  if (caller) {
    if (caller.aborted) onAbort();
    else caller.addEventListener('abort', onAbort, { once: true });
  }
  const release = () => {
    clearTimeout(timer);
    caller?.removeEventListener('abort', onAbort);
  };
  return { signal: controller.signal, release };
}

export class McpHttpClient {
  private nextId = 1;

  constructor(
    private readonly apiBase: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  async listTools(caller?: AbortSignal): Promise<McpToolDef[]> {
    const result = await this.rpc('tools/list', {}, caller);
    const tools = (result as { tools?: unknown }).tools;
    if (!Array.isArray(tools)) {
      throw new Error('PkgSeek MCP tools/list returned no tools array');
    }
    return tools as McpToolDef[];
  }

  /** Returns the tool's structuredContent, falling back to its text content. */
  async callTool(name: string, args: Record<string, unknown>, caller?: AbortSignal): Promise<JsonValue> {
    const result = (await this.rpc('tools/call', { name, arguments: args }, caller)) as {
      isError?: boolean;
      structuredContent?: JsonValue;
      content?: { type?: string; text?: string }[];
    };
    const text = result.content?.find((block) => block.type === 'text')?.text;
    if (result.isError) {
      throw new Error(text ?? `PkgSeek tool ${name} failed`);
    }
    if (result.structuredContent !== undefined) return result.structuredContent;
    return text ?? null;
  }

  private async rpc(method: string, params: Record<string, unknown>, caller?: AbortSignal): Promise<JsonValue> {
    const id = this.nextId++;
    const { signal, release } = linkSignals(this.timeoutMs, caller);
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchImpl(`${this.apiBase.replace(/\/+$/, '')}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        signal,
      });
    } finally {
      release();
    }
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`PkgSeek API returned ${response.status}: ${body.slice(0, MAX_ERROR_EXCERPT)}`);
    }
    let message: { error?: { message?: string }; result?: JsonValue };
    try {
      message = JSON.parse(body);
    } catch {
      throw new Error(`PkgSeek API returned invalid JSON: ${body.slice(0, MAX_ERROR_EXCERPT)}`);
    }
    if (message.error) {
      throw new Error(`PkgSeek MCP ${method} failed: ${message.error.message ?? 'unknown error'}`);
    }
    return message.result ?? null;
  }
}
