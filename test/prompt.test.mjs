import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildGuidance, GUIDANCE_RULES } from '../lib/prompt.js';

const snapshot = JSON.parse(readFileSync(new URL('../tools.snapshot.json', import.meta.url), 'utf8'));

test('full guidance names every rule group', () => {
  const text = buildGuidance();
  for (const rule of GUIDANCE_RULES) {
    assert.match(text, new RegExp(`pkgseek_${rule.tools[0]}`));
  }
});

test('restricted guidance keeps only the enabled tools of each rule', () => {
  const text = buildGuidance(new Set(['resolve_install', 'get_vulnerability']));
  assert.match(text, /pkgseek_resolve_install/);
  assert.match(text, /pkgseek_get_vulnerability/);
  assert.doesNotMatch(text, /pkgseek_compare_distros/);
  assert.doesNotMatch(text, /pkgseek_diagnose_linux_error/);
});

test('every snapshot tool is covered by a guidance rule', () => {
  const covered = new Set(GUIDANCE_RULES.flatMap((rule) => rule.tools));
  for (const tool of snapshot) {
    assert.ok(covered.has(tool.name), `${tool.name} has a guidance rule`);
  }
  assert.equal(covered.size, snapshot.length);
});
