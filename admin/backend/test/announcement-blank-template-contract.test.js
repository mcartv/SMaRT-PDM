const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(
  path.join(repoRoot, 'admin/frontend/src/pages/AnnouncementsManagement.jsx'),
  'utf8'
);

test('Blank announcement template acts as a clear-form action', () => {
  assert.match(source, /selectedTemplate === 'blank'/);
  assert.match(source, /setTitle\(template\.title\)/);
  assert.match(source, /setContent\(template\.content\)/);
  assert.match(source, /setAudience\(template\.audience\)/);
  assert.match(source, /setIsRoVoluntary\(template\.isRoVoluntary\)/);
  assert.match(source, /setSchedDate\(''\)/);
});

test('template confirmation modal is mounted and Blank has clear-specific copy', () => {
  assert.match(source, /<ConfirmTemplateApplyModal/);
  assert.match(source, /open=\{showTemplateConfirmModal\}/);
  assert.match(source, /onConfirm=\{applyTemplateNow\}/);
  assert.match(source, /selectedTemplate=\{selectedTemplate\}/);
  assert.match(source, /Clear announcement\?/);
  assert.match(source, /Clear Form/);
});

test('Blank clear confirmation also detects non-default audience schedule and RO values', () => {
  assert.match(source, /audience !== 'all'/);
  assert.match(source, /schedDate !== ''/);
  assert.match(source, /isRoVoluntary !== 'false'/);
});
