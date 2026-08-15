const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(process.argv[2] || process.cwd());
const frontendPath = path.join(
  repoRoot,
  'admin',
  'frontend',
  'src',
  'pages',
  'DocumentVerification.jsx'
);
const backendPath = path.join(
  repoRoot,
  'admin',
  'backend',
  'services',
  'applicationService.js'
);

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Required file not found: ${file}`);
  }
  return fs.readFileSync(file, 'utf8');
}

function replaceRegexOnce(source, regex, replacement, label) {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const globalRegex = new RegExp(regex.source, flags);
  const matches = [...source.matchAll(globalRegex)];

  if (matches.length !== 1) {
    throw new Error(
      `Could not safely apply "${label}". Expected exactly 1 match, found ${matches.length}. No files were written.`
    );
  }

  const match = matches[0];
  return (
    source.slice(0, match.index) +
    (typeof replacement === 'function'
      ? replacement(...match)
      : replacement) +
    source.slice(match.index + match[0].length)
  );
}

function insertBeforeRegexOnce(source, regex, addition, label) {
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
  const globalRegex = new RegExp(regex.source, flags);
  const matches = [...source.matchAll(globalRegex)];

  if (matches.length !== 1) {
    throw new Error(
      `Could not safely apply "${label}". Expected exactly 1 marker, found ${matches.length}. No files were written.`
    );
  }

  const match = matches[0];
  return source.slice(0, match.index) + addition + source.slice(match.index);
}

function replaceBlock(source, startRegex, endRegex, replacement, label) {
  const startMatches = [...source.matchAll(new RegExp(startRegex.source, `${startRegex.flags}g`))];
  if (startMatches.length !== 1) {
    throw new Error(
      `Could not safely apply "${label}". Start marker count=${startMatches.length}. No files were written.`
    );
  }

  const start = startMatches[0].index;
  const tail = source.slice(start);
  const endMatch = tail.match(endRegex);

  if (!endMatch || endMatch.index == null) {
    throw new Error(
      `Could not safely apply "${label}". End marker not found. No files were written.`
    );
  }

  const end = start + endMatch.index;
  return source.slice(0, start) + replacement + source.slice(end);
}

function backupAndWrite(file, content) {
  const backup = `${file}.before-minor-major-review-v2.bak`;
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(file, backup);
  }
  fs.writeFileSync(file, content, 'utf8');
  return backup;
}

let backend = read(backendPath);
let frontend = read(frontendPath);

/* -------------------------------------------------------------------------- */
/* BACKEND                                                                     */
/* -------------------------------------------------------------------------- */

// Add re-upload notification constant if absent.
if (!backend.includes('REUPLOAD_REQUIRED_NOTIFICATION')) {
  backend = insertBeforeRegexOnce(
    backend,
    /^\s*const\s+APPLICATION_DOCUMENT_DEFINITIONS\s*=\s*\[/m,
    `const REUPLOAD_REQUIRED_NOTIFICATION = Object.freeze({
    type: 'Application',
    title: 'Document Replacement Required',
    message:
        'One or more scholarship documents need to be replaced. Open Required Documents to review the administrator remarks and upload corrected files.',
    referenceType: 'application',
});

`,
    're-upload notification constant'
  );
}

// Insert re-upload branch inside buildVerificationOutcomeNotification.
// This v2 patch does NOT depend on exact indentation or surrounding text.
if (!backend.includes("outcome === 'reupload_required'")) {
  backend = replaceRegexOnce(
    backend,
    /function\s+buildVerificationOutcomeNotification\s*\(\s*\{[\s\S]*?\}\s*\)\s*\{([\s\S]*?)\n\}/m,
    (full, body) => {
      const rejectedPattern = /(\s*if\s*\(\s*outcome\s*===\s*['"]rejected['"]\s*\)\s*\{[\s\S]*?\n\s*\})/m;
      if (!rejectedPattern.test(body)) {
        throw new Error(
          'Could not apply "re-upload notification outcome": rejected outcome branch not found. No files were written.'
        );
      }

      const updatedBody = body.replace(
        rejectedPattern,
        `$1

    if (outcome === 'reupload_required') {
        return {
            ...REUPLOAD_REQUIRED_NOTIFICATION,
            referenceId: applicationId,
        };
    }`
      );

      return full.replace(body, updatedBody);
    },
    're-upload notification outcome'
  );
}

// Make upload flow aware of current application state.
if (!/\.select\(\s*['"]application_id,\s*student_id,\s*application_status,\s*verification_status,\s*document_status['"]\s*\)/.test(backend)) {
  backend = replaceRegexOnce(
    backend,
    /\.select\(\s*['"]application_id,\s*student_id['"]\s*\)/,
    `.select('application_id, student_id, application_status, verification_status, document_status')`,
    'load application review state during upload'
  );
}

// Reset review state when a replacement document is uploaded.
if (!backend.includes('Reset the review decision for the replaced document')) {
  backend = insertBeforeRegexOnce(
    backend,
    /^\s*const\s+signedUrl\s*=\s*await\s+getSignedFileUrl\(storagePath\);/m,
    `    // Reset the review decision for the replaced document. A student who
    // responds to a minor re-upload request must return to pending review.
    const resetAt = new Date().toISOString();

    const { error: resetDocumentReviewError } = await supabase
        .from('application_documents')
        .update({
            review_status: 'pending',
            remarks: null,
            notes: null,
            reviewed_by: null,
            reviewed_at: null,
            updated_at: resetAt,
        })
        .eq('application_id', applicationId)
        .eq('document_type', documentName);

    if (resetDocumentReviewError) {
        throw new Error(resetDocumentReviewError.message);
    }

    const { error: resetReviewRowError } = await supabase
        .from('application_document_reviews')
        .update({
            review_status: 'pending',
            admin_comment: '',
            issue_severity: null,
            reason_code: null,
            reviewed_by: null,
            reviewed_at: null,
            updated_at: resetAt,
        })
        .eq('application_id', applicationId)
        .eq('document_name', documentName);

    if (resetReviewRowError) {
        throw new Error(resetReviewRowError.message);
    }

`,
    'reset minor review when replacement is uploaded'
  );
}

// After replacement upload, return a Requires Reupload application to Pending Review.
if (!backend.includes('applicationUploadStatusPatch')) {
  backend = replaceRegexOnce(
    backend,
    /const\s+\{\s*error:\s*applicationUpdateError\s*\}\s*=\s*await\s+supabase\s*\n\s*\.from\(['"]applications['"]\)\s*\n\s*\.update\(\s*\{\s*document_status:\s*nextDocumentStatus,\s*\}\s*\)\s*\n\s*\.eq\(['"]application_id['"],\s*applicationId\);/m,
    `const applicationUploadStatusPatch = {
        document_status: nextDocumentStatus,
    };

    const wasWaitingForReplacement =
        normalizeLookupValue(applicationRecord.application_status) === 'requires reupload' ||
        normalizeLookupValue(applicationRecord.verification_status) === 'requires reupload';

    if (wasWaitingForReplacement) {
        applicationUploadStatusPatch.application_status = 'Pending Review';
        applicationUploadStatusPatch.verification_status = 'pending';
        applicationUploadStatusPatch.is_disqualified = false;
        applicationUploadStatusPatch.rejection_reason = null;
    }

    const { error: applicationUpdateError } = await supabase
        .from('applications')
        .update(applicationUploadStatusPatch)
        .eq('application_id', applicationId);`,
    'return application to pending review after replacement upload'
  );
}

const newNormalizeReviewDecision = `function normalizeReviewDecision(value = 'pending') {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[\\s-]+/g, '_');

    switch (normalized) {
        case 'verified':
        case 'approved':
        case 'accepted':
            return 'verified';

        case 'reupload_required':
        case 'requires_reupload':
        case 'needs_reupload':
        case 'flagged':
            return 'reupload_required';

        case 'rejected':
        case 'denied':
        case 'declined':
            return 'rejected';

        case 'uploaded':
        case 'under_review':
        case 'review':
            return 'uploaded';

        case 'pending':
        case '':
        default:
            return 'pending';
    }
}

function normalizeIssueSeverity(value, reviewStatus) {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'minor' || normalized === 'major') {
        return normalized;
    }

    if (reviewStatus === 'reupload_required') return 'minor';
    if (reviewStatus === 'rejected') return 'major';
    return null;
}

function normalizeReasonCode(value) {
    const normalized = String(value || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    return normalized || null;
}

`;

if (!backend.includes('function normalizeIssueSeverity(')) {
  backend = replaceBlock(
    backend,
    /^function\s+normalizeReviewDecision\s*\(/m,
    /^exports\.saveApplicationVerification\s*=\s*async/m,
    newNormalizeReviewDecision,
    'review decision helpers'
  );
}

const newSaveVerification = `exports.saveApplicationVerification = async (applicationId, payload, user) => {
    const {
        document_reviews = [],
        final_comment = '',
    } = payload || {};

    if (!Array.isArray(document_reviews)) {
        throw buildHttpError(400, 'document_reviews must be an array');
    }

    let reviewedBy = user?.admin_id || null;

    if (!reviewedBy && (user?.user_id || user?.userId)) {
        const authUserId = user.user_id || user.userId;

        const { data: adminProfile, error: adminProfileError } = await supabase
            .from('admin_profiles')
            .select('admin_id')
            .eq('user_id', authUserId)
            .maybeSingle();

        if (adminProfileError) {
            throw new Error(adminProfileError.message);
        }

        reviewedBy = adminProfile?.admin_id || null;
    }

    const reviewedAt = new Date().toISOString();

    const normalizedReviews = document_reviews.map((doc) => {
        const documentKey = normalizeDocumentType(
            doc.document_key || doc.document_type || doc.document_id || doc.id || doc.name
        );
        const reviewStatus = normalizeReviewDecision(doc.status || 'pending');
        const issueSeverity = normalizeIssueSeverity(doc.issue_severity, reviewStatus);
        const reasonCode = normalizeReasonCode(doc.reason_code);

        if (!documentKey || !REQUIRED_REVIEW_DOCUMENT_KEYS.includes(documentKey)) {
            throw buildHttpError(
                400,
                \`Unsupported review document: \${doc.name || doc.document_key || 'unknown'}\`
            );
        }

        if (reviewStatus === 'rejected' && issueSeverity !== 'major') {
            throw buildHttpError(
                400,
                \`A major severity is required before rejecting the entire application for \${doc.name || documentKey}.\`
            );
        }

        return {
            source: doc,
            documentKey,
            documentName: DOCUMENT_TYPE_TO_NAME[documentKey] || doc.name || documentKey,
            reviewStatus,
            issueSeverity,
            reasonCode,
            comment: String(doc.comment || '').trim(),
            url: doc.url || null,
        };
    });

    const reviewByKey = new Map(
        normalizedReviews.map((review) => [review.documentKey, review])
    );

    const missingReviewKeys = REQUIRED_REVIEW_DOCUMENT_KEYS.filter(
        (key) => !reviewByKey.has(key)
    );

    if (missingReviewKeys.length > 0) {
        throw buildHttpError(
            400,
            \`Review all required items before saving: \${missingReviewKeys.join(', ')}\`
        );
    }

    const requiredReviews = REQUIRED_REVIEW_DOCUMENT_KEYS.map(
        (key) => reviewByKey.get(key)
    );

    const pendingReviews = requiredReviews.filter(
        (review) =>
            review.reviewStatus === 'pending' ||
            review.reviewStatus === 'uploaded'
    );

    if (pendingReviews.length > 0) {
        throw buildHttpError(
            400,
            'Review every required item before saving the requirements review.'
        );
    }

    const majorReviews = requiredReviews.filter(
        (review) =>
            review.reviewStatus === 'rejected' &&
            review.issueSeverity === 'major'
    );

    const minorReviews = requiredReviews.filter(
        (review) => review.reviewStatus === 'reupload_required'
    );

    const allVerified = requiredReviews.every(
        (review) => review.reviewStatus === 'verified'
    );

    const verificationStatus =
        majorReviews.length > 0
            ? 'rejected'
            : minorReviews.length > 0
                ? 'requires_reupload'
                : allVerified
                    ? 'verified'
                    : 'pending';

    const reviewRows = normalizedReviews.map((review) => ({
        application_id: applicationId,
        document_key: review.documentKey,
        document_name: review.documentName,
        review_status: review.reviewStatus,
        issue_severity: review.issueSeverity,
        reason_code: review.reasonCode,
        admin_comment: review.comment,
        file_url: review.url,
        reviewed_by: reviewedBy,
        reviewed_at: reviewedAt,
        updated_at: reviewedAt,
    }));

    const { error: reviewError } = await supabase
        .from('application_document_reviews')
        .upsert(reviewRows, {
            onConflict: 'application_id,document_key',
        });

    if (reviewError) {
        console.error('Supabase Review Upsert Error:', reviewError);
        throw new Error(reviewError.message);
    }

    for (const review of normalizedReviews) {
        if (review.documentKey === 'application_form') continue;

        const { error: submittedDocumentError } = await supabase
            .from('application_documents')
            .update({
                is_submitted: !!review.url,
                file_url: review.url,
                review_status: review.reviewStatus,
                notes: review.comment || null,
                remarks: review.comment || null,
                reviewed_by: reviewedBy,
                reviewed_at: reviewedAt,
                updated_at: reviewedAt,
            })
            .eq('application_id', applicationId)
            .eq('document_type', review.documentName);

        if (submittedDocumentError) {
            console.error(
                'Supabase Submitted Document Update Error:',
                submittedDocumentError
            );
            throw new Error(submittedDocumentError.message);
        }
    }

    const summary = {
        verified: requiredReviews.filter(
            (review) => review.reviewStatus === 'verified'
        ).length,
        uploaded: requiredReviews.filter(
            (review) => !!review.url || review.documentKey === 'application_form'
        ).length,
        rejected: majorReviews.length,
        reupload: minorReviews.length,
        pending: pendingReviews.length,
    };

    const applicationUpdatePayload = {
        verification_status: verificationStatus,
    };

    if (verificationStatus === 'verified') {
        applicationUpdatePayload.application_status = 'Pending Review';
        applicationUpdatePayload.document_status = 'Documents Ready';
        applicationUpdatePayload.is_disqualified = false;
        applicationUpdatePayload.rejection_reason = null;
    } else if (verificationStatus === 'requires_reupload') {
        applicationUpdatePayload.application_status = 'Requires Reupload';
        applicationUpdatePayload.document_status = 'Requires Reupload';
        applicationUpdatePayload.is_disqualified = false;
        applicationUpdatePayload.rejection_reason = null;
        applicationUpdatePayload.requirements_verified_at = null;
    } else if (verificationStatus === 'rejected') {
        const majorReason =
            String(final_comment || '').trim() ||
            majorReviews
                .map((review) => review.comment)
                .filter(Boolean)
                .join(' | ') ||
            'Major document violation';

        applicationUpdatePayload.application_status = 'Rejected';
        applicationUpdatePayload.document_status = 'Under Review';
        applicationUpdatePayload.is_disqualified = true;
        applicationUpdatePayload.rejection_reason = majorReason;
        applicationUpdatePayload.requirements_verified_at = null;
    } else {
        applicationUpdatePayload.application_status = 'Pending Review';
        applicationUpdatePayload.document_status = 'Under Review';
        applicationUpdatePayload.is_disqualified = false;
    }

    const { data: updatedApplication, error: applicationUpdateError } =
        await supabase
            .from('applications')
            .update(applicationUpdatePayload)
            .eq('application_id', applicationId)
            .select()
            .single();

    if (applicationUpdateError) {
        console.error(
            'Supabase Application Update Error:',
            applicationUpdateError
        );
        throw new Error(applicationUpdateError.message);
    }

    let finalOutcome = verificationStatus;
    let finalizedApplication = updatedApplication;
    let notification = null;

    if (verificationStatus === 'verified') {
        const requirementsCompletedAt =
            await resolveRequirementsCompletedAt(applicationId);

        const { data: qualifiedApplication, error: qualifiedUpdateError } =
            await supabase
                .from('applications')
                .update({
                    requirements_completed_at:
                        requirementsCompletedAt ||
                        updatedApplication?.submission_date ||
                        reviewedAt,
                    requirements_verified_at: reviewedAt,
                    selection_status: 'Requirements Verified',
                    queue_position: null,
                    waitlist_position: null,
                    activation_status: 'Not Activated',
                })
                .eq('application_id', applicationId)
                .select()
                .single();

        if (qualifiedUpdateError) {
            console.error(
                'SUPABASE QUALIFIED APPLICATION UPDATE ERROR:',
                qualifiedUpdateError
            );
            throw new Error(qualifiedUpdateError.message);
        }

        finalizedApplication = qualifiedApplication;
        finalOutcome = 'requirements_complete';

        await readinessQueueService.syncApplicationReadiness(applicationId);
    }

    if (
        (verificationStatus === 'rejected' ||
            verificationStatus === 'requires_reupload') &&
        updatedApplication?.student_id
    ) {
        const { data: studentRow } = await supabase
            .from('students')
            .select('user_id')
            .eq('student_id', updatedApplication.student_id)
            .maybeSingle();

        if (studentRow?.user_id) {
            notification = await deliverVerificationOutcomeNotification({
                outcome:
                    verificationStatus === 'requires_reupload'
                        ? 'reupload_required'
                        : 'rejected',
                applicationId,
                userId: studentRow.user_id,
                scholarId: null,
            });
        }
    }

    const readiness = await fetchApplicationReadiness(applicationId);
    const detailedApplication = await buildApplicationDetails(applicationId);

    return {
        application: finalizedApplication,
        application_detail: detailedApplication,
        readiness,
        activation: null,
        verification_status: verificationStatus,
        final_outcome: finalOutcome,
        scholar: null,
        notification,
        summary: {
            ...summary,
            progress:
                requiredReviews.length === 0
                    ? 0
                    : Math.round(
                        ((summary.verified +
                            summary.rejected +
                            summary.reupload) /
                            requiredReviews.length) *
                        100
                    ),
        },
        final_comment,
    };
};

`;

if (!backend.includes("verificationStatus === 'requires_reupload'")) {
  backend = replaceBlock(
    backend,
    /^exports\.saveApplicationVerification\s*=\s*async/m,
    /^exports\.markApplicationReviewed\s*=\s*async/m,
    newSaveVerification,
    'server-side minor/major verification policy'
  );
}

/* -------------------------------------------------------------------------- */
/* FRONTEND                                                                    */
/* -------------------------------------------------------------------------- */

if (!frontend.includes('reupload_required: {')) {
  frontend = replaceRegexOnce(
    frontend,
    /(\brejected\s*:\s*\{[\s\S]*?\n\s*\},\s*\n)(\s*uploaded\s*:\s*\{)/m,
    `$1  reupload_required: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: C.orange,
    bg: C.orangeSoft,
    label: 'Needs Re-upload',
  },
$2`,
    're-upload status badge'
  );
}

if (!frontend.includes('MINOR_REUPLOAD_OPTIONS')) {
  const reasonLists = `const MINOR_REUPLOAD_OPTIONS = [
  { code: 'BLURRY_UNREADABLE', label: 'Blurred or unreadable image' },
  { code: 'INCOMPLETE_DOCUMENT', label: 'Incomplete document or missing page' },
  { code: 'WRONG_DOCUMENT', label: 'Wrong document uploaded by mistake' },
  { code: 'MISSING_SIGNATURE', label: 'Missing signature or required detail' },
  { code: 'OUTDATED_DOCUMENT', label: 'Outdated document that can be replaced' },
  { code: 'MISMATCH_NEEDS_CORRECTION', label: 'Information mismatch that can be corrected' },
  { code: 'OTHER_MINOR', label: 'Other minor issue' },
];

const MAJOR_REJECTION_OPTIONS = [
  { code: 'DOCUMENT_TAMPERING', label: 'Suspected edited or manipulated document' },
  { code: 'FORGED_DOCUMENT', label: 'Fraudulent or fake document' },
  { code: 'FALSIFIED_INFORMATION', label: 'Deliberately falsified information' },
  { code: 'IDENTITY_FRAUD', label: 'Document appears to belong to another person' },
  { code: 'OTHER_MAJOR', label: 'Other serious or disqualifying violation' },
];

`;

  // Replace any existing legacy rejection list, otherwise insert before normalizeKey.
  if (/const\s+REJECTION_OPTIONS\s*=\s*\[[\s\S]*?\];/m.test(frontend)) {
    frontend = replaceRegexOnce(
      frontend,
      /const\s+REJECTION_OPTIONS\s*=\s*\[[\s\S]*?\];\s*/m,
      reasonLists,
      'minor and major reason lists'
    );
  } else {
    frontend = insertBeforeRegexOnce(
      frontend,
      /^function\s+normalizeKey\s*\(/m,
      reasonLists,
      'minor and major reason lists'
    );
  }
}

const reviewModal = `function ReviewIssueModal({
  mode,
  onClose,
  onConfirm,
  activeDocName,
}) {
  const isMajor = mode === 'major';
  const options = isMajor ? MAJOR_REJECTION_OPTIONS : MINOR_REUPLOAD_OPTIONS;
  const [selectedCode, setSelectedCode] = useState('');
  const [remarks, setRemarks] = useState('');

  const selected =
    options.find((option) => option.code === selectedCode) || null;

  const handleSubmit = () => {
    if (!selected) return;

    const comment = [
      \`Reason: \${selected.label}\`,
      remarks.trim() ? \`Remarks: \${remarks.trim()}\` : '',
    ]
      .filter(Boolean)
      .join('\\n');

    onConfirm({
      comment,
      reasonCode: selected.code,
      severity: isMajor ? 'major' : 'minor',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg border-stone-200 shadow-xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-stone-800">
              {isMajor ? 'Reject Application' : 'Request Document Re-upload'}
            </h3>
            <p className="text-sm text-stone-500 mt-0.5">
              {activeDocName || 'Selected document'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <CardContent className="p-5 space-y-4">
          <div
            className={\`rounded-xl border px-3 py-3 text-sm leading-relaxed \${
              isMajor
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }\`}
          >
            {isMajor
              ? 'Major action: saving this review will reject the entire scholarship application. Use this only for fraud, document tampering, deliberate falsification, or another serious disqualifying violation.'
              : 'Minor issue: the application stays active. The applicant will be asked to replace this document and can continue after the corrected file is reviewed.'}
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400 mb-2">
              {isMajor ? 'Major violation' : 'Reason for re-upload'}
            </p>

            <div className="space-y-2">
              {options.map((option) => (
                <label
                  key={option.code}
                  className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={isMajor ? 'major_rejection_reason' : 'minor_reupload_reason'}
                    value={option.code}
                    checked={selectedCode === option.code}
                    onChange={() => setSelectedCode(option.code)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-[15px] text-stone-700">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-stone-400 block mb-1.5">
              Admin remarks
            </label>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Optional additional remarks..."
              className="rounded-lg bg-stone-50/50 border-stone-200 resize-none h-20 text-[15px]"
            />
          </div>
        </CardContent>

        <div className="px-5 py-4 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-9 rounded-lg border-stone-200 text-sm"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selected}
            className={\`h-9 rounded-lg text-white text-sm border-none disabled:opacity-50 \${
              isMajor
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }\`}
          >
            {isMajor ? (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Confirm Major Rejection
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Request Re-upload
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

`;

if (!frontend.includes('function ReviewIssueModal(')) {
  if (/function\s+RejectDocumentModal\s*\(/m.test(frontend)) {
    frontend = replaceBlock(
      frontend,
      /^function\s+RejectDocumentModal\s*\(/m,
      /^function\s+StudentCard\s*\(/m,
      reviewModal,
      'minor/major review modal'
    );
  } else {
    frontend = insertBeforeRegexOnce(
      frontend,
      /^function\s+StudentCard\s*\(/m,
      reviewModal,
      'minor/major review modal'
    );
  }
}

// Modal state.
if (!frontend.includes('const [reviewIssueModal, setReviewIssueModal]')) {
  if (/const\s+\[rejectModalOpen,\s*setRejectModalOpen\]\s*=\s*useState\(false\);/.test(frontend)) {
    frontend = replaceRegexOnce(
      frontend,
      /const\s+\[rejectModalOpen,\s*setRejectModalOpen\]\s*=\s*useState\(false\);/,
      `const [reviewIssueModal, setReviewIssueModal] = useState(null);`,
      'review issue modal state'
    );
  } else {
    frontend = insertBeforeRegexOnce(
      frontend,
      /const\s+\[submitting,\s*setSubmitting\]\s*=\s*useState\(false\);/,
      `const [reviewIssueModal, setReviewIssueModal] = useState(null);\n  `,
      'review issue modal state'
    );
  }
}

// Review metadata state.
if (!frontend.includes('const [docReviewMeta, setDocReviewMeta]')) {
  frontend = replaceRegexOnce(
    frontend,
    /(const\s+\[docComments,\s*setDocComments\]\s*=\s*useState\(\{\}\);)/,
    `$1
  const [docReviewMeta, setDocReviewMeta] = useState({});`,
    'document review metadata state'
  );
}

// Persist metadata returned from API into normalized docs.
if (!frontend.includes("rawDoc.issue_severity ||")) {
  frontend = replaceRegexOnce(
    frontend,
    /(admin_comment\s*:\s*rawDoc\.admin_comment\s*\|\|\s*rawDoc\.comment\s*\|\|\s*rawDoc\.remarks\s*\|\|\s*rawDoc\.notes\s*\|\|\s*['"]['"]\s*,)/,
    `$1
      issue_severity:
        rawDoc.issue_severity ||
        (normalizedStatus === 'reupload_required'
          ? 'minor'
          : normalizedStatus === 'rejected'
            ? 'major'
            : null),
      reason_code: rawDoc.reason_code || null,`,
    'normalized review metadata'
  );
}

// Include metadata in projected docs.
if (!frontend.includes('docReviewMeta[d.id]?.issue_severity')) {
  frontend = replaceRegexOnce(
    frontend,
    /(status\s*:\s*docStatuses\[d\.id\]\s*\|\|\s*d\.status\s*\|\|\s*['"]pending['"]\s*,\s*\n\s*admin_comment\s*:\s*docComments\[d\.id\]\s*\|\|\s*['"]['"]\s*,)/m,
    `$1
        issue_severity:
          docReviewMeta[d.id]?.issue_severity ??
          d.issue_severity ??
          null,
        reason_code:
          docReviewMeta[d.id]?.reason_code ??
          d.reason_code ??
          null,`,
    'project review metadata into docs'
  );
}

// Dependency list.
frontend = frontend.replace(
  '[application, docStatuses, docComments, iotOcrResults]',
  '[application, docStatuses, docComments, docReviewMeta, iotOcrResults]'
);

// Add reupload counter if absent.
if (!frontend.includes('const reuploadCount = useMemo(')) {
  frontend = insertBeforeRegexOnce(
    frontend,
    /^\s*const\s+reviewedCount\s*=\s*useMemo\(/m,
    `  const reuploadCount = useMemo(
    () => docs.filter((d) => d.status === 'reupload_required').length,
    [docs]
  );

`,
    're-upload counter'
  );
}

// Derive final status safely.
if (!frontend.includes('const hasMajorRejection = requiredDocs.some(')) {
  frontend = replaceRegexOnce(
    frontend,
    /const\s+finalVerificationStatus\s*=\s*allRequiredDocsVerified\s*\?\s*['"]verified['"]\s*:\s*['"]rejected['"]\s*;/m,
    `const hasMajorRejection = requiredDocs.some(
    (d) => d.status === 'rejected'
  );
  const hasReuploadRequest = requiredDocs.some(
    (d) => d.status === 'reupload_required'
  );

  const finalVerificationStatus =
    hasMajorRejection
      ? 'rejected'
      : hasReuploadRequest
        ? 'requires_reupload'
        : allRequiredDocsVerified
          ? 'verified'
          : 'pending';`,
    'derive minor/major final review status'
  );
}

// Extend updater with metadata if not already extended.
if (!frontend.includes('reviewMeta = null')) {
  frontend = replaceBlock(
    frontend,
    /^\s*const\s+updateActiveDocStatus\s*=/m,
    /^\s*const\s+handleVerify\s*=/m,
    `  const updateActiveDocStatus = (
    nextStatus,
    nextComment = null,
    reviewMeta = null
  ) => {
    if (!activeDoc || !hasUploadedDocument) return;

    const resolvedComment = nextComment !== null ? nextComment : comment;

    if (typeof dirtyReviewIdsRef !== 'undefined') {
      dirtyReviewIdsRef.current?.add?.(activeDoc.id);
    }

    setDocStatuses((prev) => ({
      ...prev,
      [activeDoc.id]: nextStatus,
    }));

    setDocComments((prev) => ({
      ...prev,
      [activeDoc.id]: resolvedComment,
    }));

    setDocReviewMeta((prev) => ({
      ...prev,
      [activeDoc.id]: reviewMeta || {
        issue_severity: null,
        reason_code: null,
      },
    }));

    setComment(resolvedComment);
  };

`,
    'review status update metadata'
  );
}

// Replace verify/reject handlers with minor/major handlers.
if (!frontend.includes('handleRequestReuploadConfirm')) {
  frontend = replaceBlock(
    frontend,
    /^\s*const\s+handleVerify\s*=/m,
    /^\s*const\s+handleRunIotOcr\s*=/m,
    `  const handleVerify = () => {
    if (requirementsReviewAlreadySaved) return;

    updateActiveDocStatus('verified', '', {
      issue_severity: null,
      reason_code: null,
    });
  };

  const handleRequestReuploadConfirm = ({
    comment: nextComment,
    reasonCode,
  }) => {
    if (requirementsReviewAlreadySaved) return;

    updateActiveDocStatus('reupload_required', nextComment, {
      issue_severity: 'minor',
      reason_code: reasonCode,
    });
    setReviewIssueModal(null);
  };

  const handleMajorRejectConfirm = ({
    comment: nextComment,
    reasonCode,
  }) => {
    if (requirementsReviewAlreadySaved) return;

    updateActiveDocStatus('rejected', nextComment, {
      issue_severity: 'major',
      reason_code: reasonCode,
    });
    setReviewIssueModal(null);
  };

`,
    'minor/major document handlers'
  );
}

// Patch payload fields and derive server-trusted status.
// Instead of replacing the whole function, patch the payload and summary.
frontend = frontend.replace(
  /verification_status:\s*finalVerificationStatus,/g,
  `verification_status: finalVerificationStatus,`
);

if (!frontend.includes('issue_severity: d.issue_severity || null')) {
  frontend = replaceRegexOnce(
    frontend,
    /(status\s*:\s*d\.status\s*,\s*\n\s*comment\s*:\s*d\.admin_comment\s*\|\|\s*['"]['"]\s*,)/m,
    `$1
          issue_severity: d.issue_severity || null,
          reason_code: d.reason_code || null,`,
    'send review severity and reason'
  );
}

if (!frontend.includes('reupload: reuploadCount')) {
  frontend = replaceRegexOnce(
    frontend,
    /(rejected\s*:\s*rejectedCount\s*,)/,
    `$1
          reupload: reuploadCount,`,
    'send re-upload summary'
  );
}

// Wire minor/major modal render if legacy modal exists.
if (!frontend.includes('<ReviewIssueModal')) {
  if (/\{rejectModalOpen\s*&&\s*\(/m.test(frontend)) {
    frontend = replaceBlock(
      frontend,
      /^\s*\{rejectModalOpen\s*&&\s*\(/m,
      /^\s*<div\s+className=["']flex items-center gap-3["']/m,
      `      {reviewIssueModal && (
        <ReviewIssueModal
          mode={reviewIssueModal}
          onClose={() => setReviewIssueModal(null)}
          onConfirm={
            reviewIssueModal === 'major'
              ? handleMajorRejectConfirm
              : handleRequestReuploadConfirm
          }
          activeDocName={activeDoc?.name}
        />
      )}

`,
      'minor/major review modal render'
    );
  }
}

// Wire action props.
frontend = frontend.replace(
  /onReject=\{\(\)\s*=>\s*setRejectModalOpen\(true\)\}/g,
  `onRequestReupload={() => setReviewIssueModal('minor')}
            onRejectApplication={() => setReviewIssueModal('major')}`
);

// Patch VerificationActions prop signature and buttons.
// We avoid replacing the entire component if local UI has already diverged.
frontend = frontend.replace(
  /onReject,\s*\n/g,
  `onRequestReupload,
  onRejectApplication,
`
);

frontend = frontend.replace(
  /onClick=\{onReject\}/g,
  `onClick={onRejectApplication}`
);

frontend = frontend.replace(
  />\s*Reject\s*<\/Button>/g,
  `>
              Reject Application
            </Button>`
);

// Insert a Request Re-upload button before Reject Application if absent.
if (
  frontend.includes('function VerificationActions') &&
  !frontend.includes('onClick={onRequestReupload}')
) {
  frontend = replaceRegexOnce(
    frontend,
    /(<Button[\s\S]*?onClick=\{onRejectApplication\}[\s\S]*?<\/Button>)/m,
    `<Button
              type="button"
              variant="outline"
              onClick={onRequestReupload}
              disabled={!hasUploadedDocument || requirementsReviewAlreadySaved || submitting || activeDoc?.id === 'application_form'}
              className="h-10 rounded-xl border-stone-200 bg-white text-sm font-medium text-stone-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Request Re-upload
            </Button>

            $1`,
    'request re-upload action button'
  );
}

// Ensure soft refresh also preserves review metadata.
// Add this right before first "!soft" branch if absent.
if (!frontend.includes('setDocReviewMeta((current) => {')) {
  frontend = insertBeforeRegexOnce(
    frontend,
    /^\s*if\s*\(!soft\)\s*\{/m,
    `        setDocReviewMeta((current) => {
          const next = {};

          normalizedDocs.forEach((d) => {
            const preserveLocal =
              soft &&
              typeof dirtyReviewIdsRef !== 'undefined' &&
              dirtyReviewIdsRef.current?.has?.(d.id);

            next[d.id] = preserveLocal
              ? current[d.id] || {
                  issue_severity: d.issue_severity || null,
                  reason_code: d.reason_code || null,
                }
              : {
                  issue_severity: d.issue_severity || null,
                  reason_code: d.reason_code || null,
                };
          });

          return next;
        });

`,
    'soft refresh review metadata preservation'
  );
}

// All transformations succeeded; now write both files.
const backendBackup = backupAndWrite(backendPath, backend);
const frontendBackup = backupAndWrite(frontendPath, frontend);

console.log('');
console.log('Minor/Major document review policy v2 applied successfully.');
console.log('');
console.log('Changed:');
console.log(`  ${backendPath}`);
console.log(`  ${frontendPath}`);
console.log('');
console.log('Backups:');
console.log(`  ${backendBackup}`);
console.log(`  ${frontendBackup}`);
console.log('');
console.log('Next commands:');
console.log('  cd admin\\frontend');
console.log('  npm run build');
console.log('');
console.log('Then restart the admin backend/server.');
