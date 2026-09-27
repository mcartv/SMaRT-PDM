import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(testDirectory, '..', 'src', 'pages', 'ScholarshipOpenings.jsx'),
  'utf8',
);

test('opening cards use maintainable branding data with a safe fallback', () => {
  assert.match(source, /opening\.admin_logo_url/);
  assert.match(source, /getBenefactorInitials/);
  assert.match(source, /benefactorLogoUrl \?/);
  assert.doesNotMatch(source, /BENEFACTOR_VISUALS/);
  assert.doesNotMatch(source, /BC PACKAGING\.png/);
});

test('opening card artwork follows portal theme tokens instead of a fixed admin palette', () => {
  assert.match(source, /var\(--portal-base\)/);
  assert.match(source, /var\(--portal-accent\)/);
  assert.match(source, /color-mix\(in srgb, var\(--portal-base\)/);
  assert.match(source, /color-mix\(in srgb, var\(--portal-accent\)/);
});
