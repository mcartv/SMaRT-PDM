#!/usr/bin/env node
'use strict';

/*
 * SMaRT-PDM — Readiness Final Summary + Verified Document Lock v1
 *
 * Audited against GitHub:
 *   mcartv/SMaRT-PDM
 *   ec29c8673fb019eca54769ce9518d4bdd2c5dbb8
 *
 * Scope:
 * - Admin Readiness "View Application" no longer routes back to document verification.
 *   It opens a final-process summary instead.
 * - Once Admin verification is complete, applicant document upload/replacement is
 *   locked in BOTH the mobile UI and backend.
 * - Admin correction/re-upload requests unlock the documents again because the
 *   existing verification flow clears requirements_verified_at / verified status.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipFlutter = args.includes('--skip-flutter');
const skipAdminBuild = args.includes('--skip-admin-build');
const rootArg = args.find((arg) => !arg.startsWith('--')) || '.';
const root = path.resolve(process.cwd(), rootArg);

const REL = {
  adminReview: 'admin/frontend/src/pages/ApplicationReview.jsx',
  mobileBackend: 'mobile/backend/src/services/applicationService.js',
  mobileModel: 'mobile/frontend/lib/shared/models/applicant_documents_package.dart',
  mobileScreen: 'mobile/frontend/lib/features/applicant/presentation/screens/applicant_documents_screen.dart',
  contract: 'mobile/backend/test/readiness-final-summary-document-lock-contract.test.js',
};

function abs(rel) {
  return path.join(root, rel);
}

function fail(message) {
  console.error('\n[READINESS SUMMARY + DOCUMENT LOCK] ERROR: ' + message);
  process.exit(1);
}

function read(rel) {
  const file = abs(rel);
  if (!fs.existsSync(file)) {
    throw new Error('Required file not found: ' + rel);
  }
  return fs.readFileSync(file, 'utf8');
}

function adaptEol(value, source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return String(value).replace(/\r\n/g, '\n').replace(/\n/g, eol);
}

function replaceOne(source, oldValue, newValue, label) {
  const oldNative = adaptEol(oldValue, source);
  const newNative = adaptEol(newValue, source);

  if (source.includes(newNative)) {
    console.log('[already] ' + label);
    return source;
  }

  const count = source.split(oldNative).length - 1;
  if (count !== 1) {
    throw new Error(
      `${label}: expected exactly 1 source match, found ${count}.`
    );
  }

  console.log('[patch] ' + label);
  return source.replace(oldNative, newNative);
}

function replaceCount(source, oldValue, newValue, expected, label) {
  const oldNative = adaptEol(oldValue, source);
  const newNative = adaptEol(newValue, source);

  const existingNew = source.split(newNative).length - 1;
  if (existingNew >= expected) {
    console.log('[already] ' + label);
    return source;
  }

  const count = source.split(oldNative).length - 1;
  if (count !== expected) {
    throw new Error(
      `${label}: expected ${expected} source match(es), found ${count}.`
    );
  }

  console.log('[patch] ' + label);
  return source.split(oldNative).join(newNative);
}

function scanConflicts() {
  for (const rel of Object.values(REL)) {
    if (rel === REL.contract) continue;
    const file = abs(rel);
    if (!fs.existsSync(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (/^<<<<<<<[^\r\n]*$/m.test(source)) {
      throw new Error('Unresolved Git merge markers remain in ' + rel + '.');
    }
  }
}

function run(command, commandArgs, cwd, label) {
  console.log('\n[verify] ' + label);

  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(label + ' failed.');
  }
}

function runFlutter(cwd, commandArgs, label) {
  if (process.platform !== 'win32') {
    run('flutter', commandArgs, cwd, label);
    return;
  }

  const commandLine = ['flutter', ...commandArgs].join(' ');
  run(
    process.env.ComSpec || 'cmd.exe',
    ['/d', '/c', commandLine],
    cwd,
    label
  );
}

const READINESS_DIALOG = `
function ReadinessCompletionSummary({
  row,
  navigate,
  onDownloadSlip,
  onClose,
}) {
  if (!row) return null;

  const selectionStatus = normalizeStatus(row.selection_status);
  const isWaiting = selectionStatus === 'waitlisted';
  const isPromoted = selectionStatus === 'promoted';

  const steps = [
    {
      label: 'Application Requirements',
      value: row.requirements_complete
        ? 'Verified by Admin'
        : 'Verification incomplete',
      detail: row.requirements_verified_at
        ? \`Verified \${formatDate(row.requirements_verified_at)}\`
        : 'No final verification timestamp',
      complete: row.requirements_complete === true,
    },
    {
      label: 'Endorsement',
      value: row.endorsement_complete
        ? 'SDO, Guidance, and PD completed'
        : 'Endorsement incomplete',
      detail: row.endorsement_slip_id
        ? \`Endorsement Slip \${row.endorsement_slip_code || ''}\`
        : 'No completed endorsement slip',
      complete: row.endorsement_complete === true,
    },
    {
      label: 'FCFS Readiness',
      value: getFcfsLabel(row),
      detail: row.fcfs_completed_at
        ? \`Completed \${formatDate(row.fcfs_completed_at)}\`
        : 'Not yet ranked',
      complete: Boolean(row.fcfs_completed_at),
    },
    {
      label: 'Final Selection',
      value: isWaiting
        ? \`Waiting #\${Number(row.waitlist_position || 0) || '—'}\`
        : isPromoted
          ? 'Promoted from waiting list'
          : 'Reserved by FCFS',
      detail: isWaiting
        ? 'Qualified and waiting for a released scholarship slot.'
        : 'Currently holding a scholarship slot for final activation.',
      complete: !isWaiting,
    },
  ];

  return (
    <Dialog
      open={Boolean(row)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl rounded-2xl border-stone-200 p-0">
        <DialogHeader className="border-b border-stone-100 px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-lg">Final Readiness Summary</DialogTitle>
          <p className="mt-1 text-sm leading-6 text-stone-500">
            {row.applicant_name} · {row.pdm_id}
          </p>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4 sm:px-6">
          <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-900">
                  Verification work is complete
                </p>
                <p className="mt-1 text-sm leading-5 text-green-800/80">
                  This Readiness view is the final step before scholar activation.
                  Document verification is already finished, so the applicant's
                  uploaded requirements are locked unless Admin explicitly requests
                  a correction.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {steps.map((step) => (
              <div
                key={step.label}
                className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={\`h-4 w-4 \${
                      step.complete ? 'text-green-600' : 'text-stone-400'
                    }\`}
                  />
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    {step.label}
                  </p>
                </div>
                <p className="mt-2 text-sm font-semibold text-stone-900">
                  {step.value}
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {step.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-stone-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Scholarship
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-900">
              {row.program_name}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              {row.opening_title}
              {row.academic_year ? \` · \${row.academic_year}\` : ''}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 border-t border-stone-100 px-5 py-3 sm:flex-row sm:px-6">
          {row.endorsement_slip_id ? (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    \`/admin/endorsements/\${row.endorsement_slip_id}\`
                  )
                }
              >
                View Endorsement Slip
              </Button>
              <Button
                variant="outline"
                onClick={() => onDownloadSlip(row)}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Download Slip PDF
              </Button>
            </>
          ) : null}

          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
`;

function patchAdminReview(source) {
  let out = source;

  out = replaceOne(
    out,
    `

function ReadinessOpeningCards({
  openings,
  rows,
  navigate,
  onApproveScholar,
  approvalLoadingId = '',
  unseenOpeningIds = new Set(),
  onOpeningViewed = () => {},
}) {`,
    `

${READINESS_DIALOG}

function ReadinessOpeningCards({
  openings,
  rows,
  navigate,
  onDownloadSlip,
  onApproveScholar,
  approvalLoadingId = '',
  unseenOpeningIds = new Set(),
  onOpeningViewed = () => {},
}) {`,
    'Admin Readiness: add final summary dialog'
  );

  out = replaceOne(
    out,
    `  const [selectedOpeningId, setSelectedOpeningId] =
    useState('');`,
    `  const [selectedOpeningId, setSelectedOpeningId] =
    useState('');
  const [summaryRow, setSummaryRow] = useState(null);`,
    'Admin Readiness: track summary applicant'
  );

  out = replaceOne(
    out,
    `  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-stone-200 bg-white p-3 shadow-none">`,
    `  return (
    <div className="space-y-3">
      <ReadinessCompletionSummary
        row={summaryRow}
        navigate={navigate}
        onDownloadSlip={onDownloadSlip}
        onClose={() => setSummaryRow(null)}
      />

      <section className="rounded-2xl border border-stone-200 bg-white p-3 shadow-none">`,
    'Admin Readiness: render summary dialog'
  );

  out = replaceOne(
    out,
    `                        onClick={() =>
                          navigate(
                            \`/admin/applications/\${row.application_id}/documents\`
                          )
                        }
                      >
                        View Application
                      </Button>`,
    `                        onClick={() => setSummaryRow(row)}
                      >
                        View Summary
                      </Button>`,
    'Admin Readiness: stop reopening document verification'
  );

  out = replaceOne(
    out,
    `          navigate={navigate}
          onApproveScholar={setActivationCandidate}`,
    `          navigate={navigate}
          onDownloadSlip={downloadSlipPdf}
          onApproveScholar={setActivationCandidate}`,
    'Admin Readiness: provide endorsement proof download'
  );

  return out;
}

function patchMobileBackend(source) {
  let out = source;

  out = replaceOne(
    out,
    `async function getMyDocuments(userId) {`,
    `// SMART_PDM_VERIFIED_DOCUMENT_UPLOAD_LOCK_V1
function getApplicationDocumentUploadLock(application = {}) {
    const applicationStatus = normalizeWorkflowKey(
        application.application_status
    );
    const verificationStatus = normalizeWorkflowKey(
        application.verification_status
    );
    const selectionStatus = normalizeWorkflowKey(
        application.selection_status
    );
    const activationStatus = normalizeWorkflowKey(
        application.activation_status
    );

    if (
        verificationStatus === 'verified' ||
        Boolean(application.requirements_verified_at)
    ) {
        return {
            locked: true,
            reason:
                'Your application documents are verified and locked. Uploads reopen only if Admin requests a correction or replacement.',
        };
    }

    if (application.is_archived === true) {
        return {
            locked: true,
            reason: 'Document uploads are unavailable for an archived application.',
        };
    }

    if (
        applicationStatus === 'approved' ||
        applicationStatus === 'rejected'
    ) {
        return {
            locked: true,
            reason:
                'Document uploads are unavailable because this application is already finalized.',
        };
    }

    if (
        ['selected', 'promoted', 'waitlisted', 'not selected'].includes(
            selectionStatus
        ) ||
        activationStatus === 'activated' ||
        Boolean(application.activated_at)
    ) {
        return {
            locked: true,
            reason:
                'Document uploads are unavailable after final selection or scholar activation begins.',
        };
    }

    return {
        locked: false,
        reason: null,
    };
}

async function getMyDocuments(userId) {`,
    'Backend: add authoritative verified-document lock'
  );

  out = replaceOne(
    out,
    `            verification_status,
            submission_date,
            created_at`,
    `            verification_status,
            requirements_verified_at,
            selection_status,
            activation_status,
            activated_at,
            is_archived,
            submission_date,
            created_at`,
    'Backend: load lifecycle fields for document lock'
  );

  out = replaceOne(
    out,
    `    const documentsWithSignedUrls = await attachSignedUrlsToDocuments(documents || []);
    const uploadedCount = documentsWithSignedUrls.filter((doc) =>`,
    `    const documentsWithSignedUrls = await attachSignedUrlsToDocuments(documents || []);
    const uploadLock = getApplicationDocumentUploadLock(application);

    const uploadedCount = documentsWithSignedUrls.filter((doc) =>`,
    'Backend: resolve document lock in package response'
  );

  out = replaceOne(
    out,
    `        allRequiredUploaded: uploadedCount >= requiredDocuments.length,
        application,
        documents: documentsWithSignedUrls,`,
    `        allRequiredUploaded: uploadedCount >= requiredDocuments.length,
        uploads_locked: uploadLock.locked,
        upload_lock_reason: uploadLock.reason,
        application: {
            ...application,
            uploads_locked: uploadLock.locked,
            upload_lock_reason: uploadLock.reason,
        },
        documents: documentsWithSignedUrls,`,
    'Backend: expose lock state to mobile'
  );

  out = replaceOne(
    out,
    `            'application_id, student_id, opening_id, program_id, application_status, document_status, verification_status, selection_status, activation_status, activated_at, is_archived'`,
    `            'application_id, student_id, opening_id, program_id, application_status, document_status, verification_status, requirements_verified_at, selection_status, activation_status, activated_at, is_archived'`,
    'Backend: load verification timestamp before upload'
  );

  out = replaceOne(
    out,
    `    const normalizedApplicationStatus = normalizeWorkflowKey(
        application.application_status
    );
    const normalizedSelectionStatus = normalizeWorkflowKey(
        application.selection_status
    );
    const normalizedActivationStatus = normalizeWorkflowKey(
        application.activation_status
    );

    if (
        application.is_archived === true ||
        normalizedApplicationStatus === 'approved' ||
        normalizedApplicationStatus === 'rejected' ||
        ['selected', 'promoted', 'waitlisted', 'not selected'].includes(
            normalizedSelectionStatus
        ) ||
        normalizedActivationStatus === 'activated' ||
        Boolean(application.activated_at)
    ) {
        throw createHttpError(
            409,
            'Required documents can no longer be replaced after final selection or scholar activation.'
        );
    }`,
    `    const uploadLock = getApplicationDocumentUploadLock(application);

    if (uploadLock.locked) {
        throw createHttpError(
            409,
            uploadLock.reason ||
                'Required documents are currently locked.'
        );
    }`,
    'Backend: block upload immediately after Admin verification'
  );

  return out;
}

function patchMobileModel(source) {
  let out = source;

  out = replaceOne(
    out,
    `    required this.documentStatus,
    required this.documents,
  });`,
    `    required this.documentStatus,
    required this.uploadsLocked,
    this.uploadLockReason,
    required this.documents,
  });`,
    'Mobile model: add document lock constructor fields'
  );

  out = replaceOne(
    out,
    `  final String applicationStatus;
  final String documentStatus;
  final List<ApplicantRequirementDocument> documents;`,
    `  final String applicationStatus;
  final String documentStatus;
  final bool uploadsLocked;
  final String? uploadLockReason;
  final List<ApplicantRequirementDocument> documents;`,
    'Mobile model: add document lock properties'
  );

  out = replaceOne(
    out,
    `    return ApplicantDocumentsPackage(
      applicationId: application['application_id']?.toString() ?? '',`,
    `    final uploadLockReasonRaw =
        json['upload_lock_reason'] ?? application['upload_lock_reason'];
    final uploadLockReasonText =
        uploadLockReasonRaw?.toString().trim() ?? '';

    final verificationStatus =
        application['verification_status']?.toString().trim().toLowerCase() ??
        '';

    final uploadsLocked =
        json['uploads_locked'] == true ||
        application['uploads_locked'] == true ||
        verificationStatus == 'verified';

    return ApplicantDocumentsPackage(
      applicationId: application['application_id']?.toString() ?? '',`,
    'Mobile model: parse lock state'
  );

  out = replaceOne(
    out,
    `      documentStatus:
          application['document_status']?.toString() ?? 'Missing Docs',
      documents: documents,`,
    `      documentStatus:
          application['document_status']?.toString() ?? 'Missing Docs',
      uploadsLocked: uploadsLocked,
      uploadLockReason:
          uploadLockReasonText.isEmpty ? null : uploadLockReasonText,
      documents: documents,`,
    'Mobile model: populate lock state'
  );

  return out;
}

function patchMobileScreen(source) {
  let out = source;

  out = replaceOne(
    out,
    `  Future<void> _pickAndUploadDocument(
    ApplicantRequirementDocument document,
  ) async {
    final canContinue = await _confirmDocumentReplacement(document);`,
    `  Future<void> _pickAndUploadDocument(
    ApplicantRequirementDocument document,
  ) async {
    final package = _package;

    if (package?.uploadsLocked == true) {
      _showUploadMessage(
        package?.uploadLockReason ??
            'Your verified documents are locked unless Admin requests a correction.',
        isError: true,
      );
      return;
    }

    final canContinue = await _confirmDocumentReplacement(document);`,
    'Mobile UI: block picker when verified'
  );

  out = replaceOne(
    out,
    `                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () =>
                              Navigator.of(dialogContext).pop(true),
                          icon: const Icon(Icons.upload_file),
                          label: const Text('Replace Document'),
                        ),
                      ),`,
    `                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _package?.uploadsLocked == true
                              ? null
                              : () => Navigator.of(dialogContext).pop(true),
                          icon: Icon(
                            _package?.uploadsLocked == true
                                ? Icons.lock_outline_rounded
                                : Icons.upload_file,
                          ),
                          label: Text(
                            _package?.uploadsLocked == true
                                ? 'Verified — Locked'
                                : 'Replace Document',
                          ),
                        ),
                      ),`,
    'Mobile UI: lock replacement from preview'
  );

  out = replaceOne(
    out,
    `  String _summaryText(ApplicantDocumentsPackage package) {
    if (package.needsReplacementCount > 0) {`,
    `  String _summaryText(ApplicantDocumentsPackage package) {
    if (package.uploadsLocked) {
      return package.uploadLockReason ??
          'All required documents are verified and locked.';
    }

    if (package.needsReplacementCount > 0) {`,
    'Mobile UI: explain verified lock'
  );

  out = replaceOne(
    out,
    `            _HeaderCard(
              title:
                  package?.contextTitle ??
                  widget.initialTitle ??
                  'Scholarship Requirements',
              programName:
                  package?.programName ??
                  widget.initialProgramName ??
                  'Current Application',
              description: package == null
                  ? (_needsBaseApplication
                        ? 'Submit your scholarship application first before uploading requirements.'
                        : 'Loading your scholarship requirements...')
                  : _summaryText(package),
              titleColor: titleColor,
              subtitleColor: subtitleColor,
              accentColor: accentColor,
              package: package,
            ),
            const SizedBox(height: 12),`,
    `            _HeaderCard(
              title:
                  package?.contextTitle ??
                  widget.initialTitle ??
                  'Scholarship Requirements',
              programName:
                  package?.programName ??
                  widget.initialProgramName ??
                  'Current Application',
              description: package == null
                  ? (_needsBaseApplication
                        ? 'Submit your scholarship application first before uploading requirements.'
                        : 'Loading your scholarship requirements...')
                  : _summaryText(package),
              titleColor: titleColor,
              subtitleColor: subtitleColor,
              accentColor: accentColor,
              package: package,
            ),
            if (package?.uploadsLocked == true) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.green.withValues(alpha: isDark ? 0.12 : 0.07),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: Colors.green.withValues(alpha: 0.24),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.lock_outline_rounded,
                      color: Colors.green,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        package?.uploadLockReason ??
                            'Documents verified by Admin. Upload and replacement are locked unless a correction is requested.',
                        style: TextStyle(
                          color: isDark
                              ? AppColors.applicantDarkText
                              : AppColors.darkBrown,
                          height: 1.4,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),`,
    'Mobile UI: show verified-document lock banner'
  );

  out = replaceCount(
    out,
    `                    onUpload: () => _pickAndUploadDocument(document),`,
    `                    onUpload: package.uploadsLocked
                        ? null
                        : () => _pickAndUploadDocument(document),`,
    2,
    'Mobile UI: disable upload buttons after verification'
  );

  out = replaceOne(
    out,
    `  final bool isUploading;
  final VoidCallback onUpload;
  final VoidCallback? onOpen;`,
    `  final bool isUploading;
  final VoidCallback? onUpload;
  final VoidCallback? onOpen;`,
    'Mobile card: make upload action nullable'
  );

  out = replaceOne(
    out,
    `              ElevatedButton.icon(
                onPressed: isUploading ? null : onUpload,
                icon: Icon(
                  document.isSubmitted
                      ? Icons.swap_horiz_rounded
                      : Icons.upload_file,
                ),
                label: Text(
                  isUploading
                      ? (document.isSubmitted
                            ? 'Replacing...'
                            : 'Uploading...')
                      : document.isSubmitted
                          ? 'Replace Document'
                          : 'Upload File',
                ),
              ),`,
    `              ElevatedButton.icon(
                onPressed: isUploading || onUpload == null ? null : onUpload,
                icon: Icon(
                  onUpload == null
                      ? Icons.lock_outline_rounded
                      : document.isSubmitted
                          ? Icons.swap_horiz_rounded
                          : Icons.upload_file,
                ),
                label: Text(
                  onUpload == null
                      ? 'Verified — Locked'
                      : isUploading
                          ? (document.isSubmitted
                                ? 'Replacing...'
                                : 'Uploading...')
                          : document.isSubmitted
                              ? 'Replace Document'
                              : 'Upload File',
                ),
              ),`,
    'Mobile card: show locked upload state'
  );

  return out;
}

const CONTRACT = `'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');

function source(rel) {
  return fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\\r\\n/g, '\\n');
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
      'Document verification is already finished'
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
      '/admin/applications/\${row.application_id}/documents'
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
`;

function prepareWrites() {
  scanConflicts();

  const originals = new Map();
  const writes = new Map();

  for (const [rel, patcher] of [
    [REL.adminReview, patchAdminReview],
    [REL.mobileBackend, patchMobileBackend],
    [REL.mobileModel, patchMobileModel],
    [REL.mobileScreen, patchMobileScreen],
  ]) {
    const current = read(rel);
    originals.set(rel, current);
    writes.set(rel, patcher(current));
  }

  const contractFile = abs(REL.contract);
  if (fs.existsSync(contractFile)) {
    const current = fs.readFileSync(contractFile, 'utf8');
    originals.set(REL.contract, current);
    if (current !== CONTRACT) {
      throw new Error(
        `${REL.contract} already exists with different content.`
      );
    }
    writes.set(REL.contract, current);
    console.log('[already] ' + REL.contract);
  } else {
    originals.set(REL.contract, null);
    writes.set(REL.contract, CONTRACT);
    console.log('[patch] Add ' + REL.contract);
  }

  return { originals, writes };
}

function restore(originals) {
  for (const [rel, original] of originals.entries()) {
    const file = abs(rel);

    try {
      if (original === null) {
        fs.rmSync(file, { force: true });
      } else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, original, 'utf8');
      }
    } catch (_) {}
  }
}

let prepared;

try {
  prepared = prepareWrites();
} catch (error) {
  fail(error.message || String(error));
}

if (dryRun) {
  console.log('\n[READINESS SUMMARY + DOCUMENT LOCK] Dry run passed.');
  console.log('No files were written.');
  process.exit(0);
}

try {
  for (const [rel, content] of prepared.writes.entries()) {
    const file = abs(rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  }

  run(
    process.execPath,
    ['--check', abs(REL.mobileBackend)],
    root,
    'Node syntax: mobile application service'
  );

  run(
    process.execPath,
    ['--test', abs(REL.contract)],
    root,
    'Readiness/document-lock contract test'
  );

  if (!skipAdminBuild) {
    const adminFrontend = path.join(root, 'admin/frontend');
    if (process.platform === 'win32') {
      run(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/c', 'npm run build'],
        adminFrontend,
        'Admin frontend build'
      );
    } else {
      run('npm', ['run', 'build'], adminFrontend, 'Admin frontend build');
    }
  } else {
    console.log('\n[verify] Admin build skipped by --skip-admin-build.');
  }

  if (!skipFlutter) {
    runFlutter(
      path.join(root, 'mobile/frontend'),
      [
        'analyze',
        '--no-fatal-warnings',
        '--no-fatal-infos',
        'lib/shared/models/applicant_documents_package.dart',
        'lib/features/applicant/presentation/screens/applicant_documents_screen.dart',
      ],
      'Focused Flutter analyze'
    );
  } else {
    console.log('\n[verify] Flutter analyze skipped by --skip-flutter.');
  }
} catch (error) {
  restore(prepared.originals);
  fail(
    (error.message || String(error)) +
      '\nAll files changed by this run were restored.'
  );
}

console.log('\n[READINESS SUMMARY + DOCUMENT LOCK] Installed successfully.');
console.log('No SQL migration is required.');
