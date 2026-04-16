import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Plus,
    Search,
    Loader2,
    CalendarDays,
    FolderOpen,
    Pencil,
    Archive,
    X,
    CheckCircle2,
    Clock3,
    Sparkles,
    Megaphone,
    Layers3,
    EyeOff,
    RefreshCw,
    Users,
    Lock,
    Unlock,
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

const STATUS_META = {
    draft: { label: 'Draft', color: C.amber, bg: C.amberSoft },
    open: { label: 'Open', color: C.green, bg: C.greenSoft },
    closed: { label: 'Closed', color: C.red, bg: C.redSoft },
    archived: { label: 'Archived', color: '#57534e', bg: '#f5f5f4' },
    filled: { label: 'Filled', color: '#92400e', bg: '#FEF3C7' },
};

function fmtMoney(v) {
    const n = Number(v || 0);
    return `₱${n.toLocaleString()}`;
}

function normalizeAudience(value) {
    if (!value) return '';
    const raw = String(value).trim();

    if (raw === 'Applicants') return 'Applicants';
    if (raw === 'Scholars') return 'Scholars';
    if (
        raw === 'Both' ||
        raw === 'Applicants,Scholars' ||
        raw === 'Scholars,Applicants'
    ) {
        return 'Both';
    }

    return raw;
}

function deriveTargetAudience(source) {
    const normalized = normalizeAudience(source?.target_audience);
    if (normalized) return normalized;

    const joined = [
        source?.program_name,
        source?.benefactor_name,
        source?.opening_title,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    const isTES = /\btes\b|tertiary education subsidy/.test(joined);
    return isTES ? 'Both' : 'Applicants';
}

function targetAudienceLabel(value) {
    const normalized = normalizeAudience(value);

    if (normalized === 'Both') return 'Scholars & Applicants';
    if (normalized === 'Applicants') return 'Applicants';
    if (normalized === 'Scholars') return 'Scholars';
    return normalized || 'Applicants';
}

function getFilledSlots(openingLike = {}) {
    return Number(openingLike.qualified_count ?? openingLike.filled_slots ?? openingLike.filled_slots_preview ?? 0);
}

function getAllocatedSlots(openingLike = {}) {
    return Number(openingLike.allocated_slots || 0);
}

function getAvailableSlots(openingLike = {}) {
    return Math.max(0, getAllocatedSlots(openingLike) - getFilledSlots(openingLike));
}

function hasAvailableSlots(openingLike = {}) {
    return getAvailableSlots(openingLike) > 0;
}

function getComputedDisplayStatus(openingLike = {}) {
    const rawStatus = String(openingLike.posting_status || 'draft').toLowerCase();
    const allocated = getAllocatedSlots(openingLike);
    const filled = getFilledSlots(openingLike);

    if (rawStatus === 'archived') return 'archived';
    if (rawStatus === 'closed') return 'closed';
    if (rawStatus === 'draft') return 'draft';
    if (allocated > 0 && filled >= allocated) return 'filled';
    return 'open';
}

function derivePersistedOpeningStatus(payload, existingStatus = '') {
    const normalizedExisting = String(existingStatus || '').toLowerCase();

    if (normalizedExisting === 'archived') return 'archived';
    if (normalizedExisting === 'closed') return 'closed';

    const hasRequiredFields =
        !!payload.opening_title &&
        !!payload.program_id &&
        !!payload.academic_year_id &&
        Number(payload.allocated_slots || 0) > 0;

    if (!hasRequiredFields) return 'draft';

    return 'open';
}

function StatCard({ label, value, icon: Icon, accent, soft }) {
    return (
        <Card className="border-stone-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: soft }}
                >
                    <Icon className="w-4 h-4" style={{ color: accent }} />
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                <div className="text-2xl font-semibold" style={{ color: C.text }}>
                    {value}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{label}</p>
            </CardContent>
        </Card>
    );
}

function EmptyState({ icon: Icon, title, subtitle }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
            <Icon size={40} className="mb-3 text-stone-300" />
            <p className="text-sm font-semibold text-stone-700">{title}</p>
            <p className="text-xs text-stone-400 mt-1">{subtitle}</p>
        </div>
    );
}

function OpeningModal({
    open,
    mode,
    form,
    setForm,
    template,
    academicYears,
    onClose,
    onSave,
    saving,
}) {
    if (!open) return null;

    const isEdit = mode === 'edit';
    const title = isEdit ? 'Edit Scholarship Opening' : 'Open Program for New Batch';
    const previewStatus = getComputedDisplayStatus({
        ...form,
        posting_status: derivePersistedOpeningStatus(form, form.posting_status),
    });

    const allocatedSlots = Number(form.allocated_slots) || 0;
    const totalFinancial = Number(form.financial_allocation) || 0;
    const perScholarFinancial =
        allocatedSlots > 0 && totalFinancial > 0
            ? Math.floor(totalFinancial / allocatedSlots)
            : 0;

    const audienceLabel = targetAudienceLabel(form.target_audience);
    const audienceTooltip =
        audienceLabel === 'Scholars & Applicants'
            ? 'Visible to both scholars and applicants'
            : audienceLabel === 'Scholars'
                ? 'Visible only to existing scholars'
                : 'Visible only to new applicants';

    const selectedAcademicYear =
        academicYears.find((y) => y.academic_year_id === form.academic_year_id) || null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-4xl max-h-[90vh] flex flex-col border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">{title}</h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            {isEdit
                                ? 'Update this scholarship opening'
                                : 'Create a live scholarship opening from the selected template'}
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {template && (
                        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                            <div className="flex items-start gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: C.blueSoft }}
                                >
                                    <Layers3 className="w-4 h-4" style={{ color: C.blueMid }} />
                                </div>

                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-semibold text-stone-800">
                                            {template.program_name || 'Untitled Program'}
                                        </p>

                                        <Badge variant="outline" className="text-[10px] border-stone-200 bg-white text-stone-600">
                                            {template.benefactor_name || 'No Organization'}
                                        </Badge>

                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] ${previewStatus === 'open'
                                                ? 'border-green-200 bg-green-50 text-green-700'
                                                : previewStatus === 'closed'
                                                    ? 'border-red-200 bg-red-50 text-red-700'
                                                    : previewStatus === 'filled'
                                                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                        : 'border-stone-200 bg-white text-stone-600'
                                                }`}
                                        >
                                            Preview Status: {STATUS_META[previewStatus]?.label || 'Draft'}
                                        </Badge>

                                        <Badge
                                            variant="outline"
                                            className="text-[10px] border-purple-200 bg-purple-50 text-purple-700"
                                            title={audienceTooltip}
                                        >
                                            <Users className="w-3 h-3 mr-1" />
                                            Audience: {audienceLabel}
                                        </Badge>
                                    </div>

                                    <p className="text-xs text-stone-500 mt-1">
                                        {template.description || 'No default description set.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-sm font-medium text-stone-800">Status behavior</p>
                        <p className="text-xs text-stone-500 mt-1">
                            Draft if incomplete. Open when ready. Filled is computed automatically when slots are fully used.
                            Closed is a manual admin action. Archived hides the opening.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-stone-800 border-b border-stone-200 pb-2">
                            Opening Information
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Opening Title
                                </label>
                                <Input
                                    value={form.opening_title}
                                    onChange={(e) => setForm((prev) => ({ ...prev, opening_title: e.target.value }))}
                                    placeholder="e.g. Kaizen Scholarship Opening 2025-2026"
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Target Audience
                                </label>
                                <Input
                                    value={audienceLabel}
                                    readOnly
                                    className="h-10 rounded-lg border-stone-200 bg-stone-100 text-sm font-medium"
                                    style={{ color: C.brownMid }}
                                />
                            </div>

                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Academic Year
                                </label>
                                <Select
                                    value={form.academic_year_id}
                                    onValueChange={(value) => {
                                        const selected = academicYears.find((y) => y.academic_year_id === value);
                                        setForm((prev) => ({
                                            ...prev,
                                            academic_year_id: value,
                                            academic_year: selected?.label || '',
                                        }));
                                    }}
                                >
                                    <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                                        <SelectValue placeholder="Select academic year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {academicYears.length === 0 ? (
                                            <SelectItem value="NO_YEAR" disabled>
                                                No academic years available
                                            </SelectItem>
                                        ) : (
                                            academicYears.map((year) => (
                                                <SelectItem key={year.academic_year_id} value={year.academic_year_id}>
                                                    {year.label}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Selected School Year
                                </label>
                                <Input
                                    value={selectedAcademicYear?.label || form.academic_year || ''}
                                    readOnly
                                    className="h-10 rounded-lg border-stone-200 bg-stone-100 text-sm font-medium"
                                    style={{ color: C.brownMid }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-stone-800 border-b border-stone-200 pb-2">
                            Financial and Slot Information
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Allocated Slots
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={form.allocated_slots}
                                    onChange={(e) => setForm((prev) => ({ ...prev, allocated_slots: e.target.value }))}
                                    placeholder="0"
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Total Financial Allocation (₱)
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={form.financial_allocation}
                                    onChange={(e) => setForm((prev) => ({ ...prev, financial_allocation: e.target.value }))}
                                    placeholder="0"
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Per Scholar Amount (₱)
                                </label>
                                <Input
                                    type="number"
                                    readOnly
                                    value={perScholarFinancial}
                                    className="h-10 rounded-lg border-stone-200 bg-stone-100 text-sm font-medium"
                                    style={{ color: C.brownMid }}
                                />
                            </div>
                        </div>

                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                            <p className="text-xs text-emerald-700">
                                <span className="font-semibold">Allocated Slots:</span> {allocatedSlots}
                                {' · '}
                                <span className="font-semibold">Per Scholar:</span> ₱{perScholarFinancial.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-stone-800 border-b border-stone-200 pb-2">
                            Opening Notes
                        </h4>
                        <Textarea
                            value={form.announcement_text}
                            onChange={(e) => setForm((prev) => ({ ...prev, announcement_text: e.target.value }))}
                            placeholder="Instructions, reminders, notes, or conditions..."
                            className="min-h-[120px] rounded-lg border-stone-200 text-sm resize-none"
                        />
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2 shrink-0">
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
                            !form.opening_title ||
                            !form.academic_year_id ||
                            !form.program_id
                        }
                        className="h-9 rounded-lg text-white text-xs border-none disabled:opacity-50"
                        style={{ background: C.brownMid }}
                    >
                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        {isEdit ? 'Save Changes' : 'Create Opening'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

function PostCreatePrompt({ open, opening, onClose, onCreateAnnouncement }) {
    if (!open || !opening) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-md border-stone-200 shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-stone-100 bg-stone-50">
                    <h3 className="text-base font-semibold text-stone-800">Opening Created</h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                        {opening.opening_title || 'Scholarship opening created successfully.'}
                    </p>
                </div>

                <CardContent className="p-5 space-y-4">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-sm font-medium text-stone-800">
                            Do you want to create an announcement for this opening now?
                        </p>
                        <p className="text-xs text-stone-500 mt-1">
                            This will redirect you to the announcements page with prefilled content.
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="h-9 rounded-lg border-stone-200 text-xs"
                        >
                            Skip for Now
                        </Button>
                        <Button
                            onClick={onCreateAnnouncement}
                            className="h-9 rounded-lg text-white text-xs border-none"
                            style={{ background: C.brownMid }}
                        >
                            <Megaphone className="w-4 h-4 mr-2" />
                            Create Announcement
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function ScholarshipOpenings() {
    const navigate = useNavigate();

    const [templates, setTemplates] = useState([]);
    const [openings, setOpenings] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All Statuses');
    const [programFilter, setProgramFilter] = useState('All Programs');
    const [audienceFilter, setAudienceFilter] = useState('All Audiences');

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [editingOpeningId, setEditingOpeningId] = useState(null);

    const [postCreateOpen, setPostCreateOpen] = useState(false);
    const [newOpeningForPrompt, setNewOpeningForPrompt] = useState(null);

    const emptyForm = {
        program_id: '',
        opening_title: '',
        academic_year_id: '',
        academic_year: '',
        allocated_slots: '',
        filled_slots_preview: 0,
        financial_allocation: '',
        announcement_text: '',
        posting_status: 'draft',
        target_audience: 'Applicants',
    };

    const [form, setForm] = useState(emptyForm);

    const fetchData = async () => {
        try {
            setLoading(true);

            const [templatesRes, openingsRes, academicYearsRes] = await Promise.all([
                fetch('http://localhost:5000/api/scholarship-program', {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }),
                fetch('http://localhost:5000/api/program-openings', {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }),
                fetch('http://localhost:5000/api/academic-years', {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                        'Content-Type': 'application/json',
                    },
                }),
            ]);

            if (!templatesRes.ok) throw new Error('Failed to load scholarship program templates');
            if (!openingsRes.ok) throw new Error('Failed to load scholarship openings');
            if (!academicYearsRes.ok) throw new Error('Failed to load academic years');

            const templatesData = await templatesRes.json();
            const openingsData = await openingsRes.json();
            const academicYearsData = await academicYearsRes.json();

            setAcademicYears(Array.isArray(academicYearsData) ? academicYearsData : []);

            setTemplates(
                Array.isArray(templatesData)
                    ? templatesData.filter(
                        (t) =>
                            !t.is_archived &&
                            String(t.visibility_status || '').toLowerCase() === 'published'
                    )
                    : []
            );

            setOpenings(Array.isArray(openingsData) ? openingsData : []);
        } catch (err) {
            console.error('SCHOLARSHIP OPENINGS FETCH ERROR:', err);
            alert(err.message || 'Failed to load scholarship openings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const visibleOpenings = useMemo(() => {
        return openings.filter((o) => {
            const status = String(o.posting_status || '').toLowerCase();

            const noCoreData =
                !o.opening_title &&
                !o.program_name &&
                Number(o.allocated_slots || 0) === 0 &&
                Number(o.financial_allocation || 0) === 0;

            if (noCoreData) return false;
            if (status === 'archived' && !o.opening_title) return false;

            return true;
        });
    }, [openings]);

    const programOptions = useMemo(() => {
        return ['All Programs', ...new Set(visibleOpenings.map((o) => o.program_name).filter(Boolean))];
    }, [visibleOpenings]);

    const audienceOptions = ['All Audiences', 'Applicants', 'Scholars', 'Both'];

    const filteredOpenings = useMemo(() => {
        const q = search.trim().toLowerCase();

        return visibleOpenings
            .filter((o) => {
                const computedStatus = getComputedDisplayStatus(o);

                const matchSearch =
                    !q ||
                    (o.opening_title || '').toLowerCase().includes(q) ||
                    (o.program_name || '').toLowerCase().includes(q) ||
                    (o.benefactor_name || '').toLowerCase().includes(q) ||
                    (o.academic_year || '').toLowerCase().includes(q);

                const matchStatus =
                    statusFilter === 'All Statuses' ||
                    computedStatus === statusFilter.toLowerCase();

                const matchProgram =
                    programFilter === 'All Programs' ||
                    (o.program_name || '') === programFilter;

                const openingAudience = normalizeAudience(o.target_audience) || 'Applicants';
                const matchAudience =
                    audienceFilter === 'All Audiences' ||
                    openingAudience === audienceFilter;

                return matchSearch && matchStatus && matchProgram && matchAudience;
            })
            .sort((a, b) => {
                const aCreated = a?.created_at ? new Date(a.created_at).getTime() : 0;
                const bCreated = b?.created_at ? new Date(b.created_at).getTime() : 0;

                if (bCreated !== aCreated) return bCreated - aCreated;

                const aUpdated = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
                const bUpdated = b?.updated_at ? new Date(b.updated_at).getTime() : 0;

                return bUpdated - aUpdated;
            });
    }, [visibleOpenings, search, statusFilter, programFilter, audienceFilter]);

    const stats = useMemo(() => {
        return {
            templates: templates.length,
            total: visibleOpenings.length,
            open: visibleOpenings.filter((o) => getComputedDisplayStatus(o) === 'open').length,
            draft: visibleOpenings.filter((o) => getComputedDisplayStatus(o) === 'draft').length,
        };
    }, [templates, visibleOpenings]);

    const openCreateFromTemplate = (template) => {
        const currentYear = new Date().getFullYear();
        const computedAudience = deriveTargetAudience(template);

        const existingDraft = openings.find(
            (o) =>
                o.program_id === template.program_id &&
                String(o.posting_status || '').toLowerCase() === 'draft'
        );

        if (existingDraft) {
            setModalMode('edit');
            setEditingOpeningId(existingDraft.opening_id);
            setActiveTemplate(template);
            setForm({
                program_id: existingDraft.program_id || template.program_id,
                opening_title: existingDraft.opening_title || `${template.program_name} ${currentYear}-${currentYear + 1}`,
                academic_year_id: existingDraft.academic_year_id || '',
                academic_year: existingDraft.academic_year || '',
                allocated_slots: existingDraft.allocated_slots ?? '',
                filled_slots_preview: existingDraft.qualified_count ?? existingDraft.filled_slots ?? 0,
                financial_allocation: existingDraft.financial_allocation ?? '',
                announcement_text: existingDraft.announcement_text ?? template.description ?? '',
                posting_status: existingDraft.posting_status || 'draft',
                target_audience: deriveTargetAudience(existingDraft),
            });
            setModalOpen(true);
            return;
        }

        setModalMode('create');
        setEditingOpeningId(null);
        setActiveTemplate(template);
        setForm({
            program_id: template.program_id,
            opening_title: `${template.program_name} ${currentYear}-${currentYear + 1}`,
            academic_year_id: '',
            academic_year: '',
            allocated_slots: '',
            filled_slots_preview: 0,
            financial_allocation: '',
            announcement_text: template.description || '',
            posting_status: 'draft',
            target_audience: computedAudience,
        });
        setModalOpen(true);
    };

    const openEditModal = (opening) => {
        setModalMode('edit');
        setEditingOpeningId(opening.opening_id);
        setActiveTemplate(
            templates.find((t) => t.program_id === opening.program_id) || null
        );

        setForm({
            program_id: opening.program_id || '',
            opening_title: opening.opening_title || '',
            academic_year_id: opening.academic_year_id || '',
            academic_year: opening.academic_year || '',
            allocated_slots: opening.allocated_slots ?? '',
            filled_slots_preview: opening.qualified_count ?? opening.filled_slots ?? 0,
            financial_allocation: opening.financial_allocation ?? '',
            announcement_text: opening.announcement_text || '',
            posting_status: opening.posting_status || 'draft',
            target_audience: deriveTargetAudience(opening),
        });

        setModalOpen(true);
    };

    const handleSaveOpening = async () => {
        try {
            if (!form.program_id) {
                alert('Program is required.');
                return;
            }

            if (!form.opening_title?.trim()) {
                alert('Opening title is required.');
                return;
            }

            if (!form.academic_year_id) {
                alert('Academic year is required.');
                return;
            }

            const allocatedSlots = Number(form.allocated_slots || 0);
            const financialAllocation = Number(form.financial_allocation || 0);
            const perScholarAmount =
                allocatedSlots > 0 && financialAllocation > 0
                    ? Math.floor(financialAllocation / allocatedSlots)
                    : 0;

            setSaving(true);

            const payload = {
                program_id: form.program_id,
                opening_title: form.opening_title.trim(),
                academic_year_id: form.academic_year_id || null,
                allocated_slots: allocatedSlots,
                financial_allocation: financialAllocation,
                per_scholar_amount: perScholarAmount,
                announcement_text: form.announcement_text?.trim() || null,
                posting_status: derivePersistedOpeningStatus(form, form.posting_status),
            };

            const isEdit = modalMode === 'edit' && editingOpeningId;
            const url = isEdit
                ? `http://localhost:5000/api/program-openings/${editingOpeningId}`
                : 'http://localhost:5000/api/program-openings';

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
                throw new Error(data.error || data.message || 'Failed to save scholarship opening');
            }

            setModalOpen(false);
            setForm(emptyForm);
            setEditingOpeningId(null);
            setActiveTemplate(null);
            await fetchData();

            if (!isEdit && String(payload.posting_status).toLowerCase() === 'open') {
                setNewOpeningForPrompt({
                    ...(data || payload),
                    target_audience: payload.target_audience,
                });
                setPostCreateOpen(true);
            }
        } catch (err) {
            console.error('SAVE OPENING ERROR:', err);
            alert(err.message || 'Failed to save scholarship opening');
        } finally {
            setSaving(false);
        }
    };

    const updateOpeningStatus = async (openingId, nextStatus) => {
        try {
            setActionLoadingId(openingId);

            const res = await fetch(`http://localhost:5000/api/program-openings/${openingId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ posting_status: nextStatus }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || data.message || 'Failed to update opening status');
            }

            await fetchData();
        } catch (err) {
            console.error('UPDATE OPENING STATUS ERROR:', err);
            alert(err.message || 'Failed to update opening status');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleArchiveOpening = async (openingId) => {
        await updateOpeningStatus(openingId, 'archived');
    };

    const handleCloseOpening = async (openingId) => {
        await updateOpeningStatus(openingId, 'closed');
    };

    const handleReopenOpening = async (opening) => {
        const availableSlots = getAvailableSlots(opening);

        if (availableSlots <= 0) {
            alert('This opening cannot be reopened because no slots are available.');
            return;
        }

        await updateOpeningStatus(opening.opening_id, 'open');
    };

    const handleCreateAnnouncementRedirect = () => {
        if (!newOpeningForPrompt) return;

        const params = new URLSearchParams({
            opening_title: newOpeningForPrompt.opening_title || '',
            announcement_text: newOpeningForPrompt.announcement_text || '',
            posting_status: newOpeningForPrompt.posting_status || '',
            opening_id: newOpeningForPrompt.opening_id || '',
            program_id: newOpeningForPrompt.program_id || '',
            academic_year: newOpeningForPrompt.academic_year || '',
            academic_year_id: newOpeningForPrompt.academic_year_id || '',
            target_audience:
                normalizeAudience(newOpeningForPrompt.target_audience) ||
                deriveTargetAudience(newOpeningForPrompt),
        });

        navigate(`/admin/announcements?prefill=opening&${params.toString()}`);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
                <p className="text-xs text-stone-400 uppercase tracking-widest">
                    Loading scholarship openings.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5 py-2" style={{ background: C.bg }}>
            <OpeningModal
                open={modalOpen}
                mode={modalMode}
                form={form}
                setForm={setForm}
                template={activeTemplate}
                academicYears={academicYears}
                onClose={() => {
                    setModalOpen(false);
                    setActiveTemplate(null);
                    setEditingOpeningId(null);
                    setForm(emptyForm);
                }}
                onSave={handleSaveOpening}
                saving={saving}
            />

            <PostCreatePrompt
                open={postCreateOpen}
                opening={newOpeningForPrompt}
                onClose={() => {
                    setPostCreateOpen(false);
                    setNewOpeningForPrompt(null);
                }}
                onCreateAnnouncement={handleCreateAnnouncementRedirect}
            />

            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-stone-900">Scholarship Openings</h1>
                    <p className="text-sm text-stone-500">
                        Open scholarship programs for a new academic year.
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
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <StatCard
                    label="Available Templates"
                    value={stats.templates}
                    icon={FolderOpen}
                    accent={C.blueMid}
                    soft={C.blueSoft}
                />
                <StatCard
                    label="Total Openings"
                    value={stats.total}
                    icon={CalendarDays}
                    accent={C.brownMid}
                    soft={C.amberSoft}
                />
                <StatCard
                    label="Open"
                    value={stats.open}
                    icon={CheckCircle2}
                    accent={C.green}
                    soft={C.greenSoft}
                />
                <StatCard
                    label="Draft"
                    value={stats.draft}
                    icon={Clock3}
                    accent={C.amber}
                    soft={C.amberSoft}
                />
            </div>

            <Card className="border-stone-200 shadow-none overflow-hidden">
                <CardHeader className="bg-stone-50/60 border-b border-stone-100">
                    <CardTitle className="text-sm font-semibold text-stone-800">Published Scholarship Program Templates</CardTitle>
                    <CardDescription className="text-xs">
                        Choose a published template below to create a scholarship opening.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                    {templates.length === 0 ? (
                        <EmptyState
                            icon={FolderOpen}
                            title="No published templates found"
                            subtitle="Create and publish scholarship programs first."
                        />
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {templates.map((template) => (
                                <div
                                    key={template.program_id}
                                    className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm font-semibold text-stone-900">
                                                    {template.program_name || 'Untitled Program'}
                                                </h3>
                                                <Badge variant="outline" className="text-[10px] border-stone-200 bg-white text-stone-600">
                                                    {template.benefactor_name || 'No Organization'}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] border-purple-200 bg-purple-50 text-purple-700"
                                                >
                                                    <Users className="w-3 h-3 mr-1" />
                                                    {targetAudienceLabel(template.target_audience || deriveTargetAudience(template))}
                                                </Badge>
                                            </div>

                                            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                                                {template.description || 'No description available.'}
                                            </p>
                                        </div>

                                        <Button
                                            size="sm"
                                            className="rounded-lg text-white text-xs border-none shrink-0"
                                            style={{ background: C.brownMid }}
                                            onClick={() => openCreateFromTemplate(template)}
                                        >
                                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                                            Open
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
                    <Input
                        placeholder="Search by opening title, program, benefactor, or academic year..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
                    />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All Statuses">All Statuses</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="filled">Filled</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={audienceFilter} onValueChange={setAudienceFilter}>
                    <SelectTrigger className="w-[170px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue placeholder="Target Audience" />
                    </SelectTrigger>
                    <SelectContent>
                        {audienceOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                                {option === 'Both' ? 'Scholars & Applicants' : option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={programFilter} onValueChange={setProgramFilter}>
                    <SelectTrigger className="w-[170px] h-9 rounded-lg border-stone-200 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {programOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                                {option}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {(search || statusFilter !== 'All Statuses' || audienceFilter !== 'All Audiences' || programFilter !== 'All Programs') && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSearch('');
                            setStatusFilter('All Statuses');
                            setAudienceFilter('All Audiences');
                            setProgramFilter('All Programs');
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
                        <CardTitle className="text-sm font-semibold text-stone-800">Opening Registry</CardTitle>
                        <CardDescription className="text-xs">
                            Active, draft, filled, closed, and archived scholarship openings.
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-4">
                    {filteredOpenings.length === 0 ? (
                        <EmptyState
                            icon={EyeOff}
                            title="No scholarship openings found"
                            subtitle="Open a scholarship program from a published template to create one."
                        />
                    ) : (
                        <div className="space-y-3">
                            {filteredOpenings.map((opening) => {
                                const computedStatus = getComputedDisplayStatus(opening);
                                const meta = STATUS_META[computedStatus] || STATUS_META.draft;
                                const audience = normalizeAudience(opening.target_audience) || 'Applicants';
                                const audienceLabelValue = targetAudienceLabel(audience);

                                const allocatedSlots = getAllocatedSlots(opening);
                                const filledSlots = getFilledSlots(opening);
                                const availableSlots = getAvailableSlots(opening);

                                const isArchived = computedStatus === 'archived';
                                const isClosed = computedStatus === 'closed';
                                const canReopen = isClosed && availableSlots > 0;
                                const isBusy = actionLoadingId === opening.opening_id;

                                return (
                                    <div
                                        key={opening.opening_id}
                                        className="rounded-xl border border-stone-200 bg-white p-4 hover:border-stone-300 transition-colors"
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm font-semibold text-stone-900">
                                                        {opening.opening_title || 'Untitled Opening'}
                                                    </h3>

                                                    <span
                                                        className="text-[10px] font-medium px-2.5 py-1 rounded-full"
                                                        style={{ color: meta.color, background: meta.bg }}
                                                    >
                                                        {meta.label}
                                                    </span>

                                                    <Badge variant="outline" className="text-[10px] border-stone-200 bg-white text-stone-600">
                                                        {opening.program_name || 'No Program'}
                                                    </Badge>

                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] ${audience === 'Both'
                                                            ? 'border-purple-200 bg-purple-50 text-purple-700'
                                                            : audience === 'Scholars'
                                                                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                                                : 'border-sky-200 bg-sky-50 text-sky-700'
                                                            }`}
                                                    >
                                                        <Users className="w-3 h-3 mr-1" />
                                                        {audienceLabelValue}
                                                    </Badge>
                                                </div>

                                                <p className="text-xs text-stone-500 mt-1">
                                                    {opening.benefactor_name || 'No Benefactor'}
                                                </p>

                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
                                                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide text-stone-400">Academic Year</p>
                                                        <p className="text-xs font-medium text-stone-800 mt-1">
                                                            {opening.academic_year || 'N/A'}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide text-stone-400">Allocated Slots</p>
                                                        <p className="text-xs font-medium text-stone-800 mt-1">
                                                            {allocatedSlots.toLocaleString()}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide text-stone-400">Filled Slots</p>
                                                        <p className="text-xs font-medium text-stone-800 mt-1">
                                                            {filledSlots.toLocaleString()}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide text-stone-400">Available Slots</p>
                                                        <p className="text-xs font-medium text-stone-800 mt-1">
                                                            {availableSlots.toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-3 mt-3">
                                                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide text-stone-400">Per Scholar</p>
                                                        <p className="text-xs font-medium text-stone-800 mt-1">
                                                            {fmtMoney(
                                                                opening.per_scholar_amount ??
                                                                (allocatedSlots > 0
                                                                    ? Math.floor(Number(opening.financial_allocation || 0) / allocatedSlots)
                                                                    : 0)
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide text-stone-400">Admin Control</p>
                                                        <p className="text-xs font-medium text-stone-800 mt-1">
                                                            {isClosed
                                                                ? canReopen
                                                                    ? 'Can reopen'
                                                                    : 'Closed — no slots available'
                                                                : computedStatus === 'filled'
                                                                    ? 'Auto-filled; still editable'
                                                                    : 'Active'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {opening.announcement_text && (
                                                    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide text-stone-400">Notes</p>
                                                        <p className="text-xs text-stone-700 mt-1 leading-relaxed">
                                                            {opening.announcement_text}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                {!isArchived && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openEditModal(opening)}
                                                        className="rounded-lg text-xs border-stone-200"
                                                        disabled={isBusy}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                                        Edit
                                                    </Button>
                                                )}

                                                {!isArchived && !isClosed && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleCloseOpening(opening.opening_id)}
                                                        className="rounded-lg text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                                                        disabled={isBusy}
                                                    >
                                                        {isBusy ? (
                                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                                        ) : (
                                                            <Lock className="w-3.5 h-3.5 mr-1.5" />
                                                        )}
                                                        Close
                                                    </Button>
                                                )}

                                                {!isArchived && isClosed && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleReopenOpening(opening)}
                                                        className="rounded-lg text-xs border-green-200 text-green-700 hover:bg-green-50"
                                                        disabled={isBusy || !canReopen}
                                                        title={!canReopen ? 'Cannot reopen because no slots are available.' : 'Reopen opening'}
                                                    >
                                                        {isBusy ? (
                                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                                        ) : (
                                                            <Unlock className="w-3.5 h-3.5 mr-1.5" />
                                                        )}
                                                        Reopen
                                                    </Button>
                                                )}

                                                {!isArchived && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleArchiveOpening(opening.opening_id)}
                                                        className="rounded-lg text-xs border-red-200 text-red-700 hover:bg-red-50"
                                                        disabled={isBusy}
                                                    >
                                                        {isBusy ? (
                                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                                        ) : (
                                                            <Archive className="w-3.5 h-3.5 mr-1.5" />
                                                        )}
                                                        Archive
                                                    </Button>
                                                )}
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