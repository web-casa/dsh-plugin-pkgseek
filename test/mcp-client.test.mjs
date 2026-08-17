import assert from 'node:assert/strict';
import { test } from 'node:test';
import { McpHttpClient } from '../lib/mcp-client.js';

function mockFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return handler(JSON.parse(init.body), init);
  };
  return { calls, fetchImpl };
}

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

test('callTool returns structuredContent', async () => {
  const { calls, fetchImpl } = mockFetch((body) =>
    jsonResponse(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { structuredContent: { name: 'nginx' } } })),
  );
  const client = new McpHttpClient('https://api.example.com/', 5000, fetchImpl);
  const value = await client.callTool('get_package', { name: 'nginx', distro: 'debian' });
  assert.deepEqual(value, { name: 'nginx' });
  assert.equal(calls[0].url, 'https://api.example.com/mcp');
  assert.equal(calls[0].init.method, 'POST');
  const request = JSON.parse(calls[0].init.body);
  assert.equal(request.method, 'tools/call');
  assert.equal(request.params.name, 'get_package');
  assert.deepEqual(request.params.arguments, { name: 'nginx', distro: 'debian' });
});

test('callTool falls back to text content', async () => {
  const { fetchImpl } = mockFetch((body) =>
    jsonResponse(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: '{"a":1}' }] } })),
  );
  const client = new McpHttpClient('https://api.example.com', 5000, fetchImpl);
  assert.equal(await client.callTool('x', {}), '{"a":1}');
});

test('callTool throws on isError with the tool message', async () => {
  const { fetchImpl } = mockFetch((body) =>
    jsonResponse(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { isError: true, content: [{ type: 'text', text: 'unknown tool' }] } })),
  );
  const client = new McpHttpClient('https://api.example.com', 5000, fetchImpl);
  await assert.rejects(client.callTool('x', {}), /unknown tool/);
});

test('http failure includes status and excerpt', async () => {
  const { fetchImpl } = mockFetch(() => jsonResponse('x'.repeat(600), 500));
  const client = new McpHttpClient('https://api.example.com', 5000, fetchImpl);
  await assert.rejects(client.callTool('x', {}), (error) => {
    assert.match(error.message, /returned 500/);
    assert.ok(error.message.length < 560, 'excerpt is bounded');
    return true;
  });
});

test('json-rpc error and invalid json both throw', async () => {
  const rpcError = new McpHttpClient('https://api.example.com', 5000, mockFetch((body) =>
    jsonResponse(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'method not found' } })),
  ).fetchImpl);
  await assert.rejects(rpcError.callTool('x', {}), /method not found/);

  const badJson = new McpHttpClient('https://api.example.com', 5000, mockFetch(() => jsonResponse('not json')).fetchImpl);
  await assert.rejects(badJson.callTool('x', {}), /invalid JSON/);
});

test('listTools validates the tools array', async () => {
  const good = new McpHttpClient('https://api.example.com', 5000, mockFetch((body) =>
    jsonResponse(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { tools: [{ name: 'a', inputSchema: { type: 'object' } }] } })),
  ).fetchImpl);
  assert.equal((await good.listTools())[0].name, 'a');

  const bad = new McpHttpClient('https://api.example.com', 5000, mockFetch((body) =>
    jsonResponse(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} })),
  ).fetchImpl);
  await assert.rejects(bad.listTools(), /no tools array/);
});

test('a pre-aborted caller signal aborts the request signal', async () => {
  const { calls, fetchImpl } = mockFetch((body) =>
    jsonResponse(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} })),
  );
  const client = new McpHttpClient('https://api.example.com', 5000, fetchImpl);
  const caller = new AbortController();
  caller.abort(new Error('cancelled'));
  await client.callTool('x', {}, caller.signal);
  assert.equal(calls[0].init.signal.aborted, true);
});
