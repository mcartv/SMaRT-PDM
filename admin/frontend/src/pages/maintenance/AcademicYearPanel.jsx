import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Pencil,
    RefreshCw,
    Loader2,
    CalendarRange,
    CheckCircle2,
    X,
    Search,
    Archive,
    ArchiveRestore,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';

const C = {
    brownMid: '#7c4a2e',
    bg: '#faf7f2',
};

function EmptyState({ archived = false }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
            <CalendarRange size={36} className="mb-3 text-stone-300" />
            <p className="text-sm font-semibold text-stone-700">
                {archived ? 'No archived academic years found' : 'No academic years found'}
            </p>
            <p className="mt-1 text-xs text-stone-400">
                {archived
                    ? 'Archived school years will appear here.'
                    : 'Add a school year to start using it across the system.'}
            </p>
        </div>
    );
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
        start > 0 && end > 0 ? `${start}-${end}` : 'Preview not available';

    const canSubmit =
        String(form.start_year || '').length === 4 &&
        String(form.end_year || '').length === 4 &&
        end === start + 1;

    const willReplaceActive =
        !!form.is_active &&
        !!activeYearLabel &&
        activeYearLabel !== computedLabel;

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
                            {isEdit ? 'Update Academic Year' : 'Add Academic Year'}
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                    >
                        <X size={16} />
                    </button>
                </div>

                <CardContent className="space-y-5 p-5">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-stone-400">
                            School Year Preview
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-stone-800">
                                {computedLabel}
                            </p>

                            {form.is_active && (
                                <Badge className="border-green-200 bg-green-50 text-green-700 hover:bg-green-50">
                                    Will be Active
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                Start Year
                            </label>

                            <Input
                                type="number"
                                min="2000"
                                max="9999"
                                value={form.start_year}
                                onChange={(e) => {
                                    const value = e.target.value;

                                    setForm((prev) => {
                                        const shouldAutoUpdateEndYear =
                                            !prev.end_year ||
                                            Number(prev.end_year) === Number(prev.start_year) + 1;

                                        return {
                                            ...prev,
                                            start_year: value,
                                            end_year:
                                                value && shouldAutoUpdateEndYear
                                                    ? String(Number(value) + 1)
                                                    : prev.end_year,
                                        };
                                    });
                                }}
                                placeholder="2025"
                                className="h-10 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                End Year
                            </label>

                            <Input
                                type="number"
                                min="2001"
                                max="10000"
                                value={form.end_year}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        end_year: e.target.value,
                                    }))
                                }
                                placeholder="2026"
                                className="h-10 rounded-lg border-stone-200 text-sm"
                                disabled={saving}
                            />
                        </div>
                    </div>

                    <div
                        className={`rounded-xl border px-4 py-4 ${form.is_active
                            ? 'border-green-200 bg-green-50'
                            : 'border-stone-200 bg-white'
                            }`}
                    >
                        <label className="flex cursor-pointer items-start gap-3">
                            <input
                                type="checkbox"
                                checked={!!form.is_active}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        is_active: e.target.checked,
                                    }))
                                }
                                className="mt-1 h-4 w-4 rounded border-stone-300 accent-[#7c4a2e]"
                                disabled={saving}
                            />

                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-stone-800">
                                    Set as active academic year
                                </p>

                                <p className="mt-1 text-xs leading-relaxed text-stone-500">
                                    Only one academic year can be active. If enabled, the current active academic year will automatically become inactive.
                                </p>

                                {willReplaceActive && (
                                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                                        Current active year{' '}
                                        <span className="font-semibold">{activeYearLabel}</span>{' '}
                                        will be marked inactive after saving.
                                    </div>
                                )}

                                {form.is_active && !willReplaceActive && (
                                    <div className="mt-3 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-green-700">
                                        This academic year will be active after saving.
                                    </div>
                                )}

                                {!form.is_active && activeYearLabel && (
                                    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">
                                        Current active year remains{' '}
                                        <span className="font-semibold text-stone-700">
                                            {activeYearLabel}
                                        </span>.
                                    </div>
                                )}
                            </div>
                        </label>
                    </div>

                    {!canSubmit && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            End year must be exactly one year after the start year.
                        </div>
                    )}
                </CardContent>

                <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="h-9 rounded-lg border-stone-200 text-xs"
                        disabled={saving}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={onSave}
                        disabled={saving || !canSubmit}
                        className="h-9 rounded-lg border-none text-xs text-white disabled:opacity-50"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : isEdit ? (
                            <Pencil className="mr-2 h-4 w-4" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        {isEdit ? 'Save Changes' : 'Add Academic Year'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export default function AcademicYearsPanel() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [pageTab, setPageTab] = useState('current');

    const emptyForm = {
        start_year: '',
        end_year: '',
        is_active: false,
    };

    const [form, setForm] = useState(emptyForm);

    const fetchAcademicYears = useCallback(async () => {
        try {
            setLoading(true);

            const res = await fetch(buildApiUrl('/api/academic-years'), {
                headers: {
                    Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await res.json().catch(() => []);

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to load academic years');
            }

            setRows(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('ACADEMIC YEARS FETCH ERROR:', err);
            alert(err.message || 'Failed to load academic years');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAcademicYears();
    }, [fetchAcademicYears]);

    useSocketEvent(
        'maintenance:updated',
        (payload = {}) => {
            if (!payload?.module || payload.module === 'academic_years') {
                fetchAcademicYears();
            }
        },
        [fetchAcademicYears]
    );

    const activeAcademicYear = useMemo(
        () => rows.find((row) => row.is_active && row.is_archived !== true),
        [rows]
    );

    const currentCount = useMemo(
        () => rows.filter((row) => row.is_archived !== true).length,
        [rows]
    );

    const archivedCount = useMemo(
        () => rows.filter((row) => row.is_archived === true).length,
        [rows]
    );

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();

        return rows
            .filter((row) => {
                const isArchived = row.is_archived === true;

                if (pageTab === 'current' && isArchived) return false;
                if (pageTab === 'archived' && !isArchived) return false;

                if (!q) return true;

                return (
                    String(row.label || '').toLowerCase().includes(q) ||
                    String(row.start_year || '').toLowerCase().includes(q) ||
                    String(row.end_year || '').toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                if ((b.is_active ? 1 : 0) !== (a.is_active ? 1 : 0)) {
                    return (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0);
                }

                return Number(b.start_year || 0) - Number(a.start_year || 0);
            });
    }, [rows, search, pageTab]);

    const resetModal = () => {
        setModalOpen(false);
        setModalMode('create');
        setEditingId(null);
        setForm(emptyForm);
    };

    const openCreateModal = () => {
        const currentYear = new Date().getFullYear();
        const hasActiveYear = rows.some(
            (row) => row.is_active && row.is_archived !== true
        );

        setModalMode('create');
        setEditingId(null);
        setForm({
            start_year: currentYear,
            end_year: currentYear + 1,
            is_active: !hasActiveYear,
        });
        setModalOpen(true);
    };

    const openEditModal = (row) => {
        setModalMode('edit');
        setEditingId(row.academic_year_id);
        setForm({
            start_year: row.start_year || '',
            end_year: row.end_year || '',
            is_active: !!row.is_active,
        });
        setModalOpen(true);
    };

    const validateForm = () => {
        const start = Number(form.start_year);
        const end = Number(form.end_year);

        if (!start || !end) {
            throw new Error('Start year and end year are required');
        }

        if (String(start).length !== 4 || String(end).length !== 4) {
            throw new Error('Start year and end year must be 4 digits');
        }

        if (end !== start + 1) {
            throw new Error('End year must be exactly start year + 1');
        }

        const duplicate = rows.find((row) => {
            if (modalMode === 'edit' && row.academic_year_id === editingId) {
                return false;
            }

            return Number(row.start_year) === start && Number(row.end_year) === end;
        });

        if (duplicate) {
            throw new Error('That academic year already exists');
        }
    };

    const handleSave = async () => {
        try {
            validateForm();
            setSaving(true);

            const payload = {
                start_year: Number(form.start_year),
                end_year: Number(form.end_year),
                is_active: !!form.is_active,
            };

            const isEdit = modalMode === 'edit' && editingId;

            const url = isEdit
                ? buildApiUrl(`/api/academic-years/${editingId}`)
                : buildApiUrl('/api/academic-years');

            const method = isEdit ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to save academic year');
            }

            resetModal();
            await fetchAcademicYears();
        } catch (err) {
            console.error('ACADEMIC YEAR SAVE ERROR:', err);
            alert(err.message || 'Failed to save academic year');
        } finally {
            setSaving(false);
        }
    };

    const handleSetActive = async (row) => {
        try {
            if (row.is_archived) {
                alert('Restore this academic year first before setting it active.');
                return;
            }

            setActionLoadingId(row.academic_year_id);

            const res = await fetch(
                buildApiUrl(`/api/academic-years/${row.academic_year_id}/activate`),
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to activate academic year');
            }

            await fetchAcademicYears();
        } catch (err) {
            console.error('ACADEMIC YEAR ACTIVATE ERROR:', err);
            alert(err.message || 'Failed to activate academic year');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleArchive = async (row) => {
        try {
            if (row.is_active) {
                alert('You cannot archive the active academic year. Set another academic year as active first.');
                return;
            }

            setActionLoadingId(row.academic_year_id);

            const res = await fetch(
                buildApiUrl(`/api/academic-years/${row.academic_year_id}/archive`),
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to archive academic year');
            }

            await fetchAcademicYears();
        } catch (err) {
            console.error('ACADEMIC YEAR ARCHIVE ERROR:', err);
            alert(err.message || 'Failed to archive academic year');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleRestore = async (row) => {
        try {
            setActionLoadingId(row.academic_year_id);

            const res = await fetch(
                buildApiUrl(`/api/academic-years/${row.academic_year_id}/restore`),
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to restore academic year');
            }

            await fetchAcademicYears();
            setPageTab('current');
        } catch (err) {
            console.error('ACADEMIC YEAR RESTORE ERROR:', err);
            alert(err.message || 'Failed to restore academic year');
        } finally {
            setActionLoadingId(null);
        }
    };

    return (
        <div className="space-y-4 py-1">
            <AcademicYearModal
                open={modalOpen}
                mode={modalMode}
                form={form}
                setForm={setForm}
                saving={saving}
                activeYearLabel={activeAcademicYear?.label || ''}
                onClose={resetModal}
                onSave={handleSave}
            />

            <div className="rounded-xl border border-stone-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                Current Active Academic Year
                            </p>

                            {activeAcademicYear ? (
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-stone-900">
                                        {activeAcademicYear.label ||
                                            `${activeAcademicYear.start_year}-${activeAcademicYear.end_year}`}
                                    </p>
                                    <Badge className="border-green-200 bg-green-50 text-green-700 hover:bg-green-50">
                                        Active
                                    </Badge>
                                </div>
                            ) : (
                                <p className="mt-1 text-sm font-medium text-amber-700">
                                    No active academic year selected.
                                </p>
                            )}
                        </div>

                        <div className="relative w-full md:w-[320px]">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                            <Input
                                placeholder="Search academic year..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 rounded-lg border-stone-200 bg-white pl-9 text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-stone-100 pt-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPageTab('current')}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${pageTab === 'current'
                                    ? 'bg-[#7c4a2e] text-white'
                                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                    }`}
                            >
                                Current ({currentCount})
                            </button>

                            <button
                                type="button"
                                onClick={() => setPageTab('archived')}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${pageTab === 'archived'
                                    ? 'bg-[#7c4a2e] text-white'
                                    : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                                    }`}
                            >
                                Archived ({archivedCount})
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={fetchAcademicYears}
                                className="h-8 rounded-lg border-stone-200 text-xs text-stone-600"
                            >
                                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                                Refresh
                            </Button>

                            <Button
                                size="sm"
                                onClick={openCreateModal}
                                className="h-8 rounded-lg border-none text-xs text-white"
                                style={{ background: C.brownMid }}
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-4">
                {loading ? (
                    <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-xs text-stone-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading academic years...
                    </div>
                ) : filteredRows.length === 0 ? (
                    <EmptyState archived={pageTab === 'archived'} />
                ) : (
                    <div className="space-y-3">
                        {filteredRows.map((row) => {
                            const label = row.label || `${row.start_year}-${row.end_year}`;
                            const isBusy = actionLoadingId === row.academic_year_id;
                            const isArchived = row.is_archived === true;

                            return (
                                <div
                                    key={row.academic_year_id}
                                    className={`rounded-xl border bg-white px-4 py-4 transition-colors ${row.is_active
                                            ? 'border-green-200'
                                            : isArchived
                                                ? 'border-stone-200 bg-stone-50'
                                                : 'border-stone-200 hover:border-stone-300'
                                        }`}
                                >
                                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-sm font-semibold text-stone-900">
                                                    {label}
                                                </h3>

                                                {isArchived ? (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-stone-300 bg-white text-stone-600"
                                                    >
                                                        Archived
                                                    </Badge>
                                                ) : row.is_active ? (
                                                    <Badge className="border-green-200 bg-green-50 text-green-700 hover:bg-green-50">
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-stone-200 bg-white text-stone-600"
                                                    >
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </div>

                                            <p className="mt-1 text-xs text-stone-500">
                                                Start: {row.start_year} · End: {row.end_year}
                                            </p>

                                            {row.is_active && !isArchived && (
                                                <p className="mt-2 text-xs text-green-700">
                                                    This school year is currently used as the active academic year.
                                                </p>
                                            )}

                                            {isArchived && (
                                                <p className="mt-2 text-xs text-stone-500">
                                                    This school year is archived and hidden from active selection.
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                                            {isArchived ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleRestore(row)}
                                                    className="rounded-lg border-green-200 text-xs text-green-700 hover:bg-green-50"
                                                    disabled={isBusy}
                                                >
                                                    {isBusy ? (
                                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                    ) : (
                                                        <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                                                    )}
                                                    Restore
                                                </Button>
                                            ) : (
                                                <>
                                                    {!row.is_active && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleSetActive(row)}
                                                            className="rounded-lg border-green-200 text-xs text-green-700 hover:bg-green-50"
                                                            disabled={isBusy}
                                                        >
                                                            {isBusy ? (
                                                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                            ) : (
                                                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                                            )}
                                                            Set Active
                                                        </Button>
                                                    )}

                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openEditModal(row)}
                                                        className="rounded-lg border-stone-200 text-xs"
                                                        disabled={isBusy}
                                                    >
                                                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                                        Edit
                                                    </Button>

                                                    {!row.is_active && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleArchive(row)}
                                                            className="rounded-lg border-red-200 text-xs text-red-700 hover:bg-red-50"
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
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}