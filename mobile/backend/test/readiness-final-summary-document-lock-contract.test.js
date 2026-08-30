'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');

function source(rel) {
  return fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\r\n/g, '\n');
}

test('readiness final summary and verified document lock contract', () => {
  const admin = source(
    'admin/frontend/src/pages/ApplicationReview.jsx'
  );
  const backend = source(
    'mobile/backend/src/services/applicationService.js'
  );
  const model = source(
    'mobile/frontend/lib/shared/models/applicant_documents_package.dart'
  );
  const screen = source(
    'mobile/frontend/lib/features/applicant/presentation/screens/applicant_documents_screen.dart'
  );

  assert.ok(admin.includes('function ReadinessCompletionSummary'));
  assert.ok(admin.includes('Final Readiness Summary'));
  assert.ok(admin.includes('View Summary'));
  assert.ok(
    admin.includes(
      'Admin verification completed'
    )
  );

  const readinessBlockStart = admin.indexOf(
    'function ReadinessOpeningCards'
  );
  const registryBlockStart = admin.indexOf(
    'function RegistryTable'
  );
  const readinessBlock = admin.slice(
    readinessBlockStart,
    registryBlockStart
  );

  assert.equal(
    readinessBlock.includes(
      '/admin/applications/${row.application_id}/documents'
    ),
    false
  );

  assert.ok(
    backend.includes(
      'SMART_PDM_VERIFIED_DOCUMENT_UPLOAD_LOCK_V1'
    )
  );
  assert.ok(
    backend.includes("verificationStatus === 'verified'")
  );
  assert.ok(
    backend.includes('Boolean(application.requirements_verified_at)')
  );
  assert.ok(backend.includes('uploads_locked: uploadLock.locked'));
  assert.ok(
    backend.includes(
      'const uploadLock = getApplicationDocumentUploadLock(application);'
    )
  );

  assert.ok(model.includes('final bool uploadsLocked;'));
  assert.ok(model.includes('final String? uploadLockReason;'));
  assert.ok(
    model.includes("verificationStatus == 'verified'")
  );

  assert.ok(screen.includes('package?.uploadsLocked == true'));
  assert.ok(screen.includes('Verified — Locked'));
  assert.ok(screen.includes('Icons.lock_outline_rounded'));
  assert.ok(screen.includes('final VoidCallback? onUpload;'));
});
