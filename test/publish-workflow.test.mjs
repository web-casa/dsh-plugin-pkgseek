import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/publish.yml', import.meta.url), 'utf8');

test('the npm release workflow is manually gated and cannot publish from pushes or tags', () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|schedule):/m);
  assert.match(
    workflow,
    /if: github\.ref == 'refs\/heads\/main' && inputs\.confirmation == 'PUBLISH'/,
  );
  assert.match(workflow, /description: Exact unpublished package version to release/);
});

test('the npm release workflow uses the least required OIDC permissions and no npm token', () => {
  assert.match(workflow, /^permissions:\n  contents: read\n  id-token: write$/m);
  assert.match(workflow, /node-version: 24\.18\.0/);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm pack --pack-destination .* --ignore-scripts --json/);
  assert.match(workflow, /npm publish "\$TARBALL" --access public --tag latest/);
  assert.doesNotMatch(workflow, /NPM_TOKEN|NODE_AUTH_TOKEN|--provenance=false/);
});
