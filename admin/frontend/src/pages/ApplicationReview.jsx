import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Loader2,
  AlertCircle,
  CalendarDays,
  Users,
  CheckCircle2,
  Clock3,
  ArrowRight,
  FolderOpen,
  CircleOff,
} from 'lucide-react';

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
  pending: { label: 'Pending', bg: '#f5f5f4', color: '#57534e' },
  review: { label: 'Under Review', bg: C.blueSoft, color: C.blueMid },
  qualified: { label: 'Qualified', bg: C.greenSoft, color: C.green },
  rejected: { label: 'Not Qualified', bg: C.redSoft, color: C.red },
  notqualified: { label: 'Not Qualified', bg: C.redSoft, color: C.red },
  disqualified: { label: 'Disqualified', bg: '#fee2e2', color: '#991b1b' },
  requires_reupload: { label: 'Needs Re-upload', bg: C.amberSoft, color: C.amber },
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

  if (raw === 'closed') {
    return { label: 'Closed', bg: C.redSoft, color: C.red };
  }

  if (raw === 'filled' || remainingSlots <= 0) {
    return { label: 'Filled', bg: C.amberSoft, color: C.amber };
  }

  return { label: 'Open', bg: C.greenSoft, color: C.green };
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
  const appRisk = rawStatus === 'requires_reupload';

  return gwaRisk || docRisk || verificationRisk || sdoRisk || appRisk;
}

function isReplacementCandidate(app) {
  const rawStatus = (app?.application_status || '').toLowerCase();
  return (
    ['rejected', 'notqualified', 'disqualified'].includes(rawStatus) &&
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

  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadOpenings = async ({ soft = false } = {}) => {
    try {
      if (soft) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError('');
      }

      const token = localStorage.getItem('adminToken');

      const res = await fetch('http://localhost:5000/api/program-openings/admin/applications-summary', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const message = await parseErrorResponse(res, 'Failed to fetch scholarship openings');
        throw new Error(message);
      }

      const data = await res.json();
      setOpenings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('OPENINGS FETCH ERROR:', err);
      setError(err.message || 'Failed to load scholarship openings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOpenings();
  }, []);

  const filteredOpenings = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normalizedQ = q.replace(/[^a-z0-9]/g, '');

    let base = [...visibleApps];

    if (appStatusFilter !== 'All') {
      base = base.filter((a) => {
        const raw = (a.application_status || 'pending').toLowerCase();
        if (appStatusFilter === 'notqualified') return raw === 'rejected' || raw === 'notqualified';
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
  }, [openings, search]);

  const stats = useMemo(() => {
    const total = openings.length;
    const openCount = openings.filter((o) => getOpeningStatusMeta(o).label === 'Open').length;
    const filledCount = openings.filter((o) => getOpeningStatusMeta(o).label === 'Filled').length;
    const totalApplicants = openings.reduce((sum, o) => sum + Number(o.application_count || 0), 0);

    return [
      {
        label: 'Total Openings',
        value: total,
        icon: FolderOpen,
        soft: C.amberSoft,
        accent: C.brown,
      },
      {
        label: 'Open Now',
        value: openCount,
        icon: CheckCircle2,
        soft: C.greenSoft,
        accent: C.green,
      },
      {
        label: 'Filled',
        value: filledCount,
        icon: CircleOff,
        soft: C.redSoft,
        accent: C.red,
      },
      {
        label: 'Total Applicants',
        value: totalApplicants,
        icon: Users,
        soft: C.blueSoft,
        accent: C.blueMid,
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
        method: 'POST',
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
              application_status: 'disqualified',
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
              application_status: action === 'approve' ? 'qualified' : 'rejected',
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
    const normalizedAppStatus = (app.application_status || 'pending').toLowerCase();
    const isDisq = app.disqualified || normalizedAppStatus === 'disqualified';

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
    const isInReviewStage = appStatus === 'review';
    const isVerified = verificationStatus === 'verified';

    const requiresReupload =
      docStatus === 'missing docs' ||
      docStatus === 'under review' ||
      verificationStatus === 'rejected' ||
      appStatus === 'requires_reupload';

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
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">Loading scholarship openings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <AlertCircle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-800">Failed to load openings</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <Button
          onClick={() => loadOpenings()}
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Applications
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            Review applicants by scholarship opening
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadOpenings({ soft: true })}
          className="rounded-lg text-xs border-stone-200 text-stone-600"
        >
          {refreshing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Clock3 className="mr-1.5 h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
        <Input
          placeholder="Search by opening title, scholarship program, or benefactor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 text-sm bg-white rounded-lg border-stone-200"
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
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="review">Under Review</SelectItem>
            <SelectItem value="qualified">Qualified</SelectItem>
            <SelectItem value="notqualified">Not Qualified</SelectItem>
            <SelectItem value="disqualified">Disqualified</SelectItem>
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

                    <StatusPill meta={statusMeta} />
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                      <p className="text-[11px] text-stone-500">Slots</p>
                      <p className="text-lg font-semibold text-stone-900">{slotCount}</p>
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                      <p className="text-[11px] text-stone-500">Qualified</p>
                      <p className="text-lg font-semibold text-stone-900">{qualifiedCount}</p>
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                      <p className="text-[11px] text-stone-500">Applicants</p>
                      <p className="text-lg font-semibold text-stone-900">{applicationCount}</p>
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                      <p className="text-[11px] text-stone-500">Remaining</p>
                      <p className="text-lg font-semibold text-stone-900">{remainingSlots}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {formatDate(opening.start_date || opening.application_start)} - {formatDate(opening.end_date || opening.application_end)}
                    </span>
                    <span>•</span>
                    <span>{pendingCount} pending</span>
                    <span>•</span>
                    <span>{reviewCount} under review</span>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="rounded-lg text-white text-xs border-none"
                      style={{ background: C.brownMid }}
                      onClick={() => navigate(`/admin/openings/${opening.opening_id}/applications`)}
                    >
                      View Applicants
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · Opening-Based Application Review
        </p>
      </footer>
    </div>
  );
}
