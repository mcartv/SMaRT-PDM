import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Search, Loader2, CalendarDays, Users, FolderOpen,
    Pencil, Archive, X, CheckCircle2, Clock3,
    Sparkles, Megaphone, Layers3, EyeOff, Building2, FileText, RefreshCw
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
};

function fmtDate(v) {
    if (!v) return 'N/A';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return d.toLocaleDateString();
}

function fmtMoney(v) {
    const n = Number(v || 0);
    return `₱${n.toLocaleString()}`;
}

function getTodayLocalISO() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60 * 1000);
    return local.toISOString().split('T')[0];
}

function isWeekend(dateStr) {
    if (!dateStr) return false;
    const date = new Date(`${dateStr}T00:00:00`);
    const day = date.getDay();
    return day === 0 || day === 6;
}

function isPastDate(dateStr) {
    if (!dateStr) return false;
    const today = getTodayLocalISO();
    return dateStr < today;
}

function isInvalidSelectableDate(dateStr) {
    return isPastDate(dateStr) || isWeekend(dateStr);
}

function deriveOpeningStatus(payload, existingStatus = '') {
    const normalizedExisting = String(existingStatus || '').toLowerCase();

    if (normalizedExisting === 'archived') {
        return 'archived';
    }

    const today = getTodayLocalISO();

    const hasRequiredFields =
        !!payload.opening_title &&
        !!payload.application_start &&
        !!payload.application_end;

    if (!hasRequiredFields) return 'draft';
    if (payload.application_end < today) return 'closed';

    return 'open';
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

    if (normalized) {
        return normalized;
    }

    // Fallback: check if it's a TES program
    const joined = [
        source?.program_name,
        source?.organization_name,
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
    onClose,
    onSave,
    saving,
}) {
    if (!open) return null;

    const isEdit = mode === 'edit';
    const title = isEdit ? 'Edit Scholarship Opening' : 'Open Program for New Batch';
    const today = getTodayLocalISO();
    const previewStatus = deriveOpeningStatus(form);

    const allocatedSlots = Number(form.allocated_slots) || 0;
    const totalFinancial = Number(form.total_financial_allocation) || 0;
    const perScholarFinancial = allocatedSlots > 0 && totalFinancial > 0
        ? Math.floor(totalFinancial / allocatedSlots)
        : 0;

    const handleAllocatedSlotsChange = (value) => {
        const slots = Number(value) || 0;
        setForm((prev) => ({
            ...prev,
            allocated_slots: value,
            financial_allocation:
                slots > 0 && prev.total_financial_allocation
                    ? Math.floor(Number(prev.total_financial_allocation) / slots)
                    : prev.financial_allocation,
        }));
    };

    const handleTotalFinancialChange = (value) => {
        const total = Number(value) || 0;
        const slots = Number(form.allocated_slots) || 0;
        setForm((prev) => ({
            ...prev,
            total_financial_allocation: value,
            financial_allocation:
                slots > 0 && total > 0
                    ? Math.floor(total / slots)
                    : prev.financial_allocation,
        }));
    };

    const handleDateChange = (field, value) => {
        if (!value) {
            setForm((prev) => ({ ...prev, [field]: '' }));
            return;
        }

        if (isInvalidSelectableDate(value)) {
            alert('Past dates and weekends are not allowed.');
            return;
        }

        setForm((prev) => {
            const next = { ...prev, [field]: value };

            if (field === 'application_start' && next.application_end && next.application_end < value) {
                next.application_end = '';
            }

            if (field === 'screening_start' && next.screening_end && next.screening_end < value) {
                next.screening_end = '';
            }

            return next;
        });
    };

    // Get audience display label
    const audienceLabel = targetAudienceLabel(form.target_audience);
    const audienceTooltip = audienceLabel === 'Scholars & Applicants'
        ? 'Visible to both scholars and applicants'
        : audienceLabel === 'Scholars'
            ? 'Visible only to existing scholars'
            : 'Visible only to new applicants';

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
                                : 'Create a live application cycle from the selected scholarship program template'}
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
                                            {template.organization_name || 'No Organization'}
                                        </Badge>

                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] ${previewStatus === 'open'
                                                ? 'border-green-200 bg-green-50 text-green-700'
                                                : previewStatus === 'closed'
                                                    ? 'border-red-200 bg-red-50 text-red-700'
                                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                                                }`}
                                        >
                                            Auto Status: {STATUS_META[previewStatus]?.label || 'Draft'}
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

                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <Badge variant="outline" className="text-[10px] border-stone-200 bg-white text-stone-600">
                                            GWA ≤ {template.gwa_threshold ?? 'N/A'}
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px] border-stone-200 bg-white text-stone-600">
                                            {template.renewal_cycle || 'No Renewal'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-sm font-medium text-stone-800">Status is automatic</p>
                        <p className="text-xs text-stone-500 mt-1">
                            Draft if incomplete, Open if complete and active, Closed if the application end date has already passed.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-stone-800 border-b border-stone-200 pb-2">Opening Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Opening Title
                                </label>
                                <Input
                                    value={form.opening_title}
                                    onChange={(e) => setForm((prev) => ({ ...prev, opening_title: e.target.value }))}
                                    placeholder="e.g. AY 2026–2027 First Semester Intake"
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                                <p className="text-[10px] text-stone-400">A descriptive title for this scholarship opening batch.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Target Audience
                                </label>
                                <div className="relative">
                                    <Input
                                        value={audienceLabel}
                                        readOnly
                                        className="h-10 rounded-lg border-stone-200 bg-stone-100 text-sm font-medium pr-8"
                                        style={{ color: C.brownMid }}
                                    />
                                    <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                </div>
                                <p className="text-[10px] text-stone-400">
                                    Inherited from the benefactor template. {audienceTooltip.toLowerCase()}.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-stone-800 border-b border-stone-200 pb-2">Application Period</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Application Start
                                </label>
                                <Input
                                    type="date"
                                    min={today}
                                    value={form.application_start}
                                    onChange={(e) => handleDateChange('application_start', e.target.value)}
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                                <p className="text-[10px] text-stone-400">Weekdays only. Past dates are blocked.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Application End
                                </label>
                                <Input
                                    type="date"
                                    min={form.application_start || today}
                                    value={form.application_end}
                                    onChange={(e) => handleDateChange('application_end', e.target.value)}
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                                <p className="text-[10px] text-stone-400">Must be on or after application start.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-stone-800 border-b border-stone-200 pb-2">Screening Period</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Screening Start
                                </label>
                                <Input
                                    type="date"
                                    min={form.application_end || today}
                                    value={form.screening_start}
                                    onChange={(e) => handleDateChange('screening_start', e.target.value)}
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                                <p className="text-[10px] text-stone-400">Should not be earlier than application end.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Screening End
                                </label>
                                <Input
                                    type="date"
                                    min={form.screening_start || form.application_end || today}
                                    value={form.screening_end}
                                    onChange={(e) => handleDateChange('screening_end', e.target.value)}
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                                <p className="text-[10px] text-stone-400">Must be on or after screening start.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-stone-800 border-b border-stone-200 pb-2">Financial Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Total Financial Allocation (₱)
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    value={form.total_financial_allocation}
                                    onChange={(e) => handleTotalFinancialChange(e.target.value)}
                                    placeholder="0.00"
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                                <p className="text-[10px] text-stone-400">Total budget for this opening.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Allocated Slots
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={form.allocated_slots}
                                    onChange={(e) => handleAllocatedSlotsChange(e.target.value)}
                                    placeholder="0"
                                    className="h-10 rounded-lg border-stone-200 text-sm"
                                />
                                <p className="text-[10px] text-stone-400">Number of scholars to be funded.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                    Per Scholar Amount (₱)
                                </label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={form.financial_allocation}
                                    readOnly
                                    className="h-10 rounded-lg border-stone-200 bg-stone-100 text-sm font-medium"
                                    style={{ color: C.brownMid }}
                                />
                                <p className="text-[10px] text-stone-400">Auto-calculated: Total ÷ Slots</p>
                            </div>
                        </div>

                        {allocatedSlots > 0 && totalFinancial > 0 && (
                            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                                <p className="text-xs text-emerald-700">
                                    <span className="font-semibold">Summary:</span> ₱{totalFinancial.toLocaleString()} total budget for {allocatedSlots} slots = ₱{perScholarFinancial.toLocaleString()} per scholar.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-stone-800 border-b border-stone-200 pb-2">Opening Notes</h4>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                                Opening Notes / Instructions
                            </label>
                            <Textarea
                                value={form.announcement_text}
                                onChange={(e) => setForm((prev) => ({ ...prev, announcement_text: e.target.value }))}
                                placeholder="Instructions for this batch, submission reminders, special conditions, and admin notes..."
                                className="min-h-[120px] rounded-lg border-stone-200 text-sm resize-none"
                            />
                        </div>
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
                        disabled={saving || !form.opening_title || !form.application_start || !form.application_end}
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
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All Statuses');
    const [programFilter, setProgramFilter] = useState('All Programs');
    const [audienceFilter, setAudienceFilter] = useState('All Audiences'); // NEW: audience filter

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [activeTemplate, setActiveTemplate] = useState(null);
    const [editingOpeningId, setEditingOpeningId] = useState(null);

    const [postCreateOpen, setPostCreateOpen] = useState(false);
    const [newOpeningForPrompt, setNewOpeningForPrompt] = useState(null);

    const emptyForm = {
        program_id: '',
        opening_title: '',
        application_start: '',
        application_end: '',
        screening_start: '',
        screening_end: '',
        allocated_slots: '',
        total_financial_allocation: '',
        financial_allocation: '',
        announcement_text: '',
        target_audience: 'Applicants',
    };

    const [form, setForm] = useState(emptyForm);

    const fetchData = async () => {
        try {
            setLoading(true);

            const [templatesRes, openingsRes] = await Promise.all([
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
            ]);

            if (!templatesRes.ok) throw new Error('Failed to load scholarship program templates');
            if (!openingsRes.ok) throw new Error('Failed to load scholarship openings');

            const templatesData = await templatesRes.json();
            const openingsData = await openingsRes.json();

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

            const noDates =
                !o.application_start &&
                !o.application_end &&
                !o.screening_start &&
                !o.screening_end;

            const noNumbers =
                Number(o.allocated_slots || 0) === 0 &&
                Number(o.financial_allocation || 0) === 0;

            const brokenOrganization =
                !o.benefactor_name ||
                o.benefactor_name === 'Benefactor N/A' ||
                o.benefactor_name === 'Organization N/A' ||
                o.benefactor_name === 'Unknown Organization';

            const junkRow = noDates && noNumbers && brokenOrganization;

            if (junkRow) return false;
            if (status === 'archived' && noDates && noNumbers) return false;

            return true;
        });
    }, [openings]);

    const programOptions = useMemo(() => {
        return ['All Programs', ...new Set(visibleOpenings.map((o) => o.program_name).filter(Boolean))];
    }, [visibleOpenings]);

    const audienceOptions = ['All Audiences', 'Applicants', 'Scholars', 'Both'];

    const filteredOpenings = useMemo(() => {
        const q = search.trim().toLowerCase();

        return visibleOpenings.filter((o) => {
            const matchSearch =
                !q ||
                (o.opening_title || '').toLowerCase().includes(q) ||
                (o.program_name || '').toLowerCase().includes(q) ||
                (o.benefactor_name || '').toLowerCase().includes(q);

            const matchStatus =
                statusFilter === 'All Statuses' ||
                (o.posting_status || '').toLowerCase() === statusFilter.toLowerCase();

            const matchProgram =
                programFilter === 'All Programs' ||
                (o.program_name || '') === programFilter;

            const openingAudience = normalizeAudience(o.target_audience) || 'Applicants';
            const matchAudience =
                audienceFilter === 'All Audiences' ||
                openingAudience === audienceFilter;

            return matchSearch && matchStatus && matchProgram && matchAudience;
        });
    }, [visibleOpenings, search, statusFilter, programFilter, audienceFilter]);

    const stats = useMemo(() => {
        return {
            templates: templates.length,
            total: visibleOpenings.length,
            open: visibleOpenings.filter((o) => (o.posting_status || '').toLowerCase() === 'open').length,
            draft: visibleOpenings.filter((o) => (o.posting_status || '').toLowerCase() === 'draft').length,
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
                opening_title: existingDraft.opening_title || `${template.program_name} AY ${currentYear}-${currentYear + 1}`,
                application_start: existingDraft.application_start ? String(existingDraft.application_start).slice(0, 10) : '',
                application_end: existingDraft.application_end ? String(existingDraft.application_end).slice(0, 10) : '',
                screening_start: existingDraft.screening_start ? String(existingDraft.screening_start).slice(0, 10) : '',
                screening_end: existingDraft.screening_end ? String(existingDraft.screening_end).slice(0, 10) : '',
                allocated_slots: existingDraft.allocated_slots ?? '',
                total_financial_allocation:
                    Number(existingDraft.allocated_slots || 0) * Number(existingDraft.financial_allocation || 0) || '',
                financial_allocation: existingDraft.financial_allocation ?? '',
                announcement_text: existingDraft.announcement_text ?? template.description ?? '',
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
            opening_title: `${template.program_name} AY ${currentYear}-${currentYear + 1}`,
            application_start: '',
            application_end: '',
            screening_start: '',
            screening_end: '',
            allocated_slots: '',
            total_financial_allocation: '',
            financial_allocation: '',
            announcement_text: template.description || '',
            target_audience: computedAudience,
        });
        setModalOpen(true);
    };

    const openEditModal = (opening) => {
        const totalFromPerScholar = Number(opening.allocated_slots || 0) * Number(opening.financial_allocation || 0);

        setModalMode('edit');
        setEditingOpeningId(opening.opening_id);
        setActiveTemplate(
            templates.find((t) => t.program_id === opening.program_id) || null
        );

        setForm({
            program_id: opening.program_id || '',
            opening_title: opening.opening_title || '',
            application_start: opening.application_start ? String(opening.application_start).slice(0, 10) : '',
            application_end: opening.application_end ? String(opening.application_end).slice(0, 10) : '',
            screening_start: opening.screening_start ? String(opening.screening_start).slice(0, 10) : '',
            screening_end: opening.screening_end ? String(opening.screening_end).slice(0, 10) : '',
            allocated_slots: opening.allocated_slots ?? '',
            total_financial_allocation: totalFromPerScholar || '',
            financial_allocation: opening.financial_allocation ?? '',
            announcement_text: opening.announcement_text || '',
            target_audience: deriveTargetAudience(opening),
        });
        setModalOpen(true);
    };

    const handleSaveOpening = async () => {
        try {
            const datesToCheck = [
                { key: 'application_start', label: 'Application Start' },
                { key: 'application_end', label: 'Application End' },
                { key: 'screening_start', label: 'Screening Start' },
                { key: 'screening_end', label: 'Screening End' },
            ];

            for (const item of datesToCheck) {
                const value = form[item.key];
                if (value && isInvalidSelectableDate(value)) {
                    alert(`${item.label} cannot be a past date or weekend.`);
                    return;
                }
            }

            if (form.application_start && form.application_end && form.application_end < form.application_start) {
                alert('Application End cannot be earlier than Application Start.');
                return;
            }

            if (form.screening_start && form.screening_end && form.screening_end < form.screening_start) {
                alert('Screening End cannot be earlier than Screening Start.');
                return;
            }

            if (form.application_end && form.screening_start && form.screening_start < form.application_end) {
                alert('Screening Start cannot be earlier than Application End.');
                return;
            }

            setSaving(true);

            const payload = {
                program_id: form.program_id,
                opening_title: form.opening_title,
                application_start: form.application_start,
                application_end: form.application_end,
                screening_start: form.screening_start || null,
                screening_end: form.screening_end || null,
                allocated_slots: Number(form.allocated_slots || 0),
                financial_allocation: Number(form.financial_allocation || 0),
                announcement_text: form.announcement_text || null,
                target_audience: normalizeAudience(form.target_audience) || 'Applicants',
            };

            payload.posting_status = deriveOpeningStatus(payload);

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
                throw new Error(data.error || 'Failed to save scholarship opening');
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

    const handleArchiveOpening = async (openingId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/program-openings/${openingId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ posting_status: 'archived' }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.error || 'Failed to archive opening');
            }

            await fetchData();
        } catch (err) {
            console.error('ARCHIVE OPENING ERROR:', err);
            alert(err.message || 'Failed to archive opening');
        }
    };

    const handleCreateAnnouncementRedirect = () => {
        if (!newOpeningForPrompt) return;

        const params = new URLSearchParams({
            opening_title: newOpeningForPrompt.opening_title || '',
            announcement_text: newOpeningForPrompt.announcement_text || '',
            posting_status: newOpeningForPrompt.posting_status || '',
            opening_id: newOpeningForPrompt.opening_id || '',
            program_id: newOpeningForPrompt.program_id || '',
            target_audience: normalizeAudience(newOpeningForPrompt.target_audience) || deriveTargetAudience(newOpeningForPrompt),
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
                        Open scholarship programs for a new application cycle and manage their status.
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
                            subtitle="Create and publish benefactor templates in Maintenance first."
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
                                                    {template.organization_name || 'No Organization'}
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

                                            <div className="flex flex-wrap gap-2 mt-3">
                                                <Badge variant="outline" className="text-[10px] border-stone-200 bg-white text-stone-600">
                                                    GWA ≤ {template.gwa_threshold ?? 'N/A'}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px] border-stone-200 bg-white text-stone-600">
                                                    {template.renewal_cycle || 'No Renewal'}
                                                </Badge>
                                            </div>
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
                        placeholder="Search by opening title, program, or benefactor..."
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
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                </Select>

                {/* NEW: Audience Filter */}
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
                            Active, draft, closed, and archived scholarship openings.
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
                                const status = String(opening.posting_status || 'draft').toLowerCase();
                                const meta = STATUS_META[status] || STATUS_META.draft;
                                const audience = normalizeAudience(opening.target_audience) || 'Applicants';
                                const audienceLabelValue = targetAudienceLabel(audience);

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
                                                        <p className="text-[10px] uppercase tracking-wide text-stone-400">Application Period</p>
                                                        <p className="text-xs font-medium text-stone-800 mt-1">
                                                            {fmtDate(opening.application_start)} - {fmtDate(opening.application_end)}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide text-stone-400">Screening Period</p>
                                                        <p className="text-xs font-medium text-stone-800 mt-1">
                                                            {fmtDate(opening.screening_start)} - {fmtDate(opening.screening_end)}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide text-stone-400">Allocated Slots</p>
                                                        <p className="text-xs font-medium text-stone-800 mt-1">
                                                            {Number(opening.allocated_slots || 0).toLocaleString()}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                                                        <p className="text-[10px] uppercase tracking-wide text-stone-400">Per Scholar</p>
                                                        <p className="text-xs font-medium text-stone-800 mt-1">
                                                            {fmtMoney(opening.financial_allocation)}
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

                                            <div className="flex items-center gap-2 shrink-0">
                                                {status !== 'archived' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openEditModal(opening)}
                                                        className="rounded-lg text-xs border-stone-200"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                                                        Edit
                                                    </Button>
                                                )}

                                                {status !== 'archived' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleArchiveOpening(opening.opening_id)}
                                                        className="rounded-lg text-xs border-red-200 text-red-700 hover:bg-red-50"
                                                    >
                                                        <Archive className="w-3.5 h-3.5 mr-1.5" />
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