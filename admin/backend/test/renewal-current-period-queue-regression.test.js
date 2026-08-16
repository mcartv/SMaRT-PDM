const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const controllerSource = fs.readFileSync(
  path.resolve(__dirname, '../controllers/renewalController.js'),
  'utf8'
);

const serviceSource = fs.readFileSync(
  path.resolve(__dirname, '../services/renewalService.js'),
  'utf8'
);

test('renewal queue only returns the active academic period', () => {
  assert.match(
    controllerSource,
    /\.filter\(\(renewal\)\s*=>\s*renewal\?\.is_current_period\s*===\s*true\)/
  );
});

test('renewal service still exposes current-versus-historical metadata', () => {
  assert.match(serviceSource, /is_current_period:\s*period\.is_active\s*===\s*true/);
  assert.match(serviceSource, /period_status:\s*period\.is_active\s*===\s*true\s*\?\s*'Current'\s*:\s*'Historical'/);
});

test('historical renewal details remain read-only instead of being deleted', () => {
  assert.match(serviceSource, /historical semester and is read-only/i);
});
