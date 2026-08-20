import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8');

test('published manifest carries the strict Cordis v4 DSH artifact declarations', () => {
  assert.equal(packageJson.dsh?.bundle?.patch, './cordis.patch.yml');
  assert.deepEqual(packageJson.dsh?.platforms, ['web', 'desktop']);
  assert.equal(packageJson.dsh?.engines?.dsh, '>=0.1.0-rc.7 <0.2.0');
  assert.match(packageJson.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
});

test('the declared bundle patch installs the package under its reviewed plugin id', () => {
  assert.match(patch, /^- insert:\n    - id: pkgseek\n      name: dsh-plugin-pkgseek\n?$/);
});
