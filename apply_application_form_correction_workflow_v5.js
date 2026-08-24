#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MOBILE_BACKEND_PATCHES = [{"label": "normalize reupload_required review status", "old": "    if (\n        normalized === 'requires reupload' ||", "new": "    if (\n        normalized === 'reupload required' ||\n        normalized === 'requires reupload' ||"}, {"label": "read persisted digital application-form review", "old": "        supabase\n            .from('application_documents')\n            .select('document_id, review_status, reviewed_at')\n            .eq('application_id', application.application_id),", "new": "        supabase\n            .from('application_document_reviews')\n            .select(\n                'document_key, review_status, admin_comment, reason_code, reviewed_at'\n            )\n            .eq('application_id', application.application_id),"}, {"label": "derive explicit application form correction request", "old": "    const documentReviewStarted = (documentReviewResult.data || []).some(\n        (document) => {\n            if (document.reviewed_at) return true;\n\n            const status = safeText(document.review_status)\n                .toLowerCase()\n                .replace(/[_-]+/g, ' ')\n                .replace(/\\s+/g, ' ')\n                .trim();\n\n            return ![\n                '',\n                'uploaded',\n                'pending',\n                'under review',\n            ].includes(status);\n        }\n    );\n\n    const ocrStarted = Number(ocrResult.count || 0) > 0;", "new": "    const reviewRows = documentReviewResult.data || [];\n\n    const applicationFormReview =\n        reviewRows.find(\n            (review) =>\n                normalizeDocumentReviewKey(review.document_key) ===\n                'application_form'\n        ) || null;\n\n    const applicationFormReviewStatus = safeText(\n        applicationFormReview?.review_status\n    )\n        .toLowerCase()\n        .replace(/[\\s-]+/g, '_');\n\n    const applicationFormCorrectionRequested =\n        applicationFormReviewStatus === 'reupload_required';\n\n    const documentReviewStarted = reviewRows.some(\n        (document) => {\n            if (document.reviewed_at) return true;\n\n            const status = safeText(document.review_status)\n                .toLowerCase()\n                .replace(/[_-]+/g, ' ')\n                .replace(/\\s+/g, ' ')\n                .trim();\n\n            return ![\n                '',\n                'uploaded',\n                'pending',\n                'under review',\n            ].includes(status);\n        }\n    );\n\n    const ocrStarted = Number(ocrResult.count || 0) > 0;"}, {"label": "remove unused pendingReview-only gate", "old": "    const pendingReview = applicationStatus === 'pending review';\n    const selectionNotStarted =", "new": "    const selectionNotStarted ="}, {"label": "correction-request-only edit permission", "old": "    const canEdit =\n        pendingReview &&\n        !reviewStarted &&\n        !selectionStarted &&\n        !activated;\n\n    let reason = null;\n\n    if (!pendingReview) {\n        reason =\n            'Editing is unavailable because this application is no longer in Pending Review.';\n    } else if (activated || selectionStarted) {\n        reason =\n            'Editing is unavailable after FCFS selection or scholar activation begins.';\n    } else if (reviewStarted) {\n        reason =\n            'Editing is unavailable because OSFA has already started reviewing this application.';\n    }", "new": "    const terminalApplicationStatus =\n        applicationStatus === 'rejected' ||\n        applicationStatus === 'approved';\n\n    const canEdit =\n        applicationFormCorrectionRequested &&\n        !terminalApplicationStatus &&\n        !selectionStarted &&\n        !activated;\n\n    let reason = null;\n\n    if (terminalApplicationStatus) {\n        reason =\n            'Editing is unavailable because this application is already finalized.';\n    } else if (activated || selectionStarted) {\n        reason =\n            'Editing is unavailable after FCFS selection or scholar activation begins.';\n    } else if (!applicationFormCorrectionRequested) {\n        reason =\n            applicationFormReviewStatus === 'verified'\n                ? 'The application form has been reviewed and no correction was requested.'\n                : 'Editing is locked until OSFA/Admin requests a correction to the application form.';\n    }"}, {"label": "return correction metadata to mobile preview", "old": "        editability: {\n            can_edit: canEdit,\n            review_started: reviewStarted,\n            selection_started: selectionStarted,\n            ocr_started: ocrStarted,\n            reason,\n        },", "new": "        editability: {\n            can_edit: canEdit,\n            correction_requested:\n                applicationFormCorrectionRequested,\n            correction_comment:\n                applicationFormCorrectionRequested\n                    ? safeText(applicationFormReview?.admin_comment) || null\n                    : null,\n            application_form_review_status:\n                applicationFormReviewStatus || 'pending',\n            review_started: reviewStarted,\n            selection_started: selectionStarted,\n            ocr_started: ocrStarted,\n            reason,\n        },"}, {"label": "allow requested correction even after opening closes", "old": "    if (\n        opening.is_archived === true ||\n        opening.posting_status !== 'open'\n    ) {", "new": "    if (\n        !editExistingApplication &&\n        (\n            opening.is_archived === true ||\n            opening.posting_status !== 'open'\n        )\n    ) {"}, {"label": "generic correction label in mobile status summary", "old": "    reupload_required: 'Re-upload Required',", "new": "    reupload_required: 'Correction Required',"}, {"label": "generic correction blocker message", "old": "    'requirements.reupload_required':\n        'One or more requirements need to be re-uploaded before review can continue.',", "new": "    'requirements.reupload_required':\n        'One or more application requirements need correction before review can continue.',"}];
const MOBILE_PREVIEW_PATCHES = [{"label": "correction comment state", "old": "  String? _lockReason;\n  String? _pdfError;\n  String? _error;", "new": "  String? _lockReason;\n  String? _pdfError;\n  String? _correctionComment;\n  String? _error;"}, {"label": "clear correction comment when no application", "old": "          _canEdit = false;\n          _lockReason = null;\n          _error = 'No submitted application is available yet.';", "new": "          _canEdit = false;\n          _lockReason = null;\n          _correctionComment = null;\n          _error = 'No submitted application is available yet.';"}, {"label": "load correction remark", "old": "        _canEdit = editability['can_edit'] == true;\n        _lockReason = _optional(editability['reason']);\n        _loading = false;", "new": "        _canEdit = editability['can_edit'] == true;\n        _lockReason = _optional(editability['reason']);\n        _correctionComment =\n            _optional(editability['correction_comment']);\n        _loading = false;"}, {"label": "dynamic edit status pill", "old": "                      _pill(\n                        icon: Icons.edit_outlined,\n                        text: 'Editing available',\n                      ),", "new": "                      _pill(\n                        icon: _canEdit\n                            ? Icons.edit_note_outlined\n                            : Icons.lock_outline_rounded,\n                        text: _canEdit\n                            ? 'Correction requested'\n                            : 'Editing locked',\n                      ),"}, {"label": "remove redundant update snackbar", "old": "    if (updated == true) {\n      await _load();\n      if (!mounted) return;\n      ScaffoldMessenger.of(context).showSnackBar(\n        const SnackBar(content: Text('Application form updated successfully.')),\n      );\n    }", "new": "    if (updated == true) {\n      await _load();\n    }"}, {"label": "show review notice regardless of current permission", "old": "            if (_data != null && !canEdit) ...[", "new": "            if (_data != null) ...["}, {"label": "correction workflow notice text", "old": "                      child: Text(\n                        'Your application is currently being checked. '\n                        'Editing is temporarily locked. If a correction is '\n                        'needed, OSFA/Admin must return the application before '\n                        'you can edit it.',\n                        style: Theme.of(context).textTheme.bodySmall?.copyWith(\n                          height: 1.35,\n                          fontWeight: FontWeight.w600,\n                        ),\n                      ),", "new": "                      child: Text(\n                        canEdit\n                            ? _correctionComment == null\n                                ? 'OSFA/Admin requested a correction to your application form. '\n                                    'Edit the requested information and save the updated form.'\n                                : 'OSFA/Admin requested a correction to your application form. '\n                                    'Admin remark: $_correctionComment'\n                            : 'Your application form is locked while it is being checked. '\n                                'Edit Form will become available only if OSFA/Admin requests '\n                                'a correction.',\n                        style: Theme.of(context).textTheme.bodySmall?.copyWith(\n                          height: 1.35,\n                          fontWeight: FontWeight.w600,\n                        ),\n                      ),"}];
const ADMIN_FRONTEND_PATCHES = [{"label": "form-specific correction options", "old": "const MAJOR_REJECTION_OPTIONS = [", "new": "const FORM_CORRECTION_OPTIONS = [\n  {\n    code: 'INCOMPLETE_APPLICATION_FORM',\n    label: 'Missing or incomplete application information',\n  },\n  {\n    code: 'MISMATCH_NEEDS_CORRECTION',\n    label: 'Information mismatch that can be corrected',\n  },\n  {\n    code: 'OTHER_MINOR',\n    label: 'Other application form correction',\n  },\n];\n\nconst MAJOR_REJECTION_OPTIONS = ["}, {"label": "form-aware ReviewIssueModal options", "old": "  const isMajor = mode === 'major';\n  const options = isMajor\n    ? MAJOR_REJECTION_OPTIONS\n    : MINOR_REUPLOAD_OPTIONS;", "new": "  const isMajor = mode === 'major';\n  const isApplicationForm = activeDocName === 'Application Form';\n  const options = isMajor\n    ? MAJOR_REJECTION_OPTIONS\n    : isApplicationForm\n      ? FORM_CORRECTION_OPTIONS\n      : MINOR_REUPLOAD_OPTIONS;"}, {"label": "form-aware correction modal title", "old": "              {isMajor\n                ? 'Reject Application'\n                : 'Request Document Re-upload'}", "new": "              {isMajor\n                ? 'Reject Application'\n                : isApplicationForm\n                  ? 'Request Application Form Re-edit'\n                  : 'Request Document Re-upload'}"}, {"label": "form-aware correction modal explanation", "old": "            {isMajor\n              ? 'Major action: saving this review will reject the entire scholarship application. Use this only for fraud, document tampering, deliberate falsification, or another serious disqualifying violation.'\n              : 'Minor issue: the application stays active. The applicant will be asked to replace this document and can continue after the corrected file is reviewed.'}", "new": "            {isMajor\n              ? 'Major action: saving this review will reject the entire scholarship application. Use this only for fraud, document tampering, deliberate falsification, or another serious disqualifying violation.'\n              : isApplicationForm\n                ? 'Correctable issue: the application stays active. After the requirements review is saved, the applicant can re-edit the Application Form and submit it for review again.'\n                : 'Correctable issue: the application stays active. The applicant will be asked to replace this document and can continue after the corrected file is reviewed.'}"}, {"label": "form-aware correction reason label", "old": "              {isMajor ? 'Major violation' : 'Reason for re-upload'}", "new": "              {isMajor\n                ? 'Major violation'\n                : isApplicationForm\n                  ? 'Reason for re-edit'\n                  : 'Reason for re-upload'}"}, {"label": "form-aware modal confirm button", "old": "            ) : (\n              <>\n                <AlertTriangle className=\"w-4 h-4 mr-2\" />\n                Request Re-upload\n              </>\n            )}", "new": "            ) : (\n              <>\n                <AlertTriangle className=\"w-4 h-4 mr-2\" />\n                {isApplicationForm\n                  ? 'Request Re-edit'\n                  : 'Request Re-upload'}\n              </>\n            )}"}, {"label": "allow correction action for digital application form", "old": "  const canRequestReupload =\n    canReviewActiveDocument &&\n    activeDoc?.id !== 'application_form';", "new": "  const canRequestReupload = canReviewActiveDocument;"}, {"label": "form-aware review action label", "old": "              <AlertTriangle className=\"mr-2 h-4 w-4\" />\n              Request Re-upload\n            </Button>", "new": "              <AlertTriangle className=\"mr-2 h-4 w-4\" />\n              {activeDoc?.id === 'application_form'\n                ? 'Request Re-edit'\n                : 'Request Re-upload'}\n            </Button>"}, {"label": "digital form helper copy", "old": "              The application form is digital and cannot be re-uploaded.\n              Use Reject Application only for a serious disqualifying issue.", "new": "              The application form is digital. Use Request Re-edit for\n              correctable information issues. The applicant's Edit Form button\n              unlocks only after this correction request is saved."}, {"label": "application form checklist status wording", "old": "          const meta = getDocumentStatusMeta(d.status);", "new": "          const baseMeta = getDocumentStatusMeta(d.status);\n          const meta =\n            d.id === 'application_form' &&\n            d.status === 'reupload_required'\n              ? { ...baseMeta, label: 'Re-edit Required' }\n              : baseMeta;"}];
const ADMIN_FRONTEND_COPY_PATCHES = [["Waiting for replacement document", "Waiting for applicant correction", "saved correction status title"], ["The applicant has been asked to replace one or more documents. Review can continue after a replacement is uploaded.", "The applicant has been asked to correct one or more application items. Review can continue after the requested correction is submitted.", "saved correction status description"], ["Verify each requirement, request a re-upload for a correctable minor issue, or reject the application only for a serious major violation.", "Verify each requirement, request a correction for a correctable minor issue, or reject the application only for a serious major violation.", "review guidance copy"], ["Replacement document required", "Corrections required", "correction status title"], ["Saving will keep the application active and notify the applicant to replace the affected document.", "Saving will keep the application active and notify the applicant to complete the requested correction or replacement.", "correction status description"], ["Replacement Requested", "Correction Requested", "saved correction button label"], ["Save Re-upload Request", "Save Correction Request", "save correction button label"], ["Re-upload request saved. The application remains active and the applicant has been notified to replace the affected document.", "Correction request saved. The application remains active and the applicant has been notified to complete the requested correction.", "verification success message"], ["Re-upload requested", "Correction requested", "verification feedback title"]];
const ADMIN_BACKEND_PATCHES = [{"label": "generic correction notification", "old": "function buildReplacementNotification(applicationId) {\n    return {\n        type: 'Application',\n        title: 'Document Replacement Required',\n        message:\n            'One or more scholarship documents need to be replaced. Open Required Documents to review the administrator remarks and upload corrected files.',\n        referenceType: 'application',\n        referenceId: applicationId,\n    };\n}", "new": "function buildReplacementNotification(applicationId) {\n    return {\n        type: 'Application',\n        title: 'Application Correction Required',\n        message:\n            'One or more application requirements need correction. Open your application to review the administrator remarks. Re-upload affected documents or edit the Application Form when requested.',\n        referenceType: 'application',\n        referenceId: applicationId,\n    };\n}"}];
const RESET_BLOCK = "\n    // A corrected digital Application Form is now a new review version.\n    // Lock editing again and return only this review item to pending.\n    if (editExistingApplication && application?.application_id) {\n        const correctionSubmittedAt = new Date().toISOString();\n\n        const { error: resetApplicationFormReviewError } = await supabase\n            .from('application_document_reviews')\n            .update({\n                review_status: 'pending',\n                admin_comment: '',\n                issue_severity: null,\n                reason_code: null,\n                reviewed_by: null,\n                reviewed_at: null,\n                updated_at: correctionSubmittedAt,\n            })\n            .eq('application_id', application.application_id)\n            .eq('document_key', 'application_form');\n\n        if (resetApplicationFormReviewError) {\n            throw resetApplicationFormReviewError;\n        }\n\n        const {\n            data: remainingCorrectionRows,\n            error: remainingCorrectionError,\n        } = await supabase\n            .from('application_document_reviews')\n            .select('document_key')\n            .eq('application_id', application.application_id)\n            .eq('review_status', 'reupload_required');\n\n        if (remainingCorrectionError) {\n            throw remainingCorrectionError;\n        }\n\n        const hasRemainingCorrections =\n            (remainingCorrectionRows || []).length > 0;\n\n        const {\n            data: correctedApplication,\n            error: correctedApplicationError,\n        } = await supabase\n            .from('applications')\n            .update({\n                application_status:\n                    hasRemainingCorrections\n                        ? 'Requires Reupload'\n                        : 'Pending Review',\n                verification_status:\n                    hasRemainingCorrections\n                        ? 'requires_reupload'\n                        : 'pending',\n                document_status:\n                    hasRemainingCorrections\n                        ? 'Requires Reupload'\n                        : 'Under Review',\n                is_disqualified: false,\n                rejection_reason: null,\n                requirements_verified_at: null,\n                updated_at: correctionSubmittedAt,\n            })\n            .eq('application_id', application.application_id)\n            .select('*')\n            .single();\n\n        if (correctedApplicationError) {\n            throw correctedApplicationError;\n        }\n\n        application = correctedApplication;\n    }\n\n";

const BACKEND_TEST_CANONICAL = "'use strict';\n\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst fs = require('node:fs');\nconst path = require('node:path');\n\nconst service = fs.readFileSync(\n  path.join(__dirname, '..', 'src', 'services', 'applicationService.js'),\n  'utf8'\n);\n\ntest('application form editing requires an explicit saved correction request', () => {\n  assert.match(service, /application_document_reviews/);\n  assert.match(\n    service,\n    /applicationFormCorrectionRequested[\\s\\S]*applicationFormReviewStatus\\s*===\\s*'reupload_required'/\n  );\n  assert.match(\n    service,\n    /const canEdit\\s*=\\s*applicationFormCorrectionRequested\\s*&&\\s*!terminalApplicationStatus\\s*&&\\s*!selectionStarted\\s*&&\\s*!activated\\s*;/\n  );\n});\n\ntest('ordinary review or OCR does not itself grant edit permission', () => {\n  assert.doesNotMatch(\n    service,\n    /const canEdit\\s*=\\s*pendingReview\\s*&&/\n  );\n  assert.doesNotMatch(\n    service,\n    /const canEdit\\s*=[\\s\\S]{0,120}!reviewStarted/\n  );\n});\n\ntest('submitting a corrected form locks it for re-review', () => {\n  assert.match(service, /resetApplicationFormReviewError/);\n  assert.match(service, /document_key',\\s*'application_form'/);\n  assert.match(service, /review_status:\\s*'pending'/);\n  assert.match(service, /requirements_verified_at:\\s*null/);\n});\n\ntest('editing an existing application may proceed after the opening closes', () => {\n  assert.match(\n    service,\n    /if\\s*\\(\\s*!editExistingApplication\\s*&&\\s*\\(\\s*opening\\.is_archived\\s*===\\s*true\\s*\\|\\|\\s*opening\\.posting_status\\s*!==\\s*'open'/\n  );\n});\n";
const BACKEND_PREVIEW_CONTRACT = "'use strict';\n\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst fs = require('node:fs');\nconst path = require('node:path');\n\nconst root = path.resolve(__dirname, '..');\nconst service = fs.readFileSync(\n  path.join(root, 'src', 'services', 'applicationService.js'),\n  'utf8'\n);\nconst routes = fs.readFileSync(\n  path.join(root, 'src', 'routes', 'applicationRoutes.js'),\n  'utf8'\n);\nconst controller = fs.readFileSync(\n  path.join(root, 'src', 'controllers', 'applicationController.js'),\n  'utf8'\n);\n\ntest('submitted application form preview endpoint is wired', () => {\n  assert.match(\n    routes,\n    /router\\.get\\(\\s*['\"]\\/me\\/submitted-form['\"][\\s\\S]*getMySubmittedFormData/\n  );\n  assert.match(controller, /async function getMySubmittedFormData/);\n  assert.match(service, /async function getMySubmittedFormData/);\n});\n\ntest('submitted form editability is driven by the persisted Application Form review', () => {\n  assert.match(service, /\\.from\\('application_document_reviews'\\)/);\n  assert.match(service, /applicationFormCorrectionRequested/);\n  assert.match(service, /correction_requested:/);\n  assert.match(service, /correction_comment:/);\n});\n\ntest('corrected form submission preserves the existing application and returns it to review', () => {\n  assert.match(\n    service,\n    /editExistingApplication[\\s\\S]*existingEditSnapshot/\n  );\n  assert.match(service, /resetApplicationFormReviewError/);\n  assert.match(service, /application_status:\\s*hasRemainingCorrections/);\n});\n";
const FRONTEND_TEST_CANONICAL = "import 'dart:io';\n\nimport 'package:flutter/widgets.dart';\nimport 'package:flutter_test/flutter_test.dart';\nimport 'package:smartpdm_mobileapp/features/applicant/presentation/screens/application_form_preview_screen.dart';\n\nvoid main() {\n  test('application form preview compiles', () {\n    expect(const ApplicationFormPreviewScreen(), isA<Widget>());\n  });\n\n  test('Edit Form is controlled by backend correction permission', () {\n    final source = File(\n      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',\n    ).readAsStringSync();\n\n    expect(\n      source,\n      contains('final canEdit = _data != null && _canEdit;'),\n    );\n    expect(source, contains('data == null || !_canEdit'));\n    expect(source, contains(\"'Correction requested'\"));\n    expect(source, contains(\"'Editing locked'\"));\n    expect(\n      source,\n      contains(\n        'Edit Form will become available only if OSFA/Admin requests',\n      ),\n    );\n    expect(source, contains(\"_optional(editability['correction_comment'])\"));\n  });\n\n  test('Personal Statement remains collapsible after three lines', () {\n    final source = File(\n      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',\n    ).readAsStringSync();\n\n    expect(source, contains(\"'Read more'\"));\n    expect(source, contains(\"'Show less'\"));\n    expect(source, contains('maxLines: expanded ? null : 3'));\n  });\n\n  test('Edge/Web PDF export remains in-memory', () {\n    final preview = File(\n      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',\n    ).readAsStringSync();\n    final printable = File(\n      'lib/features/forms/data/services/printable_application_service.dart',\n    ).readAsStringSync();\n    final pdf = File(\n      'lib/features/forms/data/services/scholarship_form_pdf_service.dart',\n    ).readAsStringSync();\n\n    expect(preview, contains('XFile.fromData('));\n    expect(preview, contains(\"mimeType: 'application/pdf'\"));\n    expect(preview, contains('generateBytesFromSubmissionPayload('));\n    expect(printable, contains('generateBytesFromSubmissionPayload('));\n    expect(pdf, contains('generateBytesFromSavedApplication('));\n  });\n}\n";
const PDF_TEST_OLD = "    expect(source, contains('generateFromApplicationId(applicationId)'));";
const PDF_TEST_NEW = "    expect(source, contains('generateBytesFromSubmissionPayload('));\n    expect(source, contains('XFile.fromData('));";

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    const required = [
      path.join(dir, 'mobile', 'backend', 'src', 'services', 'applicationService.js'),
      path.join(dir, 'mobile', 'frontend', 'lib', 'features', 'applicant', 'presentation', 'screens', 'application_form_preview_screen.dart'),
      path.join(dir, 'admin', 'frontend', 'src', 'pages', 'DocumentVerification.jsx'),
      path.join(dir, 'admin', 'backend', 'services', 'applicationService.js'),
    ];
    if (required.every((file) => fs.existsSync(file))) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not find the current SMaRT-PDM repository layout. Run this from D:\\projects\\SMaRT-PDM.'
  );
}

function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

function restore(text, crlf) {
  return crlf ? text.replace(/\n/g, '\r\n') : text;
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  return text.split(needle).length - 1;
}

function applyExact(source, patch) {
  if (source.includes(patch.new)) {
    return source;
  }

  const count = countOccurrences(source, patch.old);
  if (count !== 1) {
    throw new Error(
      `Preflight failed for ${patch.label}: expected exactly 1 current-source match, found ${count}. No project files were written.`
    );
  }

  return source.replace(patch.old, patch.new);
}

function applyCopy(source, oldText, newText, label) {
  if (source.includes(newText)) return source;

  const count = countOccurrences(source, oldText);
  if (count < 1) {
    throw new Error(
      `Preflight failed for ${label}: current copy was not found. No project files were written.`
    );
  }

  return source.split(oldText).join(newText);
}

function backup(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = `${file}.bak-application-form-correction-v5-${stamp}`;
  fs.copyFileSync(file, out);
  return out;
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

function writeText(file, text, crlf = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, restore(text, crlf), 'utf8');
}

const repo = findRepoRoot(process.cwd());
const mobileBackendDir = path.join(repo, 'mobile', 'backend');
const mobileFrontendDir = path.join(repo, 'mobile', 'frontend');
const adminBackendDir = path.join(repo, 'admin', 'backend');
const adminFrontendDir = path.join(repo, 'admin', 'frontend');

const files = {
  mobileBackend: path.join(
    mobileBackendDir,
    'src',
    'services',
    'applicationService.js'
  ),
  preview: path.join(
    mobileFrontendDir,
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'application_form_preview_screen.dart'
  ),
  printable: path.join(
    mobileFrontendDir,
    'lib',
    'features',
    'forms',
    'data',
    'services',
    'printable_application_service.dart'
  ),
  pdf: path.join(
    mobileFrontendDir,
    'lib',
    'features',
    'forms',
    'data',
    'services',
    'scholarship_form_pdf_service.dart'
  ),
  adminFrontend: path.join(
    adminFrontendDir,
    'src',
    'pages',
    'DocumentVerification.jsx'
  ),
  adminBackend: path.join(
    adminBackendDir,
    'services',
    'applicationService.js'
  ),
  backendTest1: path.join(
    mobileBackendDir,
    'test',
    'application-edit-during-review-contract.test.js'
  ),
  backendTest2: path.join(
    mobileBackendDir,
    'test',
    'application-edit-review-lock-v2-contract.test.js'
  ),
  backendTest3: path.join(
    mobileBackendDir,
    'test',
    'application-form-preview-edit-contract.test.js'
  ),
  frontendTest1: path.join(
    mobileFrontendDir,
    'test',
    'application_preview_edit_export_readmore_regression_test.dart'
  ),
  frontendTest2: path.join(
    mobileFrontendDir,
    'test',
    'application_preview_review_lock_web_pdf_v2_test.dart'
  ),
  pdfTest: path.join(
    mobileFrontendDir,
    'test',
    'pdf_export_mapping_regression_test.dart'
  ),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(`Preflight failed: required ${name} file is missing: ${file}`);
  }
}

const original = {};
const crlf = {};

for (const [name, file] of Object.entries(files)) {
  original[name] = fs.readFileSync(file, 'utf8');
  crlf[name] = original[name].includes('\r\n');
}

/*
 * Full current-flow preflight.
 * These markers cover the actual persisted review path, mobile edit path,
 * Web PDF path, and Admin verification path. Fail before any write if a local
 * branch has drifted away from the audited repository structure.
 */
const preflightMarkers = [
  [
    original.mobileBackend,
    "async function getMySubmittedFormData(userId)",
    'mobile submitted-form service',
  ],
  [
    original.mobileBackend,
    "async function submitMyApplicationForm(userId, payload = {})",
    'mobile submit service',
  ],
  [
    original.mobileBackend,
    "edit_existing_application",
    'mobile explicit edit mode',
  ],
  [
    original.adminFrontend,
    "id: 'application_form'",
    'Admin digital Application Form checklist item',
  ],
  [
    original.adminFrontend,
    'function ReviewIssueModal({',
    'Admin review issue modal',
  ],
  [
    original.adminFrontend,
    'function VerificationActions({',
    'Admin verification actions',
  ],
  [
    original.adminBackend,
    "application_document_reviews",
    'Admin persisted review table',
  ],
  [
    original.adminBackend,
    'exports.saveApplicationVerification',
    'Admin save verification service',
  ],
  [
    original.preview,
    'Widget _expandableField(String label, String value)',
    'Personal Statement Read more implementation',
  ],
  [
    original.preview,
    'XFile.fromData(',
    'Web-safe in-memory PDF export',
  ],
  [
    original.printable,
    'generateBytesFromSubmissionPayload',
    'printable byte export',
  ],
  [
    original.pdf,
    'generateBytesFromSavedApplication',
    'PDF byte renderer',
  ],
];

for (const [source, marker, label] of preflightMarkers) {
  if (!source.includes(marker)) {
    throw new Error(
      `Preflight failed: ${label} marker was not found. No project files were written.`
    );
  }
}

let mobileBackend = normalize(original.mobileBackend);
let preview = normalize(original.preview);
let adminFrontend = normalize(original.adminFrontend);
let adminBackend = normalize(original.adminBackend);
let pdfTest = normalize(original.pdfTest);

for (const patch of MOBILE_BACKEND_PATCHES) {
  mobileBackend = applyExact(mobileBackend, patch);
}

for (const patch of MOBILE_PREVIEW_PATCHES) {
  preview = applyExact(preview, patch);
}

for (const patch of ADMIN_FRONTEND_PATCHES) {
  adminFrontend = applyExact(adminFrontend, patch);
}

for (const [oldText, newText, label] of ADMIN_FRONTEND_COPY_PATCHES) {
  adminFrontend = applyCopy(adminFrontend, oldText, newText, label);
}

for (const patch of ADMIN_BACKEND_PATCHES) {
  adminBackend = applyExact(adminBackend, patch);
}

/*
 * Insert the correction-resubmission reset immediately before the FINAL
 * successful return of submitMyApplicationForm.
 *
 * This deliberately does NOT parse JavaScript braces/template literals.
 * The failed v3/v4 installers did that and were confused by backtick
 * template strings inside the function. Here we anchor on the unique,
 * audited success literal in the current service.
 */
if (!mobileBackend.includes('resetApplicationFormReviewError')) {
  const successNeedle = "'Application updated successfully.'";
  const successIndex = mobileBackend.indexOf(successNeedle);

  if (successIndex < 0) {
    throw new Error(
      'Preflight failed: submitMyApplicationForm success literal was not found. No project files were written.'
    );
  }

  const returnIndex = mobileBackend.lastIndexOf('\n    return {', successIndex);

  if (returnIndex < 0) {
    throw new Error(
      'Preflight failed: the final submitMyApplicationForm return could not be anchored. No project files were written.'
    );
  }

  const draftDeleteIndex = mobileBackend.lastIndexOf(
    'APPLICATION DRAFT DELETE ERROR:',
    returnIndex
  );

  if (draftDeleteIndex < 0) {
    throw new Error(
      'Preflight failed: final return anchor was not inside the audited submitMyApplicationForm tail. No project files were written.'
    );
  }

  mobileBackend =
    mobileBackend.slice(0, returnIndex) +
    RESET_BLOCK +
    mobileBackend.slice(returnIndex);
}

/* The valuable PDF mapping test had one stale pre-Web-export assertion. */
if (pdfTest.includes(PDF_TEST_NEW)) {
  // already updated
} else if (pdfTest.includes(PDF_TEST_OLD)) {
  pdfTest = pdfTest.replace(PDF_TEST_OLD, PDF_TEST_NEW);
} else {
  throw new Error(
    'Preflight failed: the stale PDF export assertion was not found. No project files were written.'
  );
}

/* Post-transform semantic validation BEFORE any write. */
const validations = [
  [
    mobileBackend.includes(
      ".from('application_document_reviews')"
    ),
    'mobile backend reads application_document_reviews',
  ],
  [
    mobileBackend.includes(
      "applicationFormReviewStatus === 'reupload_required'"
    ),
    'explicit application-form correction permission',
  ],
  [
    /const canEdit\s*=\s*applicationFormCorrectionRequested\s*&&\s*!terminalApplicationStatus\s*&&\s*!selectionStarted\s*&&\s*!activated\s*;/.test(
      mobileBackend
    ),
    'correction-only canEdit rule',
  ],
  [
    mobileBackend.includes('resetApplicationFormReviewError'),
    'corrected form re-lock/reset',
  ],
  [
    mobileBackend.includes('hasRemainingCorrections'),
    'multi-correction preservation',
  ],
  [
    mobileBackend.includes('!editExistingApplication') &&
      mobileBackend.includes("opening.posting_status !== 'open'"),
    'closed-opening correction support',
  ],
  [
    preview.includes(
      "_optional(editability['correction_comment'])"
    ),
    'mobile correction remark',
  ],
  [
    preview.includes("'Correction requested'") &&
      preview.includes("'Editing locked'"),
    'dynamic mobile edit status',
  ],
  [
    preview.includes(
      'Edit Form will become available only if OSFA/Admin requests'
    ),
    'locked-state explanation',
  ],
  [
    preview.includes("'Read more'") &&
      preview.includes("'Show less'"),
    'Personal Statement collapse retained',
  ],
  [
    preview.includes('XFile.fromData(') &&
      preview.includes('generateBytesFromSubmissionPayload('),
    'Web PDF export retained',
  ],
  [
    adminFrontend.includes('FORM_CORRECTION_OPTIONS') &&
      adminFrontend.includes("'Request Re-edit'"),
    'Admin Request Re-edit UI',
  ],
  [
    adminFrontend.includes(
      'const canRequestReupload = canReviewActiveDocument;'
    ),
    'digital form correction action enabled',
  ],
  [
    adminBackend.includes('Application Correction Required'),
    'generic correction notification',
  ],
];

const failed = validations
  .filter(([ok]) => !ok)
  .map(([, label]) => label);

if (failed.length > 0) {
  throw new Error(
    `Validation failed before writing: ${failed.join(', ')}. No project files were written.`
  );
}

/* Now and only now create backups + write. */
const backups = [];
for (const key of [
  'mobileBackend',
  'preview',
  'adminFrontend',
  'adminBackend',
  'backendTest1',
  'backendTest2',
  'backendTest3',
  'frontendTest1',
  'frontendTest2',
  'pdfTest',
]) {
  backups.push(backup(files[key]));
}

writeText(files.mobileBackend, mobileBackend, crlf.mobileBackend);
writeText(files.preview, preview, crlf.preview);
writeText(files.adminFrontend, adminFrontend, crlf.adminFrontend);
writeText(files.adminBackend, adminBackend, crlf.adminBackend);

writeText(
  files.backendTest1,
  BACKEND_TEST_CANONICAL,
  crlf.backendTest1
);
writeText(
  files.backendTest2,
  BACKEND_TEST_CANONICAL,
  crlf.backendTest2
);
writeText(
  files.backendTest3,
  BACKEND_PREVIEW_CONTRACT,
  crlf.backendTest3
);
writeText(
  files.frontendTest1,
  FRONTEND_TEST_CANONICAL,
  crlf.frontendTest1
);
writeText(
  files.frontendTest2,
  FRONTEND_TEST_CANONICAL,
  crlf.frontendTest2
);
writeText(files.pdfTest, pdfTest, crlf.pdfTest);

console.log('\nApplication Form correction workflow v5 applied.');
console.log('\nAudited workflow:');
console.log('  1. Applicant submits -> Edit Form disabled');
console.log('  2. Admin verifies Application Form -> Edit remains disabled');
console.log('  3. Admin Request Re-edit + Save Requirements Review -> Edit enabled');
console.log('  4. Applicant corrects + saves -> Application Form review resets to pending');
console.log('  5. Edit Form disables again until another saved correction request');
console.log('  6. Other document corrections remain intact');
console.log('  7. Existing application can be corrected even if opening later closes');
console.log('\nAlso cleaned contradictory tests left by the earlier edit-policy patches.');
console.log('Personal Statement Read more and Web PDF byte export are retained.');

console.log('\nBackups:');
for (const item of backups) console.log(`  ${item}`);

/* Format Dart files/tests. */
run(
  'dart',
  [
    'format',
    files.preview,
    files.frontendTest1,
    files.frontendTest2,
    files.pdfTest,
  ],
  mobileFrontendDir
);

/* Syntax checks. */
run('node', ['--check', files.mobileBackend], repo);
run('node', ['--check', files.adminBackend], repo);

/* Run every current mobile-backend node:test file, not only the new contract. */
const backendTests = fs
  .readdirSync(path.join(mobileBackendDir, 'test'))
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => path.join('test', name));

if (backendTests.length > 0) {
  run('node', ['--test', ...backendTests], mobileBackendDir);
}

/* Run the complete Flutter suite because stale contradictory tests existed. */
run('flutter', ['test'], mobileFrontendDir);

/* Compile the actual Admin React/JSX tree. */
run('npm', ['run', 'build'], adminFrontendDir);

console.log('\nPASS: correction workflow, full mobile tests, and Admin build passed.');
console.log('\nRestart required:');
console.log('  cd D:\\projects\\SMaRT-PDM\\mobile\\backend');
console.log('  npm start');
