import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
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
} from 'lucide-react';
import { buildApiUrl } from '@/api';

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
};

const PAGE_SIZE = 10;

const APP_STATUS = {
    pending: { label: 'Pending', bg: '#f5f5f4', color: '#57534e' },
    submitted: { label: 'Submitted', bg: '#f5f5f4', color: '#57534e' },
    review: { label: 'Under Review', bg: C.blueSoft, color: C.blueMid },
    qualified: { label: 'Approved', bg: C.greenSoft, color: C.green },
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
    return ['approved', 'qualified', 'accepted'].includes(raw) || !!app?.is_scholar;
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

function buildApplicantState(app, openingFilled) {
    const normalizedStatus = normalizeAppStatus(app.application_status || 'pending');
    const isApproved = isApprovedCandidate(app);
    const isDisqualified = !!app.disqualified || normalizedStatus === 'disqualified';
    const verificationStatus = String(app.verification_status || '').toLowerCase();
    const isInReviewStage = ['review', 'submitted', 'pending'].includes(normalizedStatus);
    const isVerified = verificationStatus === 'verified';
    const hasRemarks = !!app.remarks;

    const canApprove =
        !isApproved &&
        !isDisqualified &&
        isInReviewStage &&
        isVerified &&
        hasRemarks &&
        !openingFilled;

    let decisionHint = '';
    if (!isApproved && !canApprove) {
        decisionHint = openingFilled
            ? 'Filled / closed.'
            : !isInReviewStage
                ? 'Move to review.'
                : !isVerified
                    ? 'Verify docs first.'
                    : !hasRemarks
                        ? 'Add remarks first.'
                        : 'Not ready.';
    }

    return {
        normalizedStatus,
        isApproved,
        isDisqualified,
        isInReviewStage,
        isVerified,
        hasRemarks,
        canApprove,
        decisionHint,
        appMeta: getAppStatusMeta(normalizedStatus),
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
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
                <thead className="bg-stone-50">
                    <tr className="border-b border-stone-200">
                        {viewMode === VIEW_MODES.current && (
                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                                <input
                                    type="checkbox"
                                    checked={allVisibleSelected}
                                    onChange={onToggleAllVisible}
                                    className="accent-stone-700"
                                />
                            </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Applicant
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Student No.
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Submitted
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Application
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            GWA
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Remarks
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">
                            Actions
                        </th>
                    </tr>
                </thead>

                <tbody>
                    {pageData.map((app) => {
                        const state = buildApplicantState(app, openingFilled);

                        return (
                            <tr
                                key={app.id}
                                className={`border-b border-stone-100 align-top transition hover:bg-stone-50 ${state.isDisqualified ? 'bg-red-50/20' : ''
                                    }`}
                            >
                                {viewMode === VIEW_MODES.current && (
                                    <td className="px-4 py-4">
                                        {!state.isApproved && (
                                            <input
                                                type="checkbox"
                                                checked={selected.has(app.id)}
                                                onChange={() => onToggleSelect(app.id)}
                                                className="accent-stone-700"
                                            />
                                        )}
                                    </td>
                                )}

                                <td className="px-4 py-4">
                                    <div className="max-w-[220px]">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-stone-900">{app.name}</p>

                                            {state.isApproved && (
                                                <Badge className="border-green-100 bg-green-50 text-[10px] font-medium text-green-700">
                                                    Got Slot
                                                </Badge>
                                            )}

                                            {state.isDisqualified && (
                                                <Badge className="border-red-100 bg-red-50 text-[10px] font-medium text-red-600">
                                                    Rejected
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </td>

                                <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-stone-500">
                                    {app.student_number || '—'}
                                </td>

                                <td className="px-4 py-4 whitespace-nowrap text-sm text-stone-500">
                                    {formatDate(app.submission_date)}
                                </td>

                                <td className="px-4 py-4">
                                    <StatusPill meta={state.appMeta} />
                                </td>

                                <td className="px-4 py-4">
                                    <StatusPill meta={state.gwaMeta} />
                                </td>

                                <td className="px-4 py-4 text-sm text-stone-500">
                                    {state.hasRemarks ? (
                                        <span className="inline-flex items-center gap-1 text-blue-600">
                                            <MessageSquare className="h-3 w-3" />
                                            Has Remarks
                                        </span>
                                    ) : (
                                        '—'
                                    )}
                                </td>

                                <td className="px-4 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        {!state.isApproved && (
                                            <Button
                                                size="sm"
                                                onClick={() => onReviewDocuments(app.id)}
                                                className="h-8 rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-600 shadow-none hover:bg-stone-50"
                                            >
                                                <FileSearch className="mr-1 h-3 w-3" />
                                                Documents
                                            </Button>
                                        )}

                                        {!state.isApproved && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onOpenRemarks(app)}
                                                className="h-8 rounded-lg border-stone-200 px-3 text-xs text-stone-600 shadow-none hover:bg-stone-50"
                                            >
                                                <MessageSquare className="mr-1 h-3 w-3" />
                                                Remarks
                                            </Button>
                                        )}

                                        {!state.isApproved && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={!state.canApprove || decisionLoading === app.id}
                                                onClick={() => onApprove(app.id)}
                                                className="h-8 rounded-lg border-green-100 px-3 text-xs text-green-700 shadow-none hover:bg-green-50 disabled:opacity-40"
                                            >
                                                {decisionLoading === app.id ? (
                                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                ) : (
                                                    <ShieldCheck className="mr-1 h-3 w-3" />
                                                )}
                                                Approve
                                            </Button>
                                        )}

                                        {!state.isApproved && !state.isDisqualified && (
                                            <Button
                                                size="sm"
                                                onClick={() => onDisqualify(app)}
                                                className="h-8 w-8 rounded-lg border border-red-100 bg-white p-0 text-red-500 shadow-none hover:bg-red-50"
                                            >
                                                <UserMinus className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>

                                    {!state.isApproved && !state.canApprove && (
                                        <p className="mt-2 text-[11px] text-stone-400 text-right">
                                            {state.decisionHint}
                                        </p>
                                    )}
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

    const [opening, setOpening] = useState(null);
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tableLoading, setTableLoading] = useState(false);
    const [error, setError] = useState(null);

    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState(VIEW_MODES.current);

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

            const token = localStorage.getItem('adminToken');

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

    const approvedCount = useMemo(
        () => apps.filter((a) => isApprovedCandidate(a)).length,
        [apps]
    );

    const currentCount = useMemo(
        () => apps.filter((a) => !isApprovedCandidate(a)).length,
        [apps]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const normalizedQ = q.replace(/[^a-z0-9]/g, '');

        return apps
            .filter((a) => {
                const approved = isApprovedCandidate(a);
                return viewMode === VIEW_MODES.current ? !approved : approved;
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
            });
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
    const openingFilledCount = Number(opening?.qualified_count ?? opening?.filled_slots ?? 0);
    const remainingSlots = Math.max(0, openingSlotCount - openingFilledCount);

    const openingFilled =
        remainingSlots <= 0 ||
        ['filled', 'closed'].includes(
            String(opening?.status || opening?.posting_status || '').toLowerCase()
        );

    const allVisibleSelected = useMemo(
        () => pageData.length > 0 && pageData.every((a) => selected.has(a.id) || isApprovedCandidate(a)),
        [pageData, selected]
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
                pageData.forEach((a) => next.delete(a.id));
            } else {
                pageData.forEach((a) => {
                    if (!isApprovedCandidate(a)) next.add(a.id);
                });
            }

            return next;
        });
    };

    const handleDisqualify = async (id, reason) => {
        try {
            const res = await fetch(buildApiUrl(`/api/applications/${id}/disqualify`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
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
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
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
                            application_status: 'qualified',
                            is_reconsideration_candidate: false,
                            is_scholar: true,
                        }
                        : a
                )
            );

            await reloadApplications({ soft: true });
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

            const res = await fetch(buildApiUrl(`/api/applications/${remarksModal.id}/remarks`), {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
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
                    Loading opening applicants...
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

            <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/admin/applications')}
                            className="rounded-xl border-stone-200 text-xs text-stone-600"
                        >
                            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                            Back
                        </Button>
                    </div>

                    {openingFilled && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                            <CircleOff className="h-3.5 w-3.5" />
                            Opening Filled / Closed
                        </span>
                    )}
                </div>

                <section className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                            <h1 className="truncate text-xl font-semibold text-stone-900">
                                {opening?.title || opening?.opening_title || 'Untitled Opening'}
                            </h1>

                            <p className="mt-1 text-sm text-stone-500">
                                {opening?.program_name || 'No Program'}
                                {opening?.benefactor_name ? ` · ${opening.benefactor_name}` : ''}
                            </p>

                            {openingMetaLine ? (
                                <div className="mt-2 inline-flex items-center gap-1 text-xs text-stone-500">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    {openingMetaLine}
                                </div>
                            ) : null}
                        </div>

                        <div className="grid min-w-[260px] grid-cols-3 gap-2">
                            <div className="rounded-lg bg-stone-50 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-stone-500">Slots</p>
                                <p className="mt-0.5 text-base font-semibold text-stone-900">{openingSlotCount}</p>
                            </div>
                            <div className="rounded-lg bg-stone-50 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-stone-500">Filled</p>
                                <p className="mt-0.5 text-base font-semibold text-stone-900">{openingFilledCount}</p>
                            </div>
                            <div className="rounded-lg bg-stone-50 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-wide text-stone-500">Remaining</p>
                                <p className="mt-0.5 text-base font-semibold text-stone-900">{remainingSlots}</p>
                            </div>
                        </div>
                    </div>
                </section>
            </section>

            <section
                className="rounded-2xl border bg-white p-3 sm:p-4"
                style={{ borderColor: C.border }}
            >
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative w-full xl:max-w-xl">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                        <Input
                            placeholder="Search by student name or PDM ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-10 text-sm shadow-none focus-visible:ring-1"
                        />
                    </div>

                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                        <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 sm:w-auto">
                            <button
                                onClick={() => setViewMode(VIEW_MODES.current)}
                                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${viewMode === VIEW_MODES.current
                                    ? 'bg-white text-stone-900 shadow-sm'
                                    : 'text-stone-600'
                                    }`}
                            >
                                Applicants
                                <span className="text-xs">{currentCount}</span>
                            </button>

                            <button
                                onClick={() => setViewMode(VIEW_MODES.approved)}
                                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${viewMode === VIEW_MODES.approved
                                    ? 'bg-white text-stone-900 shadow-sm'
                                    : 'text-stone-600'
                                    }`}
                            >
                                Approved
                                <span className="text-xs">{approvedCount}</span>
                            </button>
                        </div>

                        {search && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setSearch('');
                                    setPage(1);
                                }}
                                className="h-10 rounded-xl border-stone-200 text-xs"
                            >
                                Reset
                            </Button>
                        )}
                    </div>
                </div>
            </section>

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
                                    ? 'Applicants under this selected scholarship opening'
                                    : 'Applicants already approved and assigned to a slot'}
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

                    {selected.size > 0 && viewMode === VIEW_MODES.current && !openingFilled && (
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
                                    Approve All
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
        </div>
    );
}