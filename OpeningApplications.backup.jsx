import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    UserMinus,
    CheckCircle2,
    AlertCircle,
    Loader2,
    X,
    ShieldCheck,
    FileSearch,
    MessageSquare,
    ArrowLeft,
    CalendarDays,
    CircleOff,
    ListOrdered,
    Trophy,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import FinalSelectionPanel from '@/components/selection/FinalSelectionPanel';

const C = {
    green: '#16a34a',
    greenSoft: '#F0FDF4',
    red: '#dc2626',
    redSoft: '#FEF2F2',
    blueMid: '#2563EB',
    blueSoft: '#EFF6FF',
    bg: '#f8f6f2',
    border: '#e7e5e4',
};

const VIEW_MODES = {
    current: 'current',
    approved: 'approved',
    finalSelection: 'final-selection',
};

const PAGE_SIZE = 10;

const APP_STATUS = {
    pending: { label: 'Pending', bg: '#f5f5f4', color: '#57534e' },
    submitted: { label: 'Submitted', bg: '#f5f5f4', color: '#57534e' },
    review: { label: 'Under Review', bg: C.blueSoft, color: C.blueMid },
    qualified: { label: 'Qualified', bg: C.greenSoft, color: C.green },
    approved: { label: 'Approved', bg: C.greenSoft, color: C.green },
    accepted: { label: 'Approved', bg: C.greenSoft, color: C.green },
    disqualified: { label: 'Rejected', bg: '#fee2e2', color: '#991b1b' },
    rejected: { label: 'Rejected', bg: '#fee2e2', color: '#991b1b' },
    declined: { label: 'Rejected', bg: '#fee2e2', color: '#991b1b' },
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

function normalizeAppStatus(status) {
    return String(status || '').trim().toLowerCase();
}

function isApprovedCandidate(app) {
    const raw = normalizeAppStatus(app?.application_status);
    const selection = normalizeAppStatus(app?.selection_status);
    return ['approved', 'accepted'].includes(raw) || ['selected', 'promoted'].includes(selection) || !!app?.is_scholar;
}

function getAppStatusMeta(status) {
    return APP_STATUS[normalizeAppStatus(status)] || APP_STATUS.pending;
}

function getGwaMeta(gwa) {
    const numeric = Number(gwa);

    if (!Number.isFinite(numeric)) {
        return { label: 'No GWA', bg: '#f5f5f4', color: '#78716c' };
    }

    if (numeric <= 2.0) {
        return { label: `Eligible · ${numeric}`, bg: C.greenSoft, color: C.green };
    }

    return { label: `Above Cutoff · ${numeric}`, bg: C.redSoft, color: C.red };
}

function getRequirementsMeta(app = {}) {
    const verification = normalizeAppStatus(app.verification_status);
    const documentStatus = normalizeAppStatus(app.document_status);
    const completed = Boolean(app.requirements_completed_at);

    if (verification === 'verified') {
        return {
            label: 'Verified',
            detail: completed
                ? `Completed ${formatDate(app.requirements_completed_at)}`
                : 'Requirements verified',
            bg: C.greenSoft,
            color: C.green,
        };
    }

    if (verification === 'rejected') {
        return {
            label: 'Rejected',
            detail: 'Correction or re-upload required',
            bg: C.redSoft,
            color: C.red,
        };
    }

    if (
        ['documents ready', 'under review'].includes(documentStatus) ||
        completed
    ) {
        return {
            label: documentStatus === 'documents ready'
                ? 'Documents Ready'
                : 'Under Review',
            detail: completed
                ? `Completed ${formatDate(app.requirements_completed_at)}`
                : 'Awaiting verification',
            bg: '#FFF7ED',
            color: '#d97706',
        };
    }

    return {
        label: 'Incomplete',
        detail: 'Required documents are still missing',
        bg: '#f5f5f4',
        color: '#78716c',
    };
}

function getEndorsementMeta(app = {}) {
    const status = normalizeAppStatus(
        app.endorsement_status ||
        app.normalized_endorsement_status ||
        app.endorsement_overall_status
    );

    if (status === 'completed') {
        return {
            label: 'Complete',
            detail: 'Endorsement cleared',
            bg: C.greenSoft,
            color: C.green,
        };
    }

    if (['rejected', 'major_offense', 'disqualified_major'].includes(status)) {
        return {
            label: 'Blocked',
            detail: 'Endorsement requires action',
            bg: C.redSoft,
            color: C.red,
        };
    }

    const stage = String(
        app.endorsement_current_stage ||
        app.current_stage ||
        ''
    ).replaceAll('_', ' ').trim();

    return {
        label: 'Pending',
        detail: stage ? `Current stage: ${stage}` : 'Endorsement is not complete',
        bg: '#FFF7ED',
        color: '#d97706',
    };
}

function getSelectionMeta(app = {}) {
    const selection = String(app.selection_status || '').trim();
    const normalized = normalizeAppStatus(selection);

    if (['selected', 'promoted'].includes(normalized)) {
        return { label: selection || 'Selected', bg: C.greenSoft, color: C.green };
    }
    if (normalized === 'waitlisted') {
        const position = Number(app.waitlist_position);
        return {
            label: position > 0 ? `Waiting #${position}` : 'Waitlisted',
            bg: '#FFF7ED',
            color: '#d97706',
        };
    }
    if (normalized === 'qualified') {
        return { label: 'Qualified', bg: C.blueSoft, color: C.blueMid };
    }
    if (normalized === 'not selected') {
        return { label: 'Not Selected', bg: '#f5f5f4', color: '#57534e' };
    }

    return getAppStatusMeta(app.application_status);
}

function formatDate(value) {
    if (!value) return 'No date';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'No date';

    return d.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function toTimestamp(value, fallback = Number.MAX_SAFE_INTEGER) {
    if (!value) return fallback;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? fallback : parsed;
}

function compareFcfs(a, b) {
    const queueA = Number(a?.queue_position);
    const queueB = Number(b?.queue_position);
    const hasQueueA = Number.isFinite(queueA) && queueA > 0;
    const hasQueueB = Number.isFinite(queueB) && queueB > 0;

    if (hasQueueA && hasQueueB && queueA !== queueB) {
        return queueA - queueB;
    }
    if (hasQueueA !== hasQueueB) {
        return hasQueueA ? -1 : 1;
    }

    const completedDifference =
        toTimestamp(a?.requirements_completed_at) -
        toTimestamp(b?.requirements_completed_at);

    if (completedDifference !== 0) return completedDifference;

    const submittedDifference =
        toTimestamp(a?.submission_date) -
        toTimestamp(b?.submission_date);

    if (submittedDifference !== 0) return submittedDifference;

    return String(a?.id || a?.application_id || '').localeCompare(
        String(b?.id || b?.application_id || '')
    );
}

function getFcfsRank(app, fallbackIndex = null) {
    const queuePosition = Number(app?.queue_position);
    if (Number.isFinite(queuePosition) && queuePosition > 0) {
        return queuePosition;
    }
    return fallbackIndex;
}

function buildApplicantState(app) {
    const normalizedStatus = normalizeAppStatus(app.application_status || 'pending');
    const selectionStatus = normalizeAppStatus(app.selection_status);
    const isApproved = isApprovedCandidate(app);
    const isQualified = selectionStatus === 'qualified';
    const isDisqualified =
        !!app.disqualified ||
        !!app.is_disqualified ||
        ['disqualified', 'rejected'].includes(normalizedStatus);
    const verificationStatus = normalizeAppStatus(app.verification_status);
    const endorsementStatus = normalizeAppStatus(
        app.endorsement_status || app.normalized_endorsement_status
    );
    const isInReviewStage = ['review', 'submitted', 'pending', 'pending review'].includes(
        normalizedStatus
    );
    const isVerified = verificationStatus === 'verified';
    const isEndorsementComplete = endorsementStatus === 'completed';
    const hasRemarks = String(app.remarks || '').trim().length > 0;

    const canApprove =
        !isApproved &&
        !isQualified &&
        !isDisqualified &&
        isInReviewStage &&
        isVerified &&
        isEndorsementComplete &&
        hasRemarks;

    let decisionHint = '';
    if (!isApproved && !isQualified && !canApprove) {
        decisionHint = !isInReviewStage
            ? 'Move to review.'
            : !isVerified
                ? 'Verify requirements first.'
                : !isEndorsementComplete
                    ? 'Complete endorsement first.'
                    : !hasRemarks
                        ? 'Add remarks first.'
                        : 'Not ready.';
    }

    const displayedStatus = isQualified ? 'qualified' : normalizedStatus;

    return {
        normalizedStatus,
        selectionStatus,
        isApproved,
        isQualified,
        isDisqualified,
        isInReviewStage,
        isVerified,
        isEndorsementComplete,
        hasRemarks,
        canApprove,
        decisionHint,
        appMeta: getAppStatusMeta(displayedStatus),
        gwaMeta: getGwaMeta(app.gwa),
    };
}

function StatusPill({ meta }) {
    return (
        <span
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium whitespace-nowrap"
            style={{ background: meta.bg, color: meta.color }}
        >
            {meta.label}
        </span>
    );
}

async function parseErrorResponse(res, fallbackMessage) {
    try {
        const contentType = res.headers.get('content-type') || '';

        if (contentType.includes('application/json')) {
            const payload = await res.json();
            return payload?.message || payload?.error || fallbackMessage;
        }

        const text = await res.text();
        return text || fallbackMessage;
    } catch {
        return fallbackMessage;
    }
}

function DisqModal({ app, onDisqualify, onClose }) {
    const [reason, setReason] = useState('');

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-md overflow-hidden border-stone-200 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-5 py-3.5">
                    <div>
                        <h3 className="text-sm font-semibold text-red-700">Disqualification Record</h3>
                        <p className="mt-0.5 text-xs text-stone-500">
                            {app?.name} · {app?.student_number}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-100"
                    >
                        <X size={15} />
                    </button>
                </div>

                <CardContent className="space-y-3 p-4">
                    <p className="text-xs text-stone-500">Select a disqualification reason:</p>

                    {DISQ_REASONS.map((r) => (
                        <button
                            key={r}
                            onClick={() => setReason(r)}
                            className={`w-full rounded-lg border px-3.5 py-2.5 text-left text-xs font-medium transition-all ${reason === r
                                ? 'border-red-600 bg-red-600 text-white'
                                : 'border-stone-200 bg-white text-stone-600 hover:border-red-200 hover:bg-red-50'
                                }`}
                        >
                            {r}
                        </button>
                    ))}

                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="h-9 flex-1 rounded-lg border-stone-200 text-xs"
                        >
                            Cancel
                        </Button>

                        <Button
                            disabled={!reason}
                            onClick={() => {
                                onDisqualify(app.id, reason);
                                onClose();
                            }}
                            className="h-9 flex-1 rounded-lg border-none text-xs text-white disabled:opacity-40"
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

function RemarksModal({ app, value, onChange, onSave, onClose, saving }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-lg overflow-hidden border-stone-200 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-3.5">
                    <div>
                        <h3 className="text-sm font-semibold text-stone-800">Reviewer Remarks</h3>
                        <p className="mt-0.5 text-xs text-stone-500">
                            {app?.name} · {app?.student_number}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100"
                    >
                        <X size={15} />
                    </button>
                </div>

                <CardContent className="space-y-3 p-4">
                    <Textarea
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="Enter admin-side reviewer remarks..."
                        className="min-h-[120px] resize-none rounded-lg border-stone-200 bg-white text-sm"
                    />

                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="h-9 rounded-lg border-stone-200 text-xs"
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={onSave}
                            disabled={saving}
                            className="h-9 rounded-lg border-none text-xs text-white"
                            style={{ background: C.blueMid }}
                        >
                            {saving ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Save Remarks
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function ApplicantTable({
    pageData,
    openingFilled,
    decisionLoading,
    selected,
    viewMode,
    allVisibleSelected,
    onToggleSelect,
    onToggleAllVisible,
    onReviewDocuments,
    onOpenRemarks,
    onApprove,
    onDisqualify,
    fcfsOrder,
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px]">
                <thead className="bg-stone-50">
                    <tr className="border-b border-stone-200">
                        {viewMode === VIEW_MODES.current ? (
                            <th className="w-10 px-3 py-3 text-left">
                                <input
                                    type="checkbox"
                                    checked={allVisibleSelected}
                                    onChange={onToggleAllVisible}
                                    className="accent-stone-700"
                                    aria-label="Select all eligible applicants on this page"
                                />
                            </th>
                        ) : null}
                        <th className="w-20 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            FCFS
                        </th>
                        <th className="min-w-[220px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Applicant
                        </th>
                        <th className="min-w-[170px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Application Timeline
                        </th>
                        <th className="min-w-[190px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Requirements
                        </th>
                        <th className="min-w-[180px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Endorsement
                        </th>
                        <th className="min-w-[130px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Eligibility
                        </th>
                        <th className="min-w-[150px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Selection
                        </th>
                        <th className="min-w-[290px] px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Review Actions
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {pageData.map((app) => {
                        const state = buildApplicantState(app);
                        const requirementsMeta = getRequirementsMeta(app);
                        const endorsementMeta = getEndorsementMeta(app);
                        const selectionMeta = getSelectionMeta(app);
                        const rank = getFcfsRank(
                            app,
                            fcfsOrder.get(app.id) || null
                        );
                        const isRanked =
                            Boolean(app.requirements_completed_at) ||
                            Number(app.queue_position) > 0;

                        return (
                            <tr
                                key={app.id}
                                className={`border-b border-stone-100 align-top transition hover:bg-stone-50 ${
                                    state.isDisqualified ? 'bg-red-50/20' : ''
                                }`}
                            >
                                {viewMode === VIEW_MODES.current ? (
                                    <td className="px-3 py-4">
                                        {!state.isApproved && !state.isQualified ? (
                                            <input
                                                type="checkbox"
                                                checked={selected.has(app.id)}
                                                onChange={() => onToggleSelect(app.id)}
                                                disabled={!state.canApprove}
                                                className="accent-stone-700 disabled:opacity-40"
                                                aria-label={`Select ${app.name}`}
                                            />
                                        ) : null}
                                    </td>
                                ) : null}

                                <td className="px-3 py-4">
                                    {isRanked ? (
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-800">
                                                #{rank}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-stone-400">
                                            Not ranked
                                        </span>
                                    )}
                                </td>

                                <td className="px-3 py-4">
                                    <div className="max-w-[240px]">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-stone-900">
                                                {app.name || 'Unnamed Applicant'}
                                            </p>
                                            {state.isDisqualified ? (
                                                <Badge className="border-red-100 bg-red-50 text-[10px] font-medium text-red-600">
                                                    Rejected
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 font-mono text-xs text-stone-500">
                                            {app.student_number || 'No PDM ID'}
                                        </p>
                                        {app.course_code || app.year_level ? (
                                            <p className="mt-1 text-xs text-stone-400">
                                                {[app.course_code || app.course_name, app.year_level ? `Year ${app.year_level}` : null]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </p>
                                        ) : null}
                                    </div>
                                </td>

                                <td className="px-3 py-4">
                                    <p className="text-xs font-medium text-stone-700">
                                        Applied {formatDate(app.submission_date)}
                                    </p>
                                    <p className="mt-1 text-xs text-stone-400">
                                        {app.requirements_completed_at
                                            ? `Requirements completed ${formatDate(app.requirements_completed_at)}`
                                            : 'Requirements completion not recorded'}
                                    </p>
                                </td>

                                <td className="px-3 py-4">
                                    <StatusPill meta={requirementsMeta} />
                                    <p className="mt-1.5 max-w-[190px] text-xs leading-5 text-stone-400">
                                        {requirementsMeta.detail}
                                    </p>
                                </td>

                                <td className="px-3 py-4">
                                    <StatusPill meta={endorsementMeta} />
                                    <p className="mt-1.5 max-w-[180px] text-xs leading-5 text-stone-400">
                                        {endorsementMeta.detail}
                                    </p>
                                </td>

                                <td className="px-3 py-4">
                                    <StatusPill meta={state.gwaMeta} />
                                    <p className="mt-1.5 text-xs text-stone-400">
                                        Based on recorded GWA
                                    </p>
                                </td>

                                <td className="px-3 py-4">
                                    <StatusPill meta={selectionMeta} />
                                    {state.hasRemarks ? (
                                        <button
                                            type="button"
                                            onClick={() => onOpenRemarks(app)}
                                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                                        >
                                            <MessageSquare className="h-3 w-3" />
                                            View remarks
                                        </button>
                                    ) : (
                                        <p className="mt-1.5 text-xs text-stone-400">
                                            No reviewer remarks
                                        </p>
                                    )}
                                </td>

                                <td className="px-3 py-4 text-right">
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <Button
                                            size="sm"
                                            onClick={() => onReviewDocuments(app.id)}
                                            className="h-8 rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-600 shadow-none hover:bg-stone-50"
                                        >
                                            <FileSearch className="mr-1 h-3 w-3" />
                                            Review
                                        </Button>

                                        {!state.isApproved ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onOpenRemarks(app)}
                                                className="h-8 rounded-lg border-stone-200 px-3 text-xs text-stone-600 shadow-none hover:bg-stone-50"
                                            >
                                                <MessageSquare className="mr-1 h-3 w-3" />
                                                Remarks
                                            </Button>
                                        ) : null}

                                        {!state.isApproved && !state.isQualified ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                    !state.canApprove ||
                                                    decisionLoading === app.id ||
                                                    openingFilled
                                                }
                                                onClick={() => onApprove(app.id)}
                                                className="h-8 rounded-lg border-green-100 px-3 text-xs text-green-700 shadow-none hover:bg-green-50 disabled:opacity-40"
                                            >
                                                {decisionLoading === app.id ? (
                                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                ) : (
                                                    <ShieldCheck className="mr-1 h-3 w-3" />
                                                )}
                                                Qualify
                                            </Button>
                                        ) : null}

                                        {!state.isApproved && !state.isDisqualified ? (
                                            <Button
                                                size="sm"
                                                onClick={() => onDisqualify(app)}
                                                className="h-8 rounded-lg border border-red-100 bg-white px-3 text-xs text-red-600 shadow-none hover:bg-red-50"
                                            >
                                                <UserMinus className="mr-1 h-3 w-3" />
                                                Reject
                                            </Button>
                                        ) : null}
                                    </div>

                                    {!state.isApproved &&
                                    !state.isQualified &&
                                    !state.canApprove ? (
                                        <p className="mt-2 text-right text-[11px] text-stone-400">
                                            {openingFilled
                                                ? 'No available slot for direct qualification.'
                                                : state.decisionHint}
                                        </p>
                                    ) : null}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default function OpeningApplications() {
    const navigate = useNavigate();
    const { openingId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();

    const [opening, setOpening] = useState(null);
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);
    const [error, setError] = useState(null);

    const [search, setSearch] = useState('');
    const initialView = searchParams.get('view') === VIEW_MODES.finalSelection
        ? VIEW_MODES.finalSelection
        : VIEW_MODES.current;
    const [viewMode, setViewMode] = useState(initialView);

    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(new Set());

    const [disqApp, setDisqApp] = useState(null);
    const [remarksModal, setRemarksModal] = useState(null);
    const [remarksText, setRemarksText] = useState('');
    const [remarksSaving, setRemarksSaving] = useState(false);
    const [decisionLoading, setDecisionLoading] = useState(null);

    const reloadApplications = async ({ soft = false } = {}) => {
        try {
            if (soft) {
                setTableLoading(true);
            } else {
                setLoading(true);
                setError(null);
            }

            const token = sessionStorage.getItem('adminToken');

            const [openingRes, applicationsRes] = await Promise.all([
                fetch(buildApiUrl(`/api/program-openings/${openingId}`), {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }),
                fetch(buildApiUrl(`/api/program-openings/${openingId}/applications`), {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }),
            ]);

            if (!openingRes.ok) {
                const message = await parseErrorResponse(openingRes, 'Failed to fetch opening details');
                throw new Error(message);
            }

            if (!applicationsRes.ok) {
                const message = await parseErrorResponse(applicationsRes, 'Failed to fetch opening applicants');
                throw new Error(message);
            }

            const openingData = await openingRes.json();
            const applicationData = await applicationsRes.json();

            setOpening(openingData || null);
            setApps(Array.isArray(applicationData) ? applicationData : []);
        } catch (err) {
            console.error('OPENING APPLICATIONS FETCH ERROR:', err);
            setError(err.message || 'Failed to load opening applications');
        } finally {
            setLoading(false);
            setTableLoading(false);
        }
    };

    useEffect(() => {
        reloadApplications();
    }, [openingId]);

    useSocketEvent('application:updated', () => {
        reloadApplications({ soft: true });
    }, [openingId]);

    useSocketEvent('application:approved', () => {
        reloadApplications({ soft: true });
    }, [openingId]);

    useSocketEvent('application:rejected', () => {
        reloadApplications({ soft: true });
    }, [openingId]);

    const approvedCount = useMemo(
        () => apps.filter((a) => isApprovedCandidate(a)).length,
        [apps]
    );

    const currentCount = useMemo(
        () => apps.filter((a) => !isApprovedCandidate(a)).length,
        [apps]
    );

    const fcfsSortedApplicants = useMemo(
        () =>
            apps
                .filter(
                    (app) =>
                        app.requirements_completed_at ||
                        Number(app.queue_position) > 0
                )
                .sort(compareFcfs),
        [apps]
    );

    const fcfsOrder = useMemo(() => {
        const order = new Map();
        fcfsSortedApplicants.forEach((app, index) => {
            order.set(app.id, getFcfsRank(app, index + 1));
        });
        return order;
    }, [fcfsSortedApplicants]);

    const nextFcfsApplicant = fcfsSortedApplicants.find(
        (app) => !isApprovedCandidate(app)
    ) || null;

    const changeViewMode = (nextView) => {
        setViewMode(nextView);
        setPage(1);
        setSelected(new Set());

        const nextParams = new URLSearchParams(searchParams);
        if (nextView === VIEW_MODES.finalSelection) {
            nextParams.set('view', VIEW_MODES.finalSelection);
        } else {
            nextParams.delete('view');
        }
        setSearchParams(nextParams, { replace: true });
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const normalizedQ = q.replace(/[^a-z0-9]/g, '');

        return apps
            .filter((a) => {
                const approved = isApprovedCandidate(a);
                return viewMode === VIEW_MODES.current ? !approved : viewMode === VIEW_MODES.approved ? approved : true;
            })
            .filter((a) => {
                if (!q) return true;

                const fullName = String(a.name || '').toLowerCase();
                const studentNumber = String(a.student_number || '').toLowerCase();
                const normalizedStudentNumber = studentNumber.replace(/[^a-z0-9]/g, '');
                const appId = String(a.id || '').toLowerCase();
                const nameParts = fullName.replace(',', ' ').split(/\s+/).filter(Boolean);

                return (
                    fullName.startsWith(q) ||
                    nameParts.some((part) => part.startsWith(q)) ||
                    studentNumber.startsWith(q) ||
                    normalizedStudentNumber.startsWith(normalizedQ) ||
                    appId.startsWith(q)
                );
            })
            .sort(viewMode === VIEW_MODES.current ? compareFcfs : compareFcfs);
    }, [apps, search, viewMode]);

    useEffect(() => {
        setPage(1);
        setSelected(new Set());
    }, [search, viewMode]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

    const pageData = useMemo(
        () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        [filtered, page]
    );

    const openingSlotCount = Number(opening?.allocated_slots ?? opening?.slot_count ?? 0);
    const openingFilledCount = Number(opening?.filled_slots ?? 0);
    const remainingSlots = Math.max(0, openingSlotCount - openingFilledCount);

    const openingFilled =
        remainingSlots <= 0 ||
        ['filled', 'closed'].includes(
            String(opening?.status || opening?.posting_status || '').toLowerCase()
        );

    const selectablePageData = useMemo(
        () => pageData.filter((application) => buildApplicantState(application).canApprove),
        [pageData]
    );

    const allVisibleSelected = useMemo(
        () =>
            selectablePageData.length > 0 &&
            selectablePageData.every((application) => selected.has(application.id)),
        [selectablePageData, selected]
    );

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
                selectablePageData.forEach((application) => next.delete(application.id));
            } else {
                selectablePageData.forEach((application) => next.add(application.id));
            }

            return next;
        });
    };

    const handleDisqualify = async (id, reason) => {
        try {
            const res = await fetch(buildApiUrl(`/api/applications/${id}/disqualify`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reason,
                    is_reconsideration_candidate: false,
                }),
            });

            if (!res.ok) {
                const message = await parseErrorResponse(res, 'Failed to disqualify application');
                throw new Error(message);
            }

            setApps((prev) =>
                prev.map((a) =>
                    a.id === id
                        ? {
                            ...a,
                            disqualified: true,
                            disqReason: reason,
                            application_status: 'disqualified',
                            is_reconsideration_candidate: false,
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

            if (action !== 'approve') {
                throw new Error('Unsupported action');
            }

            const res = await fetch(buildApiUrl(`/api/applications/${id}/approve`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                const message = await parseErrorResponse(res, `Failed to ${action} application`);
                throw new Error(message);
            }

            setApps((prev) =>
                prev.map((a) =>
                    a.id === id
                        ? {
                            ...a,
                            selection_status: 'Qualified',
                            is_reconsideration_candidate: false,
                            is_scholar: false,
                        }
                        : a
                )
            );

            await reloadApplications({ soft: true });
        } catch (err) {
            console.error('APPLICATION DECISION ERROR:', err);
            alert(err.message || 'Failed to update applicant qualification');
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

            const res = await fetch(buildApiUrl(`/api/applications/${remarksModal.id}/remarks`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ remarks: remarksText }),
            });

            if (!res.ok) {
                const message = await parseErrorResponse(res, 'Failed to save remarks');
                throw new Error(message);
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
        for (const id of ids) {
            await handleDecision(id, 'approve');
        }

        setSelected(new Set());
    };

    const openingMetaLine = [opening?.semester, opening?.academic_year].filter(Boolean).join(' · ');

    if (loading) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-stone-300" />
                <p className="text-xs uppercase tracking-widest text-stone-400">
                    Loading scholarship applicants...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center">
                <AlertCircle className="mx-auto mb-3 h-7 w-7 text-red-400" />
                <p className="text-sm font-semibold text-red-800">Failed to load applicants</p>
                <p className="mt-1 text-xs text-red-600">{error}</p>
                <Button
                    onClick={() => reloadApplications()}
                    variant="outline"
                    size="sm"
                    className="mt-4 border-red-200 text-xs text-red-600"
                >
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4 px-1 py-3" style={{ background: C.bg }}>
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

            <section
                className="overflow-hidden rounded-2xl border bg-white"
                style={{ borderColor: C.border }}
            >
                <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => navigate('/admin/applications')}
                            className="h-9 w-9 shrink-0 rounded-xl border-stone-200 text-stone-600"
                            title="Back to Applications"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-lg font-semibold text-stone-900">
                                    {opening?.program_name || opening?.title || opening?.opening_title || 'Scholarship Program'}
                                </h1>
                                {openingFilled && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                                        <CircleOff className="h-3 w-3" />
                                        Closed / Filled
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 truncate text-xs text-stone-500">
                                {opening?.opening_title || 'Application period'}
                                {opening?.benefactor_name ? ` · ${opening.benefactor_name}` : ''}
                                {openingMetaLine ? ` · ${openingMetaLine}` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
                        <div className="rounded-xl bg-stone-50 px-3 py-2.5">
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-stone-400">Slots</p>
                            <p className="mt-0.5 text-base font-semibold text-stone-900">
                                {openingFilledCount}/{openingSlotCount}
                            </p>
                        </div>
                        <div className="rounded-xl bg-amber-50 px-3 py-2.5">
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-amber-700">FCFS Queue</p>
                            <p className="mt-0.5 text-base font-semibold text-stone-900">
                                {fcfsSortedApplicants.length}
                            </p>
                        </div>
                        <div className="min-w-0 rounded-xl bg-stone-50 px-3 py-2.5">
                            <p className="text-[9px] font-semibold uppercase tracking-wide text-stone-400">Next in Line</p>
                            <p className="mt-0.5 truncate text-sm font-semibold text-stone-900">
                                {nextFcfsApplicant?.name || 'None'}
                            </p>
                        </div>
                        <Button
                            className="h-full min-h-[54px] rounded-xl border-none text-xs font-semibold text-white"
                            style={{ background: C.green }}
                            onClick={() => changeViewMode(VIEW_MODES.finalSelection)}
                        >
                            <Trophy className="mr-1.5 h-4 w-4" />
                            Review & Finalize
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-stone-100 p-3 lg:flex-row lg:items-center lg:justify-between">
                    {viewMode !== VIEW_MODES.finalSelection ? (
                        <div className="relative w-full lg:max-w-lg">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                            <Input
                                placeholder="Search applicant or PDM ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 rounded-xl border-stone-200 bg-stone-50 pl-10 text-sm shadow-none focus-visible:ring-1"
                            />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-xs text-stone-500">
                            <ListOrdered className="h-4 w-4 text-amber-700" />
                            Ranked by requirements completion time; submission time is used only as a tie-breaker.
                        </div>
                    )}

                    <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 lg:w-auto">
                        <button
                            onClick={() => changeViewMode(VIEW_MODES.current)}
                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition lg:flex-none ${viewMode === VIEW_MODES.current
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-600'
                                }`}
                        >
                            Applicants <span>{currentCount}</span>
                        </button>
                        <button
                            onClick={() => changeViewMode(VIEW_MODES.approved)}
                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition lg:flex-none ${viewMode === VIEW_MODES.approved
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-600'
                                }`}
                        >
                            Approved <span>{approvedCount}</span>
                        </button>
                        <button
                            onClick={() => changeViewMode(VIEW_MODES.finalSelection)}
                            className={`inline-flex flex-1 items-center justify-center rounded-lg px-4 py-2 text-xs font-medium transition lg:flex-none ${viewMode === VIEW_MODES.finalSelection
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-600'
                                }`}
                        >
                            Final Selection
                        </button>
                    </div>
                </div>
            </section>

            {viewMode === VIEW_MODES.finalSelection ? (
                <FinalSelectionPanel
                    openingId={openingId}
                    onFinalized={() => reloadApplications({ soft: true })}
                />
            ) : (
            <section
                className="overflow-hidden rounded-2xl border bg-white"
                style={{ borderColor: C.border }}
            >
                <div className="border-b border-stone-100 px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h2 className="text-sm font-semibold text-stone-800">Applicant Registry</h2>
                            <p className="mt-1 text-xs text-stone-500">
                                {viewMode === VIEW_MODES.current
                                    ? 'Applicants under this scholarship'
                                    : 'Applicants activated after final selection'}
                                {' · '}
                                Table view
                            </p>
                        </div>

                        {viewMode === VIEW_MODES.current && (
                            <label className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-600">
                                <input
                                    type="checkbox"
                                    checked={allVisibleSelected}
                                    onChange={toggleAllVisible}
                                    className="accent-stone-700"
                                />
                                Select all on page
                            </label>
                        )}
                    </div>

                    {selected.size > 0 && viewMode === VIEW_MODES.current && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
                            <span className="text-xs font-medium text-amber-700">
                                {selected.size} selected
                            </span>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    className="h-8 rounded-lg border-none text-xs text-white"
                                    style={{ background: C.green }}
                                    onClick={handleBulkApprove}
                                >
                                    Mark Qualified
                                </Button>

                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setSelected(new Set())}
                                    className="h-8 rounded-lg border-stone-200 text-xs"
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <CardContent className="p-4">
                    {tableLoading ? (
                        <div className="py-12 text-center text-sm text-stone-400">
                            <div className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Refreshing records...
                            </div>
                        </div>
                    ) : pageData.length === 0 ? (
                        <div className="py-12 text-center text-sm text-stone-400">
                            No applications match the current view.
                        </div>
                    ) : (
                        <ApplicantTable
                            pageData={pageData}
                            openingFilled={openingFilled}
                            decisionLoading={decisionLoading}
                            selected={selected}
                            viewMode={viewMode}
                            allVisibleSelected={allVisibleSelected}
                            onToggleSelect={toggleOne}
                            onToggleAllVisible={toggleAllVisible}
                            onReviewDocuments={(id) => navigate(`/admin/applications/${id}/documents`)}
                            onOpenRemarks={handleOpenRemarks}
                            onApprove={(id) => handleDecision(id, 'approve')}
                            onDisqualify={setDisqApp}
                            fcfsOrder={fcfsOrder}
                        />
                    )}
                </CardContent>

                <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/70 px-5 py-3">
                    <span className="text-xs text-stone-400">
                        Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
                        {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                    </span>

                    <div className="flex items-center gap-1.5">
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 rounded-lg border-stone-200 p-0"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>

                        <span className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium">
                            {page} / {totalPages}
                        </span>

                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 rounded-lg border-stone-200 p-0"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </section>
            )}
        </div>
    );
}
