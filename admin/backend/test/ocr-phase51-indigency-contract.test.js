const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const indigency = fs.readFileSync(require.resolve('../services/indigencyOcrV2Service'), 'utf8');
const controller = fs.readFileSync(require.resolve('../controllers/piIotOcrController'), 'utf8');
const routes = fs.readFileSync(require.resolve('../routes/piIotOcrRoutes'), 'utf8');
const systemPanel = fs.readFileSync(require.resolve('../../frontend/src/pages/maintenance/SystemPanel.jsx'), 'utf8');

test('Indigency V2 emits safe lifecycle checkpoints and preserves review fields', () => {
  for (const checkpoint of ['INDIGENCY_V2_PROVIDER_STARTED', 'INDIGENCY_V2_PROVIDER_COMPLETED', 'INDIGENCY_V2_PROVIDER_FAILED', 'INDIGENCY_V2_CANDIDATE_PERSISTED', 'INDIGENCY_V2_REVIEW_REQUIRED']) {
    assert.match(indigency, new RegExp(checkpoint));
  }
  assert.match(indigency, /certificate_subject_name/);
  assert.match(indigency, /residency_address/);
  assert.match(indigency, /status: 'review_required'/);
  assert.match(indigency, /scheduleProcessingRetry/);
});

test('V2 capture routes use neutral controller names while preserving URLs', () => {
  assert.match(controller, /authorizeV2CaptureUploads/);
  assert.match(controller, /completeV2CaptureUploads/);
  assert.doesNotMatch(routes, /authorizeBirthV2Uploads/);
  assert.doesNotMatch(routes, /completeBirthV2Uploads/);
  assert.match(routes, /capture-artifacts\/authorize/);
  assert.match(routes, /capture-artifacts\/complete/);
});

test('System Panel does not expose provider or AI terminology', () => {
  assert.match(systemPanel, /Local OCR/);
  assert.match(systemPanel, /Enhanced OCR/);
  assert.doesNotMatch(systemPanel, /\bGemini\b|\bAI\b|Artificial Intelligence/i);
});
