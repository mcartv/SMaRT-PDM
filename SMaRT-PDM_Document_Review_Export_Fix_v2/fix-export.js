import fs from 'node:fs';
import path from 'node:path';

const SERVICE_FUNCTION = "\nexports.saveApplicationDocumentReview = async ({\n    applicationId,\n    documentKey,\n    status,\n    issueSeverity = null,\n    reasonCode = null,\n    comment = '',\n    user = null,\n}) => {\n    if (!applicationId) {\n        throw buildHttpError(400, 'Application ID is required.');\n    }\n\n    const normalizedDocumentKey = normalizeDocumentType(documentKey);\n\n    if (\n        !normalizedDocumentKey ||\n        !REVIEWABLE_DOCUMENT_KEYS.has(normalizedDocumentKey)\n    ) {\n        throw buildHttpError(\n            400,\n            `Unsupported review document: ${documentKey || 'unknown'}`\n        );\n    }\n\n    const reviewStatus = normalizeDocumentReviewStatus(status);\n\n    if (!['verified', 'reupload_required', 'rejected'].includes(reviewStatus)) {\n        throw buildHttpError(\n            400,\n            'Document review status must be verified, reupload_required, or rejected.'\n        );\n    }\n\n    const normalizedIssueSeverity = normalizeIssueSeverity(\n        issueSeverity,\n        reviewStatus\n    );\n    const normalizedReasonCode = normalizeReasonCode(reasonCode);\n\n    if (reviewStatus === 'rejected' && normalizedIssueSeverity !== 'major') {\n        throw buildHttpError(\n            400,\n            'A major issue is required before rejecting this document.'\n        );\n    }\n\n    const { data: applicationRecord, error: applicationError } = await supabase\n        .from('applications')\n        .select('application_id, verification_status')\n        .eq('application_id', applicationId)\n        .maybeSingle();\n\n    if (applicationError) {\n        throw new Error(applicationError.message);\n    }\n\n    if (!applicationRecord) {\n        throw buildHttpError(404, 'Application not found.');\n    }\n\n    const persistedVerificationStatus = normalizeLookupValue(\n        applicationRecord.verification_status\n    ).replace(/\\s+/g, '_');\n\n    if (\n        ['verified', 'rejected', 'requires_reupload'].includes(\n            persistedVerificationStatus\n        )\n    ) {\n        throw buildHttpError(\n            409,\n            'The requirements review has already been finalized.'\n        );\n    }\n\n    let reviewedBy = user?.admin_id || null;\n\n    if (!reviewedBy && (user?.user_id || user?.userId)) {\n        const authUserId = user.user_id || user.userId;\n\n        const { data: adminProfile, error: adminProfileError } = await supabase\n            .from('admin_profiles')\n            .select('admin_id')\n            .eq('user_id', authUserId)\n            .maybeSingle();\n\n        if (adminProfileError) {\n            throw new Error(adminProfileError.message);\n        }\n\n        reviewedBy = adminProfile?.admin_id || null;\n    }\n\n    const documentName =\n        DOCUMENT_TYPE_TO_NAME[normalizedDocumentKey] ||\n        normalizedDocumentKey;\n    const reviewedAt = new Date().toISOString();\n    let submittedDocument = null;\n\n    if (normalizedDocumentKey !== 'application_form') {\n        const { data: documentRows, error: documentError } = await supabase\n            .from('application_documents')\n            .select(\n                'document_id, document_type, is_submitted, file_path, file_url, current_version_id'\n            )\n            .eq('application_id', applicationId);\n\n        if (documentError) {\n            throw new Error(documentError.message);\n        }\n\n        submittedDocument = (documentRows || []).find(\n            (document) =>\n                normalizeDocumentType(document.document_type) ===\n                normalizedDocumentKey\n        ) || null;\n\n        const hasPersistedUpload =\n            submittedDocument?.is_submitted === true &&\n            Boolean(\n                String(submittedDocument?.file_path || '').trim() ||\n                String(submittedDocument?.file_url || '').trim() ||\n                submittedDocument?.current_version_id\n            );\n\n        if (!hasPersistedUpload) {\n            throw buildHttpError(\n                409,\n                'Upload this document before reviewing it.'\n            );\n        }\n    }\n\n    const reviewRow = {\n        application_id: applicationId,\n        document_key: normalizedDocumentKey,\n        document_name: documentName,\n        review_status: reviewStatus,\n        issue_severity: normalizedIssueSeverity,\n        reason_code: normalizedReasonCode,\n        admin_comment: String(comment || '').trim(),\n        reviewed_by: reviewedBy,\n        reviewed_at: reviewedAt,\n        updated_at: reviewedAt,\n    };\n\n    const { data: savedReview, error: reviewError } = await supabase\n        .from('application_document_reviews')\n        .upsert(reviewRow, {\n            onConflict: 'application_id,document_key',\n        })\n        .select()\n        .single();\n\n    if (reviewError) {\n        console.error('SUPABASE DOCUMENT REVIEW UPSERT ERROR:', reviewError);\n        throw new Error(reviewError.message);\n    }\n\n    if (normalizedDocumentKey !== 'application_form') {\n        const { error: documentUpdateError } = await supabase\n            .from('application_documents')\n            .update({\n                review_status: reviewStatus,\n                notes: String(comment || '').trim() || null,\n                remarks: String(comment || '').trim() || null,\n                reviewed_by: reviewedBy,\n                reviewed_at: reviewedAt,\n                updated_at: reviewedAt,\n            })\n            .eq('application_id', applicationId)\n            .eq('document_type', documentName);\n\n        if (documentUpdateError) {\n            console.error(\n                'SUPABASE DOCUMENT REVIEW METADATA UPDATE ERROR:',\n                documentUpdateError\n            );\n            throw new Error(documentUpdateError.message);\n        }\n\n        documentViewMetadataCache.delete(\n            `${applicationId}:${normalizedDocumentKey}`\n        );\n    }\n\n    return {\n        application_id: applicationId,\n        document_id: submittedDocument?.document_id || null,\n        document_key: normalizedDocumentKey,\n        document_name: documentName,\n        review_status: reviewStatus,\n        issue_severity: normalizedIssueSeverity,\n        reason_code: normalizedReasonCode,\n        admin_comment: String(comment || '').trim(),\n        reviewed_at: savedReview?.reviewed_at || reviewedAt,\n    };\n};\n\n";

function fail(message) {
  throw new Error(`[SMaRT-PDM v2] ${message}`);
}

function findRepoRoot(startDir) {
  const candidates = [
    startDir,
    path.resolve(startDir, '..'),
    path.resolve(startDir, '..', '..'),
  ];

  for (const candidate of candidates) {
    const servicePath = path.join(
      candidate,
      'admin',
      'backend',
      'services',
      'applicationService.js'
    );
    if (fs.existsSync(servicePath)) return candidate;
  }

  fail('Could not locate SMaRT-PDM repository root.');
}

function readNormalized(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return {
    text: raw.replace(/\r\n/g, '\n'),
    eol: raw.includes('\r\n') ? '\r\n' : '\n',
  };
}

function writePreservingEol(file, text, eol) {
  const normalized = String(text).replace(/\r\n/g, '\n');
  fs.writeFileSync(
    file,
    eol === '\r\n' ? normalized.replace(/\n/g, '\r\n') : normalized,
    'utf8'
  );
}

const repoRoot = findRepoRoot(process.cwd());
const servicePath = path.join(
  repoRoot,
  'admin',
  'backend',
  'services',
  'applicationService.js'
);

const file = readNormalized(servicePath);
let service = file.text;
let changed = false;

// 1. Ensure the implementation exists.
if (!service.includes('exports.saveApplicationDocumentReview = async')) {
  const functionAnchor = 'exports.saveApplicationVerification = async';

  const functionIndex = service.indexOf(functionAnchor);
  if (functionIndex < 0) {
    fail('Could not find saveApplicationVerification export.');
  }

  service =
    service.slice(0, functionIndex) +
    SERVICE_FUNCTION +
    service.slice(functionIndex);

  changed = true;
  console.log('Added saveApplicationDocumentReview implementation.');
} else {
  console.log('saveApplicationDocumentReview implementation already exists.');
}

// 2. CRITICAL FIX:
// applicationService.js ends with an explicit module.exports = { ... }.
// That object replaces the earlier exports object. The new function MUST be
// included in that final object or controllers receive undefined.
const mapping =
  '    saveApplicationDocumentReview:\n' +
  '        exports.saveApplicationDocumentReview,\n';

if (!service.includes('saveApplicationDocumentReview:\n')) {
  const exportAnchor =
    '    saveApplicationVerification:\n' +
    '        exports.saveApplicationVerification,\n';

  const exportIndex = service.indexOf(exportAnchor);

  if (exportIndex < 0) {
    fail(
      'Could not find the final saveApplicationVerification module.exports mapping.'
    );
  }

  service =
    service.slice(0, exportIndex) +
    mapping +
    service.slice(exportIndex);

  changed = true;
  console.log('Added saveApplicationDocumentReview to final module.exports.');
} else {
  console.log('Final module.exports already exposes saveApplicationDocumentReview.');
}

if (
  !service.includes('exports.saveApplicationDocumentReview = async') ||
  !service.includes(
    'saveApplicationDocumentReview:\n        exports.saveApplicationDocumentReview'
  )
) {
  fail('Validation failed before writing.');
}

if (changed) {
  writePreservingEol(servicePath, service, file.eol);
}

// Require the actual local module in a fresh Node process after this script
// exits; do not require it here because it needs the user's backend env/config.
console.log('');
console.log('SOURCE FIX COMPLETE.');
console.log('');
console.log('Now restart the Admin backend. The running Node process still has the old module cached.');
console.log('');
console.log('Then verify from admin/backend with:');
console.log(`  node -e "require('dotenv').config(); const s=require('./services/applicationService'); console.log(typeof s.saveApplicationDocumentReview)"`);
console.log('');
console.log('It MUST print: function');
