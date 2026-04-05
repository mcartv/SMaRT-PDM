import React, { useState, useEffect, useMemo } from 'react';

// --- SHADCN UI COMPONENTS ---
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// --- ICONS ---
import {
    Building2, BookOpen, GraduationCap, SlidersHorizontal,
    Cpu, ClipboardList, Plus, Edit,
    Activity, Globe, Database, RefreshCw, Save,
    X, Calendar, Settings, Loader2, Check,
    ToggleLeft, ToggleRight, Search, Archive, ShieldCheck
} from 'lucide-react';

// ─── Palette ─────────────────────────────────────────────────
const C = {
    brown: '#5c2d0e',
    brownMid: '#7c4a2e',
    amber: '#d97706',
    amberSoft: '#FFF7ED',
    green: '#16a34a',
    greenSoft: '#F0FDF4',
    red: '#dc2626',
    redSoft: '#FEF2F2',
    blueMid: '#2563EB',
    blueSoft: '#EFF6FF',
    text: '#1c1917',
    bg: '#faf7f2',
    muted: '#78716c',
};

// ─── Shared UI Sub-components ───────────────────────────────
function FieldLabel({ children }) {
    return (
        <label className="text-[11px] font-medium uppercase tracking-wide block mb-1.5 text-stone-400">
            {children}
        </label>
    );
}

function GroupCard({ title, icon: Icon, children }) {
    return (
        <Card className="overflow-hidden border-stone-200 shadow-none bg-white">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-stone-100 bg-stone-50/60">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white border border-stone-200">
                    <Icon className="w-4 h-4 text-stone-600" />
                </div>
                <p className="text-sm font-semibold text-stone-800">{title}</p>
            </div>
            <CardContent className="p-5 space-y-5">{children}</CardContent>
        </Card>
    );
}

function Toggle({ value, onChange, labels = ['Enabled', 'Disabled'] }) {
    return (
        <button onClick={() => onChange(!value)} className="flex items-center gap-2">
            {value ? <ToggleRight className="w-7 h-7 text-green-600" /> : <ToggleLeft className="w-7 h-7 text-stone-300" />}
            <span className={`text-xs font-medium ${value ? 'text-green-700' : 'text-stone-400'}`}>
                {value ? labels[0] : labels[1]}
            </span>
        </button>
    );
}

function EmptyState({ title, subtitle }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
            <GraduationCap size={40} className="mb-3 text-stone-300" />
            <p className="text-sm font-semibold text-stone-700">{title}</p>
            <p className="text-xs text-stone-400 mt-1">{subtitle}</p>
        </div>
    );
}

function ProgramTemplateModal({
    open,
    mode,
    benefactors,
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
                className="w-full max-w-4xl border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">
                            {isEdit ? 'Edit Scholarship Program Template' : 'Add Scholarship Program Template'}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Configure reusable scholarship details for Scholarship Openings
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <FieldLabel>Program Name</FieldLabel>
                            <Input
                                value={form.program_name}
                                onChange={(e) => setForm((prev) => ({ ...prev, program_name: e.target.value }))}
                                placeholder="e.g. Tulong Dunong Program"
                                className="h-10 rounded-lg border-stone-200 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Benefactor</FieldLabel>
                            <Select
                                value={form.benefactor_id}
                                onValueChange={(value) => setForm((prev) => ({ ...prev, benefactor_id: value }))}
                            >
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                                    <SelectValue placeholder="Select benefactor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {benefactors.map((b) => (
                                        <SelectItem key={b.benefactor_id} value={b.benefactor_id}>
                                            {b.organization_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <FieldLabel>Description</FieldLabel>
                            <Textarea
                                value={form.description}
                                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                placeholder="Default description and reusable guidance shown when this program is opened for a batch..."
                                className="min-h-[120px] rounded-lg border-stone-200 text-sm resize-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>GWA Threshold</FieldLabel>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.gwa_threshold}
                                onChange={(e) => setForm((prev) => ({ ...prev, gwa_threshold: e.target.value }))}
                                className="h-10 rounded-lg border-stone-200 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Renewal Cycle</FieldLabel>
                            <Select
                                value={form.renewal_cycle}
                                onValueChange={(value) => setForm((prev) => ({ ...prev, renewal_cycle: value }))}
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
                            <FieldLabel>Visibility</FieldLabel>
                            <Select
                                value={form.visibility_status}
                                onValueChange={(value) => setForm((prev) => ({ ...prev, visibility_status: value }))}
                            >
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Published">Published</SelectItem>
                                    <SelectItem value="Hidden">Hidden</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Requires RO</FieldLabel>
                            <div className="h-10 px-3 rounded-lg border border-stone-200 flex items-center bg-white">
                                <Toggle
                                    value={form.requires_ro}
                                    onChange={(value) => setForm((prev) => ({ ...prev, requires_ro: value }))}
                                    labels={['Required', 'Not Required']}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="h-9 rounded-lg border-stone-200 text-xs"
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={onSave}
                            disabled={saving || !form.program_name || !form.benefactor_id}
                            className="h-9 rounded-lg text-white text-xs border-none disabled:opacity-50"
                            style={{ background: C.brownMid }}
                        >
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            {isEdit ? 'Save Changes' : 'Create Template'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Panels ─────────────────────────────────────────────────
function GeneralPanel() {
    const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');
    const [appOpen, setAppOpen] = useState(true);
    const [saved, setSaved] = useState(false);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-stone-900">General Configuration</h2>
                    <p className="text-sm text-stone-500">System-wide preferences and institutional identity</p>
                </div>
                <Button
                    onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                    className="rounded-lg text-white border-none text-xs"
                    style={{ background: saved ? C.green : C.brownMid }}
                >
                    {saved ? <Check size={16} className="mr-2" /> : <Save size={16} className="mr-2" />}
                    {saved ? 'Saved' : 'Save Changes'}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <GroupCard title="Institution Info" icon={Globe}>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <FieldLabel>Institution Name</FieldLabel>
                            <Input value={instName} onChange={e => setInstName(e.target.value)} className="rounded-lg bg-stone-50/50 border-stone-200" />
                        </div>
                        <div className="space-y-1.5">
                            <FieldLabel>Office Email</FieldLabel>
                            <Input defaultValue="osfa@pdm.edu.ph" className="rounded-lg bg-stone-50/50 border-stone-200" />
                        </div>
                    </div>
                </GroupCard>

                <GroupCard title="Application Window" icon={Calendar}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                            <div>
                                <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">Status</p>
                                <Toggle value={appOpen} onChange={setAppOpen} labels={['Registration Open', 'Registration Closed']} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <FieldLabel>Global Deadline</FieldLabel>
                            <Input type="date" defaultValue="2026-03-31" className="rounded-lg bg-stone-50/50 border-stone-200" />
                        </div>
                    </div>
                </GroupCard>
            </div>
        </div>
    );
}

function ScholarshipProgramsPanel() {
    const [programs, setPrograms] = useState([]);
    const [benefactors, setBenefactors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState('');
    const [visibilityFilter, setVisibilityFilter] = useState('All');
    const [archiveFilter, setArchiveFilter] = useState('Active');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingProgramId, setEditingProgramId] = useState(null);

    const emptyForm = {
        benefactor_id: '',
        program_name: '',
        description: '',
        gwa_threshold: '',
        requires_ro: false,
        renewal_cycle: 'Semester',
        visibility_status: 'Published',
        is_archived: false,
    };

    const [form, setForm] = useState(emptyForm);

    const fetchData = async () => {
        try {
            setLoading(true);

            const [programsRes, benefactorsRes] = await Promise.all([
                fetch('http://localhost:5000/api/scholarship-programs', {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }),
                fetch('http://localhost:5000/api/benefactors', {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }),
            ]);

            if (!programsRes.ok) throw new Error('Failed to load scholarship programs');
            if (!benefactorsRes.ok) throw new Error('Failed to load benefactors');

            const programsData = await programsRes.json();
            const benefactorsData = await benefactorsRes.json();

            setPrograms(Array.isArray(programsData) ? programsData : []);
            setBenefactors(Array.isArray(benefactorsData) ? benefactorsData : []);
        } catch (err) {
            console.error('SCHOLARSHIP PROGRAMS FETCH ERROR:', err);
            alert(err.message || 'Failed to load scholarship program templates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const stats = useMemo(() => {
        return {
            total: programs.length,
            visible: programs.filter((p) => (p.visibility_status || '').toLowerCase() === 'published').length,
            archived: programs.filter((p) => !!p.is_archived).length,
            roRequired: programs.filter((p) => !!p.requires_ro).length,
        };
    }, [programs]);

    const filteredPrograms = useMemo(() => {
        const q = search.trim().toLowerCase();

        return programs.filter((p) => {
            const matchSearch =
                !q ||
                (p.program_name || '').toLowerCase().includes(q) ||
                (p.benefactor_name || '').toLowerCase().includes(q);

            const matchVisibility =
                visibilityFilter === 'All' ||
                (p.visibility_status || '').toLowerCase() === visibilityFilter.toLowerCase();

            const matchArchive =
                archiveFilter === 'All' ||
                (archiveFilter === 'Active' && !p.is_archived) ||
                (archiveFilter === 'Archived' && !!p.is_archived);

            return matchSearch && matchVisibility && matchArchive;
        });
    }, [programs, search, visibilityFilter, archiveFilter]);

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
            gwa_threshold: program.gwa_threshold ?? '',
            requires_ro: !!program.requires_ro,
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
                program_name: form.program_name,
                description: form.description || null,
                gwa_threshold: Number(form.gwa_threshold || 0),
                requires_ro: !!form.requires_ro,
                renewal_cycle: form.renewal_cycle || 'Semester',
                visibility_status: form.visibility_status || 'Published',
                is_archived: !!form.is_archived,
            };

            const isEdit = modalMode === 'edit' && editingProgramId;
            const url = isEdit
                ? `http://localhost:5000/api/scholarship-programs/${editingProgramId}`
                : 'http://localhost:5000/api/scholarship-programs';

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
                throw new Error(data.error || 'Failed to save scholarship program');
            }

            setModalOpen(false);
            setEditingProgramId(null);
            setForm(emptyForm);
            await fetchData();
        } catch (err) {
            console.error('SAVE SCHOLARSHIP PROGRAM ERROR:', err);
            alert(err.message || 'Failed to save scholarship program');
        } finally {
            setSaving(false);
        }
    };

    const handleArchiveToggle = async (program) => {
        try {
            const res = await fetch(`http://localhost:5000/api/scholarship-programs/${program.program_id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_archived: !program.is_archived,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Failed to update archive status');
            }

            await fetchData();
        } catch (err) {
            console.error('ARCHIVE TOGGLE ERROR:', err);
            alert(err.message || 'Failed to update archive status');
        }
    };

    return (
        <div className="space-y-5">
            <ProgramTemplateModal
                open={modalOpen}
                mode={modalMode}
                benefactors={benefactors}
                form={form}
                setForm={setForm}
                onClose={() => {
                    setModalOpen(false);
                    setEditingProgramId(null);
                }}
                onSave={handleSave}
                saving={saving}
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-stone-900">Scholarship Program Templates</h2>
                    <p className="text-sm text-stone-500">
                        Reusable scholarship definitions used by the Scholarship Openings page
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchData}
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
                        <p className="text-xs text-stone-500 mt-0.5">Total Templates</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.greenSoft }}>
                            <ShieldCheck className="w-4 h-4 text-green-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.visible}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Published Templates</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.blueSoft }}>
                            <Settings className="w-4 h-4 text-blue-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.roRequired}</div>
                        <p className="text-xs text-stone-500 mt-0.5">RO Required</p>
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

                <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                    <SelectTrigger className="w-[150px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Visibility</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
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

                {(search || visibilityFilter !== 'All' || archiveFilter !== 'Active') && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSearch('');
                            setVisibilityFilter('All');
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
                        <CardTitle className="text-sm font-semibold text-stone-800">Program Template Registry</CardTitle>
                        <CardDescription className="text-xs">
                            These templates appear in Scholarship Openings as reusable program cards
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[240px] gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
                            <p className="text-xs text-stone-400 uppercase tracking-widest">
                                Loading scholarship program templates...
                            </p>
                        </div>
                    ) : filteredPrograms.length === 0 ? (
                        <EmptyState
                            title="No scholarship program templates found"
                            subtitle="Create a reusable template here first, then use it in Scholarship Openings."
                        />
                    ) : (
                        <div className="space-y-3">
                            {filteredPrograms.map((p) => (
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
                                                    {p.benefactor_name || p.benefactor_id || 'No Benefactor'}
                                                </Badge>

                                                <span
                                                    className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${(p.visibility_status || '').toLowerCase() === 'published'
                                                            ? 'bg-green-50 text-green-700'
                                                            : 'bg-stone-100 text-stone-500'
                                                        }`}
                                                >
                                                    {(p.visibility_status || 'Hidden').toLowerCase() === 'published' ? 'Published' : 'Hidden'}
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

                                    <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                            <p className="text-[10px] uppercase tracking-wide text-stone-400">GWA Threshold</p>
                                            <p className="text-sm font-medium text-stone-800 mt-1">{p.gwa_threshold ?? 'N/A'}</p>
                                        </div>

                                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                            <p className="text-[10px] uppercase tracking-wide text-stone-400">RO</p>
                                            <p className="text-sm font-medium text-stone-800 mt-1">
                                                {p.requires_ro ? 'Required' : 'Not Required'}
                                            </p>
                                        </div>

                                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                            <p className="text-[10px] uppercase tracking-wide text-stone-400">Renewal Cycle</p>
                                            <p className="text-sm font-medium text-stone-800 mt-1">
                                                {p.renewal_cycle || 'N/A'}
                                            </p>
                                        </div>

                                        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                            <p className="text-[10px] uppercase tracking-wide text-stone-400">Visibility</p>
                                            <p className="text-sm font-medium text-stone-800 mt-1">
                                                {p.visibility_status || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function BenefactorsPanel() {
    const [items] = useState([
        { id: 1, name: 'Kaizen Corporation', slots: 100, gwa: 2.00 },
        { id: 2, name: 'Genmart Holdings', slots: 50, gwa: 1.75 },
    ]);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-stone-900">Benefactors & GWA Control</h2>
                <Button className="rounded-lg text-white border-none text-xs" style={{ background: C.brownMid }}>
                    <Plus size={16} className="mr-2" /> Add Partner
                </Button>
            </div>

            <Card className="border-stone-200 shadow-none overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-stone-50/80 border-b border-stone-100">
                            <tr>
                                <th className="px-6 py-4 font-medium uppercase text-[10px] text-stone-400 tracking-wide">Partner Name</th>
                                <th className="px-6 py-4 font-medium uppercase text-[10px] text-stone-400 tracking-wide text-center">GWA Cutoff</th>
                                <th className="px-6 py-4 font-medium uppercase text-[10px] text-stone-400 tracking-wide text-center">Slots</th>
                                <th className="px-6 py-4 font-medium uppercase text-[10px] text-stone-400 tracking-wide text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {items.map(b => (
                                <tr key={b.id} className="hover:bg-stone-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-stone-800">{b.name}</td>
                                    <td className="px-6 py-4 text-center">
                                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-medium font-mono px-3 border-none">
                                            {b.gwa.toFixed(2)}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-center font-medium text-stone-500">{b.slots}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs border-stone-200 text-stone-600">
                                                <Edit size={14} />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

function SystemPanel() {
    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-stone-900">System Efficiency & OCR</h2>
                <p className="text-sm text-stone-500">Core services, engine health, and manual control</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Card className="p-5 border-stone-200 shadow-none flex flex-col items-center justify-center text-center">
                    <Cpu className="w-9 h-9 text-stone-300 mb-3" />
                    <p className="text-2xl font-semibold text-stone-800">Tesseract v5.3</p>
                    <p className="text-[10px] font-medium uppercase text-stone-400 mt-1 tracking-wide">Core OCR Engine</p>
                </Card>
                <Card className="p-5 border-stone-200 shadow-none flex flex-col items-center justify-center text-center">
                    <Activity className="w-9 h-9 text-green-400 mb-3" />
                    <p className="text-2xl font-semibold text-stone-800">94.2%</p>
                    <p className="text-[10px] font-medium uppercase text-stone-400 mt-1 tracking-wide">Success Rate</p>
                </Card>
                <Card className="p-5 border-stone-200 shadow-none flex flex-col items-center justify-center text-center">
                    <Database className="w-9 h-9 text-blue-400 mb-3" />
                    <p className="text-2xl font-semibold text-stone-800">14.2 GB</p>
                    <p className="text-[10px] font-medium uppercase text-stone-400 mt-1 tracking-wide">Storage Used</p>
                </Card>
            </div>

            <GroupCard title="Manual Overrides" icon={Settings}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="p-4 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-stone-800">Maintenance Mode</p>
                            <p className="text-xs text-stone-400 mt-0.5">Disable student portal access</p>
                        </div>
                        <Toggle value={false} labels={['Offline', 'Online']} />
                    </div>
                    <Button variant="outline" className="h-auto py-4 rounded-xl border-stone-200 flex flex-col items-center gap-1 hover:border-stone-400 bg-white">
                        <RefreshCw size={20} className="text-stone-400" />
                        <span className="text-xs font-medium uppercase tracking-wide">Run Manual DB Backup</span>
                    </Button>
                </div>
            </GroupCard>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────
export default function SettingsMaintenance() {
    const [tab, setTab] = useState('general');

    const TABS = [
        { key: 'general', label: 'General', icon: SlidersHorizontal },
        { key: 'programs', label: 'Programs', icon: GraduationCap },
        { key: 'benefactors', label: 'Benefactors', icon: Building2 },
        { key: 'courses', label: 'Courses', icon: BookOpen },
        { key: 'system', label: 'System', icon: Cpu },
        { key: 'audit', label: 'Audit', icon: ClipboardList },
    ];

    return (
        <div className="space-y-5 py-2 animate-in fade-in duration-500" style={{ background: C.bg }}>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Settings & Maintenance</h1>
                <p className="text-sm text-stone-500 mt-1">Administrative configuration and reusable system templates</p>
            </div>

            <Card className="border-stone-200 shadow-none overflow-hidden min-h-[600px]">
                <div className="flex border-b border-stone-100 bg-stone-50/50 overflow-x-auto">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all shrink-0 ${tab === t.key
                                    ? 'text-stone-900 border-stone-900 bg-white'
                                    : 'text-stone-400 border-transparent hover:text-stone-600'
                                }`}
                        >
                            <t.icon size={14} />
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-5">
                    {tab === 'general' && <GeneralPanel />}
                    {tab === 'programs' && <ScholarshipProgramsPanel />}
                    {tab === 'benefactors' && <BenefactorsPanel />}
                    {tab === 'system' && <SystemPanel />}
                    {tab === 'courses' && (
                        <div className="flex flex-col items-center justify-center h-64 text-stone-400 opacity-50">
                            <BookOpen size={42} className="mb-4" />
                            <p className="text-sm font-medium">Course Registry Under Migration</p>
                        </div>
                    )}
                    {tab === 'audit' && (
                        <div className="flex flex-col items-center justify-center h-64 text-stone-400 opacity-50">
                            <ClipboardList size={42} className="mb-4" />
                            <p className="text-sm font-medium">Audit Trail Access Restricted</p>
                        </div>
                    )}
                </div>
            </Card>

            <footer className="pt-6 pb-2 border-t border-stone-100">
                <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
                    SMaRT PDM · Administrative Maintenance Layer
                </p>
            </footer>
        </div>
    );
}