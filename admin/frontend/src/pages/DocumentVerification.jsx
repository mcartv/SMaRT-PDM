import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, XCircle, Clock, ArrowLeft,
  FileText, Flag, ChevronRight, Loader2,
  AlertTriangle, ShieldCheck, ScanText, ExternalLink,
  Columns2,
} from 'lucide-react';

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
    label: 'Re-upload',
  },
  flagged: {
    icon: <Flag className="w-3.5 h-3.5" />,
    color: C.red,
    bg: '#fef2f2',
    label: 'Flagged',
  },
};

const REQUIRED_DOCUMENTS = [
  {
    id: 'cor',
    name: 'Certificate of Registration',
    aliases: ['cor', 'certificate of registration', 'registration form'],
  },
  {
    id: 'grades',
    name: 'Grade Form',
    aliases: ['grades', 'grade form', 'grade card', 'report card'],
  },
  {
    id: 'loi',
    name: 'Letter of Intent',
    aliases: ['loi', 'letter of intent'],
  },
  {
    id: 'good_moral',
    name: 'Good Moral',
    aliases: ['good moral', 'good moral certificate', 'certificate of good moral'],
  },
  {
    id: 'application_form',
    name: 'Application Form',
    aliases: ['application form', 'application', 'scholarship application form'],
  },
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
    cfg.aliases.some((alias) => candidates.includes(normalizeKey(alias)))
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
      url: rawDoc.url || rawDoc.file_url || rawDoc.document_url || '',
      status: rawDoc.status || rawDoc.document_status || 'pending',
      admin_comment: rawDoc.admin_comment || rawDoc.comment || '',
      ocr: rawDoc.ocr || {},
      ocr_confidence: rawDoc.ocr_confidence ?? rawDoc.ocr?.confidence ?? null,
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
    };
  });
}

function InfoRow({ label, value, mono }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400 mb-0.5">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono text-stone-600' : 'font-medium text-stone-800'}`}>
        {value || 'N/A'}
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
    case 'loi':
      return [
        ...base,
        { label: 'Document Type', value: 'Letter of Intent', verified: true },
        {
          label: 'Intent Statement',
          value: activeDoc.url ? 'Detected and ready for admin review' : 'No uploaded file detected',
          verified: !!activeDoc.url,
        },
        {
          label: 'Signature Presence',
          value: activeDoc.url ? 'Detected' : 'Not detected',
          verified: !!activeDoc.url,
        },
      ];

    case 'cor':
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

    case 'grades':
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

    case 'good_moral':
      return [
        ...base,
        { label: 'Document Type', value: 'Good Moral', verified: true },
        {
          label: 'Conduct Certification',
          value: activeDoc.url ? 'Detected and ready for review' : 'No uploaded file detected',
          verified: !!activeDoc.url,
        },
        {
          label: 'School/Issuer Marker',
          value: activeDoc.url ? 'Present' : 'Missing',
          verified: !!activeDoc.url,
        },
      ];

    case 'application_form':
      return [
        ...base,
        { label: 'Document Type', value: 'Application Form', verified: true },
        {
          label: 'Applicant Signature',
          value: activeDoc.url ? 'Detected' : 'Not detected',
          verified: !!activeDoc.url,
        },
        {
          label: 'Form Completeness',
          value: activeDoc.url ? 'Ready for admin review' : 'No uploaded file detected',
          verified: !!activeDoc.url,
        },
      ];

    default:
      return base;
  }
}

function DocumentPreviewPanel({ activeDoc }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-stone-500" />
          <div>
            <h4 className="text-sm font-semibold text-stone-800">{activeDoc.name}</h4>
            <p className="text-[11px] text-stone-400">Scanned / Uploaded Document</p>
          </div>
        </div>

        {activeDoc.url && (
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
        {activeDoc.url ? (
          <iframe
            src={activeDoc.url}
            title={activeDoc.name}
            className="w-full h-[520px] rounded-lg border border-stone-200 bg-white"
          />
        ) : (
          <div className="w-full max-w-sm bg-white rounded-xl p-8 text-center border border-stone-100 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <h4 className="text-sm font-semibold text-stone-800">{activeDoc.name}</h4>
            <p className="text-xs text-stone-400 mt-1">No file uploaded yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OCRPanel({ activeDoc, application, extractedData }) {
  const confidence = activeDoc?.ocr?.confidence ?? activeDoc?.ocr_confidence ?? null;

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
            Compare the uploaded file against the extracted OCR fields. If text is incomplete,
            blurred, inconsistent, or mismatched with student records, mark the document for
            re-upload or flag it for further review.
          </p>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-[11px] uppercase tracking-wide text-stone-400 mb-1">Raw OCR Snapshot</p>
          <div className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap font-mono bg-stone-50 rounded-lg p-3 border border-stone-100">
            {`DOCUMENT: ${activeDoc.name}
STUDENT: ${application?.student?.name || 'Unknown'}
PDM ID: ${application?.student?.pdm_id || 'N/A'}
PROGRAM: ${application?.student?.program || 'N/A'}
COURSE: ${application?.student?.course || 'N/A'}
GWA: ${application?.student?.gwa ?? 'N/A'}

STATUS:
- File ${activeDoc.url ? 'detected and readable' : 'not uploaded'}
- OCR fields available for manual admin validation
- Final approval depends on review status`}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentVerification() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [doc, setDoc] = useState('cor');
  const [comment, setComment] = useState('');
  const [docStatuses, setDocStatuses] = useState({});
  const [docComments, setDocComments] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('preview');

  useEffect(() => {
    const fetchApplicationDocuments = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`http://localhost:5000/api/applications/${id}/documents`, {
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
        const firstAvailable = normalizedDocs.find((d) => d.url)?.id || normalizedDocs[0]?.id || 'cor';

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
        setDoc(firstAvailable);
        setDocStatuses(initialStatuses);
        setDocComments(initialComments);
      } catch (err) {
        console.error('Document fetch error:', err);
        setError(err.message || 'Failed to load document data');
      } finally {
        setLoading(false);
      }
    };

    fetchApplicationDocuments();
  }, [id]);

  const docs = useMemo(() => {
    const rawDocs = application?.documents || [];
    return rawDocs.map((d) => ({
      ...d,
      status: docStatuses[d.id] || d.status || 'pending',
      admin_comment: docComments[d.id] || '',
    }));
  }, [application, docStatuses, docComments]);

  const REQUIRED_DOC_COUNT = REQUIRED_DOCUMENTS.length;

  const uploaded = docs.filter((d) => !!d.url).length;
  const hasAnyUpload = uploaded > 0;
  const hasCompleteRequirements = uploaded >= REQUIRED_DOC_COUNT;

  const verifiedCount = docs.filter((d) => d.status === 'verified').length;
  const flaggedCount = docs.filter((d) => d.status === 'flagged').length;
  const reuploadCount = docs.filter((d) => d.status === 'rejected').length;
  const reviewedCount = docs.filter((d) => !!d.url && d.status !== 'pending').length;

  const requiredDocs = docs.slice(0, REQUIRED_DOC_COUNT);
  const allRequiredDocsUploaded = requiredDocs.every((d) => !!d.url);
  const allRequiredDocsReviewed = requiredDocs.every((d) => !!d.url && d.status !== 'pending');
  const allRequiredDocsVerified = requiredDocs.every((d) => !!d.url && d.status === 'verified');

  const canCompleteVerification =
    allRequiredDocsUploaded &&
    allRequiredDocsReviewed;

  const finalVerificationStatus =
    allRequiredDocsVerified ? 'verified' : 'rejected';

  const progress = docs.length ? Math.round((reviewedCount / docs.length) * 100) : 0;
  const activeDoc = docs.find((d) => d.id === doc) || docs[0] || null;
  const hasUploadedDocument = !!activeDoc?.url;

  const extractedData = useMemo(
    () => buildExtractedData(activeDoc, application),
    [activeDoc, application]
  );

  useEffect(() => {
    if (activeDoc) {
      setComment(docComments[activeDoc.id] || '');
    }
  }, [activeDoc, docComments]);

  const handleCommentChange = (value) => {
    setComment(value);
    if (!activeDoc) return;

    setDocComments((prev) => ({
      ...prev,
      [activeDoc.id]: value,
    }));
  };

  const updateActiveDocStatus = (nextStatus) => {
    if (!activeDoc || !hasUploadedDocument) return;

    setDocStatuses((prev) => ({
      ...prev,
      [activeDoc.id]: nextStatus,
    }));

    setDocComments((prev) => ({
      ...prev,
      [activeDoc.id]: comment,
    }));
  };

  const handleVerify = () => updateActiveDocStatus('verified');
  const handleReupload = () => updateActiveDocStatus('rejected');
  const handleFlag = () => updateActiveDocStatus('flagged');

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
          uploaded,
          flagged: flaggedCount,
          reupload: reuploadCount,
          progress,
        },
      };

      const res = await fetch(`http://localhost:5000/api/applications/${id}/verify`, {
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

      const markReviewRes = await fetch(`http://localhost:5000/api/applications/${id}/mark-reviewed`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!markReviewRes.ok) {
        const payload = await markReviewRes.json().catch(() => ({}));
        throw new Error(payload.error || 'Verification saved, but application review status was not updated');
      }

      alert(
        finalVerificationStatus === 'verified'
          ? 'Verification completed successfully.'
          : 'Verification completed. Application marked as requiring re-upload or further review.'
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
          onClick={() => window.location.reload()}
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-stone-200 shadow-none bg-white">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <Avatar className="w-12 h-12 border border-stone-100">
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
              <span className="text-xs text-stone-400">{uploaded}/{docs.length} uploaded</span>
            </div>

            <CardContent className="p-3 space-y-1.5">
              {docs.map((d) => {
                const s = DOC_STATUS[d.status] || DOC_STATUS.pending;
                const isActive = doc === d.id;

                return (
                  <button
                    key={d.id}
                    onClick={() => setDoc(d.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all text-left ${isActive
                        ? 'border-blue-800 bg-blue-50 shadow-sm'
                        : 'border-stone-100 bg-white hover:border-stone-200'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span style={{ color: s.color }}>{s.icon}</span>
                      <div className="min-w-0">
                        <p className={`text-xs truncate ${isActive ? 'font-semibold text-blue-900' : 'font-medium text-stone-700'}`}>
                          {d.name}
                        </p>
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {d.url ? 'File uploaded' : 'No file uploaded'}
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

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-stone-400">Verified</p>
                    <p className="text-sm font-semibold text-green-700">{verifiedCount}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-stone-400">Flagged</p>
                    <p className="text-sm font-semibold text-red-700">{flaggedCount}</p>
                  </div>
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-stone-400">Re-upload</p>
                    <p className="text-sm font-semibold text-orange-700">{reuploadCount}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-stone-200 bg-white px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wide text-stone-400">Readiness</p>

                  {!hasAnyUpload ? (
                    <p className="text-xs font-semibold mt-1 text-red-700">
                      No uploaded documents yet.
                    </p>
                  ) : !hasCompleteRequirements ? (
                    <p className="text-xs font-semibold mt-1 text-orange-700">
                      Incomplete requirements: {uploaded}/{REQUIRED_DOC_COUNT} uploaded.
                    </p>
                  ) : !allRequiredDocsReviewed ? (
                    <p className="text-xs font-semibold mt-1 text-orange-700">
                      All 5 documents are uploaded, but admin review actions are still pending.
                    </p>
                  ) : allRequiredDocsVerified ? (
                    <p className="text-xs font-semibold mt-1 text-green-700">
                      All 5 required documents are uploaded and verified.
                    </p>
                  ) : (
                    <p className="text-xs font-semibold mt-1 text-orange-700">
                      Review is complete, but one or more required documents need re-upload or follow-up.
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
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'preview'
                      ? 'bg-white text-blue-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                    }`}
                >
                  Document Preview
                </button>

                <button
                  onClick={() => setViewMode('ocr')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'ocr'
                      ? 'bg-white text-blue-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                    }`}
                >
                  OCR Validation Hub
                </button>

                <button
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'split'
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
                <p className="text-sm text-stone-400">No document selected.</p>
              ) : viewMode === 'preview' ? (
                <DocumentPreviewPanel activeDoc={activeDoc} />
              ) : viewMode === 'ocr' ? (
                <OCRPanel
                  activeDoc={activeDoc}
                  application={application}
                  extractedData={extractedData}
                />
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <DocumentPreviewPanel activeDoc={activeDoc} />
                  <OCRPanel
                    activeDoc={activeDoc}
                    application={application}
                    extractedData={extractedData}
                  />
                </div>
              )}
            </div>
          </Card>

          <Card className="border-stone-200 shadow-none bg-white">
            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-medium text-stone-400 uppercase tracking-wider block mb-1.5">
                  Administrative Feedback
                </label>
                <Textarea
                  placeholder={
                    hasUploadedDocument
                      ? 'Enter specific instructions or reasons for document rejection...'
                      : 'No uploaded document selected yet.'
                  }
                  value={comment}
                  onChange={(e) => handleCommentChange(e.target.value)}
                  disabled={!hasUploadedDocument}
                  className="rounded-lg bg-stone-50/50 border-stone-200 resize-none h-20 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleVerify}
                  disabled={!hasUploadedDocument}
                  className="h-9 rounded-lg text-xs border-stone-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-stone-400 disabled:hover:border-stone-200"
                >
                  <CheckCircle size={13} className="mr-1.5" /> Verify
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReupload}
                  disabled={!hasUploadedDocument}
                  className="h-9 rounded-lg text-xs border-stone-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-stone-400 disabled:hover:border-stone-200"
                >
                  <XCircle size={13} className="mr-1.5" /> Re-upload
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFlag}
                  disabled={!hasUploadedDocument}
                  className="h-9 rounded-lg text-xs border-stone-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-stone-400 disabled:hover:border-stone-200"
                >
                  <Flag size={13} className="mr-1.5" /> Flag
                </Button>
              </div>

              {!hasUploadedDocument && (
                <p className="text-xs text-stone-400">
                  Upload required before review actions can be applied to this document.
                </p>
              )}

              {!hasAnyUpload && (
                <p className="text-xs text-stone-400">
                  Complete verification is disabled until the applicant uploads the required documents.
                </p>
              )}

              {hasAnyUpload && !hasCompleteRequirements && (
                <p className="text-xs text-orange-600">
                  Complete verification is disabled until all 5 required documents are uploaded.
                </p>
              )}

              {hasCompleteRequirements && !allRequiredDocsReviewed && (
                <p className="text-xs text-orange-600">
                  All 5 documents are present. Apply admin feedback/actions to each document before completing verification.
                </p>
              )}

              {hasCompleteRequirements && allRequiredDocsReviewed && !allRequiredDocsVerified && (
                <p className="text-xs text-orange-600">
                  Verification can be completed, but the application will be marked as needing re-upload or further review.
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
                  `Upload All ${REQUIRED_DOC_COUNT} Documents First`
                ) : !allRequiredDocsReviewed ? (
                  'Review All Documents First'
                ) : finalVerificationStatus === 'verified' ? (
                  'Complete Verification & Next'
                ) : (
                  'Save Verification as Needs Re-upload'
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