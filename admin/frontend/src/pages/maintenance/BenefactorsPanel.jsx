import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Building2,
    Plus,
    Edit,
    RefreshCw,
    Archive,
    ShieldCheck,
    Briefcase,
    Search,
    Loader2,
    X,
    Save,
} from 'lucide-react';
import { C, EmptyState, FieldLabel, Toggle } from './components/MaintenanceShared';

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
                <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">
                            {isEdit ? 'Edit Benefactor' : 'Add Benefactor'}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Create or update a benefactor organization
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

                <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 md:col-span-2">
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
                                className="h-10 rounded-lg border-stone-200 text-sm"
                            />
                        </div>

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
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
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
                                placeholder="Optional notes about this benefactor..."
                                className="min-h-[120px] rounded-lg border-stone-200 text-sm resize-none"
                            />
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
                        disabled={saving || !form.benefactor_name?.trim() || !form.benefactor_type}
                        className="h-9 rounded-lg text-white text-xs border-none disabled:opacity-50"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        {isEdit ? 'Save Benefactor' : 'Create Benefactor'}
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
    const [archiveFilter, setArchiveFilter] = useState('Active');
    const [typeFilter, setTypeFilter] = useState('All');

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

    const stats = useMemo(() => {
        return {
            total: benefactors.length,
            active: benefactors.filter((b) => !b.is_archived).length,
            archived: benefactors.filter((b) => !!b.is_archived).length,
            publicCount: benefactors.filter(
                (b) => (b.benefactor_type || '').toLowerCase() === 'public'
            ).length,
        };
    }, [benefactors]);

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
                ? `http://localhost:5000/api/benefactors/${editingBenefactorId}`
                : 'http://localhost:5000/api/benefactors';

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
                `http://localhost:5000/api/benefactors/${benefactor.benefactor_id}`,
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
        <div className="space-y-5">
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

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-stone-900">Benefactors</h2>
                    <p className="text-sm text-stone-500">
                        Add and maintain benefactor organizations only
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchBenefactors}
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
                        Add Benefactor
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.amberSoft }}>
                            <Building2 className="w-4 h-4 text-amber-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.total}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Total Benefactors</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.greenSoft }}>
                            <ShieldCheck className="w-4 h-4 text-green-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.active}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Active</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.blueSoft }}>
                            <Briefcase className="w-4 h-4 text-blue-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.publicCount}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Public Benefactors</p>
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
                        placeholder="Search benefactor..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
                    />
                </div>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[150px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Types</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
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

                {(search || typeFilter !== 'All' || archiveFilter !== 'Active') && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSearch('');
                            setTypeFilter('All');
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
                            Benefactor Registry
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Organization-level records only
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[240px] gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
                            <p className="text-xs text-stone-400 uppercase tracking-widest">
                                Loading benefactors...
                            </p>
                        </div>
                    ) : filteredBenefactors.length === 0 ? (
                        <EmptyState
                            icon={Building2}
                            title="No benefactors found"
                            subtitle="Click the add button above to create a benefactor."
                        />
                    ) : (
                        <div className="space-y-3">
                            {filteredBenefactors.map((b) => {
                                const isPublic =
                                    (b.benefactor_type || '').toLowerCase() === 'public';

                                return (
                                    <div
                                        key={b.benefactor_id}
                                        className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition-colors"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm font-semibold text-stone-900">
                                                        {b.benefactor_name}
                                                    </h3>

                                                    <span
                                                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${isPublic
                                                                ? 'bg-blue-50 text-blue-700'
                                                                : 'bg-amber-50 text-amber-700'
                                                            }`}
                                                    >
                                                        {isPublic ? 'Public Sponsor' : 'Private Sponsor'}
                                                    </span>

                                                    {b.is_archived && (
                                                        <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                                                            Archived
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                                                    {b.description || 'No description available.'}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 px-3 rounded-lg border-stone-200 text-stone-600 hover:bg-stone-50 text-xs shadow-none"
                                                    onClick={() => openEditModal(b)}
                                                >
                                                    <Edit className="w-3.5 h-3.5 mr-1.5" />
                                                    Edit
                                                </Button>

                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className={`h-8 px-3 rounded-lg text-xs shadow-none ${b.is_archived
                                                            ? 'border-green-200 text-green-700 hover:bg-green-50'
                                                            : 'border-red-200 text-red-700 hover:bg-red-50'
                                                        }`}
                                                    onClick={() => handleArchiveToggle(b)}
                                                >
                                                    {b.is_archived ? (
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