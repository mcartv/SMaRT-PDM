import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, XCircle, Clock, ArrowLeft,
  FileText, ChevronRight, Loader2,
  AlertTriangle, ShieldCheck, ScanText, ExternalLink,
  Columns2, RefreshCw, X,
} from 'lucide-react';
import API_BASE_URL from '@/api';

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
  text: '#1c1917',
  bg: '#faf7f2',
  muted: '#78716c',
  brownMid: '#7c4a2e',
};

const DOC_STATUS = {
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
    id: 'certificate_of_registration',
    name: 'Certificate of Registration',
    aliases: ['cor', 'certificate of registration', 'registration form', 'registration'],
  },
  {
    id: 'student_grade_forms',
    name: 'Grade Form',
    aliases: ['student grade forms', 'grade forms', 'grade card', 'grades', 'grade form'],
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

  return REQUIRED_DOCUMENTS.find((cfg) =>
    cfg.aliases.some((alias) => candidates.includes(normalizeKey(alias))) ||
    candidates.includes(normalizeKey(cfg.id))
  );
}

function normalizeRequiredDocuments(rawDocs = []) {
  const mapped = new Map();

  rawDocs.forEach((rawDoc) => {
    const config = findRequiredDocConfig(rawDoc);
    if (!config || mapped.has(config.id)) return;

    mapped.set(config.id, {
      id: config.id,
      document_key: rawDoc.document_key || config.id,
      requirement_id: rawDoc.requirement_id || null,
      name: config.name,
      url: rawDoc.url || rawDoc.file_url || rawDoc.document_url || rawDoc.signed_url || '',
      status: rawDoc.status || rawDoc.document_status || 'pending',
      admin_comment: rawDoc.admin_comment || rawDoc.comment || '',
      ocr: rawDoc.ocr || {},
      ocr_confidence: rawDoc.ocr_confidence ?? rawDoc.ocr?.confidence ?? null,
      ocr_job: rawDoc.ocr_job || null,
      file_name: rawDoc.file_name || '',
      file_path: rawDoc.file_path || '',
      submitted_at: rawDoc.submitted_at || rawDoc.uploaded_at || null,
      reviewed_at: rawDoc.reviewed_at || null,
    });
  });

  return REQUIRED_DOCUMENTS.map((cfg) => {
    if (mapped.has(cfg.id)) return mapped.get(cfg.id);

    return {
      id: cfg.id,
      document_key: cfg.id,
      requirement_id: null,
      name: cfg.name,
      url: '',
      status: 'pending',
      admin_comment: '',
      ocr: {},
      ocr_confidence: null,
      ocr_job: null,
      file_name: '',
      file_path: '',
      submitted_at: null,
      reviewed_at: null,
    };
  });
}

function InfoRow({ label, value, mono, className = '' }) {
  const displayValue =
    value === undefined || value === null || value === '' ? 'N/A' : value;

  return (
    <div className={className}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">
        {label}
      </p>
      <p className={`text-sm ${mono ? 'font-mono text-stone-600' : 'font-medium text-stone-800'}`}>
        {displayValue}
      </p>
    </div>
  );
}

function buildExtractedData(activeDoc, application) {
  if (!activeDoc) return [];

  const student = application?.student || {};
  const ocr = activeDoc?.ocr || {};

  const fallbackName = ocr.extracted_name || student.name || 'Not detected';
  const fallbackGwa = ocr.extracted_gwa ?? student.gwa ?? 'Not detected';
  const confidence = ocr.confidence ?? activeDoc.ocr_confidence ?? null;

  const base = [
    {
      label: 'Student Name',
      value: fallbackName,
      verified: !!fallbackName && fallbackName !== 'Not detected',
    },
    {
      label: 'PDM ID',
      value: student.pdm_id || 'Not detected',
      verified: !!student.pdm_id,
    },
    {
      label: 'Program',
      value: student.program || 'Not detected',
      verified: !!student.program,
    },
    {
      label: 'Course',
      value: student.course || 'Not detected',
      verified: !!student.course,
    },
    {
      label: 'OCR Confidence',
      value: confidence !== null && confidence !== undefined ? `${confidence}%` : 'N/A',
      verified: confidence !== null && confidence !== undefined,
    },
  ];

  switch (activeDoc.id) {
    case 'certificate_of_registration':
      return [
        ...base,
        { label: 'Document Type', value: 'Certificate of Registration', verified: true },
        {
          label: 'Academic Year',
          value: student.year || 'Not detected',
          verified: !!student.year,
        },
        {
          label: 'Enrollment Status',
          value: activeDoc.url ? 'Detected from uploaded document' : 'Unknown',
          verified: !!activeDoc.url,
        },
      ];

    case 'student_grade_forms':
      return [
        ...base,
        { label: 'Document Type', value: 'Grade Form', verified: true },
        {
          label: 'Detected GWA',
          value: fallbackGwa,
          verified: fallbackGwa !== 'Not detected' && fallbackGwa !== 'N/A',
        },
        {
          label: 'GWA Eligibility',
          value: Number(student.gwa) <= 2.0 ? 'Eligible' : 'Needs Review',
          verified: Number(student.gwa) <= 2.0,
        },
      ];

    case 'certificate_of_indigency':
      return [
        ...base,
        { label: 'Document Type', value: 'Certificate of Indigency', verified: true },
        {
          label: 'Barangay Certification',
          value: activeDoc.url ? 'Detected and ready for review' : 'No uploaded file detected',
          verified: !!activeDoc.url,
        },
      ];

    case 'letter_of_request':
      return [
        ...base,
        { label: 'Document Type', value: 'Letter of Request', verified: true },
        {
          label: 'Request Letter',
          value: activeDoc.url ? 'Detected and ready for admin review' : 'No uploaded file detected',
          verified: !!activeDoc.url,
        },
        {
          label: 'Signature Presence',
          value: activeDoc.url ? 'Detected' : 'Not detected',
          verified: !!activeDoc.url,
        },
      ];

    case 'application_form':
      return [
        ...base,
        { label: 'Document Type', value: 'Application Form', verified: true },
        {
          label: 'Profile Section',
          value: application?.student_profile ? 'Available' : 'Not found',
          verified: !!application?.student_profile,
        },
        {
          label: 'Family Records',
          value: (application?.family_members || []).length
            ? `${application.family_members.length} record(s)`
            : 'No records',
          verified: (application?.family_members || []).length > 0,
        },
        {
          label: 'Education Records',
          value: (application?.education_records || []).length
            ? `${application.education_records.length} record(s)`
            : 'No records',
          verified: (application?.education_records || []).length > 0,
        },
      ];

    default:
      return base;
  }
}

function buildRawOcrSnapshot(activeDoc, application) {
  if (!activeDoc) return '';

  const student = application?.student || {};
  const ocr = activeDoc?.ocr || {};
  const rawText = String(ocr.raw_text || ocr.text || '').trim();
  const confidence = ocr.confidence ?? activeDoc?.ocr_confidence ?? null;
  const extractedName = ocr.extracted_name || null;
  const extractedGwa = ocr.extracted_gwa ?? null;

  const sections = [
    `Document: ${activeDoc.name || 'N/A'}`,
    `Student: ${student.name || 'Unknown'}`,
    `PDM ID: ${student.pdm_id || 'N/A'}`,
    `Program: ${student.program || 'N/A'}`,
    `Course: ${student.course || 'N/A'}`,
    confidence !== null && confidence !== undefined
      ? `OCR Confidence: ${confidence}%`
      : 'OCR Confidence: N/A',
    extractedName ? `Extracted Name: ${extractedName}` : null,
    extractedGwa !== null && extractedGwa !== undefined
      ? `Extracted GWA: ${extractedGwa}`
      : null,
    '',
    'Extracted Text:',
    rawText || '(No OCR text yet)',
  ].filter((value) => value !== null);

  return sections.join('\n');
}

function formatJobTimestamp(value) {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleString();
}

function buildIotOcrJobNotice(job) {
  if (!job?.status) return null;

  if (job.status === 'failed') {
    return {
      tone: 'error',
      message: job.error_message || 'IoT OCR job failed on the Pi worker.',
    };
  }

  if (job.status === 'completed') {
    const completedAt = formatJobTimestamp(job.completed_at);
    return {
      tone: 'success',
      message: completedAt
        ? `IoT OCR completed at ${completedAt}. Run again if you need a fresh capture.`
        : 'OCR completed. Run again?',
    };
  }

  if (job.status === 'in_progress') {
    const claimedAt = formatJobTimestamp(job.claimed_at);
    return {
      tone: 'info',
      message: claimedAt
        ? `Pi worker claimed this OCR job at ${claimedAt}.`
        : 'Pi worker has claimed this OCR job.',
    };
  }

  if (job.status === 'queued') {
    const createdAt = formatJobTimestamp(job.created_at);
    return {
      tone: 'warning',
      message: createdAt
        ? `OCR job queued at ${createdAt}. Waiting for the Pi worker to claim it.`
        : 'OCR job queued. Waiting for the Pi worker to claim it.',
    };
  }

  return {
    tone: 'info',
    message: `OCR job status: ${job.status}.`,
  };
}

function hasDocumentOcrResult(document) {
  if (!document) return false;

  return !!(
    document?.ocr?.raw_text
    || document?.ocr?.text
    || document?.ocr_confidence !== null && document?.ocr_confidence !== undefined
    || document?.ocr?.confidence !== null && document?.ocr?.confidence !== undefined
  );
}

function formatYesNo(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'N/A';
}

function buildFullName(person = {}) {
  const parts = [
    person.first_name,
    person.middle_name,
    person.last_name,
  ].filter(Boolean);

  return parts.length ? parts.join(' ') : null;
}

function buildAddress(profile = {}) {
  const parts = [
    profile.street_address,
    profile.subdivision,
    profile.city,
    profile.province,
    profile.zip_code,
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : null;
}

function groupFamilyMembersByRelation(familyMembers = []) {
  const order = ['Father', 'Mother', 'Guardian', 'Sibling'];

  return [...familyMembers].sort((a, b) => {
    const aIndex = order.indexOf(a.relation || '');
    const bIndex = order.indexOf(b.relation || '');

    const safeA = aIndex === -1 ? 999 : aIndex;
    const safeB = bIndex === -1 ? 999 : bIndex;

    return safeA - safeB;
  });
}

function groupEducationRecords(educationRecords = []) {
  const order = ['Elementary', 'High School', 'Senior High School', 'College'];

  return [...educationRecords].sort((a, b) => {
    const aIndex = order.indexOf(a.education_level || '');
    const bIndex = order.indexOf(b.education_level || '');

    const safeA = aIndex === -1 ? 999 : aIndex;
    const safeB = bIndex === -1 ? 999 : bIndex;

    return safeA - safeB;
  });
}

function ApplicationFormPreview({ application }) {
  const student = application?.student || {};
  const profile = application?.student_profile || {};
  const familyMembers = groupFamilyMembersByRelation(application?.family_members || []);
  const educationRecords = groupEducationRecords(application?.education_records || []);

  const fullAddress = buildAddress(profile);

  return (
    <div className="w-full h-[520px] overflow-y-auto bg-white border border-stone-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-stone-800 mb-3">
        Application Form Summary
      </h3>

      <div className="space-y-5 text-sm text-stone-700">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">
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
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">
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
            <InfoRow
              label="Learner's Reference Number"
              value={profile.learners_reference_number}
            />
            <InfoRow
              label="Financial Support Type"
              value={profile.financial_support_type}
            />
            <InfoRow
              label="Financial Support (Other)"
              value={profile.financial_support_other}
            />
            <InfoRow
              label="Prior Scholarship"
              value={formatYesNo(profile.has_prior_scholarship)}
            />
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
            <InfoRow
              label="Complete Address"
              value={fullAddress}
              className="md:col-span-2"
            />
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
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">
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
                      <p className="text-xs text-stone-500">
                        {fullName || 'No name provided'}
                      </p>
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
                      <InfoRow
                        label="Company Name / Address"
                        value={member.company_name_address}
                      />
                      <InfoRow
                        label="Marilao Native"
                        value={formatYesNo(member.is_marilao_native)}
                      />
                      <InfoRow
                        label="Years as Resident"
                        value={member.years_as_resident}
                      />
                      <InfoRow
                        label="Origin Province"
                        value={member.origin_province}
                      />
                      <InfoRow
                        label="Address"
                        value={member.address}
                        className="md:col-span-2"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-stone-400">No family records found.</p>
          )}
        </div>

        <div className="border-t border-stone-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">
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
                    <p className="text-xs text-stone-500">
                      {record.school_name || 'No school name provided'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <InfoRow label="Education Level" value={record.education_level} />
                    <InfoRow label="School Name" value={record.school_name} />
                    <InfoRow label="School Address" value={record.school_address} />
                    <InfoRow label="Honors / Awards" value={record.honors_awards} />
                    <InfoRow
                      label="Club / Organization"
                      value={record.club_organization}
                    />
                    <InfoRow label="Year Graduated" value={record.year_graduated} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-400">No education records found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function getFileType(document = {}) {
  const raw = (
    document?.file_name ||
    document?.url ||
    document?.file_path ||
    ''
  ).toLowerCase();

  if (
    raw.endsWith('.png') ||
    raw.endsWith('.jpg') ||
    raw.endsWith('.jpeg') ||
    raw.endsWith('.webp') ||
    raw.endsWith('.gif')
  ) {
    return 'image';
  }

  if (raw.endsWith('.pdf')) {
    return 'pdf';
  }

  return 'other';
}

function DocumentPreviewPanel({ activeDoc, application }) {
  const fileType = getFileType(activeDoc);

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-stone-500" />
          <div>
            <h4 className="text-sm font-semibold text-stone-800">
              {activeDoc?.name || 'Document'}
            </h4>
            <p className="text-[11px] text-stone-400">
              {activeDoc?.id === 'application_form'
                ? 'Submitted text-based form'
                : 'Uploaded by student'}
            </p>
          </div>
        </div>

        {activeDoc?.url && activeDoc?.id !== 'application_form' && (
          <a
            href={activeDoc.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
          >
            Open file
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <div className="p-4 min-h-[520px] flex items-center justify-center bg-stone-50/20">
        {activeDoc?.id === 'application_form' ? (
          <ApplicationFormPreview application={application} />
        ) : activeDoc?.url ? (
          fileType === 'image' ? (
            <div className="w-full h-[520px] flex items-center justify-center rounded-lg border border-stone-200 bg-white overflow-auto">
              <img
                src={activeDoc.url}
                alt={activeDoc.name}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : fileType === 'pdf' ? (
            <object
              data={activeDoc.url}
              type="application/pdf"
              className="w-full h-[520px] rounded-lg border border-stone-200 bg-white"
            >
              <iframe
                src={activeDoc.url}
                title={activeDoc.name}
                className="w-full h-[520px] rounded-lg border border-stone-200 bg-white"
              />
            </object>
          ) : (
            <iframe
              src={activeDoc.url}
              title={activeDoc.name}
              className="w-full h-[520px] rounded-lg border border-stone-200 bg-white"
            />
          )
        ) : (
          <div className="w-full max-w-sm bg-white rounded-xl p-8 text-center border border-stone-100 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <h4 className="text-sm font-semibold text-stone-800">
              {activeDoc?.name || 'Document'}
            </h4>
            <p className="text-xs text-stone-400 mt-1">
              No file uploaded by student yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function OCRPanel({
  activeDoc,
  extractedData,
  onRunIotOcr,
  runningIotOcr,
  iotOcrError,
  iotOcrNotice,
  rawOcrSnapshot,
  onRawOcrChange,
  onSaveRawOcr,
  savingRawOcr,
}) {
  const confidence = activeDoc?.ocr?.confidence ?? activeDoc?.ocr_confidence ?? null;
  const latestJobStatus = activeDoc?.ocr_job?.status ?? null;
  const hasPendingIotOcrJob =
    latestJobStatus === 'queued' || latestJobStatus === 'in_progress';
  const canRunIotOcr =
    activeDoc?.id !== 'application_form' && !hasPendingIotOcrJob;

  const runIotOcrLabel = runningIotOcr
    ? 'Running IoT OCR'
    : latestJobStatus === 'completed'
      ? 'Run IoT OCR Again'
      : latestJobStatus === 'failed'
        ? 'Retry IoT OCR'
        : latestJobStatus === 'queued'
          ? 'OCR Queued'
          : latestJobStatus === 'in_progress'
            ? 'OCR In Progress'
            : 'Use IoT OCR';

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <ScanText className="w-4 h-4 text-stone-500" />
          <div>
            <h4 className="text-sm font-semibold text-stone-800">OCR Validation Hub</h4>
            <p className="text-[11px] text-stone-400">Extracted text / validation markers</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRunIotOcr}
            disabled={!canRunIotOcr || runningIotOcr}
            className="h-8 rounded-lg border-stone-200 text-[11px]"
          >
            {runningIotOcr ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                {runIotOcrLabel}
              </>
            ) : (
              <>
                <ScanText className="w-3.5 h-3.5 mr-1.5" />
                {runIotOcrLabel}
              </>
            )}
          </Button>
          {confidence !== null && confidence !== undefined && (
            <Badge className="bg-stone-100 text-stone-700 border-stone-200 text-[10px] font-medium">
              Confidence: {confidence}%
            </Badge>
          )}
          <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] font-medium">
            Extracted Preview
          </Badge>
        </div>
      </div>

      <div className="p-4 min-h-[520px] space-y-4">
        {iotOcrNotice && (
          <div
            className={`rounded-lg px-3 py-2 text-xs ${
              iotOcrNotice.tone === 'error'
                ? 'border border-red-200 bg-red-50 text-red-700'
                : iotOcrNotice.tone === 'success'
                  ? 'border border-green-200 bg-green-50 text-green-700'
                  : iotOcrNotice.tone === 'warning'
                    ? 'border border-amber-200 bg-amber-50 text-amber-700'
                    : 'border border-blue-200 bg-blue-50 text-blue-700'
            }`}
          >
            {iotOcrNotice.message}
          </div>
        )}

        {iotOcrError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {iotOcrError}
          </div>
        )}

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
              Parsed Metadata
            </p>
          </div>

          <div className="space-y-2">
            {extractedData.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2"
              >
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-stone-400">{item.label}</p>
                  <p className="text-sm font-medium text-stone-800 mt-0.5">{item.value}</p>
                </div>

                <span
                  className={`text-[10px] font-medium px-2 py-1 rounded-full whitespace-nowrap ${item.verified ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                    }`}
                >
                  {item.verified ? 'Detected' : 'Review'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <p className="text-xs font-semibold text-stone-700 uppercase tracking-wide">
              Admin OCR Notes
            </p>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            Do not type the action taken. Invalid, wrong, mismatched, edited, or doctored
            documents should be rejected. The admin should only provide the rejection reason
            and any review remarks.
          </p>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[11px] uppercase tracking-wide text-stone-400">Raw OCR Snapshot</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveRawOcr}
              disabled={savingRawOcr || activeDoc?.id === 'application_form'}
              className="h-8 rounded-lg border-stone-200 text-[11px]"
            >
              {savingRawOcr ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Saving
                </>
              ) : (
                'Save OCR Snapshot'
              )}
            </Button>
          </div>
          <Textarea
            value={rawOcrSnapshot}
            onChange={(e) => onRawOcrChange(e.target.value)}
            disabled={activeDoc?.id === 'application_form'}
            className="min-h-[220px] text-xs text-stone-600 leading-relaxed whitespace-pre-wrap font-mono bg-stone-50 rounded-lg p-3 border border-stone-100 resize-y"
          />
        </div>
      </div>
    </div>
  );
}

function RejectDocumentModal({
  onClose,
  onConfirm,
  saving,
  activeDocName,
}) {
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
            <p className="text-xs text-stone-500 mt-0.5">
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
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-2">
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
                  <span className="text-sm text-stone-700">{option}</span>
                </label>
              ))}
            </div>
          </div>

          {selectedReason === 'Other' && (
            <div>
              <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400 block mb-1.5">
                Other Reason
              </label>
              <Textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Type the specific rejection reason..."
                className="rounded-lg bg-stone-50/50 border-stone-200 resize-none h-20 text-sm"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400 block mb-1.5">
              Admin Remarks
            </label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional remarks for review..."
              className="rounded-lg bg-stone-50/50 border-stone-200 resize-none h-20 text-sm"
            />
          </div>

          <p className="text-[11px] text-stone-500 leading-relaxed">
            Note: Do not type the action taken. Select the reason for rejection and add remarks only when needed.
          </p>
        </CardContent>

        <div className="px-5 py-4 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-9 rounded-lg border-stone-200 text-xs"
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="h-9 rounded-lg text-white text-xs border-none disabled:opacity-50"
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

export default function DocumentVerification() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [doc, setDoc] = useState('certificate_of_registration');
  const [comment, setComment] = useState('');
  const [docStatuses, setDocStatuses] = useState({});
  const [docComments, setDocComments] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('preview');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [runningIotOcr, setRunningIotOcr] = useState(false);
  const [iotOcrError, setIotOcrError] = useState('');
  const [iotOcrJobStateByDoc, setIotOcrJobStateByDoc] = useState({});
  const [iotOcrResults, setIotOcrResults] = useState({});
  const [rawOcrSnapshot, setRawOcrSnapshot] = useState('');
  const [savingRawOcr, setSavingRawOcr] = useState(false);
  const iotOcrPollingRef = useRef(null);

  const fetchApplicationDocuments = useCallback(async ({ soft = false } = {}) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);

      setError(null);

      const res = await fetch(`${API_BASE}/api/applications/${id}/documents`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to load application documents');
      }

      const data = await res.json();
      const normalizedDocs = normalizeRequiredDocuments(data?.documents || []);

      const initialStatuses = {};
      const initialComments = {};

      normalizedDocs.forEach((d) => {
        initialStatuses[d.id] = d.status || 'pending';
        initialComments[d.id] = d.admin_comment || '';
      });

      setApplication({
        ...data,
        documents: normalizedDocs,
      });
      
      // Only set initial doc on first load (not soft refresh)
      if (!soft) {
        const firstAvailable =
          normalizedDocs.find((d) => d.id !== 'application_form')?.id ||
          normalizedDocs.find((d) => d.url)?.id ||
          normalizedDocs[0]?.id ||
          'certificate_of_registration';
        setDoc(firstAvailable);
      }

      setIotOcrJobStateByDoc((prev) => {
        const next = { ...prev };

        normalizedDocs.forEach((document) => {
          if (document.ocr_job) {
            next[document.id] = document.ocr_job;
          }
        });

        return next;
      });
      
      setIotOcrResults({});
      setDocStatuses(initialStatuses);
      setDocComments(initialComments);
    } catch (err) {
      console.error('Document fetch error:', err);
      setError(err.message || 'Failed to load document data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchApplicationDocuments();
  }, [fetchApplicationDocuments]);

  const docs = useMemo(() => {
    const rawDocs = application?.documents || [];
    return rawDocs.map((d) => ({
      ...d,
      status: docStatuses[d.id] || d.status || 'pending',
      admin_comment: docComments[d.id] || '',
      ocr: iotOcrResults[d.id]?.ocr || d.ocr || {},
      ocr_job: iotOcrJobStateByDoc[d.id] || d.ocr_job || null,
      ocr_confidence:
        iotOcrResults[d.id]?.ocr_confidence ??
        iotOcrResults[d.id]?.ocr?.confidence ??
        d.ocr_confidence ??
        null,
    }));
  }, [application, docStatuses, docComments, iotOcrResults, iotOcrJobStateByDoc]);

  const isDocumentAvailable = (document) =>
    document?.id === 'application_form' ? true : !!document?.url;

  const REQUIRED_DOC_COUNT = REQUIRED_DOCUMENTS.length;
  const availableCount = docs.filter((d) => isDocumentAvailable(d)).length;
  const hasAnyUpload = availableCount > 0;
  const hasCompleteRequirements = availableCount >= REQUIRED_DOC_COUNT;

  const verifiedCount = docs.filter((d) => d.status === 'verified').length;
  const rejectedCount = docs.filter((d) => d.status === 'rejected').length;
  const reviewedCount = docs.filter(
    (d) => isDocumentAvailable(d) && d.status !== 'pending' && d.status !== 'uploaded'
  ).length;

  const requiredDocs = docs.slice(0, REQUIRED_DOC_COUNT);
  const allRequiredDocsUploaded = requiredDocs.every((d) => isDocumentAvailable(d));
  const allRequiredDocsReviewed = requiredDocs.every(
    (d) => isDocumentAvailable(d) && d.status !== 'pending' && d.status !== 'uploaded'
  );
  const allRequiredDocsVerified = requiredDocs.every(
    (d) => isDocumentAvailable(d) && d.status === 'verified'
  );

  const canCompleteVerification = allRequiredDocsUploaded && allRequiredDocsReviewed;
  const finalVerificationStatus = allRequiredDocsVerified ? 'verified' : 'rejected';

  const progress = docs.length ? Math.round((reviewedCount / docs.length) * 100) : 0;
  const activeDoc = docs.find((d) => d.id === doc) || docs[0] || null;
  const hasUploadedDocument =
    activeDoc?.id === 'application_form' || isDocumentAvailable(activeDoc);

  const extractedData = useMemo(
    () => buildExtractedData(activeDoc, application),
    [activeDoc, application]
  );
  const iotOcrNotice = useMemo(() => {
    if (runningIotOcr) {
      return {
        tone: 'info',
        message: 'Submitting OCR job and waiting for the Pi worker to process it.',
      };
    }

    return buildIotOcrJobNotice(activeDoc?.ocr_job);
  }, [activeDoc, runningIotOcr]);

  useEffect(() => {
    if (activeDoc) {
      setComment(docComments[activeDoc.id] || '');
      setIotOcrError('');
      const nextRawSnapshot = buildRawOcrSnapshot(activeDoc, application);
      setRawOcrSnapshot(nextRawSnapshot);
    }
  }, [activeDoc, docComments, application]);

  const handleCommentChange = (value) => {
    setComment(value);
    if (!activeDoc) return;

    setDocComments((prev) => ({
      ...prev,
      [activeDoc.id]: value,
    }));
  };

  const updateActiveDocStatus = (nextStatus, nextComment = null) => {
    if (!activeDoc || !hasUploadedDocument) return;

    setDocStatuses((prev) => ({
      ...prev,
      [activeDoc.id]: nextStatus,
    }));

    const resolvedComment = nextComment !== null ? nextComment : comment;

    setDocComments((prev) => ({
      ...prev,
      [activeDoc.id]: resolvedComment,
    }));

    setComment(resolvedComment);
  };

  const handleVerify = () => updateActiveDocStatus('verified');

  const openRejectModal = () => {
    if (!activeDoc || !hasUploadedDocument) return;
    setRejectModalOpen(true);
  };

  const handleRejectConfirm = (finalComment) => {
    updateActiveDocStatus('rejected', finalComment);
    setRejectModalOpen(false);
  };

  const handleRunIotOcr = async () => {
    if (!activeDoc || activeDoc.id === 'application_form') return;

    try {
      const activeDocId = activeDoc.id;
      setRunningIotOcr(true);
      setIotOcrError('');

      const res = await fetch(
        `${API_BASE}/api/applications/${id}/documents/${activeDoc.id}/iot-ocr`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to run IoT OCR');
      }

      const result = payload?.data || {};
      setIotOcrJobStateByDoc((prev) => ({
        ...prev,
        [activeDocId]: result?.id
          ? {
            id: result.id,
            status: result.status || 'queued',
            claimed_by: result.claimed_by || null,
            error_message: result.error_message || null,
            created_at: result.created_at || null,
            claimed_at: result.claimed_at || null,
            completed_at: result.completed_at || null,
            updated_at: result.updated_at || null,
          }
          : prev[activeDocId] || null,
      }));
      const hasImmediateOcrResult = hasDocumentOcrResult({
        ocr: result.ocr,
        ocr_confidence: result.ocr_confidence,
      });

      if (hasImmediateOcrResult) {
        setIotOcrResults((prev) => ({
          ...prev,
          [activeDocId]: {
            ocr: result.ocr || {},
            ocr_confidence:
              result.ocr_confidence ?? result.ocr?.confidence ?? null,
            raw_text:
              result.raw_text ??
              result.ocr?.raw_text ??
              result.ocr?.text ??
              '',
            extracted_fields: result.extracted_fields || {},
            source_payload: result.source_payload || null,
          },
        }));
      }

      if (iotOcrPollingRef.current) {
        clearInterval(iotOcrPollingRef.current);
      }

      let attempts = 0;
      const maxAttempts = 30;
      iotOcrPollingRef.current = setInterval(async () => {
        attempts += 1;

        try {
          await fetchApplicationDocuments({ soft: true });
        } catch {
          // Keep polling through transient fetch failures.
        }

        if (attempts >= maxAttempts) {
          clearInterval(iotOcrPollingRef.current);
          iotOcrPollingRef.current = null;
          setIotOcrError(
            'OCR job was queued, but no result was received within 90 seconds. Check whether the Pi worker is online and claiming jobs.'
          );
          setRunningIotOcr(false);
        }
      }, 3000);
    } catch (err) {
      console.error('RUN IOT OCR ERROR:', err);
      setIotOcrError(err.message || 'Failed to run IoT OCR');
      setRunningIotOcr(false);
    }
  };

  const handleSaveRawOcr = async () => {
    if (!activeDoc || activeDoc.id === 'application_form') return;

    try {
      setSavingRawOcr(true);
      setIotOcrError('');

      const res = await fetch(
        `${API_BASE}/api/applications/${id}/documents/${activeDoc.id}/ocr`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw_text: rawOcrSnapshot,
          }),
        }
      );

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to save OCR snapshot');
      }

      const result = payload?.data || {};

      setIotOcrResults((prev) => ({
        ...prev,
        [activeDoc.id]: {
          ocr: result.ocr || {
            raw_text: rawOcrSnapshot,
          },
          ocr_confidence:
            result.ocr_confidence ?? result.ocr?.confidence ?? null,
          raw_text: result.raw_text ?? rawOcrSnapshot,
          extracted_fields: result.extracted_fields || {},
          source_payload: result.source_payload || null,
        },
      }));

      await fetchApplicationDocuments({ soft: true });
    } catch (err) {
      console.error('SAVE RAW OCR ERROR:', err);
      setIotOcrError(err.message || 'Failed to save OCR snapshot');
    } finally {
      setSavingRawOcr(false);
    }
  };

  useEffect(() => {
    if (!runningIotOcr || !activeDoc || activeDoc.id === 'application_form') return;

    const latestDoc = (application?.documents || []).find((d) => d.id === activeDoc.id);
    const hasOcrResult = hasDocumentOcrResult(latestDoc);

    if (hasOcrResult) {
      if (iotOcrPollingRef.current) {
        clearInterval(iotOcrPollingRef.current);
        iotOcrPollingRef.current = null;
      }
      setRunningIotOcr(false);
    }
  }, [runningIotOcr, application, activeDoc]);

  // Stop polling when user changes documents
  useEffect(() => {
    if (runningIotOcr && iotOcrPollingRef.current) {
      clearInterval(iotOcrPollingRef.current);
      iotOcrPollingRef.current = null;
      setRunningIotOcr(false);
      setIotOcrError('');
    }
  }, [doc, runningIotOcr]); // When doc changes, stop any running OCR polling

  useEffect(() => {
    return () => {
      if (iotOcrPollingRef.current) {
        clearInterval(iotOcrPollingRef.current);
        iotOcrPollingRef.current = null;
      }
    };
  }, []);

  const handleCompleteVerification = async () => {
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
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save verification');
      }

      const finalOutcome = data?.data?.final_outcome;

      alert(
        finalOutcome === 'approved'
          ? 'Verification completed successfully. The student has been approved and notified.'
          : finalOutcome === 'waiting'
            ? 'Verification completed successfully. The student has been moved to the waiting list and notified.'
            : finalVerificationStatus === 'verified'
              ? 'Verification completed successfully.'
              : 'Verification completed. Application marked as rejected and ready for archiving.'
      );

      navigate('/admin/applications');
    } catch (err) {
      console.error('COMPLETE VERIFICATION ERROR:', err);
      alert(err.message || 'Failed to complete verification');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <XCircle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-800">Failed to load document verification</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <Button
          onClick={() => fetchApplicationDocuments()}
          variant="outline"
          size="sm"
          className="mt-4 border-red-200 text-red-600 text-xs"
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
          <div className="flex items-center gap-1.5 text-xs text-stone-400">
            <span
              className="hover:text-stone-600 cursor-pointer transition-colors"
              onClick={() => navigate('/admin/applications')}
            >
              Registry
            </span>
            <ChevronRight size={11} />
            <span className="text-stone-600">{id}</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-900 mt-0.5">Document Verification</h1>
        </div>

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchApplicationDocuments({ soft: true })}
            disabled={refreshing}
            className="rounded-lg border-stone-200 text-xs"
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-stone-200 shadow-none bg-white">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <Avatar className="w-12 h-12 border border-stone-100">
                  <AvatarImage
                    src={application?.student?.avatar_url || undefined}
                    alt={application?.student?.name || 'Student'}
                  />
                  <AvatarFallback className="bg-blue-900 text-white text-sm font-semibold">
                    {application?.student?.initials || 'NA'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-base font-semibold text-stone-900">{application?.student?.name}</h2>
                  <p className="text-xs font-mono text-stone-400">{application?.student?.pdm_id}</p>
                  <Badge className="mt-1.5 bg-blue-50 text-blue-700 border-blue-100 font-medium text-[10px] uppercase tracking-wide">
                    {application?.student?.program}
                  </Badge>
                </div>
              </div>

              <div className="space-y-3.5 pt-4 border-t border-stone-100">
                <InfoRow label="Email Address" value={application?.student?.email} />
                <InfoRow label="Phone Number" value={application?.student?.phone} />
                <div className="grid grid-cols-2 gap-3.5">
                  <InfoRow label="Academic Year" value={application?.student?.year} />
                  <InfoRow label="GWA Score" value={application?.student?.gwa} mono />
                </div>
                <InfoRow label="Course / Program" value={application?.student?.course} />
                <InfoRow label="Document Status" value={application?.document_status} />
              </div>
            </div>
          </Card>

          <Card className="border-stone-200 shadow-none bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50/50">
              <h3 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">Checklist</h3>
              <span className="text-xs text-stone-400">{availableCount}/{docs.length} available</span>
            </div>

            <CardContent className="p-3 space-y-1.5">
              {docs.map((d) => {
                const s = DOC_STATUS[d.status] || DOC_STATUS.pending;
                const isActive = doc === d.id;
                const available = isDocumentAvailable(d);

                return (
                  <button
                    key={d.id}
                    onClick={() => setDoc(d.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${isActive ? 'border-blue-800 bg-blue-50 shadow-sm' : 'border-stone-100 bg-white hover:border-stone-200'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span style={{ color: s.color }}>{s.icon}</span>
                      <div className="min-w-0">
                        <p className={`text-xs truncate ${isActive ? 'font-semibold text-blue-900' : 'font-medium text-stone-700'}`}>
                          {d.name}
                        </p>
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {d.id === 'application_form'
                            ? 'Text-based application data'
                            : available
                              ? 'File uploaded'
                              : 'No file uploaded'}
                        </p>
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}

              <div className="mt-3 pt-3 border-t border-stone-100 space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">
                      Verification Progress
                    </span>
                    <span className="text-[10px] font-semibold text-stone-700">{progress}%</span>
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
                    <p className="text-[10px] uppercase tracking-wide text-stone-400">Verified</p>
                    <p className="text-sm font-semibold text-green-700">{verifiedCount}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-stone-400">Rejected</p>
                    <p className="text-sm font-semibold text-orange-700">{rejectedCount}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">Readiness</p>

                  {!hasAnyUpload ? (
                    <p className="text-xs font-semibold mt-1 text-red-700">
                      No submitted requirements yet.
                    </p>
                  ) : !hasCompleteRequirements ? (
                    <p className="text-xs font-semibold mt-1 text-orange-700">
                      Incomplete requirements: {availableCount}/{REQUIRED_DOC_COUNT} available.
                    </p>
                  ) : !allRequiredDocsReviewed ? (
                    <p className="text-xs font-semibold mt-1 text-orange-700">
                      All {REQUIRED_DOC_COUNT} requirements are available, but admin review actions are still pending.
                    </p>
                  ) : allRequiredDocsVerified ? (
                    <p className="text-xs font-semibold mt-1 text-green-700">
                      All {REQUIRED_DOC_COUNT} required items are verified.
                    </p>
                  ) : (
                    <p className="text-xs font-semibold mt-1 text-orange-700">
                      Review is complete, but one or more required items were rejected.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <Card className="border-stone-200 shadow-none bg-white overflow-hidden">
            <div className="flex border-b border-stone-100 bg-stone-50/50 overflow-x-auto">
              {docs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDoc(d.id)}
                  className={`px-4 py-3 text-xs font-medium border-b-2 transition-all shrink-0 ${doc === d.id
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
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'preview' ? 'bg-white text-blue-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                    }`}
                >
                  Document Preview
                </button>

                <button
                  onClick={() => setViewMode('ocr')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'ocr' ? 'bg-white text-blue-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                    }`}
                >
                  OCR Validation Hub
                </button>

                <button
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'split' ? 'bg-white text-blue-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
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
                <p className="text-sm text-stone-400">No document selected.</p>
              ) : viewMode === 'preview' ? (
                <DocumentPreviewPanel activeDoc={activeDoc} application={application} />
              ) : viewMode === 'ocr' ? (
                <OCRPanel
                  activeDoc={activeDoc}
                  application={application}
                  extractedData={extractedData}
                  onRunIotOcr={handleRunIotOcr}
                  runningIotOcr={runningIotOcr}
                  iotOcrError={iotOcrError}
                  iotOcrNotice={iotOcrNotice}
                  rawOcrSnapshot={rawOcrSnapshot}
                  onRawOcrChange={setRawOcrSnapshot}
                  onSaveRawOcr={handleSaveRawOcr}
                  savingRawOcr={savingRawOcr}
                />
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <DocumentPreviewPanel activeDoc={activeDoc} application={application} />
                  <OCRPanel
                    activeDoc={activeDoc}
                    application={application}
                    extractedData={extractedData}
                    onRunIotOcr={handleRunIotOcr}
                    runningIotOcr={runningIotOcr}
                    iotOcrError={iotOcrError}
                    iotOcrNotice={iotOcrNotice}
                    rawOcrSnapshot={rawOcrSnapshot}
                    onRawOcrChange={setRawOcrSnapshot}
                    onSaveRawOcr={handleSaveRawOcr}
                    savingRawOcr={savingRawOcr}
                  />
                </div>
              )}
            </div>
          </Card>

          <Card className="border-stone-200 shadow-none bg-white">
            <div className="p-5 space-y-4">
              <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400">
                      Selected Document
                    </p>
                    <p className="text-sm font-semibold text-stone-800 mt-1">{activeDoc?.name || 'N/A'}</p>
                    <p className="text-xs text-stone-400 mt-1">
                      {activeDoc?.id === 'application_form'
                        ? 'Text-based application form ready for admin review.'
                        : activeDoc?.url
                          ? 'Uploaded by student and ready for admin review.'
                          : 'No uploaded file from student yet.'}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-medium text-stone-400 uppercase tracking-wider block mb-1.5">
                  Rejection Reason / Admin Remarks
                </label>
                <Textarea
                  placeholder={
                    activeDoc?.id === 'application_form'
                      ? 'Admin remarks for application form review.'
                      : hasUploadedDocument
                        ? 'The rejection note is filled automatically from the reject modal. You may edit remarks here if needed.'
                        : 'No uploaded document selected yet.'
                  }
                  value={comment}
                  onChange={(e) => handleCommentChange(e.target.value)}
                  disabled={!hasUploadedDocument}
                  className="rounded-lg bg-stone-50/50 border-stone-200 resize-none h-20 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Note: Do not type the action performed. If the file is wrong, invalid, edited,
                  mismatched, or suspected doctored, reject it and provide the reason and any remarks only.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerify}
                  disabled={!hasUploadedDocument}
                  className="h-9 rounded-lg text-xs border-stone-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle size={13} className="mr-1.5" /> Verify
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={openRejectModal}
                  disabled={!hasUploadedDocument}
                  className="h-9 rounded-lg text-xs border-stone-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle size={13} className="mr-1.5" /> Reject
                </Button>
              </div>

              {!hasUploadedDocument && activeDoc?.id !== 'application_form' && (
                <p className="text-xs text-stone-400">
                  Student must upload this document first before review actions can be applied.
                </p>
              )}

              {!hasAnyUpload && (
                <p className="text-xs text-stone-400">
                  Complete verification is disabled until the required items are available.
                </p>
              )}

              {hasAnyUpload && !hasCompleteRequirements && (
                <p className="text-xs text-orange-600">
                  Complete verification is disabled until all {REQUIRED_DOC_COUNT} required items are available.
                </p>
              )}

              {hasCompleteRequirements && !allRequiredDocsReviewed && (
                <p className="text-xs text-orange-600">
                  All {REQUIRED_DOC_COUNT} items are present. Apply admin review actions to each item before completing verification.
                </p>
              )}

              {hasCompleteRequirements && allRequiredDocsReviewed && !allRequiredDocsVerified && (
                <p className="text-xs text-orange-600">
                  Verification can be completed, but the application will be marked as rejected and can be archived afterward.
                </p>
              )}

              <Button
                onClick={handleCompleteVerification}
                disabled={submitting || !canCompleteVerification}
                className="w-full h-10 rounded-lg font-medium text-sm text-white border-none disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: C.blue }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving Verification...
                  </>
                ) : !hasAnyUpload ? (
                  'Complete Verification & Next'
                ) : !hasCompleteRequirements ? (
                  `Wait for All ${REQUIRED_DOC_COUNT} Items`
                ) : !allRequiredDocsReviewed ? (
                  'Review All Items First'
                ) : finalVerificationStatus === 'verified' ? (
                  'Complete Verification & Next'
                ) : (
                  'Save Verification as Rejected'
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · Document Verification Layer
        </p>
      </footer>
    </div>
  );
}
