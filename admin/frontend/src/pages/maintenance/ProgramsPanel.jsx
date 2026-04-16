import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    GraduationCap,
    ShieldCheck,
    Briefcase,
    Archive,
    Search,
    RefreshCw,
    Plus,
    Edit,
    Loader2,
    Save,
    X,
    Users as UsersIcon,
} from 'lucide-react';
import { C, EmptyState, FieldLabel, Toggle } from './components/MaintenanceShared';

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
                <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">
                            {isEdit ? 'Edit Program' : 'Add Program'}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Create or update scholarship program information
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <CardContent className="p-5 max-h-[calc(90vh-180px)] overflow-y-auto space-y-5">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-sm font-medium text-stone-800">Program Setup</p>
                        <p className="text-xs text-stone-500 mt-1">
                            Programs are linked to a benefactor and can be published for openings later.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                className="h-10 rounded-lg border-stone-200 text-sm"
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
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
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
                                className="min-h-[120px] rounded-lg border-stone-200 text-sm resize-none"
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
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                                    <SelectValue placeholder="Select target audience" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Applicants">Applicants Only</SelectItem>
                                    <SelectItem value="Scholars">Scholars Only</SelectItem>
                                    <SelectItem value="Both">Both (Scholars & Applicants)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <FieldLabel>GWA Threshold</FieldLabel>

                            <div className="h-10 px-3 rounded-lg border border-stone-200 flex items-center bg-white">
                                <Toggle
                                    value={noGwaThreshold}
                                    onChange={handleToggleNoGwaThreshold}
                                    labels={['No GWA Threshold', 'With GWA Threshold']}
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
                                className="h-10 rounded-lg border-stone-200 text-sm disabled:bg-stone-100 disabled:text-stone-400"
                            />
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
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
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
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
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
                            <div className="h-10 px-3 rounded-lg border border-stone-200 flex items-center bg-white">
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
                        disabled={saving || !form.program_name?.trim() || !form.benefactor_id}
                        className="h-9 rounded-lg text-white text-xs border-none disabled:opacity-50"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        {isEdit ? 'Save Program' : 'Create Program'}
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

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [archiveFilter, setArchiveFilter] = useState('Active');
    const [audienceFilter, setAudienceFilter] = useState('All');
    const [benefactorFilter, setBenefactorFilter] = useState('All');

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
        const res = await fetch('http://localhost:5000/api/scholarship-program', {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
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
        const res = await fetch('http://localhost:5000/api/benefactors', {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
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

    const benefactorNameMap = useMemo(() => {
        const map = {};
        benefactors.forEach((b) => {
            map[b.benefactor_id] = b.benefactor_name;
        });
        return map;
    }, [benefactors]);

    const stats = useMemo(() => {
        return {
            total: programs.length,
            published: programs.filter(
                (p) => (p.visibility_status || '').toLowerCase() === 'published'
            ).length,
            drafts: programs.filter(
                (p) => (p.visibility_status || '').toLowerCase() === 'draft'
            ).length,
            archived: programs.filter((p) => !!p.is_archived).length,
        };
    }, [programs]);

    const filteredPrograms = useMemo(() => {
        const q = search.trim().toLowerCase();

        return programs.filter((p) => {
            const benefactorName = p.benefactor_name || benefactorNameMap[p.benefactor_id] || '';

            const matchSearch =
                !q ||
                (p.program_name || '').toLowerCase().includes(q) ||
                benefactorName.toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q);

            const matchStatus =
                statusFilter === 'All' ||
                (p.visibility_status || '').toLowerCase() === statusFilter.toLowerCase();

            const matchAudience =
                audienceFilter === 'All' ||
                (p.target_audience || '').toLowerCase() === audienceFilter.toLowerCase();

            const matchBenefactor =
                benefactorFilter === 'All' ||
                p.benefactor_id === benefactorFilter;

            const matchArchive =
                archiveFilter === 'All' ||
                (archiveFilter === 'Active' && !p.is_archived) ||
                (archiveFilter === 'Archived' && !!p.is_archived);

            return matchSearch && matchStatus && matchAudience && matchBenefactor && matchArchive;
        });
    }, [
        programs,
        benefactorNameMap,
        search,
        statusFilter,
        audienceFilter,
        benefactorFilter,
        archiveFilter,
    ]);

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
                ? `http://localhost:5000/api/scholarship-program/${editingProgramId}`
                : 'http://localhost:5000/api/scholarship-program';

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
                `http://localhost:5000/api/scholarship-program/${program.program_id}`,
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
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
        <div className="space-y-5">
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

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-stone-900">Programs</h2>
                    <p className="text-sm text-stone-500">
                        Add scholarship programs and link them to a benefactor
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={loadAll}
                        className="rounded-lg text-xs border-stone-200 text-stone-600"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Refresh
                    </Button>

                    <Button
                        size="sm"
                        className="rounded-lg text-white text-xs border-none"
                        style={{ background: C.brownMid }}
                        onClick={openCreateModal}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Add Program
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.amberSoft }}>
                            <GraduationCap className="w-4 h-4 text-amber-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.total}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Total Programs</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.greenSoft }}>
                            <ShieldCheck className="w-4 h-4 text-green-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.published}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Published</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.blueSoft }}>
                            <Briefcase className="w-4 h-4 text-blue-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.drafts}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Drafts</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-stone-100">
                            <Archive className="w-4 h-4 text-stone-600" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.archived}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Archived</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[260px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
                    <Input
                        placeholder="Search by program or benefactor..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
                    />
                </div>

                <Select value={benefactorFilter} onValueChange={setBenefactorFilter}>
                    <SelectTrigger className="w-[200px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue placeholder="Benefactor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Benefactors</SelectItem>
                        {benefactors.map((b) => (
                            <SelectItem key={b.benefactor_id} value={b.benefactor_id}>
                                {b.benefactor_name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                    <SelectTrigger className="w-[180px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue placeholder="Target Audience" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Audiences</SelectItem>
                        <SelectItem value="applicants">Applicants Only</SelectItem>
                        <SelectItem value="scholars">Scholars Only</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Status</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={archiveFilter} onValueChange={setArchiveFilter}>
                    <SelectTrigger className="w-[145px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Records</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                    </SelectContent>
                </Select>

                {(search ||
                    benefactorFilter !== 'All' ||
                    audienceFilter !== 'All' ||
                    statusFilter !== 'All' ||
                    archiveFilter !== 'Active') && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setSearch('');
                                setBenefactorFilter('All');
                                setAudienceFilter('All');
                                setStatusFilter('All');
                                setArchiveFilter('Active');
                            }}
                            className="h-9 rounded-lg text-xs border-stone-200"
                        >
                            Reset
                        </Button>
                    )}
            </div>

            <Card className="border-stone-200 shadow-none overflow-hidden">
                <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
                    <div>
                        <CardTitle className="text-sm font-semibold text-stone-800">
                            Program Registry
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Scholarship-level records linked to benefactors
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[240px] gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
                            <p className="text-xs text-stone-400 uppercase tracking-widest">
                                Loading programs...
                            </p>
                        </div>
                    ) : filteredPrograms.length === 0 ? (
                        <EmptyState
                            icon={GraduationCap}
                            title="No programs found"
                            subtitle="Click the add button above to create a program."
                        />
                    ) : (
                        <div className="space-y-3">
                            {filteredPrograms.map((p) => {
                                const audience = p.target_audience || 'Applicants';
                                const benefactorName =
                                    p.benefactor_name ||
                                    benefactorNameMap[p.benefactor_id] ||
                                    'Unknown Benefactor';

                                const isPublished =
                                    (p.visibility_status || '').toLowerCase() === 'published';

                                return (
                                    <div
                                        key={p.program_id}
                                        className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition-colors"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm font-semibold text-stone-900">
                                                        {p.program_name}
                                                    </h3>

                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] border-stone-200 bg-white text-stone-600"
                                                    >
                                                        {benefactorName}
                                                    </Badge>

                                                    <span
                                                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${audience === 'Both'
                                                            ? 'bg-purple-50 text-purple-700'
                                                            : audience === 'Scholars'
                                                                ? 'bg-indigo-50 text-indigo-700'
                                                                : 'bg-sky-50 text-sky-700'
                                                            }`}
                                                    >
                                                        <UsersIcon className="w-3 h-3 inline mr-1" />
                                                        {getAudienceLabel(audience)}
                                                    </span>

                                                    <span
                                                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${isPublished
                                                            ? 'bg-green-50 text-green-700'
                                                            : 'bg-stone-100 text-stone-500'
                                                            }`}
                                                    >
                                                        {isPublished ? 'Published' : 'Draft'}
                                                    </span>

                                                    {p.is_archived && (
                                                        <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                                                            Archived
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                                                    {p.description || 'No description available.'}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 px-3 rounded-lg border-stone-200 text-stone-600 hover:bg-stone-50 text-xs shadow-none"
                                                    onClick={() => openEditModal(p)}
                                                >
                                                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                                                    Edit
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className={`h-8 px-3 rounded-lg text-xs shadow-none ${p.is_archived
                                                        ? 'border-green-200 text-green-700 hover:bg-green-50'
                                                        : 'border-red-200 text-red-700 hover:bg-red-50'
                                                        }`}
                                                    onClick={() => handleArchiveToggle(p)}
                                                >
                                                    {p.is_archived ? (
                                                        <>
                                                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                                            Restore
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Archive className="w-3.5 h-3.5 mr-1.5" />
                                                            Archive
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
                                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                                <p className="text-[10px] uppercase tracking-wide text-stone-400">
                                                    Benefactor
                                                </p>
                                                <p className="text-sm font-medium text-stone-800 mt-1">
                                                    {benefactorName}
                                                </p>
                                            </div>

                                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                                <p className="text-[10px] uppercase tracking-wide text-stone-400">
                                                    Target Audience
                                                </p>
                                                <p className="text-sm font-medium text-stone-800 mt-1">
                                                    {getAudienceLabel(audience)}
                                                </p>
                                            </div>

                                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                                <p className="text-[10px] uppercase tracking-wide text-stone-400">
                                                    GWA Threshold
                                                </p>
                                                <p className="text-sm font-medium text-stone-800 mt-1">
                                                    {p.gwa_threshold === null || p.gwa_threshold === undefined
                                                        ? 'No GWA Threshold'
                                                        : p.gwa_threshold}
                                                </p>
                                            </div>

                                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                                <p className="text-[10px] uppercase tracking-wide text-stone-400">
                                                    Status
                                                </p>
                                                <p className="text-sm font-medium text-stone-800 mt-1">
                                                    {isPublished ? 'Published' : 'Draft'}
                                                </p>
                                            </div>

                                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                                <p className="text-[10px] uppercase tracking-wide text-stone-400">
                                                    Renewal Cycle
                                                </p>
                                                <p className="text-sm font-medium text-stone-800 mt-1">
                                                    {p.renewal_cycle || 'Semester'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}