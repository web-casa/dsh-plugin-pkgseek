import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildTool, mapParameters, selectTools, TOOL_PREFIX } from '../lib/adapter.js';
import { McpHttpClient } from '../lib/mcp-client.js';

const snapshot = JSON.parse(readFileSync(new URL('../tools.snapshot.json', import.meta.url), 'utf8'));

test('mapParameters maps scalar types, enums, defaults and required', () => {
  const parameters = mapParameters('demo', {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search text' },
      severity: { type: 'string', enum: ['low', 'high'] },
      limit: { type: 'integer', default: 20 },
      verbose: { type: 'boolean' },
      packages: { type: 'array', items: { type: 'string' } },
    },
    required: ['query'],
  });
  assert.deepEqual(parameters.query, { type: 'string', description: 'Search text', required: true });
  assert.deepEqual(parameters.severity, { type: 'string', enum: ['low', 'high'] });
  assert.deepEqual(parameters.limit, { type: 'integer', default: 20 });
  assert.deepEqual(parameters.verbose, { type: 'boolean' });
  assert.deepEqual(parameters.packages, { type: 'array', items: { type: 'string' } });
});

test('mapParameters fails closed on unmappable schemas', () => {
  assert.throws(() => mapParameters('demo', { type: 'object', properties: { x: { type: 'wibble' } } }), /unsupported schema type/);
  assert.throws(
    () => mapParameters('demo', { type: 'object', properties: { x: { type: 'string', enum: ['a', 1] } } }),
    /non-string enum/,
  );
  assert.throws(() => mapParameters('demo', { type: 'string' }), /root must be an object/);
});

test('selectTools filters by unprefixed allowlist', () => {
  const tools = [{ name: 'a' }, { name: 'b' }];
  assert.equal(selectTools(tools, []).length, 2);
  assert.deepEqual(selectTools(tools, ['b']).map((tool) => tool.name), ['b']);
});

test('buildTool prefixes the name, forwards the unprefixed call and renders text', async () => {
  const seen = [];
  const client = new McpHttpClient('https://api.example.com', 5000, async (url, init) => {
    seen.push(JSON.parse(init.body));
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: { structuredContent: { ok: true } } }),
    };
  });
  const tool = buildTool({ name: 'get_package', description: 'Get one package', inputSchema: { type: 'object', properties: {} } }, client, 5000);
  assert.equal(tool.name, `${TOOL_PREFIX}get_package`);
  assert.equal(tool.description, 'Get one package');

  const exec = { signal: new AbortController().signal };
  const value = await tool.execute({ name: 'nginx' }, exec);
  assert.deepEqual(value, { ok: true });
  assert.equal(seen[0].params.name, 'get_package');

  const rendered = tool.output.render({}, value);
  assert.equal(rendered[0].type, 'text');
  assert.match(rendered[0].text, /"ok": true/);
});

test('every tool in the bundled snapshot maps to a native definition', () => {
  assert.equal(snapshot.length, 22);
  const client = new McpHttpClient('https://api.example.com', 5000, async () => {
    throw new Error('no network in this test');
  });
  for (const tool of snapshot) {
    const definition = buildTool(tool, client, 5000);
    assert.equal(definition.name, `${TOOL_PREFIX}${tool.name}`);
    assert.ok(definition.description.length > 0, `${tool.name} has a description`);
  }
});
