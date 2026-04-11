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
    Building2,
    BookOpen,
    SlidersHorizontal,
    Cpu,
    ClipboardList,
    Plus,
    Edit,
    Activity,
    Globe,
    Database,
    RefreshCw,
    Save,
    X,
    Calendar,
    Settings,
    Loader2,
    Check,
    ToggleLeft,
    ToggleRight,
    Search,
    Archive,
    ShieldCheck,
    Briefcase,
    User,
    Mail,
    Phone,
    Users as UsersIcon,
    GraduationCap,
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
            {value ? (
                <ToggleRight className="w-7 h-7 text-green-600" />
            ) : (
                <ToggleLeft className="w-7 h-7 text-stone-300" />
            )}
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
                        disabled={
                            saving ||
                            !form.benefactor_name?.trim() ||
                            !form.benefactor_type
                        }
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
    const noGwaThreshold = form.gwa_threshold === null || form.gwa_threshold === '';

    const handleToggleNoGwaThreshold = (value) => {
        setForm((prev) => ({
            ...prev,
            gwa_threshold: value ? null : '',
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
                                            <SelectItem
                                                key={b.benefactor_id}
                                                value={b.benefactor_id}
                                            >
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
                        disabled={
                            saving ||
                            !form.program_name?.trim() ||
                            !form.benefactor_id
                        }
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

function CourseModal({
    open,
    mode,
    form,
    setForm,
    onClose,
    onSave,
    saving,
    departments = [],
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
                                value={form.department_id}
                                onValueChange={(value) =>
                                    setForm((prev) => ({ ...prev, department_id: value }))
                                }
                            >
                                <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>

                                <SelectContent>
                                    {departments.length === 0 ? (
                                        <SelectItem value="NO_DEPARTMENT" disabled>
                                            No departments available
                                        </SelectItem>
                                    ) : (
                                        departments.map((dept) => (
                                            <SelectItem
                                                key={dept.department_id}
                                                value={dept.department_id}
                                            >
                                                {dept.department_code}
                                                {dept.department_name ? ` - ${dept.department_name}` : ''}
                                            </SelectItem>
                                        ))
                                    )}
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
                            disabled={saving || !form.course_code || !form.course_name || !form.department_id}
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

function DepartmentModal({
    open,
    code,
    setCode,
    name,
    setName,
    onClose,
    onSave,
    saving,
}) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-md border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">Add Department</h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Create a new department option for academic courses
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
                    <div className="space-y-1.5">
                        <FieldLabel>Department Code</FieldLabel>
                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="e.g. CCS"
                            className="h-10 rounded-lg border-stone-200 text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <FieldLabel>Department Full Name</FieldLabel>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. College of Computer Studies"
                            className="h-10 rounded-lg border-stone-200 text-sm"
                        />
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
                            disabled={saving || !code.trim()}
                            className="h-9 rounded-lg text-white text-xs border-none disabled:opacity-50"
                            style={{ background: C.brownMid }}
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4 mr-2" />
                            )}
                            Add Department
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

function BenefactorsPanel() {
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

function ProgramsPanel() {
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
            const benefactorName =
                p.benefactor_name ||
                benefactorNameMap[p.benefactor_id] ||
                '';

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

            return (
                matchSearch &&
                matchStatus &&
                matchAudience &&
                matchBenefactor &&
                matchArchive
            );
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

            if (!payload.benefactor_id) {
                throw new Error('Benefactor is required');
            }

            if (!payload.program_name) {
                throw new Error('Program name is required');
            }

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
                                                    {p.visibility_status || 'N/A'}
                                                </p>
                                            </div>

                                            <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                                                <p className="text-[10px] uppercase tracking-wide text-stone-400">
                                                    Renewal Cycle
                                                </p>
                                                <p className="text-sm font-medium text-stone-800 mt-1">
                                                    {p.renewal_cycle || 'N/A'}
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
    const [departments, setDepartments] = useState([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [departmentSaving, setDepartmentSaving] = useState(false);

    const [search, setSearch] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [archiveFilter, setArchiveFilter] = useState('Active');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingCourseId, setEditingCourseId] = useState(null);

    const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
    const [newDepartmentCode, setNewDepartmentCode] = useState('');
    const [newDepartmentName, setNewDepartmentName] = useState('');

    const emptyForm = {
        course_code: '',
        course_name: '',
        department_id: '',
        is_archived: false,
    };

    const [form, setForm] = useState(emptyForm);

    const fetchDepartments = async () => {
        const res = await fetch('http://localhost:5000/api/departments', {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json',
            },
        });

        if (!res.ok) {
            throw new Error('Failed to load departments');
        }

        const data = await res.json();
        setDepartments(Array.isArray(data) ? data.filter((d) => !d.is_archived) : []);
    };

    const fetchCourses = async () => {
        const res = await fetch('http://localhost:5000/api/courses', {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                'Content-Type': 'application/json',
            },
        });

        if (!res.ok) {
            throw new Error('Failed to load courses');
        }

        const data = await res.json();
        setCourses(Array.isArray(data) ? data : []);
    };

    const loadAll = async () => {
        try {
            setLoading(true);
            await Promise.all([fetchCourses(), fetchDepartments()]);
        } catch (err) {
            console.error('COURSES/DEPARTMENTS FETCH ERROR:', err);
            alert(err.message || 'Failed to load maintenance data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
    }, []);

    const stats = useMemo(() => {
        return {
            total: courses.length,
            active: courses.filter((c) => !c.is_archived).length,
            archived: courses.filter((c) => !!c.is_archived).length,
            departments: new Set(courses.map((c) => c.department_id).filter(Boolean)).size,
        };
    }, [courses]);

    const filteredCourses = useMemo(() => {
        const q = search.trim().toLowerCase();

        return courses.filter((c) => {
            const badgeLabel = c.department
                ? `${c.department}${c.department_name ? ` - ${c.department_name}` : ''}`
                : '';

            const matchSearch =
                !q ||
                (c.course_code || '').toLowerCase().includes(q) ||
                (c.course_name || '').toLowerCase().includes(q) ||
                badgeLabel.toLowerCase().includes(q) ||
                (c.department || '').toLowerCase().includes(q) ||
                (c.department_name || '').toLowerCase().includes(q);

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
            department_id: course.department_id || '',
            is_archived: !!course.is_archived,
        });
        setModalOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);

            const payload = {
                course_code: form.course_code.trim().toUpperCase(),
                course_name: form.course_name.trim(),
                department_id: form.department_id,
                is_archived: !!form.is_archived,
            };

            if (!payload.course_code) {
                throw new Error('Course code is required');
            }

            if (!payload.course_name) {
                throw new Error('Course name is required');
            }

            if (!payload.department_id) {
                throw new Error('Department is required');
            }

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
                throw new Error(data.error || data.message || 'Failed to save course');
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

    const handleAddDepartment = async () => {
        try {
            setDepartmentSaving(true);

            const trimmedCode = newDepartmentCode.trim().toUpperCase();
            const trimmedName = newDepartmentName.trim();

            if (!trimmedCode) {
                alert('Department code is required');
                return;
            }

            const res = await fetch('http://localhost:5000/api/departments', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    department_code: trimmedCode,
                    department_name: trimmedName || null,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to add department');
            }

            setNewDepartmentCode('');
            setNewDepartmentName('');
            setDepartmentModalOpen(false);
            await fetchDepartments();
        } catch (err) {
            console.error('ADD DEPARTMENT ERROR:', err);
            alert(err.message || 'Failed to add department');
        } finally {
            setDepartmentSaving(false);
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
                throw new Error(data.error || data.message || 'Failed to update course status');
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
                departments={departments}
            />

            <DepartmentModal
                open={departmentModalOpen}
                code={newDepartmentCode}
                setCode={setNewDepartmentCode}
                name={newDepartmentName}
                setName={setNewDepartmentName}
                onClose={() => {
                    setDepartmentModalOpen(false);
                    setNewDepartmentCode('');
                    setNewDepartmentName('');
                }}
                onSave={handleAddDepartment}
                saving={departmentSaving}
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
                        onClick={loadAll}
                        className="rounded-lg text-xs border-stone-200 text-stone-600"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        Refresh
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg text-xs border-stone-200 text-stone-600"
                        onClick={() => setDepartmentModalOpen(true)}
                    >
                        <Building2 className="w-3.5 h-3.5 mr-1.5" />
                        Add Department
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
                    <SelectTrigger className="w-[240px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Departments</SelectItem>
                        {departments.map((dept) => (
                            <SelectItem key={dept.department_id} value={dept.department_code}>
                                {dept.department_code}
                                {dept.department_name ? ` - ${dept.department_name}` : ''}
                            </SelectItem>
                        ))}
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
                        <CardTitle className="text-sm font-semibold text-stone-800">
                            Academic Course Registry
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Course entries used in student, scholar, and application records
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center min-h-[240px] gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-stone-300" />
                            <p className="text-xs text-stone-400 uppercase tracking-widest">
                                Loading courses...
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
                                                    {course.department
                                                        ? `${course.department}${course.department_name ? ` - ${course.department_name}` : ''}`
                                                        : 'No Department'}
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
        { key: 'programs', label: 'Programs', icon: GraduationCap },
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
                    {TABS.map((t) => (
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
                    {tab === 'benefactors' && <BenefactorsPanel />}
                    {tab === 'programs' && <ProgramsPanel />}
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