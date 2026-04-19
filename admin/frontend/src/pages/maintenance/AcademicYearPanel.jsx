import React, { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';

const C = {
    brownMid: '#7c4a2e',
    green: '#16a34a',
    greenSoft: '#F0FDF4',
    amber: '#d97706',
    amberSoft: '#FFF7ED',
    blueMid: '#2563EB',
    blueSoft: '#EFF6FF',
    text: '#1c1917',
    bg: '#faf7f2',
};

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
            <CalendarRange size={36} className="mb-3 text-stone-300" />
            <p className="text-sm font-semibold text-stone-700">No academic years found</p>
            <p className="text-xs text-stone-400 mt-1">
                Add a school year to start using it across the system.
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
    onClose,
    onSave,
}) {
    if (!open) return null;

    const isEdit = mode === 'edit';
    const start = Number(form.start_year || 0);
    const end = Number(form.end_year || 0);
    const computedLabel =
        start > 0 && end > 0 ? `${start}-${end}` : 'Preview not available';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-xl border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">
                            {isEdit ? 'Edit Academic Year' : 'Add Academic Year'}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Manage school year records used in scholarship openings.
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <CardContent className="p-5 space-y-5">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-stone-400">
                            School Year Preview
                        </p>
                        <p className="text-sm font-semibold text-stone-800 mt-1">
                            {computedLabel}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                Start Year
                            </label>
                            <Input
                                type="number"
                                min="2000"
                                max="9999"
                                value={form.start_year}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        start_year: e.target.value,
                                        end_year:
                                            e.target.value && !prev.end_year
                                                ? String(Number(e.target.value) + 1)
                                                : prev.end_year,
                                    }))
                                }
                                placeholder="2025"
                                className="h-10 rounded-lg border-stone-200 text-sm"
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
                            />
                        </div>
                    </div>

                    <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={!!form.is_active}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    is_active: e.target.checked,
                                }))
                            }
                            className="h-4 w-4 rounded border-stone-300"
                        />
                        <div>
                            <p className="text-sm font-medium text-stone-800">
                                Set as active academic year
                            </p>
                            <p className="text-xs text-stone-500">
                                Only one academic year should be active at a time.
                            </p>
                        </div>
                    </label>
                </CardContent>

                <div className="px-5 py-4 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2">
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
                        className="h-9 rounded-lg text-white text-xs border-none disabled:opacity-50"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4 mr-2" />
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

    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);

    const emptyForm = {
        start_year: '',
        end_year: '',
        is_active: false,
    };

    const [form, setForm] = useState(emptyForm);

    const fetchAcademicYears = async () => {
        try {
            setLoading(true);

            const res = await fetch('http://localhost:5000/api/academic-years', {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
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
    };

    useEffect(() => {
        fetchAcademicYears();
    }, []);

    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();

        return rows
            .filter((row) => {
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
    }, [rows, search]);

    const resetModal = () => {
        setModalOpen(false);
        setModalMode('create');
        setEditingId(null);
        setForm(emptyForm);
    };

    const openCreateModal = () => {
        const currentYear = new Date().getFullYear();

        setModalMode('create');
        setEditingId(null);
        setForm({
            start_year: currentYear,
            end_year: currentYear + 1,
            is_active: false,
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
            if (modalMode === 'edit' && row.academic_year_id === editingId) return false;
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
                ? `http://localhost:5000/api/academic-years/${editingId}`
                : 'http://localhost:5000/api/academic-years';

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
            const res = await fetch(
                `http://localhost:5000/api/academic-years/${row.academic_year_id}/activate`,
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
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
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[320px] gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
                <p className="text-xs text-stone-400 uppercase tracking-widest">
                    Loading academic years.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 py-1" style={{ background: C.bg }}>
            <AcademicYearModal
                open={modalOpen}
                mode={modalMode}
                form={form}
                setForm={setForm}
                saving={saving}
                onClose={resetModal}
                onSave={handleSave}
            />

            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="flex-1">
                    <Input
                        placeholder="Search academic year..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 text-sm bg-white rounded-lg border-stone-200"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchAcademicYears}
                        className="rounded-lg text-xs border-stone-200 text-stone-600"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Refresh
                    </Button>

                    <Button
                        size="sm"
                        onClick={openCreateModal}
                        className="rounded-lg text-white text-xs border-none"
                        style={{ background: C.brownMid }}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Add
                    </Button>
                </div>
            </div>

            {filteredRows.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="space-y-3">
                    {filteredRows.map((row) => (
                        <div
                            key={row.academic_year_id}
                            className="rounded-xl border border-stone-200 bg-white px-4 py-4 hover:border-stone-300 transition-colors"
                        >
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm font-semibold text-stone-900">
                                            {row.label || `${row.start_year}-${row.end_year}`}
                                        </h3>

                                        {row.is_active ? (
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
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {!row.is_active && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleSetActive(row)}
                                            className="rounded-lg text-xs border-green-200 text-green-700 hover:bg-green-50"
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                            Set Active
                                        </Button>
                                    )}

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openEditModal(row)}
                                        className="rounded-lg text-xs border-stone-200"
                                    >
                                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                        Edit
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}