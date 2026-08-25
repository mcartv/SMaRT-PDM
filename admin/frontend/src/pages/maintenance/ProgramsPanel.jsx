import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    GraduationCap,
    Archive,
    ArchiveRestore,
    Search,
    RefreshCw,
    Plus,
    Edit,
    Loader2,
    Save,
    X,
} from 'lucide-react';
import { C, EmptyState, FieldLabel, Toggle } from './components/MaintenanceShared';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';

function ProgramModal({
    open,
    mode,
    form,
    setForm,
    onClose,
    onSave,
    saving,
    benefactors = [],
}) {
    if (!open) return null;

    const isEdit = mode === 'edit';
    const noGwaThreshold = form.gwa_threshold === null;

    const handleToggleNoGwaThreshold = (nextNoThreshold) => {
        setForm((prev) => ({
            ...prev,
            gwa_threshold: nextNoThreshold
                ? null
                : prev.gwa_threshold === null
                    ? ''
                    : prev.gwa_threshold,
        }));
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-4xl border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-stone-800">
                        {isEdit ? 'Edit Program' : 'Add Program'}
                    </h3>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                <CardContent className="p-4 max-h-[calc(90vh-140px)] overflow-y-auto space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <FieldLabel>Scholarship Program</FieldLabel>
                            <Input
                                value={form.program_name}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        program_name: e.target.value,
                                    }))
                                }
                                placeholder="e.g. TES - Tertiary Education Subsidy"
                                className="h-9 rounded-lg border-stone-200 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Benefactor</FieldLabel>
                            <Select
                                value={form.benefactor_id}
                                onValueChange={(value) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        benefactor_id: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
                                    <SelectValue placeholder="Select benefactor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {benefactors.length === 0 ? (
                                        <SelectItem value="NO_BENEFACTOR" disabled>
                                            No benefactors available
                                        </SelectItem>
                                    ) : (
                                        benefactors.map((b) => (
                                            <SelectItem key={b.benefactor_id} value={b.benefactor_id}>
                                                {b.benefactor_name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <FieldLabel>Description</FieldLabel>
                            <Textarea
                                value={form.description}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        description: e.target.value,
                                    }))
                                }
                                placeholder="Program notes, eligibility details, or internal guidance..."
                                className="min-h-[100px] rounded-lg border-stone-200 text-sm resize-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Target Audience</FieldLabel>
                            <Select
                                value={form.target_audience}
                                onValueChange={(value) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        target_audience: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
                                    <SelectValue placeholder="Select target audience" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Applicants">Applicants Only</SelectItem>
                                    <SelectItem value="Scholars">Scholars Only</SelectItem>
                                    <SelectItem value="Both">Both</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Renewal Cycle</FieldLabel>
                            <Select
                                value={form.renewal_cycle}
                                onValueChange={(value) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        renewal_cycle: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Semester">Semester</SelectItem>
                                    <SelectItem value="Annual">Annual</SelectItem>
                                    <SelectItem value="None">None</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>GWA Threshold</FieldLabel>

                            <div className="h-9 px-3 rounded-lg border border-stone-200 flex items-center bg-white">
                                <Toggle
                                    value={noGwaThreshold}
                                    onChange={handleToggleNoGwaThreshold}
                                    labels={['No Threshold', 'With Threshold']}
                                />
                            </div>

                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                disabled={noGwaThreshold}
                                value={noGwaThreshold ? '' : form.gwa_threshold}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        gwa_threshold: e.target.value,
                                    }))
                                }
                                placeholder="e.g. 2.00"
                                className="h-9 rounded-lg border-stone-200 text-sm disabled:bg-stone-100 disabled:text-stone-400"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Program Status</FieldLabel>
                            <Select
                                value={form.visibility_status}
                                onValueChange={(value) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        visibility_status: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Published">Published</SelectItem>
                                    <SelectItem value="Draft">Draft</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Archive Status</FieldLabel>
                            <div className="h-9 px-3 rounded-lg border border-stone-200 flex items-center bg-white">
                                <Toggle
                                    value={!form.is_archived}
                                    onChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            is_archived: !value,
                                        }))
                                    }
                                    labels={['Active', 'Archived']}
                                />
                            </div>
                        </div>
                    </div>
                </CardContent>

                <div className="px-4 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="h-8 rounded-lg border-stone-200 text-xs"
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={onSave}
                        disabled={saving || !form.program_name?.trim() || !form.benefactor_id}
                        className="h-8 rounded-lg text-white text-xs border-none disabled:opacity-50"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                            <Save className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {isEdit ? 'Save' : 'Create'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export default function ProgramsPanel() {
    const [programs, setPrograms] = useState([]);
    const [benefactors, setBenefactors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pageTab, setPageTab] = useState('current');

    const [search, setSearch] = useState('');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingProgramId, setEditingProgramId] = useState(null);

    const emptyForm = {
        benefactor_id: '',
        program_name: '',
        description: '',
        target_audience: 'Applicants',
        gwa_threshold: null,
        renewal_cycle: 'Semester',
        visibility_status: 'Published',
        is_archived: false,
    };

    const [form, setForm] = useState(emptyForm);

    const fetchPrograms = async () => {
        const res = await fetch(buildApiUrl('/api/scholarship-program'), {
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.error || data.message || 'Failed to load programs');
        }

        setPrograms(Array.isArray(data) ? data : []);
    };

    const fetchBenefactors = async () => {
        const res = await fetch(buildApiUrl('/api/benefactors'), {
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(data.error || data.message || 'Failed to load benefactors');
        }

        setBenefactors(Array.isArray(data) ? data.filter((b) => !b.is_archived) : []);
    };

    const loadAll = async () => {
        try {
            setLoading(true);
            await Promise.all([fetchPrograms(), fetchBenefactors()]);
        } catch (err) {
            console.error('PROGRAMS/BENEFACTORS FETCH ERROR:', err);
            alert(err.message || 'Failed to load maintenance data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    useSocketEvent('maintenance:updated', () => {
        loadAll();
    }, []);

    const benefactorNameMap = useMemo(() => {
        const map = {};
        benefactors.forEach((b) => {
            map[b.benefactor_id] = b.benefactor_name;
        });
        return map;
    }, [benefactors]);

    const filteredPrograms = useMemo(() => {
        const q = search.trim().toLowerCase();

        return programs
            .filter((p) => {
                const isArchived = p.is_archived === true;

                if (pageTab === 'current' && isArchived) return false;
                if (pageTab === 'archived' && !isArchived) return false;

                const benefactorName =
                    p.benefactor_name || benefactorNameMap[p.benefactor_id] || '';

                if (!q) return true;

                return (
                    (p.program_name || '').toLowerCase().includes(q) ||
                    benefactorName.toLowerCase().includes(q) ||
                    (p.description || '').toLowerCase().includes(q)
                );
            })
            .sort((a, b) => {
                if ((a.is_archived ? 1 : 0) !== (b.is_archived ? 1 : 0)) {
                    return (a.is_archived ? 1 : 0) - (b.is_archived ? 1 : 0);
                }

                return String(a.program_name || '').localeCompare(
                    String(b.program_name || '')
                );
            });
    }, [programs, benefactorNameMap, search, pageTab]);

    const currentCount = useMemo(
        () => programs.filter((program) => program.is_archived !== true).length,
        [programs]
    );

    const archivedCount = useMemo(
        () => programs.filter((program) => program.is_archived === true).length,
        [programs]
    );

    const openCreateModal = () => {
        setModalMode('create');
        setEditingProgramId(null);
        setForm(emptyForm);
        setModalOpen(true);
    };

    const openEditModal = (program) => {
        setModalMode('edit');
        setEditingProgramId(program.program_id);
        setForm({
            benefactor_id: program.benefactor_id || '',
            program_name: program.program_name || '',
            description: program.description || '',
            target_audience: program.target_audience || 'Applicants',
            gwa_threshold:
                program.gwa_threshold === null || program.gwa_threshold === undefined
                    ? null
                    : String(program.gwa_threshold),
            renewal_cycle: program.renewal_cycle || 'Semester',
            visibility_status: program.visibility_status || 'Published',
            is_archived: !!program.is_archived,
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const payload = {
                benefactor_id: form.benefactor_id,
                program_name: form.program_name.trim(),
                description: form.description?.trim() ? form.description.trim() : null,
                target_audience: form.target_audience || 'Applicants',
                gwa_threshold:
                    form.gwa_threshold === null || form.gwa_threshold === ''
                        ? null
                        : Number(form.gwa_threshold),
                renewal_cycle: form.renewal_cycle || 'Semester',
                visibility_status: form.visibility_status || 'Published',
                is_archived: !!form.is_archived,
            };

            if (!payload.benefactor_id) throw new Error('Benefactor is required');
            if (!payload.program_name) throw new Error('Program name is required');

            if (
                payload.gwa_threshold !== null &&
                (Number.isNaN(payload.gwa_threshold) || payload.gwa_threshold < 0)
            ) {
                throw new Error('GWA threshold must be a valid number or left empty');
            }

            const isEdit = modalMode === 'edit' && editingProgramId;
            const url = isEdit
                ? buildApiUrl(`/api/scholarship-program/${editingProgramId}`)
                : buildApiUrl('/api/scholarship-program');
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
                throw new Error(data.error || data.message || 'Failed to save program');
            }

            setModalOpen(false);
            setEditingProgramId(null);
            setForm(emptyForm);
            await fetchPrograms();
        } catch (err) {
            console.error('SAVE PROGRAM ERROR:', err);
            alert(err.message || 'Failed to save program');
        } finally {
            setSaving(false);
        }
    };

    const handleArchiveToggle = async (program) => {
        try {
            const res = await fetch(
                buildApiUrl(`/api/scholarship-program/${program.program_id}`),
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        is_archived: !program.is_archived,
                    }),
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to update program');
            }

            await fetchPrograms();
        } catch (err) {
            console.error('ARCHIVE PROGRAM ERROR:', err);
            alert(err.message || 'Failed to update program');
        }
    };

    const getAudienceLabel = (audience) => {
        if (audience === 'Both') return 'Scholars & Applicants';
        if (audience === 'Scholars') return 'Scholars Only';
        return 'Applicants Only';
    };

    return (
        <div className="space-y-3">
            <ProgramModal
                open={modalOpen}
                mode={modalMode}
                form={form}
                setForm={setForm}
                onClose={() => {
                    setModalOpen(false);
                    setEditingProgramId(null);
                }}
                onSave={handleSave}
                saving={saving}
                benefactors={benefactors}
            />

            <div className="rounded-xl border border-stone-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                Program Records
                            </p>
                            <p className="mt-1 text-sm font-semibold text-stone-900">
                                {currentCount} active · {archivedCount} archived
                            </p>
                        </div>

                        <div className="relative w-full md:w-[320px]">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                            <Input
                                placeholder="Search program..."
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
                            {search && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSearch('')}
                                    className="h-8 rounded-lg border-stone-200 text-xs"
                                >
                                    Reset
                                </Button>
                            )}

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={loadAll}
                                className="h-8 rounded-lg border-stone-200 text-xs text-stone-600"
                            >
                                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                                Refresh
                            </Button>

                            <Button
                                size="sm"
                                className="h-8 rounded-lg border-none text-xs text-white"
                                style={{ background: C.brownMid }}
                                onClick={openCreateModal}
                            >
                                <Plus className="mr-1 h-3.5 w-3.5" />
                                Add
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                {loading ? (
                    <div className="flex items-center justify-center h-[220px]">
                        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                    </div>
                ) : filteredPrograms.length === 0 ? (
                    <div className="p-4">
                        <EmptyState
                            icon={GraduationCap}
                            title="No programs found"
                            subtitle="Click the add button above to create a program."
                        />
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredPrograms.map((p) => {
                            const benefactorName =
                                p.benefactor_name || benefactorNameMap[p.benefactor_id] || 'No benefactor';

                            return (
                                <div
                                    key={p.program_id}
                                    className="flex items-center justify-between px-4 py-3 hover:bg-stone-50"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-medium text-stone-900">
                                                {p.program_name}
                                            </h3>

                                            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                                {getAudienceLabel(p.target_audience)}
                                            </span>

                                            <span
                                                className={`text-[10px] px-2 py-0.5 rounded ${String(p.visibility_status).toLowerCase() === 'published'
                                                    ? 'bg-green-50 text-green-700'
                                                    : 'bg-amber-50 text-amber-700'
                                                    }`}
                                            >
                                                {p.visibility_status}
                                            </span>

                                            {p.is_archived && (
                                                <span className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-700">
                                                    Archived
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs text-stone-400 mt-1 truncate">
                                            {benefactorName}
                                            {p.gwa_threshold !== null && p.gwa_threshold !== undefined
                                                ? ` · GWA ${p.gwa_threshold}`
                                                : ' · No GWA threshold'}
                                            {p.renewal_cycle ? ` · ${p.renewal_cycle}` : ''}
                                        </p>
                                    </div>

                                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                        {p.is_archived ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-7 rounded-lg border-green-200 px-2 text-xs text-green-700 hover:bg-green-50"
                                                onClick={() => handleArchiveToggle(p)}
                                            >
                                                <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                                                Restore
                                            </Button>
                                        ) : (
                                            <>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 rounded-lg border-stone-200 px-2 text-xs"
                                                    onClick={() => openEditModal(p)}
                                                >
                                                    <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                    Edit
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 rounded-lg border-red-200 px-2 text-xs text-red-700 hover:bg-red-50"
                                                    onClick={() => handleArchiveToggle(p)}
                                                >
                                                    <Archive className="mr-1.5 h-3.5 w-3.5" />
                                                    Archive
                                                </Button>
                                            </>
                                        )}
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
