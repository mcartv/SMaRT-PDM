const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendRoot, '..', '..');

const reportService = fs.readFileSync(
  path.join(backendRoot, 'services', 'reportService.js'),
  'utf8'
);
const reportController = fs.readFileSync(
  path.join(backendRoot, 'controllers', 'reportController.js'),
  'utf8'
);
const reportPage = fs.readFileSync(
  path.join(projectRoot, 'admin', 'frontend', 'src', 'pages', 'ReportGeneration.jsx'),
  'utf8'
);

test('payout proof upload report is exposed to administrators', () => {
  assert.match(reportService, /id:\s*'payout_proofs'/);
  assert.match(reportController, /'payout_proofs'/);
  assert.match(reportPage, /ids:\s*\[[^\]]*'payout_proofs'/s);
});

test('payout proof report includes upload and review audit details', () => {
  assert.match(reportService, /SMART_PDM_PAYOUT_PROOF_UPLOAD_REPORT_V1/);
  assert.match(reportService, /async function getPayoutProofRows/);
  assert.match(reportService, /FROM payout_proofs pp/);
  assert.match(reportService, /pp\.submitted_at/);
  assert.match(reportService, /pp\.proof_status/);
  assert.match(reportService, /pp\.reviewed_at/);
  assert.match(reportService, /reviewer_profile/);
  assert.match(reportService, /payout_proof_upload_report\.xlsx/);
});

test('payout proof report supports proof status and upload date filtering', () => {
  assert.match(reportService, /appendTextEqualityFilter\(where, params, 'pp\.proof_status', reviewResult\)/);
  assert.match(reportService, /appendDateRange\(where, params, 'pp\.submitted_at', dateFrom, dateTo\)/);
  assert.match(reportPage, /payout_proofs:\s*\[[^\]]*'result'[^\]]*'date'/s);
  assert.match(reportPage, /All Proof Statuses/);
  assert.match(reportPage, /Proof Status/);
});

test('historical proof uploads remain reportable after payout archival', () => {
  const reportBlock = reportService.match(
    /SMART_PDM_PAYOUT_PROOF_UPLOAD_REPORT_V1[\s\S]*?async function getRenewalRows/
  )?.[0] || '';

  assert.doesNotMatch(reportBlock, /pb\.is_archived/);
  assert.match(reportBlock, /COALESCE\(st\.course_id, smr\.course_id\)/);
});
