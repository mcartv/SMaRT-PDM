import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(testDirectory, '..', 'src');
const read = (relativePath) => fs.readFileSync(path.join(srcRoot, relativePath), 'utf8');

test('maintenance manages admin and landing visuals separately', () => {
  const source = read('pages/maintenance/ScholarshipProgramsPanel.jsx');
  assert.match(source, /Benefactor Branding/);
  assert.match(source, /Admin Logo/);
  assert.match(source, /Landing Image/);
  assert.match(source, /Admin Logo Override/);
  assert.match(source, /inherit the benefactor logo/i);
});

test('opening registry uses maintainable admin logo data', () => {
  const source = read('pages/ScholarshipOpenings.jsx');
  assert.match(source, /opening\.admin_logo_url/);
  assert.doesNotMatch(source, /benefactorLogos|BENEFACTOR_VISUALS/);
});

test('landing uses only the separate public landing image field', () => {
  const source = read('pages/SmartPDMLanding.jsx');
  assert.match(source, /benefactor\.landing_image_url/);
  assert.doesNotMatch(source, /benefactor\.admin_logo_url/);
  assert.doesNotMatch(source, /benefactorLogos/);
});
