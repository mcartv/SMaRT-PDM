const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..', '..');

const applicationSource = fs.readFileSync(
  path.join(backendRoot, 'services', 'applicationService.js'),
  'utf8'
);
const readinessSource = fs.readFileSync(
  path.join(backendRoot, 'services', 'readinessQueueService.js'),
  'utf8'
);
const documentVerificationSource = fs.readFileSync(
  path.join(repoRoot, 'admin', 'frontend', 'src', 'pages', 'DocumentVerification.jsx'),
  'utf8'
);

function compact(value) {
  return String(value || '').replace(/\s+/g, ' ');
}

const application = compact(applicationSource);
const readiness = compact(readinessSource);
const documentVerification = compact(documentVerificationSource);

test('Document Verification uses Save Requirements Review instead of scholar approval', () => {
  assert.match(documentVerification, /Save Requirements Review/i);
  assert.doesNotMatch(documentVerification, /Scholar Approval/i);
  assert.match(documentVerification, /Request Re-upload/i);
  assert.match(documentVerification, /Reject Application/i);
});

test('successful requirement review updates application eligibility state', () => {
  assert.match(
    application,
    /derivedVerificationStatus\s*===\s*'verified'/i
  );
  assert.match(
    application,
    /document_status\s*=\s*['"]Documents Ready['"]|document_status\s*:\s*'Documents Ready'/i
  );
  assert.match(
    application,
    /requirements_verified_at\s*:\s*reviewedAt/i
  );
});

test('eligible application enters the FCFS selection flow', () => {
  assert.match(
    application,
    /readinessQueueService\.syncApplicationReadiness\(applicationId\)/i
  );
  assert.match(
    readiness,
    /verification_status[\s\S]*?'verified'/i
  );
  assert.match(
    readiness,
    /overall_status[\s\S]*?'completed'/i
  );
  assert.match(readiness, /queue_position/i);
});

test('UI immediately provides confirmation feedback after save', () => {
  assert.match(documentVerification, /verificationFeedback/i);
  assert.match(documentVerification, /Verification saved/i);
  assert.match(
    documentVerification,
    /navigate\(\s*['"]\/admin\/applications['"]/i
  );
});

test('UI prevents double-processing while saving or after finalization', () => {
  assert.match(documentVerification, /submitting/i);
  assert.match(documentVerification, /requirementsReviewAlreadySaved/i);
  assert.match(
    documentVerification,
    /disabled=\{[\s\S]*?(submitting|saveDisabled)[\s\S]*?\}/i
  );
});

test('backend review rows are idempotent per application and document key', () => {
  assert.match(
    application,
    /\.upsert\(reviewRows,\s*\{\s*onConflict:\s*['"]application_id,document_key['"]/i
  );
});

test('missing or still-pending requirements cannot be finalized', () => {
  assert.match(
    application,
    /missingReviewKeys\.length\s*>\s*0/i
  );
  assert.match(
    application,
    /incompleteReviews\.length\s*>\s*0/i
  );
  assert.match(
    application,
    /Review every required item before saving the requirements review\./i
  );
});

test('minor rejected/correctable document path keeps application active for re-upload', () => {
  assert.match(
    application,
    /derivedVerificationStatus\s*===\s*'requires_reupload'/i
  );
  assert.match(
    application,
    /application_status\s*=\s*['"]Requires Reupload['"]|application_status\s*:\s*'Requires Reupload'/i
  );
  assert.match(
    application,
    /is_disqualified\s*=\s*false|is_disqualified\s*:\s*false/i
  );
});

test('major document violation rejects and disqualifies the application', () => {
  assert.match(
    application,
    /reviewStatus\s*===\s*'rejected'[\s\S]*?issueSeverity\s*===\s*'major'/i
  );
  assert.match(
    application,
    /application_status\s*=\s*['"]Rejected['"]|application_status\s*:\s*'Rejected'/i
  );
  assert.match(
    application,
    /is_disqualified\s*=\s*true|is_disqualified\s*:\s*true/i
  );
});

test('approved requirements path marks requirements verified but does not auto-activate scholar', () => {
  assert.match(
    application,
    /selection_status\s*:\s*'Requirements Verified'/i
  );
  assert.match(
    application,
    /activation_status\s*:\s*'Not Activated'/i
  );
  assert.doesNotMatch(
    documentVerification,
    /\/approve['"`]/i
  );
});

test('requirements review feedback distinguishes verified, re-upload, and rejection outcomes', () => {
  assert.match(documentVerification, /requires_reupload/i);
  assert.match(documentVerification, /Application rejected/i);
  assert.match(documentVerification, /Re-upload requested/i);
  assert.match(documentVerification, /Verification saved/i);
});
