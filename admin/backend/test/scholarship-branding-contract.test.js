const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('scholarship branding migration separates admin and landing visuals', () => {
  const migration = read('supabase/migrations/20260927000400_add_scholarship_branding.sql');
  assert.match(migration, /alter table public\.benefactors/i);
  assert.match(migration, /admin_logo_url text/i);
  assert.match(migration, /landing_image_url text/i);
  assert.match(migration, /alter table public\.scholarship_program/i);
});

test('opening service resolves program logo before benefactor logo', () => {
  const service = read('admin/backend/services/programOpeningService.js');
  assert.match(service, /admin_logo_url: program\?\.admin_logo_url \|\| benefactor\?\.admin_logo_url \|\| null/);
});

test('maintenance exposes editable admin branding and separate landing imagery', () => {
  const panel = read('admin/frontend/src/pages/maintenance/ScholarshipProgramsPanel.jsx');
  assert.match(panel, /Benefactor Branding/);
  assert.match(panel, /Admin Logo/);
  assert.match(panel, /Landing Image/);
  assert.match(panel, /Admin Logo Override/);
  assert.match(panel, /inherit the benefactor logo/i);
});
