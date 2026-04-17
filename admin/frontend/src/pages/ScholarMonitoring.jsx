import React, { useState, useMemo, useEffect } from 'react';

// --- SHADCN UI COMPONENTS ---
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// --- ICONS ---
import {
  Search, Download, Eye, ChevronLeft, ChevronRight,
  AlertTriangle, Users, CheckCircle2, Clock, Loader2,
  X, Mail, Phone, CalendarDays, ShieldAlert, FileText,
  Files, ScanSearch, RefreshCw, ExternalLink, FileCheck2
} from 'lucide-react';

// ─── Theme ───────────────────────────────────────────────────────
const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  blue: '#2563eb',
  blueSoft: '#EFF6FF',
  text: '#1c1917',
  bg: '#faf7f2',
  muted: '#78716c',
};

// ─── Constants ───────────────────────────────────────────────────
const SDU_STYLE = {
  none: { label: 'Clear', color: C.green, bg: C.greenSoft },
  minor: { label: 'Minor', color: C.amber, bg: C.amberSoft },
  major: { label: 'Major', color: C.red, bg: C.redSoft },
};

const RO_COLOR = {
  complete: C.green,
  progress: C.amber,
  behind: C.red,
};

const CONDITION_STYLE = {
  good: { label: 'Good Standing', color: C.green, bg: C.greenSoft },
  monitor: { label: 'Monitor', color: C.amber, bg: C.amberSoft },
  risk: { label: 'At Risk', color: C.red, bg: C.redSoft },
  critical: { label: 'Critical', color: '#991b1b', bg: '#fee2e2' },
};

const REMOVAL_REASONS = [
  'Failed GWA requirement',
  'SDU / disciplinary case',
  'Failed RO compliance',
  'Voluntary withdrawal',
  'Transferred out',
  'Graduated',
  'Duplicate / invalid record',
  'Other',
];

const RENEWAL_STATUS_STYLE = {
  pending_submission: { label: 'Pending Submission', color: '#78716c', bg: '#f5f5f4' },
  submitted: { label: 'Submitted', color: C.blue, bg: C.blueSoft },
  under_review: { label: 'Under Review', color: C.amber, bg: C.amberSoft },
  approved: { label: 'Approved', color: C.green, bg: C.greenSoft },
  needs_reupload: { label: 'Needs Re-upload', color: C.red, bg: C.redSoft },
};

const PAGE_SIZE = 10;

function getInitials(name = '') {
  return (name || 'NA')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ─── Helpers ─────────────────────────────────────────────────────
function getScholarConditionMeta(gwa, sdu) {
  const g = Number(gwa);
  const level = sdu || 'none';

  if (!Number.isNaN(g) && g > 2.0 && level === 'major') return CONDITION_STYLE.critical;
  if (!Number.isNaN(g) && g > 2.0) return CONDITION_STYLE.risk;
  if (level === 'major') return CONDITION_STYLE.risk;
  if (level === 'minor') return CONDITION_STYLE.monitor;

  return CONDITION_STYLE.good;
}

function getFileTypeLabel(url = '', name = '') {
  const value = `${url} ${name}`.toLowerCase();
  if (value.includes('.pdf')) return 'PDF';
  if (value.includes('.png') || value.includes('.jpg') || value.includes('.jpeg') || value.includes('.webp')) return 'Image';
  return 'File';
}

function isImageFile(url = '', name = '') {
  const value = `${url} ${name}`.toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].some((ext) => value.includes(ext));
}

function getRenewalStatusMeta(raw) {
  const key = String(raw || '').toLowerCase();
  return RENEWAL_STATUS_STYLE[key] || RENEWAL_STATUS_STYLE.pending_submission;
}

function deriveRenewalStatusFromDocuments(documents = []) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return 'pending_submission';
  }

  const uploaded = documents.filter((d) => d.url);
  if (uploaded.length === 0) return 'pending_submission';

  const hasMissing = documents.some((d) => !d.url);
  const hasFlagged = documents.some((d) => String(d.ocrStatus || '').toLowerCase() === 'flagged');
  const hasVerified = documents.length > 0 && documents.every((d) => {
    if (!d.url) return false;
    const ocr = String(d.ocrStatus || '').toLowerCase();
    return ocr === 'verified' || ocr === 'ready for ocr' || ocr === 'not analyzed';
  });

  if (hasFlagged || hasMissing) return 'needs_reupload';
  if (hasVerified) return 'submitted';
  return 'under_review';
}

function normalizeRenewalDocuments(payload, scholar) {
  if (Array.isArray(payload)) {
    return payload.map((doc, index) => ({
      id: doc.id || `${doc.document_type || 'doc'}-${index}`,
      name: doc.name || doc.document_name || doc.document_type || `Document ${index + 1}`,
      type: doc.type || doc.document_type || 'Renewal Document',
      url: doc.url || doc.file_url || doc.document_url || '',
      status: doc.status || doc.verification_status || 'Pending Review',
      uploadedAt: doc.uploaded_at || doc.created_at || null,
      ocrStatus: doc.ocr_status || 'Not Analyzed',
      extractedText: doc.extracted_text || '',
      ocrFields: doc.ocr_fields || {},
      remarks: doc.remarks || '',
      confidence: typeof doc.confidence === 'number' ? doc.confidence : null,
    }));
  }

  if (payload && Array.isArray(payload.documents)) {
    return normalizeRenewalDocuments(payload.documents, scholar);
  }

  return [
    {
      id: 'cor',
      name: 'Certificate of Registration',
      type: 'COR',
      url: scholar?.certificate_of_registration_url || '',
      status: scholar?.certificate_of_registration_url ? 'Uploaded' : 'Missing',
      uploadedAt: null,
      ocrStatus: scholar?.certificate_of_registration_url ? 'Ready for OCR' : 'Not Available',
      extractedText: '',
      ocrFields: {},
      remarks: '',
      confidence: null,
    },
    {
      id: 'grades',
      name: 'Grade Form',
      type: 'Grades',
      url: scholar?.grade_form_url || '',
      status: scholar?.grade_form_url ? 'Uploaded' : 'Missing',
      uploadedAt: null,
      ocrStatus: scholar?.grade_form_url ? 'Ready for OCR' : 'Not Available',
      extractedText: '',
      ocrFields: {},
      remarks: '',
      confidence: null,
    },
    {
      id: 'indigency',
      name: 'Certificate of Indigency',
      type: 'Indigency',
      url: scholar?.certificate_of_indigency_url || '',
      status: scholar?.certificate_of_indigency_url ? 'Uploaded' : 'Missing',
      uploadedAt: null,
      ocrStatus: scholar?.certificate_of_indigency_url ? 'Ready for OCR' : 'Not Available',
      extractedText: '',
      ocrFields: {},
      remarks: '',
      confidence: null,
    },
    {
      id: 'validid',
      name: 'Valid ID',
      type: 'Identification',
      url: scholar?.valid_id_url || '',
      status: scholar?.valid_id_url ? 'Uploaded' : 'Missing',
      uploadedAt: null,
      ocrStatus: scholar?.valid_id_url ? 'Ready for OCR' : 'Not Available',
      extractedText: '',
      ocrFields: {},
      remarks: '',
      confidence: null,
    },
  ];
}

// ─── Scholar Profile Modal ───────────────────────────────────────
function ScholarProfileModal({ scholar, loading, onClose }) {
  if (!scholar && !loading) return null;

  const s = scholar || {};
  const gwaValue = Number(s.gwa);
  const sduStyle = SDU_STYLE[s.sdu_level || 'none'] || SDU_STYLE.none;
  const pct = Number(s.ro_progress || 0);
  const condition = getScholarConditionMeta(s.gwa, s.sdu_level);

  const roStatus =
    pct === 100 ? 'complete' :
      pct >= 50 ? 'progress' : 'behind';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden border-stone-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
          <div>
            <h3 className="text-base font-semibold text-stone-800">Scholar Profile</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Administrative profile, activity logs, and monitoring details
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-73px)] p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[320px] gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
              <p className="text-xs text-stone-400 uppercase tracking-widest">
                Loading scholar profile...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="border-stone-200 shadow-none lg:col-span-1">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Avatar
                      className="w-12 h-12 rounded-2xl border border-stone-200"
                      style={{ background: C.amberSoft, color: C.brown }}
                    >
                      <AvatarImage
                        src={s.avatar_url || undefined}
                        alt={`${s.student_name || 'Scholar'} profile`}
                        className="rounded-2xl"
                      />
                      <AvatarFallback className="rounded-2xl text-sm font-bold bg-transparent">
                        {getInitials(s.student_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <h4 className="text-base font-semibold text-stone-800">
                        {s.student_name || 'Unknown Scholar'}
                      </h4>
                      <p className="text-xs font-mono text-stone-400 mt-0.5">
                        {s.student_number || 'N/A'}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-stone-200 text-stone-600 bg-white"
                        >
                          {s.program_name || 'No Program'}
                        </Badge>

                        <span
                          className="text-[10px] font-medium px-2 py-1 rounded-full"
                          style={{
                            background: s.status === 'Active' ? C.greenSoft : C.redSoft,
                            color: s.status === 'Active' ? C.green : C.red,
                          }}
                        >
                          {s.status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                      <span className="text-stone-500">Batch Year</span>
                      <span className="font-medium text-stone-800">{s.batch_year || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                      <span className="text-stone-500">Date Awarded</span>
                      <span className="font-medium text-stone-800">{s.date_awarded || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                      <span className="text-stone-500">GWA</span>
                      <span
                        className="font-semibold"
                        style={{ color: gwaValue >= 2.0 ? C.red : C.green }}
                      >
                        {Number.isNaN(gwaValue) ? '—' : gwaValue.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                      <span className="text-stone-500">SDU Status</span>
                      <span
                        className="text-[10px] font-medium px-2 py-1 rounded-full"
                        style={{ background: sduStyle.bg, color: sduStyle.color }}
                      >
                        {sduStyle.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                      <span className="text-stone-500">Condition</span>
                      <span
                        className="text-[10px] font-medium px-2 py-1 rounded-full"
                        style={{ background: condition.bg, color: condition.color }}
                      >
                        {condition.label}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-stone-700">RO Progress</p>
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: RO_COLOR[roStatus] }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: RO_COLOR[roStatus],
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 space-y-5">
                <Card className="border-stone-200 shadow-none">
                  <CardHeader className="pb-2">
                    <h4 className="text-sm font-semibold text-stone-800">Profile Information</h4>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <Mail size={13} />
                        <span>Email</span>
                      </div>
                      <p className="font-medium text-stone-800">{s.email || 'Not available'}</p>
                    </div>

                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <Phone size={13} />
                        <span>Phone</span>
                      </div>
                      <p className="font-medium text-stone-800">{s.phone_number || 'Not available'}</p>
                    </div>

                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <CalendarDays size={13} />
                        <span>Scholar ID</span>
                      </div>
                      <p className="font-medium text-stone-800">{s.scholar_id || 'N/A'}</p>
                    </div>

                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <ShieldAlert size={13} />
                        <span>Monitoring Flag</span>
                      </div>
                      <p className="font-medium text-stone-800">{condition.label}</p>
                    </div>

                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <CalendarDays size={13} />
                        <span>Course</span>
                      </div>
                      <p className="font-medium text-stone-800">{s.program_name || 'Not available'}</p>
                    </div>

                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <Phone size={13} />
                        <span>Address</span>
                      </div>
                      <p className="font-medium text-stone-800">{s.address_summary || 'Not available'}</p>
                    </div>

                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <CalendarDays size={13} />
                        <span>Date of Birth</span>
                      </div>
                      <p className="font-medium text-stone-800">
                        {s.student_profile?.date_of_birth
                          ? new Date(s.student_profile.date_of_birth).toLocaleDateString()
                          : 'Not available'}
                      </p>
                    </div>

                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <ShieldAlert size={13} />
                        <span>Sex / Civil Status</span>
                      </div>
                      <p className="font-medium text-stone-800">
                        {[s.student_profile?.sex, s.student_profile?.civil_status]
                          .filter(Boolean)
                          .join(' • ') || 'Not available'}
                      </p>
                    </div>

                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <ShieldAlert size={13} />
                        <span>Citizenship / Religion</span>
                      </div>
                      <p className="font-medium text-stone-800">
                        {[s.student_profile?.citizenship, s.student_profile?.religion]
                          .filter(Boolean)
                          .join(' • ') || 'Not available'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                  <CardHeader className="pb-2">
                    <h4 className="text-sm font-semibold text-stone-800">Activity Logs</h4>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Array.isArray(s.activity_logs) && s.activity_logs.length > 0 ? (
                      s.activity_logs.map((log, index) => {
                        const title = log.action || log.title || 'Untitled activity';
                        const description = log.details || log.description || 'No details provided.';
                        const dateValue = log.created_at || log.date || null;

                        return (
                          <div
                            key={log.log_id || log.id || index}
                            className="rounded-xl border border-stone-200 p-3 bg-white"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-stone-800">{title}</p>
                                <p className="text-xs text-stone-500 mt-1">{description}</p>
                              </div>
                              <span className="text-[11px] text-stone-400 whitespace-nowrap">
                                {dateValue ? new Date(dateValue).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4">
                        <p className="text-xs text-stone-500">No activity logs available.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                  <CardHeader className="pb-2">
                    <h4 className="text-sm font-semibold text-stone-800">Admin Notes</h4>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4">
                      <div className="flex items-center gap-2 mb-2 text-stone-500">
                        <FileText size={14} />
                        <span className="text-xs font-medium">Internal remarks</span>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        Use this section for important scholarship monitoring details such as
                        compliance follow-ups, academic intervention notes, SDU observations,
                        renewal concerns, and beneficiary communication history.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Renewal Modal ───────────────────────────────────────────────
function RenewalModal({
  open,
  scholar,
  onClose,
}) {
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [decision, setDecision] = useState('');

  useEffect(() => {
    if (!open || !scholar) return;

    let mounted = true;

    const fetchRenewalDocuments = async () => {
      try {
        setLoading(true);
        setLoadError('');
        setAdminRemarks('');
        setDecision('');

        const token = localStorage.getItem('adminToken');
        const res = await fetch(`http://localhost:5000/api/scholars/${scholar.scholar_id}/renewal-documents`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          throw new Error('Renewal documents endpoint not available');
        }

        const data = await res.json();
        const normalized = normalizeRenewalDocuments(data, scholar);

        if (mounted) {
          setDocuments(normalized);
          setSelectedDocId(normalized.find((d) => d.url)?.id || normalized[0]?.id || null);
        }
      } catch (err) {
        const fallbackDocs = normalizeRenewalDocuments(null, scholar);
        if (mounted) {
          setDocuments(fallbackDocs);
          setSelectedDocId(fallbackDocs.find((d) => d.url)?.id || fallbackDocs[0]?.id || null);
          setLoadError('Using fallback renewal document fields. Wire your backend endpoint for full OCR data.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchRenewalDocuments();

    return () => {
      mounted = false;
    };
  }, [open, scholar]);

  if (!open || !scholar) return null;

  const selectedDoc = documents.find((doc) => doc.id === selectedDocId) || null;

  const uploadedCount = documents.filter((doc) => doc.url).length;
  const missingCount = documents.filter((doc) => !doc.url).length;
  const verifiedCount = documents.filter((doc) => String(doc.ocrStatus || '').toLowerCase() === 'verified').length;
  const renewalStatus = deriveRenewalStatusFromDocuments(documents);
  const renewalMeta = getRenewalStatusMeta(renewalStatus);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-7xl h-[92vh] overflow-hidden border-stone-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
          <div>
            <h3 className="text-base font-semibold text-stone-800">Renewal Review Workspace</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {scholar.student_name} · {scholar.student_number || 'No PDM ID'} · scholar renewal validation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{ background: renewalMeta.bg, color: renewalMeta.color }}
            >
              {renewalMeta.label}
            </span>

            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-lg border-stone-200 text-xs"
              onClick={() => window.open(selectedDoc?.url, '_blank')}
              disabled={!selectedDoc?.url}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Open File
            </Button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 border-b border-stone-100 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="rounded-xl border border-stone-200 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-stone-400">Uploaded Docs</p>
              <p className="text-xl font-semibold text-stone-800 mt-1">{uploadedCount}</p>
            </div>

            <div className="rounded-xl border border-stone-200 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-stone-400">Missing Docs</p>
              <p className="text-xl font-semibold mt-1" style={{ color: missingCount > 0 ? C.red : C.green }}>
                {missingCount}
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-stone-400">Verified OCR</p>
              <p className="text-xl font-semibold text-stone-800 mt-1">{verifiedCount}</p>
            </div>

            <div className="rounded-xl border border-stone-200 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-stone-400">Current GWA</p>
              <p
                className="text-xl font-semibold mt-1"
                style={{ color: Number(scholar.gwa) > 2.0 ? C.red : C.green }}
              >
                {Number.isFinite(Number(scholar.gwa)) ? Number(scholar.gwa).toFixed(2) : '—'}
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-stone-400">Monitoring</p>
              <p className="text-sm font-semibold mt-1" style={{ color: getScholarConditionMeta(scholar.gwa, scholar.sdu_level).color }}>
                {getScholarConditionMeta(scholar.gwa, scholar.sdu_level).label}
              </p>
            </div>
          </div>

          {loadError && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {loadError}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_380px] h-[calc(92vh-154px)]">
          {/* LEFT */}
          <div className="border-r border-stone-100 bg-stone-50/60 overflow-y-auto">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 sticky top-0">
              <div className="flex items-center gap-2">
                <Files className="w-4 h-4 text-stone-500" />
                <h4 className="text-sm font-semibold text-stone-800">Renewal Requirements</h4>
              </div>
            </div>

            <div className="p-3 space-y-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center min-h-[240px] gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
                  <p className="text-xs text-stone-400">Loading renewal docs...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-5 text-xs text-stone-500">
                  No renewal documents found.
                </div>
              ) : (
                documents.map((doc) => {
                  const selected = doc.id === selectedDocId;
                  const hasFile = Boolean(doc.url);

                  return (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${selected
                        ? 'border-amber-300 bg-amber-50 shadow-sm'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-800 truncate">{doc.name}</p>
                          <p className="text-[11px] text-stone-400 mt-0.5">{doc.type}</p>
                        </div>
                        <span
                          className="text-[10px] font-semibold px-2 py-1 rounded-full shrink-0"
                          style={{
                            background: hasFile ? C.greenSoft : C.redSoft,
                            color: hasFile ? C.green : C.red,
                          }}
                        >
                          {hasFile ? 'Uploaded' : 'Missing'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-[10px] px-2 py-1 rounded-full bg-stone-100 text-stone-600">
                          {getFileTypeLabel(doc.url, doc.name)}
                        </span>
                        <span
                          className="text-[10px] font-medium"
                          style={{
                            color: doc.ocrStatus === 'Verified'
                              ? C.green
                              : doc.ocrStatus === 'Flagged'
                                ? C.red
                                : C.amber,
                          }}
                        >
                          {doc.ocrStatus || 'Pending OCR'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* CENTER */}
          <div className="bg-white overflow-hidden border-r border-stone-100">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-stone-800">Document Preview</h4>
                <p className="text-xs text-stone-400 mt-0.5">
                  {selectedDoc?.name || 'No document selected'}
                </p>
              </div>

              {selectedDoc?.url && (
                <a
                  href={selectedDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                  Open original
                  <ExternalLink className="w-3 h-3 ml-1" />
                </a>
              )}
            </div>

            <div className="h-[calc(100%-61px)] bg-stone-100">
              {!selectedDoc ? (
                <div className="h-full flex items-center justify-center p-8 text-center">
                  <div>
                    <FileText className="w-8 h-8 text-stone-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-stone-600">No document selected</p>
                    <p className="text-xs text-stone-400 mt-1">Choose a renewal document from the left panel.</p>
                  </div>
                </div>
              ) : !selectedDoc.url ? (
                <div className="h-full flex items-center justify-center p-8 text-center bg-stone-50">
                  <div>
                    <AlertTriangle className="w-8 h-8 text-red-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-stone-700">Document not uploaded</p>
                    <p className="text-xs text-stone-400 mt-1">
                      This requirement is still missing for this scholar.
                    </p>
                  </div>
                </div>
              ) : isImageFile(selectedDoc.url, selectedDoc.name) ? (
                <div className="w-full h-full overflow-auto bg-stone-200">
                  <img
                    src={selectedDoc.url}
                    alt={selectedDoc.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              ) : (
                <iframe
                  title={selectedDoc.name}
                  src={selectedDoc.url}
                  className="w-full h-full border-0 bg-white"
                />
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="bg-stone-50/50 overflow-y-auto">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <ScanSearch className="w-4 h-4 text-stone-500" />
                <h4 className="text-sm font-semibold text-stone-800">Validation Panel</h4>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {!selectedDoc ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-6 text-center">
                  <p className="text-sm font-medium text-stone-600">No OCR data to display</p>
                  <p className="text-xs text-stone-400 mt-1">Select a document first.</p>
                </div>
              ) : (
                <>
                  <Card className="border-stone-200 shadow-none">
                    <CardHeader className="pb-2">
                      <h5 className="text-sm font-semibold text-stone-800">OCR Summary</h5>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 bg-white">
                        <span className="text-stone-500">OCR Status</span>
                        <span
                          className="font-medium"
                          style={{
                            color:
                              selectedDoc.ocrStatus === 'Verified'
                                ? C.green
                                : selectedDoc.ocrStatus === 'Flagged'
                                  ? C.red
                                  : C.amber,
                          }}
                        >
                          {selectedDoc.ocrStatus || 'Pending'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 bg-white">
                        <span className="text-stone-500">Document Status</span>
                        <span className="font-medium text-stone-800">
                          {selectedDoc.status || 'Pending Review'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 bg-white">
                        <span className="text-stone-500">Confidence</span>
                        <span className="font-medium text-stone-800">
                          {typeof selectedDoc.confidence === 'number'
                            ? `${selectedDoc.confidence}%`
                            : 'Not available'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2 bg-white">
                        <span className="text-stone-500">Uploaded At</span>
                        <span className="font-medium text-stone-800">
                          {selectedDoc.uploadedAt
                            ? new Date(selectedDoc.uploadedAt).toLocaleDateString()
                            : 'Not available'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-stone-200 shadow-none">
                    <CardHeader className="pb-2">
                      <h5 className="text-sm font-semibold text-stone-800">Extracted Fields</h5>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      {selectedDoc.ocrFields && Object.keys(selectedDoc.ocrFields).length > 0 ? (
                        Object.entries(selectedDoc.ocrFields).map(([key, value]) => (
                          <div
                            key={key}
                            className="rounded-lg border border-stone-200 px-3 py-2 bg-white"
                          >
                            <p className="text-[11px] uppercase tracking-wide text-stone-400">
                              {key.replace(/_/g, ' ')}
                            </p>
                            <p className="font-medium text-stone-800 mt-1 break-words">
                              {String(value || '—')}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-4 text-stone-500">
                          No extracted OCR fields yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-stone-200 shadow-none">
                    <CardHeader className="pb-2">
                      <h5 className="text-sm font-semibold text-stone-800">Extracted Text</h5>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl border border-stone-200 bg-white p-3 min-h-[120px] max-h-[220px] overflow-y-auto">
                        {selectedDoc.extractedText ? (
                          <p className="text-xs leading-relaxed text-stone-700 whitespace-pre-wrap">
                            {selectedDoc.extractedText}
                          </p>
                        ) : (
                          <p className="text-xs text-stone-400">
                            No OCR text returned yet for this document.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-stone-200 shadow-none">
                    <CardHeader className="pb-2">
                      <h5 className="text-sm font-semibold text-stone-800">Renewal Decision</h5>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Select value={decision} onValueChange={setDecision}>
                        <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm bg-white">
                          <SelectValue placeholder="Select renewal decision" />
                        </SelectTrigger>
                        <SelectContent className="z-[100]">
                          <SelectItem value="approved">Approve Renewal</SelectItem>
                          <SelectItem value="under_review">Keep Under Review</SelectItem>
                          <SelectItem value="needs_reupload">Require Re-upload</SelectItem>
                        </SelectContent>
                      </Select>

                      <Textarea
                        value={adminRemarks}
                        onChange={(e) => setAdminRemarks(e.target.value)}
                        placeholder="Add renewal-specific remarks, deficiencies, or approval notes..."
                        className="min-h-[100px] rounded-lg border-stone-200 text-sm resize-none bg-white"
                      />

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 rounded-lg border-green-200 text-green-700 hover:bg-green-50 text-xs"
                          disabled={!selectedDoc?.url}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                          Mark Valid
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 rounded-lg border-red-200 text-red-700 hover:bg-red-50 text-xs"
                          disabled={!selectedDoc?.url}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                          Flag Issue
                        </Button>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-8 rounded-lg border-stone-200 text-stone-600 hover:bg-stone-100 text-xs"
                        disabled={!selectedDoc?.url}
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Re-run OCR
                      </Button>

                      <div className="pt-2 border-t border-stone-100 flex justify-end gap-2">
                        <Button
                          variant="outline"
                          className="h-9 rounded-lg border-stone-200 text-xs"
                          onClick={onClose}
                        >
                          Close
                        </Button>
                        <Button
                          className="h-9 rounded-lg text-white text-xs border-none"
                          style={{ background: C.brownMid }}
                        >
                          Save Renewal Review
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Archive Scholar Modal ───────────────────────────────────────
function ArchiveScholarModal({ scholar, onClose, onConfirm, saving }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [archiveStudent, setArchiveStudent] = useState(false);

  useEffect(() => {
    if (scholar) {
      setReason('');
      setNotes('');
      setArchiveStudent(false);
    }
  }, [scholar]);

  if (!scholar) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg border-stone-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
          <div>
            <h3 className="text-base font-semibold text-stone-800">Remove Scholar Privilege</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {scholar.student_name} · {scholar.student_number}
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
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Removal Reason
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {REMOVAL_REASONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional admin note..."
              className="min-h-[100px] rounded-lg border-stone-200 text-sm resize-none"
            />
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={archiveStudent}
              onChange={(e) => setArchiveStudent(e.target.checked)}
              className="mt-0.5 accent-stone-700"
            />
            <div>
              <p className="text-xs font-medium text-stone-700">Also archive student record</p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Enable only if the student record should also be hidden from active records.
              </p>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-9 rounded-lg border-stone-200 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={() => onConfirm({ reason, notes, archive_student: archiveStudent })}
              disabled={!reason || saving}
              className="h-9 rounded-lg text-white text-xs border-none disabled:opacity-50"
              style={{ background: C.red }}
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Removal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function ScholarMonitoring() {
  const [scholars, setScholars] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    at_risk: 0,
    avg_gwa: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [batchYear, setBatchYear] = useState('All Years');
  const [status, setStatus] = useState('All Statuses');
  const [sortBy, setSortBy] = useState('Name A-Z');
  const [page, setPage] = useState(1);

  const [selectedScholarId, setSelectedScholarId] = useState(null);
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [renewalOpen, setRenewalOpen] = useState(false);
  const [renewalScholar, setRenewalScholar] = useState(null);

  const [archiveModalScholar, setArchiveModalScholar] = useState(null);
  const [archiveSaving, setArchiveSaving] = useState(false);

  const [showRenewalQueue, setShowRenewalQueue] = useState(false);

  useEffect(() => {
    const fetchScholars = async () => {
      try {
        setLoading(true);

        const [scholarsRes, statsRes] = await Promise.all([
          fetch('http://localhost:5000/api/scholars', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
              'Content-Type': 'application/json',
            },
          }),
          fetch('http://localhost:5000/api/scholars/stats', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
              'Content-Type': 'application/json',
            },
          }),
        ]);

        if (!scholarsRes.ok) throw new Error('Failed to synchronize scholars');
        if (!statsRes.ok) throw new Error('Failed to synchronize scholar stats');

        const scholarsData = await scholarsRes.json();
        const statsData = await statsRes.json();

        setScholars(Array.isArray(scholarsData) ? scholarsData : []);
        setStats({
          total: Number(statsData.total) || 0,
          active: Number(statsData.active) || 0,
          at_risk: Number(statsData.at_risk) || 0,
          avg_gwa: Number(statsData.avg_gwa) || 0,
        });
      } catch (err) {
        console.error('Database Error:', err);
        setError(err.message || 'Failed to load scholar data');
      } finally {
        setLoading(false);
      }
    };

    fetchScholars();
  }, []);

  const handleArchiveScholar = async (payload) => {
    if (!archiveModalScholar) return;

    try {
      setArchiveSaving(true);

      const res = await fetch(
        `http://localhost:5000/api/scholars/${archiveModalScholar.scholar_id}/archive`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to archive scholar');
      }

      setScholars((prev) =>
        prev.filter((s) => s.scholar_id !== archiveModalScholar.scholar_id)
      );

      setStats((prev) => ({
        ...prev,
        total: Math.max(0, Number(prev.total || 0) - 1),
        active:
          archiveModalScholar.status === 'Active'
            ? Math.max(0, Number(prev.active || 0) - 1)
            : Number(prev.active || 0),
        at_risk:
          Number(archiveModalScholar.gwa || 0) >= 2.0
            ? Math.max(0, Number(prev.at_risk || 0) - 1)
            : Number(prev.at_risk || 0),
      }));

      if (selectedScholarId === archiveModalScholar.scholar_id) {
        setSelectedScholarId(null);
        setSelectedScholar(null);
      }

      setArchiveModalScholar(null);
    } catch (err) {
      console.error('ARCHIVE SCHOLAR ERROR:', err);
      alert(err.message || 'Failed to archive scholar');
    } finally {
      setArchiveSaving(false);
    }
  };

  const handleViewScholar = async (scholarId) => {
    try {
      setSelectedScholarId(scholarId);
      setProfileLoading(true);
      setSelectedScholar(null);

      const res = await fetch(`http://localhost:5000/api/scholars/${scholarId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      const rawText = await res.text();

      if (!res.ok) {
        console.error('Scholar profile response error:', res.status, rawText);
        throw new Error(`Failed to fetch scholar profile: ${res.status} ${rawText}`);
      }

      const data = rawText ? JSON.parse(rawText) : null;
      setSelectedScholar(data);
    } catch (err) {
      console.error('SCHOLAR PROFILE FETCH ERROR:', err);
      alert(err.message || 'Failed to fetch scholar profile');
      setSelectedScholarId(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleOpenRenewal = async (scholar) => {
    try {
      const res = await fetch(`http://localhost:5000/api/scholars/${scholar.scholar_id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      const rawText = await res.text();
      const data = rawText ? JSON.parse(rawText) : scholar;

      setRenewalScholar(data || scholar);
      setRenewalOpen(true);
    } catch (err) {
      console.error('RENEWAL PROFILE FETCH ERROR:', err);
      setRenewalScholar(scholar);
      setRenewalOpen(true);
    }
  };

  const scholarsWithRenewalMeta = useMemo(() => {
    return scholars.map((s) => {
      const fallbackDocs = normalizeRenewalDocuments(null, s);
      const renewal_status = deriveRenewalStatusFromDocuments(fallbackDocs);
      return {
        ...s,
        renewal_status,
      };
    });
  }, [scholars]);

  const renewalQueue = useMemo(() => {
    return scholarsWithRenewalMeta.filter((s) =>
      ['submitted', 'under_review', 'needs_reupload'].includes(
        String(s.renewal_status || '').toLowerCase()
      )
    );
  }, [scholarsWithRenewalMeta]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normalizedQ = q.replace(/[^a-z0-9]/g, '');

    let results = scholars.filter((s) => {
      const name = (s.student_name || '').toLowerCase();
      const studentNumber = String(s.student_number || '').toLowerCase();
      const normalizedStudentNumber = studentNumber.replace(/[^a-z0-9]/g, '');
      const programName = s.program_name || '';
      const batch = String(s.batch_year || '');
      const scholarStatus = s.status || '';
      const nameParts = name.replace(',', ' ').split(/\s+/).filter(Boolean);

      const matchSearch =
        !q ||
        name.startsWith(q) ||
        nameParts.some((part) => part.startsWith(q)) ||
        studentNumber.startsWith(q) ||
        normalizedStudentNumber.startsWith(normalizedQ);

      const matchProgram = program === 'All Programs' || programName === program;
      const matchBatch = batchYear === 'All Years' || batch === String(batchYear);
      const matchStatus = status === 'All Statuses' || scholarStatus === status;

      return matchSearch && matchProgram && matchBatch && matchStatus;
    });

    results = [...results].sort((a, b) => {
      const nameA = (a.student_name || '').toLowerCase();
      const nameB = (b.student_name || '').toLowerCase();
      const gwaA = Number(a.gwa);
      const gwaB = Number(b.gwa);
      const batchA = Number(String(a.batch_year || '').split('-')[0]) || 0;
      const batchB = Number(String(b.batch_year || '').split('-')[0]) || 0;

      switch (sortBy) {
        case 'Name Z-A':
          return nameB.localeCompare(nameA);
        case 'GWA Asc':
          return gwaA - gwaB;
        case 'GWA Desc':
          return gwaB - gwaA;
        case 'Batch Newest':
          return batchB - batchA;
        case 'Batch Oldest':
          return batchA - batchB;
        case 'Name A-Z':
        default:
          return nameA.localeCompare(nameB);
      }
    });

    return results;
  }, [scholars, search, program, batchYear, status, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, program, batchYear, status, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const pageData = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  const programOptions = useMemo(() => {
    return ['All Programs', ...new Set(scholars.map((s) => s.program_name).filter(Boolean))];
  }, [scholars]);

  const batchOptions = useMemo(() => {
    return ['All Years', ...new Set(scholars.map((s) => s.batch_year).filter(Boolean))];
  }, [scholars]);

  const statusOptions = ['All Statuses', 'Active', 'At Risk', 'Inactive'];

  const sortOptions = [
    'Name A-Z',
    'Name Z-A',
    'GWA Asc',
    'GWA Desc',
    'Batch Newest',
    'Batch Oldest',
  ];

  const statCards = useMemo(() => {
    return [
      {
        label: 'Total Scholars',
        value: stats.total,
        icon: Users,
        accent: C.brown,
        soft: C.amberSoft,
      },
      {
        label: 'Active',
        value: stats.active,
        icon: CheckCircle2,
        accent: C.green,
        soft: C.greenSoft,
      },
      {
        label: 'At Risk',
        value: stats.at_risk,
        icon: AlertTriangle,
        accent: C.red,
        soft: C.redSoft,
      },
      {
        label: 'Renewal Review',
        value: renewalQueue.length,
        icon: FileCheck2,
        accent: C.blue,
        soft: C.blueSoft,
      },
    ];
  }, [stats, renewalQueue.length]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">
          Loading scholars...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <AlertTriangle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-800">Failed to load scholars</p>
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
    <div className="space-y-5 py-2" style={{ background: C.bg }}>
      {selectedScholarId && (
        <ScholarProfileModal
          scholar={selectedScholar}
          loading={profileLoading}
          onClose={() => {
            setSelectedScholarId(null);
            setSelectedScholar(null);
          }}
        />
      )}

      <RenewalModal
        open={renewalOpen}
        scholar={renewalScholar}
        onClose={() => {
          setRenewalOpen(false);
          setRenewalScholar(null);
        }}
      />

      <ArchiveScholarModal
        scholar={archiveModalScholar}
        onClose={() => setArchiveModalScholar(null)}
        onConfirm={handleArchiveScholar}
        saving={archiveSaving}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Scholars
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            {filtered.length} records in scholar registry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRenewalQueue((prev) => !prev)}
            className="rounded-lg text-xs border-stone-200 text-stone-600"
          >
            <Files className="mr-1.5 h-3.5 w-3.5" />
            {showRenewalQueue ? 'Hide Renewal Queue' : 'Show Renewal Queue'}
          </Button>

          <Button
            size="sm"
            className="rounded-lg text-white text-xs border-none"
            style={{ background: C.brownMid }}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <Card key={s.label} className="border-stone-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: s.soft }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold" style={{ color: C.text }}>
                {s.value}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
          <Input
            placeholder="Search by scholar name or PDM ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
          />
        </div>

        <Select value={program} onValueChange={setProgram}>
          <SelectTrigger className="w-[170px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {programOptions.map((p) => (
              <SelectItem key={p} value={p} className="text-sm">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={batchYear} onValueChange={setBatchYear}>
          <SelectTrigger className="w-[140px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {batchOptions.map((b) => (
              <SelectItem key={b} value={b} className="text-sm">
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((item) => (
              <SelectItem key={item} value={item} className="text-sm">
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((item) => (
              <SelectItem key={item} value={item} className="text-sm">
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(search ||
          program !== 'All Programs' ||
          batchYear !== 'All Years' ||
          status !== 'All Statuses' ||
          sortBy !== 'Name A-Z') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setProgram('All Programs');
                setBatchYear('All Years');
                setStatus('All Statuses');
                setSortBy('Name A-Z');
                setPage(1);
              }}
              className="h-9 rounded-lg text-xs border-stone-200"
            >
              Reset
            </Button>
          )}
      </div>

      {showRenewalQueue && (
        <Card className="border-stone-200 shadow-none overflow-hidden">
          <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
            <div>
              <h2 className="text-sm font-semibold text-stone-800">Renewal Queue</h2>
              <p className="text-xs text-stone-400">
                Scholars with renewal submissions that need admin attention
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {renewalQueue.length === 0 ? (
              <div className="px-5 py-8 text-sm text-stone-400">
                No scholars are currently in the renewal review queue.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50 hover:bg-stone-50">
                      <TableHead>Scholar</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Renewal Status</TableHead>
                      <TableHead>GWA</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {renewalQueue.map((s) => {
                      const renewalMeta = getRenewalStatusMeta(s.renewal_status);
                      return (
                        <TableRow key={`renewal-${s.scholar_id}`} className="hover:bg-stone-50/70">
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium text-stone-800">{s.student_name}</p>
                              <p className="text-xs text-stone-400">{s.student_number}</p>
                            </div>
                          </TableCell>
                          <TableCell>{s.program_name || 'N/A'}</TableCell>
                          <TableCell>{s.batch_year || 'N/A'}</TableCell>
                          <TableCell>
                            <span
                              className="text-[10px] font-medium px-2 py-1 rounded-full"
                              style={{ background: renewalMeta.bg, color: renewalMeta.color }}
                            >
                              {renewalMeta.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            {Number.isFinite(Number(s.gwa)) ? Number(s.gwa).toFixed(2) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg border-stone-200 text-xs"
                              onClick={() => handleOpenRenewal(s)}
                            >
                              <FileCheck2 className="w-3.5 h-3.5 mr-1.5" />
                              Review Renewal
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-stone-200 shadow-none overflow-hidden">
        <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
          <div>
            <CardTitle className="text-sm font-semibold text-stone-800">Scholar Registry</CardTitle>
            <CardDescription className="text-xs">
              Active scholar monitoring records
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {pageData.length === 0 ? (
            <div className="px-5 py-8 text-sm text-stone-400">
              No scholars match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50 hover:bg-stone-50">
                    <TableHead>Scholar</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>GWA</TableHead>
                    <TableHead>SDU</TableHead>
                    <TableHead>RO Progress</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {pageData.map((s) => {
                    const gwaValue = Number(s.gwa);
                    const sduStyle = SDU_STYLE[s.sdu_level || 'none'] || SDU_STYLE.none;
                    const condition = getScholarConditionMeta(s.gwa, s.sdu_level);
                    const roProgress = Number(s.ro_progress || 0);
                    const roStatus =
                      roProgress === 100 ? 'complete' :
                        roProgress >= 50 ? 'progress' : 'behind';

                    return (
                      <TableRow key={s.scholar_id} className="hover:bg-stone-50/70">
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-stone-800">{s.student_name}</p>
                            <p className="text-xs text-stone-400">{s.student_number}</p>
                          </div>
                        </TableCell>

                        <TableCell>{s.program_name || 'N/A'}</TableCell>
                        <TableCell>{s.batch_year || 'N/A'}</TableCell>

                        <TableCell>
                          <span
                            className="text-[10px] font-medium px-2 py-1 rounded-full"
                            style={{ background: condition.bg, color: condition.color }}
                          >
                            {condition.label}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span
                            className="font-medium"
                            style={{ color: Number.isFinite(gwaValue) && gwaValue > 2.0 ? C.red : C.green }}
                          >
                            {Number.isFinite(gwaValue) ? gwaValue.toFixed(2) : '—'}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span
                            className="text-[10px] font-medium px-2 py-1 rounded-full"
                            style={{ background: sduStyle.bg, color: sduStyle.color }}
                          >
                            {sduStyle.label}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="min-w-[120px]">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-stone-500">{roProgress}%</span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${roProgress}%`,
                                  background: RO_COLOR[roStatus],
                                }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg border-stone-200 text-xs"
                              onClick={() => handleViewScholar(s.scholar_id)}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
                              View
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg border-stone-200 text-xs"
                              onClick={() => handleOpenRenewal(s)}
                            >
                              <Files className="w-3.5 h-3.5 mr-1.5" />
                              Renewal
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-lg border-red-200 text-red-700 hover:bg-red-50 text-xs"
                              onClick={() => setArchiveModalScholar(s)}
                            >
                              <X className="w-3.5 h-3.5 mr-1.5" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        <div className="px-5 py-3 bg-stone-50/50 border-t border-stone-100 flex items-center justify-between">
          <span className="text-xs text-stone-400">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 rounded-lg border-stone-200"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            <span className="text-xs font-medium px-2.5 py-1 bg-white border border-stone-200 rounded-lg">
              {page} / {totalPages}
            </span>

            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 rounded-lg border-stone-200"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
