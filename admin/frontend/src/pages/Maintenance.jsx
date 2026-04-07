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
    Building2, BookOpen, SlidersHorizontal,
    Cpu, ClipboardList, Plus, Edit,
    Activity, Globe, Database, RefreshCw, Save,
    X, Calendar, Settings, Loader2, Check,
    ToggleLeft, ToggleRight, Search, Archive, ShieldCheck, Briefcase,
    User, Mail, Phone
} from 'lucide-react';

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
        <button type="button" onClick={() => onChange(!value)} className="flex items-center gap-2">
            {value ? <ToggleRight className="w-7 h-7 text-green-600" /> : <ToggleLeft className="w-7 h-7 text-stone-300" />}
            <span className={`text-xs font-medium ${value ? 'text-green-700' : 'text-stone-400'}`}>
                {value ? labels[0] : labels[1]}
            </span>
        </button>
    );
}

function EmptyState({ icon: Icon = Building2, title, subtitle }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
            <Icon size={40} className="mb-3 text-stone-300" />
            <p className="text-sm font-semibold text-stone-700">{title}</p>
            <p className="text-xs text-stone-400 mt-1">{subtitle}</p>
        </div>
    );
}

function BenefactorTemplateModal({
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
                className="w-full max-w-4xl border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">
                            {isEdit ? 'Edit Scholarship Program Template' : 'Add Scholarship Program Template'}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Configure the reusable scholarship program definition used by Scholarship Openings
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

                <CardContent className="p-5 space-y-5">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-sm font-medium text-stone-800">Template publication behavior</p>
                        <p className="text-xs text-stone-500 mt-1">
                            Published templates appear in Scholarship Openings. Draft templates stay in maintenance until finished.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <FieldLabel>Sponsor Type</FieldLabel>
                            <Select
                                value={form.benefactor_type}
                                onValueChange={(value) => setForm((prev) => ({ ...prev, benefactor_type: value }))}
                            >
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                                    <SelectValue placeholder="Select sponsor type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Public">Public</SelectItem>
                                    <SelectItem value="Private">Private</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Benefactor Name</FieldLabel>
                            <Input
                                value={form.organization_name}
                                onChange={(e) => setForm((prev) => ({ ...prev, organization_name: e.target.value }))}
                                placeholder="e.g. CHED / Kaizen Corporation"
                                className="h-10 rounded-lg border-stone-200 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <FieldLabel>Program Name</FieldLabel>
                            <Input
                                value={form.program_name}
                                onChange={(e) => setForm((prev) => ({ ...prev, program_name: e.target.value }))}
                                placeholder="e.g. TES - Tertiary Education Subsidy"
                                className="h-10 rounded-lg border-stone-200 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <FieldLabel>Description</FieldLabel>
                            <Textarea
                                value={form.description}
                                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                placeholder="Reusable opening description, eligibility notes, reminders, or admin guidance..."
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
                            <FieldLabel>Template Status</FieldLabel>
                            <Select
                                value={form.visibility_status}
                                onValueChange={(value) => setForm((prev) => ({ ...prev, visibility_status: value }))}
                            >
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Published">Published</SelectItem>
                                    <SelectItem value="Draft">Draft</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-stone-400">
                                Published = usable in openings. Draft = keep unfinished template private.
                            </p>
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
                            disabled={saving || !form.organization_name || !form.program_name || !form.benefactor_type}
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

function CourseModal({
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
                            {isEdit ? 'Edit Academic Course' : 'Add Academic Course'}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Maintain course codes, names, and department assignments
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

                <CardContent className="p-5 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <FieldLabel>Course Code</FieldLabel>
                            <Input
                                value={form.course_code}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        course_code: e.target.value.toUpperCase(),
                                    }))
                                }
                                placeholder="e.g. BSIT"
                                className="h-10 rounded-lg border-stone-200 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Department</FieldLabel>
                            <Select
                                value={form.department}
                                onValueChange={(value) =>
                                    setForm((prev) => ({ ...prev, department: value }))
                                }
                            >
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CCS">CCS</SelectItem>
                                    <SelectItem value="CHT">CHT</SelectItem>
                                    <SelectItem value="COED">COED</SelectItem>
                                    <SelectItem value="COA">COA</SelectItem>
                                    <SelectItem value="OTHER">OTHER</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                            <FieldLabel>Course Name</FieldLabel>
                            <Input
                                value={form.course_name}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, course_name: e.target.value }))
                                }
                                placeholder="e.g. Bachelor of Science in Information Technology"
                                className="h-10 rounded-lg border-stone-200 text-sm"
                            />
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
                            disabled={saving || !form.course_code || !form.course_name || !form.department}
                            className="h-9 rounded-lg text-white text-xs border-none disabled:opacity-50"
                            style={{ background: C.brownMid }}
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            {isEdit ? 'Save Changes' : 'Create Course'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function GeneralPanel() {
    const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');
    const [appOpen, setAppOpen] = useState(true);
    const [saved, setSaved] = useState(false);

    // mock admin account data for now
    // later, replace with fetch from backend
    const [adminAccount, setAdminAccount] = useState({
        first_name: 'Carmelita',
        last_name: 'Dela Cruz',
        email: 'cdelacruz@pdm.edu.ph',
        phone_number: '+63 917 123 4567',
        position: 'OSFA Administrator',
        department: 'OSFA',
        role: 'Super Admin',
        is_active: true,
    });

    const handleSaveGeneral = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleAdminFieldChange = (field, value) => {
        setAdminAccount((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSaveAdminAccount = async () => {
        try {
            // TODO:
            // replace with your actual backend endpoint for updating admin profile/account
            // example:
            // await fetch('http://localhost:5000/api/admin/account', { ... })

            alert('Admin account changes are ready to be connected to backend.');
        } catch (err) {
            console.error('ADMIN ACCOUNT SAVE ERROR:', err);
            alert('Failed to save admin account changes');
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-stone-900">General Configuration</h2>
                    <p className="text-sm text-stone-500">
                        System-wide preferences, institutional identity, and admin account settings
                    </p>
                </div>

                <Button
                    onClick={handleSaveGeneral}
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
                            <Input
                                value={instName}
                                onChange={(e) => setInstName(e.target.value)}
                                className="rounded-lg bg-stone-50/50 border-stone-200"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Office Email</FieldLabel>
                            <Input
                                defaultValue="osfa@pdm.edu.ph"
                                className="rounded-lg bg-stone-50/50 border-stone-200"
                            />
                        </div>
                    </div>
                </GroupCard>

                <GroupCard title="Application Window" icon={Calendar}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                            <div>
                                <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wide">
                                    Status
                                </p>
                                <Toggle
                                    value={appOpen}
                                    onChange={setAppOpen}
                                    labels={['Registration Open', 'Registration Closed']}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Global Deadline</FieldLabel>
                            <Input
                                type="date"
                                defaultValue="2026-03-31"
                                className="rounded-lg bg-stone-50/50 border-stone-200"
                            />
                        </div>
                    </div>
                </GroupCard>
            </div>

            {/* NEW: ADMIN ACCOUNT MANAGEMENT */}
            <GroupCard title="Admin Account Management" icon={User}>
                <div className="space-y-5">
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                        <p className="text-sm font-medium text-amber-800">
                            Profile editing is managed here under General Maintenance.
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                            Use this section to update the current admin account information shown in the profile page.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <FieldLabel>First Name</FieldLabel>
                            <Input
                                value={adminAccount.first_name}
                                onChange={(e) => handleAdminFieldChange('first_name', e.target.value)}
                                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Last Name</FieldLabel>
                            <Input
                                value={adminAccount.last_name}
                                onChange={(e) => handleAdminFieldChange('last_name', e.target.value)}
                                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Email Address</FieldLabel>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <Input
                                    value={adminAccount.email}
                                    onChange={(e) => handleAdminFieldChange('email', e.target.value)}
                                    className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50 pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Phone Number</FieldLabel>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <Input
                                    value={adminAccount.phone_number}
                                    onChange={(e) => handleAdminFieldChange('phone_number', e.target.value)}
                                    className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50 pl-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Position</FieldLabel>
                            <Input
                                value={adminAccount.position}
                                onChange={(e) => handleAdminFieldChange('position', e.target.value)}
                                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <FieldLabel>Department</FieldLabel>
                            <Input
                                value={adminAccount.department}
                                onChange={(e) => handleAdminFieldChange('department', e.target.value)}
                                className="h-10 rounded-lg border-stone-200 text-sm bg-stone-50/50"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-stone-400">Role</p>
                            <p className="text-sm font-medium text-stone-800 mt-1">{adminAccount.role}</p>
                        </div>

                        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-stone-400">Account Status</p>
                            <p className="text-sm font-medium text-stone-800 mt-1">
                                {adminAccount.is_active ? 'Active' : 'Inactive'}
                            </p>
                        </div>

                        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-wide text-stone-400">Display Name</p>
                            <p className="text-sm font-medium text-stone-800 mt-1">
                                {adminAccount.first_name} {adminAccount.last_name}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                            variant="outline"
                            className="h-9 rounded-lg border-stone-200 text-xs"
                            onClick={() =>
                                setAdminAccount({
                                    first_name: 'Carmelita',
                                    last_name: 'Dela Cruz',
                                    email: 'cdelacruz@pdm.edu.ph',
                                    phone_number: '+63 917 123 4567',
                                    position: 'OSFA Administrator',
                                    department: 'OSFA',
                                    role: 'Super Admin',
                                    is_active: true,
                                })
                            }
                        >
                            Reset
                        </Button>

                        <Button
                            onClick={handleSaveAdminAccount}
                            className="h-9 rounded-lg text-white text-xs border-none"
                            style={{ background: C.brownMid }}
                        >
                            <Save className="w-4 h-4 mr-2" />
                            Save Admin Account
                        </Button>
                    </div>
                </div>
            </GroupCard>
        </div>
    );
}

function BenefactorTemplatesPanel() {
    const [benefactors, setBenefactors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [archiveFilter, setArchiveFilter] = useState('Active');
    const [sponsorTypeFilter, setSponsorTypeFilter] = useState('All');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingBenefactorId, setEditingBenefactorId] = useState(null);

    const emptyForm = {
        benefactor_type: 'Public',
        organization_name: '',
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

            const res = await fetch('http://localhost:5000/api/scholarship-program', {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) throw new Error('Failed to load benefactors');

            const data = await res.json();
            setBenefactors(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('BENEFACTORS FETCH ERROR:', err);
            alert(err.message || 'Failed to load benefactors');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const stats = useMemo(() => {
        return {
            total: benefactors.length,
            published: benefactors.filter((b) => (b.visibility_status || '').toLowerCase() === 'published').length,
            drafts: benefactors.filter((b) => (b.visibility_status || '').toLowerCase() === 'draft').length,
            archived: benefactors.filter((b) => !!b.is_archived).length,
        };
    }, [benefactors]);

    const filteredBenefactors = useMemo(() => {
        const q = search.trim().toLowerCase();

        return benefactors.filter((b) => {
            const matchSearch =
                !q ||
                (b.organization_name || '').toLowerCase().includes(q) ||
                (b.program_name || '').toLowerCase().includes(q);

            const matchStatus =
                statusFilter === 'All' ||
                (b.visibility_status || '').toLowerCase() === statusFilter.toLowerCase();

            const matchSponsorType =
                sponsorTypeFilter === 'All' ||
                (b.benefactor_type || '').toLowerCase() === sponsorTypeFilter.toLowerCase();

            const matchArchive =
                archiveFilter === 'All' ||
                (archiveFilter === 'Active' && !b.is_archived) ||
                (archiveFilter === 'Archived' && !!b.is_archived);

            return matchSearch && matchStatus && matchSponsorType && matchArchive;
        });
    }, [benefactors, search, statusFilter, sponsorTypeFilter, archiveFilter]);

    const openCreateModal = () => {
        setModalMode('create');
        setEditingBenefactorId(null);
        setForm(emptyForm);
        setModalOpen(true);
    };

    const openEditModal = (benefactor) => {
        setModalMode('edit');
        setEditingBenefactorId(benefactor.program_id);
        setForm({
            benefactor_type: benefactor.benefactor_type || 'Public',
            organization_name: benefactor.organization_name || '',
            program_name: benefactor.program_name || '',
            description: benefactor.description || '',
            gwa_threshold: benefactor.gwa_threshold ?? '',
            requires_ro: !!benefactor.requires_ro,
            renewal_cycle: benefactor.renewal_cycle || 'Semester',
            visibility_status: benefactor.visibility_status || 'Published',
            is_archived: !!benefactor.is_archived,
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const payload = {
                benefactor_type: form.benefactor_type,
                organization_name: form.organization_name,
                program_name: form.program_name,
                description: form.description || null,
                gwa_threshold: Number(form.gwa_threshold || 0),
                requires_ro: !!form.requires_ro,
                renewal_cycle: form.renewal_cycle || 'Semester',
                visibility_status: form.visibility_status || 'Published',
                is_archived: !!form.is_archived,
            };

            const isEdit = modalMode === 'edit' && editingBenefactorId;
            const url = isEdit
                ? `http://localhost:5000/api/scholarship-program/${editingBenefactorId}`
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
                throw new Error(data.error || 'Failed to save benefactor');
            }

            setModalOpen(false);
            setEditingBenefactorId(null);
            setForm(emptyForm);
            await fetchData();
        } catch (err) {
            console.error('SAVE BENEFACTOR ERROR:', err);
            alert(err.message || 'Failed to save benefactor');
        } finally {
            setSaving(false);
        }
    };

    const handleArchiveToggle = async (benefactor) => {
        try {
            const res = await fetch(`http://localhost:5000/api/scholarship-program/${benefactor.program_id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_archived: !benefactor.is_archived,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Failed to update archive status');
            }

            await fetchData();
        } catch (err) {
            console.error('ARCHIVE BENEFACTOR ERROR:', err);
            alert(err.message || 'Failed to update archive status');
        }
    };

    return (
        <div className="space-y-5">
            <BenefactorTemplateModal
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
                    <h2 className="text-lg font-semibold text-stone-900">Benefactor Templates</h2>
                    <p className="text-sm text-stone-500">
                        Reusable benefactor + program definitions used by the Scholarship Openings page
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
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.published}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Published Templates</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.blueSoft }}>
                            <Briefcase className="w-4 h-4 text-blue-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.drafts}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Draft Templates</p>
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
                        placeholder="Search by benefactor or program..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
                    />
                </div>

                <Select value={sponsorTypeFilter} onValueChange={setSponsorTypeFilter}>
                    <SelectTrigger className="w-[150px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Sponsors</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
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

                {(search || sponsorTypeFilter !== 'All' || statusFilter !== 'All' || archiveFilter !== 'Active') && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSearch('');
                            setSponsorTypeFilter('All');
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
                        <CardTitle className="text-sm font-semibold text-stone-800">Benefactor Template Registry</CardTitle>
                        <CardDescription className="text-xs">
                            Published templates are available in Scholarship Openings. Drafts stay here until ready.
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[240px] gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
                            <p className="text-xs text-stone-400 uppercase tracking-widest">
                                Loading benefactor templates...
                            </p>
                        </div>
                    ) : filteredBenefactors.length === 0 ? (
                        <EmptyState
                            icon={Building2}
                            title="No benefactor templates found"
                            subtitle="Create a reusable benefactor record here first, then use it in Scholarship Openings."
                        />
                    ) : (
                        <div className="space-y-3">
                            {filteredBenefactors.map((b) => {
                                const isPublished = (b.visibility_status || '').toLowerCase() === 'published';
                                const isPublic = (b.benefactor_type || '').toLowerCase() === 'public';

                                return (
                                    <div
                                        key={b.program_id}
                                        className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition-colors"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm font-semibold text-stone-900">
                                                        {b.organization_name}
                                                    </h3>

                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] border-stone-200 bg-white text-stone-600"
                                                    >
                                                        {b.program_name || 'No Program'}
                                                    </Badge>

                                                    <span
                                                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${isPublic
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'bg-amber-50 text-amber-700'
                                                            }`}
                                                    >
                                                        {isPublic ? 'Public Sponsor' : 'Private Sponsor'}
                                                    </span>

                                                    <span
                                                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${isPublished
                                                            ? 'bg-green-50 text-green-700'
                                                            : 'bg-stone-100 text-stone-500'
                                                            }`}
                                                    >
                                                        {isPublished ? 'Published' : 'Draft'}
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

                                        <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
                                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                                <p className="text-[10px] uppercase tracking-wide text-stone-400">Benefactor Type</p>
                                                <p className="text-sm font-medium text-stone-800 mt-1">{b.benefactor_type || 'N/A'}</p>
                                            </div>

                                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                                <p className="text-[10px] uppercase tracking-wide text-stone-400">Program</p>
                                                <p className="text-sm font-medium text-stone-800 mt-1">{b.program_name || 'N/A'}</p>
                                            </div>

                                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                                <p className="text-[10px] uppercase tracking-wide text-stone-400">GWA Threshold</p>
                                                <p className="text-sm font-medium text-stone-800 mt-1">{b.gwa_threshold ?? 'N/A'}</p>
                                            </div>

                                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                                <p className="text-[10px] uppercase tracking-wide text-stone-400">RO</p>
                                                <p className="text-sm font-medium text-stone-800 mt-1">
                                                    {b.requires_ro ? 'Required' : 'Not Required'}
                                                </p>
                                            </div>

                                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                                <p className="text-[10px] uppercase tracking-wide text-stone-400">Renewal Cycle</p>
                                                <p className="text-sm font-medium text-stone-800 mt-1">
                                                    {b.renewal_cycle || 'N/A'}
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

function CoursesPanel() {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [archiveFilter, setArchiveFilter] = useState('Active');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingCourseId, setEditingCourseId] = useState(null);

    const emptyForm = {
        course_code: '',
        course_name: '',
        department: '',
        is_archived: false,
    };

    const [form, setForm] = useState(emptyForm);

    const fetchCourses = async () => {
        try {
            setLoading(true);

            const res = await fetch('http://localhost:5000/api/courses', {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) throw new Error('Failed to load courses');

            const data = await res.json();
            setCourses(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('COURSES FETCH ERROR:', err);
            alert(err.message || 'Failed to load courses');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourses();
    }, []);

    const stats = useMemo(() => {
        return {
            total: courses.length,
            active: courses.filter((c) => !c.is_archived).length,
            archived: courses.filter((c) => !!c.is_archived).length,
            departments: new Set(courses.map((c) => c.department).filter(Boolean)).size,
        };
    }, [courses]);

    const filteredCourses = useMemo(() => {
        const q = search.trim().toLowerCase();

        return courses.filter((c) => {
            const matchSearch =
                !q ||
                (c.course_code || '').toLowerCase().includes(q) ||
                (c.course_name || '').toLowerCase().includes(q) ||
                (c.department || '').toLowerCase().includes(q);

            const matchDepartment =
                departmentFilter === 'All' ||
                (c.department || '').toLowerCase() === departmentFilter.toLowerCase();

            const matchArchive =
                archiveFilter === 'All' ||
                (archiveFilter === 'Active' && !c.is_archived) ||
                (archiveFilter === 'Archived' && !!c.is_archived);

            return matchSearch && matchDepartment && matchArchive;
        });
    }, [courses, search, departmentFilter, archiveFilter]);

    const openCreateModal = () => {
        setModalMode('create');
        setEditingCourseId(null);
        setForm(emptyForm);
        setModalOpen(true);
    };

    const openEditModal = (course) => {
        setModalMode('edit');
        setEditingCourseId(course.course_id);
        setForm({
            course_code: course.course_code || '',
            course_name: course.course_name || '',
            department: course.department || '',
            is_archived: !!course.is_archived,
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const payload = {
                course_code: form.course_code.trim(),
                course_name: form.course_name.trim(),
                department: form.department,
                is_archived: !!form.is_archived,
            };

            const isEdit = modalMode === 'edit' && editingCourseId;
            const url = isEdit
                ? `http://localhost:5000/api/courses/${editingCourseId}`
                : 'http://localhost:5000/api/courses';

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
                throw new Error(data.error || 'Failed to save course');
            }

            setModalOpen(false);
            setEditingCourseId(null);
            setForm(emptyForm);
            await fetchCourses();
        } catch (err) {
            console.error('SAVE COURSE ERROR:', err);
            alert(err.message || 'Failed to save course');
        } finally {
            setSaving(false);
        }
    };

    const handleArchiveToggle = async (course) => {
        try {
            const res = await fetch(`http://localhost:5000/api/courses/${course.course_id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_archived: !course.is_archived,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Failed to update course status');
            }

            await fetchCourses();
        } catch (err) {
            console.error('ARCHIVE COURSE ERROR:', err);
            alert(err.message || 'Failed to update course status');
        }
    };

    return (
        <div className="space-y-5">
            <CourseModal
                open={modalOpen}
                mode={modalMode}
                form={form}
                setForm={setForm}
                onClose={() => {
                    setModalOpen(false);
                    setEditingCourseId(null);
                }}
                onSave={handleSave}
                saving={saving}
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-stone-900">Academic Courses</h2>
                    <p className="text-sm text-stone-500">
                        Manage academic course registry used across student and scholar records
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={fetchCourses}
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
                        Add Course
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.amberSoft }}>
                            <BookOpen className="w-4 h-4 text-amber-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.total}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Total Courses</p>
                    </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.greenSoft }}>
                            <ShieldCheck className="w-4 h-4 text-green-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.active}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Active Courses</p>
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

                <Card className="border-stone-200 shadow-none">
                    <CardContent className="p-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: C.blueSoft }}>
                            <Building2 className="w-4 h-4 text-blue-700" />
                        </div>
                        <div className="text-2xl font-semibold text-stone-900 mt-3">{stats.departments}</div>
                        <p className="text-xs text-stone-500 mt-0.5">Departments</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[260px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
                    <Input
                        placeholder="Search by code, course name, or department..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
                    />
                </div>

                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[150px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Departments</SelectItem>
                        <SelectItem value="CCS">CCS</SelectItem>
                        <SelectItem value="CHT">CHT</SelectItem>
                        <SelectItem value="COED">COED</SelectItem>
                        <SelectItem value="COA">COA</SelectItem>
                        <SelectItem value="OTHER">OTHER</SelectItem>
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

                {(search || departmentFilter !== 'All' || archiveFilter !== 'Active') && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSearch('');
                            setDepartmentFilter('All');
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
                        <CardTitle className="text-sm font-semibold text-stone-800">Course Registry</CardTitle>
                        <CardDescription className="text-xs">
                            Manage available academic courses and archive obsolete ones without deleting them
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[240px] gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
                            <p className="text-xs text-stone-400 uppercase tracking-widest">
                                Loading academic courses...
                            </p>
                        </div>
                    ) : filteredCourses.length === 0 ? (
                        <EmptyState
                            icon={BookOpen}
                            title="No academic courses found"
                            subtitle="Create course entries here so they can be used in student, scholar, and application records."
                        />
                    ) : (
                        <div className="space-y-3">
                            {filteredCourses.map((course) => (
                                <div
                                    key={course.course_id}
                                    className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition-colors"
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm font-semibold text-stone-900">
                                                    {course.course_code}
                                                </h3>

                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] border-stone-200 bg-white text-stone-600"
                                                >
                                                    {course.department || 'No Department'}
                                                </Badge>

                                                {!course.is_archived ? (
                                                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                                                        Archived
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                                                {course.course_name || 'No course name available.'}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 px-3 rounded-lg border-stone-200 text-stone-600 hover:bg-stone-50 text-xs shadow-none"
                                                onClick={() => openEditModal(course)}
                                            >
                                                <Edit className="w-3.5 h-3.5 mr-1.5" />
                                                Edit
                                            </Button>

                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className={`h-8 px-3 rounded-lg text-xs shadow-none ${course.is_archived
                                                    ? 'border-green-200 text-green-700 hover:bg-green-50'
                                                    : 'border-red-200 text-red-700 hover:bg-red-50'
                                                    }`}
                                                onClick={() => handleArchiveToggle(course)}
                                            >
                                                {course.is_archived ? (
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
                            ))}
                        </div>
                    )}
                </CardContent>
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
                        <Toggle value={false} onChange={() => { }} labels={['Offline', 'Online']} />
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

export default function SettingsMaintenance() {
    const [tab, setTab] = useState('general');

    const TABS = [
        { key: 'general', label: 'General', icon: SlidersHorizontal },
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
                            type="button"
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
                    {tab === 'benefactors' && <BenefactorTemplatesPanel />}
                    {tab === 'courses' && <CoursesPanel />}
                    {tab === 'system' && <SystemPanel />}
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