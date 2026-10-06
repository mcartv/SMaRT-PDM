// SMaRT-PDM: Document Verification — document Review Policy (admin backend); supports backend application behavior.
const MINOR_REVIEW_STATUS = 'reupload_required';
const MAJOR_REVIEW_STATUS = 'rejected';

// normalizeDocumentReviewStatus: normalizes normalize document review status for the Document Verification flow.
function normalizeDocumentReviewStatus(value = 'pending') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (['verified', 'approved', 'accepted'].includes(normalized)) {
    return 'verified';
  }

  if (
    [
      'reupload_required',
      'requires_reupload',
      'needs_reupload',
      'needs_re_upload',
      'flagged',
    ].includes(normalized)
  ) {
    return MINOR_REVIEW_STATUS;
  }

  if (['rejected', 'denied', 'declined'].includes(normalized)) {
    return MAJOR_REVIEW_STATUS;
  }

  if (['uploaded', 'under_review', 'review'].includes(normalized)) {
    return 'uploaded';
  }

  return 'pending';
}

// normalizeIssueSeverity: normalizes normalize issue severity for the Document Verification flow.
function normalizeIssueSeverity(value, reviewStatus) {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'minor' || normalized === 'major') {
    return normalized;
  }

  if (reviewStatus === MINOR_REVIEW_STATUS) return 'minor';
  if (reviewStatus === MAJOR_REVIEW_STATUS) return 'major';

  return null;
}

// normalizeReasonCode: normalizes normalize reason code for the Document Verification flow.
function normalizeReasonCode(value) {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || null;
}

// deriveVerificationOutcome: derives derive verification outcome for the Document Verification flow.
function deriveVerificationOutcome(reviews = []) {
  const hasMajor = reviews.some(
    (review) =>
      review.reviewStatus === MAJOR_REVIEW_STATUS &&
      review.issueSeverity === 'major'
  );

  if (hasMajor) return 'rejected';

  const hasMinor = reviews.some(
    (review) => review.reviewStatus === MINOR_REVIEW_STATUS
  );

  if (hasMinor) return 'requires_reupload';

  const allVerified =
    reviews.length > 0 &&
    reviews.every((review) => review.reviewStatus === 'verified');

  if (allVerified) return 'verified';

  return 'pending';
}

// buildReplacementNotification: builds build replacement notification for the Document Verification flow.
function buildReplacementNotification(applicationId) {
  return {
    type: 'Application',
    title: 'Document Replacement Required',
    message:
      'One or more scholarship documents need to be replaced. Open Required Documents to review the administrator remarks and upload corrected files.',
    referenceType: 'application',
    referenceId: applicationId,
  };
}

module.exports = {
  MINOR_REVIEW_STATUS,
  MAJOR_REVIEW_STATUS,
  normalizeDocumentReviewStatus,
  normalizeIssueSeverity,
  normalizeReasonCode,
  deriveVerificationOutcome,
  buildReplacementNotification,
};
