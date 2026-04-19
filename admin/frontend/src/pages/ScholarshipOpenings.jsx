import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Search,
    Loader2,
    CalendarDays,
    FolderOpen,
    Pencil,
    Archive,
    ArchiveRestore,
    X,
    CheckCircle2,
    Clock3,
    Sparkles,
    Megaphone,
    Layers3,
    EyeOff,
    RefreshCw,
    Users,
    Lock,
    Unlock,
    LayoutGrid,
    Table2,
} from 'lucide-react';
import { buildApiUrl } from '@/api';

const C = {
    brownMid: '#7c4a2e',
    green: '#16a34a',
    greenSoft: '#F0FDF4',
    amber: '#d97706',
    amberSoft: '#FFF7ED',
    red: '#dc2626',
    redSoft: '#FEF2F2',
    blueMid: '#2563EB',
    blueSoft: '#EFF6FF',
    bg: '#faf7f2',
    line: '#e7e5e4',
};

const STATUS_META = {
    draft: { label: 'Draft', color: C.amber, bg: C.amberSoft },
    open: { label: 'Open', color: C.green, bg: C.greenSoft },
    closed: { label: 'Closed', color: C.red, bg: C.redSoft },
    archived: { label: 'Archived', color: '#57534e', bg: '#f5f5f4' },
};

function fmtMoney(v) {
    const n = Number(v || 0);
    return `₱${n.toLocaleString()}`;
}

function normalizeAudience(value) {
    if (!value) return '';
    const raw = String(value).trim();

    if (raw === 'Applicants') return 'Applicants';
    if (raw === 'Scholars') return 'Scholars';
    if (
        raw === 'Both' ||
        raw === 'Applicants,Scholars' ||
        raw === 'Scholars,Applicants'
    ) {
        return 'Both';
    }

    return raw;
}

function deriveTargetAudience(source) {
    const normalized = normalizeAudience(source?.target_audience);
    if (normalized) return normalized;

    const joined = [
        source?.program_name,
        source?.benefactor_name,
        source?.opening_title,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    const isTES = /\btes\b|tertiary education subsidy/.test(joined);
    return isTES ? 'Both' : 'Applicants';
}

function targetAudienceLabel(value) {
    const normalized = normalizeAudience(value);

    if (normalized === 'Both') return 'Scholars & Applicants';
    if (normalized === 'Applicants') return 'Applicants';
    if (normalized === 'Scholars') return 'Scholars';
    return normalized || 'Applicants';
}

function getFilledSlots(openingLike = {}) {
    return Number(
        openingLike.qualified_count ??
        openingLike.filled_slots ??
        openingLike.filled_slots_preview ??
        0
    );
}

function getAllocatedSlots(openingLike = {}) {
    return Number(openingLike.allocated_slots || 0);
}

function getAvailableSlots(openingLike = {}) {
    return Math.max(0, getAllocatedSlots(openingLike) - getFilledSlots(openingLike));
}

function getComputedDisplayStatus(openingLike = {}) {
    const rawStatus = String(openingLike.posting_status || 'draft').toLowerCase();
    const isArchived = !!openingLike.is_archived;

    if (isArchived || rawStatus === 'archived') return 'archived';
    if (rawStatus === 'closed') return 'closed';
    if (rawStatus === 'draft') return 'draft';
    return 'open';
}

function derivePersistedOpeningStatus(payload, existingStatus = '') {
    const normalizedExisting = String(existingStatus || '').toLowerCase();

    if (normalizedExisting === 'archived') return 'archived';
    if (normalizedExisting === 'closed') return 'closed';
    if (normalizedExisting === 'draft') return 'draft';

    const hasRequiredFields =
        !!payload.opening_title &&
        !!payload.program_id &&
        !!payload.academic_year_id &&
        Number(payload.allocated_slots || 0) > 0;

    if (!hasRequiredFields) return 'draft';
    return 'open';
}

function canOpeningBeOpened(openingLike = {}) {
    return (
        !!String(openingLike.opening_title || '').trim() &&
        !!String(openingLike.program_id || '').trim() &&
        !!String(openingLike.academic_year_id || '').trim() &&
        Number(openingLike.allocated_slots || 0) > 0
    );
}

function MiniStat({ label, value, icon: Icon, soft, accent }) {
    return (
        <div
            className="rounded-xl border bg-white px-4 py-3"
            style={{ borderColor: C.line }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] font-medium text-stone-500">{label}</p>
                    <p className="mt-0.5 text-xl font-semibold text-stone-900">{value}</p>
                </div>

                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: soft }}
                >
                    <Icon className="h-4 w-4" style={{ color: accent }} />
                </div>
            </div>
        </div>
    );
}

function EmptyState({ icon: Icon, title, subtitle }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
            <Icon size={40} className="mb-3 text-stone-300" />
            <p className="text-sm font-semibold text-stone-700">{title}</p>
            <p className="mt-1 text-xs text-stone-400">{subtitle}</p>
        </div>
    );
}

function OpeningModal({
    open,
    mode,
    form,
    setForm,
    template,
    academicYears,
    onClose,
    onSave,
    saving,
}) {
    if (!open) return null;

    const isEdit = mode === 'edit';
    const title = isEdit ? 'Edit Scholarship Opening' : 'Create Scholarship Opening';
    const previewStatus = getComputedDisplayStatus({
        ...form,
        posting_status: derivePersistedOpeningStatus(form, form.posting_status),
    });

    const allocatedSlots = Number(form.allocated_slots) || 0;
    const totalFinancial = Number(form.financial_allocation) || 0;
    const perScholarFinancial =
        allocatedSlots > 0 && totalFinancial > 0
            ? Math.floor(totalFinancial / allocatedSlots)
            : 0;

    const audienceLabel = targetAudienceLabel(form.target_audience);
    const selectedAcademicYear =
        academicYears.find((y) => y.academic_year_id === form.academic_year_id) || null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border-stone-200 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">{title}</h3>
                        <p className="mt-0.5 text-xs text-stone-500">
                            Configure the opening details, slots, and financial allocation.
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-5">
                    {template && (
                        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                            <div className="flex items-start gap-3">
                                <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                                    style={{ background: C.blueSoft }}
                                >
                                    <Layers3 className="h-4 w-4" style={{ color: C.blueMid }} />
                                </div>

                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-stone-800">
                                            {template.program_name || 'Untitled Program'}
                                        </p>

                                        <Badge variant="outline" className="border-stone-200 bg-white text-[10px] text-stone-600">
                                            {template.benefactor_name || 'No Organization'}
                                        </Badge>

                                        <Badge
                                            variant="outline"
                                            className="border-purple-200 bg-purple-50 text-[10px] text-purple-700"
                                        >
                                            <Users className="mr-1 h-3 w-3" />
                                            {audienceLabel}
                                        </Badge>

                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] ${previewStatus === 'open'
                                                ? 'border-green-200 bg-green-50 text-green-700'
                                                : previewStatus === 'closed'
                                                    ? 'border-red-200 bg-red-50 text-red-700'
                                                    : previewStatus === 'draft'
                                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                        : 'border-stone-200 bg-white text-stone-600'
                                                }`}
                                        >
                                            {STATUS_META[previewStatus]?.label || 'Draft'}
                                        </Badge>
                                    </div>

                                    <p className="mt-1 text-xs text-stone-500">
                                        {template.description || 'No default description set.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Opening Title
                                </label>
                                <Input
                                    value={form.opening_title}
                                    onChange={(e) => setForm((prev) => ({ ...prev, opening_title: e.target.value }))}
                                    placeholder="e.g. Kaizen Scholarship Opening 2026-2027"
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Academic Year
                                </label>
                                <Select
                                    value={form.academic_year_id}
                                    onValueChange={(value) => {
                                        const selected = academicYears.find((y) => y.academic_year_id === value);
                                        setForm((prev) => ({
                                            ...prev,
                                            academic_year_id: value,
                                            academic_year: selected?.label || '',
                                        }));
                                    }}
                                >
                                    <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                                        <SelectValue placeholder="Select academic year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {academicYears.length === 0 ? (
                                            <SelectItem value="NO_YEAR" disabled>
                                                No academic years available
                                            </SelectItem>
                                        ) : (
                                            academicYears.map((year) => (
                                                <SelectItem key={year.academic_year_id} value={year.academic_year_id}>
                                                    {year.label}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Selected School Year
                                </label>
                                <Input
                                    value={selectedAcademicYear?.label || form.academic_year || ''}
                                    readOnly
                                    className="h-10 rounded-lg border-stone-200 bg-stone-100 text-sm font-medium"
                                    style={{ color: C.brownMid }}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Target Audience
                                </label>
                                <Input
                                    value={audienceLabel}
                                    readOnly
                                    className="h-10 rounded-lg border-stone-200 bg-stone-100 text-sm font-medium"
                                    style={{ color: C.brownMid }}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Allocated Slots
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={form.allocated_slots}
                                    onChange={(e) => setForm((prev) => ({ ...prev, allocated_slots: e.target.value }))}
                                    placeholder="0"
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Total Financial Allocation (₱)
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={form.financial_allocation}
                                    onChange={(e) => setForm((prev) => ({ ...prev, financial_allocation: e.target.value }))}
                                    placeholder="0"
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Per Scholar Amount (₱)
                                </label>
                                <Input
                                    type="number"
                                    readOnly
                                    value={perScholarFinancial}
                                    className="h-10 rounded-lg border-stone-200 bg-stone-100 text-sm font-medium"
                                    style={{ color: C.brownMid }}
                                />
                            </div>

                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                                <p className="text-xs text-emerald-700">
                                    <span className="font-semibold">Allocated Slots:</span> {allocatedSlots}
                                    {' · '}
                                    <span className="font-semibold">Per Scholar:</span> ₱{perScholarFinancial.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                            Opening Notes
                        </label>
                        <Textarea
                            value={form.announcement_text}
                            onChange={(e) => setForm((prev) => ({ ...prev, announcement_text: e.target.value }))}
                            placeholder="Instructions, reminders, notes, or conditions..."
                            className="min-h-[120px] resize-none rounded-lg border-stone-200 text-sm"
                        />
                    </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="h-9 rounded-lg border-stone-200 text-xs"
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={onSave}
                        disabled={
                            saving ||
                            !form.opening_title ||
                            !form.academic_year_id ||
                            !form.program_id
                        }
                        className="h-9 rounded-lg border-none text-xs text-white disabled:opacity-50"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isEdit ? 'Save Changes' : 'Create Opening'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

function PostCreatePrompt({ open, opening, onClose, onCreateAnnouncement }) {
    if (!open || !opening) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-md overflow-hidden border-stone-200 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="border-b border-stone-100 bg-stone-50 px-5 py-4">
                    <h3 className="text-base font-semibold text-stone-800">Opening Created</h3>
                    <p className="mt-0.5 text-xs text-stone-500">
                        {opening.opening_title || 'Scholarship opening created successfully.'}
                    </p>
                </div>

                <CardContent className="space-y-4 p-5">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-sm font-medium text-stone-800">
                            Do you want to create an announcement for this opening now?
                        </p>
                        <p className="mt-1 text-xs text-stone-500">
                            This will redirect you to the announcements page with prefilled content.
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

function TemplateCard({ template, onOpen }) {
    return (
        <Card className="rounded-2xl border-stone-200 bg-white shadow-none transition hover:border-stone-300">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-stone-900">
                                {template.program_name || 'Untitled Program'}
                            </h3>

                            <Badge variant="outline" className="border-stone-200 bg-white text-[10px] text-stone-600">
                                {template.benefactor_name || 'No Organization'}
                            </Badge>

                            <Badge
                                variant="outline"
                                className="border-purple-200 bg-purple-50 text-[10px] text-purple-700"
                            >
                                <Users className="mr-1 h-3 w-3" />
                                {targetAudienceLabel(template.target_audience || deriveTargetAudience(template))}
                            </Badge>
                        </div>

                        <p className="mt-2 text-xs leading-relaxed text-stone-500">
                            {template.description || 'No description available.'}
                        </p>
                    </div>

                    <Button
                        size="sm"
                        className="h-8 shrink-0 rounded-lg border-none px-3 text-xs text-white"
                        style={{ background: C.brownMid }}
                        onClick={() => onOpen(template)}
                    >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Open
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function OpeningCard({
    opening,
    actionLoadingId,
    openEditModal,
    handleUnarchiveOpening,
    handleOpenDraftOpening,
    handleMoveToDraft,
    handleCloseOpening,
    handleReopenOpening,
    handleArchiveOpening,
}) {
    const computedStatus = getComputedDisplayStatus(opening);
    const meta = STATUS_META[computedStatus] || STATUS_META.draft;
    const audience = normalizeAudience(opening.target_audience) || 'Applicants';
    const audienceLabelValue = targetAudienceLabel(audience);

    const allocatedSlots = getAllocatedSlots(opening);
    const filledSlots = getFilledSlots(opening);
    const availableSlots = getAvailableSlots(opening);

    const isArchived = computedStatus === 'archived';
    const isClosed = computedStatus === 'closed';
    const isDraft = computedStatus === 'draft';
    const canBeOpened = canOpeningBeOpened(opening);
    const canReopen = isClosed && availableSlots > 0;
    const canMoveToDraft = !isArchived && !isDraft && filledSlots === 0;
    const isBusy = actionLoadingId === opening.opening_id;

    const perScholar =
        opening.per_scholar_amount ??
        (allocatedSlots > 0
            ? Math.floor(Number(opening.financial_allocation || 0) / allocatedSlots)
            : 0);

    return (
        <Card className="rounded-2xl border-stone-200 bg-white shadow-none transition hover:border-stone-300">
            <CardContent className="p-4">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold text-stone-900">
                                    {opening.opening_title || 'Untitled Opening'}
                                </h3>

                                <span
                                    className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                                    style={{ color: meta.color, background: meta.bg }}
                                >
                                    {meta.label}
                                </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-stone-200 bg-white text-[10px] text-stone-600">
                                    {opening.program_name || 'No Program'}
                                </Badge>

                                <Badge
                                    variant="outline"
                                    className={`text-[10px] ${audience === 'Both'
                                        ? 'border-purple-200 bg-purple-50 text-purple-700'
                                        : audience === 'Scholars'
                                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                            : 'border-sky-200 bg-sky-50 text-sky-700'
                                        }`}
                                >
                                    <Users className="mr-1 h-3 w-3" />
                                    {audienceLabelValue}
                                </Badge>
                            </div>

                            <p className="mt-2 text-xs text-stone-500">
                                {opening.benefactor_name || 'No Benefactor'}
                            </p>

                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <div className="rounded-lg bg-stone-50 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-stone-500">AY</p>
                                    <p className="mt-0.5 text-xs font-semibold text-stone-900">{opening.academic_year || 'N/A'}</p>
                                </div>
                                <div className="rounded-lg bg-stone-50 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-stone-500">Slots</p>
                                    <p className="mt-0.5 text-xs font-semibold text-stone-900">{allocatedSlots}</p>
                                </div>
                                <div className="rounded-lg bg-stone-50 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-stone-500">Filled</p>
                                    <p className="mt-0.5 text-xs font-semibold text-stone-900">{filledSlots}</p>
                                </div>
                                <div className="rounded-lg bg-stone-50 px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-stone-500">Per Scholar</p>
                                    <p className="mt-0.5 text-xs font-semibold text-stone-900">{fmtMoney(perScholar)}</p>
                                </div>
                            </div>

                            {opening.announcement_text && (
                                <details className="mt-3 text-xs">
                                    <summary className="cursor-pointer text-stone-500 hover:text-stone-700">
                                        View notes
                                    </summary>
                                    <p className="mt-1 leading-relaxed text-stone-600">
                                        {opening.announcement_text}
                                    </p>
                                </details>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
                            {isArchived && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUnarchiveOpening(opening)}
                                    className="h-7 rounded-md border-green-200 px-2 text-[11px] text-green-700 hover:bg-green-50"
                                    disabled={isBusy}
                                >
                                    {isBusy ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    Unarchive
                                </Button>
                            )}

                            {!isArchived && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEditModal(opening)}
                                    className="h-7 rounded-md border-stone-200 px-2 text-[11px]"
                                    disabled={isBusy}
                                >
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                    Edit
                                </Button>
                            )}

                            {!isArchived && isDraft && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenDraftOpening(opening)}
                                    className="h-7 rounded-md border-green-200 px-2 text-[11px] text-green-700 hover:bg-green-50"
                                    disabled={isBusy || !canBeOpened}
                                >
                                    {isBusy ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Unlock className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    Open
                                </Button>
                            )}

                            {canMoveToDraft && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMoveToDraft(opening)}
                                    className="h-7 rounded-md border-amber-200 px-2 text-[11px] text-amber-700 hover:bg-amber-50"
                                    disabled={isBusy}
                                >
                                    {isBusy ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Clock3 className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    Draft
                                </Button>
                            )}

                            {!isArchived && !isClosed && !isDraft && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCloseOpening(opening.opening_id)}
                                    className="h-7 rounded-md border-amber-200 px-2 text-[11px] text-amber-700 hover:bg-amber-50"
                                    disabled={isBusy}
                                >
                                    {isBusy ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Lock className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    Close
                                </Button>
                            )}

                            {!isArchived && isClosed && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReopenOpening(opening)}
                                    className="h-7 rounded-md border-green-200 px-2 text-[11px] text-green-700 hover:bg-green-50"
                                    disabled={isBusy || !canReopen}
                                >
                                    {isBusy ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Unlock className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    Reopen
                                </Button>
                            )}

                            {!isArchived && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleArchiveOpening(opening.opening_id)}
                                    className="h-7 rounded-md border-red-200 px-2 text-[11px] text-red-700 hover:bg-red-50"
                                    disabled={isBusy}
                                >
                                    {isBusy ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Archive className="mr-1.5 h-3.5 w-3.5" />
                                    )}
                                    Archive
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function ScholarshipOpenings() {
    const navigate = useNavigate();

    const [templates, setTemplates] = useState([]);
    const [openings, setOpenings] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const [search, setSearch] = useState('');
    const [programFilter, setProgramFilter] = useState('All Programs');
    const [audienceFilter, setAudienceFilter] = useState('All Audiences');
    const [viewMode, setViewMode] = useState('cards');
    const [pageTab, setPageTab] = useState('current');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [editingOpeningId, setEditingOpeningId] = useState(null);

    const [postCreateOpen, setPostCreateOpen] = useState(false);
    const [newOpeningForPrompt, setNewOpeningForPrompt] = useState(null);

    const emptyForm = {
        program_id: '',
        opening_title: '',
        academic_year_id: '',
        academic_year: '',
        allocated_slots: '',
        filled_slots_preview: 0,
        financial_allocation: '',
        announcement_text: '',
        posting_status: 'draft',
        target_audience: 'Applicants',
    };

    const [form, setForm] = useState(emptyForm);

    const fetchData = async () => {
        try {
            setLoading(true);

            const [templatesRes, openingsRes, academicYearsRes] = await Promise.all([
                fetch(buildApiUrl('/api/scholarship-program'), {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }),
                fetch(buildApiUrl('/api/program-openings'), {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }),
                fetch(buildApiUrl('/api/academic-years'), {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }),
            ]);

            if (!templatesRes.ok) throw new Error('Failed to load scholarship program templates');
            if (!openingsRes.ok) throw new Error('Failed to load scholarship openings');
            if (!academicYearsRes.ok) throw new Error('Failed to load academic years');

            const templatesData = await templatesRes.json();
            const openingsData = await openingsRes.json();
            const academicYearsData = await academicYearsRes.json();

            setAcademicYears(Array.isArray(academicYearsData) ? academicYearsData : []);

            setTemplates(
                Array.isArray(templatesData)
                    ? templatesData.filter(
                        (t) =>
                            !t.is_archived &&
                            String(t.visibility_status || '').toLowerCase() === 'published'
                    )
                    : []
            );

            setOpenings(Array.isArray(openingsData) ? openingsData : []);
        } catch (err) {
            console.error('SCHOLARSHIP OPENINGS FETCH ERROR:', err);
            alert(err.message || 'Failed to load scholarship openings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const visibleOpenings = useMemo(() => {
        return openings.filter((o) => {
            const status = String(o.posting_status || '').toLowerCase();

            const noCoreData =
                !o.opening_title &&
                !o.program_name &&
                Number(o.allocated_slots || 0) === 0 &&
                Number(o.financial_allocation || 0) === 0;

            if (noCoreData) return false;
            if (status === 'archived' && !o.opening_title) return false;

            return true;
        });
    }, [openings]);

    const programOptions = useMemo(() => {
        const source = pageTab === 'templates' ? templates : visibleOpenings;
        const values = source.map((o) => o.program_name).filter(Boolean);
        return ['All Programs', ...new Set(values)];
    }, [templates, visibleOpenings, pageTab]);

    const audienceOptions = ['All Audiences', 'Applicants', 'Scholars', 'Both'];

    const filteredTemplates = useMemo(() => {
        const q = search.trim().toLowerCase();

        return templates.filter((t) => {
            const matchSearch =
                !q ||
                (t.program_name || '').toLowerCase().includes(q) ||
                (t.benefactor_name || '').toLowerCase().includes(q) ||
                (t.description || '').toLowerCase().includes(q);

            const templateAudience = normalizeAudience(t.target_audience) || deriveTargetAudience(t);
            const matchAudience =
                audienceFilter === 'All Audiences' ||
                templateAudience === audienceFilter;

            const matchProgram =
                programFilter === 'All Programs' ||
                (t.program_name || '') === programFilter;

            return matchSearch && matchAudience && matchProgram;
        });
    }, [templates, search, audienceFilter, programFilter]);

    const filteredOpenings = useMemo(() => {
        const q = search.trim().toLowerCase();

        return visibleOpenings
            .filter((o) => {
                const computedStatus = getComputedDisplayStatus(o);

                const inCurrentTab = pageTab === 'current' && computedStatus !== 'archived';
                const inArchivedTab = pageTab === 'archived' && computedStatus === 'archived';

                if (pageTab === 'templates') return false;
                if (!inCurrentTab && !inArchivedTab) return false;

                const matchSearch =
                    !q ||
                    (o.opening_title || '').toLowerCase().includes(q) ||
                    (o.program_name || '').toLowerCase().includes(q) ||
                    (o.benefactor_name || '').toLowerCase().includes(q) ||
                    (o.academic_year || '').toLowerCase().includes(q);

                const matchProgram =
                    programFilter === 'All Programs' ||
                    (o.program_name || '') === programFilter;

                const openingAudience = normalizeAudience(o.target_audience) || 'Applicants';
                const matchAudience =
                    audienceFilter === 'All Audiences' ||
                    openingAudience === audienceFilter;

                return matchSearch && matchProgram && matchAudience;
            })
            .sort((a, b) => {
                const aCreated = a?.created_at ? new Date(a.created_at).getTime() : 0;
                const bCreated = b?.created_at ? new Date(b.created_at).getTime() : 0;

                if (bCreated !== aCreated) return bCreated - aCreated;

                const aUpdated = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
                const bUpdated = b?.updated_at ? new Date(b.updated_at).getTime() : 0;

                return bUpdated - aUpdated;
            });
    }, [visibleOpenings, search, programFilter, audienceFilter, pageTab]);

    const stats = useMemo(() => {
        return {
            templates: templates.length,
            total: visibleOpenings.length,
            open: visibleOpenings.filter((o) => getComputedDisplayStatus(o) === 'open').length,
            draft: visibleOpenings.filter((o) => getComputedDisplayStatus(o) === 'draft').length,
            archived: visibleOpenings.filter((o) => getComputedDisplayStatus(o) === 'archived').length,
        };
    }, [templates, visibleOpenings]);

    const openCreateFromTemplate = (template) => {
        const currentYear = new Date().getFullYear();
        const computedAudience = deriveTargetAudience(template);

        const existingDraft = openings.find(
            (o) =>
                o.program_id === template.program_id &&
                String(o.posting_status || '').toLowerCase() === 'draft'
        );

        if (existingDraft) {
            setModalMode('edit');
            setEditingOpeningId(existingDraft.opening_id);
            setActiveTemplate(template);
            setForm({
                program_id: existingDraft.program_id || template.program_id,
                opening_title: existingDraft.opening_title || `${template.program_name} ${currentYear}-${currentYear + 1}`,
                academic_year_id: existingDraft.academic_year_id || '',
                academic_year: existingDraft.academic_year || '',
                allocated_slots: existingDraft.allocated_slots ?? '',
                filled_slots_preview: existingDraft.qualified_count ?? existingDraft.filled_slots ?? 0,
                financial_allocation: existingDraft.financial_allocation ?? '',
                announcement_text: existingDraft.announcement_text ?? template.description ?? '',
                posting_status: existingDraft.posting_status || 'draft',
                target_audience: deriveTargetAudience(existingDraft),
            });
            setModalOpen(true);
            return;
        }

        setModalMode('create');
        setEditingOpeningId(null);
        setActiveTemplate(template);
        setForm({
            program_id: template.program_id,
            opening_title: `${template.program_name} ${currentYear}-${currentYear + 1}`,
            academic_year_id: '',
            academic_year: '',
            allocated_slots: '',
            filled_slots_preview: 0,
            financial_allocation: '',
            announcement_text: template.description || '',
            posting_status: 'draft',
            target_audience: computedAudience,
        });
        setModalOpen(true);
    };

    const openEditModal = (opening) => {
        setModalMode('edit');
        setEditingOpeningId(opening.opening_id);
        setActiveTemplate(
            templates.find((t) => t.program_id === opening.program_id) || null
        );

        setForm({
            program_id: opening.program_id || '',
            opening_title: opening.opening_title || '',
            academic_year_id: opening.academic_year_id || '',
            academic_year: opening.academic_year || '',
            allocated_slots: opening.allocated_slots ?? '',
            filled_slots_preview: opening.qualified_count ?? opening.filled_slots ?? 0,
            financial_allocation: opening.financial_allocation ?? '',
            announcement_text: opening.announcement_text || '',
            posting_status: opening.posting_status || 'draft',
            target_audience: deriveTargetAudience(opening),
        });

        setModalOpen(true);
    };

    const handleSaveOpening = async () => {
        try {
            if (!form.program_id) {
                alert('Program is required.');
                return;
            }

            if (!form.opening_title?.trim()) {
                alert('Opening title is required.');
                return;
            }

            if (!form.academic_year_id) {
                alert('Academic year is required.');
                return;
            }

            const allocatedSlots = Number(form.allocated_slots || 0);
            const financialAllocation = Number(form.financial_allocation || 0);
            const perScholarAmount =
                allocatedSlots > 0 && financialAllocation > 0
                    ? Math.floor(financialAllocation / allocatedSlots)
                    : 0;

            setSaving(true);

            const computedStatus = derivePersistedOpeningStatus(form, form.posting_status);

            const payload = {
                program_id: form.program_id,
                opening_title: form.opening_title.trim(),
                academic_year_id: form.academic_year_id || null,
                allocated_slots: allocatedSlots,
                financial_allocation: financialAllocation,
                per_scholar_amount: perScholarAmount,
                announcement_text: form.announcement_text?.trim() || null,
                posting_status: computedStatus,
            };

            const isEdit = modalMode === 'edit' && editingOpeningId;
            const url = isEdit
                ? buildApiUrl(`/api/program-openings/${editingOpeningId}`)
                : buildApiUrl('/api/program-openings');

            const method = isEdit ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to save scholarship opening');
            }

            setModalOpen(false);
            setForm(emptyForm);
            setEditingOpeningId(null);
            setActiveTemplate(null);
            await fetchData();

            if (!isEdit && String(computedStatus).toLowerCase() === 'open') {
                setNewOpeningForPrompt({
                    ...(data || payload),
                    target_audience: form.target_audience,
                });
                setPostCreateOpen(true);
            }

            if (String(computedStatus).toLowerCase() === 'draft') {
                alert('Opening saved as draft. Use the Open button in the registry once all required fields are complete.');
            }
        } catch (err) {
            console.error('SAVE OPENING ERROR:', err);
            alert(err.message || 'Failed to save scholarship opening');
        } finally {
            setSaving(false);
        }
    };

    const updateOpeningStatus = async (openingId, nextStatus, extraPayload = {}) => {
        try {
            setActionLoadingId(openingId);

const res = await fetch(buildApiUrl(`/api/program-openings/${openingId}`), {                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    posting_status: nextStatus,
                    ...extraPayload,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to update opening status');
            }

            await fetchData();
        } catch (err) {
            console.error('UPDATE OPENING STATUS ERROR:', err);
            alert(err.message || 'Failed to update opening status');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleArchiveOpening = async (openingId) => {
        await updateOpeningStatus(openingId, 'archived', { is_archived: true });
    };

    const handleUnarchiveOpening = async (opening) => {
        const availableSlots = getAvailableSlots(opening);
        const nextStatus = availableSlots > 0 ? 'open' : 'closed';
        await updateOpeningStatus(opening.opening_id, nextStatus, { is_archived: false });
    };

    const handleOpenDraftOpening = async (opening) => {
        if (!canOpeningBeOpened(opening)) {
            alert('This draft cannot be opened yet. Make sure it has an opening title, academic year, and allocated slots greater than 0.');
            return;
        }

        await updateOpeningStatus(opening.opening_id, 'open', { is_archived: false });
    };

    const handleCloseOpening = async (openingId) => {
        await updateOpeningStatus(openingId, 'closed', { is_archived: false });
    };

    const handleMoveToDraft = async (opening) => {
        if (getFilledSlots(opening) > 0) {
            alert('This opening cannot be moved to draft because it already has approved/filled slots.');
            return;
        }

        await updateOpeningStatus(opening.opening_id, 'draft', { is_archived: false });
    };

    const handleReopenOpening = async (opening) => {
        const availableSlots = getAvailableSlots(opening);

        if (availableSlots <= 0) {
            alert('This opening cannot be reopened because no slots are available.');
            return;
        }

        await updateOpeningStatus(opening.opening_id, 'open', { is_archived: false });
    };

    const handleCreateAnnouncementRedirect = () => {
        if (!newOpeningForPrompt) return;

        const params = new URLSearchParams({
            opening_title: newOpeningForPrompt.opening_title || '',
            announcement_text: newOpeningForPrompt.announcement_text || '',
            posting_status: newOpeningForPrompt.posting_status || '',
            opening_id: newOpeningForPrompt.opening_id || '',
            program_id: newOpeningForPrompt.program_id || '',
            academic_year: newOpeningForPrompt.academic_year || '',
            academic_year_id: newOpeningForPrompt.academic_year_id || '',
            target_audience:
                normalizeAudience(newOpeningForPrompt.target_audience) ||
                deriveTargetAudience(newOpeningForPrompt),
        });

        navigate(`/admin/announcements?prefill=opening&${params.toString()}`);
    };

    if (loading) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-stone-300" />
                <p className="text-xs uppercase tracking-widest text-stone-400">
                    Loading scholarship openings.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 py-3" style={{ background: C.bg }}>
            <OpeningModal
                open={modalOpen}
                mode={modalMode}
                form={form}
                setForm={setForm}
                template={activeTemplate}
                academicYears={academicYears}
                onClose={() => {
                    setModalOpen(false);
                    setActiveTemplate(null);
                    setEditingOpeningId(null);
                    setForm(emptyForm);
                }}
                onSave={handleSaveOpening}
                saving={saving}
            />

            <PostCreatePrompt
                open={postCreateOpen}
                opening={newOpeningForPrompt}
                onClose={() => {
                    setPostCreateOpen(false);
                    setNewOpeningForPrompt(null);
                }}
                onCreateAnnouncement={handleCreateAnnouncementRedirect}
            />

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <MiniStat
                    label="Available Templates"
                    value={stats.templates}
                    icon={FolderOpen}
                    accent={C.blueMid}
                    soft={C.blueSoft}
                />
                <MiniStat
                    label="Total Openings"
                    value={stats.total}
                    icon={CalendarDays}
                    accent={C.brownMid}
                    soft={C.amberSoft}
                />
                <MiniStat
                    label="Open"
                    value={stats.open}
                    icon={CheckCircle2}
                    accent={C.green}
                    soft={C.greenSoft}
                />
                <MiniStat
                    label="Draft"
                    value={stats.draft}
                    icon={Clock3}
                    accent={C.amber}
                    soft={C.amberSoft}
                />
                <MiniStat
                    label="Archived"
                    value={stats.archived}
                    icon={Archive}
                    accent={'#57534e'}
                    soft={'#f5f5f4'}
                />
            </section>

            <section
                className="rounded-2xl border bg-white p-3 sm:p-4"
                style={{ borderColor: C.line }}
            >
                <div className="space-y-3">
                    <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 sm:w-auto">
                        <button
                            onClick={() => setPageTab('templates')}
                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${pageTab === 'templates'
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-600'
                                }`}
                        >
                            Templates
                        </button>

                        <button
                            onClick={() => setPageTab('current')}
                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${pageTab === 'current'
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-600'
                                }`}
                        >
                            Current
                        </button>

                        <button
                            onClick={() => setPageTab('archived')}
                            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${pageTab === 'archived'
                                ? 'bg-white text-stone-900 shadow-sm'
                                : 'text-stone-600'
                                }`}
                        >
                            Archived
                        </button>
                    </div>

                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="relative w-full xl:max-w-xl">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                            <Input
                                placeholder={
                                    pageTab === 'templates'
                                        ? 'Search template, benefactor, or description...'
                                        : 'Search by opening title, program, benefactor, or academic year...'
                                }
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-10 text-sm"
                            />
                        </div>

                        <div className="flex flex-wrap gap-2 lg:items-center">
                            <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                                <SelectTrigger className="h-10 w-[170px] rounded-xl border-stone-200 bg-white text-sm">
                                    <SelectValue placeholder="Target Audience" />
                                </SelectTrigger>
                                <SelectContent>
                                    {audienceOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option === 'Both' ? 'Scholars & Applicants' : option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={programFilter} onValueChange={setProgramFilter}>
                                <SelectTrigger className="h-10 w-[170px] rounded-xl border-stone-200 bg-white text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {programOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                            {option}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {pageTab !== 'templates' && (
                                <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 sm:w-auto">
                                    <button
                                        onClick={() => setViewMode('cards')}
                                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${viewMode === 'cards'
                                            ? 'bg-white text-stone-900 shadow-sm'
                                            : 'text-stone-600'
                                            }`}
                                    >
                                        <LayoutGrid className="h-4 w-4" />
                                        Cards
                                    </button>

                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${viewMode === 'table'
                                            ? 'bg-white text-stone-900 shadow-sm'
                                            : 'text-stone-600'
                                            }`}
                                    >
                                        <Table2 className="h-4 w-4" />
                                        Table
                                    </button>
                                </div>
                            )}

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={fetchData}
                                className="h-10 rounded-xl border-stone-200 text-xs text-stone-600"
                            >
                                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                Refresh
                            </Button>

                            <Button
                                size="sm"
                                className="h-10 rounded-xl border-none text-xs text-white"
                                style={{ background: C.brownMid }}
                                onClick={() => {
                                    setModalMode('create');
                                    setEditingOpeningId(null);
                                    setActiveTemplate(null);
                                    setForm(emptyForm);
                                    setModalOpen(true);
                                }}
                            >
                                <Plus className="mr-1.5 h-3.5 w-3.5" />
                                Create Opening
                            </Button>
                        </div>
                    </div>

                    {(search ||
                        audienceFilter !== 'All Audiences' ||
                        programFilter !== 'All Programs') && (
                            <div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSearch('');
                                        setAudienceFilter('All Audiences');
                                        setProgramFilter('All Programs');
                                    }}
                                    className="h-9 rounded-lg border-stone-200 text-xs"
                                >
                                    Reset Filters
                                </Button>
                            </div>
                        )}
                </div>
            </section>

            {pageTab === 'templates' && (
                <section
                    className="rounded-2xl border bg-white overflow-hidden"
                    style={{ borderColor: C.line }}
                >
                    <div className="border-b border-stone-100 px-5 py-4">
                        <h2 className="text-sm font-semibold text-stone-800">Published Scholarship Program Templates</h2>
                        <p className="mt-1 text-xs text-stone-500">
                            Use a published template to create a new scholarship opening quickly.
                        </p>
                    </div>

                    <div className="p-4">
                        {filteredTemplates.length === 0 ? (
                            <EmptyState
                                icon={FolderOpen}
                                title="No published templates found"
                                subtitle="Create and publish scholarship programs first."
                            />
                        ) : (
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                {filteredTemplates.map((template) => (
                                    <TemplateCard
                                        key={template.program_id}
                                        template={template}
                                        onOpen={openCreateFromTemplate}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            {pageTab !== 'templates' && (
                <section
                    className="rounded-2xl border bg-white overflow-hidden"
                    style={{ borderColor: C.line }}
                >
                    <div className="border-b border-stone-100 px-5 py-4">
                        <h2 className="text-sm font-semibold text-stone-800">
                            {pageTab === 'current' ? 'Opening Registry' : 'Archived Openings'}
                        </h2>
                        <p className="mt-1 text-xs text-stone-500">
                            {pageTab === 'current'
                                ? 'Active, draft, and closed scholarship openings.'
                                : 'Archived scholarship openings.'}
                        </p>
                    </div>

                    <div className="p-4">
                        {filteredOpenings.length === 0 ? (
                            <EmptyState
                                icon={EyeOff}
                                title={pageTab === 'current' ? 'No scholarship openings found' : 'No archived openings found'}
                                subtitle={
                                    pageTab === 'current'
                                        ? 'Open a scholarship program from a published template to create one.'
                                        : 'Archived scholarship openings will appear here.'
                                }
                            />
                        ) : viewMode === 'cards' ? (
                            <div className="space-y-3">
                                {filteredOpenings.map((opening) => (
                                    <OpeningCard
                                        key={opening.opening_id}
                                        opening={opening}
                                        actionLoadingId={actionLoadingId}
                                        openEditModal={openEditModal}
                                        handleUnarchiveOpening={handleUnarchiveOpening}
                                        handleOpenDraftOpening={handleOpenDraftOpening}
                                        handleMoveToDraft={handleMoveToDraft}
                                        handleCloseOpening={handleCloseOpening}
                                        handleReopenOpening={handleReopenOpening}
                                        handleArchiveOpening={handleArchiveOpening}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1100px]">
                                    <thead className="bg-stone-50">
                                        <tr className="border-b border-stone-200">
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Opening</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Program</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Audience</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Academic Year</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Slots</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Per Scholar</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Status</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {filteredOpenings.map((opening) => {
                                            const computedStatus = getComputedDisplayStatus(opening);
                                            const meta = STATUS_META[computedStatus] || STATUS_META.draft;
                                            const audience = normalizeAudience(opening.target_audience) || 'Applicants';
                                            const audienceLabelValue = targetAudienceLabel(audience);

                                            const allocatedSlots = getAllocatedSlots(opening);
                                            const filledSlots = getFilledSlots(opening);
                                            const availableSlots = getAvailableSlots(opening);

                                            const isArchived = computedStatus === 'archived';
                                            const isClosed = computedStatus === 'closed';
                                            const isDraft = computedStatus === 'draft';
                                            const canBeOpened = canOpeningBeOpened(opening);
                                            const canReopen = isClosed && availableSlots > 0;
                                            const canMoveToDraft = !isArchived && !isDraft && filledSlots === 0;
                                            const isBusy = actionLoadingId === opening.opening_id;

                                            const perScholar =
                                                opening.per_scholar_amount ??
                                                (allocatedSlots > 0
                                                    ? Math.floor(Number(opening.financial_allocation || 0) / allocatedSlots)
                                                    : 0);

                                            return (
                                                <tr key={opening.opening_id} className="border-b border-stone-100 hover:bg-stone-50">
                                                    <td className="px-4 py-4">
                                                        <div>
                                                            <p className="text-sm font-medium text-stone-900">
                                                                {opening.opening_title || 'Untitled Opening'}
                                                            </p>
                                                            <p className="mt-1 text-xs text-stone-400">
                                                                {opening.benefactor_name || 'No Benefactor'}
                                                            </p>
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-4 text-sm text-stone-700">
                                                        {opening.program_name || 'No Program'}
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] ${audience === 'Both'
                                                                ? 'border-purple-200 bg-purple-50 text-purple-700'
                                                                : audience === 'Scholars'
                                                                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                                                    : 'border-sky-200 bg-sky-50 text-sky-700'
                                                                }`}
                                                        >
                                                            {audienceLabelValue}
                                                        </Badge>
                                                    </td>

                                                    <td className="px-4 py-4 text-sm text-stone-700">
                                                        {opening.academic_year || 'N/A'}
                                                    </td>

                                                    <td className="px-4 py-4 text-sm text-stone-700">
                                                        <div>Allocated: {allocatedSlots}</div>
                                                        <div>Filled: {filledSlots}</div>
                                                        <div>Avail: {availableSlots}</div>
                                                    </td>

                                                    <td className="px-4 py-4 text-sm font-medium text-stone-900">
                                                        {fmtMoney(perScholar)}
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <span
                                                            className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                                                            style={{ color: meta.color, background: meta.bg }}
                                                        >
                                                            {meta.label}
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-4 text-right">
                                                        <div className="flex flex-wrap justify-end gap-1.5">
                                                            {isArchived && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleUnarchiveOpening(opening)}
                                                                    className="h-7 rounded-md border-green-200 px-2 text-[11px] text-green-700 hover:bg-green-50"
                                                                    disabled={isBusy}
                                                                >
                                                                    {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Unarchive'}
                                                                </Button>
                                                            )}

                                                            {!isArchived && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => openEditModal(opening)}
                                                                    className="h-7 rounded-md border-stone-200 px-2 text-[11px]"
                                                                    disabled={isBusy}
                                                                >
                                                                    Edit
                                                                </Button>
                                                            )}

                                                            {!isArchived && isDraft && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleOpenDraftOpening(opening)}
                                                                    className="h-7 rounded-md border-green-200 px-2 text-[11px] text-green-700 hover:bg-green-50"
                                                                    disabled={isBusy || !canBeOpened}
                                                                >
                                                                    Open
                                                                </Button>
                                                            )}

                                                            {canMoveToDraft && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleMoveToDraft(opening)}
                                                                    className="h-7 rounded-md border-amber-200 px-2 text-[11px] text-amber-700 hover:bg-amber-50"
                                                                    disabled={isBusy}
                                                                >
                                                                    Draft
                                                                </Button>
                                                            )}

                                                            {!isArchived && !isClosed && !isDraft && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleCloseOpening(opening.opening_id)}
                                                                    className="h-7 rounded-md border-amber-200 px-2 text-[11px] text-amber-700 hover:bg-amber-50"
                                                                    disabled={isBusy}
                                                                >
                                                                    Close
                                                                </Button>
                                                            )}

                                                            {!isArchived && isClosed && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleReopenOpening(opening)}
                                                                    className="h-7 rounded-md border-green-200 px-2 text-[11px] text-green-700 hover:bg-green-50"
                                                                    disabled={isBusy || !canReopen}
                                                                >
                                                                    Reopen
                                                                </Button>
                                                            )}

                                                            {!isArchived && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleArchiveOpening(opening.opening_id)}
                                                                    className="h-7 rounded-md border-red-200 px-2 text-[11px] text-red-700 hover:bg-red-50"
                                                                    disabled={isBusy}
                                                                >
                                                                    Archive
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    );
}
