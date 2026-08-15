export const MINOR_REUPLOAD_OPTIONS = [
  { code: 'BLURRY_UNREADABLE', label: 'Blurred or unreadable image' },
  { code: 'INCOMPLETE_DOCUMENT', label: 'Incomplete document or missing page' },
  { code: 'WRONG_DOCUMENT', label: 'Wrong document uploaded by mistake' },
  { code: 'MISSING_SIGNATURE', label: 'Missing signature or required detail' },
  { code: 'OUTDATED_DOCUMENT', label: 'Outdated document that can be replaced' },
  {
    code: 'MISMATCH_NEEDS_CORRECTION',
    label: 'Information mismatch that can be corrected',
  },
  { code: 'OTHER_MINOR', label: 'Other minor issue' },
];

export const MAJOR_REJECTION_OPTIONS = [
  {
    code: 'DOCUMENT_TAMPERING',
    label: 'Suspected edited or manipulated document',
  },
  { code: 'FORGED_DOCUMENT', label: 'Fraudulent or fake document' },
  {
    code: 'FALSIFIED_INFORMATION',
    label: 'Deliberately falsified information',
  },
  {
    code: 'IDENTITY_FRAUD',
    label: 'Document appears to belong to another person',
  },
  {
    code: 'OTHER_MAJOR',
    label: 'Other serious or disqualifying violation',
  },
];

export function deriveRequirementsOutcome(documents = []) {
  const required = documents || [];

  if (
    required.some(
      (document) =>
        document.status === 'rejected' &&
        document.issue_severity === 'major'
    )
  ) {
    return 'rejected';
  }

  if (required.some((document) => document.status === 'reupload_required')) {
    return 'requires_reupload';
  }

  if (
    required.length > 0 &&
    required.every((document) => document.status === 'verified')
  ) {
    return 'verified';
  }

  return 'pending';
}
