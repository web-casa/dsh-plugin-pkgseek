import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apply, Config, inject, name } from '../lib/index.js';
import { PROMPT_SECTION_NAME } from '../lib/prompt.js';

const baseConfig = {
  apiBase: 'https://api.example.com',
  timeoutMs: 5000,
  promptGuidance: true,
  refreshTools: false, // offline tests register from the bundled snapshot
  enabledTools: [],
};

function fakeCtx({ systemPrompt } = {}) {
  const registered = [];
  const sections = [];
  return {
    registered,
    sections,
    ctx: {
      tools: { register: (definition) => registered.push(definition) },
      get: (key) => (key === 'systemPrompt' ? systemPrompt ?? { section: (s) => sections.push(s) } : undefined),
    },
  };
}

test('plugin metadata declares the tools dependency', () => {
  assert.equal(name, 'pkgseek');
  assert.deepEqual(inject, ['tools']);
  assert.equal(typeof Config, 'function'); // schemastery schema is callable
});

test('apply registers all snapshot tools with the pkgseek_ prefix', async () => {
  const { ctx, registered } = fakeCtx();
  await apply(ctx, baseConfig);
  assert.equal(registered.length, 22);
  for (const tool of registered) {
    assert.match(tool.name, /^pkgseek_[a-z_]+$/);
  }
  const names = registered.map((tool) => tool.name);
  assert.ok(names.includes('pkgseek_resolve_install'));
  assert.ok(names.includes('pkgseek_diagnose_linux_error'));
  assert.ok(names.includes('pkgseek_get_vulnerability'));
});

test('apply registers the prompt guidance section', async () => {
  const { ctx, sections } = fakeCtx();
  await apply(ctx, baseConfig);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].name, PROMPT_SECTION_NAME);
  assert.ok(sections[0].order >= 100 && sections[0].order < 200);
  assert.match(sections[0].text, /pkgseek_/);
});

test('promptGuidance: false skips the section', async () => {
  const { ctx, sections } = fakeCtx();
  await apply(ctx, { ...baseConfig, promptGuidance: false });
  assert.equal(sections.length, 0);
});

test('missing systemPrompt service does not fail loading', async () => {
  const { ctx, registered, sections } = fakeCtx({ systemPrompt: undefined });
  ctx.get = () => undefined;
  await apply(ctx, baseConfig);
  assert.equal(registered.length, 22);
  assert.equal(sections.length, 0);
});

test('enabledTools allowlist limits registration', async () => {
  const { ctx, registered } = fakeCtx();
  await apply(ctx, { ...baseConfig, promptGuidance: false, enabledTools: ['resolve_install'] });
  assert.deepEqual(registered.map((tool) => tool.name), ['pkgseek_resolve_install']);
});

test('guidance only names tools that were actually registered', async () => {
  const { ctx, registered, sections } = fakeCtx();
  await apply(ctx, { ...baseConfig, enabledTools: ['resolve_install'] });
  assert.equal(registered.length, 1);
  assert.equal(sections.length, 1);
  assert.match(sections[0].text, /pkgseek_resolve_install/);
  assert.doesNotMatch(sections[0].text, /pkgseek_diagnose_linux_error/);
  assert.doesNotMatch(sections[0].text, /pkgseek_get_vulnerability/);
});

test('an allowlist matching nothing registers no tools and no guidance', async () => {
  const { ctx, registered, sections } = fakeCtx();
  await apply(ctx, { ...baseConfig, enabledTools: ['no_such_tool'] });
  assert.equal(registered.length, 0);
  assert.equal(sections.length, 0);
});
