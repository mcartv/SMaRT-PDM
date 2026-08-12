import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Archive,
    ArchiveRestore,
    CalendarRange,
    CheckCircle2,
    FlaskConical,
    History,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';

const C = {
    brown: '#7c4a2e',
};

function authHeaders() {
    return {
        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json',
    };
}

function AcademicYearModal({
    open,
    mode,
    form,
    setForm,
    saving,
    activeYearLabel,
    onClose,
    onSave,
}) {
    if (!open) return null;

    const isEdit = mode === 'edit';
    const start = Number(form.start_year || 0);
    const end = Number(form.end_year || 0);
    const computedLabel =
        start > 0 && end > 0
            ? `${start}-${end}`
            : 'Preview not available';
    const canSubmit =
        String(form.start_year || '').length === 4 &&
        String(form.end_year || '').length === 4 &&
        end === start + 1;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-xl overflow-hidden border-stone-200 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">
                            {isEdit
                                ? 'Update Academic Year'
                                : 'Add Academic Year'}
                        </h3>
                        <p className="mt-1 text-xs text-stone-500">
                            First and Second Semester records are created automatically for every new academic year.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                    >
                        <X size={16} />
                    </button>
                </div>

                <CardContent className="space-y-5 p-5">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-stone-400">
                            School Year Preview
                        </p>
                        <p className="mt-1 text-sm font-semibold text-stone-900">
                            {computedLabel}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
                                Start Year
                            </label>
                            <Input
                                type="number"
                                min="2000"
                                max="9999"
                                value={form.start_year}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setForm((prev) => ({
                                        ...prev,
                                        start_year: value,
                                        end_year: value
                                            ? String(Number(value) + 1)
                                            : '',
                                    }));
                                }}
                                className="h-10 border-stone-200"
                                disabled={saving}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
                                End Year
                            </label>
                            <Input
                                type="number"
                                value={form.end_year}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        end_year: e.target.value,
                                    }))
                                }
                                className="h-10 border-stone-200"
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-4">
                        <input
                            type="checkbox"
                            checked={!!form.is_active}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    is_active:
                                        e.target.checked,
                                }))
                            }
                            className="mt-1 h-4 w-4 accent-[#7c4a2e]"
                            disabled={saving}
                        />
                        <div>
                            <p className="text-sm font-semibold text-stone-800">
                                Set as active academic year
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                                This selects the active school year only. The actual working semester is controlled separately below.
                            </p>
                            {activeYearLabel &&
                            activeYearLabel !== computedLabel &&
                            form.is_active ? (
                                <p className="mt-2 text-xs text-amber-700">
                                    Current active year {activeYearLabel} will become inactive.
                                </p>
                            ) : null}
                        </div>
                    </label>

                    {!canSubmit ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            End year must be exactly one year after the start year.
                        </div>
                    ) : null}
                </CardContent>

                <div className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onSave}
                        disabled={saving || !canSubmit}
                        className="border-none text-white"
                        style={{ background: C.brown }}
                    >
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : isEdit ? (
                            <Pencil className="mr-2 h-4 w-4" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        {isEdit
                            ? 'Save Changes'
                            : 'Add Academic Year'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export default function AcademicYearPanel() {
    const [years, setYears] = useState([]);
    const [periods, setPeriods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionId, setActionId] = useState(null);
    const [search, setSearch] = useState('');
    const [view, setView] = useState('current');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        start_year: '',
        end_year: '',
        is_active: false,
    });

    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            const [yearsRes, periodsRes] =
                await Promise.all([
                    fetch(
                        buildApiUrl('/api/academic-years'),
                        { headers: authHeaders() }
                    ),
                    fetch(
                        buildApiUrl(
                            '/api/academic-years/periods'
                        ),
                        { headers: authHeaders() }
                    ),
                ]);

            const yearsPayload =
                await yearsRes.json().catch(() => []);
            const periodsPayload =
                await periodsRes.json().catch(
                    () => []
                );

            if (!yearsRes.ok) {
                throw new Error(
                    yearsPayload?.error ||
                        'Failed to load academic years'
                );
            }

            if (!periodsRes.ok) {
                throw new Error(
                    periodsPayload?.error ||
                        'Failed to load academic periods'
                );
            }

            setYears(
                Array.isArray(yearsPayload)
                    ? yearsPayload
                    : []
            );
            setPeriods(
                Array.isArray(periodsPayload)
                    ? periodsPayload
                    : []
            );
        } catch (error) {
            console.error(
                'ACADEMIC CYCLE FETCH ERROR:',
                error
            );
            alert(
                error.message ||
                    'Failed to load academic cycle'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useSocketEvent(
        'maintenance:updated',
        (payload = {}) => {
            if (
                !payload?.module ||
                [
                    'academic_years',
                    'academic_periods',
                ].includes(payload.module)
            ) {
                loadData();
            }
        },
        [loadData]
    );

    const activeYear = useMemo(
        () =>
            years.find(
                (row) =>
                    row.is_active &&
                    row.is_archived !== true
            ) || null,
        [years]
    );

    const activePeriod = useMemo(
        () =>
            periods.find(
                (row) => row.is_active === true
            ) || null,
        [periods]
    );

    const filteredYears = useMemo(() => {
        const q = search.trim().toLowerCase();

        return years
            .filter((row) => {
                const archived =
                    row.is_archived === true;
                if (
                    view === 'current' &&
                    archived
                ) {
                    return false;
                }
                if (
                    view === 'archived' &&
                    !archived
                ) {
                    return false;
                }

                if (!q) return true;

                return String(
                    row.label ||
                        `${row.start_year}-${row.end_year}`
                )
                    .toLowerCase()
                    .includes(q);
            })
            .sort(
                (a, b) =>
                    Number(b.start_year || 0) -
                    Number(a.start_year || 0)
            );
    }, [years, search, view]);

    const resetModal = () => {
        setModalOpen(false);
        setModalMode('create');
        setEditingId(null);
        setForm({
            start_year: '',
            end_year: '',
            is_active: false,
        });
    };

    const openCreate = () => {
        const year = new Date().getFullYear();
        setModalMode('create');
        setEditingId(null);
        setForm({
            start_year: String(year),
            end_year: String(year + 1),
            is_active: !activeYear,
        });
        setModalOpen(true);
    };

    const openEdit = (row) => {
        setModalMode('edit');
        setEditingId(row.academic_year_id);
        setForm({
            start_year: String(
                row.start_year || ''
            ),
            end_year: String(
                row.end_year || ''
            ),
            is_active: !!row.is_active,
        });
        setModalOpen(true);
    };

    const saveYear = async () => {
        try {
            setSaving(true);

            const start = Number(form.start_year);
            const end = Number(form.end_year);

            if (
                !Number.isInteger(start) ||
                !Number.isInteger(end) ||
                end !== start + 1
            ) {
                throw new Error(
                    'End year must be exactly one year after the start year.'
                );
            }

            const isEdit =
                modalMode === 'edit' &&
                editingId;
            const url = isEdit
                ? buildApiUrl(
                      `/api/academic-years/${editingId}`
                  )
                : buildApiUrl(
                      '/api/academic-years'
                  );

            const response = await fetch(url, {
                method: isEdit ? 'PATCH' : 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    start_year: start,
                    end_year: end,
                    is_active:
                        !!form.is_active,
                }),
            });

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to save academic year'
                );
            }

            resetModal();
            await loadData();
        } catch (error) {
            alert(
                error.message ||
                    'Failed to save academic year'
            );
        } finally {
            setSaving(false);
        }
    };

    const activateYear = async (row) => {
        try {
            setActionId(
                `year-${row.academic_year_id}`
            );

            const response = await fetch(
                buildApiUrl(
                    `/api/academic-years/${row.academic_year_id}/activate`
                ),
                {
                    method: 'PATCH',
                    headers: authHeaders(),
                }
            );

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to activate academic year'
                );
            }

            await loadData();
        } catch (error) {
            alert(error.message);
        } finally {
            setActionId(null);
        }
    };

    const setCurrentPeriod = async (period) => {
        const label = `${period.term} · AY ${period.academic_year_label}`;

        if (
            !window.confirm(
                `Set ${label} as the current semester?\n\nThe previous semester becomes historical/read-only. Existing records for ${label} are preserved if you reactivate it.`
            )
        ) {
            return;
        }

        try {
            setActionId(
                `period-${period.period_id}`
            );

            const response = await fetch(
                buildApiUrl(
                    `/api/academic-years/periods/${period.period_id}/activate`
                ),
                {
                    method: 'PATCH',
                    headers: authHeaders(),
                }
            );

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to set current semester'
                );
            }

            const summary =
                payload?.cycle_summary || {};

            alert(
                [
                    `${label} is now current.`,
                    `Eligible scholars: ${summary.eligible_scholars ?? 0}`,
                    `New renewals: ${summary.renewals_created ?? 0}`,
                    `New RO cycles: ${summary.ro_cycles_created ?? 0}`,
                    '',
                    'If this was a historical semester, its previous state was preserved.',
                ].join('\n')
            );

            await loadData();
        } catch (error) {
            alert(
                error.message ||
                    'Failed to set current semester'
            );
        } finally {
            setActionId(null);
        }
    };

    const resetPeriodForTesting = async (
        period
    ) => {
        const label = `${period.term} · AY ${period.academic_year_label}`;

        if (
            !window.confirm(
                `RESET ${label} FOR TESTING?\n\nThis permanently deletes this semester's current Renewal and RO cycle records, including renewal uploads, RO logs, proofs, and placements, then creates fresh Pending cycles.\n\nUse this only with test data.`
            )
        ) {
            return;
        }

        const typed = window.prompt(
            'Type RESET to confirm the test-cycle reset.'
        );

        if (typed !== 'RESET') return;

        try {
            setActionId(
                `reset-${period.period_id}`
            );

            const response = await fetch(
                buildApiUrl(
                    `/api/academic-years/periods/${period.period_id}/reset-test`
                ),
                {
                    method: 'POST',
                    headers: authHeaders(),
                }
            );

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to reset test cycle'
                );
            }

            alert(
                [
                    `${label} was regenerated for testing.`,
                    `Deleted renewals: ${payload?.deleted?.renewals ?? 0}`,
                    `Deleted RO cycles: ${payload?.deleted?.ro_cycles ?? 0}`,
                    `Fresh renewals: ${payload?.regenerated?.renewals_created ?? 0}`,
                    `Fresh RO cycles: ${payload?.regenerated?.ro_cycles_created ?? 0}`,
                ].join('\n')
            );

            await loadData();
        } catch (error) {
            alert(
                error.message ||
                    'Failed to reset test cycle'
            );
        } finally {
            setActionId(null);
        }
    };

    const archiveYear = async (row) => {
        try {
            setActionId(
                `archive-${row.academic_year_id}`
            );

            const response = await fetch(
                buildApiUrl(
                    `/api/academic-years/${row.academic_year_id}/archive`
                ),
                {
                    method: 'PATCH',
                    headers: authHeaders(),
                }
            );

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to archive academic year'
                );
            }

            await loadData();
        } catch (error) {
            alert(error.message);
        } finally {
            setActionId(null);
        }
    };

    const restoreYear = async (row) => {
        try {
            setActionId(
                `restore-${row.academic_year_id}`
            );

            const response = await fetch(
                buildApiUrl(
                    `/api/academic-years/${row.academic_year_id}/restore`
                ),
                {
                    method: 'PATCH',
                    headers: authHeaders(),
                }
            );

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to restore academic year'
                );
            }

            setView('current');
            await loadData();
        } catch (error) {
            alert(error.message);
        } finally {
            setActionId(null);
        }
    };

    const periodsForYear = (yearId) =>
        periods.filter(
            (period) =>
                period.academic_year_id === yearId
        );

    return (
        <div className="space-y-5 py-1">
            <AcademicYearModal
                open={modalOpen}
                mode={modalMode}
                form={form}
                setForm={setForm}
                saving={saving}
                activeYearLabel={
                    activeYear?.label || ''
                }
                onClose={resetModal}
                onSave={saveYear}
            />

            <section className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                            Current Academic Cycle
                        </p>

                        {activePeriod ? (
                            <div className="mt-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-base font-semibold text-stone-900">
                                        {activePeriod.term}
                                    </p>
                                    <Badge className="border-green-200 bg-green-50 text-green-700 hover:bg-green-50">
                                        Current
                                    </Badge>
                                </div>
                                <p className="mt-1 text-sm text-stone-500">
                                    AY{' '}
                                    {
                                        activePeriod.academic_year_label
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                <p className="text-sm font-semibold text-amber-800">
                                    No current semester
                                </p>
                                <p className="mt-1 text-xs text-amber-700">
                                    Select First or Second Semester below. Renewal and RO should not rely on an arbitrary fallback period.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={loadData}
                            className="border-stone-200"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                        <Button
                            size="sm"
                            onClick={openCreate}
                            className="border-none text-white"
                            style={{
                                background: C.brown,
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Academic Year
                        </Button>
                    </div>
                </div>
            </section>

            <section className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="inline-flex rounded-xl bg-stone-100 p-1">
                        <button
                            type="button"
                            onClick={() =>
                                setView('current')
                            }
                            className={`rounded-lg px-4 py-2 text-sm font-medium ${
                                view === 'current'
                                    ? 'bg-white text-stone-900 shadow-sm'
                                    : 'text-stone-500'
                            }`}
                        >
                            Academic Years
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setView('archived')
                            }
                            className={`rounded-lg px-4 py-2 text-sm font-medium ${
                                view === 'archived'
                                    ? 'bg-white text-stone-900 shadow-sm'
                                    : 'text-stone-500'
                            }`}
                        >
                            Archived
                        </button>
                    </div>

                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                        <Input
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                            placeholder="Search academic year..."
                            className="pl-9"
                        />
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-stone-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading academic cycles...
                </div>
            ) : filteredYears.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-14 text-center">
                    <CalendarRange className="mx-auto h-9 w-9 text-stone-300" />
                    <p className="mt-3 text-sm font-semibold text-stone-700">
                        No academic years found
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredYears.map((year) => {
                        const yearPeriods =
                            periodsForYear(
                                year.academic_year_id
                            );
                        const archived =
                            year.is_archived === true;

                        return (
                            <section
                                key={
                                    year.academic_year_id
                                }
                                className={`overflow-hidden rounded-2xl border ${
                                    archived
                                        ? 'border-stone-200 bg-stone-50 opacity-75'
                                        : year.is_active
                                          ? 'border-green-200 bg-white'
                                          : 'border-stone-200 bg-white'
                                }`}
                            >
                                <div className="flex flex-col gap-3 border-b border-stone-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-semibold text-stone-900">
                                                {year.label ||
                                                    `${year.start_year}-${year.end_year}`}
                                            </h3>
                                            {year.is_active ? (
                                                <Badge className="border-green-200 bg-green-50 text-green-700">
                                                    Active Year
                                                </Badge>
                                            ) : null}
                                            {archived ? (
                                                <Badge variant="outline">
                                                    Archived
                                                </Badge>
                                            ) : null}
                                        </div>
                                        <p className="mt-1 text-xs text-stone-500">
                                            Viewing a semester does not change system state. Only “Set Current” changes which cycle is actionable.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {!archived &&
                                        !year.is_active ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                    actionId ===
                                                    `year-${year.academic_year_id}`
                                                }
                                                onClick={() =>
                                                    activateYear(
                                                        year
                                                    )
                                                }
                                            >
                                                Set Active Year
                                            </Button>
                                        ) : null}

                                        {!archived ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    openEdit(
                                                        year
                                                    )
                                                }
                                            >
                                                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                                Edit
                                            </Button>
                                        ) : null}

                                        {!archived &&
                                        !year.is_active ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-red-700"
                                                onClick={() =>
                                                    archiveYear(
                                                        year
                                                    )
                                                }
                                            >
                                                <Archive className="mr-1.5 h-3.5 w-3.5" />
                                                Archive
                                            </Button>
                                        ) : null}

                                        {archived ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    restoreYear(
                                                        year
                                                    )
                                                }
                                            >
                                                <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                                                Restore
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
                                    {yearPeriods.map(
                                        (period) => {
                                            const current =
                                                period.is_active ===
                                                true;
                                            const busy =
                                                actionId ===
                                                    `period-${period.period_id}` ||
                                                actionId ===
                                                    `reset-${period.period_id}`;

                                            return (
                                                <div
                                                    key={
                                                        period.period_id
                                                    }
                                                    className={`rounded-xl border p-4 ${
                                                        current
                                                            ? 'border-green-200 bg-green-50'
                                                            : 'border-stone-200 bg-stone-50/70'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                {current ? (
                                                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                                ) : (
                                                                    <History className="h-4 w-4 text-stone-400" />
                                                                )}
                                                                <p className="text-sm font-semibold text-stone-900">
                                                                    {
                                                                        period.term
                                                                    }
                                                                </p>
                                                            </div>
                                                            <p className="mt-1 text-xs text-stone-500">
                                                                {current
                                                                    ? 'Current · Renewal and RO are actionable'
                                                                    : 'Historical / inactive · existing data stays preserved'}
                                                            </p>
                                                        </div>

                                                        <Badge
                                                            className={
                                                                current
                                                                    ? 'border-green-200 bg-white text-green-700'
                                                                    : 'border-stone-200 bg-white text-stone-500'
                                                            }
                                                        >
                                                            {current
                                                                ? 'Current'
                                                                : 'Historical'}
                                                        </Badge>
                                                    </div>

                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {!archived &&
                                                        !current ? (
                                                            <Button
                                                                size="sm"
                                                                disabled={
                                                                    busy
                                                                }
                                                                onClick={() =>
                                                                    setCurrentPeriod(
                                                                        period
                                                                    )
                                                                }
                                                                className="border-none text-white"
                                                                style={{
                                                                    background:
                                                                        C.brown,
                                                                }}
                                                            >
                                                                {busy ? (
                                                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
                                                                )}
                                                                Set Current
                                                            </Button>
                                                        ) : null}

                                                        {current ? (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={
                                                                    busy
                                                                }
                                                                className="border-amber-200 text-amber-800 hover:bg-amber-50"
                                                                onClick={() =>
                                                                    resetPeriodForTesting(
                                                                        period
                                                                    )
                                                                }
                                                            >
                                                                {busy ? (
                                                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                                                                )}
                                                                Reset Test Cycle
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-sm font-semibold text-blue-900">
                    Testing rule
                </p>
                <p className="mt-1 text-xs leading-relaxed text-blue-800">
                    Selecting an old semester does not make it editable. Use Set Current to reactivate its exact previous state. Reset Test Cycle is separate and destructive; it creates fresh Renewal and RO records for the current semester and is blocked in production unless explicitly enabled.
                </p>
            </div>
        </div>
    );
}
