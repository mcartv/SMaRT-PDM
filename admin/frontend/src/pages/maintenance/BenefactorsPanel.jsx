import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Building2,
    Plus,
    Edit,
    RefreshCw,
    Archive,
    Search,
    Loader2,
    X,
    Save,
    SlidersHorizontal,
} from 'lucide-react';
import { C, EmptyState, FieldLabel, Toggle } from './components/MaintenanceShared';
import { buildApiUrl } from '@/api';

function BenefactorOnlyModal({
    open,
    mode,
    form,
    setForm,
    onClose,
    onSave,
    saving,
}) {
    if (!open) return null;

    const isEdit = mode === 'edit';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-2xl border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-stone-800">
                        {isEdit ? 'Edit Benefactor' : 'Add Benefactor'}
                    </h3>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                <CardContent className="p-4 space-y-3">
                    <div className="space-y-1.5">
                        <FieldLabel>Organization Name</FieldLabel>
                        <Input
                            value={form.benefactor_name}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    benefactor_name: e.target.value,
                                }))
                            }
                            placeholder="e.g. CHED / Kaizen Corporation"
                            className="h-9 rounded-lg border-stone-200 text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <FieldLabel>Benefactor Type</FieldLabel>
                            <Select
                                value={form.benefactor_type}
                                onValueChange={(value) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        benefactor_type: value,
                                    }))
                                }
                            >
                                <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
                                    <SelectValue placeholder="Select benefactor type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Public">Public</SelectItem>
                                    <SelectItem value="Private">Private</SelectItem>
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

                    <div className="space-y-1.5">
                        <FieldLabel>Description</FieldLabel>
                        <Textarea
                            value={form.description}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                }))
                            }
                            placeholder="Optional notes about this benefactor..."
                            className="min-h-[100px] rounded-lg border-stone-200 text-sm resize-none"
                        />
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
                        disabled={saving || !form.benefactor_name?.trim() || !form.benefactor_type}
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

function BenefactorFilterModal({
    open,
    onClose,
    typeFilter,
    setTypeFilter,
    archiveFilter,
    setArchiveFilter,
    onApply,
    onClear,
}) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-md border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-stone-800">Filter Benefactors</h3>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>

                <CardContent className="p-4 space-y-3">
                    <div className="space-y-1.5">
                        <FieldLabel>Benefactor Type</FieldLabel>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All</SelectItem>
                                <SelectItem value="public">Public</SelectItem>
                                <SelectItem value="private">Private</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <FieldLabel>Archive Status</FieldLabel>
                        <Select value={archiveFilter} onValueChange={setArchiveFilter}>
                            <SelectTrigger className="h-9 rounded-lg border-stone-200 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Archived">Archived</SelectItem>
                                <SelectItem value="All">All</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>

                <div className="px-4 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        onClick={onClear}
                        className="h-8 rounded-lg border-stone-200 text-xs"
                    >
                        Clear
                    </Button>

                    <Button
                        onClick={onApply}
                        className="h-8 rounded-lg text-white text-xs border-none"
                        style={{ background: C.brownMid }}
                    >
                        Apply
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export default function BenefactorsPanel() {
    const [benefactors, setBenefactors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [archiveFilter, setArchiveFilter] = useState('Active');

    const [draftTypeFilter, setDraftTypeFilter] = useState('All');
    const [draftArchiveFilter, setDraftArchiveFilter] = useState('Active');
    const [filterOpen, setFilterOpen] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingBenefactorId, setEditingBenefactorId] = useState(null);

    const emptyForm = {
        benefactor_name: '',
        benefactor_type: 'Public',
        description: '',
        is_archived: false,
    };

    const [form, setForm] = useState(emptyForm);

    const fetchBenefactors = async () => {
        try {
            setLoading(true);

            const res = await fetch(buildApiUrl('/api/benefactors'), {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to load benefactors');
            }

            setBenefactors(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('BENEFACTORS FETCH ERROR:', err);
            alert(err.message || 'Failed to load benefactors');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBenefactors();
    }, []);

    const filteredBenefactors = useMemo(() => {
        const q = search.trim().toLowerCase();

        return benefactors.filter((b) => {
            const matchSearch =
                !q ||
                (b.benefactor_name || '').toLowerCase().includes(q) ||
                (b.description || '').toLowerCase().includes(q);

            const matchType =
                typeFilter === 'All' ||
                (b.benefactor_type || '').toLowerCase() === typeFilter.toLowerCase();

            const matchArchive =
                archiveFilter === 'All' ||
                (archiveFilter === 'Active' && !b.is_archived) ||
                (archiveFilter === 'Archived' && !!b.is_archived);

            return matchSearch && matchType && matchArchive;
        });
    }, [benefactors, search, typeFilter, archiveFilter]);

    const hasActiveFilters = typeFilter !== 'All' || archiveFilter !== 'Active';

    const openCreateModal = () => {
        setModalMode('create');
        setEditingBenefactorId(null);
        setForm(emptyForm);
        setModalOpen(true);
    };

    const openEditModal = (benefactor) => {
        setModalMode('edit');
        setEditingBenefactorId(benefactor.benefactor_id);
        setForm({
            benefactor_name: benefactor.benefactor_name || '',
            benefactor_type: benefactor.benefactor_type || 'Public',
            description: benefactor.description || '',
            is_archived: !!benefactor.is_archived,
        });
        setModalOpen(true);
    };

    const openFilterModal = () => {
        setDraftTypeFilter(typeFilter);
        setDraftArchiveFilter(archiveFilter);
        setFilterOpen(true);
    };

    const applyFilters = () => {
        setTypeFilter(draftTypeFilter);
        setArchiveFilter(draftArchiveFilter);
        setFilterOpen(false);
    };

    const clearFilters = () => {
        setDraftTypeFilter('All');
        setDraftArchiveFilter('Active');
        setTypeFilter('All');
        setArchiveFilter('Active');
        setFilterOpen(false);
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const payload = {
                benefactor_name: form.benefactor_name.trim(),
                benefactor_type: form.benefactor_type,
                description: form.description?.trim() ? form.description.trim() : null,
                is_archived: !!form.is_archived,
            };

            if (!payload.benefactor_name) {
                throw new Error('Benefactor name is required');
            }

            const isEdit = modalMode === 'edit' && editingBenefactorId;
            const url = isEdit
                ? buildApiUrl(`/api/benefactors/${editingBenefactorId}`)
                : buildApiUrl('/api/benefactors');

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
                throw new Error(data.error || data.message || 'Failed to save benefactor');
            }

            setModalOpen(false);
            setEditingBenefactorId(null);
            setForm(emptyForm);
            await fetchBenefactors();
        } catch (err) {
            console.error('SAVE BENEFACTOR ERROR:', err);
            alert(err.message || 'Failed to save benefactor');
        } finally {
            setSaving(false);
        }
    };

    const handleArchiveToggle = async (benefactor) => {
        try {
            const res = await fetch(
                buildApiUrl(`/api/benefactors/${benefactor.benefactor_id}`),
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        is_archived: !benefactor.is_archived,
                    }),
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to update benefactor');
            }

            await fetchBenefactors();
        } catch (err) {
            console.error('ARCHIVE BENEFACTOR ERROR:', err);
            alert(err.message || 'Failed to update benefactor');
        }
    };

    return (
        <div className="space-y-3">
            <BenefactorOnlyModal
                open={modalOpen}
                mode={modalMode}
                form={form}
                setForm={setForm}
                onClose={() => {
                    setModalOpen(false);
                    setEditingBenefactorId(null);
                }}
                onSave={handleSave}
                saving={saving}
            />

            <BenefactorFilterModal
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                typeFilter={draftTypeFilter}
                setTypeFilter={setDraftTypeFilter}
                archiveFilter={draftArchiveFilter}
                setArchiveFilter={setDraftArchiveFilter}
                onApply={applyFilters}
                onClear={clearFilters}
            />

            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-900">Benefactors</h2>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchBenefactors}
                        className="h-8 rounded-lg text-xs border-stone-200 text-stone-600"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        Refresh
                    </Button>

                    <Button
                        size="sm"
                        className="h-8 rounded-lg text-white text-xs border-none"
                        style={{ background: C.brownMid }}
                        onClick={openCreateModal}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add
                    </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                    <Input
                        placeholder="Search benefactor..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8 h-8 text-xs rounded-lg border-stone-200"
                    />
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={openFilterModal}
                    className="h-8 rounded-lg text-xs border-stone-200"
                >
                    <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                    Filters
                    {hasActiveFilters && (
                        <span className="ml-1 rounded-full bg-stone-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            Active
                        </span>
                    )}
                </Button>

                {(search || hasActiveFilters) && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSearch('');
                            setTypeFilter('All');
                            setArchiveFilter('Active');
                            setDraftTypeFilter('All');
                            setDraftArchiveFilter('Active');
                        }}
                        className="h-8 rounded-lg text-xs border-stone-200"
                    >
                        Reset
                    </Button>
                )}
            </div>

            <div className="rounded-lg border border-stone-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-[220px]">
                        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                    </div>
                ) : filteredBenefactors.length === 0 ? (
                    <div className="p-4">
                        <EmptyState
                            icon={Building2}
                            title="No benefactors found"
                            subtitle="Click the add button above to create a benefactor."
                        />
                    </div>
                ) : (
                    <div className="divide-y">
                        {filteredBenefactors.map((b) => {
                            const isPublic =
                                (b.benefactor_type || '').toLowerCase() === 'public';

                            return (
                                <div
                                    key={b.benefactor_id}
                                    className="flex items-center justify-between px-4 py-3 hover:bg-stone-50"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-medium text-stone-900">
                                                {b.benefactor_name}
                                            </h3>

                                            <span
                                                className={`text-[10px] px-2 py-0.5 rounded ${isPublic
                                                        ? 'bg-blue-50 text-blue-700'
                                                        : 'bg-amber-50 text-amber-700'
                                                    }`}
                                            >
                                                {isPublic ? 'Public' : 'Private'}
                                            </span>

                                            {b.is_archived && (
                                                <span className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-700">
                                                    Archived
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs text-stone-400 mt-1 truncate">
                                            {b.description || 'No description available.'}
                                        </p>
                                    </div>

                                    <div className="flex gap-1">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => openEditModal(b)}
                                        >
                                            <Edit size={12} />
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2 text-xs"
                                            onClick={() => handleArchiveToggle(b)}
                                        >
                                            <Archive size={12} />
                                        </Button>
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