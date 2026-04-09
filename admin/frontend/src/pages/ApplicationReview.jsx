import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Download, Eye, ChevronLeft, ChevronRight,
  UserMinus, Users, CheckCircle2,
  Clock, AlertTriangle, AlertCircle, Loader2, X,
  ShieldCheck, XCircle, FileSearch, MessageSquare,
  GitCompareArrows,
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
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  text: '#1c1917',
  bg: '#faf7f2',
  muted: '#78716c',
  border: '#e7e5e4',
};

const VIEW_MODES = {
  current: 'current',
  at_risk: 'at_risk',
  replacement: 'replacement',
};

// ─── Constants ───────────────────────────────────────────────────
const DOC_STATUS_MAP = {
  'documents ready': { label: 'Documents Ready', bg: C.greenSoft, color: C.green },
  'missing docs': { label: 'Missing Docs', bg: C.redSoft, color: C.red },
  'under review': { label: 'Under Review', bg: C.amberSoft, color: C.amber },
};

const APP_STATUS = {
  'pending review': { label: 'Pending Review', bg: '#f5f5f4', color: '#57534e' },
  interview: { label: 'Interview', bg: C.blueSoft, color: C.blueMid },
  approved: { label: 'Approved', bg: C.greenSoft, color: C.green },
  rejected: { label: 'Rejected', bg: C.redSoft, color: C.red },
};

const SDO_STATUS_MAP = {
  all: { label: 'All SDO' },
  clear: { label: 'Clear', bg: C.greenSoft, color: C.green },
  minor: { label: 'Minor', bg: C.amberSoft, color: C.amber },
  major: { label: 'Major', bg: C.redSoft, color: C.red },
};

const OCR_STATUS_MAP = {
  match: { label: 'OCR Match', bg: C.greenSoft, color: C.green },
  review: { label: 'Needs Review', bg: C.amberSoft, color: C.amber },
  mismatch: { label: 'Mismatch', bg: C.redSoft, color: C.red },
};

const DISQ_REASONS = [
  'Failed GWA requirement',
  'AWOL / No contact',
  'SDU (Scholar Disciplinary Unit)',
  'Existing LGU / Sports scholarship',
  'Failed to complete RO',
  'Voluntarily withdrew',
  'Other',
];

const PAGE_SIZE = 10;

// ─── Helpers ─────────────────────────────────────────────────────
function normalizeSdo(raw) {
  const s = (raw || '').toString().toLowerCase();
  if (s.includes('major')) return 'major';
  if (s.includes('minor')) return 'minor';
  if (s.includes('clear') || s.includes('none')) return 'clear';
  return 'clear';
}

function getAppStatusMeta(status) {
  return APP_STATUS[(status || '').toLowerCase()] || APP_STATUS.pending;
}

function getDocStatusMeta(status) {
  return DOC_STATUS_MAP[(status || '').toLowerCase()] || {
    label: 'Unknown',
    bg: '#f5f5f4',
    color: '#78716c',
  };
}

function getGwaMeta(gwa) {
  const numeric = Number(gwa);
  if (!Number.isFinite(numeric)) {
    return { label: 'No GWA', bg: '#f5f5f4', color: '#78716c' };
  }
  if (numeric <= 2.0) {
    return { label: `Eligible · ${numeric}`, bg: C.greenSoft, color: C.green };
  }
  return { label: `At Risk · ${numeric}`, bg: C.redSoft, color: C.red };
}

function getOcrMeta(app) {
  const ocr = (app.ocr_status || '').toLowerCase();
  if (ocr && OCR_STATUS_MAP[ocr]) return OCR_STATUS_MAP[ocr];

  const docStatus = (app.document_status || '').toLowerCase();
  if (docStatus === 'documents ready') return OCR_STATUS_MAP.match;
  if (docStatus === 'under review') return OCR_STATUS_MAP.review;
  return OCR_STATUS_MAP.mismatch;
}

function StatusPill({ meta }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function isApplicantAtRisk(app) {
  const gwa = Number(app?.gwa);
  const rawStatus = (app?.application_status || '').toLowerCase();
  const docStatus = (app?.document_status || '').toLowerCase();
  const verificationStatus = (app?.verification_status || '').toLowerCase();
  const sdo = normalizeSdo(app?.sdu_level || app?.sdo_status || '');

  const gwaRisk = Number.isFinite(gwa) && gwa > 2.0;
  const docRisk = docStatus === 'missing docs' || docStatus === 'under review';
  const verificationRisk = verificationStatus === 'rejected';
  const sdoRisk = sdo === 'major' || sdo === 'minor';
  const appRisk = verificationStatus === 'rejected';

  return gwaRisk || docRisk || verificationRisk || sdoRisk || appRisk;
}

function isReplacementCandidate(app) {
  const rawStatus = (app?.application_status || '').toLowerCase();
  return (
    rawStatus === 'rejected' &&
    !!app?.is_reconsideration_candidate
  );
}

// ─── Disqualify Modal ────────────────────────────────────────────
function DisqModal({ app, onDisqualify, onClose }) {
  const [reason, setReason] = useState('');
  const [includeInQueue, setIncludeInQueue] = useState(false);

  const displayName = app?.name || 'Unknown';
  const displayId = app?.student_number || app?.id || 'No ID';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/30"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md shadow-xl border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b bg-red-50 border-red-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-red-700">Disqualification Record</h3>
            <p className="text-xs text-stone-500 mt-0.5">{displayName} · {displayId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <CardContent className="p-4 space-y-3">
          <p className="text-xs text-stone-500">Select a disqualification reason:</p>

          {DISQ_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all border ${reason === r
                ? 'bg-red-600 border-red-600 text-white'
                : 'bg-white border-stone-200 text-stone-600 hover:border-red-200 hover:bg-red-50'
                }`}
            >
              {r}
            </button>
          ))}

          <label className="flex items-start gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeInQueue}
              onChange={(e) => setIncludeInQueue(e.target.checked)}
              className="mt-0.5 accent-stone-700"
            />
            <div>
              <p className="text-xs font-medium text-stone-700">Include in Replacement Pool</p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Keeps this applicant visible under the replacement pool for future slot reconsideration.
              </p>
            </div>
          </label>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-9 text-xs rounded-lg border-stone-200"
            >
              Cancel
            </Button>
            <Button
              disabled={!reason}
              onClick={() => {
                onDisqualify(app.id, reason, includeInQueue);
                onClose();
              }}
              className="flex-1 h-9 text-xs rounded-lg text-white border-none disabled:opacity-40"
              style={{ background: C.red }}
            >
              Confirm
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Remarks Modal ───────────────────────────────────────────────
function RemarksModal({ app, value, onChange, onSave, onClose, saving }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/30"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg shadow-xl border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b bg-stone-50 border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Reviewer Remarks</h3>
            <p className="text-xs text-stone-500 mt-0.5">{app?.name} · {app?.student_number}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <CardContent className="p-4 space-y-3">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter admin-side reviewer remarks..."
            className="min-h-[120px] rounded-lg border-stone-200 bg-white text-sm resize-none"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-9 text-xs rounded-lg border-stone-200"
            >
              Cancel
            </Button>
            <Button
              onClick={onSave}
              disabled={saving}
              className="h-9 text-xs rounded-lg text-white border-none"
              style={{ background: C.blueMid }}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5 mr-1.5" />}
              Save Remarks
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function ApplicationReview() {
  const navigate = useNavigate();

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [status, setStatus] = useState('all');
  const [sdoFilter, setSdoFilter] = useState('all');
  const [appStatusFilter, setAppStatusFilter] = useState('All');
  const [viewMode, setViewMode] = useState(VIEW_MODES.current);

  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());

  const [disqApp, setDisqApp] = useState(null);

  const [remarksModal, setRemarksModal] = useState(null);
  const [remarksText, setRemarksText] = useState('');
  const [remarksSaving, setRemarksSaving] = useState(false);

  const [decisionLoading, setDecisionLoading] = useState(null);

  const visibleApps = useMemo(() => apps.filter((app) => !app.is_scholar), [apps]);

  const reloadApplications = async ({ soft = false } = {}) => {
    try {
      if (soft) setTableLoading(true);
      else {
        setLoading(true);
        setError(null);
      }

      const res = await fetch('http://localhost:5000/api/applications', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch applications');
      }

      const data = await res.json();
      setApps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('APPLICATION FETCH ERROR:', err);
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    reloadApplications();
  }, []);

  const programOptions = useMemo(() => {
    return ['All Programs', ...new Set(visibleApps.map((a) => a.program).filter(Boolean))];
  }, [visibleApps]);

  const replacementCount = useMemo(() => {
    return visibleApps.filter(isReplacementCandidate).length;
  }, [visibleApps]);

  const atRiskCount = useMemo(() => {
    return visibleApps.filter((a) => !isReplacementCandidate(a) && isApplicantAtRisk(a)).length;
  }, [visibleApps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normalizedQ = q.replace(/[^a-z0-9]/g, '');

    let base = [...visibleApps];

    if (appStatusFilter !== 'All') {
      base = base.filter((a) => {
        const raw = (a.application_status || 'pending').toLowerCase();
        if (appStatusFilter === 'rejected') return raw === 'rejected';
        return raw === appStatusFilter.toLowerCase();
      });
    }

    base = base.filter((a) => {
      const replacement = isReplacementCandidate(a);
      const atRisk = isApplicantAtRisk(a);

      if (viewMode === VIEW_MODES.current) {
        return !replacement;
      }

      if (viewMode === VIEW_MODES.at_risk) {
        return !replacement && atRisk;
      }

      if (viewMode === VIEW_MODES.replacement) {
        return replacement;
      }

      return true;
    });

    return base.filter((a) => {
      const fullName = (a.name || '').toLowerCase();
      const studentNumber = String(a.student_number || '').toLowerCase();
      const normalizedStudentNumber = studentNumber.replace(/[^a-z0-9]/g, '');
      const appId = String(a.id || '').toLowerCase();
      const appProgram = a.program || '';
      const docStatus = (a.document_status || '').toLowerCase();
      const normalizedSdo = normalizeSdo(a.sdu_level || a.sdo_status || '');

      const nameParts = fullName.replace(',', ' ').split(/\s+/).filter(Boolean);

      const matchSearch =
        !q ||
        fullName.startsWith(q) ||
        nameParts.some((part) => part.startsWith(q)) ||
        studentNumber.startsWith(q) ||
        normalizedStudentNumber.startsWith(normalizedQ) ||
        appId.startsWith(q);

      const matchProgram = program === 'All Programs' || appProgram === program;
      const matchStatus = status === 'all' || docStatus === status;
      const matchSdo = sdoFilter === 'all' || normalizedSdo === sdoFilter;

      return matchSearch && matchProgram && matchStatus && matchSdo;
    });
  }, [visibleApps, search, program, status, sdoFilter, appStatusFilter, viewMode]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [search, program, status, sdoFilter, appStatusFilter, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const pageData = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  const allVisibleSelected = useMemo(() => {
    return pageData.length > 0 && pageData.every((a) => selected.has(a.id));
  }, [pageData, selected]);

  const handleExportExcel = async () => {
    try {
      const token = localStorage.getItem('adminToken');

      if (!token) {
        throw new Error('No token found. Please log in again.');
      }

      const response = await fetch('http://localhost:5000/api/applications/export/excel', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to export Excel: ${response.status} ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'applications.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export Excel Error:', error);
      alert(error.message);
    }
  };

  const STATS = useMemo(() => {
    return [
      {
        label: 'Total Applications',
        value: visibleApps.length,
        icon: Users,
        accent: C.brown,
        soft: C.amberSoft,
      },
      {
        label: 'Documents Ready',
        value: visibleApps.filter((a) => (a.document_status || '').toLowerCase() === 'documents ready').length,
        icon: CheckCircle2,
        accent: C.green,
        soft: C.greenSoft,
      },
      {
        label: 'At-Risk Applicants',
        value: atRiskCount,
        icon: AlertTriangle,
        accent: C.red,
        soft: C.redSoft,
      },
      {
        label: 'Replacement Pool',
        value: replacementCount,
        icon: GitCompareArrows,
        accent: C.blueMid,
        soft: C.blueSoft,
      },
    ];
  }, [visibleApps, atRiskCount, replacementCount]);

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (allVisibleSelected) {
        pageData.forEach((a) => next.delete(a.id));
      } else {
        pageData.forEach((a) => next.add(a.id));
      }

      return next;
    });
  };

  const handleDisqualify = async (id, reason, includeInQueue) => {
    try {
      const res = await fetch(`http://localhost:5000/api/applications/${id}/disqualify`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
          is_reconsideration_candidate: includeInQueue,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to disqualify application');
      }

      setApps((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
              ...a,
              disqualified: true,
              disqReason: reason,
              application_status: 'rejected',
              verification_status: 'rejected',
              is_reconsideration_candidate: includeInQueue,
            }
            : a
        )
      );
    } catch (err) {
      console.error('DISQUALIFY ERROR:', err);
      alert(err.message || 'Failed to disqualify application');
    }
  };

  const handleDecision = async (id, action) => {
    try {
      setDecisionLoading(id);

      const endpoint =
        action === 'approve'
          ? `http://localhost:5000/api/applications/${id}/approve`
          : `http://localhost:5000/api/applications/${id}/reject`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to ${action} application`);
      }

      setApps((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
              ...a,
              application_status: action === 'approve' ? 'approved' : 'rejected',
            }
            : a
        )
      );
    } catch (err) {
      console.error('APPLICATION DECISION ERROR:', err);
      alert(err.message || 'Failed to update application');
    } finally {
      setDecisionLoading(null);
    }
  };

  const handleOpenRemarks = (app) => {
    setRemarksModal(app);
    setRemarksText(app.remarks || '');
  };

  const handleSaveRemarks = async () => {
    if (!remarksModal) return;

    try {
      setRemarksSaving(true);

      const res = await fetch(`http://localhost:5000/api/applications/${remarksModal.id}/remarks`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ remarks: remarksText }),
      });

      if (!res.ok) {
        throw new Error('Failed to save remarks');
      }

      setApps((prev) =>
        prev.map((a) =>
          a.id === remarksModal.id
            ? {
              ...a,
              remarks: remarksText,
            }
            : a
        )
      );

      setRemarksModal(null);
      setRemarksText('');
    } catch (err) {
      console.error('SAVE REMARKS ERROR:', err);
      alert(err.message || 'Failed to save remarks');
    } finally {
      setRemarksSaving(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);

    try {
      for (const id of ids) {
        await handleDecision(id, 'approve');
      }
      setSelected(new Set());
    } catch {
      // handled in inner function
    }
  };

  const renderApplicationCard = (app) => {
    const id = app.id;
    const normalizedAppStatus = (app.application_status || 'pending review').toLowerCase();
    const isDisq = app.disqualified;

    const docMeta = getDocStatusMeta(app.document_status);
    const appMeta = getAppStatusMeta(normalizedAppStatus);
    const gwaMeta = getGwaMeta(app.gwa);
    const ocrMeta = getOcrMeta(app);
    const normalizedSdo = normalizeSdo(app.sdu_level || app.sdo_status || '');
    const sdoStyle = SDO_STATUS_MAP[normalizedSdo] || SDO_STATUS_MAP.clear;

    const docStatus = (app.document_status || '').toLowerCase();
    const appStatus = normalizedAppStatus;
    const verificationStatus = (app.verification_status || '').toLowerCase();

    const isDocsComplete = docStatus === 'documents ready';
    const isInReviewStage = appStatus === 'interview';
    const isVerified = verificationStatus === 'verified';

    const requiresReupload =
      docStatus === 'missing docs' ||
      docStatus === 'under review' ||
      verificationStatus === 'rejected';

    const canDecide =
      isDocsComplete &&
      isInReviewStage &&
      isVerified &&
      !requiresReupload &&
      !!app.remarks;

    const atRisk = isApplicantAtRisk(app);
    const replacement = isReplacementCandidate(app);

    return (
      <div
        key={id}
        className={`rounded-xl border px-4 py-4 bg-white transition-all ${isDisq ? 'border-red-100 bg-red-50/20' : 'border-stone-200 hover:border-stone-300'
          }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-stone-900 truncate">{app.name}</h3>

              <Badge
                variant="outline"
                className="text-[10px] font-medium border-stone-200 text-stone-500 bg-white"
              >
                {app.program}
              </Badge>

              {isDisq && (
                <Badge className="bg-red-50 text-red-600 border-red-100 text-[10px] font-medium">
                  Disqualified
                </Badge>
              )}

              {requiresReupload && (
                <Badge className="bg-orange-50 text-orange-700 border-orange-100 text-[10px] font-medium">
                  Needs Re-upload
                </Badge>
              )}

              {atRisk && !replacement && (
                <Badge className="bg-red-50 text-red-700 border-red-100 text-[10px] font-medium">
                  At Risk
                </Badge>
              )}

              {replacement && (
                <Badge className="bg-amber-50 text-amber-700 border-amber-100 text-[10px] font-medium">
                  Replacement Pool
                </Badge>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-stone-400">{app.student_number}</span>
              {app.remarks && (
                <span className="inline-flex items-center gap-1 text-[11px] text-blue-600">
                  <MessageSquare className="w-3 h-3" />
                  Has Remarks
                </span>
              )}
            </div>
          </div>

          <input
            type="checkbox"
            checked={selected.has(id)}
            onChange={() => toggleOne(id)}
            className="accent-stone-700 mt-1 shrink-0"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill meta={appMeta} />
          <StatusPill meta={docMeta} />
          <StatusPill meta={gwaMeta} />
          <StatusPill meta={ocrMeta} />
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium"
            style={{ background: sdoStyle.bg, color: sdoStyle.color }}
          >
            {sdoStyle.label}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate(`/admin/applications/${id}/documents`)}
            className="h-8 px-3 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs shadow-none"
          >
            <Eye className="w-3 h-3 mr-1" />
            Review Documents
          </Button>

          {viewMode !== VIEW_MODES.replacement && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={!canDecide || decisionLoading === id}
                onClick={() => handleDecision(id, 'approve')}
                className="h-8 px-3 rounded-lg border-green-100 text-green-700 hover:bg-green-50 text-xs shadow-none disabled:opacity-40"
              >
                {decisionLoading === id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
                Qualify
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={!canDecide || decisionLoading === id}
                onClick={() => handleDecision(id, 'reject')}
                className="h-8 px-3 rounded-lg border-red-100 text-red-600 hover:bg-red-50 text-xs shadow-none disabled:opacity-40"
              >
                <XCircle className="w-3 h-3 mr-1" />
                Not Qualified
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenRemarks(app)}
            className="h-8 px-3 rounded-lg border-stone-200 text-stone-600 hover:bg-stone-50 text-xs shadow-none"
          >
            <FileSearch className="w-3 h-3 mr-1" />
            Remarks
          </Button>

          {!isDisq && viewMode !== VIEW_MODES.replacement && (
            <Button
              size="sm"
              onClick={() => setDisqApp(app)}
              className="h-8 w-8 p-0 rounded-lg bg-white border border-red-100 text-red-500 hover:bg-red-50 shadow-none"
            >
              <UserMinus className="w-3 h-3" />
            </Button>
          )}
        </div>

        {viewMode !== VIEW_MODES.replacement && !canDecide && (
          <p className="text-[11px] text-stone-400 mt-2">
            {!isInReviewStage
              ? 'Move application to review stage first.'
              : docStatus !== 'documents ready'
                ? 'Documents incomplete or require re-upload.'
                : !isVerified
                  ? 'Finish document verification first.'
                  : !app.remarks
                    ? 'Add reviewer remarks before decision.'
                    : 'Not ready for decision.'}
          </p>
        )}

        {viewMode === VIEW_MODES.replacement && (
          <p className="text-[11px] text-stone-400 mt-2">
            This applicant is in the replacement pool and can be considered later if a scholarship slot becomes available.
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">Loading applications...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <AlertCircle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-800">Failed to load applications</p>
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
      {disqApp && (
        <DisqModal
          app={disqApp}
          onDisqualify={handleDisqualify}
          onClose={() => setDisqApp(null)}
        />
      )}

      {remarksModal && (
        <RemarksModal
          app={remarksModal}
          value={remarksText}
          onChange={setRemarksText}
          onSave={handleSaveRemarks}
          onClose={() => setRemarksModal(null)}
          saving={remarksSaving}
        />
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Applications
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            {filtered.length} records
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === VIEW_MODES.replacement && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/replacements')}
              className="rounded-lg text-xs border-stone-200 text-stone-600"
            >
              <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
              Open Advanced Matching
            </Button>
          )}

          <Button
            size="sm"
            className="rounded-lg text-white text-xs border-none"
            style={{ background: C.brownMid }}
            onClick={handleExportExcel}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setViewMode(VIEW_MODES.current)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${viewMode === VIEW_MODES.current
            ? 'bg-stone-900 text-white border-stone-900'
            : 'bg-white text-stone-600 border-stone-200'
            }`}
        >
          Current Applicants
        </button>

        <button
          onClick={() => setViewMode(VIEW_MODES.at_risk)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${viewMode === VIEW_MODES.at_risk
            ? 'bg-red-600 text-white border-red-600'
            : 'bg-white text-stone-600 border-stone-200'
            }`}
        >
          At Risk
          <span className="ml-1.5">{atRiskCount}</span>
        </button>

        <button
          onClick={() => setViewMode(VIEW_MODES.replacement)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${viewMode === VIEW_MODES.replacement
            ? 'bg-amber-600 text-white border-amber-600'
            : 'bg-white text-stone-600 border-stone-200'
            }`}
        >
          Replacement Pool
          <span className="ml-1.5">{replacementCount}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((s) => (
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

      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(DOC_STATUS_MAP).map(([key, s]) => {
          const count = visibleApps.filter((a) => (a.document_status || '').toLowerCase() === key).length;
          const isActive = status === key;

          return (
            <button
              key={key}
              onClick={() => {
                setStatus(isActive ? 'all' : key);
                setPage(1);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
              style={{
                background: isActive ? s.bg : '#fff',
                borderColor: isActive ? s.color : '#e5e7eb',
                color: isActive ? s.color : '#9ca3af',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
              {s.label}
              <span className="font-semibold">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
          <Input
            placeholder="Search by student name or PDM ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
          />
        </div>

        <Select value={program} onValueChange={setProgram}>
          <SelectTrigger className="w-[180px] h-9 rounded-lg border-stone-200 text-sm">
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

        <Select value={sdoFilter} onValueChange={setSdoFilter}>
          <SelectTrigger className="w-[150px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue placeholder="SDO Flag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-sm">All SDO</SelectItem>
            <SelectItem value="clear" className="text-sm">Clear</SelectItem>
            <SelectItem value="minor" className="text-sm">Minor</SelectItem>
            <SelectItem value="major" className="text-sm">Major</SelectItem>
          </SelectContent>
        </Select>

        <Select value={appStatusFilter} onValueChange={setAppStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Status</SelectItem>
            <SelectItem value="pending review">Pending Review</SelectItem>
            <SelectItem value="interview">Interview</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>

        {(search || program !== 'All Programs' || status !== 'all' || sdoFilter !== 'all' || appStatusFilter !== 'All' || viewMode !== VIEW_MODES.current) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              setProgram('All Programs');
              setStatus('all');
              setSdoFilter('all');
              setAppStatusFilter('All');
              setViewMode(VIEW_MODES.current);
              setPage(1);
            }}
            className="h-9 rounded-lg text-xs border-stone-200"
          >
            Reset
          </Button>
        )}
      </div>

      <Card className="border-stone-200 shadow-none overflow-hidden">
        <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-semibold text-stone-800">Application Registry</CardTitle>
              <CardDescription className="text-xs">
                {viewMode === VIEW_MODES.current && 'Active and current-cycle applicant review'}
                {viewMode === VIEW_MODES.at_risk && 'Current applicants needing closer attention or follow-up'}
                {viewMode === VIEW_MODES.replacement && 'Past applicants retained for possible slot reconsideration'}
              </CardDescription>
            </div>

            <label className="flex items-center gap-2 text-xs text-stone-600 bg-white border border-stone-200 rounded-lg px-3 py-2 shrink-0">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                className="accent-stone-700"
              />
              Select all on page
            </label>
          </div>

          {selected.size > 0 && viewMode !== VIEW_MODES.replacement && (
            <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 mt-2">
              <span className="text-xs font-medium text-amber-700">{selected.size} selected</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs rounded-md text-white border-none"
                  style={{ background: C.green }}
                  onClick={handleBulkApprove}
                >
                  Approve All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(new Set())}
                  className="h-7 text-xs rounded-md border-stone-200"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-4">
          {tableLoading ? (
            <div className="text-center py-12 text-sm text-stone-400">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Refreshing records...
              </div>
            </div>
          ) : pageData.length === 0 ? (
            <div className="text-center py-12 text-sm text-stone-400">
              No applications match the current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {pageData.map(renderApplicationCard)}
            </div>
          )}
        </CardContent>

        <div className="px-5 py-3 bg-stone-50/50 border-t border-stone-100 flex items-center justify-between">
          <span className="text-xs text-stone-400">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
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

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · Application Management Layer
        </p>
      </footer>
    </div>
  );
}
