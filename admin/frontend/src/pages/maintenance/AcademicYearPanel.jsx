// SMaRT-PDM: Academic Periods — Academic Year Panel (admin frontend page); loads data, handles page actions, and renders the admin view.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Archive,
    ArchiveRestore,
    CalendarRange,
    CheckCircle2,
    FlaskConical,
    History,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    Search,
    X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buildApiUrl } from '@/api';
import { showAppToast } from '@/utils/appToast';
import { confirmArchive } from '@/utils/confirmArchive';
import { useSocketEvent } from '@/hooks/useSocket';
import { MAINTENANCE_CARD_TITLE_CLASS } from './components/maintenanceTypography';

function getTodayDateInputValue() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

const C = {
    brown: 'var(--portal-base)',
};

// authHeaders: handles auth headers for the Academic Periods flow.
function authHeaders() {
    return {
        Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json',
    };
}


// ActionModal: handles action modal for the Academic Periods flow.
function ActionModal({
    open,
    tone = 'info',
    title,
    message,
    details = [],
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    requireText = '',
    onClose,
    onConfirm,
}) {
    const [typedValue, setTypedValue] = useState('');

    useEffect(() => {
        if (open) setTypedValue('');
    }, [open]);

    if (!open) return null;

    const toneClasses = {
        info: {
            panel: 'border-blue-200 bg-blue-50',
            title: 'text-blue-900',
            text: 'text-blue-700',
        },
        warning: {
            panel: 'border-amber-200 bg-amber-50',
            title: 'text-amber-900',
            text: 'text-amber-700',
        },
        danger: {
            panel: 'border-red-200 bg-red-50',
            title: 'text-red-900',
            text: 'text-red-700',
        },
        success: {
            panel: 'border-green-200 bg-green-50',
            title: 'text-green-900',
            text: 'text-green-700',
        },
    };

    const currentTone = toneClasses[tone] || toneClasses.info;
    const canConfirm = !requireText || typedValue === requireText;

    return (
        <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-md overflow-hidden rounded-xl border-stone-200 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 border-b border-stone-100 bg-white px-4 py-3">
                    <div>
                        <h3 className="text-sm font-semibold text-stone-900">
                            {title}
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                        aria-label="Close"
                    >
                        <X size={15} />
                    </button>
                </div>

                <CardContent className="space-y-3 p-4">
                    <div className={`rounded-lg border px-3.5 py-3 ${currentTone.panel}`}>
                        <p className={`text-sm leading-relaxed ${currentTone.text}`}>
                            {message}
                        </p>

                        {details.length > 0 ? (
                            <div className="mt-2 space-y-1 border-t border-current/10 pt-2">
                                {details.map((detail, index) => (
                                    <p
                                        key={`${detail}-${index}`}
                                        className={`text-xs leading-relaxed ${currentTone.text}`}
                                    >
                                        {detail}
                                    </p>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    {requireText ? (
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-stone-600">
                                Type <span className="font-semibold text-stone-900">{requireText}</span> to confirm
                            </label>
                            <Input
                                value={typedValue}
                                onChange={(event) => setTypedValue(event.target.value)}
                                placeholder={requireText}
                                className="h-9 border-stone-200 text-sm"
                                autoFocus
                            />
                        </div>
                    ) : null}
                </CardContent>

                <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-4 py-3">
                    {onConfirm ? (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            className="h-8 border-stone-200 px-3 text-xs"
                        >
                            {cancelLabel}
                        </Button>
                    ) : null}

                    <Button
                        type="button"
                        disabled={!canConfirm}
                        onClick={() => {
                            if (onConfirm) onConfirm();
                            else onClose();
                        }}
                        className={`h-8 border-none px-3 text-xs text-white ${
                            tone === 'danger'
                                ? 'bg-red-700 hover:bg-red-800'
                                : tone === 'warning'
                                  ? 'bg-amber-700 hover:bg-amber-800'
                                  : tone === 'success'
                                    ? 'bg-green-700 hover:bg-green-800'
                                    : 'bg-[var(--portal-base)] hover:bg-[var(--portal-active)]'
                        }`}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

// AcademicYearModal: handles academic year modal for the Academic Periods flow.
function AcademicYearModal({
    open,
    mode,
    form,
    setForm,
    saving,
    activeYearLabel,
    currentAcademicWindow,
    onClose,
    onSave,
}) {
    if (!open) return null;

    const isEdit = mode === 'edit';
    const today = getTodayDateInputValue();
    // SMARTPDM_ACADEMIC_UNIFIED_FORM_V1
    const start = Number(form.start_year || 0);
    const end = start + 1;
    const computedLabel = start > 0 ? `${start}-${end}` : 'Select a starting year';
    const schedule = form.semesters || {first:['',''], second:['','']};
    const first = schedule.first || ['',''];
    const second = schedule.second || ['',''];
    // SMARTPDM_FLEXIBLE_SEMESTER_V7: admin chooses dates; only valid chronology and academic-year containment matter.
    // SMARTPDM_SCHEDULE_BASED_ROLLOVER_V13: admin sets semester dates; no school-year boundary requirement.
    const isValidSchedule = Boolean(first[0] && first[1] && second[0] && second[1] &&
        first[1] >= first[0] && second[0] > first[1] && second[1] >= second[0]);
    const canSubmit = Number.isInteger(start) && start >= 2000 &&
        !!form.start_date && !!form.end_date &&
        form.start_date.slice(0,4) === String(start) &&
        form.end_date.slice(0,4) === String(end) &&
        form.end_date > form.start_date &&
        (isEdit || form.start_date >= today) && isValidSchedule;
    const isCurrentAcademicWindow =
        start === Number(currentAcademicWindow?.start_year) &&
        end === Number(currentAcademicWindow?.end_year);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <Card
                className="w-full max-w-xl overflow-hidden border-stone-200 shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
                    <div>
                        <h3 className="text-base font-semibold text-stone-800">
                            {isEdit
                                ? 'Update Academic Year'
                                : 'Add Academic Year'}
                        </h3>
                        <p className="mt-1 text-xs text-stone-500">
                            First and Second Semester records are created automatically for every new academic year.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                    >
                        <X size={16} />
                    </button>
                </div>

                <CardContent className="space-y-5 p-5">
                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-stone-400">
                            School Year Preview
                        </p>
                        <p className="mt-1 text-sm font-semibold text-stone-900">
                            {computedLabel}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="text-xs font-medium uppercase tracking-wide text-stone-500">Starting Year
                            <select className="mt-1 h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm" value={form.start_year || ''} disabled={saving || isEdit} onChange={e => setForm(p => ({...p, start_year:e.target.value, end_year:String(Number(e.target.value)+1), start_date:'', end_date:'', semesters:{first:['',''],second:['','']}}))}>
                                <option value="">Choose starting year</option>
                                {Array.from({length:16},(_,i)=>Number(currentAcademicWindow?.start_year || new Date().getFullYear())-1+i).map(y => <option key={y} value={String(y)}>{y}</option>)}
                            </select>
                        </label>
                        <label className="text-xs font-medium uppercase tracking-wide text-stone-500">Ending Year (automatic)
                            <Input className="mt-1 h-10 border-stone-200 bg-stone-50" value={start ? String(end) : ''} readOnly />
                        </label>
                        <label className="text-xs font-medium uppercase tracking-wide text-stone-500">Academic Year Start
                            <Input type="date" className="mt-1 h-10 border-stone-200" disabled={saving || !start} min={isEdit ? undefined : today} max={start ? `${start}-12-31` : undefined} value={form.start_date || ''} onChange={e=>setForm(p=>({...p,start_date:e.target.value,end_date:p.end_date && p.end_date <= e.target.value ? '' : p.end_date}))}/>
                        </label>
                        <label className="text-xs font-medium uppercase tracking-wide text-stone-500">Academic Year End
                            <Input type="date" className="mt-1 h-10 border-stone-200" disabled={saving || !form.start_date} min={start ? `${end}-01-01` : undefined} max={start ? `${end}-12-31` : undefined} value={form.end_date || ''} onChange={e=>setForm(p=>({...p,end_date:e.target.value}))}/>
                        </label>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {[['first','First Semester'],['second','Second Semester']].map(([key,label])=><div key={key} className="rounded-xl border border-stone-200 p-3">
                        <p className="text-sm font-semibold text-stone-800">{label} Dates</p>
                        <div className="mt-2 space-y-2">
                          {[0,1].map(i=><label key={i} className="block text-xs text-stone-500">{i===0?'Start':'End'}
                            <input type="date" className="mt-1 w-full rounded-lg border border-stone-200 p-2 text-sm" disabled={saving || !start || (i===1 && !schedule[key]?.[0])} min={i===1 ? (schedule[key]?.[0] || undefined) : key==='second' && first[1] ? new Date(Date.parse(first[1]+'T00:00:00Z')+86400000).toISOString().slice(0,10) : undefined} max={i===0 && key==='first' && second[0] ? new Date(Date.parse(second[0]+'T00:00:00Z')-86400000).toISOString().slice(0,10) : undefined} value={schedule[key]?.[i] || ''} onChange={e=>setForm(p=>{const old=p.semesters || {first:['',''],second:['','']};const next=[...(old[key] || ['',''])];next[i]=e.target.value;if(i===0 && next[1] && next[1]<next[0])next[1]='';const updated={...old,[key]:next};if(key==='first' && updated.second?.[0] && updated.second[0] <= updated.first[1]) updated.second=['',''];return {...p,semesters:updated};})}/>
                          </label>)}
                        </div>
                      </div>)}
                    </div>
                    <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-4">
                        <input
                            type="checkbox"
                            checked={!!form.is_active}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    is_active:
                                        e.target.checked,
                                }))
                            }
                            className="mt-1 h-4 w-4 accent-[var(--portal-base)]"
                            disabled={saving || !isCurrentAcademicWindow}
                        />
                        <div>
                            <p className="text-sm font-semibold text-stone-800">
                                Set as active academic year
                            </p>
                            <p className="mt-1 text-xs text-stone-500">
                                This selects the active school year only. The actual working semester is controlled separately below.
                            </p>
                            {!isCurrentAcademicWindow ? (
                                <p className="mt-2 text-xs text-amber-700">
                                    Only AY {currentAcademicWindow?.label || 'calculated by the server'} can be made active.
                                </p>
                            ) : null}
                            {activeYearLabel &&
                            activeYearLabel !== computedLabel &&
                            form.is_active ? (
                                <p className="mt-2 text-xs text-amber-700">
                                    Current active year {activeYearLabel} will become inactive.
                                </p>
                            ) : null}
                        </div>
                    </label>

                    <label className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={form.auto_enabled===true} onChange={e=>setForm(p=>({...p,auto_enabled:e.target.checked}))} disabled={saving}/>Enable automatic semester transitions after safety checks</label>
                    {!canSubmit ? (<p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Review the date ranges. You can click Save Changes to see the exact validation error.</p>) : null}
                </CardContent>

                <div className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-4">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onSave}
                        disabled={saving}
                        className="border-none text-white"
                        style={{ background: C.brown }}
                    >
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : isEdit ? (
                            <Pencil className="mr-2 h-4 w-4" />
                        ) : (
                            <Plus className="mr-2 h-4 w-4" />
                        )}
                        {isEdit
                            ? 'Save Changes'
                            : 'Add Academic Year'}
                    </Button>
                </div>
            </Card>
        </div>
    );
}

export default function AcademicYearPanel() {
    const [years, setYears] = useState([]);
    const [periods, setPeriods] = useState([]);
    // SMARTPDM_SEMESTER_AUTO_V1
    const [autoSchedules,setAutoSchedules]=useState([]);
    const [autoSaving,setAutoSaving]=useState(false);
    const [autoYear,setAutoYear]=useState('');
    const [autoEnabled,setAutoEnabled]=useState(false);
    const [autoWindows,setAutoWindows]=useState({first:['',''],second:['','']});
    const loadAutoSchedules=useCallback(async()=>{try{const r=await fetch(buildApiUrl('/api/academic-years/auto-schedule'),{headers:authHeaders()});if(r.ok)setAutoSchedules(await r.json());}catch(e){console.error('AUTO SCHEDULE LOAD',e)}},[]);
    useEffect(()=>{loadAutoSchedules()},[loadAutoSchedules]);
    const saveAutoSchedule=async()=>{if(!autoYear)return;setAutoSaving(true);try{const payload={auto_enabled:autoEnabled,windows:[{term:'First Semester',start_date:autoWindows.first[0],end_date:autoWindows.first[1]},{term:'Second Semester',start_date:autoWindows.second[0],end_date:autoWindows.second[1]}]};const r=await fetch(buildApiUrl('/api/academic-years/auto-schedule/'+autoYear),{method:'PUT',headers:authHeaders(),body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw Error(data.error||'Failed to save');await loadAutoSchedules();showAppToast('success','Semester schedule saved','Automatic transition uses safety checks.');}catch(e){showAppToast('error','Cannot save semester schedule',e.message)}finally{setAutoSaving(false)}};

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [actionId, setActionId] = useState(null);
    const [search, setSearch] = useState('');
    const [view, setView] = useState('current');
    const [actionModal, setActionModal] = useState(null);

    // closeActionModal: handles close action modal for the Academic Periods flow.
    const closeActionModal = () => setActionModal(null);
    const showMessage = ({
        tone = 'info',
        title,
        message,
        details = [],
    }) => {
        if (tone === 'success') {
            showAppToast(
                'success',
                title,
                [message, ...details].filter(Boolean).join(' ')
            );
            return;
        }

        setActionModal({
            tone,
            title,
            message,
            details,
            confirmLabel: 'OK',
            onConfirm: null,
        });
    };

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        start_year: '',
        end_year: '',
        start_date: '',
        end_date: '',
        is_active: false, semesters:{first:['',''],second:['','']}, auto_enabled:false, });
    const [currentAcademicWindow, setCurrentAcademicWindow] =
        useState(null);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);

            const [yearsRes, periodsRes, currentWindowRes] =
                await Promise.all([
                    fetch(
                        buildApiUrl('/api/academic-years'),
                        { headers: authHeaders() }
                    ),
                    fetch(
                        buildApiUrl(
                            '/api/academic-years/periods'
                        ),
                        { headers: authHeaders() }
                    ),
                    fetch(
                        buildApiUrl(
                            '/api/academic-years/current-window'
                        ),
                        { headers: authHeaders() }
                    ),
                ]);

            const yearsPayload =
                await yearsRes.json().catch(() => []);
            const periodsPayload =
                await periodsRes.json().catch(
                    () => []
                );
            const currentWindowPayload =
                await currentWindowRes.json().catch(
                    () => null
                );

            if (!yearsRes.ok) {
                throw new Error(
                    yearsPayload?.error ||
                        'Failed to load academic years'
                );
            }

            if (!periodsRes.ok) {
                throw new Error(
                    periodsPayload?.error ||
                        'Failed to load academic periods'
                );
            }

            if (!currentWindowRes.ok) {
                throw new Error(
                    currentWindowPayload?.error ||
                        'Failed to determine the current academic year'
                );
            }

            setYears(
                Array.isArray(yearsPayload)
                    ? yearsPayload
                    : []
            );
            setPeriods(
                Array.isArray(periodsPayload)
                    ? periodsPayload
                    : []
            );
            setCurrentAcademicWindow(
                currentWindowPayload?.start_year &&
                    currentWindowPayload?.end_year
                    ? currentWindowPayload
                    : null
            );
        } catch (error) {
            console.error(
                'ACADEMIC CYCLE FETCH ERROR:',
                error
            );
            showMessage({
                tone: 'danger',
                title: 'Unable to load academic cycle',
                message:
                    error.message ||
                    'Failed to load academic cycle',
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useSocketEvent(
        'maintenance:updated',
        (payload = {}) => {
            if (
                !payload?.module ||
                [
                    'academic_years',
                    'academic_periods',
                ].includes(payload.module)
            ) {
                loadData();
            }
        },
        [loadData]
    );

    const activeYear = useMemo(
        () =>
            years.find(
                (row) =>
                    row.is_active &&
                    row.is_archived !== true
            ) || null,
        [years]
    );

    const activePeriod = useMemo(
        () =>
            periods.find(
                (row) => row.is_active === true
            ) || null,
        [periods]
    );

    const filteredYears = useMemo(() => {
        const q = search.trim().toLowerCase();

        return years
            .filter((row) => {
                const archived =
                    row.is_archived === true;
                if (
                    view === 'current' &&
                    archived
                ) {
                    return false;
                }
                if (
                    view === 'archived' &&
                    !archived
                ) {
                    return false;
                }

                if (!q) return true;

                return String(
                    row.label ||
                        `${row.start_year}-${row.end_year}`
                )
                    .toLowerCase()
                    .includes(q);
            })
            .sort(
                (a, b) =>
                    Number(b.start_year || 0) -
                    Number(a.start_year || 0)
            );
    }, [years, search, view]);

    // resetModal: resets reset modal for the Academic Periods flow.
    const resetModal = () => {
        setModalOpen(false);
        setModalMode('create');
        setEditingId(null);
        setForm({
            start_year: '',
            end_year: '',
            start_date: '',
            end_date: '',
            is_active: false,
            semesters:{first:['',''],second:['','']}, auto_enabled:false,
        });
    };

    // openCreate: handles open create for the Academic Periods flow.
    const openCreate = () => {
        const startYear = Number(
            currentAcademicWindow?.start_year
        );
        const endYear = Number(
            currentAcademicWindow?.end_year
        );
        setModalMode('create');
        setEditingId(null);
        setForm({
            start_year: Number.isInteger(startYear)
                ? String(startYear)
                : '',
            end_year: Number.isInteger(endYear)
                ? String(endYear)
                : '',
            start_date: '',
            end_date: '',
            is_active: !activeYear,
            semesters:{first:['',''],second:['','']}, auto_enabled:false,
        });
        setModalOpen(true);
    };

    // openEdit: handles open edit for the Academic Periods flow.
    // SMARTPDM_SEMESTER_SAVE_V6: fetch current semester windows rather than relying on possibly stale mount state.
    const openEdit = async (row) => {
        try {
            const response = await fetch(buildApiUrl('/api/academic-years/auto-schedule'), { headers: authHeaders() });
            if (!response.ok) throw new Error('Could not load semester schedules. Please retry.');
            const all = await response.json();
            if (!Array.isArray(all)) throw new Error('Invalid semester schedule response.');
            setAutoSchedules(all);
            const label = row.label || String(row.start_year) + '-' + String(row.end_year);
            const findTerm = (term) => all.find(q => String(q.academic_year_label) === String(label) && q.term === term);
            const first = findTerm('First Semester');
            const second = findTerm('Second Semester');
            setModalMode('edit');
            setEditingId(row.academic_year_id);
            setForm({
                start_year: String(row.start_year), end_year: String(row.end_year),
                start_date: row.start_date || '', end_date: row.end_date || '',
                is_active: !!row.is_active,
                semesters: {
                    first: [first?.start_date || '', first?.end_date || ''],
                    second: [second?.start_date || '', second?.end_date || ''],
                },
                auto_enabled: first?.auto_enabled === true && second?.auto_enabled === true,
            });
            setModalOpen(true);
        } catch (error) {
            showMessage({tone:'danger', title:'Schedule unavailable', message:error.message});
        }
    };

    // saveYear: validates and saves save year for the Academic Periods flow.
    const saveYear = async () => {
        try {
            setSaving(true);
            // SMARTPDM_SEMESTER_SAVE_V6: one year source of truth, validation occurs on click.
            const start = Number(form.start_year);
            const end = start + 1;
            const first = form.semesters?.first || [];
            const second = form.semesters?.second || [];
            if (!Number.isInteger(start) || start < 2000 ||
                !form.start_date || !form.end_date ||
                form.start_date.slice(0,4) !== String(start) ||
                form.end_date.slice(0,4) !== String(end) ||
                form.start_date >= form.end_date) {
                throw new Error('Academic Year Start must be in ' + start + ' and Academic Year End must be in ' + end + '.');
            }
            if (modalMode !== 'edit' && form.start_date < getTodayDateInputValue()) {
                throw new Error('New academic years cannot start in the past.');
            }
            // SMARTPDM_FLEXIBLE_SEMESTER_V7: no fixed calendar months; only sensible date ordering.
            if (!(first[0] && first[1] && second[0] && second[1] &&
                first[1] >= first[0] && second[0] > first[1] && second[1] >= second[0])) {
                throw new Error('Each semester end date must be on or after its start date; semesters cannot overlap.');
            }
            const isEdit = modalMode === 'edit' && editingId;
            const url = isEdit
                ? buildApiUrl(
                      `/api/academic-years/${editingId}`
                  )
                : buildApiUrl(
                      '/api/academic-years'
                  );

            const response = await fetch(url, {
                method: isEdit ? 'PATCH' : 'POST',
                headers: authHeaders(),
                body: JSON.stringify({
                    start_year: start,
                    end_year: end,
                    start_date: form.start_date,
                    end_date: form.end_date,
                    is_active:
                        !!form.is_active,
                }),
            });

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to save academic year'
                );
            }

            // Semester windows are saved against existing periods. If this step fails,
            // keep the year and report the configuration failure for retry.
            const savedYearId = isEdit ? editingId : payload?.academic_year_id;
            if (!savedYearId) throw new Error('Academic year saved but no ID was returned. Please refresh and configure its semester schedule.');
            const newSchedule = {
              auto_enabled: form.auto_enabled === true,
              windows: [
                {term:'First Semester', start_date:form.semesters.first[0], end_date:form.semesters.first[1]},
                {term:'Second Semester', start_date:form.semesters.second[0], end_date:form.semesters.second[1]},
              ],
            };
            const scheduleResponse = await fetch(buildApiUrl(`/api/academic-years/auto-schedule/${savedYearId}`), {method:'PUT',headers:authHeaders(),body:JSON.stringify(newSchedule)});
            const schedulePayload = await scheduleResponse.json().catch(()=>({}));
            if (!scheduleResponse.ok) throw new Error('Academic year saved, but semester schedule failed: '+(schedulePayload.error || schedulePayload.message || 'Please retry from Edit.'));
            resetModal();
            await loadData();
        } catch (error) {
            showMessage({
                tone: 'danger',
                title: 'Academic year not saved',
                message:
                    error.message ||
                    'Failed to save academic year',
            });
        } finally {
            setSaving(false);
        }
    };

    // activateYear: handles activate year for the Academic Periods flow.
    const activateYear = async (row) => {
        try {
            setActionId(
                `year-${row.academic_year_id}`
            );

            const response = await fetch(
                buildApiUrl(
                    `/api/academic-years/${row.academic_year_id}/activate`
                ),
                {
                    method: 'PATCH',
                    headers: authHeaders(),
                }
            );

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to activate academic year'
                );
            }

            await loadData();
        } catch (error) {
            showMessage({
                tone: 'danger',
                title: 'Action failed',
                message: error.message || 'The requested action could not be completed.',
            });
        } finally {
            setActionId(null);
        }
    };

    // executeSetCurrentPeriod: handles execute set current period for the Academic Periods flow.
    const executeSetCurrentPeriod = async (period) => {
        const label = `${period.term} · AY ${period.academic_year_label}`;

        try {
            setActionId(`period-${period.period_id}`);

            const response = await fetch(
                buildApiUrl(
                    `/api/academic-years/periods/${period.period_id}/activate`
                ),
                {
                    method: 'PATCH',
                    headers: authHeaders(),
                }
            );

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to set current semester'
                );
            }

            const summary = payload?.cycle_summary || {};

            showMessage({
                tone: 'success',
                title: 'Academic semester updated',
                message: `${label} is now the current semester.`,
                details: [
                    `Eligible scholars: ${summary.eligible_scholars ?? 0}`,
                    `New renewals: ${summary.renewals_created ?? 0}`,
                    `New RO cycles: ${summary.ro_cycles_created ?? 0}`,
                    'If this was a historical semester, its previous state was preserved.',
                ],
            });

            await loadData();
        } catch (error) {
            showMessage({
                tone: 'danger',
                title: 'Unable to set current semester',
                message:
                    error.message ||
                    'Failed to set current semester',
            });
        } finally {
            setActionId(null);
        }
    };

    // setCurrentPeriod: sets set current period for the Academic Periods flow.
    const setCurrentPeriod = (period) => {
        const label = `${period.term} · AY ${period.academic_year_label}`;

        setActionModal({
            tone: 'warning',
            title: 'Set current semester?',
            message: `Set ${label} as the current academic semester?`,
            details: [
                'The previous current semester becomes historical and read-only.',
                `Existing records for ${label} are preserved if this is a reactivation.`,
            ],
            confirmLabel: 'Set Current',
            cancelLabel: 'Cancel',
            onConfirm: async () => {
                closeActionModal();
                await executeSetCurrentPeriod(period);
            },
        });
    };

    // executeResetPeriodForTesting: handles execute reset period for testing for the Academic Periods flow.
    const executeResetPeriodForTesting = async (period) => {
        const label = `${period.term} · AY ${period.academic_year_label}`;

        try {
            setActionId(`reset-${period.period_id}`);

            const response = await fetch(
                buildApiUrl(
                    `/api/academic-years/periods/${period.period_id}/reset-test`
                ),
                {
                    method: 'POST',
                    headers: authHeaders(),
                }
            );

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to reset test cycle'
                );
            }

            showMessage({
                tone: 'success',
                title: 'Test cycle regenerated',
                message: `${label} was regenerated for testing.`,
                details: [
                    `Deleted renewals: ${payload?.deleted?.renewals ?? 0}`,
                    `Deleted RO cycles: ${payload?.deleted?.ro_cycles ?? 0}`,
                    `Fresh renewals: ${payload?.regenerated?.renewals_created ?? 0}`,
                    `Fresh RO cycles: ${payload?.regenerated?.ro_cycles_created ?? 0}`,
                ],
            });

            await loadData();
        } catch (error) {
            showMessage({
                tone: 'danger',
                title: 'Unable to reset test cycle',
                message:
                    error.message ||
                    'Failed to reset test cycle',
            });
        } finally {
            setActionId(null);
        }
    };

    // resetPeriodForTesting: resets reset period for testing for the Academic Periods flow.
    const resetPeriodForTesting = (period) => {
        const label = `${period.term} · AY ${period.academic_year_label}`;

        setActionModal({
            tone: 'danger',
            title: 'Reset test cycle?',
            message: `Reset ${label} from the beginning for testing?`,
            details: [
                'This permanently deletes this semester’s Renewal and RO cycle records.',
                'Renewal uploads, RO logs, proofs, and placements for this semester are also removed.',
                'Use this only with test data.',
            ],
            requireText: 'RESET',
            confirmLabel: 'Reset Test Cycle',
            cancelLabel: 'Cancel',
            onConfirm: async () => {
                closeActionModal();
                await executeResetPeriodForTesting(period);
            },
        });
    };

    // archiveYear: archives archive year for the Academic Periods flow.
    const archiveYear = async (row) => {
        const yearName = row.academic_year || row.year_name || row.label || 'this academic year';
        if (!(await confirmArchive({ itemName: yearName }))) return;

        try {
            setActionId(
                `archive-${row.academic_year_id}`
            );

            const response = await fetch(
                buildApiUrl(
                    `/api/academic-years/${row.academic_year_id}/archive`
                ),
                {
                    method: 'PATCH',
                    headers: authHeaders(),
                }
            );

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to archive academic year'
                );
            }

            await loadData();
        } catch (error) {
            showMessage({
                tone: 'danger',
                title: 'Action failed',
                message: error.message || 'The requested action could not be completed.',
            });
        } finally {
            setActionId(null);
        }
    };

    // restoreYear: restores restore year for the Academic Periods flow.
    const restoreYear = async (row) => {
        try {
            setActionId(
                `restore-${row.academic_year_id}`
            );

            const response = await fetch(
                buildApiUrl(
                    `/api/academic-years/${row.academic_year_id}/restore`
                ),
                {
                    method: 'PATCH',
                    headers: authHeaders(),
                }
            );

            const payload =
                await response
                    .json()
                    .catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        'Failed to restore academic year'
                );
            }

            setView('current');
            await loadData();
        } catch (error) {
            showMessage({
                tone: 'danger',
                title: 'Action failed',
                message: error.message || 'The requested action could not be completed.',
            });
        } finally {
            setActionId(null);
        }
    };

    // periodsForYear: handles periods for year for the Academic Periods flow.
    const periodsForYear = (yearId) =>
        periods.filter(
            (period) =>
                period.academic_year_id === yearId
        );

    return (
        <div className="space-y-3 py-0.5">
            <ActionModal
                open={!!actionModal}
                tone={actionModal?.tone}
                title={actionModal?.title}
                message={actionModal?.message}
                details={actionModal?.details || []}
                confirmLabel={actionModal?.confirmLabel}
                cancelLabel={actionModal?.cancelLabel}
                requireText={actionModal?.requireText || ''}
                onClose={closeActionModal}
                onConfirm={actionModal?.onConfirm}
            />

            <AcademicYearModal
                open={modalOpen}
                mode={modalMode}
                form={form}
                setForm={setForm}
                saving={saving}
                activeYearLabel={
                    activeYear?.label || ''
                }
                currentAcademicWindow={currentAcademicWindow}
                onClose={resetModal}
                onSave={saveYear}
            />

                        {/* SMARTPDM_SEMESTER_AUTO_V1 — additive card; original Academic Years layout preserved. */}
            <section className="rounded-xl border border-stone-200 bg-white p-3.5 space-y-3">
                <div><h2 className={MAINTENANCE_CARD_TITLE_CLASS}>Automatic Semester Schedule</h2><p className="text-xs text-stone-500">Asia/Manila dates. Transitions run only after safety checks; outstanding applications or openings block automation.</p></div>
                <select className="rounded-lg border border-stone-200 p-2 text-sm" value={autoYear} onChange={e=>{const id=e.target.value;setAutoYear(id);const year=years.find(y=>String(y.academic_year_id)===id);const byTerm=t=>autoSchedules.find(x=>String(x.academic_year_label)===(year?.label||year?.start_year+'-'+year?.end_year)&&x.term===t);const first=byTerm('First Semester'),second=byTerm('Second Semester');setAutoEnabled(first?.auto_enabled===true&&second?.auto_enabled===true);setAutoWindows({first:[first?.start_date||'',first?.end_date||''],second:[second?.start_date||'',second?.end_date||'']})}}><option value="">Select academic year</option>{years.filter(y=>!y.is_archived).map(y=><option key={y.academic_year_id} value={y.academic_year_id}>{y.label||y.start_year+'-'+y.end_year}</option>)}</select>
                {autoYear&&<><div className="grid gap-3 md:grid-cols-2">{[['first','First Semester'],['second','Second Semester']].map(([key,label])=><div key={key} className="rounded-lg border border-stone-200 p-3"><p className="text-sm font-semibold">{label}</p><div className="mt-2 grid grid-cols-2 gap-2">{[0,1].map(i=><label key={i} className="text-xs text-stone-500">{i===0?'Start':'End'}<input type="date" className="mt-1 w-full rounded border border-stone-200 p-2 text-sm" value={autoWindows[key][i]} onChange={e=>setAutoWindows(old=>({...old,[key]:old[key].map((v,j)=>i===j?e.target.value:v)}))}/></label>)}</div></div>)}</div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoEnabled} onChange={e=>setAutoEnabled(e.target.checked)}/>Enable guarded automatic transitions</label><button type="button" disabled={autoSaving} onClick={saveAutoSchedule} className="rounded-lg bg-[var(--portal-base)] px-3 py-2 text-sm text-white disabled:opacity-50">{autoSaving?'Saving...':'Save Schedule'}</button></>}
                {autoSchedules.filter(x=>x.last_error).map(x=><p key={x.period_id} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{x.academic_year_label} {x.term}: {x.last_error}</p>)}
            </section>

<section className="rounded-xl border border-stone-200 bg-white p-3.5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className={MAINTENANCE_CARD_TITLE_CLASS}>
                            Current Academic Cycle
                        </h2>

                        {activePeriod ? (
                            <div className="mt-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-base font-semibold text-stone-900">
                                        {activePeriod.term}
                                    </p>
                                    <Badge className="border-green-200 bg-green-50 text-green-700 hover:bg-green-50">
                                        Current
                                    </Badge>
                                </div>
                                <p className="mt-1 text-sm text-stone-500">
                                    AY{' '}
                                    {
                                        activePeriod.academic_year_label
                                    }
                                </p>
                            </div>
                        ) : (
                            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                <p className="text-sm font-semibold text-amber-800">
                                    No current semester
                                </p>
                                <p className="mt-1 text-xs text-amber-700">
                                    Select First or Second Semester below. Renewal and RO should not rely on an arbitrary fallback period.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={loadData}
                            className="border-stone-200"
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                        <Button
                            size="sm"
                            onClick={openCreate}
                            className="border-none text-white"
                            style={{
                                background: C.brown,
                            }}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Academic Year
                        </Button>
                    </div>
                </div>
            </section>

            <section className="rounded-xl border border-stone-200 bg-white p-3.5">
                <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                    <div className="inline-flex rounded-lg bg-stone-100 p-0.5">
                        <button
                            type="button"
                            onClick={() =>
                                setView('current')
                            }
                            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                                view === 'current'
                                    ? 'bg-white text-stone-900 shadow-sm'
                                    : 'text-stone-500'
                            }`}
                        >
                            Academic Years
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setView('archived')
                            }
                            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                                view === 'archived'
                                    ? 'bg-white text-stone-900 shadow-sm'
                                    : 'text-stone-500'
                            }`}
                        >
                            Archived
                        </button>
                    </div>

                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                        <Input
                            value={search}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                            placeholder="Search academic year..."
                            className="h-9 pl-9 text-sm"
                        />
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-stone-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading academic cycles...
                </div>
            ) : filteredYears.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-14 text-center">
                    <CalendarRange className="mx-auto h-9 w-9 text-stone-300" />
                    <p className="mt-3 text-sm font-semibold text-stone-700">
                        No academic years found
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredYears.map((year) => {
                        const yearPeriods =
                            periodsForYear(
                                year.academic_year_id
                            );
                        const archived =
                            year.is_archived === true;

                        return (
                            <section
                                key={
                                    year.academic_year_id
                                }
                                className={`overflow-hidden rounded-2xl border ${
                                    archived
                                        ? 'border-stone-200 bg-stone-50 opacity-75'
                                        : year.is_active
                                          ? 'border-green-200 bg-white'
                                          : 'border-stone-200 bg-white'
                                }`}
                            >
                                <div className="flex flex-col gap-2.5 border-b border-stone-100 px-4 py-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-base font-semibold text-stone-900">
                                                {year.label ||
                                                    `${year.start_year}-${year.end_year}`}
                                            </h3>
                                            {year.is_active ? (
                                                <Badge className="border-green-200 bg-green-50 text-green-700">
                                                    Active Year
                                                </Badge>
                                            ) : null}
                                            {archived ? (
                                                <Badge variant="outline">
                                                    Archived
                                                </Badge>
                                            ) : null}
                                        </div>
                                        {year.start_date && year.end_date ? (
                                            <p className="mt-1 text-xs text-stone-500">
                                                {new Date(`${year.start_date}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                {' ? '}
                                                {new Date(`${year.end_date}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                            </p>
                                        ) : null}
                                        <p className="mt-1 text-xs text-stone-500">
                                            Viewing a semester does not change system state. Only “Set Current” changes which cycle is actionable.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        {!archived &&
                                        !year.is_active ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                    actionId ===
                                                    `year-${year.academic_year_id}`
                                                }
                                                onClick={() =>
                                                    activateYear(
                                                        year
                                                    )
                                                }
                                            >
                                                Set Active Year
                                            </Button>
                                        ) : null}

                                        {!archived ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    openEdit(
                                                        year
                                                    )
                                                }
                                            >
                                                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                                Edit
                                            </Button>
                                        ) : null}

                                        {!archived &&
                                        !year.is_active ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-red-700"
                                                onClick={() =>
                                                    archiveYear(
                                                        year
                                                    )
                                                }
                                            >
                                                <Archive className="mr-1.5 h-3.5 w-3.5" />
                                                Archive
                                            </Button>
                                        ) : null}

                                        {archived ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    restoreYear(
                                                        year
                                                    )
                                                }
                                            >
                                                <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                                                Restore
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2.5 p-3 lg:grid-cols-2">
                                    {yearPeriods.map(
                                        (period) => {
                                            const current =
                                                period.is_active ===
                                                true;
                                            const busy =
                                                actionId ===
                                                    `period-${period.period_id}` ||
                                                actionId ===
                                                    `reset-${period.period_id}`;

                                            return (
                                                <div
                                                    key={
                                                        period.period_id
                                                    }
                                                    className={`rounded-lg border p-3.5 ${
                                                        current
                                                            ? 'border-green-200 bg-green-50'
                                                            : 'border-stone-200 bg-stone-50/70'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                {current ? (
                                                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                                ) : (
                                                                    <History className="h-4 w-4 text-stone-400" />
                                                                )}
                                                                <p className="text-sm font-semibold text-stone-900">
                                                                    {
                                                                        period.term
                                                                    }
                                                                </p>
                                                            </div>
                                                            <p className="mt-1 text-xs text-stone-500">
                                                                {current
                                                                    ? 'Current · Renewal and RO are actionable'
                                                                    : 'Historical / inactive · existing data stays preserved'}
                                                            </p>
                                                        </div>

                                                        <Badge
                                                            className={
                                                                current
                                                                    ? 'border-green-200 bg-white text-green-700'
                                                                    : 'border-stone-200 bg-white text-stone-500'
                                                            }
                                                        >
                                                            {current
                                                                ? 'Current'
                                                                : 'Historical'}
                                                        </Badge>
                                                    </div>

                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {!archived &&
                                                        !current ? (
                                                            <Button
                                                                size="sm"
                                                                disabled={
                                                                    busy
                                                                }
                                                                onClick={() =>
                                                                    setCurrentPeriod(
                                                                        period
                                                                    )
                                                                }
                                                                className="border-none text-white"
                                                                style={{
                                                                    background:
                                                                        C.brown,
                                                                }}
                                                            >
                                                                {busy ? (
                                                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <CalendarRange className="mr-1.5 h-3.5 w-3.5" />
                                                                )}
                                                                Set Current
                                                            </Button>
                                                        ) : null}

                                                        {current ? (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={
                                                                    busy
                                                                }
                                                                className="border-amber-200 text-amber-800 hover:bg-amber-50"
                                                                onClick={() =>
                                                                    resetPeriodForTesting(
                                                                        period
                                                                    )
                                                                }
                                                            >
                                                                {busy ? (
                                                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                                                                )}
                                                                Reset Test Cycle
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-sm font-semibold text-blue-900">
                    Testing rule
                </p>
                <p className="mt-1 text-xs leading-relaxed text-blue-800">
                    Selecting an old semester does not make it editable. Use Set Current to reactivate its exact previous state. Reset Test Cycle is separate and destructive; it creates fresh Renewal and RO records for the current semester and is blocked in production unless explicitly enabled.
                </p>
            </div>
        </div>
    );
}
