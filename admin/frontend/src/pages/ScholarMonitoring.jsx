import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocketEvent } from '@/hooks/useSocket';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';

// --- SHADCN UI COMPONENTS ---
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// --- ICONS ---
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  SlidersHorizontal,
  X,
  Mail,
  Phone,
  CalendarDays,
  ShieldAlert,
  FileText,
  FileCheck2,
} from 'lucide-react';
import { buildApiUrl } from '@/api';

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

const RO_STATUS_STYLE = {
  Pending: { label: 'Pending', color: C.amber, bg: C.amberSoft },
  Cleared: { label: 'Cleared', color: C.green, bg: C.greenSoft },
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
  pending_submission: { label: 'Pending', color: '#78716c', bg: '#f5f5f4' },
  submitted: { label: 'Submitted', color: C.blue, bg: C.blueSoft },
  under_review: { label: 'Under Review', color: C.amber, bg: C.amberSoft },
  approved: { label: 'Approved', color: C.green, bg: C.greenSoft },
  needs_reupload: { label: 'Needs Re-upload', color: C.red, bg: C.redSoft },
};

const PAGE_SIZE = 10;

// ─── Helpers ─────────────────────────────────────────────────────
function getInitials(name = '') {
  return (name || 'NA')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getScholarConditionMeta(gwa, sdu) {
  const g = Number(gwa);
  const level = sdu || 'none';

  if (!Number.isNaN(g) && g > 2.0 && level === 'major') return CONDITION_STYLE.critical;
  if (!Number.isNaN(g) && g > 2.0) return CONDITION_STYLE.risk;
  if (level === 'major') return CONDITION_STYLE.risk;
  if (level === 'minor') return CONDITION_STYLE.monitor;

  return CONDITION_STYLE.good;
}

function getRoStatusMeta(value) {
  const normalized = String(value || 'Pending').trim();

  if (normalized.toLowerCase() === 'cleared') {
    return RO_STATUS_STYLE.Cleared;
  }

  return RO_STATUS_STYLE.Pending;
}

function normalizeRenewalStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getRenewalStatusMeta(raw) {
  const key = normalizeRenewalStatus(raw);

  const styles = {
    pending_submission: { label: 'Pending', color: C.muted, bg: '#f5f5f4' },
    submitted: { label: 'Submitted', color: C.blue, bg: C.blueSoft },
    under_review: { label: 'Under Review', color: C.amber, bg: C.amberSoft },
    approved: { label: 'Approved', color: C.green, bg: C.greenSoft },
    needs_reupload: { label: 'Needs Re-upload', color: C.red, bg: C.redSoft },
    rejected: { label: 'Rejected', color: C.red, bg: C.redSoft },
    flagged: { label: 'Flagged', color: C.red, bg: C.redSoft },
    failed: { label: 'Failed', color: C.red, bg: C.redSoft },
  };

  return styles[key] || {
    label: String(raw || 'Pending'),
    color: C.muted,
    bg: '#f5f5f4',
  };
}

function getRenewalDocumentStatusMeta(raw) {
  const value = String(raw || '').trim().toLowerCase();

  if (value.includes('verified')) return { color: C.green, bg: C.greenSoft };
  if (value.includes('rejected') || value.includes('reupload') || value.includes('missing')) {
    return { color: C.red, bg: C.redSoft };
  }
  if (value.includes('uploaded') || value.includes('review') || value.includes('flagged')) {
    return { color: C.amber, bg: C.amberSoft };
  }

  return { color: C.muted, bg: '#f5f5f4' };
}

function formatRenewalDate(value) {
  if (!value) return 'Not yet submitted';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Filter Modal ────────────────────────────────────────────────
function FilterModal({
  open,
  onClose,
  programOptions,
  batchOptions,
  statusOptions,
  sortOptions,
  draftProgram,
  setDraftProgram,
  draftBatchYear,
  setDraftBatchYear,
  draftStatus,
  setDraftStatus,
  draftSortBy,
  setDraftSortBy,
  batchLabel = 'Batch Year',
  onApply,
  onClear,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/35 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md border-stone-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
          <div>
            <h3 className="text-base font-semibold text-stone-800">Filter Records</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Refine registry and renewal results
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
              Program
            </label>
            <Select value={draftProgram} onValueChange={setDraftProgram}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {programOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              {batchLabel}
            </label>
            <Select value={draftBatchYear} onValueChange={setDraftBatchYear}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {batchOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Status
            </label>
            <Select value={draftStatus} onValueChange={setDraftStatus}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {statusOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Sort By
            </label>
            <Select value={draftSortBy} onValueChange={setDraftSortBy}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {sortOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClear}
              className="h-9 rounded-lg border-stone-200 text-xs"
            >
              Clear
            </Button>
            <Button
              onClick={onApply}
              className="h-9 rounded-lg text-white text-xs border-none"
              style={{ background: C.brownMid }}
            >
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Scholar Profile Modal ───────────────────────────────────────
function ScholarProfileModal({ scholar, loading, onClose }) {
  if (!scholar && !loading) return null;

  const s = scholar || {};
  const gwaValue = Number(s.gwa);
  const sduStyle = SDU_STYLE[s.sdu_level || 'none'] || SDU_STYLE.none;
  const roMeta = getRoStatusMeta(s.ro_status);
  const condition = getScholarConditionMeta(s.gwa, s.sdu_level);

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
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-stone-700">RO Status</p>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                        style={{
                          background: roMeta.bg,
                          color: roMeta.color,
                        }}
                      >
                        {roMeta.label}
                      </span>
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
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">Scholarship slot will be released</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              Removing, graduating, or withdrawing this scholar releases one occupied slot. The next eligible applicant on the finalized waiting list will be promoted automatically when available.
            </p>
          </div>

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
                When enabled, the student remains in the students table with is_archived=true and is shown only in archived-record views. Scholarship history and audit data are preserved.
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
  const navigate = useNavigate();
  const location = useLocation();

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

  const [renewals, setRenewals] = useState([]);
  const [renewalsLoading, setRenewalsLoading] = useState(true);
  const [renewalsError, setRenewalsError] = useState('');

  const [archiveModalScholar, setArchiveModalScholar] = useState(null);
  const [archiveSaving, setArchiveSaving] = useState(false);

  const [sectionMode, setSectionMode] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    return tab === 'renewals' ? 'renewals' : 'registry';
  });

  const [filterOpen, setFilterOpen] = useState(false);
  const [draftProgram, setDraftProgram] = useState('All Programs');
  const [draftBatchYear, setDraftBatchYear] = useState('All Years');
  const [draftStatus, setDraftStatus] = useState('All Statuses');
  const [draftSortBy, setDraftSortBy] = useState('Name A-Z');

  useEffect(() => {
    const fetchScholars = async () => {
      try {
        setLoading(true);

        const [scholarsRes, statsRes] = await Promise.all([
          fetch(buildApiUrl('/api/scholars'), {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
              'Content-Type': 'application/json',
            },
          }),
          fetch(buildApiUrl('/api/scholars/stats'), {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
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

  const loadRenewals = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setRenewalsLoading(true);
      setRenewalsError('');

      const response = await fetch(buildApiUrl('/api/renewals'), {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      const payload = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to load renewal records');
      }

      setRenewals(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error('RENEWALS LOAD ERROR:', err);
      setRenewalsError(err.message || 'Failed to load renewal records');
    } finally {
      if (!quiet) setRenewalsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRenewals();
  }, [loadRenewals]);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    setSectionMode(tab === 'renewals' ? 'renewals' : 'registry');
  }, [location.search]);

  useSocketEvent('renewal:updated', () => {
    loadRenewals({ quiet: true });
  }, [loadRenewals]);

  useSocketEvent('renewal:approved', () => {
    loadRenewals({ quiet: true });
  }, [loadRenewals]);

  useSocketEvent('scholar:updated', () => {
    const fetchScholars = async () => {
      try {
        const [scholarsRes, statsRes] = await Promise.all([
          fetch(buildApiUrl('/api/scholars'), {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
              'Content-Type': 'application/json',
            },
          }),
          fetch(buildApiUrl('/api/scholars/stats'), {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
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
        console.error('Realtime update error:', err);
      }
    };

    fetchScholars();
  }, []);

  useSocketEvent('scholar:created', () => {
    const fetchScholars = async () => {
      try {
        const [scholarsRes, statsRes] = await Promise.all([
          fetch(buildApiUrl('/api/scholars'), {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
              'Content-Type': 'application/json',
            },
          }),
          fetch(buildApiUrl('/api/scholars/stats'), {
            headers: {
              Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
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
        console.error('Realtime update error:', err);
      }
    };

    fetchScholars();
  }, []);


  useSocketEvent('scholar:archived', () => {
    window.location.reload();
  }, []);

  useSocketEvent('scholar:restored', () => {
    window.location.reload();
  }, []);

  const handleArchiveScholar = async (payload) => {
    if (!archiveModalScholar) return;

    try {
      setArchiveSaving(true);

      const res = await fetch(
        buildApiUrl(`/api/scholars/${archiveModalScholar.scholar_id}/archive`),
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
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
      alert(data.message || (data.promotion?.promoted
        ? `Scholar removed. ${data.promotion.applicant_name || 'The next waiting applicant'} was promoted automatically.`
        : 'Scholar removed and the scholarship slot was released.'));
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

      const res = await fetch(buildApiUrl(`/api/scholars/${scholarId}`), {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
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

  const handleSectionModeChange = (nextMode) => {
    const mode = nextMode === 'renewals' ? 'renewals' : 'registry';
    setSectionMode(mode);
    setSearch('');
    setProgram('All Programs');
    setBatchYear('All Years');
    setStatus('All Statuses');
    setSortBy('Name A-Z');
    setPage(1);

    const params = new URLSearchParams(location.search);
    if (mode === 'renewals') params.set('tab', 'renewals');
    else params.delete('tab');

    const searchString = params.toString();
    navigate(
      {
        pathname: '/admin/scholars',
        search: searchString ? `?${searchString}` : '',
      },
      { replace: true }
    );
  };

  const filteredRenewals = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normalizedQ = q.replace(/[^a-z0-9]/g, '');

    let results = renewals.filter((renewal) => {
      const name = String(renewal.student_name || '').toLowerCase();
      const studentNumber = String(renewal.student_number || '').toLowerCase();
      const normalizedStudentNumber = studentNumber.replace(/[^a-z0-9]/g, '');
      const programName = renewal.program_name || '';
      const schoolYear = String(renewal.school_year_label || '');
      const renewalStatus = String(renewal.renewal_status || '');

      const matchSearch =
        !q ||
        name.includes(q) ||
        studentNumber.includes(q) ||
        normalizedStudentNumber.includes(normalizedQ) ||
        String(programName).toLowerCase().includes(q);

      const matchProgram = program === 'All Programs' || programName === program;
      const matchYear = batchYear === 'All Years' || schoolYear === String(batchYear);
      const matchStatus =
        status === 'All Statuses' ||
        normalizeRenewalStatus(renewalStatus) === normalizeRenewalStatus(status);

      return matchSearch && matchProgram && matchYear && matchStatus;
    });

    results = [...results].sort((a, b) => {
      const nameA = String(a.student_name || '').toLowerCase();
      const nameB = String(b.student_name || '').toLowerCase();
      const yearA = Number(String(a.school_year_label || '').split('-')[0]) || 0;
      const yearB = Number(String(b.school_year_label || '').split('-')[0]) || 0;

      switch (sortBy) {
        case 'Name Z-A':
          return nameB.localeCompare(nameA);
        case 'Batch Newest':
          return yearB - yearA;
        case 'Batch Oldest':
          return yearA - yearB;
        case 'Name A-Z':
        default:
          return nameA.localeCompare(nameB);
      }
    });

    return results;
  }, [renewals, search, program, batchYear, status, sortBy]);

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
      const batchA = Number(String(a.batch_year || '').split('-')[0]) || 0;
      const batchB = Number(String(b.batch_year || '').split('-')[0]) || 0;

      switch (sortBy) {
        case 'Name Z-A':
          return nameB.localeCompare(nameA);
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
  }, [search, program, batchYear, status, sortBy, sectionMode]);

  const totalPages = Math.max(
    1,
    Math.ceil((sectionMode === 'registry' ? filtered.length : filteredRenewals.length) / PAGE_SIZE)
  );

  const pageData = useMemo(() => {
    const source = sectionMode === 'registry' ? filtered : filteredRenewals;
    return source.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, filteredRenewals, page, sectionMode]);

  const programOptions = useMemo(() => {
    const source = sectionMode === 'registry' ? scholars : renewals;
    return ['All Programs', ...new Set(source.map((item) => item.program_name).filter(Boolean))];
  }, [scholars, renewals, sectionMode]);

  const batchOptions = useMemo(() => {
    const values = sectionMode === 'registry'
      ? scholars.map((item) => item.batch_year)
      : renewals.map((item) => item.school_year_label);

    return ['All Years', ...new Set(values.filter(Boolean))];
  }, [scholars, renewals, sectionMode]);

  const statusOptions = useMemo(() => {
    if (sectionMode === 'registry') {
      return ['All Statuses', 'Active', 'At Risk', 'Inactive'];
    }

    return [
      'All Statuses',
      ...new Set(renewals.map((item) => item.renewal_status).filter(Boolean)),
    ];
  }, [renewals, sectionMode]);

  const sortOptions = [
    'Name A-Z',
    'Name Z-A',
    'Batch Newest',
    'Batch Oldest',
  ];

  const hasActiveFilters =
    program !== 'All Programs' ||
    batchYear !== 'All Years' ||
    status !== 'All Statuses' ||
    sortBy !== 'Name A-Z';

  const openFilterModal = () => {
    setDraftProgram(program);
    setDraftBatchYear(batchYear);
    setDraftStatus(status);
    setDraftSortBy(sortBy);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setProgram(draftProgram);
    setBatchYear(draftBatchYear);
    setStatus(draftStatus);
    setSortBy(draftSortBy);
    setFilterOpen(false);
    setPage(1);
  };

  const clearFilters = () => {
    setDraftProgram('All Programs');
    setDraftBatchYear('All Years');
    setDraftStatus('All Statuses');
    setDraftSortBy('Name A-Z');

    setProgram('All Programs');
    setBatchYear('All Years');
    setStatus('All Statuses');
    setSortBy('Name A-Z');

    setFilterOpen(false);
    setPage(1);
  };

  if (loading) {
    return <PageLoadingSkeleton label="Loading scholar monitoring" showStats />;
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
    <div className="space-y-4 px-1 py-3" style={{ background: C.bg }}>
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

      <ArchiveScholarModal
        scholar={archiveModalScholar}
        onClose={() => setArchiveModalScholar(null)}
        onConfirm={handleArchiveScholar}
        saving={archiveSaving}
      />

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        programOptions={programOptions}
        batchOptions={batchOptions}
        statusOptions={statusOptions}
        sortOptions={sortOptions}
        draftProgram={draftProgram}
        setDraftProgram={setDraftProgram}
        draftBatchYear={draftBatchYear}
        setDraftBatchYear={setDraftBatchYear}
        draftStatus={draftStatus}
        setDraftStatus={setDraftStatus}
        draftSortBy={draftSortBy}
        setDraftSortBy={setDraftSortBy}
        batchLabel={sectionMode === 'renewals' ? 'Academic Year' : 'Batch Year'}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      <section
        className="rounded-2xl border bg-white p-3 sm:p-4"
        style={{ borderColor: '#e7e5e4' }}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              placeholder={
                sectionMode === 'registry'
                  ? 'Search by scholar name or PDM ID...'
                  : 'Search renewal by scholar name or PDM ID...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 text-sm bg-stone-50 rounded-xl border-stone-200"
            />
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 sm:w-auto">
              <button
                onClick={() => handleSectionModeChange('registry')}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${sectionMode === 'registry'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600'
                  }`}
              >
                Registry
              </button>

              <button
                onClick={() => handleSectionModeChange('renewals')}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${sectionMode === 'renewals'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600'
                  }`}
              >
                Renewals
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={openFilterModal}
              className="h-10 rounded-xl border-stone-200 bg-white px-3 text-stone-700"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Active
                </span>
              )}
            </Button>

            {search && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="h-10 rounded-xl text-xs border-stone-200"
              >
                Reset Search
              </Button>
            )}
          </div>
        </div>
      </section>

      <section
        className="overflow-hidden rounded-2xl border bg-white"
        style={{ borderColor: '#e7e5e4' }}
      >
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-stone-800">
            {sectionMode === 'registry' ? 'Scholar Registry' : 'Renewal Queue'}
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            {sectionMode === 'registry'
              ? `Active scholar monitoring records · ${filtered.length} result${filtered.length !== 1 ? 's' : ''}`
              : `Canonical renewal records · ${filteredRenewals.length} result${filteredRenewals.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <CardContent className="p-4">
          {sectionMode === 'renewals' && renewalsLoading ? (
            <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading renewal records...
            </div>
          ) : sectionMode === 'renewals' && renewalsError ? (
            <div className="min-h-[220px] rounded-xl border border-red-100 bg-red-50 p-6 text-center">
              <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-red-400" />
              <p className="text-sm font-semibold text-red-800">Failed to load renewal records</p>
              <p className="mt-1 text-xs text-red-600">{renewalsError}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 border-red-200 text-xs text-red-700"
                onClick={() => loadRenewals()}
              >
                Retry
              </Button>
            </div>
          ) : pageData.length === 0 ? (
            <div className="py-16 text-center text-sm text-stone-400">
              {sectionMode === 'registry'
                ? 'No scholars match the current filters.'
                : 'No renewal submissions are currently queued.'}
            </div>
          ) : sectionMode === 'renewals' ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50 hover:bg-stone-50">
                    <TableHead>Scholar</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Document Status</TableHead>
                    <TableHead>Renewal Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.map((renewal) => {
                    const renewalMeta = getRenewalStatusMeta(renewal.renewal_status);
                    const documentMeta = getRenewalDocumentStatusMeta(renewal.document_status);
                    const cycleLabel = [
                      renewal.semester_label,
                      renewal.school_year_label ? `AY ${renewal.school_year_label}` : '',
                    ].filter(Boolean).join(' · ');

                    return (
                      <TableRow key={`renewal-${renewal.renewal_id || renewal.id}`} className="hover:bg-stone-50/70">
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-stone-800">{renewal.student_name}</p>
                            <p className="text-xs text-stone-400">{renewal.student_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>{renewal.program_name || 'N/A'}</TableCell>
                        <TableCell className="text-xs text-stone-600">{cycleLabel || 'Current Period'}</TableCell>
                        <TableCell>
                          <span
                            className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{ background: documentMeta.bg, color: documentMeta.color }}
                          >
                            {renewal.document_status || 'Missing Docs'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                            style={{ background: renewalMeta.bg, color: renewalMeta.color }}
                          >
                            {renewalMeta.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-stone-500">
                          {formatRenewalDate(renewal.submitted_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-lg border-stone-200 text-xs"
                            onClick={() => navigate(`/admin/scholars/renewals/${renewal.renewal_id || renewal.id}`)}
                          >
                            <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
                            Review Renewal
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
                    <TableHead>Condition</TableHead>
                    <TableHead>RO</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {pageData.map((s) => {
                    const condition = getScholarConditionMeta(s.gwa, s.sdu_level);
                    const roMeta = getRoStatusMeta(s.ro_status);

                    return (
                      <TableRow key={s.scholar_id} className="hover:bg-stone-50/70">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9 rounded-xl border border-stone-200">
                              <AvatarImage src={s.avatar_url || undefined} alt={s.student_name} />
                              <AvatarFallback className="rounded-xl text-xs font-bold">
                                {getInitials(s.student_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-stone-800">{s.student_name}</p>
                              <p className="text-xs text-stone-400">{s.student_number}</p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>{s.program_name || 'N/A'}</TableCell>
                        <TableCell>{s.batch_year || 'N/A'}</TableCell>

                        <TableCell>
                          <span
                            className="text-[10px] font-medium px-2 py-1 rounded-full"
                            style={{
                              background: s.status === 'Active' ? C.greenSoft : C.redSoft,
                              color: s.status === 'Active' ? C.green : C.red,
                            }}
                          >
                            {s.status || 'Unknown'}
                          </span>
                        </TableCell>

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
                            className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                            style={{
                              background: roMeta.bg,
                              color: roMeta.color,
                            }}
                          >
                            {roMeta.label}
                          </span>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewScholar(s.scholar_id)}
                              className="h-8 rounded-lg border-stone-200 text-xs"
                            >
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              View Profile
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setArchiveModalScholar(s)}
                              className="h-8 rounded-lg border-red-200 text-red-700 hover:bg-red-50 text-xs"
                            >
                              <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                              Remove Privilege
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

        <div className="px-5 py-3 bg-stone-50/70 border-t border-stone-100 flex items-center justify-between">
          <span className="text-xs text-stone-400">
            Showing {pageData.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
            {Math.min(
              page * PAGE_SIZE,
              sectionMode === 'registry' ? filtered.length : filteredRenewals.length
            )}{' '}
            of {sectionMode === 'registry' ? filtered.length : filteredRenewals.length}
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 rounded-lg border-stone-200"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            <span className="text-xs font-medium text-stone-600 px-2.5">
              Page {page} / {totalPages}
            </span>

            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 rounded-lg border-stone-200"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
