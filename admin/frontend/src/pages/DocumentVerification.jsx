import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useSocketEvent } from '@/hooks/useSocket';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  FileText,
  ChevronRight,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  ScanText,
  ExternalLink,
  Columns2,
  RefreshCw,
  X,
} from 'lucide-react';
import API_BASE_URL from '@/api';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';

const API_BASE = API_BASE_URL;

const C = {
  blue: '#1E3A8A',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  orange: '#d97706',
  orangeSoft: '#FFF7ED',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  bg: '#faf7f2',
  brownMid: '#7c4a2e',
};

const DOC_STATUS_META = {
  verified: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    color: C.green,
    bg: C.greenSoft,
    label: 'Verified',
  },
  pending: {
    icon: <Clock className="w-3.5 h-3.5" />,
    color: C.orange,
    bg: C.orangeSoft,
    label: 'Pending',
  },
  rejected: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    color: C.red,
    bg: C.redSoft,
    label: 'Rejected',
  },
  uploaded: {
    icon: <Clock className="w-3.5 h-3.5" />,
    color: C.blueMid,
    bg: C.blueSoft,
    label: 'Uploaded',
  },
};

const REQUIRED_DOCUMENTS = [
  {
    id: 'birth_certificate',
    name: 'Birth Certificate / PSA',
    aliases: [
      'birth certificate',
      'birth certificate / psa',
      'psa birth certificate',
      'certificate of live birth',
      'psa',
      'nso',
    ],
  },
  {
    id: 'certificate_of_registration',
    name: 'Certificate of Registration',
    aliases: ['cor', 'certificate of registration', 'registration form', 'registration'],
  },
  {
    id: 'student_grade_forms',
    name: 'Grade Report',
    aliases: [
      'student grade forms',
      'grade forms',
      'grade card',
      'grades',
      'grade form',
      'grade report',
      'report card',
    ],
  },
  {
    id: 'certificate_of_indigency',
    name: 'Certificate of Indigency',
    aliases: ['certificate of indigency', 'indigency'],
  },
  {
    id: 'letter_of_request',
    name: 'Letter of Request',
    aliases: ['letter of request', 'request letter', 'lor'],
  },
  {
    id: 'application_form',
    name: 'Application Form',
    aliases: ['application form', 'application'],
  },
];

const OCR_DOCUMENTS = REQUIRED_DOCUMENTS;
const ACTIVE_IOT_OCR_STATUSES = new Set([
  'pending',
  'claimed',
  'previewing',
  'focusing',
  'capturing',
  'processing',
]);

const IOT_OCR_STATUS_POLL_INTERVAL_MS = 500;

const IOT_OCR_STATUS_MESSAGES = {
  pending: 'Waiting for Raspberry Pi',
  claimed: 'Raspberry Pi received the request',
  previewing: 'Position the document on the Raspberry Pi',
  focusing: 'Locking the fixed camera position',
  capturing: 'Capturing once at fixed lens position 1.50',
  processing: 'Preprocessing the capture and running OCR',
  review_required: 'OCR ready for admin review',
  completed: 'OCR confirmed',
  cancelled: 'Capture cancelled',
  failed: 'OCR failed',
  expired: 'OCR request expired',
};

function getActiveIotRequest(document = {}) {
  return document?.iot_ocr_request || document?.ocr_job || null;
}

function isActiveIotRequest(request) {
  return ACTIVE_IOT_OCR_STATUSES.has(
    String(request?.status || '').trim().toLowerCase()
  );
}


// Transitional until document contract status is persisted with OCR snapshots.
// eslint-disable-next-line react-refresh/only-export-components
export const REVIEW_ONLY_DOCUMENT_KEYS = Object.freeze([
  'certificate_of_indigency',
  'student_grade_forms',
]);
// eslint-disable-next-line react-refresh/only-export-components
export const REVIEW_ONLY_MESSAGES = Object.freeze([
  'Structured extraction not implemented',
  'Manual review required',
]);
// eslint-disable-next-line react-refresh/only-export-components
export const APPLICANT_IDENTITY_UNCONFIRMED = 'APPLICANT_IDENTITY_UNCONFIRMED';

const REJECTION_OPTIONS = [
  'Wrong document uploaded',
  'Blurred or unreadable image',
  'Incomplete document',
  'Mismatched student information',
  'Suspected edited or doctored file',
  'Invalid file content',
  'Other',
];

function normalizeKey(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getOcrFailureMessage(error) {
  const raw = String(error?.message || error || '').trim();
  const normalized = raw.toLowerCase();

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network') ||
    normalized.includes('unreachable') ||
    normalized.includes('private network') ||
    normalized.includes('econnrefused')
  ) {
    return 'The OCR device is offline or unreachable. Check that the scanner and backend are connected to the same configured network, then retry. You may continue with manual document review.';
  }

  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out')
  ) {
    return 'The OCR device did not respond in time. Check the device connection and retry, or continue with manual review.';
  }

  if (
    normalized.includes('not configured') ||
    normalized.includes('endpoint url')
  ) {
    return 'The OCR scanner endpoint is not configured on the backend. Set IOT_OCR_ENDPOINT_URL before using the scanner.';
  }

  if (
    normalized.includes('queued') ||
    normalized.includes('in progress')
  ) {
    return 'An OCR request for this document is already queued or being processed. Wait for the current request to finish before retrying.';
  }

  return raw || 'OCR processing failed. Retry the scan or continue with manual review.';
}

function findRequiredDocConfig(rawDoc = {}) {
  const candidates = [
    rawDoc.id,
    rawDoc.document_key,
    rawDoc.name,
    rawDoc.document_name,
    rawDoc.document_type,
    rawDoc.requirement_name,
    rawDoc.label,
    rawDoc.type,
  ]
    .filter(Boolean)
    .map(normalizeKey);

  return OCR_DOCUMENTS.find(
    (cfg) =>
      cfg.aliases.some((alias) => candidates.includes(normalizeKey(alias))) ||
      candidates.includes(normalizeKey(cfg.id))
  );
}

function getDocumentCandidateScore(rawDoc = {}) {
  const resolvedUrl =
    rawDoc.url ||
    rawDoc.signed_url ||
    rawDoc.view_url ||
    rawDoc.document_url ||
    rawDoc.file_url ||
    '';

  const persistedReviewStatus = normalizeKey(
    rawDoc.review_status ||
    rawDoc.status ||
    rawDoc.document_status ||
    ''
  ).replace(/\s+/g, '_');

  let score = 0;

  if (resolvedUrl) score += 100;
  if (rawDoc.file_path) score += 60;
  if (rawDoc.current_version_id) score += 50;
  if (rawDoc.is_submitted === true) score += 40;
  if (rawDoc.submitted_at || rawDoc.uploaded_at) score += 20;
  if (rawDoc.file_name) score += 10;

  if (persistedReviewStatus === 'verified') score += 30;
  else if (persistedReviewStatus === 'rejected') score += 25;
  else if (persistedReviewStatus === 'reupload_required') score += 20;
  else if (persistedReviewStatus === 'under_review') score += 10;
  else if (persistedReviewStatus === 'uploaded') score += 6;

  return score;
}

function normalizeRequiredDocuments(rawDocs = []) {
  const mapped = new Map();

  rawDocs.forEach((rawDoc) => {
    const config = findRequiredDocConfig(rawDoc);
    if (!config) return;

    const resolvedUrl =
      rawDoc.url ||
      rawDoc.signed_url ||
      rawDoc.view_url ||
      rawDoc.document_url ||
      rawDoc.file_url ||
      '';

    const hasUploadedFile = Boolean(
      resolvedUrl ||
      rawDoc.file_path ||
      rawDoc.current_version_id ||
      rawDoc.is_submitted === true ||
      rawDoc.submitted_at ||
      rawDoc.uploaded_at
    );

    const rawStatus = normalizeKey(
      rawDoc.review_status ||
      rawDoc.status ||
      rawDoc.document_status ||
      'pending'
    );

    let normalizedStatus = rawStatus.replace(/\s+/g, '_');
    if (normalizedStatus === 'under_review') normalizedStatus = 'uploaded';
    if (normalizedStatus === 'missing_docs') normalizedStatus = 'pending';
    if (
      hasUploadedFile &&
      ['pending', 'missing', 'missing_docs', ''].includes(normalizedStatus)
    ) {
      normalizedStatus = 'uploaded';
    }

    const candidate = {
      id: config.id,
      document_key: rawDoc.document_key || config.id,
      requirement_id: rawDoc.requirement_id || null,
      document_id: rawDoc.document_id || rawDoc.id || null,
      name: config.name,
      url: resolvedUrl,
      status: normalizedStatus || 'pending',
      admin_comment: rawDoc.admin_comment || rawDoc.comment || rawDoc.remarks || rawDoc.notes || '',
      ocr: rawDoc.ocr || {},
      ocr_confidence: rawDoc.ocr_confidence ?? rawDoc.ocr?.confidence ?? null,
      file_name: rawDoc.file_name || '',
      file_path: rawDoc.file_path || '',
      is_submitted: rawDoc.is_submitted === true || hasUploadedFile,
      current_version_id: rawDoc.current_version_id || null,
      submitted_at: rawDoc.submitted_at || rawDoc.uploaded_at || null,
      reviewed_at: rawDoc.reviewed_at || null,
      iot_ocr_request: rawDoc.iot_ocr_request || rawDoc.ocr_job || null,
      ocr_job: rawDoc.ocr_job || rawDoc.iot_ocr_request || null,
      is_optional_ocr_document: false,
      _candidateScore: getDocumentCandidateScore(rawDoc),
    };

    const existing = mapped.get(config.id);
    if (!existing || candidate._candidateScore > existing._candidateScore) {
      mapped.set(config.id, candidate);
    }
  });

  return OCR_DOCUMENTS.map((cfg) => {
    const document = mapped.get(cfg.id);
    if (document) {
      const { _candidateScore, ...cleanDocument } = document;
      return cleanDocument;
    }

    return {
      id: cfg.id,
      document_key: cfg.id,
      requirement_id: null,
      document_id: null,
      name: cfg.name,
      url: '',
      status: 'pending',
      admin_comment: '',
      ocr: {},
      ocr_confidence: null,
      file_name: '',
      file_path: '',
      is_submitted: false,
      current_version_id: null,
      submitted_at: null,
      reviewed_at: null,
      iot_ocr_request: null,
      ocr_job: null,
      is_optional_ocr_document: false,
    };
  });
}
function getDocumentStatusMeta(status) {
  return DOC_STATUS_META[status] || DOC_STATUS_META.pending;
}

function isDocumentAvailable(document) {
  if (!document) return false;
  if (document.id === 'application_form') return true;

  return Boolean(
    document.url ||
    document.file_path ||
    document.current_version_id ||
    document.is_submitted === true ||
    document.submitted_at
  );
}

function getStructuredOcrFields(document) {
  const structuredFields = document?.ocr?.structured_fields;
  return structuredFields?.fields && typeof structuredFields.fields === 'object'
    ? structuredFields.fields
    : {};
}

function hasStructuredOcrFields(document) {
  return Object.keys(getStructuredOcrFields(document)).length > 0;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getIotOcrRequestId(value = {}) {
  const candidate =
    value?.request_id ||
    value?.id ||
    value?.data?.request_id ||
    value?.data?.id ||
    null;

  return candidate === null || candidate === undefined
    ? null
    : String(candidate);
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildIotOcrSnapshotOverride(snapshot = {}) {
  const ocr = snapshot?.ocr && typeof snapshot.ocr === 'object'
    ? snapshot.ocr
    : {};

  return {
    ocr,
    ocr_confidence:
      snapshot?.ocr_confidence ??
      ocr?.confidence ??
      '',
    iot_ocr_request: snapshot?.iot_ocr_request || null,
    ocr_job: snapshot?.iot_ocr_request || null,
  };
}

function getFileType(document = {}) {
  const raw = (document?.file_name || document?.url || document?.file_path || '').toLowerCase();

  if (
    raw.endsWith('.png') ||
    raw.endsWith('.jpg') ||
    raw.endsWith('.jpeg') ||
    raw.endsWith('.webp') ||
    raw.endsWith('.gif')
  ) {
    return 'image';
  }

  if (raw.endsWith('.pdf')) return 'pdf';
  return 'other';
}

function formatYesNo(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'N/A';
}

function buildFullName(person = {}) {
  return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ') || null;
}

function buildAddress(profile = {}) {
  return [
    profile.street_address,
    profile.subdivision,
    profile.city,
    profile.province,
    profile.zip_code,
  ]
    .filter(Boolean)
    .join(', ') || null;
}

function groupFamilyMembersByRelation(familyMembers = []) {
  const order = ['Father', 'Mother', 'Guardian', 'Sibling'];

  return [...familyMembers].sort((a, b) => {
    const aIndex = order.indexOf(a.relation || '');
    const bIndex = order.indexOf(b.relation || '');
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
}

function groupEducationRecords(educationRecords = []) {
  const order = ['Elementary', 'High School', 'Senior High School', 'College'];

  return [...educationRecords].sort((a, b) => {
    const aIndex = order.indexOf(a.education_level || '');
    const bIndex = order.indexOf(b.education_level || '');
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
}

export function formatOcrConfidence(confidence, scannedViaIot = false) {
  if (confidence === null || confidence === undefined || confidence === '') return 'Unavailable';

  const numericConfidence = Number(confidence);
  if (!Number.isFinite(numericConfidence) || numericConfidence < 0 || numericConfidence > 100) {
    return 'Unavailable';
  }
  if (scannedViaIot === true && numericConfidence === 0.99) return 'Unavailable';

  const percentage = numericConfidence <= 1 ? numericConfidence * 100 : numericConfidence;
  return `${Number(percentage.toFixed(2))}%`;
}

export function buildExtractedData(activeDoc, application) {
  if (!activeDoc) {
    return {
      extractedFields: [],
      confidence: 'Unavailable',
      reviewOnly: false,
      documentValidation: null,
    };
  }

  const student = application?.student || {};
  const ocr = activeDoc?.ocr || {};
  const documentKey = activeDoc.document_key || activeDoc.id;
  const reviewOnly = REVIEW_ONLY_DOCUMENT_KEYS.includes(documentKey);
  const scannedViaIot = ocr.scanned_via_iot === true || activeDoc.scanned_via_iot === true;
  const confidence = ocr.confidence ?? activeDoc.ocr_confidence ?? null;
  const documentValidation = detectBirthCertificateOcr(activeDoc);
  const structuredFields = getStructuredOcrFields(activeDoc);
  const hasStructuredBirthFields =
    activeDoc.id === 'birth_certificate' &&
    Object.keys(structuredFields).length > 0;
  const hasStructuredIndigencyFields =
    documentKey === 'certificate_of_indigency' &&
    Object.keys(structuredFields).length > 0;
  const manualReviewRequired =
    ocr.review_required === true ||
    ocr.structured_fields?.review_required === true ||
    hasStructuredBirthFields ||
    hasStructuredIndigencyFields;
  const identityReview = hasStructuredBirthFields
    ? reviewBirthApplicantIdentity({
      applicantName: student.name,
      childNameRawText: structuredFields.child_name?.raw_text,
      ocrReviewRequired: manualReviewRequired,
    })
    : null;

  const extractedFields = [];

  if (hasStructuredBirthFields) {
    const birthFieldDefinitions = [
      ['child_name', 'Child Name'],
      ['mother_maiden_name', 'Mother’s Maiden Name'],
      ['father_name', 'Father Name'],
    ];

    birthFieldDefinitions.forEach(([fieldKey, label]) => {
      const field = structuredFields[fieldKey];
      const rawText =
        field && typeof field === 'object'
          ? field.raw_text
          : field;

      extractedFields.push({
        label,
        value:
          typeof rawText === 'string' && rawText.trim()
            ? rawText.trim()
            : 'Not extracted',
        badge: 'Provisional OCR',
      });
    });
  } else if (hasStructuredIndigencyFields) {
    const indigencyFieldDefinitions = [
      ['certificate_subject_name', 'Certificate Subject Name'],
      ['residency_address', 'Full Address'],
    ];

    indigencyFieldDefinitions.forEach(([fieldKey, label]) => {
      const field = structuredFields[fieldKey];
      const rawText =
        field && typeof field === 'object'
          ? field.raw_text
          : field;

      extractedFields.push({
        label,
        value:
          typeof rawText === 'string' && rawText.trim()
            ? rawText.trim()
            : 'Not extracted',
        badge: 'Provisional OCR',
      });
    });
  } else if (!reviewOnly && typeof ocr.extracted_name === 'string' && ocr.extracted_name.trim()) {
    extractedFields.push({
      label: 'Extracted Name',
      value: ocr.extracted_name.trim(),
      badge: 'Extracted',
    });
  }

  if (!reviewOnly && ocr.extracted_gwa !== null && ocr.extracted_gwa !== undefined) {
    extractedFields.push({
      label: 'Extracted GWA',
      value: ocr.extracted_gwa,
      badge: 'Extracted',
    });
  }

  if (activeDoc.id === 'birth_certificate' && !hasStructuredBirthFields) {
    extractedFields.push({
      label: 'Document Type Detection',
      value: documentValidation.detectedLabel,
      badge: documentValidation.confidenceLabel,
    });
  }

  return {
    extractedFields,
    confidence: formatOcrConfidence(confidence, scannedViaIot),
    reviewOnly,
    manualReviewRequired,
    identityReview,
    documentValidation,
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildRawOcrSnapshot(activeDoc) {
  if (!activeDoc) return '';

  const ocr = activeDoc?.ocr || {};
  const rawText = String(ocr.raw_text || ocr.text || '').trim();
  if (
    !rawText &&
    activeDoc.id === 'birth_certificate' &&
    hasStructuredOcrFields(activeDoc)
  ) {
    return 'Structured row OCR completed.\nNo combined raw OCR snapshot was supplied.';
  }
  return rawText || '(No OCR text yet)';
}

function normalizeOcrText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIdentityText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// eslint-disable-next-line react-refresh/only-export-components
export function reviewBirthApplicantIdentity({
  applicantName,
  childNameRawText,
  ocrReviewRequired = true,
} = {}) {
  const applicantTokens = [
    ...new Set(normalizeIdentityText(applicantName).split(' ').filter(Boolean)),
  ];
  const childTokens = new Set(
    normalizeIdentityText(childNameRawText).split(' ').filter(Boolean)
  );
  const confirmed =
    applicantTokens.length >= 2 &&
    applicantTokens.every((token) => childTokens.has(token));

  if (confirmed) {
    return {
      status: 'confirmed',
      review_code: null,
      warning: '',
      manual_review_required: ocrReviewRequired === true,
    };
  }

  return {
    status: 'unconfirmed',
    review_code: APPLICANT_IDENTITY_UNCONFIRMED,
    warning:
      'Applicant identity could not be confirmed from the scanned birth certificate. Review the document before verifying or rejecting it.',
    manual_review_required: true,
  };
}

function hasAnyMarker(normalizedText, markers = []) {
  return markers.some((marker) => normalizedText.includes(normalizeOcrText(marker)));
}

function detectBirthCertificateOcr(activeDoc) {
  const ocr = activeDoc?.ocr || {};
  const rawText = String(ocr.raw_text || ocr.text || '').trim();
  const normalizedText = normalizeOcrText(rawText);
  const expectedBirthCertificate = activeDoc?.id === 'birth_certificate';
  const structuredFields = getStructuredOcrFields(activeDoc);
  const structuredFieldCount = Object.keys(structuredFields).length;

  if (expectedBirthCertificate && structuredFieldCount > 0) {
    return {
      shouldShow: true,
      expectedBirthCertificate: true,
      detectedBirthCertificate: true,
      structuredResult: true,
      panelTitle: 'Birth Certificate OCR Processing',
      detectedLabel: 'Structured row OCR completed',
      confidenceLabel: 'Manual Review',
      tone: 'amber',
      warning: 'All extracted birth fields are provisional and require administrator review.',
      rows: [
        { label: 'Document processing', value: 'Completed', found: true },
        { label: 'Review state', value: 'Manual review required', found: true },
        { label: 'Extracted fields', value: String(structuredFieldCount), found: true },
      ],
    };
  }

  if (!rawText) {
    return {
      shouldShow: expectedBirthCertificate,
      expectedBirthCertificate,
      detectedBirthCertificate: false,
      structuredResult: false,
      panelTitle: 'Birth Certificate / PSA Detection',
      detectedLabel: 'No OCR text yet',
      confidenceLabel: 'Unavailable',
      tone: 'amber',
      warning: expectedBirthCertificate
        ? 'Run IoT OCR or paste OCR text to validate if this is a PSA/Birth Certificate.'
        : '',
      rows: [
        { label: 'OCR Text', value: 'No OCR text yet', found: false },
      ],
    };
  }

  const certificateMarkers = [
    'certificate of live birth',
    'birth certificate',
    'live birth',
  ];

  const psaMarkers = [
    'philippine statistics authority',
    'psa',
    'national statistics office',
    'nso',
  ];

  const civilRegistryMarkers = [
    'office of the civil registrar',
    'local civil registrar',
    'civil registrar',
    'civil registry',
    'registry number',
    'civil registry number',
  ];

  const childMarkers = [
    'name of child',
    'child',
    'first name',
    'middle name',
    'last name',
  ];

  const birthDetailMarkers = [
    'date of birth',
    'date born',
    'place of birth',
    'sex',
    'male',
    'female',
  ];

  const parentMarkers = [
    'mother',
    'father',
    'maiden name',
    'parents',
  ];

  const hasCertificateMarker = hasAnyMarker(normalizedText, certificateMarkers);
  const hasPsaMarker = hasAnyMarker(normalizedText, psaMarkers);
  const hasCivilRegistryMarker = hasAnyMarker(normalizedText, civilRegistryMarkers);
  const hasChildMarker = hasAnyMarker(normalizedText, childMarkers);
  const hasBirthDetailMarker = hasAnyMarker(normalizedText, birthDetailMarkers);
  const hasParentMarker = hasAnyMarker(normalizedText, parentMarkers);

  const score = [
    hasCertificateMarker,
    hasPsaMarker,
    hasCivilRegistryMarker,
    hasChildMarker,
    hasBirthDetailMarker,
    hasParentMarker,
  ].filter(Boolean).length;

  const detectedBirthCertificate =
    hasCertificateMarker ||
    (hasPsaMarker && score >= 3) ||
    (hasCivilRegistryMarker && score >= 3);

  let confidenceLabel = 'Low';
  if (score >= 5) confidenceLabel = 'High';
  else if (score >= 3) confidenceLabel = 'Moderate';

  let warning = '';

  if (expectedBirthCertificate && detectedBirthCertificate) {
    warning = 'OCR text contains PSA/Birth Certificate markers. Continue manual review before verifying.';
  } else if (expectedBirthCertificate && !detectedBirthCertificate) {
    warning = 'This OCR text does not strongly match a PSA/Birth Certificate. Reject if the uploaded document is wrong.';
  } else if (!expectedBirthCertificate && detectedBirthCertificate) {
    warning = `OCR text looks like a PSA/Birth Certificate, but the selected document is ${activeDoc?.name || 'another requirement'}. This may be a wrong upload.`;
  }

  return {
    shouldShow: expectedBirthCertificate || detectedBirthCertificate,
    expectedBirthCertificate,
    detectedBirthCertificate,
    structuredResult: false,
    panelTitle: 'Birth Certificate / PSA Detection',
    detectedLabel: detectedBirthCertificate
      ? 'Likely Birth Certificate / PSA'
      : 'Birth Certificate / PSA not detected',
    confidenceLabel,
    tone: detectedBirthCertificate ? 'green' : 'red',
    warning,
    rows: [
      {
        label: 'Certificate Marker',
        value: hasCertificateMarker ? 'Found' : 'Not found',
        found: hasCertificateMarker,
      },
      {
        label: 'PSA / NSO Marker',
        value: hasPsaMarker ? 'Found' : 'Not found',
        found: hasPsaMarker,
      },
      {
        label: 'Civil Registry Marker',
        value: hasCivilRegistryMarker ? 'Found' : 'Not found',
        found: hasCivilRegistryMarker,
      },
      {
        label: 'Child Name Marker',
        value: hasChildMarker ? 'Found' : 'Not found',
        found: hasChildMarker,
      },
      {
        label: 'Birth Details Marker',
        value: hasBirthDetailMarker ? 'Found' : 'Not found',
        found: hasBirthDetailMarker,
      },
      {
        label: 'Parent Details Marker',
        value: hasParentMarker ? 'Found' : 'Not found',
        found: hasParentMarker,
      },
    ],
  };
}

function InfoRow({ label, value, mono, className = '' }) {
  const displayValue = value === undefined || value === null || value === '' ? 'N/A' : value;

  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wider text-stone-400 mb-0.5">
        {label}
      </p>
      <p className={`text-[15px] ${mono ? 'font-mono text-stone-600' : 'font-medium text-stone-800'}`}>
        {displayValue}
      </p>
    </div>
  );
}

function ApplicationFormPreview({ application }) {
  const student = application?.student || {};
  const profile = application?.student_profile || {};
  const familyMembers = groupFamilyMembersByRelation(application?.family_members || []);
  const educationRecords = groupEducationRecords(application?.education_records || []);
  const fullAddress = buildAddress(profile);

  return (
    <div className="w-full h-[520px] overflow-y-auto bg-white border border-stone-200 rounded-lg p-4">
      <h3 className="text-[15px] font-semibold text-stone-800 mb-3">Application Form Summary</h3>

      <div className="space-y-5 text-[15px] text-stone-700">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-400 mb-2">
            Student Overview
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoRow label="Student Name" value={student.name} />
            <InfoRow label="PDM ID" value={student.pdm_id} />
            <InfoRow label="Program" value={student.program} />
            <InfoRow label="Course" value={student.course} />
            <InfoRow label="Academic Year" value={student.year} />
            <InfoRow label="GWA" value={student.gwa} mono />
            <InfoRow label="Email Address" value={student.email} />
            <InfoRow label="Phone Number" value={student.phone} />
          </div>
        </div>

        <div className="border-t border-stone-100 pt-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-400 mb-2">
            Personal Profile
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <InfoRow label="Date of Birth" value={profile.date_of_birth} />
            <InfoRow label="Place of Birth" value={profile.place_of_birth} />
            <InfoRow label="Sex" value={profile.sex} />
            <InfoRow label="Civil Status" value={profile.civil_status} />
            <InfoRow label="Maiden Name" value={profile.maiden_name} />
            <InfoRow label="Religion" value={profile.religion} />
            <InfoRow label="Citizenship" value={profile.citizenship} />
            <InfoRow label="Landline Number" value={profile.landline_number} />
            <InfoRow label="Learner's Reference Number" value={profile.learners_reference_number} />
            <InfoRow label="Financial Support Type" value={profile.financial_support_type} />
            <InfoRow label="Financial Support (Other)" value={profile.financial_support_other} />
            <InfoRow label="Prior Scholarship" value={formatYesNo(profile.has_prior_scholarship)} />
            <InfoRow
              label="Prior Scholarship Details"
              value={profile.prior_scholarship_details}
              className="md:col-span-2"
            />
            <InfoRow
              label="Disciplinary Record"
              value={formatYesNo(profile.has_disciplinary_record)}
            />
            <InfoRow
              label="Disciplinary Details"
              value={profile.disciplinary_details}
              className="md:col-span-2"
            />
            <InfoRow label="Complete Address" value={fullAddress} className="md:col-span-2" />
            <InfoRow
              label="Self Description"
              value={profile.self_description}
              className="md:col-span-2"
            />
            <InfoRow
              label="Aims and Ambitions"
              value={profile.aims_and_ambitions}
              className="md:col-span-2"
            />
            <InfoRow
              label="Applicant Signature URL"
              value={profile.applicant_signature_url}
              className="md:col-span-2"
            />
            <InfoRow
              label="Guardian Signature URL"
              value={profile.guardian_signature_url}
              className="md:col-span-2"
            />
          </div>
        </div>

        <div className="border-t border-stone-100 pt-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-400 mb-2">
            Family Background
          </p>

          {familyMembers.length ? (
            <div className="space-y-3">
              {familyMembers.map((member, index) => {
                const fullName = buildFullName(member);

                return (
                  <div
                    key={`${member.family_id || index}`}
                    className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="font-semibold text-stone-800">
                        {member.relation || `Family Member ${index + 1}`}
                      </p>
                      <p className="text-sm text-stone-500">{fullName || 'No name provided'}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <InfoRow label="Last Name" value={member.last_name} />
                      <InfoRow label="First Name" value={member.first_name} />
                      <InfoRow label="Middle Name" value={member.middle_name} />
                      <InfoRow label="Mobile Number" value={member.mobile_number} />
                      <InfoRow
                        label="Highest Educational Attainment"
                        value={member.highest_educational_attainment}
                      />
                      <InfoRow label="Occupation" value={member.occupation} />
                      <InfoRow label="Company Name / Address" value={member.company_name_address} />
                      <InfoRow
                        label="Marilao Native"
                        value={formatYesNo(member.is_marilao_native)}
                      />
                      <InfoRow label="Years as Resident" value={member.years_as_resident} />
                      <InfoRow label="Origin Province" value={member.origin_province} />
                      <InfoRow label="Address" value={member.address} className="md:col-span-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-stone-400">No family records found.</p>
          )}
        </div>

        <div className="border-t border-stone-100 pt-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-stone-400 mb-2">
            Educational Background
          </p>

          {educationRecords.length ? (
            <div className="space-y-3">
              {educationRecords.map((record, index) => (
                <div
                  key={`${record.education_id || index}`}
                  className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="font-semibold text-stone-800">
                      {record.education_level || `Education Record ${index + 1}`}
                    </p>
                    <p className="text-sm text-stone-500">
                      {record.school_name || 'No school name provided'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InfoRow label="Education Level" value={record.education_level} />
                    <InfoRow label="School Name" value={record.school_name} />
                    <InfoRow label="School Address" value={record.school_address} />
                    <InfoRow label="Honors / Awards" value={record.honors_awards} />
                    <InfoRow label="Club / Organization" value={record.club_organization} />
                    <InfoRow label="Year Graduated" value={record.year_graduated} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400">No education records found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function inferPreviewMimeType(document = {}, responseContentType = '') {
  const responseType = String(responseContentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (responseType.startsWith('image/') || responseType === 'application/pdf') {
    return responseType;
  }

  const source = [
    document.file_name,
    document.file_path,
    document.url,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (source.includes('.pdf')) return 'application/pdf';
  if (source.includes('.png')) return 'image/png';
  if (source.includes('.webp')) return 'image/webp';
  if (source.includes('.jpeg') || source.includes('.jpg')) return 'image/jpeg';
  if (source.includes('.gif')) return 'image/gif';

  return 'application/octet-stream';
}

function DocumentPreviewPanel({ activeDoc, application }) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewMimeType, setPreviewMimeType] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';

    const loadPreview = async () => {
      setPreviewError('');
      setPreviewUrl('');
      setPreviewMimeType('');

      if (!activeDoc?.url || activeDoc?.id === 'application_form') return;

      try {
        setPreviewLoading(true);

        const response = await fetch(activeDoc.url, {
          method: 'GET',
          cache: 'no-store',
          redirect: 'follow',
        });

        if (!response.ok) {
          const payload = await response.text().catch(() => '');
          throw new Error(payload || `Preview failed with status ${response.status}.`);
        }

        const bytes = await response.arrayBuffer();
        if (!bytes.byteLength) throw new Error('The uploaded document is empty.');

        const mimeType = inferPreviewMimeType(
          activeDoc,
          response.headers.get('content-type') || ''
        );

        if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
          throw new Error('This file type cannot be previewed. Re-upload it as PDF, JPG, JPEG, PNG, or WEBP.');
        }

        const blob = new Blob([bytes], { type: mimeType });
        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setPreviewMimeType(mimeType);
          setPreviewUrl(objectUrl);
        }
      } catch (error) {
        if (!cancelled) {
          setPreviewError(error?.message || 'The document preview could not be loaded.');
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeDoc?.id, activeDoc?.url, activeDoc?.file_name, activeDoc?.file_path]);

  const isImage = previewMimeType.startsWith('image/');
  const isPdf = previewMimeType === 'application/pdf';

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-base font-semibold text-stone-900">
              {activeDoc?.name || 'Document'}
            </h4>
            <p className="truncate text-[15px] text-stone-500">
              {activeDoc?.id === 'application_form'
                ? 'Submitted application data'
                : activeDoc?.file_name || 'Secure preview'}
            </p>
          </div>
        </div>

        <Badge className={activeDoc?.url || activeDoc?.id === 'application_form'
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-stone-200 bg-stone-100 text-stone-500'}>
          {activeDoc?.url || activeDoc?.id === 'application_form' ? 'Available' : 'Missing'}
        </Badge>
      </header>

      <div className="flex min-h-[560px] items-center justify-center bg-[#f8fafc] p-3 sm:p-4">
        {activeDoc?.id === 'application_form' ? (
          <ApplicationFormPreview application={application} />
        ) : previewLoading ? (
          <div className="flex flex-col items-center gap-3 text-stone-500">
            <Loader2 className="h-7 w-7 animate-spin text-blue-700" />
            <p className="text-[15px]">Loading secure preview…</p>
          </div>
        ) : previewError ? (
          <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <AlertTriangle className="mx-auto h-7 w-7 text-amber-600" />
            <p className="mt-3 text-[15px] font-semibold text-amber-900">Preview unavailable</p>
            <p className="mt-1 break-words text-[15px] leading-relaxed text-amber-700">{previewError}</p>
          </div>
        ) : previewUrl && isImage ? (
          <div className="flex h-[560px] w-full items-center justify-center overflow-auto rounded-xl border border-stone-200 bg-white p-3">
            <img
              src={previewUrl}
              alt={activeDoc?.name || 'Uploaded document'}
              className="max-h-full max-w-full select-none object-contain"
              draggable={false}
              onError={() => setPreviewError('The image could not be decoded. Re-upload a valid image file.')}
            />
          </div>
        ) : previewUrl && isPdf ? (
          <iframe
            src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
            title={activeDoc?.name || 'PDF preview'}
            className="h-[560px] w-full rounded-xl border border-stone-200 bg-white"
          />
        ) : (
          <div className="w-full max-w-sm rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-500">
              <FileText className="h-6 w-6" />
            </div>
            <h4 className="mt-4 text-base font-semibold text-stone-800">No document uploaded</h4>
            <p className="mt-1 text-[15px] leading-relaxed text-stone-500">
              The applicant has not submitted this requirement yet.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

const GRADE_REVIEW_FIELDS = [
  ['student_number', 'Student Number'],
  ['student_name', 'Student Name'],
  ['course', 'Course'],
  ['semester', 'Semester'],
  ['academic_year', 'Academic Year'],
];

const INDIGENCY_REVIEW_FIELDS = [
  ['certificate_subject_name', 'Certificate Subject Name'],
  ['residency_address', 'Full Address'],
];

function ocrFieldValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value.normalized_value ?? value.raw_text ?? value.value ?? '';
  }
  return value ?? '';
}

function deriveGradeReviewValues(rawText) {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim();
  const derived = {};
  if (!text) return derived;

  const number = text.match(/\b((?:PDM[-\s]?)?\d{4}[-\s]\d{4,7})\b/i);
  if (number) derived.student_number = number[1].replace(/\s+/g, '-').toUpperCase();

  const identity = text.match(
    /STUDENT\s+NUMBER\s+STUDENT\s+NAME\s+COURSE\s*[:|\-]?\s*(?:PDM[-\s]?)?\d{4}[-\s]\d{4,7}\s+(.+?)\s+COPY\s+OF\s+GRADE(?:\s*FOR)?\b/i
  );
  if (identity) {
    const parts = identity[1]
      .replace(/\s+,/g, ',')
      .trim()
      .match(/^(.+?)\s+((?:BS|AB|B)[A-Z][A-Z0-9.-]{1,12})$/i);
    if (parts) {
      derived.student_name = parts[1];
      derived.course = parts[2];
    }
  }

  const period = text.match(
    /GRADE\s*FOR\s+THE\s+PERIOD\s*[:\-]?\s*(1ST|2ND|FIRST|SECOND|SUMMER)?(?:\s+SEMESTER)?\s+(\d{4}\s*[-–]\s*\d{4})/i
  );
  if (period) {
    derived.semester = {
      '1ST': '1st Semester',
      '2ND': '2nd Semester',
      'FIRST': 'First Semester',
      'SECOND': 'Second Semester',
      'SUMMER': 'Summer',
    }[String(period[1] || '').toUpperCase()] || '';
    derived.academic_year = period[2].replace(/\s*[-–]\s*/g, '-');
  }

  const gwa = text.match(/\bGWA\s*[:;=\-]?\s*([1-5](?:[.,]\d{1,2})?)\b/i);
  if (gwa) derived.gwa = gwa[1].replace(',', '.');
  return derived;
}

function deriveIndigencyReviewValues(rawText) {
  const text = String(rawText || '').replace(/\s+/g, ' ').trim();
  const derived = {};
  if (!text) return derived;

  const subject = text.match(
    /Certificate\s+Subject\s+Name\s*[:\-]?\s*(.+?)(?=\s+Full\s+Address\s*[:\-]?|\s+Issue\s+Date\s*[:\-]?|\s+Issuing\s+Barangay\s*[:\-]?|$)/i
  );
  if (subject) derived.certificate_subject_name = subject[1].replace(/\s+,/g, ',').trim();

  const address = text.match(
    /Full\s+Address\s*[:\-]?\s*(.+?)(?=\s+Issue\s+Date\s*[:\-]?|\s+Issuing\s+Barangay\s*[:\-]?|$)/i
  );
  if (address) derived.residency_address = address[1].trim();

  return derived;
}

function normalizeReviewFields(candidate) {
  const fields = candidate?.fields || {};
  if (candidate?.document_key === 'student_grade_forms') {
    const derived = deriveGradeReviewValues(candidate?.raw_text);
    return {
      ...Object.fromEntries(GRADE_REVIEW_FIELDS.map(([key]) => [
        key,
        ocrFieldValue(fields[key]) || derived[key] || '',
      ])),
      gwa: ocrFieldValue(fields.gwa) || derived.gwa || '',
      subjects: Array.isArray(fields.subjects) ? fields.subjects : [],
    };
  }
  if (candidate?.document_key === 'certificate_of_indigency') {
    const derived = deriveIndigencyReviewValues(candidate?.raw_text);
    return Object.fromEntries(INDIGENCY_REVIEW_FIELDS.map(([key]) => [
      key,
      ocrFieldValue(fields[key]) || derived[key] || '',
    ]));
  }
  return fields;
}

function ocrScoreLabel(candidate, key, displayedValue) {
  const numeric = Number(candidate?.field_confidence?.[key]);
  if (Number.isFinite(numeric) && numeric >= 0) return `${numeric.toFixed(1)}%`;
  return String(displayedValue || '').trim() ? 'Detected' : '—';
}

function OCRPanel({
  activeDoc,
  extractedData,
  onRunIotOcr,
  runningIotOcr,
  iotOcrStatus,
  iotOcrError,
  rawOcrSnapshot,
  reviewCandidate,
  correctedFields,
  onCorrectedFieldsChange,
  onConfirmCandidate,
  onRetryCandidate,
  reviewingCandidate,
  piOnline,
  piAvailabilityChecked,
  onCancelIotOcr,
  cancellingIotOcr,
  cancelSupported,
}) {
  const canRunIotOcr = activeDoc?.id !== 'application_form';
  const isGradeReview = activeDoc?.id === 'student_grade_forms' && reviewCandidate;
  const isIndigencyReview = activeDoc?.id === 'certificate_of_indigency' && reviewCandidate;
  const gradeReviewCompleted = isGradeReview && reviewCandidate.status === 'completed';
  const indigencyReviewCompleted = isIndigencyReview && reviewCandidate.status === 'completed';

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <ScanText className="w-4 h-4 text-stone-500" />
          <div>
            <h4 className="text-[15px] font-semibold text-stone-800">OCR Validation Hub</h4>
            <p className="text-xs text-stone-400">Extracted text / validation markers</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRunIotOcr}
            disabled={!canRunIotOcr || runningIotOcr || !piOnline}
            className="h-8 rounded-lg border-stone-200 text-xs"
          >
            {runningIotOcr ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Running IoT OCR
              </>
            ) : (
              <>
                <ScanText className="w-3.5 h-3.5 mr-1.5" />
                {piAvailabilityChecked && !piOnline ? 'Pi OCR Offline' : 'Use IoT OCR'}
              </>
            )}
          </Button>

          <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-xs font-medium">
            Extracted Preview
          </Badge>
        </div>
      </div>

      <div className="p-4 min-h-[520px] space-y-4">
        {runningIotOcr && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            <div>
              <span className="font-semibold">Running IoT OCR...</span>{' '}
              {IOT_OCR_STATUS_MESSAGES[iotOcrStatus] || 'Request is still active.'}
            </div>
            {cancelSupported && <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancelIotOcr}
              disabled={cancellingIotOcr}
              className="h-8 shrink-0 border-red-200 bg-white text-red-700 hover:bg-red-50"
            >
              {cancellingIotOcr ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Cancel
            </Button>}
          </div>
        )}

        {iotOcrError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {iotOcrError}
          </div>
        )}

        {isGradeReview && (
          <div className={`rounded-xl border p-4 space-y-4 ${gradeReviewCompleted ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-bold tracking-wide text-stone-900">GRADE FORM OCR</p>
                <p className="text-xs text-stone-600">Template: {reviewCandidate.template_id}</p>
              </div>
              <Badge className={gradeReviewCompleted
                ? 'border-green-200 bg-green-100 text-green-800'
                : 'border-blue-200 bg-blue-100 text-blue-800'}>
                {gradeReviewCompleted ? 'OCR confirmed' : 'Review required'}
              </Badge>
            </div>

            <div className="space-y-3">
              {GRADE_REVIEW_FIELDS.map(([key, label]) => (
                <label key={key} className="grid gap-1 sm:grid-cols-[130px_1fr_70px] sm:items-center">
                  <span className="text-sm font-semibold text-stone-700">{label}</span>
                  <Input
                    value={ocrFieldValue(correctedFields?.[key])}
                    readOnly={gradeReviewCompleted}
                    onChange={(event) => onCorrectedFieldsChange({
                      ...correctedFields,
                      [key]: event.target.value,
                    })}
                    className={gradeReviewCompleted ? 'bg-stone-100' : 'bg-white'}
                  />
                  <span className="text-right text-xs font-semibold text-blue-700">
                    {ocrScoreLabel(reviewCandidate, key, correctedFields?.[key])}
                  </span>
                </label>
              ))}

              <div className="grid gap-1 border-t border-blue-200 pt-3 sm:grid-cols-[130px_1fr_70px] sm:items-center">
                <span className="text-sm font-bold text-stone-800">GWA</span>
                <Input
                  value={ocrFieldValue(correctedFields?.gwa)}
                  readOnly
                  aria-label="Detected GWA (read only)"
                  className="bg-stone-100 font-bold text-stone-900"
                />
                <span className="text-right text-xs font-semibold text-blue-700">
                  {ocrScoreLabel(reviewCandidate, 'gwa', correctedFields?.gwa)}
                </span>
              </div>
            </div>

            {!gradeReviewCompleted && (
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={onRetryCandidate} disabled={reviewingCandidate}>Retry OCR</Button>
                <Button onClick={onConfirmCandidate} disabled={reviewingCandidate}>
                  {reviewingCandidate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm OCR
                </Button>
              </div>
            )}
          </div>
        )}

        {isIndigencyReview && (
          <div className={`rounded-xl border p-4 space-y-4 ${indigencyReviewCompleted ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-bold tracking-wide text-stone-900">INDIGENCY OCR</p>
                <p className="text-xs text-stone-600">Template: {reviewCandidate.template_id}</p>
              </div>
              <Badge className={indigencyReviewCompleted
                ? 'border-green-200 bg-green-100 text-green-800'
                : 'border-amber-200 bg-amber-100 text-amber-800'}>
                {indigencyReviewCompleted ? 'OCR confirmed' : 'Review required'}
              </Badge>
            </div>

            <div className="space-y-3">
              {INDIGENCY_REVIEW_FIELDS.map(([key, label]) => (
                <label key={key} className="grid gap-1 sm:grid-cols-[180px_1fr_70px] sm:items-center">
                  <span className="text-sm font-semibold text-stone-700">{label}</span>
                  {key === 'residency_address' ? (
                    <Textarea
                      value={ocrFieldValue(correctedFields?.[key])}
                      readOnly={indigencyReviewCompleted}
                      aria-label="Verified full residence address"
                      onChange={(event) => onCorrectedFieldsChange({
                        ...correctedFields,
                        [key]: event.target.value,
                      })}
                      className={`min-h-20 resize-y ${indigencyReviewCompleted ? 'bg-stone-100' : 'bg-white'}`}
                    />
                  ) : (
                    <Input
                      value={ocrFieldValue(correctedFields?.[key])}
                      readOnly={indigencyReviewCompleted}
                      onChange={(event) => onCorrectedFieldsChange({
                        ...correctedFields,
                        [key]: event.target.value,
                      })}
                      className={indigencyReviewCompleted ? 'bg-stone-100' : 'bg-white'}
                    />
                  )}
                  <span className="text-right text-xs font-semibold text-amber-700">
                    {ocrScoreLabel(reviewCandidate, key, correctedFields?.[key])}
                  </span>
                </label>
              ))}
            </div>

            {!indigencyReviewCompleted && (
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={onRetryCandidate} disabled={reviewingCandidate}>Retry OCR</Button>
                <Button onClick={onConfirmCandidate} disabled={reviewingCandidate}>
                  {reviewingCandidate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirm OCR
                </Button>
              </div>
            )}
          </div>
        )}

        {reviewCandidate && !isGradeReview && !isIndigencyReview && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">OCR ready for admin review</p>
                <p className="text-xs text-amber-700">Template: {reviewCandidate.template_id}</p>
              </div>
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">Review required</Badge>
            </div>

            <div className="space-y-3">
              {Object.entries(correctedFields || {}).map(([key, value]) => (
                <label key={key} className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-600">
                    {key.replaceAll('_', ' ')}
                    {reviewCandidate.field_confidence?.[key] != null
                      ? ` · ${Number(reviewCandidate.field_confidence[key]).toFixed(1)}%`
                      : ''}
                  </span>
                  {value && typeof value === 'object' ? (
                    <Textarea
                      value={JSON.stringify(value, null, 2)}
                      onChange={(event) => {
                        try {
                          onCorrectedFieldsChange({
                            ...correctedFields,
                            [key]: JSON.parse(event.target.value),
                          });
                        } catch {
                          // Keep the last valid structured value while JSON is incomplete.
                        }
                      }}
                      className="min-h-[110px] bg-white font-mono text-sm"
                    />
                  ) : (
                    <Input
                      value={value ?? ''}
                      onChange={(event) => onCorrectedFieldsChange({
                        ...correctedFields,
                        [key]: event.target.value,
                      })}
                      className="bg-white"
                    />
                  )}
                </label>
              ))}
            </div>

            {(reviewCandidate.validation_issues || []).length > 0 && (
              <div className="rounded-md border border-amber-200 bg-white p-3 text-sm text-amber-900">
                {(reviewCandidate.validation_issues || []).map((issue, index) => (
                  <p key={`${issue.code || 'issue'}-${index}`}>{issue.message || issue.code}</p>
                ))}
              </div>
            )}

            <details className="rounded-md border border-stone-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-semibold text-stone-700">Raw OCR</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-stone-600">{reviewCandidate.raw_text}</pre>
            </details>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onRetryCandidate} disabled={reviewingCandidate}>Retry</Button>
              <Button onClick={onConfirmCandidate} disabled={reviewingCandidate}>
                {reviewingCandidate ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirm OCR
              </Button>
            </div>
          </div>
        )}

        {!['student_grade_forms', 'certificate_of_indigency'].includes(activeDoc?.id) && <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ScanText className="w-4 h-4 text-stone-600" />
            <p className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
              Extracted Fields
            </p>
          </div>

          {extractedData.manualReviewRequired ? (
            <div className="mb-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
              Manual review required. Structured OCR values are provisional.
            </div>
          ) : null}

          {extractedData.identityReview?.status === 'unconfirmed' ? (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <p className="font-semibold">Applicant identity could not be confirmed</p>
              <p className="mt-1">{extractedData.identityReview.warning}</p>
              <p className="mt-1 font-mono text-xs text-red-600">
                {extractedData.identityReview.review_code}
              </p>
            </div>
          ) : null}

          {extractedData.extractedFields.length ? (
            <div className="space-y-2">
              {extractedData.extractedFields.map((item, index) => (
                <div
                  key={`${item.label}-${index}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-stone-400">
                      {item.label}
                    </p>
                    <p className="text-[15px] font-medium text-stone-800 mt-0.5">
                      {item.value}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${item.badge === 'Provisional OCR'
                      ? 'bg-orange-50 text-orange-700'
                      : 'bg-green-50 text-green-700'
                      }`}
                  >
                    {item.badge}
                  </span>
                </div>
              ))}
            </div>
          ) : extractedData.reviewOnly ? (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800 space-y-1">
              <p className="font-medium">{REVIEW_ONLY_MESSAGES[0]}</p>
              <p>{REVIEW_ONLY_MESSAGES[1]}</p>
            </div>
          ) : (
            <p className="text-sm text-stone-500">No structured fields extracted.</p>
          )}
        </div>}

        {extractedData?.documentValidation?.shouldShow ? (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-700" />
                <p className="text-sm font-semibold uppercase tracking-wide text-stone-700">
                  {extractedData.documentValidation.panelTitle || 'Birth Certificate / PSA Detection'}
                </p>
              </div>

              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  background:
                    extractedData.documentValidation.tone === 'green'
                      ? C.greenSoft
                      : extractedData.documentValidation.tone === 'red'
                        ? C.redSoft
                        : C.orangeSoft,
                  color:
                    extractedData.documentValidation.tone === 'green'
                      ? C.green
                      : extractedData.documentValidation.tone === 'red'
                        ? C.red
                        : C.orange,
                }}
              >
                {extractedData.documentValidation.confidenceLabel}
              </span>
            </div>

            <div className="mb-3 rounded-lg border border-stone-200 bg-white px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-stone-400">
                {extractedData.documentValidation.structuredResult
                  ? 'Processing Result'
                  : 'Detected Document Type'}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-stone-800">
                {extractedData.documentValidation.detectedLabel}
              </p>
            </div>

            <div className="space-y-2">
              {extractedData.documentValidation.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2"
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-stone-400">
                      {row.label}
                    </p>
                    <p className="mt-0.5 text-[15px] font-medium text-stone-800">
                      {row.value}
                    </p>
                  </div>

                  <span
                    className="rounded-full px-2 py-1 text-xs font-semibold"
                    style={{
                      background: row.found ? C.greenSoft : C.redSoft,
                      color: row.found ? C.green : C.red,
                    }}
                  >
                    {extractedData.documentValidation.structuredResult
                      ? 'Available'
                      : row.found
                        ? 'Matched'
                        : 'Missing'}
                  </span>
                </div>
              ))}
            </div>

            {extractedData.documentValidation.warning ? (
              <div
                className="mt-3 rounded-lg border px-3 py-2 text-sm leading-relaxed"
                style={{
                  background:
                    extractedData.documentValidation.tone === 'amber'
                      ? C.orangeSoft
                      : extractedData.documentValidation.detectedBirthCertificate
                        ? C.greenSoft
                        : C.redSoft,
                  color:
                    extractedData.documentValidation.tone === 'amber'
                      ? C.orange
                      : extractedData.documentValidation.detectedBirthCertificate
                        ? C.green
                        : C.red,
                  borderColor:
                    extractedData.documentValidation.tone === 'amber'
                      ? '#fed7aa'
                      : extractedData.documentValidation.detectedBirthCertificate
                        ? '#bbf7d0'
                        : '#fecaca',
                }}
              >
                {extractedData.documentValidation.warning}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-stone-400">Raw OCR Snapshot</p>

          <Textarea
            value={rawOcrSnapshot}
            readOnly
            aria-label="Immutable raw OCR snapshot"
            className="min-h-[220px] cursor-default resize-y rounded-lg border border-stone-100 bg-stone-50 p-3 font-mono text-sm leading-relaxed text-stone-600 whitespace-pre-wrap"
          />
        </div>
      </div>
    </div>
  );
}

function RejectDocumentModal({ onClose, onConfirm, saving, activeDocName }) {
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [remarks, setRemarks] = useState('');

  const isOther = selectedReason === 'Other';
  const finalReason = isOther ? otherReason.trim() : selectedReason.trim();
  const canSubmit = !!selectedReason && (!!finalReason || !isOther);

  const handleSubmit = () => {
    if (!canSubmit) return;

    const finalComment = [
      `Reason: ${isOther ? otherReason.trim() : selectedReason}`,
      remarks.trim() ? `Remarks: ${remarks.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    onConfirm(finalComment);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg border-stone-200 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-stone-800">Reject Document</h3>
            <p className="text-sm text-stone-500 mt-0.5">
              {activeDocName || 'Selected document'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <CardContent className="p-5 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400 mb-2">
              Rejection Reason
            </p>

            <div className="space-y-2">
              {REJECTION_OPTIONS.map((option) => (
                <label
                  key={option}
                  className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="rejection_reason"
                    value={option}
                    checked={selectedReason === option}
                    onChange={() => setSelectedReason(option)}
                    className="mt-1 h-4 w-4"
                  />
                  <span className="text-[15px] text-stone-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Other' && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-stone-400 block mb-1.5">
                Other Reason
              </label>
              <Textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Type the specific rejection reason..."
                className="rounded-lg bg-stone-50/50 border-stone-200 resize-none h-20 text-[15px]"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-stone-400 block mb-1.5">
              Admin Remarks
            </label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional remarks for review..."
              className="rounded-lg bg-stone-50/50 border-stone-200 resize-none h-20 text-[15px]"
            />
          </div>

          <p className="text-xs text-stone-500 leading-relaxed">
            Note: Do not type the action taken. Select the reason for rejection and add remarks only when needed.
          </p>
        </CardContent>

        <div className="px-5 py-4 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-9 rounded-lg border-stone-200 text-sm"
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="h-9 rounded-lg text-white text-sm border-none disabled:opacity-50"
            style={{ background: C.red }}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4 mr-2" />
            )}
            Confirm Rejection
          </Button>
        </div>
      </Card>
    </div>
  );
}

function StudentCard({ application, onViewSlip }) {
  const endorsementSlipId = application?.readiness?.endorsement_slip_id || null;
  const endorsementComplete = application?.readiness?.endorsement_complete === true;

  return (
    <Card className="border-stone-200 shadow-none bg-white">
      <div className="p-5">
        <div className="flex items-center gap-3 mb-5">
          <Avatar className="w-12 h-12 border border-stone-100">
            <AvatarImage
              src={application?.student?.avatar_url || undefined}
              alt={application?.student?.name || 'Student'}
            />
            <AvatarFallback className="bg-blue-900 text-white text-[15px] font-semibold">
              {application?.student?.initials || 'NA'}
            </AvatarFallback>
          </Avatar>

          <div>
            <h2 className="text-base font-semibold text-stone-900">
              {application?.student?.name}
            </h2>
            <p className="text-sm font-mono text-stone-400">
              {application?.student?.pdm_id}
            </p>
            <Badge className="mt-1.5 bg-blue-50 text-blue-700 border-blue-100 font-medium text-xs uppercase tracking-wide">
              {application?.student?.program}
            </Badge>
          </div>
        </div>

        {endorsementSlipId ? (
          <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">Endorsement Slip</p>
                <p className="mt-1 text-[15px] font-semibold text-stone-800">
                  {endorsementComplete ? 'Completed and available for review' : 'Available and still in endorsement flow'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-stone-200 text-sm"
                onClick={onViewSlip}
              >
                View Slip
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-3.5 pt-4 border-t border-stone-100">
          <InfoRow label="Email Address" value={application?.student?.email} />
          <InfoRow label="Phone Number" value={application?.student?.phone} />
          <div className="grid grid-cols-2 gap-3.5">
            <InfoRow label="Academic Year" value={application?.student?.year} />
            <InfoRow label="GWA Score" value={application?.student?.gwa} mono />
          </div>
          <InfoRow label="Course / Program" value={application?.student?.course} />
          <InfoRow
            label="Marilao Resident"
            value={application?.student?.marilao_resident === true ? 'True' : 'False'}
          />
          <InfoRow label="Document Status" value={application?.document_status} />
        </div>
      </div>
    </Card>
  );
}

function ChecklistCard({
  docs,
  activeDocId,
  onSelectDoc,
  availableCount,
  verifiedCount,
  rejectedCount,
  progress,
  requiredDocCount,
}) {
  const hasAnyUpload = availableCount > 0;
  const hasCompleteRequirements = availableCount >= requiredDocCount;

  const requiredDocs = docs.slice(0, requiredDocCount);
  const allRequiredDocsReviewed = requiredDocs.every(
    (d) => isDocumentAvailable(d) && d.status !== 'pending' && d.status !== 'uploaded'
  );
  const allRequiredDocsVerified = requiredDocs.every(
    (d) => isDocumentAvailable(d) && d.status === 'verified'
  );

  return (
    <Card className="border-stone-200 shadow-none bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50/50">
        <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wider">
          Checklist
        </h3>
        <span className="text-sm text-stone-400">
          {availableCount}/{docs.length} available
        </span>
      </div>

      <CardContent className="p-3 space-y-1.5">
        {docs.map((d) => {
          const meta = getDocumentStatusMeta(d.status);
          const isActive = activeDocId === d.id;
          const available = isDocumentAvailable(d);

          return (
            <button
              key={d.id}
              onClick={() => onSelectDoc(d.id)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${isActive
                ? 'border-blue-800 bg-blue-50 shadow-sm'
                : 'border-stone-100 bg-white hover:border-stone-200'
                }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span style={{ color: meta.color }}>{meta.icon}</span>
                <div className="min-w-0">
                  <p
                    className={`text-sm truncate ${isActive ? 'font-semibold text-blue-900' : 'font-medium text-stone-700'
                      }`}
                  >
                    {d.name}
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {d.id === 'application_form'
                      ? 'Text-based application data'
                      : available
                        ? 'File uploaded'
                        : 'No file uploaded'}
                  </p>
                </div>
              </div>

              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ml-2"
                style={{ background: meta.bg, color: meta.color }}
              >
                {meta.label}
              </span>
            </button>
          );
        })}

        <div className="mt-3 pt-3 border-t border-stone-100 space-y-3">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-medium text-stone-400 uppercase tracking-wider">
                Verification Progress
              </span>
              <span className="text-xs font-semibold text-stone-700">{progress}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-2">
              <p className="text-xs uppercase tracking-wide text-stone-400">Verified</p>
              <p className="text-[15px] font-semibold text-green-700">{verifiedCount}</p>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-2">
              <p className="text-xs uppercase tracking-wide text-stone-400">Rejected</p>
              <p className="text-[15px] font-semibold text-orange-700">{rejectedCount}</p>
            </div>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-stone-400">Readiness</p>

            {!hasAnyUpload ? (
              <p className="text-sm font-semibold mt-1 text-red-700">
                No submitted requirements yet.
              </p>
            ) : !hasCompleteRequirements ? (
              <p className="text-sm font-semibold mt-1 text-orange-700">
                Incomplete requirements: {availableCount}/{requiredDocCount} available.
              </p>
            ) : !allRequiredDocsReviewed ? (
              <p className="text-sm font-semibold mt-1 text-orange-700">
                All {requiredDocCount} requirements are available, but admin review actions are still pending.
              </p>
            ) : allRequiredDocsVerified ? (
              <p className="text-sm font-semibold mt-1 text-green-700">
                All {requiredDocCount} required items are verified.
              </p>
            ) : (
              <p className="text-sm font-semibold mt-1 text-orange-700">
                Review is complete, but one or more required items were rejected.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VerificationActions({
  activeDoc,
  onVerify,
  onReject,
  onComplete,
  hasUploadedDocument,
  hasAnyUpload,
  hasCompleteRequirements,
  allRequiredDocsReviewed,
  requiredDocCount,
  submitting,
  canCompleteVerification,
  finalVerificationStatus,
  requirementsReviewAlreadySaved,
}) {
  const isSaved = requirementsReviewAlreadySaved === true;

  const waitingForUploads =
    !isSaved &&
    (!hasAnyUpload || !hasCompleteRequirements);

  const waitingForReview =
    !isSaved &&
    hasCompleteRequirements &&
    !allRequiredDocsReviewed;

  const hasRejectedRequirement =
    !isSaved &&
    hasCompleteRequirements &&
    allRequiredDocsReviewed &&
    finalVerificationStatus !== 'verified';

  const readyToSave =
    !isSaved &&
    canCompleteVerification &&
    finalVerificationStatus === 'verified';

  const canReviewActiveDocument =
    hasUploadedDocument &&
    !isSaved &&
    !submitting;

  let statusConfig;

  if (isSaved) {
    statusConfig = {
      icon: ShieldCheck,
      title: 'Requirements review completed',
      description:
        'Application has already been finalized.',
      container:
        'border-emerald-200 bg-emerald-50/80',
      iconContainer:
        'bg-emerald-100 text-emerald-700',
      titleColor:
        'text-emerald-900',
      descriptionColor:
        'text-emerald-700',
    };
  } else if (waitingForUploads) {
    statusConfig = {
      icon: Clock,
      title: 'Waiting for complete requirements',
      description: !hasAnyUpload
        ? 'The student has not submitted the required documents yet.'
        : `All ${requiredDocCount} required items must be available before the requirements review can be finalized.`,
      container:
        'border-stone-200 bg-stone-50',
      iconContainer:
        'bg-stone-200 text-stone-600',
      titleColor:
        'text-stone-800',
      descriptionColor:
        'text-stone-500',
    };
  } else if (waitingForReview) {
    statusConfig = {
      icon: AlertTriangle,
      title: 'Review remaining requirements',
      description:
        `All ${requiredDocCount} required items are available. Verify or reject each item before saving the requirements review.`,
      container:
        'border-amber-200 bg-amber-50/80',
      iconContainer:
        'bg-amber-100 text-amber-700',
      titleColor:
        'text-amber-900',
      descriptionColor:
        'text-amber-700',
    };
  } else if (hasRejectedRequirement) {
    statusConfig = {
      icon: XCircle,
      title: 'Review contains rejected requirements',
      description:
        'One or more requirements were rejected. Saving will finalize the requirements review as rejected.',
      container:
        'border-red-200 bg-red-50/80',
      iconContainer:
        'bg-red-100 text-red-700',
      titleColor:
        'text-red-900',
      descriptionColor:
        'text-red-700',
    };
  } else {
    statusConfig = {
      icon: CheckCircle,
      title: 'Ready to save',
      description:
        `All ${requiredDocCount} required items have been verified. Save the requirements review to continue the application workflow.`,
      container:
        'border-emerald-200 bg-emerald-50/80',
      iconContainer:
        'bg-emerald-100 text-emerald-700',
      titleColor:
        'text-emerald-900',
      descriptionColor:
        'text-emerald-700',
    };
  }

  const StatusIcon = statusConfig.icon;

  const saveButtonLabel = (() => {
    if (submitting) {
      return 'Saving Requirements Review...';
    }

    if (isSaved) {
      return 'Requirements Review Saved';
    }

    if (!hasAnyUpload) {
      return 'Waiting for Requirements';
    }

    if (!hasCompleteRequirements) {
      return `Waiting for All ${requiredDocCount} Items`;
    }

    if (!allRequiredDocsReviewed) {
      return 'Review All Items First';
    }

    if (finalVerificationStatus === 'verified') {
      return 'Save Requirements Review';
    }

    return 'Save Rejected Requirements Review';
  })();

  const saveDisabled =
    submitting ||
    isSaved ||
    !canCompleteVerification;

  const saveButtonClass = (() => {
    const base =
      'h-11 w-full rounded-xl border-none text-sm font-semibold shadow-none transition-all duration-200';

    if (isSaved) {
      return `${base}
        bg-stone-200
        text-stone-500
        hover:bg-stone-200
        disabled:bg-stone-200
        disabled:text-stone-500
        disabled:opacity-100
        disabled:cursor-not-allowed`;
    }

    if (!canCompleteVerification) {
      return `${base}
        bg-stone-200
        text-stone-500
        hover:bg-stone-200
        disabled:bg-stone-200
        disabled:text-stone-500
        disabled:opacity-100
        disabled:cursor-not-allowed`;
    }

    if (finalVerificationStatus === 'rejected') {
      return `${base}
        bg-red-600
        text-white
        hover:bg-red-700
        disabled:bg-stone-200
        disabled:text-stone-500
        disabled:opacity-100`;
    }

    return `${base}
      bg-blue-900
      text-white
      hover:bg-blue-800
      disabled:bg-stone-200
      disabled:text-stone-500
      disabled:opacity-100`;
  })();

  return (
    <Card className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-none">
      <div className="p-4 sm:p-5">
        {/* Current document review actions */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-stone-800">
                Review selected document
              </p>

              <p className="mt-0.5 text-xs text-stone-500">
                {activeDoc?.name || 'No document selected'}
              </p>
            </div>

            {activeDoc && (
              <Badge
                className={
                  isSaved
                    ? 'border-stone-200 bg-stone-100 text-stone-500'
                    : 'border-blue-100 bg-blue-50 text-blue-700'
                }
              >
                {isSaved ? 'Finalized' : 'Review'}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onVerify}
              disabled={!canReviewActiveDocument}
              className="
                h-10
                rounded-xl
                border-stone-200
                bg-white
                text-sm
                font-medium
                text-stone-700
                shadow-none
                hover:border-emerald-300
                hover:bg-emerald-50
                hover:text-emerald-700
                disabled:border-stone-200
                disabled:bg-stone-50
                disabled:text-stone-400
                disabled:opacity-100
                disabled:cursor-not-allowed
              "
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Verify
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onReject}
              disabled={!canReviewActiveDocument}
              className="
                h-10
                rounded-xl
                border-stone-200
                bg-white
                text-sm
                font-medium
                text-stone-700
                shadow-none
                hover:border-red-300
                hover:bg-red-50
                hover:text-red-700
                disabled:border-stone-200
                disabled:bg-stone-50
                disabled:text-stone-400
                disabled:opacity-100
                disabled:cursor-not-allowed
              "
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>

          {!hasUploadedDocument &&
            activeDoc?.id !== 'application_form' && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                <p>
                  This document must be uploaded before it can be reviewed.
                </p>
              </div>
            )}
        </div>

        {/* Divider */}
        <div className="my-4 h-px bg-stone-100" />

        {/* Overall requirements review */}
        <div>
          <div className="mb-3">
            <p className="text-sm font-semibold text-stone-800">
              Requirements review
            </p>

            <p className="mt-0.5 text-xs text-stone-500">
              Finalize the complete document checklist for this application.
            </p>
          </div>

          <div
            className={`mb-4 flex items-start gap-3 rounded-xl border px-3.5 py-3 ${statusConfig.container}`}
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${statusConfig.iconContainer}`}
            >
              <StatusIcon className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <p
                className={`text-sm font-semibold ${statusConfig.titleColor}`}
              >
                {statusConfig.title}
              </p>

              <p
                className={`mt-0.5 text-xs leading-5 ${statusConfig.descriptionColor}`}
              >
                {statusConfig.description}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={onComplete}
            disabled={saveDisabled}
            className={saveButtonClass}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isSaved ? (
              <ShieldCheck className="mr-2 h-4 w-4" />
            ) : readyToSave ? (
              <CheckCircle className="mr-2 h-4 w-4" />
            ) : hasRejectedRequirement ? (
              <XCircle className="mr-2 h-4 w-4" />
            ) : (
              <Clock className="mr-2 h-4 w-4" />
            )}

            {saveButtonLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function DocumentVerification() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [activeDocId, setActiveDocId] = useState('certificate_of_registration');
  const [viewMode, setViewMode] = useState('preview');
  const [submitting, setSubmitting] = useState(false);

  const [docStatuses, setDocStatuses] = useState({});
  const [docComments, setDocComments] = useState({});
  const [comment, setComment] = useState('');

  const [rejectModalOpen, setRejectModalOpen] = useState(false);

  const [runningIotOcr, setRunningIotOcr] = useState(false);
  const [iotOcrError, setIotOcrError] = useState('');
  const [iotOcrResults, setIotOcrResults] = useState({});
  const [rawOcrSnapshot, setRawOcrSnapshot] = useState('');
  const [reviewCandidate, setReviewCandidate] = useState(null);
  const [correctedFields, setCorrectedFields] = useState({});
  const [reviewingCandidate, setReviewingCandidate] = useState(false);
  const [piOnline, setPiOnline] = useState(false);
  const [piAvailabilityChecked, setPiAvailabilityChecked] = useState(false);
  const [cancellingIotOcr, setCancellingIotOcr] = useState(false);
  const [iotOcrCapabilities, setIotOcrCapabilities] = useState({});

  const pollingRef = useRef(null);
  const activeIotRequestRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }

    activeIotRequestRef.current = null;
  }, []);

  const fetchApplicationDocuments = useCallback(
    async ({ soft = false } = {}) => {
      try {
        if (soft) setRefreshing(true);
        else setLoading(true);

        setError(null);

        const res = await fetch(`${API_BASE}/api/applications/${id}/documents`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to load application documents');
        }

        const data = await res.json();
        const normalizedDocs = normalizeRequiredDocuments(
          data?.documents || []
        );

        setApplication({
          ...data,
          documents: normalizedDocs,
        });

        setDocStatuses(() => {
          const next = {};

          normalizedDocs.forEach((d) => {
            next[d.id] = d.status || 'pending';
          });

          return next;
        });

        setDocComments(() => {
          const next = {};

          normalizedDocs.forEach((d) => {
            next[d.id] = d.admin_comment || '';
          });

          return next;
        });

        if (!soft) {
          const firstAvailable =
            normalizedDocs.find((d) => d.id !== 'application_form' && d.url)?.id ||
            normalizedDocs[0]?.id ||
            'certificate_of_registration';

          setActiveDocId(firstAvailable);
        }
      } catch (err) {
        console.error('Document fetch error:', err);
        setError(err.message || 'Failed to load document data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  const refreshCurrentDocumentVerification = useCallback(
    (data = {}) => {
      const eventApplicationId =
        data?.application_id?.toString?.() ||
        data?.applicationId?.toString?.() ||
        '';

      if (eventApplicationId && id && eventApplicationId !== id) {
        return;
      }

      fetchApplicationDocuments({ soft: true });
    },
    [id, fetchApplicationDocuments]
  );

  useSocketEvent(
    'application:updated',
    refreshCurrentDocumentVerification,
    [refreshCurrentDocumentVerification]
  );

  useSocketEvent(
    'application-document:uploaded',
    refreshCurrentDocumentVerification,
    [refreshCurrentDocumentVerification]
  );

  useSocketEvent(
    'application-document:reviewed',
    refreshCurrentDocumentVerification,
    [refreshCurrentDocumentVerification]
  );

  useSocketEvent(
    'application-ocr:queued',
    refreshCurrentDocumentVerification,
    [refreshCurrentDocumentVerification]
  );

  useSocketEvent(
    'application-ocr:status',
    (data = {}) => {
      if (String(data.application_id || '') !== String(id || '')) return;
      const documentId = data.document_key;
      if (!documentId || !data.request_id) return;
      setIotOcrResults((current) => {
        const existing = current[documentId] || {};
        const existingRequest = existing.iot_ocr_request || existing.ocr_job || {};
        if (existingRequest.request_id && existingRequest.request_id !== data.request_id) {
          const activeRequestId = activeIotRequestRef.current?.requestId;
          const existingTime = new Date(existingRequest.updated_at || existingRequest.created_at || 0).getTime();
          const incomingTime = new Date(data.updated_at || data.emitted_at || 0).getTime();
          if (activeRequestId !== data.request_id && incomingTime <= existingTime) {
            return current;
          }
        }
        const request = { ...existingRequest, ...data };
        return {
          ...current,
          [documentId]: {
            ...existing,
            iot_ocr_request: request,
            ocr_job: request,
          },
        };
      });
      fetchApplicationDocuments({ soft: true });
    },
    [id, fetchApplicationDocuments]
  );

  useSocketEvent(
    'application-ocr:snapshot-saved',
    refreshCurrentDocumentVerification,
    [refreshCurrentDocumentVerification]
  );

  useSocketEvent(
    'application:approved',
    refreshCurrentDocumentVerification,
    [refreshCurrentDocumentVerification]
  );

  useSocketEvent(
    'application:rejected',
    refreshCurrentDocumentVerification,
    [refreshCurrentDocumentVerification]
  );

  useSocketEvent(
    'application:disqualified',
    refreshCurrentDocumentVerification,
    [refreshCurrentDocumentVerification]
  );

  useEffect(() => {
    fetchApplicationDocuments();
  }, [fetchApplicationDocuments]);

  useEffect(() => {
    let cancelled = false;
    const checkPiAvailability = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/applications/iot-ocr/availability`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        if (!cancelled) {
          setPiOnline(response.ok && payload?.data?.online === true);
          setIotOcrCapabilities(payload?.data?.capabilities || {});
        }
      } catch {
        if (!cancelled) setPiOnline(false);
      } finally {
        if (!cancelled) setPiAvailabilityChecked(true);
      }
    };
    checkPiAvailability();
    const timer = window.setInterval(checkPiAvailability, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchApplicationDocuments({ soft: true });
    }, 8000);

    return () => window.clearInterval(timer);
  }, [fetchApplicationDocuments]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const docs = useMemo(() => {
    const rawDocs = application?.documents || [];

    return rawDocs.map((d) => {
      const hasIotOverride = Object.prototype.hasOwnProperty.call(
        iotOcrResults,
        d.id
      );
      const iotOverride = hasIotOverride ? iotOcrResults[d.id] : null;

      return {
        ...d,
        status: docStatuses[d.id] || d.status || 'pending',
        admin_comment: docComments[d.id] || '',
        ocr: hasIotOverride ? iotOverride?.ocr || {} : d.ocr || {},
        ocr_confidence: hasIotOverride
          ? iotOverride?.ocr_confidence ?? iotOverride?.ocr?.confidence ?? ''
          : d.ocr_confidence ?? null,
        iot_ocr_request:
          iotOverride?.iot_ocr_request ||
          d.iot_ocr_request ||
          d.ocr_job ||
          null,
        ocr_job:
          iotOverride?.ocr_job ||
          iotOverride?.iot_ocr_request ||
          d.ocr_job ||
          d.iot_ocr_request ||
          null,
      };
    });
  }, [application, docStatuses, docComments, iotOcrResults]);

  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeDocId) || docs[0] || null,
    [docs, activeDocId]
  );
  const persistedIotRequest = getActiveIotRequest(activeDoc);
  const persistedIotOcrRunning = isActiveIotRequest(persistedIotRequest);
  const persistedIotRequestId = getIotOcrRequestId(persistedIotRequest);
  const candidateRequestId = getIotOcrRequestId(reviewCandidate);
  const candidateStatus = String(reviewCandidate?.status || '').toLowerCase();
  const candidateFinishedCurrentRequest = Boolean(
    persistedIotRequestId
    && candidateRequestId === persistedIotRequestId
    && ['review_required', 'completed'].includes(candidateStatus)
  );
  const effectiveRunningIotOcr = !candidateFinishedCurrentRequest
    && (runningIotOcr || persistedIotOcrRunning);
  const iotOcrStatus = String(
    persistedIotRequest?.status || (runningIotOcr ? 'pending' : '')
  ).toLowerCase();

  const endorsementSlipId = application?.readiness?.endorsement_slip_id || null;

  const requiredDocCount = REQUIRED_DOCUMENTS.length;
  const requiredDocs = docs.slice(0, requiredDocCount);

  const availableCount = useMemo(
    () => docs.filter((d) => isDocumentAvailable(d)).length,
    [docs]
  );

  const verifiedCount = useMemo(
    () => docs.filter((d) => d.status === 'verified').length,
    [docs]
  );

  const rejectedCount = useMemo(
    () => docs.filter((d) => d.status === 'rejected').length,
    [docs]
  );

  const reviewedCount = useMemo(
    () =>
      docs.filter((d) => isDocumentAvailable(d) && d.status !== 'pending' && d.status !== 'uploaded')
        .length,
    [docs]
  );

  const hasAnyUpload = availableCount > 0;
  const hasCompleteRequirements = availableCount >= requiredDocCount;

  const allRequiredDocsUploaded = requiredDocs.every((d) => isDocumentAvailable(d));
  const allRequiredDocsReviewed = requiredDocs.every(
    (d) => isDocumentAvailable(d) && d.status !== 'pending' && d.status !== 'uploaded'
  );
  const allRequiredDocsVerified = requiredDocs.every(
    (d) => isDocumentAvailable(d) && d.status === 'verified'
  );

  const finalVerificationStatus =
    allRequiredDocsVerified
      ? 'verified'
      : 'rejected';

  const persistedVerificationStatus = normalizeKey(
    application?.verification_status || ''
  ).replace(/\s+/g, '_');

  const requirementsReviewAlreadySaved =
    persistedVerificationStatus === 'verified' ||
    persistedVerificationStatus === 'rejected';

  const canCompleteVerification =
    allRequiredDocsUploaded &&
    allRequiredDocsReviewed &&
    !requirementsReviewAlreadySaved;

  const progress = docs.length ? Math.round((reviewedCount / docs.length) * 100) : 0;
  const hasUploadedDocument =
    activeDoc?.id === 'application_form' || isDocumentAvailable(activeDoc);

  const extractedData = useMemo(
    () => buildExtractedData(activeDoc, application),
    [activeDoc, application]
  );

  useEffect(() => {
    if (!activeDoc) return;
    setComment(docComments[activeDoc.id] || '');
    setIotOcrError('');
    if (reviewCandidate && reviewCandidate.document_key !== activeDoc.id) {
      setReviewCandidate(null);
      setCorrectedFields({});
    }

    if (!runningIotOcr && reviewCandidate?.document_key !== activeDoc.id) {
      setRawOcrSnapshot(buildRawOcrSnapshot(activeDoc, application));
    }
  }, [activeDoc, application, docComments, runningIotOcr, reviewCandidate?.document_key]);

  useEffect(() => {
    setIotOcrError('');

    if (!activeDoc) return;

    const request = getActiveIotRequest(activeDoc);
    if (!isActiveIotRequest(request)) {
      if (!runningIotOcr) stopPolling();
      return;
    }

    const requestId = getIotOcrRequestId(request);
    if (!requestId) return;

    setRunningIotOcr(true);
    activeIotRequestRef.current = {
      documentId: activeDoc.id,
      requestId,
      request,
    };

    if (!pollingRef.current) {
      const pollPersistedRequest = async () => {
        try {
          await fetchApplicationDocuments({ soft: true });
        } finally {
          if (activeIotRequestRef.current?.requestId === requestId) {
            pollingRef.current = window.setTimeout(
              pollPersistedRequest,
              IOT_OCR_STATUS_POLL_INTERVAL_MS
            );
          }
        }
      };

      pollingRef.current = window.setTimeout(
        pollPersistedRequest,
        IOT_OCR_STATUS_POLL_INTERVAL_MS
      );
    }
  }, [
    activeDoc,
    activeDocId,
    fetchApplicationDocuments,
    runningIotOcr,
    stopPolling,
  ]);

  useEffect(() => {
    const request = getActiveIotRequest(activeDoc);
    const requestStatus = String(request?.status || '').toLowerCase();
    const shouldLoadCandidate = requestStatus === 'review_required' || (
      ['student_grade_forms', 'certificate_of_indigency'].includes(activeDoc?.id)
      && requestStatus === 'completed'
    );
    if (!activeDoc || !shouldLoadCandidate) {
      return;
    }
    const requestId = getIotOcrRequestId(request);
    if (!requestId || reviewCandidate?.request_id === requestId) return;
    let cancelled = false;
    fetch(
      `${API_BASE}/api/applications/${id}/documents/${activeDoc.id}/iot-ocr?request_id=${encodeURIComponent(requestId)}`,
      { headers: { Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` }, cache: 'no-store' }
    )
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Failed to load OCR candidate');
        return payload?.data?.candidate || null;
      })
      .then((candidate) => {
        if (cancelled || !candidate) return;
        setReviewCandidate(candidate);
        setCorrectedFields(normalizeReviewFields(candidate));
        setRawOcrSnapshot(candidate.raw_text || '');
        stopPolling();
        setRunningIotOcr(false);
        if (activeIotRequestRef.current?.requestId === requestId) {
          activeIotRequestRef.current = null;
        }
      })
      .catch((error) => {
        if (!cancelled) setIotOcrError(error.message || 'Failed to load OCR candidate');
      });
    return () => { cancelled = true; };
  }, [activeDoc, id, reviewCandidate?.request_id, stopPolling]);

  useEffect(() => {
    const request = getActiveIotRequest(activeDoc);
    const requestStatus = String(request?.status || '').toLowerCase();
    const requestId = getIotOcrRequestId(request);
    const candidateReady = Boolean(
      requestId
      && reviewCandidate?.document_key === activeDoc?.id
      && getIotOcrRequestId(reviewCandidate) === requestId
      && ['review_required', 'completed'].includes(
        String(reviewCandidate?.status || '').toLowerCase()
      )
    );
    if (!candidateReady && ![
      'review_required',
      'completed',
      'cancelled',
      'failed',
      'expired',
    ].includes(requestStatus)) return;

    stopPolling();
    setRunningIotOcr(false);
    if (!requestId || activeIotRequestRef.current?.requestId === requestId) {
      activeIotRequestRef.current = null;
    }
  }, [activeDoc, reviewCandidate?.document_key, reviewCandidate?.request_id, stopPolling]);

  const updateActiveDocStatus = (nextStatus, nextComment = null) => {
    if (!activeDoc || !hasUploadedDocument) return;

    const resolvedComment = nextComment !== null ? nextComment : comment;

    setDocStatuses((prev) => ({
      ...prev,
      [activeDoc.id]: nextStatus,
    }));

    setDocComments((prev) => ({
      ...prev,
      [activeDoc.id]: resolvedComment,
    }));

    setComment(resolvedComment);
  };

  const handleVerify = () => {
    if (requirementsReviewAlreadySaved) return;

    updateActiveDocStatus('verified');
  };

  const handleRejectConfirm = (finalComment) => {
    if (requirementsReviewAlreadySaved) {
      setRejectModalOpen(false);
      return;
    }

    updateActiveDocStatus('rejected', finalComment);
    setRejectModalOpen(false);
  };

  const handleRunIotOcr = async () => {
    if (!activeDoc || activeDoc.id === 'application_form') return;
    if (persistedIotOcrRunning) return;

    const targetDocumentId = activeDoc.id;
    const setBlankIotOverride = (
      request = null,
      rawSnapshot = '(No fresh OCR result was produced.)'
    ) => {
      setIotOcrResults((prev) => ({
        ...prev,
        [targetDocumentId]: {
          ocr: {},
          ocr_confidence: '',
          iot_ocr_request: request,
          ocr_job: request,
        },
      }));
      setRawOcrSnapshot(rawSnapshot);
    };

    try {
      stopPolling();
      setRunningIotOcr(true);
      setIotOcrError('');
      setBlankIotOverride(
        null,
        '(Waiting for fresh OCR result...)'
      );

      const res = await fetch(
        `${API_BASE}/api/applications/${id}/documents/${targetDocumentId}/iot-ocr`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }
      );

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const requestError = new Error(payload.error || 'Failed to run IoT OCR');
        requestError.code = payload.code || null;
        requestError.status = res.status;
        throw requestError;
      }

      const request = payload?.data || payload;
      const requestId = getIotOcrRequestId(request);

      if (!requestId) {
        throw new Error('The OCR backend did not return a request ID.');
      }

      const requestContext = {
        ...request,
        request_id: requestId,
      };

      setBlankIotOverride(
        requestContext,
        '(Waiting for fresh OCR result...)'
      );

      activeIotRequestRef.current = {
        documentId: targetDocumentId,
        requestId,
        request: requestContext,
      };

      let consecutivePollErrors = 0;

      const pollFreshSnapshot = async () => {
        const activeRequest = activeIotRequestRef.current;

        if (
          !activeRequest ||
          activeRequest.documentId !== targetDocumentId ||
          activeRequest.requestId !== requestId
        ) {
          return;
        }

        try {
          const snapshotResponse = await fetch(
            `${API_BASE}/api/applications/${id}/documents/${targetDocumentId}/ocr-snapshot?request_id=${encodeURIComponent(requestId)}&_=${Date.now()}`,
            {
              headers: {
                Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json',
              },
              cache: 'no-store',
            }
          );

          const snapshotPayload = await snapshotResponse.json().catch(() => ({}));

          if (!snapshotResponse.ok) {
            throw new Error(
              snapshotPayload.error || 'Failed to load the fresh OCR snapshot'
            );
          }

          const snapshot = snapshotPayload?.data || {};
          consecutivePollErrors = 0;
          const latestRequest = snapshot?.iot_ocr_request || {};
          const latestRequestId = getIotOcrRequestId(latestRequest);
          const requestStatus = String(latestRequest?.status || '').toLowerCase();
          const snapshotFresh = snapshot?.snapshot_fresh === true;

          if (latestRequestId === requestId) {
            setIotOcrResults((current) => ({
              ...current,
              [targetDocumentId]: {
                ...(current[targetDocumentId] || {}),
                iot_ocr_request: latestRequest,
                ocr_job: latestRequest,
              },
            }));
            activeIotRequestRef.current = {
              ...activeRequest,
              request: latestRequest,
            };

            if (requestStatus === 'review_required') {
              stopPolling();
              setRunningIotOcr(false);
              const candidateResponse = await fetch(
                `${API_BASE}/api/applications/${id}/documents/${targetDocumentId}/iot-ocr?request_id=${encodeURIComponent(requestId)}`,
                { headers: { Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` }, cache: 'no-store' }
              );
              const candidatePayload = await candidateResponse.json().catch(() => ({}));
              if (!candidateResponse.ok) throw new Error(candidatePayload.error || 'Failed to load OCR candidate');
              const candidate = candidatePayload?.data?.candidate;
              setReviewCandidate(candidate || null);
              setCorrectedFields(normalizeReviewFields(candidate));
              setRawOcrSnapshot(candidate?.raw_text || '');
              await fetchApplicationDocuments({ soft: true });
              stopPolling();
              setRunningIotOcr(false);
              return;
            }

            if (requestStatus === 'completed' && snapshotFresh) {
              const freshOverride = buildIotOcrSnapshotOverride(snapshot);
              const freshDocument = {
                id: targetDocumentId,
                document_key: targetDocumentId,
                ...freshOverride,
              };

              setIotOcrResults((prev) => ({
                ...prev,
                [targetDocumentId]: freshOverride,
              }));
              setRawOcrSnapshot(buildRawOcrSnapshot(freshDocument));
              await fetchApplicationDocuments({ soft: true });
              stopPolling();
              setRunningIotOcr(false);
              return;
            }

            if (['failed', 'cancelled', 'expired'].includes(requestStatus)) {
              await fetchApplicationDocuments({ soft: true });
              setBlankIotOverride(
                latestRequest,
                '(No fresh OCR result was produced.)'
              );
              stopPolling();
              setRunningIotOcr(false);
              setIotOcrError(
                latestRequest?.error_message ||
                `OCR request ${requestStatus}. Retry the capture.`
              );
              return;
            }
          }
        } catch (pollError) {
          consecutivePollErrors += 1;
          if (consecutivePollErrors % 30 === 0) {
            console.error('POLL IOT OCR ERROR:', pollError);
          }
        }

        pollingRef.current = window.setTimeout(
          pollFreshSnapshot,
          IOT_OCR_STATUS_POLL_INTERVAL_MS
        );
      };

      await pollFreshSnapshot();
    } catch (err) {
      const piIsOffline = err?.code === 'PI_OFFLINE' || err?.status === 503;

      if (piIsOffline) {
        setPiOnline(false);
        setPiAvailabilityChecked(true);
      } else {
        console.error('RUN IOT OCR ERROR:', err);
      }
      setBlankIotOverride(
        activeIotRequestRef.current?.request || null,
        piIsOffline
          ? '(Raspberry Pi OCR scanner is offline.)'
          : '(No fresh OCR result was produced.)'
      );
      stopPolling();
      setIotOcrError(getOcrFailureMessage(err));
      setRunningIotOcr(false);
    }
  };

  const handleConfirmCandidate = async () => {
    if (!activeDoc || !reviewCandidate) return;
    try {
      setReviewingCandidate(true);
      setIotOcrError('');
      const response = await fetch(
        `${API_BASE}/api/applications/${id}/documents/${activeDoc.id}/iot-ocr/${reviewCandidate.request_id}/confirm`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ corrected_fields: correctedFields }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to confirm OCR candidate');
      const result = payload?.data || {};
      const verifiedFields = result.verified_fields || correctedFields;
      const applicationPatch = result.application_patch || {};
      setReviewCandidate({
        ...reviewCandidate,
        status: 'completed',
        review_required: false,
        fields: verifiedFields,
      });
      setCorrectedFields(normalizeReviewFields({
        ...reviewCandidate,
        document_key: activeDoc.id,
        fields: verifiedFields,
      }));
      if (applicationPatch?.student) {
        setApplication((current) => ({
          ...current,
          student: { ...(current?.student || {}), ...applicationPatch.student },
        }));
      }
      await fetchApplicationDocuments({ soft: true });
    } catch (error) {
      setIotOcrError(error.message || 'Failed to confirm OCR candidate');
    } finally {
      setReviewingCandidate(false);
    }
  };

  const handleCancelIotOcr = async () => {
    if (!activeDoc) return;
    const request = activeIotRequestRef.current?.request || getActiveIotRequest(activeDoc);
    const requestId = getIotOcrRequestId(request);
    if (!requestId) return;
    try {
      setCancellingIotOcr(true);
      setIotOcrError('');
      const response = await fetch(
        `${API_BASE}/api/applications/${id}/documents/${activeDoc.id}/iot-ocr/${requestId}/cancel`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 404) setIotOcrCapabilities((current) => ({ ...current, admin_cancel: false }));
        throw new Error(payload.error || 'Failed to cancel OCR request.');
      }
      stopPolling();
      setRunningIotOcr(false);
      setIotOcrResults((current) => ({
        ...current,
        [activeDoc.id]: {
          ...(current[activeDoc.id] || {}),
          iot_ocr_request: payload?.data?.request,
          ocr_job: payload?.data?.request,
        },
      }));
      await fetchApplicationDocuments({ soft: true });
    } catch (error) {
      setIotOcrError(error.message || 'Failed to cancel OCR request.');
    } finally {
      setCancellingIotOcr(false);
    }
  };

  const handleRetryCandidate = async () => {
    if (!activeDoc || !reviewCandidate) return;
    try {
      setReviewingCandidate(true);
      setIotOcrError('');
      const response = await fetch(
        `${API_BASE}/api/applications/${id}/documents/${activeDoc.id}/iot-ocr/${reviewCandidate.request_id}/retry`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionStorage.getItem('adminToken')}` },
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to retry OCR');
      setReviewCandidate(null);
      setCorrectedFields({});
      setRunningIotOcr(true);
      await fetchApplicationDocuments({ soft: true });
    } catch (error) {
      setIotOcrError(error.message || 'Failed to retry OCR');
    } finally {
      setReviewingCandidate(false);
    }
  };

  const handleCompleteVerification = async () => {
    if (requirementsReviewAlreadySaved) {
      return;
    }

    if (!canCompleteVerification) {
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        application_id: id,
        verification_status: finalVerificationStatus,
        document_reviews: docs.map((d) => ({
          document_key: d.document_key || d.id,
          document_id: d.id,
          requirement_id: d.requirement_id || null,
          name: d.name,
          status: d.status,
          comment: d.admin_comment || '',
          url: d.url || null,
        })),
        summary: {
          verified: verifiedCount,
          reviewed: reviewedCount,
          uploaded: availableCount,
          rejected: rejectedCount,
          pending: docs.filter((d) => d.status === 'pending' || d.status === 'uploaded').length,
          progress,
        },
      };

      const res = await fetch(`${API_BASE}/api/applications/${id}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save verification');
      }

      const finalOutcome = data?.data?.final_outcome;
      const readiness = data?.data?.readiness || {};

      const successMessage =
        finalOutcome === 'approved'
          ? 'Requirements review saved successfully.'
          : finalVerificationStatus === 'verified'
            ? readiness?.endorsement_complete
              ? 'Requirements review saved successfully. The application is ready for explicit admin scholar activation.'
              : 'Requirements review saved successfully. Endorsement slip completion is still required before scholar activation.'
            : 'Requirements review completed. Application marked as rejected and ready for archiving.';

      navigate('/admin/applications', {
        state: {
          verificationFeedback: {
            tone: 'success',
            title: 'Verification saved',
            message: successMessage,
          },
        },
      });
    } catch (err) {
      console.error('COMPLETE VERIFICATION ERROR:', err);
      alert(err.message || 'Failed to complete verification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadSlipPdf = async () => {
    if (!endorsementSlipId) return;

    try {
      const response = await fetch(`${API_BASE}/api/endorsement-slips/${endorsementSlipId}/pdf`, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Failed to download endorsement slip PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${application?.readiness?.endorsement_slip_code || 'endorsement-slip'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Failed to download endorsement slip PDF');
    }
  };

  if (loading) {
    return <PageLoadingSkeleton label="Loading application documents" variant="cards" />;
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <XCircle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-[15px] font-semibold text-red-800">Failed to load document verification</p>
        <p className="text-sm text-red-600 mt-1">{error}</p>
        <Button
          onClick={() => fetchApplicationDocuments()}
          variant="outline"
          size="sm"
          className="mt-4 border-red-200 text-red-600 text-sm"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2 animate-in fade-in duration-300" style={{ background: C.bg }}>
      {rejectModalOpen && (
        <RejectDocumentModal
          onClose={() => setRejectModalOpen(false)}
          onConfirm={handleRejectConfirm}
          saving={false}
          activeDocName={activeDoc?.name}
        />
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/applications')}
          className="h-8 w-8 p-0 rounded-lg border-stone-200 bg-white"
        >
          <ArrowLeft size={15} className="text-stone-500" />
        </Button>

        <div>
          <div className="flex items-center gap-1.5 text-sm text-stone-400">
            <span
              className="hover:text-stone-600 cursor-pointer transition-colors"
              onClick={() => navigate('/admin/applications')}
            >
              Registry
            </span>
            <ChevronRight size={11} />
            <span className="text-stone-600">{id}</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mt-0.5">
            Document Verification
          </h1>
        </div>

        <div className="ml-auto">
          <div className="flex items-center gap-2">
            {endorsementSlipId ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/endorsements/${endorsementSlipId}`)}
                  className="rounded-lg border-stone-200 text-sm"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open Endorsement Slip
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSlipPdf}
                  className="rounded-lg border-stone-200 text-sm"
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  Download Slip PDF
                </Button>
              </>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchApplicationDocuments({ soft: true })}
              disabled={refreshing}
              className="rounded-lg border-stone-200 text-sm"
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <StudentCard
            application={application}
            onViewSlip={() => navigate(`/admin/endorsements/${endorsementSlipId}`)}
          />

          <ChecklistCard
            docs={docs}
            activeDocId={activeDocId}
            onSelectDoc={setActiveDocId}
            availableCount={availableCount}
            verifiedCount={verifiedCount}
            rejectedCount={rejectedCount}
            progress={progress}
            requiredDocCount={requiredDocCount}
          />
        </div>

        <div className="lg:col-span-3 space-y-4">
          <Card className="border-stone-200 shadow-none bg-white overflow-hidden">
            <div className="flex border-b border-stone-100 bg-stone-50/50 overflow-x-auto">
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setActiveDocId(d.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-all shrink-0 ${activeDocId === d.id
                    ? 'border-blue-800 text-blue-900 bg-white'
                    : 'border-transparent text-stone-400 hover:text-stone-600 hover:bg-white/60'
                    }`}
                >
                  {d.name}
                </button>
              ))}
            </div>

            <div className="px-5 py-3 border-b border-stone-100 bg-white">
              <div className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 p-1">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'preview'
                    ? 'bg-white text-blue-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                    }`}
                >
                  Document Preview
                </button>

                <button
                  onClick={() => setViewMode('ocr')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'ocr'
                    ? 'bg-white text-blue-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                    }`}
                >
                  OCR Validation Hub
                </button>

                <button
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'split'
                    ? 'bg-white text-blue-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                    }`}
                >
                  <span className="inline-flex items-center gap-1">
                    <Columns2 className="w-3.5 h-3.5" />
                    Split View
                  </span>
                </button>
              </div>
            </div>

            <div className="p-5 bg-stone-50/30">
              {!activeDoc ? (
                <p className="text-[15px] text-stone-400">No document selected.</p>
              ) : viewMode === 'preview' ? (
                <DocumentPreviewPanel activeDoc={activeDoc} application={application} />
              ) : viewMode === 'ocr' ? (
                <OCRPanel
                  activeDoc={activeDoc}
                  extractedData={extractedData}
                  onRunIotOcr={handleRunIotOcr}
                  runningIotOcr={effectiveRunningIotOcr}
                  iotOcrStatus={iotOcrStatus}
                  iotOcrError={iotOcrError}
                  rawOcrSnapshot={rawOcrSnapshot}
                  reviewCandidate={reviewCandidate}
                  correctedFields={correctedFields}
                  onCorrectedFieldsChange={setCorrectedFields}
                  onConfirmCandidate={handleConfirmCandidate}
                  onRetryCandidate={handleRetryCandidate}
                  reviewingCandidate={reviewingCandidate}
                  piOnline={piOnline}
                  piAvailabilityChecked={piAvailabilityChecked}
                  onCancelIotOcr={handleCancelIotOcr}
                  cancellingIotOcr={cancellingIotOcr}
                  cancelSupported={iotOcrCapabilities.admin_cancel === true}
                />
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <DocumentPreviewPanel activeDoc={activeDoc} application={application} />
                  <OCRPanel
                    activeDoc={activeDoc}
                    extractedData={extractedData}
                    onRunIotOcr={handleRunIotOcr}
                    runningIotOcr={effectiveRunningIotOcr}
                    iotOcrStatus={iotOcrStatus}
                    iotOcrError={iotOcrError}
                    rawOcrSnapshot={rawOcrSnapshot}
                    reviewCandidate={reviewCandidate}
                    correctedFields={correctedFields}
                    onCorrectedFieldsChange={setCorrectedFields}
                    onConfirmCandidate={handleConfirmCandidate}
                    onRetryCandidate={handleRetryCandidate}
                    reviewingCandidate={reviewingCandidate}
                    piOnline={piOnline}
                    piAvailabilityChecked={piAvailabilityChecked}
                    onCancelIotOcr={handleCancelIotOcr}
                    cancellingIotOcr={cancellingIotOcr}
                    cancelSupported={iotOcrCapabilities.admin_cancel === true}
                  />
                </div>
              )}
            </div>
          </Card>

          <VerificationActions
            activeDoc={activeDoc}
            onVerify={handleVerify}
            onReject={() => setRejectModalOpen(true)}
            onComplete={handleCompleteVerification}
            hasUploadedDocument={hasUploadedDocument}
            hasAnyUpload={hasAnyUpload}
            hasCompleteRequirements={hasCompleteRequirements}
            allRequiredDocsReviewed={allRequiredDocsReviewed}
            requiredDocCount={requiredDocCount}
            submitting={submitting}
            canCompleteVerification={canCompleteVerification}
            finalVerificationStatus={finalVerificationStatus}
            requirementsReviewAlreadySaved={requirementsReviewAlreadySaved}
          />
        </div>
      </div>
    </div>
  );
}
