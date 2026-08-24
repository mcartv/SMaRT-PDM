#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);

  while (true) {
    const preview = path.join(
      dir,
      'mobile',
      'frontend',
      'lib',
      'features',
      'applicant',
      'presentation',
      'screens',
      'application_form_preview_screen.dart'
    );
    const mobileBackend = path.join(
      dir,
      'mobile',
      'backend',
      'src',
      'services',
      'applicationService.js'
    );
    const adminVerification = path.join(
      dir,
      'admin',
      'frontend',
      'src',
      'pages',
      'DocumentVerification.jsx'
    );

    if (
      fs.existsSync(preview) &&
      fs.existsSync(mobileBackend) &&
      fs.existsSync(adminVerification)
    ) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not find the SMaRT-PDM repository root. Run this from D:\\projects\\SMaRT-PDM.'
  );
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

function restore(text, crlf) {
  return crlf ? text.replace(/\n/g, '\r\n') : text;
}

function backup(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = `${file}.bak-application-form-correction-v3-${stamp}`;
  fs.copyFileSync(file, target);
  return target;
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}.`);
  }
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }

    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function extractMethod(text, signature) {
  const start = text.indexOf(signature);
  if (start < 0) return null;

  const open = text.indexOf('{', start);
  if (open < 0) return null;

  const close = findMatchingBrace(text, open);
  if (close < 0) return null;

  return {
    start,
    end: close + 1,
    text: text.slice(start, close + 1),
  };
}

function replaceWholeMethod(text, signature, replacement, label) {
  const method = extractMethod(text, signature);

  if (!method) {
    throw new Error(`Could not locate ${label}. No unsafe edit was made.`);
  }

  return text.slice(0, method.start) + replacement + text.slice(method.end);
}

function replaceRequired(text, oldText, newText, label) {
  if (text.includes(newText)) return text;

  if (!text.includes(oldText)) {
    throw new Error(
      `Could not find expected ${label}. No unsafe edit was made.`
    );
  }

  return text.replace(oldText, newText);
}

const repo = findRepoRoot(process.cwd());
const frontend = path.join(repo, 'mobile', 'frontend');
const backend = path.join(repo, 'mobile', 'backend');
const adminFrontend = path.join(repo, 'admin', 'frontend');

const files = {
  preview: path.join(
    frontend,
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'application_form_preview_screen.dart'
  ),
  printable: path.join(
    frontend,
    'lib',
    'features',
    'forms',
    'data',
    'services',
    'printable_application_service.dart'
  ),
  pdf: path.join(
    frontend,
    'lib',
    'features',
    'forms',
    'data',
    'services',
    'scholarship_form_pdf_service.dart'
  ),
  backend: path.join(
    backend,
    'src',
    'services',
    'applicationService.js'
  ),
  adminVerification: path.join(
    adminFrontend,
    'src',
    'pages',
    'DocumentVerification.jsx'
  ),
};

const originals = {};
const crlf = {};

for (const [key, file] of Object.entries(files)) {
  originals[key] = fs.readFileSync(file, 'utf8');
  crlf[key] = originals[key].includes('\r\n');
}

let preview = normalize(originals.preview);
let printable = normalize(originals.printable);
let pdf = normalize(originals.pdf);
let backendSource = normalize(originals.backend);
let adminVerification = normalize(originals.adminVerification);

/* ========================================================================== */
/* A. ADMIN: Application Form gets "Request Re-edit", not file re-upload.      */
/* ========================================================================== */

if (!adminVerification.includes('const FORM_CORRECTION_OPTIONS = [')) {
  const anchor = `const MAJOR_REJECTION_OPTIONS = [`;
  const index = adminVerification.indexOf(anchor);

  if (index < 0) {
    throw new Error(
      'Could not find Admin review-option insertion point.'
    );
  }

  const formOptions = `const FORM_CORRECTION_OPTIONS = [
  {
    code: 'INCOMPLETE_APPLICATION_FORM',
    label: 'Missing or incomplete application information',
  },
  {
    code: 'MISMATCH_NEEDS_CORRECTION',
    label: 'Information mismatch that can be corrected',
  },
  {
    code: 'OTHER_MINOR',
    label: 'Other application form correction',
  },
];

`;

  adminVerification =
    adminVerification.slice(0, index) +
    formOptions +
    adminVerification.slice(index);
}

adminVerification = adminVerification.replace(
  `  const canRequestReupload =
    canReviewActiveDocument &&
    activeDoc?.id !== 'application_form';`,
  `  const canRequestReupload = canReviewActiveDocument;`
);

adminVerification = adminVerification.replace(
  `              Request Re-upload
            </Button>`,
  `              {activeDoc?.id === 'application_form'
                ? 'Request Re-edit'
                : 'Request Re-upload'}
            </Button>`
);

adminVerification = adminVerification.replace(
  `              The application form is digital and cannot be re-uploaded.
              Use Reject Application only for a serious disqualifying issue.`,
  `              The application form is digital. Use Request Re-edit for
              correctable information issues. The applicant's Edit Form button
              will unlock only after this correction request is saved.`
);

/* ReviewIssueModal: use form-specific options and wording. */
adminVerification = adminVerification.replace(
  `  const isMajor = mode === 'major';
  const options = isMajor
    ? MAJOR_REJECTION_OPTIONS
    : MINOR_REUPLOAD_OPTIONS;`,
  `  const isMajor = mode === 'major';
  const isApplicationForm = activeDocName === 'Application Form';
  const options = isMajor
    ? MAJOR_REJECTION_OPTIONS
    : isApplicationForm
      ? FORM_CORRECTION_OPTIONS
      : MINOR_REUPLOAD_OPTIONS;`
);

adminVerification = adminVerification.replace(
  `              {isMajor
                ? 'Reject Application'
                : 'Request Document Re-upload'}`,
  `              {isMajor
                ? 'Reject Application'
                : isApplicationForm
                  ? 'Request Application Form Re-edit'
                  : 'Request Document Re-upload'}`
);

adminVerification = adminVerification.replace(
  `                Request Re-upload
              </>`,
  `                {isApplicationForm
                  ? 'Request Re-edit'
                  : 'Request Re-upload'}
              </>`
);

/* ========================================================================== */
/* B. MOBILE BACKEND: edit ONLY after application_form correction request.     */
/* ========================================================================== */

let submittedFormMethod = extractMethod(
  backendSource,
  'async function getMySubmittedFormData(userId)'
);

if (!submittedFormMethod) {
  throw new Error(
    'Could not locate getMySubmittedFormData() in mobile backend.'
  );
}

let submittedForm = submittedFormMethod.text;

/* Use application_document_reviews, because Application Form is a digital
 * review item and does not have a normal application_documents upload row. */
submittedForm = submittedForm.replace(
  `supabase
            .from('application_documents')
            .select('document_id, review_status, reviewed_at')
            .eq('application_id', application.application_id),`,
  `supabase
            .from('application_document_reviews')
            .select(
                'document_key, review_status, admin_comment, reason_code, reviewed_at'
            )
            .eq('application_id', application.application_id),`
);

if (
  !submittedForm.includes(
    ".from('application_document_reviews')"
  )
) {
  throw new Error(
    'Could not switch submitted-form editability to application_document_reviews.'
  );
}

if (!submittedForm.includes('const applicationFormReview =')) {
  const anchor =
    `    const ocrStarted = Number(ocrResult.count || 0) > 0;`;

  if (!submittedForm.includes(anchor)) {
    throw new Error(
      'Could not find getMySubmittedFormData OCR marker.'
    );
  }

  const block = `    const applicationFormReview =
        (documentReviewResult.data || []).find(
            (review) =>
                safeText(review.document_key)
                    .toLowerCase()
                    .replace(/[\\s-]+/g, '_') === 'application_form'
        ) || null;

    const applicationFormReviewStatus = safeText(
        applicationFormReview?.review_status
    )
        .toLowerCase()
        .replace(/[\\s-]+/g, '_');

    const applicationFormCorrectionRequested = [
        'reupload_required',
        'requires_reupload',
        'needs_reupload',
        'needs_re_upload',
        'request_reupload',
        'request_re_upload',
        'flagged',
    ].includes(applicationFormReviewStatus);

`;

  submittedForm = submittedForm.replace(
    anchor,
    block + anchor
  );
}

/* Replace canEdit no matter whether local file currently has the original
 * reviewStarted lock or the temporarily-relaxed rule. */
submittedForm = submittedForm.replace(
  /    const canEdit\s*=\s*pendingReview\s*&&[\s\S]*?!activated\s*;/,
  `    const canEdit =
        pendingReview &&
        applicationFormCorrectionRequested &&
        !selectionStarted &&
        !activated;`
);

const reasonStart = submittedForm.indexOf('    let reason = null;');
const formDataMarker =
  '    let formData = application.application_payload;';

if (reasonStart < 0 || !submittedForm.includes(formDataMarker)) {
  throw new Error(
    'Could not locate getMySubmittedFormData editability reason block.'
  );
}

const reasonEnd = submittedForm.indexOf(
  formDataMarker,
  reasonStart
);

const reasonBlock = `    let reason = null;

    if (!pendingReview) {
        reason =
            'Editing is unavailable because this application is no longer in Pending Review.';
    } else if (activated || selectionStarted) {
        reason =
            'Editing is unavailable after FCFS selection or scholar activation begins.';
    } else if (!applicationFormCorrectionRequested) {
        reason =
            applicationFormReviewStatus === 'verified'
                ? 'The application form has been reviewed and no correction was requested.'
                : 'Editing is locked until OSFA/Admin requests a correction to the application form.';
    }

`;

submittedForm =
  submittedForm.slice(0, reasonStart) +
  reasonBlock +
  submittedForm.slice(reasonEnd);

if (!submittedForm.includes('correction_requested:')) {
  submittedForm = submittedForm.replace(
    `            can_edit: canEdit,`,
    `            can_edit: canEdit,
            correction_requested: applicationFormCorrectionRequested,
            correction_comment:
                applicationFormCorrectionRequested
                    ? safeText(applicationFormReview?.admin_comment) || null
                    : null,
            application_form_review_status:
                applicationFormReviewStatus || 'pending',`
  );
}

backendSource =
  backendSource.slice(0, submittedFormMethod.start) +
  submittedForm +
  backendSource.slice(submittedFormMethod.end);

/* ========================================================================== */
/* C. MOBILE BACKEND: after applicant re-edits, lock it again for re-review.   */
/* ========================================================================== */

let submitMethod = extractMethod(
  backendSource,
  'async function submitMyApplicationForm(userId, payload = {})'
);

if (!submitMethod) {
  throw new Error(
    'Could not locate submitMyApplicationForm() in mobile backend.'
  );
}

let submitBody = submitMethod.text;

if (!submitBody.includes('resetApplicationFormReviewError')) {
  // Do not depend on exact indentation/line wrapping. The user's local
  // submitMyApplicationForm has already been formatted by earlier patches.
  // The final function result is the last `return { ... }` object in this
  // function, so locate it structurally instead of matching one exact string.
  const returnMatches = [
    ...submitBody.matchAll(/\\breturn\\s*\\{/g),
  ];

  const lastReturn =
    returnMatches.length > 0
      ? returnMatches[returnMatches.length - 1].index
      : -1;

  if (lastReturn < 0) {
    throw new Error(
      'Could not locate the final return object in submitMyApplicationForm().'
    );
  }

  const resetBlock = `    if (editExistingApplication && application?.application_id) {
        const correctionSubmittedAt = new Date().toISOString();

        const { error: resetApplicationFormReviewError } = await supabase
            .from('application_document_reviews')
            .upsert(
                {
                    application_id: application.application_id,
                    document_key: 'application_form',
                    document_name: 'Application Form',
                    review_status: 'pending',
                    admin_comment: '',
                    issue_severity: null,
                    reason_code: null,
                    reviewed_at: null,
                    updated_at: correctionSubmittedAt,
                },
                {
                    onConflict: 'application_id,document_key',
                }
            );

        if (resetApplicationFormReviewError) {
            throw resetApplicationFormReviewError;
        }
    }

`;

  submitBody =
    submitBody.slice(0, lastReturn) +
    resetBlock +
    submitBody.slice(lastReturn);
}

backendSource =
  backendSource.slice(0, submitMethod.start) +
  submitBody +
  backendSource.slice(submitMethod.end);

/* ========================================================================== */
/* D. MOBILE PREVIEW: read correction state and show proper message/button.    */
/* ========================================================================== */

if (!preview.includes('String? _correctionComment;')) {
  if (preview.includes('String? _pdfError;\n  String? _error;')) {
    preview = preview.replace(
      'String? _pdfError;\n  String? _error;',
      'String? _pdfError;\n  String? _correctionComment;\n  String? _error;'
    );
  } else if (preview.includes('String? _lockReason;\n  String? _error;')) {
    preview = preview.replace(
      'String? _lockReason;\n  String? _error;',
      'String? _lockReason;\n  String? _correctionComment;\n  String? _error;'
    );
  } else {
    throw new Error(
      'Could not add correction-comment state to Application Form Preview.'
    );
  }
}

if (!preview.includes("_correctionComment = _optional(editability['correction_comment']);")) {
  preview = preview.replace(
    `        _canEdit = editability['can_edit'] == true;
        _lockReason = _optional(editability['reason']);
        _loading = false;`,
    `        _canEdit = editability['can_edit'] == true;
        _lockReason = _optional(editability['reason']);
        _correctionComment =
            _optional(editability['correction_comment']);
        _loading = false;`
  );
}

/* Restore guard regardless of previous local patch. */
const openEditor = extractMethod(
  preview,
  '  Future<void> _openEditor() async'
);

if (!openEditor) {
  throw new Error(
    'Could not locate Application Form Preview _openEditor().'
  );
}

let openEditorText = openEditor.text;
openEditorText = openEditorText.replace(
  /if\s*\(\s*data\s*==\s*null(?:\s*\|\|\s*!_canEdit)?\s*\)\s*return\s*;/,
  'if (data == null || !_canEdit) return;'
);

preview =
  preview.slice(0, openEditor.start) +
  openEditorText +
  preview.slice(openEditor.end);

/* ========================================================================== */
/* E. WEB PDF EXPORT: keep the previous _Namespace fix in this superseding ZIP.*/
/* ========================================================================== */

if (!preview.includes("package:share_plus/share_plus.dart")) {
  const anchor = "import 'package:flutter/material.dart';\n";
  preview = replaceRequired(
    preview,
    anchor,
    anchor + "import 'package:share_plus/share_plus.dart';\n",
    'share_plus import'
  );
}

const exportMethod = `  Future<void> _exportPdf() async {
    if (_isExportingPdf) return;

    final data = _data;
    if (data == null) {
      setState(() {
        _pdfError = 'Application PDF is not available yet.';
      });
      return;
    }

    setState(() {
      _isExportingPdf = true;
      _pdfError = null;
    });

    try {
      final bytes =
          await _pdfService.generateBytesFromSubmissionPayload(
        data.toSubmissionPayload(),
      );

      if (!mounted) return;

      await Share.shareXFiles(
        [
          XFile.fromData(
            bytes,
            mimeType: 'application/pdf',
            name: 'SMaRT-PDM_Application_Form.pdf',
          ),
        ],
        text: 'SMaRT-PDM Scholarship Application',
      );
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _pdfError = error
            .toString()
            .replaceFirst('Exception: ', '')
            .trim();
      });
    } finally {
      if (mounted) {
        setState(() {
          _isExportingPdf = false;
        });
      }
    }
  }`;

preview = replaceWholeMethod(
  preview,
  '  Future<void> _exportPdf() async',
  exportMethod,
  'Application Form Preview _exportPdf()'
);

/* Replace bottom bar: disabled by default, enabled only on correction request. */
const bottomAction = `  Widget _bottomAction() {
    final canEdit = _data != null && _canEdit;
    final canExport = _data != null && !_isExportingPdf;

    final reviewMessage = canEdit
        ? 'OSFA/Admin requested a correction to your application form. '
            'Edit the requested information and save the updated form.'
        : 'Your application form is locked while it is being checked. '
            'Edit Form will become available only if OSFA/Admin requests '
            'a correction.';

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          border: Border(
            top: BorderSide(
              color: Theme.of(context)
                  .colorScheme
                  .outlineVariant
                  .withValues(alpha: 0.8),
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 12,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_data != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 9,
                ),
                margin: const EdgeInsets.only(bottom: 9),
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.28),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      canEdit
                          ? Icons.edit_note_outlined
                          : Icons.info_outline_rounded,
                      size: 16,
                      color: AppColors.gold,
                    ),
                    const SizedBox(width: 7),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            reviewMessage,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  height: 1.35,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                          if (canEdit &&
                              _correctionComment != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Admin remark: $_correctionComment',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    height: 1.35,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: canEdit ? _openEditor : null,
                    icon: const Icon(
                      Icons.edit_outlined,
                      size: 19,
                    ),
                    label: const Text(
                      'Edit Form',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 52),
                      foregroundColor: AppColors.gold,
                      disabledForegroundColor: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.38),
                      side: BorderSide(
                        color: canEdit
                            ? AppColors.gold
                            : Theme.of(context)
                                .colorScheme
                                .outlineVariant,
                        width: 1.2,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      textStyle: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: canExport ? _exportPdf : null,
                    icon: _isExportingPdf
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.darkBrown,
                            ),
                          )
                        : const Icon(
                            Icons.picture_as_pdf_outlined,
                            size: 19,
                          ),
                    label: const Text(
                      'Export PDF',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(0, 52),
                      backgroundColor: AppColors.gold,
                      foregroundColor: AppColors.darkBrown,
                      disabledBackgroundColor: Theme.of(context)
                          .colorScheme
                          .surfaceContainerHighest,
                      disabledForegroundColor: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.48),
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      textStyle: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (_pdfError != null) ...[
              const SizedBox(height: 7),
              Text(
                _pdfError!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.error,
                      fontWeight: FontWeight.w700,
                      height: 1.35,
                    ),
              ),
            ],
          ],
        ),
      ),
    );
  }`;

preview = replaceWholeMethod(
  preview,
  '  Widget _bottomAction()',
  bottomAction,
  'Application Form Preview _bottomAction()'
);

if (
  !preview.includes("'Read more'") ||
  !preview.includes("'Show less'") ||
  !preview.includes('maxLines: expanded ? null : 3')
) {
  throw new Error(
    'Personal Statement Read more / Show less is missing. No unsafe edit was made.'
  );
}

/* Add byte-generating PDF methods if the earlier Web fix was not yet applied. */
if (!pdf.includes("import 'dart:typed_data';")) {
  pdf = pdf.replace(
    "import 'dart:io';\n",
    "import 'dart:io';\nimport 'dart:typed_data';\n"
  );
}

if (!pdf.includes('Future<Uint8List> _generateFallbackPdfBytes(')) {
  const fallback = extractMethod(
    pdf,
    '  Future<File> _generateFallbackPdf('
  );

  if (!fallback) {
    throw new Error('Could not locate _generateFallbackPdf().');
  }

  let clone = fallback.text.replace(
    'Future<File> _generateFallbackPdf(',
    'Future<Uint8List> _generateFallbackPdfBytes('
  );

  const beforeTail = clone;

  clone = clone.replace(
    /\n\s*final dir = await _resolveOutputDirectory\(\);\s*\n\s*final file = File\('\$\{dir\.path\}\/fallback_scholarship_form\.pdf'\);\s*\n\s*await file\.writeAsBytes\(bytes,\s*flush:\s*true\);\s*\n\s*return file;\s*\n\s*\}$/,
    `\n    return bytes;\n  }`
  );

  if (clone === beforeTail) {
    throw new Error(
      'Could not convert fallback PDF renderer to bytes.'
    );
  }

  pdf =
    pdf.slice(0, fallback.start) +
    clone +
    '\n\n' +
    pdf.slice(fallback.start);
}

if (!pdf.includes('Future<Uint8List> generateBytesFromSavedApplication(')) {
  const generate = extractMethod(
    pdf,
    '  Future<File> generateFromSavedApplication('
  );

  if (!generate) {
    throw new Error(
      'Could not locate generateFromSavedApplication().'
    );
  }

  let clone = generate.text.replace(
    'Future<File> generateFromSavedApplication(',
    'Future<Uint8List> generateBytesFromSavedApplication('
  );

  clone = clone.replace(
    'return _generateFallbackPdf(model);',
    'return _generateFallbackPdfBytes(model);'
  );

  const beforeTail = clone;

  clone = clone.replace(
    /\n\s*final dir = await _resolveOutputDirectory\(\);\s*\n\s*final file = File\('\$\{dir\.path\}\/filled_scholarship_form\.pdf'\);\s*\n\s*await file\.writeAsBytes\(bytes,\s*flush:\s*true\);\s*\n\s*return file;\s*\n\s*\}$/,
    `\n    return bytes;\n  }`
  );

  if (clone === beforeTail) {
    throw new Error(
      'Could not convert filled PDF renderer to bytes.'
    );
  }

  pdf =
    pdf.slice(0, generate.start) +
    clone +
    '\n\n' +
    pdf.slice(generate.start);
}

if (!printable.includes("import 'dart:typed_data';")) {
  printable = printable.replace(
    "import 'dart:io';\n",
    "import 'dart:io';\nimport 'dart:typed_data';\n"
  );
}

if (!printable.includes('Future<Uint8List> generateBytesFromSubmissionPayload(')) {
  const anchor =
    '  Future<File> generateFromSubmissionPayload(';
  const index = printable.indexOf(anchor);

  if (index < 0) {
    throw new Error(
      'Could not locate PrintableApplicationService.generateFromSubmissionPayload().'
    );
  }

  const method = `  Future<Uint8List> generateBytesFromSubmissionPayload(
    Map<String, dynamic> payload,
  ) async {
    final model = SavedApplicationPrintModel.fromSavedFormData(payload);
    return _pdfService.generateBytesFromSavedApplication(model);
  }

`;

  printable =
    printable.slice(0, index) +
    method +
    printable.slice(index);
}

/* ========================================================================== */
/* F. VALIDATE                                                                 */
/* ========================================================================== */

const checks = [
  [
    'Admin application form re-edit action enabled',
    adminVerification.includes(
      'const canRequestReupload = canReviewActiveDocument;'
    ) &&
      adminVerification.includes("'Request Re-edit'"),
  ],
  [
    'Admin form-specific correction options',
    adminVerification.includes(
      'const FORM_CORRECTION_OPTIONS = ['
    ),
  ],
  [
    'Mobile backend reads digital application-form review row',
    backendSource.includes(
      ".from('application_document_reviews')"
    ) &&
      backendSource.includes(
        'applicationFormCorrectionRequested'
      ),
  ],
  [
    'Edit only allowed on explicit correction request',
    /pendingReview\s*&&\s*applicationFormCorrectionRequested\s*&&\s*!selectionStarted\s*&&\s*!activated/.test(
      backendSource
    ),
  ],
  [
    'Corrected form resets review to pending',
    backendSource.includes('resetApplicationFormReviewError') &&
      backendSource.includes("document_key: 'application_form'") &&
      backendSource.includes("review_status: 'pending'"),
  ],
  [
    'Preview uses backend can_edit',
    preview.includes(
      'final canEdit = _data != null && _canEdit;'
    ) &&
      preview.includes(
        'if (data == null || !_canEdit) return;'
      ),
  ],
  [
    'Preview explains locked behavior',
    preview.includes(
      'Edit Form will become available only if OSFA/Admin requests'
    ),
  ],
  [
    'Preview shows correction remark',
    preview.includes('Admin remark: $_correctionComment'),
  ],
  [
    'Web PDF byte export retained',
    preview.includes('XFile.fromData(') &&
      printable.includes(
        'generateBytesFromSubmissionPayload('
      ) &&
      pdf.includes(
        'generateBytesFromSavedApplication('
      ),
  ],
  [
    'Personal Statement Read more retained',
    preview.includes("'Read more'") &&
      preview.includes("'Show less'"),
  ],
];

const failed = checks.filter(([, ok]) => !ok);

if (failed.length) {
  throw new Error(
    `Validation failed before writing: ${failed
      .map(([name]) => name)
      .join(', ')}`
  );
}

const outputs = {
  preview,
  printable,
  pdf,
  backend: backendSource,
  adminVerification,
};

const backups = [];

for (const [key, file] of Object.entries(files)) {
  backups.push(backup(file));
  fs.writeFileSync(
    file,
    restore(outputs[key], crlf[key]),
    'utf8'
  );
}

/* ========================================================================== */
/* G. TESTS                                                                    */
/* ========================================================================== */

const flutterTest = path.join(
  frontend,
  'test',
  'application_form_correction_workflow_v4_test.dart'
);

const flutterTestSource = `import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/application_form_preview_screen.dart';

void main() {
  test('application preview compiles', () {
    expect(const ApplicationFormPreviewScreen(), isA<Widget>());
  });

  test('Edit Form is controlled by explicit backend correction permission', () {
    final source = File(
      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',
    ).readAsStringSync();

    expect(
      source,
      contains('final canEdit = _data != null && _canEdit;'),
    );
    expect(source, contains('data == null || !_canEdit'));
    expect(
      source,
      contains(
        'Edit Form will become available only if OSFA/Admin requests',
      ),
    );
    expect(source, contains('Admin remark: \$_correctionComment'));
  });

  test('Personal Statement is still collapsible', () {
    final source = File(
      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',
    ).readAsStringSync();

    expect(source, contains("'Read more'"));
    expect(source, contains("'Show less'"));
    expect(source, contains('maxLines: expanded ? null : 3'));
  });

  test('Web PDF export remains byte based', () {
    final source = File(
      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',
    ).readAsStringSync();

    expect(source, contains('XFile.fromData('));
    expect(source, contains("mimeType: 'application/pdf'"));
  });
}
`;

fs.writeFileSync(flutterTest, flutterTestSource, 'utf8');

const backendTest = path.join(
  backend,
  'test',
  'application-form-correction-workflow-v4-contract.test.js'
);

const backendTestSource = `'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'applicationService.js'),
  'utf8'
);

test('Edit permission requires application form correction request', () => {
  assert.match(
    source,
    /pendingReview\\s*&&\\s*applicationFormCorrectionRequested\\s*&&\\s*!selectionStarted\\s*&&\\s*!activated/
  );

  assert.match(
    source,
    /application_document_reviews/
  );

  assert.match(
    source,
    /document_key:\\s*'application_form'/
  );
});

test('Correction submission resets application-form review to pending', () => {
  assert.match(
    source,
    /resetApplicationFormReviewError/
  );

  assert.match(
    source,
    /review_status:\\s*'pending'/
  );
});
`;

fs.writeFileSync(backendTest, backendTestSource, 'utf8');

const adminTest = path.join(
  adminFrontend,
  'src',
  'pages',
  'DocumentVerification.application-form-correction-v4.test.js'
);

const adminTestSource = `import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL('./DocumentVerification.jsx', import.meta.url),
  'utf8'
);

describe('Application Form correction request', () => {
  it('allows the application form to use the correction action', () => {
    expect(source).toContain(
      'const canRequestReupload = canReviewActiveDocument;'
    );
    expect(source).toContain("'Request Re-edit'");
    expect(source).toContain('FORM_CORRECTION_OPTIONS');
  });
});
`;

fs.writeFileSync(adminTest, adminTestSource, 'utf8');

console.log('\nApplication Form correction workflow v4 applied.\n');
console.log('New rule:');
console.log('  - After submission: Edit Form is disabled');
console.log('  - Admin checks Application Form');
console.log('  - Verified/no issue: Edit remains disabled');
console.log('  - Request Re-edit / correction: Edit Form becomes enabled');
console.log('  - Applicant saves corrected form: Edit locks again');
console.log('  - Admin reviews corrected form again');
console.log('\nAdmin underlying review status remains reupload_required for DB compatibility.');
console.log('Visible Application Form action is Request Re-edit.');
console.log('\nPersonal Statement Read more and Web PDF byte export are preserved.');
console.log('\nNo database migration and no polling added.');

console.log('\nBackups:');
for (const item of backups) console.log(`  ${item}`);

run(
  'dart',
  [
    'format',
    files.preview,
    files.printable,
    files.pdf,
    flutterTest,
  ],
  frontend
);

run('node', ['--check', files.backend], repo);

run(
  'flutter',
  [
    'test',
    'test/application_form_correction_workflow_v4_test.dart',
  ],
  frontend
);

run(
  'node',
  [
    '--test',
    path.join(
      'test',
      'application-form-correction-workflow-v4-contract.test.js'
    ),
  ],
  backend
);

console.log(
  '\nPASS: Application Form correction workflow v4 tests passed.'
);
console.log('\nRecommended: run full flutter test and admin frontend build.');
