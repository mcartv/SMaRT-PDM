const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const payoutPagePath = path.join(
  repoRoot,
  'frontend',
  'src',
  'pages',
  'PayoutManagement.jsx'
);
const reportPagePath = path.join(
  repoRoot,
  'frontend',
  'src',
  'pages',
  'ReportGeneration.jsx'
);

const payoutSource = fs.readFileSync(payoutPagePath, 'utf8');
const reportSource = fs.readFileSync(reportPagePath, 'utf8');

test('Payout Management does not render or fetch the scholar-count-by-benefactor report graph', () => {
  assert.doesNotMatch(payoutSource, /Scholar Count by Benefactor/);
  assert.doesNotMatch(payoutSource, /BenefactorScholarGraph/);
  assert.doesNotMatch(payoutSource, /scholars_by_benefactor/);
  assert.doesNotMatch(payoutSource, /loadBenefactorScholarCounts/);
});

test('scholars-by-benefactor remains available in Report Generation', () => {
  assert.match(reportSource, /scholars_by_benefactor/);
});
