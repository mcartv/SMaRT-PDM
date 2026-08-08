const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('theme swatch keys include index and preset options are deduplicated', () => {
  const source = read('frontend/src/pages/maintenance/ThemePanel.jsx');
  assert.match(source, /swatches\.map\(\(color, swatchIndex\)/);
  assert.match(source, /\$\{portalKey\}-\$\{preset\.key\}-\$\{swatchIndex\}/);
  assert.match(source, /const seen = new Set\(\)/);
});

test('current password verification route is registered for staff', () => {
  const source = read('backend/routes/accountRoutes.js');
  assert.match(source, /router\.post\('\/me\/password\/verify'/);
  assert.match(source, /verifyCurrentStaffPassword/);
});
