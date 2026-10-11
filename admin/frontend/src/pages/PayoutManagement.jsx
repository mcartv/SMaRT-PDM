import { useRbacPermissions } from '@/context/RbacPermissionContext';
import { formatPeso } from '@/utils/currency';
import { useListPage } from '../hooks/useListPage';
// SMaRT-PDM: Payout — Payout Management (admin frontend page); loads data, handles page actions, and renders the admin view.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useSocketEvent } from '@/hooks/useSocket';
import {
  Loader2,
  Plus,
  Wallet,
  CheckCircle2,
  Clock3,
  XCircle,
  CircleSlash,
  Search,
  Eye,
  Users,
  Building2,
  Archive,
  ArchiveRestore,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Info,
  X,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import PayoutProofReviewPanel from '@/components/payout/PayoutProofReviewPanel';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';
import ScholarIdentity from '@/components/profile/ScholarIdentity';

const API_BASE = buildApiUrl('/api');
const PAGE_SIZE = 6;
const BULLET = '\u2022';
const EM_DASH = '\u2014';
const MANILA_TIME_ZONE = 'Asia/Manila';

// getManilaDateInputValue: reads and returns get manila date input value for the Payout flow.
function getManilaDateInputValue(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function formatPayoutTime(value) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

// formatPayoutDate: formats format payout date for the Payout flow.
function formatPayoutDate(value) {
  if (!value) return EM_DASH;

  const raw = String(value).trim();
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const dateOnly = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

    return new Intl.DateTimeFormat('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(dateOnly);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return EM_DASH;

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: MANILA_TIME_ZONE,
  }).format(parsed);
}

const C = {
  brownMid: 'var(--portal-base)',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  orange: '#d97706',
  orangeSoft: '#FFF7ED',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  slate: '#475569',
  slateSoft: '#F8FAFC',
  bg: '#F8F6F2',
  line: 'var(--portal-border)',
};

const EMPTY_FORM = {
  opening_id: '',
  semester: '',
  academic_year_id: '',
  school_year: '',
  payout_title: '',
  payout_date: getManilaDateInputValue(),
  payout_time: '',
  payout_venue: 'OSFA - Office of Scholarship and Financial Assistance',
  payment_mode: 'Cash',
  payment_mode_other: '',
  amount_per_scholar: '',
  remarks: '',
  scholar_ids: [],
};

// getAuthHeaders: reads and returns get auth headers for the Payout flow.
function getAuthHeaders(json = true) {
  const token = sessionStorage.getItem('adminToken');

  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };
}

// fetchPayoutBatches: fetches and returns fetch payout batches for the Payout flow.
async function fetchPayoutBatches(query) {
  const response = await fetch(`${API_BASE}/payouts?${query}`, {
    headers: getAuthHeaders(false),
  });
  if (!response.ok) throw new Error('Failed to load payout batches');
  const data = await response.json();
  return data;
}

// normalizeId: normalizes normalize id for the Payout flow.
function normalizeId(value) {
  return value == null ? '' : String(value).trim();
}

// formatPaymentMode: formats format payment mode for the Payout flow.
function formatPaymentMode(paymentMode, otherPaymentMode = '') {
  const mode = String(paymentMode || '').trim();
  const other = String(otherPaymentMode || '').trim();
  return mode === 'Other' && other ? `Other - ${other}` : mode;
}

// formatProgramBenefactor: formats format program benefactor for the Payout flow.
function formatProgramBenefactor(programName, benefactorName) {
  const program = String(programName || '').trim();
  const benefactor = String(benefactorName || '').trim();

  if (!program && !benefactor) return 'No Program';
  if (!program) return benefactor;
  if (!benefactor || program.toLowerCase() === benefactor.toLowerCase()) {
    return program;
  }

  return `${program} ${BULLET} ${benefactor}`;
}

// formatOpeningStatus: formats format opening status for the Payout flow.
function formatOpeningStatus(value) {
  const raw = String(value || '').trim();
  if (!raw) return EM_DASH;
  if (/^(open|closed)$/i.test(raw)) {
    return `${raw.charAt(0).toUpperCase()}${raw.slice(1).toLowerCase()}`;
  }
  return raw;
}

// isBulkReleaseEligible: checks whether is bulk release eligible for the Payout flow.
function isBulkReleaseEligible(status) {
  const normalized = normalizeReleaseStatus(status);
  return normalized === 'Pending' || normalized === 'On Hold';
}

// normalizeReleaseStatus: normalizes normalize release status for the Payout flow.
function normalizeReleaseStatus(value) {
  const raw = String(value || 'Pending').trim().toLowerCase();

  if (raw === 'released' || raw === 'release' || raw === 'got payout') return 'Released';
  if (raw === 'absent' || raw === 'still absent') return 'Absent';
  if (raw === 'on hold' || raw === 'hold' || raw === 'held') return 'On Hold';
  if (raw === 'cancelled' || raw === 'canceled') return 'Cancelled';

  return 'Pending';
}

// belongsToOpening: handles belongs to opening for the Payout flow.
function belongsToOpening(item, openingId) {
  const target = normalizeId(openingId);
  if (!target) return true;

  const candidates = [
    item?.opening_id,
    item?.openingId,
    item?.program_opening_id,
    item?.programOpeningId,
    item?.opening?.opening_id,
    item?.batch_opening_id,
  ].map(normalizeId);

  return candidates.includes(target);
}

// filterScholarsByOpening: handles filter scholars by opening for the Payout flow.
function filterScholarsByOpening(scholars = [], openingId) {
  const target = normalizeId(openingId);
  if (!target) return Array.isArray(scholars) ? scholars : [];

  return (Array.isArray(scholars) ? scholars : []).filter((scholar) =>
    belongsToOpening(scholar, target)
  );
}

// getBatchScholars: reads and returns get batch scholars for the Payout flow.
function getBatchScholars(batch) {
  const scholars = Array.isArray(batch?.scholars) ? batch.scholars : [];
  const openingId = normalizeId(batch?.opening_id);

  if (!openingId || !scholars.length) return scholars;

  const hasOpeningMetadata = scholars.some((scholar) =>
    [
      scholar?.opening_id,
      scholar?.openingId,
      scholar?.program_opening_id,
      scholar?.programOpeningId,
      scholar?.opening?.opening_id,
      scholar?.batch_opening_id,
    ].some((value) => Boolean(normalizeId(value)))
  );

  return hasOpeningMetadata
    ? filterScholarsByOpening(scholars, openingId)
    : scholars;
}

// isTerminalPayoutStatus: checks whether is terminal payout status for the Payout flow.
function isTerminalPayoutStatus(status) {
  const normalized = normalizeReleaseStatus(status);
  return ['Released', 'Absent', 'Cancelled'].includes(normalized);
}

// isBatchFinished: checks whether is batch finished for the Payout flow.
function isBatchFinished(batch) {
  const scholars = getBatchScholars(batch);
  if (!scholars.length) return false;

  return scholars.every((s) => isTerminalPayoutStatus(s.release_status));
}

// hasManageablePayoutEntries: checks whether has manageable payout entries for the Payout flow.
function hasManageablePayoutEntries(batch) {
  const scholars = getBatchScholars(batch);

  return scholars.some((s) => {
    const status = normalizeReleaseStatus(s.release_status);
    return status === 'Pending' || status === 'On Hold';
  });
}

// formatMoney: formats format money for the Payout flow.
function formatMoney(value) {
  return formatPeso(value || 0);
}

// getEntryId: reads and returns get entry id for the Payout flow.
function getEntryId(entry) {
  return (
    entry?.payout_entry_id ||
    entry?.payout_batch_student_id ||
    entry?.entry_id ||
    entry?.id ||
    ''
  );
}

// getPayoutCounts: reads and returns get payout counts for the Payout flow.
function getPayoutCounts(batch) {
  const scholars = getBatchScholars(batch);

  return {
    total: scholars.length,
    released: scholars.filter((s) => normalizeReleaseStatus(s.release_status) === 'Released').length,
    pending: scholars.filter((s) => normalizeReleaseStatus(s.release_status) === 'Pending').length,
    absent: scholars.filter((s) => normalizeReleaseStatus(s.release_status) === 'Absent').length,
    onHold: scholars.filter((s) => normalizeReleaseStatus(s.release_status) === 'On Hold').length,
    cancelled: scholars.filter((s) => normalizeReleaseStatus(s.release_status) === 'Cancelled').length,
  };
}

// SmallMetric: handles small metric for the Payout flow.
function SmallMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}

// ReadOnlyField: handles read only field for the Payout flow.
function ReadOnlyField({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-foreground">{value || EM_DASH}</p>
    </div>
  );
}

// PaginationFooter: handles pagination footer for the Payout flow.
function PaginationFooter({
  total,
  page,
  totalPages,
  pageSize,
  onPrev,
  onNext,
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <section
      className="overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: C.line }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs text-stone-400">
          Showing {start}-{end} of {total}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={onPrev}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <p className="text-xs font-medium text-stone-600">
            Page {page} / {totalPages}
          </p>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={onNext}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

// PostPayoutCreatePrompt: handles post payout create prompt for the Payout flow.
function PostPayoutCreatePrompt({
  open,
  payout,
  onClose,
  onCreateAnnouncement,
}) {
  if (!open || !payout) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md overflow-hidden border-stone-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-stone-100 bg-stone-50 px-5 py-4">
          <h3 className="text-base font-semibold text-stone-900">
            Payout Batch Created
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            {payout.payout_title || 'Payout batch created successfully.'}
          </p>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
            <p className="text-sm font-medium text-stone-800">
              Create an announcement for the scholars in this scholarship opening?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              This will open the Announcements module with the payout details already filled in.
            </p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-stone-700">
              {payout.opening_title || payout.payout_title || 'Scholarship Payout'}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {formatProgramBenefactor(payout.program_name, payout.benefactor_name)}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {payout.scholar_count || 0} scholar(s) selected
              {payout.amount_per_scholar
                ? ` ${BULLET} ${formatMoney(payout.amount_per_scholar)} per scholar`
                : ''}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-9 rounded-lg border-stone-200 text-xs"
            >
              Skip for Now
            </Button>

            <Button
              onClick={onCreateAnnouncement}
              className="h-9 rounded-lg border-none text-xs text-white"
              style={{ background: C.brownMid }}
            >
              <Megaphone className="mr-2 h-4 w-4" />
              Create Announcement
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ArchiveBatchModal: archives archive batch modal for the Payout flow.
function ArchiveBatchModal({
  batch,
  open,
  working,
  onCancel,
  onConfirm,
}) {
  if (!open || !batch) return null;

  const counts = getPayoutCounts(batch);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!working) onCancel();
      }}
    >
      <Card
        className="w-full max-w-md overflow-hidden rounded-2xl border-stone-200 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-100 px-5 py-4">
          <h3 className="text-base font-semibold text-stone-900">
            Archive payout batch?
          </h3>
          <p className="mt-1 text-sm leading-5 text-stone-500">
            {batch.payout_title || 'This payout batch'} will move to Archived.
            Payout records and scholar history are preserved.
          </p>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-2">
            <SmallMetric label="Released" value={counts.released} />
            <SmallMetric label="Absent" value={counts.absent} />
            <SmallMetric label="Cancelled" value={counts.cancelled} />
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-xs leading-5 text-stone-600">
            Archive is available only when every scholar has a final payout
            status: Released, Absent, or Cancelled.
          </div>
        </CardContent>

        <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={working}
            onClick={onCancel}
            className="h-9 rounded-lg border-stone-200 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={working}
            onClick={onConfirm}
            className="h-9 rounded-lg border-none text-xs text-white"
            style={{ background: C.brownMid }}
          >
            {working ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="mr-1.5 h-3.5 w-3.5" />
            )}
            Archive Batch
          </Button>
        </div>
      </Card>
    </div>
  );
}

// PayoutStatusModal: handles payout status modal for the Payout flow.
function PayoutStatusModal({
  candidate,
  remarks,
  error,
  working,
  onRemarksChange,
  onCancel,
  onConfirm,
}) {
  if (!candidate) return null;

  const nextStatus = normalizeReleaseStatus(candidate.nextStatus);
  const isOnHold = nextStatus === 'On Hold';
  const isReleased = nextStatus === 'Released';
  const scholarName = candidate.entry?.student_name || 'Selected scholar';
  const scholarPdmId = String(candidate.entry?.pdm_id || '').trim();
  const scholarCourse = String(
    candidate.entry?.course_code || candidate.entry?.course_name || ''
  ).trim();
  const scholarMeta = [scholarPdmId, scholarCourse].filter(Boolean).join(' · ');
  const payoutMode = candidate.batch?.payment_mode || candidate.entry?.payment_mode || '';
  const payoutType = candidate.batch?.payment_mode_other || candidate.entry?.payment_mode_other || '';
  const canSubmit = !working && (!isOnHold || remarks.trim().length > 0);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!working) onCancel();
      }}
    >
      <Card
        className="w-full max-w-md overflow-hidden rounded-2xl border-stone-200 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-100 px-5 py-4">
          <h3 className="text-base font-semibold text-stone-900">
            {isReleased ? 'Confirm Payout Release' : 'Update payout status'}
          </h3>
          <p className="mt-1 text-sm leading-5 text-stone-500">
            {isReleased
              ? 'Confirm the payout release before saving.'
              : `${scholarName} will be marked as ${nextStatus}.`}
          </p>
        </div>

        <CardContent className="space-y-3.5 p-5">
          {isReleased ? (
            <div>
              <p className="text-sm font-semibold text-stone-900">{scholarName}</p>
              {scholarMeta ? (
                <p className="mt-1 text-xs font-medium text-stone-500">{scholarMeta}</p>
              ) : null}
              <div className="mt-3 space-y-2 border-y border-stone-100 py-3 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-stone-500">Amount</span>
                  <span className="font-semibold text-stone-900">
                    {formatMoney(candidate.entry?.amount_received)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-stone-500">Payout Mode</span>
                  <span className="font-medium text-stone-800">{payoutMode || EM_DASH}</span>
                </div>
                {String(payoutMode).trim() === 'Other' && payoutType ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-stone-500">Payout Type</span>
                    <span className="font-medium text-stone-800">{payoutType}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">
              Remarks {isOnHold ? <span className="text-red-600">*</span> : <span className="font-normal text-stone-400">(optional)</span>}
            </label>
            <textarea
              value={remarks}
              onChange={(event) => onRemarksChange(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder={isOnHold ? 'Reason for placing this payout on hold' : isReleased ? 'Add a note for this payout release...' : 'Add a note for this status update'}
              className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-400 disabled:cursor-not-allowed disabled:bg-stone-50"
              disabled={working}
            />
            <div className="flex items-center justify-between gap-3 text-[11px] text-stone-400">
              <span>{isOnHold ? 'Remarks are required for On Hold.' : 'Optional record note.'}</span>
              <span>{remarks.length}/500</span>
            </div>
          </div>

          {isReleased ? (
            <div className="flex items-start gap-2 rounded-lg bg-stone-50 px-3 py-2.5 text-xs leading-5 text-stone-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              <span>
                After release, the scholar will be notified and asked to upload Proof of Payout in the mobile app.
              </span>
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          ) : null}
        </CardContent>

        <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={working}
            onClick={onCancel}
            className="h-9 rounded-lg border-stone-200 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={onConfirm}
            className="h-9 rounded-lg border-none text-xs text-white"
            style={{ background: C.brownMid }}
          >
            {working ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {isReleased ? 'Confirm Release' : `Confirm ${nextStatus}`}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// BulkReleaseModal: handles bulk release modal for the Payout flow.
function BulkReleaseModal({
  open,
  entries,
  batch,
  remarks,
  confirmed,
  error,
  working,
  onRemarksChange,
  onConfirmedChange,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const totalAmount = entries.reduce(
    (sum, entry) => sum + Number(entry?.amount_received || 0),
    0
  );
  const payoutMode = batch?.payment_mode || '';
  const payoutType = batch?.payment_mode_other || '';

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!working) onCancel();
      }}
    >
      <Card
        className="w-full max-w-lg overflow-hidden rounded-2xl border-stone-200 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-100 px-5 py-4">
          <h3 className="text-base font-semibold text-stone-900">
            Confirm Payout Release
          </h3>
          <p className="mt-1 text-sm leading-5 text-stone-500">
            You are about to release payouts for {entries.length} scholar{entries.length === 1 ? '' : 's'}.
          </p>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ReadOnlyField label="Scholars" value={entries.length} />
            <ReadOnlyField label="Total Amount" value={formatMoney(totalAmount)} />
            <ReadOnlyField label="Payout Mode" value={payoutMode || EM_DASH} />
          </div>

          {String(payoutMode).trim() === 'Other' && payoutType ? (
            <ReadOnlyField label="Payout Type" value={payoutType} />
          ) : null}

          <div className="max-h-40 overflow-auto rounded-xl border border-stone-200 bg-stone-50">
            {entries.map((entry) => (
              <div
                key={getEntryId(entry)}
                className="flex items-center justify-between gap-3 border-b border-stone-200 px-3 py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-stone-800">
                    {entry.student_name || 'Scholar'}
                  </p>
                  <p className="text-[11px] text-stone-500">{entry.pdm_id || EM_DASH}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-stone-700">
                  {formatMoney(entry.amount_received)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-700">
              Remarks <span className="font-normal text-stone-400">(optional)</span>
            </label>
            <textarea
              value={remarks}
              onChange={(event) => onRemarksChange(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Add one note for the selected payout releases"
              className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-400 disabled:cursor-not-allowed disabled:bg-stone-50"
              disabled={working}
            />
            <div className="text-right text-[11px] text-stone-400">{remarks.length}/500</div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-xs leading-5 text-stone-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => onConfirmedChange(event.target.checked)}
              disabled={working}
              className="mt-0.5"
            />
            <span>
              I confirm that these payouts have been released. Each scholar will be notified and asked to upload Proof of Payout.
            </span>
          </label>

          {error ? (
            <div role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
              {error}
            </div>
          ) : null}
        </CardContent>

        <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={working}
            onClick={onCancel}
            className="h-9 rounded-lg border-stone-200 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={working || !confirmed || entries.length === 0}
            onClick={onConfirm}
            className="h-9 rounded-lg border-none text-xs text-white"
            style={{ background: C.brownMid }}
          >
            {working ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            Confirm {entries.length} Release{entries.length === 1 ? '' : 's'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function PayoutManagement() {
  // SMARTPDM_PHASE5_3_PART2
  const { hasPermission: canPerformSensitiveAction } = useRbacPermissions();
  // PHASE_5_3_PAYOUT_ACTIONS
  const { hasPermission } = useRbacPermissions();
  const navigate = useNavigate();

  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [openings, setOpenings] = useState([]);
  const [eligiblePayload, setEligiblePayload] = useState({
    opening: null,
    scholars: [],
  });

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState('');
  const [workingEntryId, setWorkingEntryId] = useState(null);
  const [archivingBatchId, setArchivingBatchId] = useState(null);
  const [restoringBatchId, setRestoringBatchId] = useState(null);
  const [archiveCandidate, setArchiveCandidate] = useState(null);
  const [statusCandidate, setStatusCandidate] = useState(null);
  const [statusRemarks, setStatusRemarks] = useState('');
  const [statusError, setStatusError] = useState('');
  const [selectedReleaseIds, setSelectedReleaseIds] = useState([]);
  const [bulkReleaseOpen, setBulkReleaseOpen] = useState(false);
  const [bulkReleaseRemarks, setBulkReleaseRemarks] = useState('');
  const [bulkReleaseConfirmed, setBulkReleaseConfirmed] = useState(false);
  const [bulkReleaseError, setBulkReleaseError] = useState('');
  const [bulkReleaseWorking, setBulkReleaseWorking] = useState(false);

  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('batches');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [venueEditor, setVenueEditor] = useState(null);
  const [savingVenue, setSavingVenue] = useState(false);
  const [venueError, setVenueError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [payoutNotice, setPayoutNotice] = useState(null);
  const showPayoutNotice = useCallback((message, title = 'Check payout details') => {
    setPayoutNotice({ message, title });
  }, []);
  const [academicYears, setAcademicYears] = useState([]);

  const [postCreateOpen, setPostCreateOpen] = useState(false);
  const [newPayoutForPrompt, setNewPayoutForPrompt] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const realtimeRefreshTimer = useRef(null);
  const openingEligibilityRequest = useRef(0);

  const { page, setPage, query: listQuery, metadata: listMetadata, accept: acceptList, beginRequest } = useListPage({ search, tab: activeSection }, PAGE_SIZE);
  const loadBatches = useCallback(async () => {
    const isCurrent = beginRequest();
    if (!isCurrent()) return;
    try {
      const data = await fetchPayoutBatches(listQuery);
      if (!isCurrent()) return;
      acceptList(data);
      setBatches(data.items || []);
    } catch (error) {
      if (isCurrent()) {
        console.error('PAYOUT BATCH REFRESH ERROR:', error);
        toast.error('Failed to load payout batches.', { description: error.message });
      }
    } finally {
      if (isCurrent()) setBatchesLoading(false);
    }
  }, [listQuery, acceptList, beginRequest]);
  useEffect(() => { loadBatches(); }, [loadBatches]);

  // scheduleRealtimeRefresh: handles schedule realtime refresh for the Payout flow.
  const scheduleRealtimeRefresh = () => {
    if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
    realtimeRefreshTimer.current = setTimeout(() => {
      realtimeRefreshTimer.current = null;
      loadBatches();
    }, 200);
  };

  useEffect(() => () => {
    if (realtimeRefreshTimer.current) clearTimeout(realtimeRefreshTimer.current);
  }, []);


  useSocketEvent('payout:created', () => {
    scheduleRealtimeRefresh();
  }, [loadBatches]);

  useSocketEvent('payout:updated', () => {
    scheduleRealtimeRefresh();
  }, [loadBatches]);

  useSocketEvent('payout:archived', () => {
    scheduleRealtimeRefresh();
  }, [loadBatches]);

  useSocketEvent('payout:restored', () => {
    scheduleRealtimeRefresh();
  }, [loadBatches]);


  useEffect(() => {
    setSelectedReleaseIds([]);
    setBulkReleaseOpen(false);
    setBulkReleaseRemarks('');
    setBulkReleaseConfirmed(false);
    setBulkReleaseError('');
  }, [selectedBatch?.payout_batch_id]);

  useEffect(() => {
    if (!form.opening_id) {
      openingEligibilityRequest.current += 1;
      setEligibilityLoading(false);
      setEligibilityError('');
      setEligiblePayload({ opening: null, scholars: [] });
      setForm((prev) => ({
        ...prev,
        semester: '',
        academic_year_id: '',
        school_year: '',
        payout_title: '',
        amount_per_scholar: '',
        scholar_ids: [],
      }));
      return;
    }

    const controller = new AbortController();
    loadOpeningEligibility(form.opening_id, controller.signal);
    return () => { controller.abort(); openingEligibilityRequest.current += 1; };
  }, [form.opening_id]);

  // loadAll: loads and returns load all for the Payout flow.
  const loadReferenceData = useCallback(async () => {
    try {
      setLoading(true);

      const [openingRes, academicYearRes] = await Promise.all([
        fetch(`${API_BASE}/payouts/openings`, { headers: getAuthHeaders(false) }),
        fetch(`${API_BASE}/academic-years`, { headers: getAuthHeaders(false) }),
      ]);

      if (!openingRes.ok) throw new Error('Failed to load openings');
      if (!academicYearRes.ok) throw new Error('Failed to load academic years');

      const openingData = await openingRes.json();
      const academicYearData = await academicYearRes.json();


      setOpenings(
        (Array.isArray(openingData) ? openingData : []).filter(
          (o) =>
            !o.is_archived &&
            String(o.status || o.posting_status || '').toLowerCase() !== 'archived'
        )
      );

      setAcademicYears(
        (Array.isArray(academicYearData) ? academicYearData : []).filter(
          (ay) =>
            ay?.is_archived !== true &&
            String(ay?.status || '').toLowerCase() !== 'archived'
        )
      );
    } catch (err) {
      console.error('PAYOUT MANAGEMENT LOAD ERROR:', err);
      showPayoutNotice(err.message || 'Failed to load payout module', 'Unable to load payouts');
    } finally {
      setLoading(false);
    }
  }, [showPayoutNotice]);

  useEffect(() => { loadReferenceData(); }, [loadReferenceData]);

  const loadAll = () => Promise.all([loadBatches(), loadReferenceData()]);

  async function handleSaveVenue(event) {
    event.preventDefault();
    if (!canPerformSensitiveAction('payouts.manage')) return;
    if (!venueEditor || savingVenue) return;
    const venue = venueEditor.value.trim();
    if (!venue) { setVenueError('Please enter the payout venue.'); return; }
    setSavingVenue(true);
    setVenueError('');
    try {
      const res = await fetch(`${API_BASE}/payouts/${venueEditor.batchId}/venue`, {
        method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ payout_venue: venue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to update venue.');
      const applyVenue = (batch) => batch?.payout_batch_id === venueEditor.batchId
        ? { ...batch, payout_venue: data.payout_venue, updated_at: data.updated_at } : batch;
      setBatches((previous) => previous.map(applyVenue));
      setSelectedBatch(applyVenue);
      setVenueEditor(null);
      toast.success('Payout venue updated');
      loadBatches();
    } catch (error) {
      setVenueError(error.message);
    } finally { setSavingVenue(false); }
  }

  // loadOpeningEligibility: loads and returns load opening eligibility for the Payout flow.
  const loadOpeningEligibility = async (openingId, signal) => {
    const requestId = ++openingEligibilityRequest.current;
    setEligibilityLoading(true);
    setEligibilityError('');
    setEligiblePayload({ opening: null, scholars: [] });
    setForm((prev) => ({ ...prev, semester: '', academic_year_id: '', school_year: '', amount_per_scholar: '', scholar_ids: [] }));
    try {
      const res = await fetch(
        `${API_BASE}/payouts/eligible-scholars?opening_id=${encodeURIComponent(openingId)}`,
        { headers: getAuthHeaders(false), signal }
      );

      if (!res.ok) {
        throw new Error('Failed to load eligible scholars for opening');
      }

      const data = await res.json();
      if (signal?.aborted || requestId !== openingEligibilityRequest.current) return;
      const scholars = Array.isArray(data?.scholars) ? data.scholars : [];
      const opening = data?.opening || null;

      const filteredScholars = filterScholarsByOpening(
        scholars,
        openingId || opening?.opening_id
      );

      setEligiblePayload({ opening, scholars: filteredScholars });

      setForm((prev) => ({
        ...prev,
        semester: opening?.semester || '',
        academic_year_id: opening?.academic_year_id || '',
        school_year: opening?.academic_year || '',
        payout_title: opening?.opening_title || '',
        amount_per_scholar:
          opening?.amount_per_scholar ??
          opening?.per_scholar_amount ??
          '',
        scholar_ids: filteredScholars.map((s) => s.scholar_id),
      }));
    } catch (err) {
      if (signal?.aborted || requestId !== openingEligibilityRequest.current) return;
      console.error('OPENING ELIGIBILITY LOAD ERROR:', err);
      setEligibilityError(err.message || 'Failed to load opening details.');
      setEligiblePayload({ opening: null, scholars: [] });
    } finally {
      if (!signal?.aborted && requestId === openingEligibilityRequest.current) setEligibilityLoading(false);
    }
  };

  const pageData = batches;
  const total = listMetadata.pagination?.total || 0;
  const totalPages = listMetadata.pagination?.totalPages || 1;
  const inProgressCount = listMetadata.summary?.batches || 0;
  const statusManagerCount = listMetadata.summary?.status || 0;
  const completedCount = listMetadata.summary?.completed || 0;
  const archivedCount = listMetadata.summary?.archived || 0;

  const selectedOpeningDetails = useMemo(() => {
    return (
      (eligiblePayload.opening?.opening_id === form.opening_id ? eligiblePayload.opening : null) ||
      openings.find((o) => o.opening_id === form.opening_id) ||
      null
    );
  }, [openings, form.opening_id, eligiblePayload.opening]);

  const filteredEligibleScholars = useMemo(() => {
    return filterScholarsByOpening(
      eligiblePayload.scholars,
      form.opening_id || selectedOpeningDetails?.opening_id
    );
  }, [eligiblePayload.scholars, form.opening_id, selectedOpeningDetails]);

  const filteredSelectedBatchScholars = useMemo(() => {
    if (!selectedBatch) return [];
    return selectedBatch.scholars || [];
  }, [selectedBatch]);


  const bulkReleaseEligibleEntries = useMemo(
    () =>
      filteredSelectedBatchScholars.filter((entry) =>
        isBulkReleaseEligible(entry.release_status)
      ),
    [filteredSelectedBatchScholars]
  );

  const selectedBulkReleaseEntries = useMemo(() => {
    const selectedIds = new Set(selectedReleaseIds.map(String));
    return bulkReleaseEligibleEntries.filter((entry) =>
      selectedIds.has(String(getEntryId(entry)))
    );
  }, [bulkReleaseEligibleEntries, selectedReleaseIds]);

  const sectionMeta = useMemo(() => {
    const map = {
      batches: {
        title: 'Active Payout Batches',
        subtitle: `${inProgressCount} active batch${inProgressCount !== 1 ? 'es' : ''} still being processed`,
        empty: 'No active payout batches found.',
      },
      status: {
        title: 'Payout Status Manager',
        subtitle: `${statusManagerCount} batch${statusManagerCount !== 1 ? 'es' : ''} with Pending or On Hold scholars`,
        empty: 'No payout batches currently need status updates.',
      },
      completed: {
        title: 'Completed Payouts',
        subtitle: `${completedCount} completed payout batch${completedCount !== 1 ? 'es' : ''}`,
        empty: 'No completed payout batches yet.',
      },
      archived: {
        title: 'Archived Payout Batches',
        subtitle: `${archivedCount} archived payout batch${archivedCount !== 1 ? 'es' : ''}`,
        empty: 'No archived payout batches found.',
      },
    };

    return map[activeSection] || map.batches;
  }, [
    activeSection,
    inProgressCount,
    statusManagerCount,
    completedCount,
    archivedCount,
  ]);

  // toggleScholar: handles toggle scholar for the Payout flow.
  const toggleScholar = (scholarId) => {
    setForm((prev) => {
      const exists = prev.scholar_ids.includes(scholarId);

      return {
        ...prev,
        scholar_ids: exists
          ? prev.scholar_ids.filter((id) => id !== scholarId)
          : [...prev.scholar_ids, scholarId],
      };
    });
  };

  // resetCreateForm: resets reset create form for the Payout flow.
  const resetCreateForm = () => {
    setForm({
      ...EMPTY_FORM,
      payout_date: getManilaDateInputValue(),
      payout_time: '',
    });
    setEligiblePayload({ opening: null, scholars: [] });
  };

  // handleCreatePayoutAnnouncementRedirect: handles handle create payout announcement redirect for the Payout flow.
  const handleCreatePayoutAnnouncementRedirect = () => {
    if (!newPayoutForPrompt) return;

    const amountPerScholar = Number(newPayoutForPrompt.amount_per_scholar || 0);
    const payoutDate = formatPayoutDate(
      newPayoutForPrompt.payout_date || getManilaDateInputValue()
    );

    const openingTitle =
      newPayoutForPrompt.opening_title ||
      newPayoutForPrompt.payout_title ||
      'your scholarship opening';

    const title = `${newPayoutForPrompt.payout_title || 'Scholarship Payout'} Announcement`;

    const content = [
      'Good day, scholars.',
      '',
      `Please be informed that the payout batch for ${openingTitle} has been created.`,
      '',
      `Payout Date: ${payoutDate}`,
      newPayoutForPrompt.payout_time ? `Payout Time: ${formatPayoutTime(newPayoutForPrompt.payout_time)}` : '',
      `Venue: ${newPayoutForPrompt.payout_venue || 'OSFA - Office of Scholarship and Financial Assistance'}`,
      `Payout Mode: ${formatPaymentMode(
        newPayoutForPrompt.payment_mode,
        newPayoutForPrompt.payment_mode_other
      ) || 'Cash'}`,
      amountPerScholar > 0
        ? `Amount per Scholar: ${formatMoney(amountPerScholar)}`
        : '',
      newPayoutForPrompt.scholar_count
        ? `Number of Scholars Included: ${newPayoutForPrompt.scholar_count}`
        : '',
      '',
      'Please wait for further instructions from OSFA regarding the release process.',
    ]
      .filter((line) => line !== '')
      .join('\n');

    const params = new URLSearchParams({
      prefill: 'payout',
      title,
      subject: title,
      content,
      audience: 'scholars',
      target_audience: 'scholars',
      opening_id: newPayoutForPrompt.opening_id || '',
      payout_batch_id: newPayoutForPrompt.payout_batch_id || '',
      program_id: newPayoutForPrompt.program_id || '',
      academic_year_id: newPayoutForPrompt.academic_year_id || '',
      academic_year: newPayoutForPrompt.academic_year || '',
      semester: newPayoutForPrompt.semester || '',
    });

    navigate(`/admin/announcements?${params.toString()}`);
  };

  // handleCreateBatch: handles handle create batch for the Payout flow.
  const handleCreateBatch = async () => {
    if (!canPerformSensitiveAction('payouts.manage')) return;
    try {
      if (!form.opening_id) {
        showPayoutNotice('Please select an opening first.');
        return;
      }

      if (!form.semester) {
        showPayoutNotice('Please select a semester.');
        return;
      }

      if (!form.scholar_ids.length) {
        showPayoutNotice('No scholars selected.');
        return;
      }

      if (!form.payout_date) {
        showPayoutNotice('Please select a payout date.');
        return;
      }

      if (form.payout_date < getManilaDateInputValue()) {
        showPayoutNotice('Payout date cannot be in the past. Please select today or a future date.');
        return;
      }

      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.payout_time || '')) {
        showPayoutNotice('Please select a payout time.');
        return;
      }

      if (!form.payout_venue?.trim()) {
        showPayoutNotice('Please enter a payout venue.');
        return;
      }

      setCreating(true);

      const payload = {
        opening_id: form.opening_id,
        semester: form.semester,
        academic_year_id: form.academic_year_id,
        payout_title: form.payout_title,
        payout_date: form.payout_date,
        payout_time: form.payout_time,
        payout_venue: form.payout_venue.trim(),
        payment_mode: form.payment_mode,
        payment_mode_other: form.payment_mode_other,
        remarks: form.remarks,
        scholar_ids: form.scholar_ids,
      };

      const res = await fetch(`${API_BASE}/payouts`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Failed to create payout batch');
      }

      const createdBatch = data?.data || data || {};

      const payoutForPrompt = {
        ...createdBatch,
        payout_batch_id:
          createdBatch.payout_batch_id ||
          createdBatch.batch_id ||
          createdBatch.id ||
          '',
        opening_id: form.opening_id,
        opening_title:
          selectedOpeningDetails?.opening_title ||
          selectedOpeningDetails?.title ||
          form.payout_title,
        program_id: selectedOpeningDetails?.program_id || createdBatch.program_id || '',
        program_name:
          selectedOpeningDetails?.program_name ||
          createdBatch.program_name ||
          '',
        benefactor_name:
          selectedOpeningDetails?.benefactor_name ||
          createdBatch.benefactor_name ||
          '',
        academic_year_id:
          form.academic_year_id ||
          selectedOpeningDetails?.academic_year_id ||
          createdBatch.academic_year_id ||
          '',
        academic_year:
          form.school_year ||
          selectedOpeningDetails?.academic_year ||
          createdBatch.academic_year ||
          '',
        semester: form.semester,
        payout_title: form.payout_title,
        payout_date: form.payout_date,
        payout_time: form.payout_time,
        payout_venue: form.payout_venue.trim(),
        payment_mode: form.payment_mode,
        payment_mode_other: form.payment_mode_other,
        amount_per_scholar: form.amount_per_scholar,
        scholar_count: form.scholar_ids.length,
      };

      setShowCreateModal(false);
      setNewPayoutForPrompt(payoutForPrompt);
      setPostCreateOpen(true);

      resetCreateForm();

      await loadAll();
      setActiveSection('batches');
    } catch (err) {
      console.error('CREATE PAYOUT BATCH ERROR:', err);
      showPayoutNotice(err.message || 'Failed to create payout batch', 'Payout batch not saved');
    } finally {
      setCreating(false);
    }
  };

  // openStatusUpdate: handles open status update for the Payout flow.
  const openStatusUpdate = (entry, nextStatus) => {
    if (!getEntryId(entry)) {
      showPayoutNotice('Missing payout entry ID.');
      return;
    }

    setStatusCandidate({
      entry,
      nextStatus: normalizeReleaseStatus(nextStatus),
      batch: selectedBatch
        ? {
            payment_mode: selectedBatch.payment_mode,
            payment_mode_other: selectedBatch.payment_mode_other,
          }
        : null,
    });
    setStatusRemarks('');
    setStatusError('');
  };

  // closeStatusUpdate: handles close status update for the Payout flow.
  const closeStatusUpdate = () => {
    if (workingEntryId) return;
    setStatusCandidate(null);
    setStatusRemarks('');
    setStatusError('');
  };

  // requestStatusUpdate: handles request status update for the Payout flow.
  const requestStatusUpdate = async (entry, finalStatus, remarks = '') => {
    const entryId = getEntryId(entry);
    if (!entryId) throw new Error('Missing payout entry ID.');

    const res = await fetch(`${API_BASE}/payouts/entries/${entryId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        release_status: finalStatus,
        status: finalStatus,
        remarks: remarks || null,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        data?.message || data?.error || 'Failed to update payout status'
      );
    }

    return { entryId, data };
  };

  // submitStatusUpdate: handles submit status update for the Payout flow.
  const submitStatusUpdate = async () => {
    if (!canPerformSensitiveAction('payouts.manage')) return;
    const entry = statusCandidate?.entry;
    const entryId = getEntryId(entry);
    const finalStatus = normalizeReleaseStatus(statusCandidate?.nextStatus);
    const remarks = statusRemarks.trim();

    if (!entryId) {
      setStatusError('Missing payout entry ID.');
      return;
    }

    if (finalStatus === 'On Hold' && !remarks) {
      setStatusError('Remarks are required when placing a payout on hold.');
      return;
    }

    try {
      setStatusError('');
      setWorkingEntryId(entryId);
      await requestStatusUpdate(entry, finalStatus, remarks);

      setSelectedBatch((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          scholars: (prev.scholars || []).map((scholar) => {
            const scholarEntryId = getEntryId(scholar);

            return String(scholarEntryId) === String(entryId)
              ? {
                  ...scholar,
                  release_status: finalStatus,
                  remarks: remarks || null,
                }
              : scholar;
          }),
        };
      });

      await loadAll();
      setStatusCandidate(null);
      setStatusRemarks('');
      setStatusError('');

      if (finalStatus === 'Released') {
        toast.success('Payout released successfully.', {
          description: `${entry?.student_name || 'Scholar'} can now upload Proof of Payout.`,
        });
      }
    } catch (err) {
      console.error('UPDATE PAYOUT STATUS ERROR:', err);
      setStatusError(err.message || 'Failed to update payout status');
    } finally {
      setWorkingEntryId(null);
    }
  };

  // openBulkRelease: handles open bulk release for the Payout flow.
  const openBulkRelease = () => {
    if (!selectedBulkReleaseEntries.length) return;
    setBulkReleaseRemarks('');
    setBulkReleaseConfirmed(false);
    setBulkReleaseError('');
    setBulkReleaseOpen(true);
  };

  // closeBulkRelease: handles close bulk release for the Payout flow.
  const closeBulkRelease = () => {
    if (bulkReleaseWorking) return;
    setBulkReleaseOpen(false);
    setBulkReleaseRemarks('');
    setBulkReleaseConfirmed(false);
    setBulkReleaseError('');
  };

  // submitBulkRelease: handles submit bulk release for the Payout flow.
  const submitBulkRelease = async () => {
    if (!canPerformSensitiveAction('payouts.manage')) return;
    const entries = selectedBulkReleaseEntries;
    if (!entries.length) {
      setBulkReleaseError('Select at least one eligible scholar.');
      return;
    }
    if (!bulkReleaseConfirmed) {
      setBulkReleaseError('Confirm that the selected payouts have been released.');
      return;
    }

    const remarks = bulkReleaseRemarks.trim();

    try {
      setBulkReleaseWorking(true);
      setBulkReleaseError('');

      const results = await Promise.allSettled(
        entries.map((entry) => requestStatusUpdate(entry, 'Released', remarks))
      );

      const successfulIds = [];
      const failedEntries = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulIds.push(String(getEntryId(entries[index])));
        } else {
          failedEntries.push({
            entry: entries[index],
            reason: result.reason?.message || 'Failed to release payout',
          });
        }
      });

      if (successfulIds.length) {
        const successfulSet = new Set(successfulIds);
        setSelectedBatch((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            scholars: (prev.scholars || []).map((scholar) =>
              successfulSet.has(String(getEntryId(scholar)))
                ? {
                    ...scholar,
                    release_status: 'Released',
                    remarks: remarks || null,
                  }
                : scholar
            ),
          };
        });
      }

      await loadAll();

      if (!failedEntries.length) {
        toast.success(
          `${successfulIds.length} payout${successfulIds.length === 1 ? '' : 's'} released successfully.`,
          { description: 'Each scholar can now upload Proof of Payout.' }
        );
        setSelectedReleaseIds([]);
        setBulkReleaseOpen(false);
        setBulkReleaseRemarks('');
        setBulkReleaseConfirmed(false);
        setBulkReleaseError('');
        return;
      }

      const failedIds = failedEntries.map(({ entry }) => String(getEntryId(entry)));
      setSelectedReleaseIds(failedIds);
      const failedNames = failedEntries
        .map(({ entry }) => entry?.student_name)
        .filter(Boolean)
        .slice(0, 3)
        .join(', ');

      if (successfulIds.length) {
        toast.warning(
          `${successfulIds.length} of ${entries.length} payouts released.`,
          {
            description: `${failedEntries.length} payout${failedEntries.length === 1 ? '' : 's'} could not be updated${failedNames ? `: ${failedNames}` : '.'}`,
          }
        );
        setBulkReleaseError(
          `${failedEntries.length} payout${failedEntries.length === 1 ? '' : 's'} could not be released. The failed scholar${failedEntries.length === 1 ? ' remains' : 's remain'} selected so you can retry.`
        );
      } else {
        const firstReason = failedEntries[0]?.reason;
        toast.error('Payout release failed.', {
          description: firstReason || 'No selected payouts were updated.',
        });
        setBulkReleaseError(firstReason || 'No selected payouts were updated.');
      }
    } catch (err) {
      console.error('BULK PAYOUT RELEASE ERROR:', err);
      setBulkReleaseError(err.message || 'Failed to release selected payouts');
    } finally {
      setBulkReleaseWorking(false);
    }
  };

  // handleArchiveBatch: handles handle archive batch for the Payout flow.
  const handleArchiveBatch = async (batch) => {
    if (!canPerformSensitiveAction('payouts.manage')) return;
    try {
      if (!batch?.payout_batch_id) return;

      if (!isBatchFinished(batch)) {
        showPayoutNotice(
          'This payout batch is not ready to archive. Resolve every Pending or On Hold scholar first. Final statuses are Released, Absent, or Cancelled.'
        );
        return;
      }

      setArchivingBatchId(batch.payout_batch_id);

      const res = await fetch(`${API_BASE}/payouts/${batch.payout_batch_id}/archive`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Failed to archive payout batch');
      }

      setBatches((previous) =>
        previous.map((item) =>
          String(item?.payout_batch_id) === String(batch.payout_batch_id)
            ? { ...item, is_archived: true, batch_status: 'Archived' }
            : item
        )
      );

      setArchiveCandidate(null);
      setSelectedBatch(null);
      setActiveSection('archived');
      setPage(1);

      await loadAll();
    } catch (err) {
      console.error('ARCHIVE PAYOUT BATCH ERROR:', err);
      showPayoutNotice(err.message || 'Failed to archive payout batch', 'Unable to archive payout');
    } finally {
      setArchivingBatchId(null);
    }
  };

  // handleRestoreBatch: handles handle restore batch for the Payout flow.
  const handleRestoreBatch = async (batch) => {
    if (!canPerformSensitiveAction('payouts.manage')) return;
    try {
      if (!batch?.payout_batch_id) return;

      setRestoringBatchId(batch.payout_batch_id);

      const res = await fetch(`${API_BASE}/payouts/${batch.payout_batch_id}/restore`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Failed to restore payout batch');
      }

      await loadAll();
      setSelectedBatch(null);
      setActiveSection('batches');
    } catch (err) {
      console.error('RESTORE PAYOUT BATCH ERROR:', err);
      showPayoutNotice(err.message || 'Failed to restore payout batch', 'Unable to restore payout');
    } finally {
      setRestoringBatchId(null);
    }
  };

  // renderStatusBadge: handles render status badge for the Payout flow.
  const renderStatusBadge = (status) => {
    const value = normalizeReleaseStatus(status);

    const styles = {
      Released: {
        bg: C.greenSoft,
        color: C.green,
        icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
      },
      Pending: {
        bg: C.orangeSoft,
        color: C.orange,
        icon: <Clock3 className="mr-1 h-3 w-3" />,
      },
      Absent: {
        bg: C.redSoft,
        color: C.red,
        icon: <XCircle className="mr-1 h-3 w-3" />,
      },
      'On Hold': {
        bg: C.blueSoft,
        color: C.blue,
        icon: <CircleSlash className="mr-1 h-3 w-3" />,
      },
      Cancelled: {
        bg: C.slateSoft,
        color: C.slate,
        icon: <XCircle className="mr-1 h-3 w-3" />,
      },
    };

    const current = styles[value] || styles.Pending;

    return (
      <Badge
        className="inline-flex items-center rounded-full border-none text-[11px]"
        style={{ background: current.bg, color: current.color }}
      >
        {current.icon}
        {value}
      </Badge>
    );
  };

  // getStatusActions: reads and returns get status actions for the Payout flow.
  const getStatusActions = (status) => {
    const value = normalizeReleaseStatus(status);

    if (value === 'Released') {
      return [];
    }

    if (value === 'On Hold') {
      return [
        { label: 'Release', status: 'Released', tone: 'green' },
        { label: 'Mark Absent', status: 'Absent', tone: 'red' },
      ];
    }

    if (value === 'Absent') {
      return [
        { label: 'Release', status: 'Released', tone: 'green' },
        { label: 'Put On Hold', status: 'On Hold', tone: 'blue' },
      ];
    }

    if (value === 'Cancelled') {
      return [];
    }

    return [
      { label: 'Release', status: 'Released', tone: 'green' },
      { label: 'Absent', status: 'Absent', tone: 'red' },
      { label: 'On Hold', status: 'On Hold', tone: 'blue' },
    ];
  };

  // getActionButtonClass: reads and returns get action button class for the Payout flow.
  const getActionButtonClass = (tone) => {
    const map = {
      green: 'border-green-200 text-green-700 hover:bg-green-50',
      red: 'border-red-200 text-red-700 hover:bg-red-50',
      blue: 'border-blue-200 text-blue-700 hover:bg-blue-50',
      amber: 'border-orange-200 text-orange-700 hover:bg-orange-50',
      slate: 'border-slate-200 text-slate-700 hover:bg-slate-50',
    };

    return map[tone] || 'border-stone-200 text-stone-700 hover:bg-stone-50';
  };

  // renderBatchCard: handles render batch card for the Payout flow.
  const renderBatchCard = (b) => {
    const counts = getPayoutCounts(b);
    const finished = isBatchFinished(b);
    const manageable = hasManageablePayoutEntries(b);

    return (
      <Card
        key={b.payout_batch_id}
        className="rounded-2xl border-stone-200 bg-white shadow-none transition hover:border-stone-300"
      >
        <CardContent className="p-4">
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-stone-900">
                  {b.payout_title || 'Untitled Payout Batch'}
                </h3>

                <p className="mt-1 text-sm text-stone-500">
                  {formatProgramBenefactor(b.program_name, b.benefactor_name)}
                </p>

                <p className="mt-1 text-xs text-stone-400">
                  {b.school_year || b.academic_year || EM_DASH} {BULLET} {formatPayoutDate(b.payout_date)}{b.payout_time ? ` at ${formatPayoutTime(b.payout_time)}` : ''}
                </p>
                <p className="mt-1 break-words text-xs text-stone-500">Venue: {b.payout_venue || 'OSFA - Office of Scholarship and Financial Assistance'}</p>

                <p className="mt-1 text-xs text-stone-400">
                  Payout Code: <span className="font-semibold text-stone-600">{b.payout_code || EM_DASH}</span>
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Badge
                  className="rounded-full border-none text-[10px]"
                  style={{
                    background: b.payment_mode === 'Cash' ? C.greenSoft : C.blueSoft,
                    color: b.payment_mode === 'Cash' ? C.green : C.blue,
                  }}
                >
                  {formatPaymentMode(b.payment_mode, b.payment_mode_other) || EM_DASH}
                </Badge>

                {b.is_archived ? (
                  <Badge
                    className="rounded-full border-none text-[10px]"
                    style={{ background: C.slateSoft, color: C.slate }}
                  >
                    Archived
                  </Badge>
                ) : finished ? (
                  <Badge
                    className="rounded-full border-none text-[10px]"
                    style={{ background: C.greenSoft, color: C.green }}
                  >
                    Completed
                  </Badge>
                ) : manageable ? (
                  <Badge
                    className="rounded-full border-none text-[10px]"
                    style={{ background: C.orangeSoft, color: C.orange }}
                  >
                    Needs Update
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SmallMetric label="Released" value={counts.released} />
              <SmallMetric label="Pending" value={counts.pending} />
              <SmallMetric label="Absent" value={counts.absent} />
              <SmallMetric label="On Hold" value={counts.onHold} />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
              <span>Total scholars</span>
              <span className="font-semibold text-stone-900">{counts.total}</span>
            </div>

            <div className="flex items-center justify-between border-t border-stone-100 pt-3">
              <div>
                <p className="text-xs text-stone-500">Total Amount</p>
                <p className="text-base font-semibold text-stone-900">
                  {formatMoney(b.total_amount)}
                </p>
              </div>

              <Button
                size="sm"
                className="h-8 rounded-lg px-3 text-xs"
                style={{ background: C.brownMid, color: '#fff' }}
                onClick={() => setSelectedBatch(b)}
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                View Batch
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const noticeModal = (
    <AlertDialog open={Boolean(payoutNotice)} onOpenChange={(open) => {
      if (!open) setPayoutNotice(null);
    }}>
      <AlertDialogContent
        className="z-[110] gap-0 border border-border bg-popover p-0 text-popover-foreground"
        overlayClassName="z-[100] bg-black/25 backdrop-blur-none"
      >
        <AlertDialogHeader className="gap-2 px-5 py-5">
          <AlertDialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Info className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            {payoutNotice?.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{payoutNotice?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-border bg-muted/30 px-5 py-4">
          {payoutNotice?.onConfirm ? <AlertDialogCancel className="h-9 rounded-lg border-border">Cancel</AlertDialogCancel> : null}
          <AlertDialogAction className="h-9 min-w-20 rounded-lg border-none bg-primary px-4 text-primary-foreground hover:bg-primary/90" onClick={() => {
            const onConfirm = payoutNotice?.onConfirm;
            setPayoutNotice(null);
            if (onConfirm) void onConfirm();
          }}>
            {payoutNotice?.confirmLabel || 'OK'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (loading || batchesLoading) {
    return <>{noticeModal}<PageLoadingSkeleton label="Loading payout management" showStats /></>;
  }

  return (
    <div className="dark-mode-route-canvas space-y-4 py-3" style={{ background: C.bg }}>
      {noticeModal}
      <PostPayoutCreatePrompt
        open={postCreateOpen}
        payout={newPayoutForPrompt}
        onClose={() => {
          setPostCreateOpen(false);
          setNewPayoutForPrompt(null);
        }}
        onCreateAnnouncement={handleCreatePayoutAnnouncementRedirect}
      />

      <ArchiveBatchModal
        batch={archiveCandidate}
        open={Boolean(archiveCandidate)}
        working={
          Boolean(archiveCandidate?.payout_batch_id) &&
          archivingBatchId === archiveCandidate?.payout_batch_id
        }
        onCancel={() => {
          if (!archivingBatchId) setArchiveCandidate(null);
        }}
        onConfirm={() => handleArchiveBatch(archiveCandidate)}
      />

      <PayoutStatusModal
        candidate={statusCandidate}
        remarks={statusRemarks}
        error={statusError}
        working={Boolean(workingEntryId)}
        onRemarksChange={(value) => {
          setStatusRemarks(value);
          if (statusError) setStatusError('');
        }}
        onCancel={closeStatusUpdate}
        onConfirm={submitStatusUpdate}
      />

      <BulkReleaseModal
        open={bulkReleaseOpen}
        entries={selectedBulkReleaseEntries}
        batch={selectedBatch}
        remarks={bulkReleaseRemarks}
        confirmed={bulkReleaseConfirmed}
        error={bulkReleaseError}
        working={bulkReleaseWorking}
        onRemarksChange={(value) => {
          setBulkReleaseRemarks(value);
          if (bulkReleaseError) setBulkReleaseError('');
        }}
        onConfirmedChange={(value) => {
          setBulkReleaseConfirmed(value);
          if (bulkReleaseError) setBulkReleaseError('');
        }}
        onCancel={closeBulkRelease}
        onConfirm={submitBulkRelease}
      />

      <PayoutProofReviewPanel />

      <section
        className="rounded-2xl border bg-white p-3 sm:p-4"
        style={{ borderColor: C.line }}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-full flex-wrap rounded-xl bg-stone-100 p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveSection('batches')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeSection === 'batches'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              Active
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('status')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeSection === 'status'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              Status Manager
              {statusManagerCount ? (
                <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {statusManagerCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('completed')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeSection === 'completed'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              Completed
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('archived')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeSection === 'archived'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              Archived
            </button>
          </div>

          <div className="compact-toolbar-row flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative w-full lg:w-[320px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-10"
                placeholder="Search payout title, benefactor, program..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <Button
              style={{ background: C.brownMid }}
              className="h-10 rounded-xl text-white"
              onClick={() => {
                resetCreateForm();
                if (hasPermission('payouts.manage')) setShowCreateModal(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Payout Batch
            </Button>
          </div>
        </div>
      </section>

      <section
        className="overflow-hidden rounded-2xl border bg-white"
        style={{ borderColor: C.line }}
      >
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-stone-800">
            {sectionMeta.title}
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            {sectionMeta.subtitle}
          </p>
        </div>

        <CardContent className="p-4">
          {pageData.length === 0 ? (
            <div className="py-16 text-center text-sm text-stone-400">
              {sectionMeta.empty}
            </div>
          ) : (
            <section className="grid gap-4 2xl:grid-cols-2">
              {pageData.map(renderBatchCard)}
            </section>
          )}
        </CardContent>
      </section>

      <PaginationFooter
        total={total}
        page={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
        onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
      />

      <Dialog open={showCreateModal} onOpenChange={(open) => {
        if (creating) return;
        setShowCreateModal(open);
        if (!open) resetCreateForm();
      }}>
          <DialogContent showCloseButton={false} aria-describedby={undefined} className="payout-create-dialog gap-0 overflow-hidden rounded-xl p-0 sm:rounded-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold text-foreground sm:text-xl">
                  Create Payout Batch
                </DialogTitle>
              </div>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Close payout form"
                title="Close"
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="shrink-0 rounded-lg"
                disabled={creating}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            <div className="payout-create-scroll min-h-0 space-y-4 p-3 sm:space-y-5 sm:p-6">
              <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <Card className="min-w-0 gap-0 border-border py-0 shadow-none">
                  <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Building2 className="h-4 w-4" /></div>
                      <div>
                        <h3 className="font-semibold text-foreground">Opening Source</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Choose the scholarship opening for this payout.</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="payout-opening" className="text-sm font-medium text-foreground">Opening</label>
                      <select id="payout-opening" className="h-11 w-full min-w-0 max-w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={form.opening_id} disabled={creating}
                        onChange={(e) => setForm((prev) => ({ ...prev, opening_id: e.target.value }))}>
                        <option value="">Select an opening</option>
                        {openings.map((o) => <option key={o.opening_id} value={o.opening_id}>{o.opening_title} {EM_DASH} {o.benefactor_name || 'No Benefactor'}</option>)}
                      </select>
                    </div>
                    {eligibilityLoading ? (
                      <div role="status" className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading opening details?</div>
                    ) : eligibilityError ? (
                      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        <p>{eligibilityError}</p>
                        <Button variant="outline" className="mt-3" onClick={() => loadOpeningEligibility(form.opening_id)}>Retry</Button>
                      </div>
                    ) : form.opening_id ? (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">Details from the selected opening</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <ReadOnlyField label="Program" value={selectedOpeningDetails?.program_name || EM_DASH} />
                          <ReadOnlyField label="Benefactor" value={selectedOpeningDetails?.benefactor_name || EM_DASH} />
                          <ReadOnlyField label="Opening Status" value={formatOpeningStatus(selectedOpeningDetails?.status || selectedOpeningDetails?.posting_status)} />
                          <ReadOnlyField label="Amount per Scholar" value={form.amount_per_scholar !== '' ? formatMoney(form.amount_per_scholar) : EM_DASH} />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
                        <p className="text-sm font-medium text-foreground">Start with an opening</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Program details, payout amount, and eligible scholars will appear here automatically.</p>
                        {!openings.length ? <p className="mt-2 text-xs text-muted-foreground">No openings are currently available.</p> : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="min-w-0 gap-0 border-border py-0 shadow-none">
                  <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Wallet className="h-4 w-4" /></div>
                      <div>
                        <h3 className="font-semibold text-foreground">Batch Details</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">Set the payout schedule and release method.</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <ReadOnlyField label="Semester" value={form.semester || 'Select an opening first'} />
                        <ReadOnlyField label="School Year" value={form.school_year || academicYears.find((year) => year.academic_year_id === form.academic_year_id)?.label || 'Select an opening first'} />
                      </div>
                      <p className="text-xs text-muted-foreground">Semester and school year follow the selected opening.</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="payout-title" className="text-sm font-medium text-foreground">Payout Title</label>
                      <Input id="payout-title" className="h-11 min-w-0 max-w-full rounded-lg" required disabled={creating} value={form.payout_title}
                        onChange={(e) => setForm((prev) => ({ ...prev, payout_title: e.target.value }))} placeholder="Example: Kaizen First Semester Payout" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label htmlFor="payout-date" className="text-sm font-medium text-foreground">Payout Date</label>
                        <Input id="payout-date" className="h-11 min-w-0 max-w-full rounded-lg" type="date" min={getManilaDateInputValue()} required disabled={creating}
                          value={form.payout_date} onChange={(e) => setForm((prev) => ({ ...prev, payout_date: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="payout-time" className="text-sm font-medium text-foreground">Payout Time</label>
                        <Input id="payout-time" className="h-11 min-w-0 max-w-full rounded-lg" type="time" required disabled={creating}
                          value={form.payout_time} onChange={(e) => setForm((prev) => ({ ...prev, payout_time: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="payout-mode" className="text-sm font-medium text-foreground">Payout Mode</label>
                      <select id="payout-mode" className="h-11 w-full min-w-0 max-w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={form.payment_mode} disabled={creating} onChange={(e) => setForm((prev) => ({ ...prev, payment_mode: e.target.value, payment_mode_other: e.target.value === 'Other' ? prev.payment_mode_other : '' }))}>
                        <option value="Cash">Cash</option><option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="payout-venue" className="text-sm font-medium text-foreground">Venue</label>
                      <Input id="payout-venue" className="h-11 min-w-0 max-w-full rounded-lg" required maxLength={250} disabled={creating}
                        value={form.payout_venue} onChange={(e) => setForm((prev) => ({ ...prev, payout_venue: e.target.value }))} />
                    </div>
                    {form.payment_mode === 'Other' ? (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground" htmlFor="other-payment-type">Specify Payout Type</label>
                        <Input id="other-payment-type" className="h-11 min-w-0 max-w-full rounded-lg" value={form.payment_mode_other} disabled={creating}
                          onChange={(e) => setForm((prev) => ({ ...prev, payment_mode_other: e.target.value }))} maxLength={60} required placeholder="Example: Check" />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <label htmlFor="payout-remarks" className="text-sm font-medium text-foreground">Remarks <span className="text-muted-foreground">(optional)</span></label>
                      <textarea id="payout-remarks" className="min-h-20 w-full resize-y rounded-lg border border-input bg-background p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                        value={form.remarks} disabled={creating} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} placeholder="Optional notes for the payout batch" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-stone-200 shadow-none">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-stone-500" />
                      <div>
                        <h3 className="font-semibold text-stone-900">
                          Eligible Scholars
                        </h3>
                        <p className="text-sm text-stone-500">
                          Auto-loaded from the selected opening. All are preselected by default.
                        </p>
                      </div>
                    </div>

                    <Badge variant="outline">{form.scholar_ids.length} selected</Badge>
                  </div>

                  <div className="max-h-[320px] overflow-auto rounded-xl border">
                    {filteredEligibleScholars.length === 0 ? (
                      <div className="p-6 text-sm text-stone-400">
                        {eligibilityLoading ? 'Loading eligible scholars?' : eligibilityError ? 'Unable to load scholars. Retry the opening above.' : form.opening_id ? 'No eligible scholars are available for this opening.' : 'Select an opening to load eligible scholars.'}
                      </div>
                    ) : (
                      filteredEligibleScholars.map((s) => {
                        const checked = form.scholar_ids.includes(s.scholar_id);

                        return (
                          <label
                            key={s.scholar_id}
                            className="flex cursor-pointer items-center justify-between gap-3 border-b p-4 hover:bg-stone-50"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleScholar(s.scholar_id)}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-stone-900">
                                  {s.student_name}
                                </p>
                                <p className="text-xs text-stone-500">
                                  {s.pdm_id || EM_DASH} {BULLET} Batch {s.batch_year || EM_DASH}
                                </p>
                              </div>
                            </div>

                            <Badge variant="outline">{s.status}</Badge>
                          </label>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

            </div>
              <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="h-10 w-full rounded-lg sm:w-auto"
                  disabled={creating}
                >
                  Cancel
                </Button>

                <Button
                  style={{ background: C.brownMid }}
                  className="h-10 w-full rounded-lg text-white sm:w-auto"
                  disabled={creating || eligibilityLoading || Boolean(eligibilityError)}
                  onClick={handleCreateBatch}
                >
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save Payout Batch
                </Button>
              </div>
          </DialogContent>
      </Dialog>

      <Dialog open={Boolean(venueEditor)} onOpenChange={(open) => { if (!open && !savingVenue) setVenueEditor(null); }}>
        <DialogContent showCloseButton={false} overlayClassName="z-[110]" className="z-[111] w-[calc(100vw-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-5" aria-describedby={undefined}>
          <form onSubmit={handleSaveVenue} className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <DialogTitle>Change payout venue</DialogTitle>
              <Button type="button" variant="ghost" size="icon" aria-label="Close venue editor" disabled={savingVenue}
                onClick={() => setVenueEditor(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-payout-venue" className="text-sm font-medium">Venue</label>
              <Input id="edit-payout-venue" required maxLength={250} disabled={savingVenue} value={venueEditor?.value || ''}
                onChange={(event) => { setVenueError(''); setVenueEditor((previous) => ({ ...previous, value: event.target.value })); }} />
              {venueError ? <p role="alert" className="text-sm text-destructive">{venueError}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={savingVenue} onClick={() => setVenueEditor(null)}>Cancel</Button>
              <Button type="submit" disabled={savingVenue || !hasPermission('payouts.manage')}>{savingVenue ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save venue</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl border bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-semibold text-stone-900">
                    {selectedBatch.payout_title || 'Payout Batch'}
                  </h2>
                  {selectedBatch.payout_code ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-600"
                    >
                      Payout Code: {selectedBatch.payout_code}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-stone-500">
                  {formatProgramBenefactor(
                    selectedBatch.program_name,
                    selectedBatch.benefactor_name
                  )}{' '}
                  {BULLET}{' '}
                  {formatPayoutDate(selectedBatch.payout_date)}{selectedBatch.payout_time ? ` at ${formatPayoutTime(selectedBatch.payout_time)}` : ''}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-500">
                  <p className="min-w-0 break-words">Venue: {selectedBatch.payout_venue || 'OSFA - Office of Scholarship and Financial Assistance'}</p>
                  {!selectedBatch.is_archived && hasPermission('payouts.manage') ? (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                      setVenueError('');
                      setVenueEditor({ batchId: selectedBatch.payout_batch_id,
                        value: selectedBatch.payout_venue || 'OSFA - Office of Scholarship and Financial Assistance' });
                    }}>Change venue</Button>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!selectedBatch.is_archived ? (
                  <Button
                    variant="outline"
                    className="rounded-xl border-stone-300"
                    disabled={archivingBatchId === selectedBatch.payout_batch_id}
                    onClick={() => {
                      if (!isBatchFinished(selectedBatch)) {
                        handleArchiveBatch(selectedBatch);
                        return;
                      }
                      setArchiveCandidate(selectedBatch);
                    }}
                  >
                    {archivingBatchId === selectedBatch.payout_batch_id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Archive className="mr-2 h-4 w-4" />
                    )}
                    Archive Batch
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="rounded-xl border-stone-300"
                    disabled={restoringBatchId === selectedBatch.payout_batch_id}
                    onClick={() => setPayoutNotice({
                      title: 'Restore payout batch',
                      message: `Restore "${selectedBatch.payout_title || 'this payout batch'}" to active payout records?`,
                      confirmLabel: 'Restore batch',
                      onConfirm: () => handleRestoreBatch(selectedBatch),
                    })}
                  >
                    {restoringBatchId === selectedBatch.payout_batch_id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                    )}
                    Unarchive Batch
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedBatch(null);
                    setSelectedReleaseIds([]);
                  }}
                  className="rounded-xl"
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {(() => {
                  const counts = getPayoutCounts(selectedBatch);

                  return (
                    <>
                      <SmallMetric label="Released" value={counts.released} />
                      <SmallMetric label="Pending" value={counts.pending} />
                      <SmallMetric label="Absent" value={counts.absent} />
                      <SmallMetric label="On Hold" value={counts.onHold} />
                      <SmallMetric label="Cancelled" value={counts.cancelled} />
                    </>
                  );
                })()}
              </div>

              {!selectedBatch.is_archived && bulkReleaseEligibleEntries.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-stone-700">
                    <input
                      type="checkbox"
                      checked={
                        bulkReleaseEligibleEntries.length > 0 &&
                        selectedBulkReleaseEntries.length === bulkReleaseEligibleEntries.length
                      }
                      onChange={(event) => {
                        setSelectedReleaseIds(
                          event.target.checked
                            ? bulkReleaseEligibleEntries.map((entry) => String(getEntryId(entry)))
                            : []
                        );
                      }}
                      disabled={bulkReleaseWorking}
                    />
                    Select all eligible ({bulkReleaseEligibleEntries.length})
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedBulkReleaseEntries.length > 0 ? (
                      <span className="text-xs font-semibold text-stone-600">
                        {selectedBulkReleaseEntries.length} selected
                      </span>
                    ) : null}
                    {selectedBulkReleaseEntries.length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-lg text-xs"
                        disabled={bulkReleaseWorking}
                        onClick={() => setSelectedReleaseIds([])}
                      >
                        Clear
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 rounded-lg text-xs text-white"
                      style={{ background: C.brownMid }}
                      disabled={selectedBulkReleaseEntries.length === 0 || bulkReleaseWorking}
                      onClick={openBulkRelease}
                    >
                      Release Selected
                    </Button>
                  </div>
                </div>
              ) : null}

              {filteredSelectedBatchScholars.length === 0 ? (
                <Card className="border-stone-200 shadow-none">
                  <CardContent className="p-6 text-sm text-stone-400">
                    No scholars found in this payout batch for the selected opening.
                  </CardContent>
                </Card>
              ) : (
                filteredSelectedBatchScholars.map((entry) => {
                  const entryId = getEntryId(entry);
                  const status = normalizeReleaseStatus(entry.release_status);
                  const actions = getStatusActions(status);
                  const isWorking = String(workingEntryId) === String(entryId);
                  const isLocked = selectedBatch?.is_archived === true;

                  return (
                    <Card
                      key={entryId || entry.scholar_id || entry.student_id}
                      className="border-stone-200 shadow-none"
                    >
                      <CardContent className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 p-4 lg:grid-cols-[auto_minmax(0,1fr)_110px_auto]">
                        <input
                          type="checkbox"
                          className="self-center"
                          checked={selectedReleaseIds.includes(String(entryId))}
                          disabled={
                            isLocked ||
                            bulkReleaseWorking ||
                            !isBulkReleaseEligible(status)
                          }
                          aria-label={`Select ${entry.student_name || 'scholar'} for payout release`}
                          onChange={(event) => {
                            const id = String(entryId);
                            setSelectedReleaseIds((previous) =>
                              event.target.checked
                                ? previous.includes(id)
                                  ? previous
                                  : [...previous, id]
                                : previous.filter((value) => value !== id)
                            );
                          }}
                        />

                        <div className="min-w-0">
                          <ScholarIdentity
                            scholar={entry}
                            name={entry.student_name}
                            studentNumber={`${entry.pdm_id || EM_DASH} ${BULLET} ${formatMoney(entry.amount_received)}`}
                            compact
                          />

                          <div className="mt-2 flex flex-wrap gap-2">
                            {entry.payment_mode ? (
                              <Badge variant="outline">
                                {formatPaymentMode(
                                  entry.payment_mode,
                                  entry.payment_mode_other
                                )}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="col-start-2 justify-self-start lg:col-start-3">
                          {renderStatusBadge(status)}
                        </div>

                        <div className="col-span-2 flex flex-wrap justify-end gap-2 lg:col-span-1 lg:col-start-4">
                          {status === 'Released' ? (
                            <span className="text-xs font-medium text-stone-500">
                              Status already marked as Released
                            </span>
                          ) : status === 'Cancelled' ? (
                            <span className="text-xs font-medium text-stone-500">
                              Status already marked as Cancelled
                            </span>
                          ) : isLocked ? (
                            <span className="text-xs font-medium text-stone-500">
                              Archived batch cannot be edited
                            </span>
                          ) : (
                            actions.map((action) => (
                              <Button
                                key={`${entryId}-${action.status}`}
                                size="sm"
                                variant="outline"
                                className={`h-8 rounded-lg text-xs ${getActionButtonClass(action.tone)}`}
                                disabled={isWorking || bulkReleaseWorking}
                                onClick={() => openStatusUpdate(entry, action.status)}
                              >
                                {isWorking ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                {action.label}
                              </Button>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
