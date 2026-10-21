import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Power, Search, Save, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import OfficeServiceAreaAction from './components/OfficeServiceAreaAction';
import { SearchableChoice, TransferConfirmation } from './components/InstitutionalControls';
import { useSocketEvent } from '@/hooks/useSocket';
import { buildApiUrl } from '@/api';
import { showAppToast } from '@/utils/appToast';
import { useRbacPermissions } from '@/context/RbacPermissionContext';
import { MAINTENANCE_CARD_SUBTITLE_CLASS, MAINTENANCE_CARD_TITLE_CLASS } from './components/maintenanceTypography';

const EMPTY = { office_name: '', office_code: '', description: '', course_ids: [], leaders: { dean: null } };
const PAGE_SIZE = 10;
const primaryStyle = { background: 'var(--portal-base)', color: 'white' };
function formatOfficeUpdated(value) {
    if (!value || Number.isNaN(new Date(value).getTime())) return 'Update date not recorded';
    return 'Updated ' + new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function groupByOffice(rows) {
    const groups = new Map();
    for (const row of rows) {
        if (!groups.has(row.office_id)) groups.set(row.office_id, []);
        groups.get(row.office_id).push(row);
    }
    return groups;
}

function Pager({ page, total, count, onChange, label = 'Offices pagination' }) {
    return <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
        <p>{count ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, count)} of ${count}` : 'No records'}</p>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft className="size-4" /></Button><span>Page {page} of {total}</span><Button variant="outline" size="sm" aria-label="Next page" disabled={page >= total} onClick={() => onChange(page + 1)}><ChevronRight className="size-4" /></Button></div>
    </nav>;
}

export default function OfficesPanel() {
    const { hasPermission } = useRbacPermissions();
    const canManage = ['settings.manage', 'accounts.update', 'courses.manage'].every(hasPermission);
    const canChangeStatus = hasPermission('settings.manage');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('active');
    const [page, setPage] = useState(1);
    const [editor, setEditor] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [formError, setFormError] = useState('');
    const [courseSearch, setCourseSearch] = useState('');
    const [deanConfirm, setDeanConfirm] = useState(false);
    const [deanApproved, setDeanApproved] = useState(false);
    const [transfer, setTransfer] = useState(null);
    const [detailsId, setDetailsId] = useState(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberPage, setMemberPage] = useState(1);
    const [statusTarget, setStatusTarget] = useState(null);
    const [saving, setSaving] = useState(false);
    const lock = useRef(false);
    const initialEditorOpened = useRef(false);
    const generation = useRef(0);

    const request = useCallback(async (path = '', init = {}) => {
        const response = await fetch(buildApiUrl('/api/offices' + path), { ...init, cache: 'no-store', headers: { Authorization: `Bearer ${sessionStorage.getItem('adminToken') || ''}`, 'Content-Type': 'application/json' } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Unable to load offices. Please try again.');
        return payload;
    }, []);
    const load = useCallback(async () => {
        const version = ++generation.current;
        setLoading(true); setError('');
        try { const payload = await request(); if (version === generation.current) setData(payload); }
        catch (err) { if (version === generation.current) setError(err.message); }
        finally { if (version === generation.current) setLoading(false); }
    }, [request]);
    useSocketEvent('maintenance:updated', payload => { if (['offices','courses','accounts','pd_course_assignments'].includes(payload?.module)) load(); }, [load]);
    const cancelLoad = useCallback(() => { generation.current++; }, []);
    useEffect(() => { load(); return cancelLoad; }, [load, cancelLoad]);

    const offices = useMemo(() => data?.offices || [], [data]);
    const courses = useMemo(() => data?.courses || [], [data]);
    const members = useMemo(() => data?.members || [], [data]);
    const coursesByOffice = useMemo(() => groupByOffice(courses.filter(course => course.office_id)), [courses]);
    const membersByOffice = useMemo(() => groupByOffice(members), [members]);
    const filtered = offices.filter(office => office.is_active === (status === 'active') && `${office.office_name} ${office.office_code || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const details = offices.find(office => office.office_id === detailsId);
    const officePersonnel = useMemo(() => {
        const people = new Map();
        const addPerson = (person, courseCode = null) => {
            if (!person || person.is_archived) return;
            if (!people.has(person.user_id)) people.set(person.user_id, { ...person, courses: new Set() });
            if (courseCode) people.get(person.user_id).courses.add(courseCode);
        };
        for (const person of membersByOffice.get(detailsId) || []) addPerson(person);
        for (const director of data?.programDirectors || []) {
            if (director.office_id === detailsId) addPerson(members.find(person => person.user_id === director.user_id) || director, director.course_code);
        }
        const dean = (data?.leaders || []).find(leader => leader.office_id === detailsId && leader.leadership_kind === 'dean');
        if (dean) addPerson(members.find(person => person.user_id === dean.user_id));
        return [...people.values()].map(person => ({ ...person, courses: [...person.courses].sort() }))
            .sort((a,b) => Number(b.courses.length > 0) - Number(a.courses.length > 0) || (a.name || '').localeCompare(b.name || ''));
    }, [data,membersByOffice,detailsId,members]);
    const matchingPersonnel = officePersonnel.filter(person => (person.name + ' ' + person.position + ' ' + person.courses.join(' ')).toLowerCase().includes(memberSearch.trim().toLowerCase()));
    const memberPages = Math.max(1, Math.ceil(matchingPersonnel.length / PAGE_SIZE));
    const currentMemberPage = Math.min(memberPage, memberPages);
    const visibleCourses = courses.filter(course => (!course.is_archived || form.course_ids.includes(course.course_id)) && `${course.course_code} ${course.course_name}`.toLowerCase().includes(courseSearch.trim().toLowerCase())).sort((a, b) => Number(form.course_ids.includes(b.course_id)) - Number(form.course_ids.includes(a.course_id)) || a.course_code.localeCompare(b.course_code));
    const ready = data?.schemaReady === true;
    useEffect(() => {
        if (initialEditorOpened.current || !ready || !canManage) return;
        initialEditorOpened.current = true;
        const query = new URLSearchParams(window.location.search);
        if (query.get('tab') === 'institutional' && query.get('section') === 'offices' && query.get('action') === 'add') setEditor({id:null});
    }, [ready, canManage]);
    const editingOffice = offices.find(office => office.office_id === editor?.id);
    const deanApplies = editingOffice?.supports_dean === true;
    const leadersFor = officeId => (data?.leaders || []).filter(leader => leader.office_id === officeId);
    const personName = userId => members.find(member => member.user_id === userId)?.name || 'Unassigned';
    function leaderOptions(kind) {
        const eligible = (data?.eligibility || []).filter(rule => rule.leadership_kind === kind).map(rule => rule.position_id);
        const selected = form.leaders[kind];
        return members.filter(member => (eligible.includes(member.position_id) && !member.is_archived && member.roles?.length) || member.user_id === selected).map(member => ({ value: member.user_id, label: `${member.name} - ${member.position}${member.is_archived ? ' (Archived)' : ''}`, disabled: member.is_archived || !eligible.includes(member.position_id) }));
    }

    function openEditor(office = null) {
        const courseIds = office ? (coursesByOffice.get(office.office_id) || []).map(course => course.course_id) : [];
        setForm(office ? { office_name: office.office_name, office_code: office.office_code || '', description: office.description || '', course_ids: courseIds, expected_course_ids: courseIds, expected_dean_user_id: leadersFor(office.office_id).find(leader => leader.leadership_kind === 'dean')?.user_id || null, leaders: { dean: leadersFor(office.office_id).find(leader => leader.leadership_kind === 'dean')?.user_id || null } } : EMPTY);
        setDeanApproved(false); setDeanConfirm(false);
        setCourseSearch(''); setFormError(''); setEditor({ id: office?.office_id || null });
    }
    function toggle(field, value, checked) {
        setForm(previous => ({ ...previous, [field]: checked ? [...previous[field], value] : previous[field].filter(item => item !== value) }));
    }
    async function save(event, confirmed = false, deanConfirmed = deanApproved) {
        event?.preventDefault();
        const oldDean = leadersFor(editor?.id).find(leader => leader.leadership_kind === 'dean')?.user_id || null;
        if (deanApplies && editor?.id && oldDean !== form.leaders.dean && !deanConfirmed) { setDeanConfirm(true); return; }
        const moves = courses.filter(course => form.course_ids.includes(course.course_id) && course.office_id && course.office_id !== editor?.id);
        if (moves.length && !confirmed) { setTransfer({ items: moves.map(course => ({ ...course, from_name: course.office_name, to_name: form.office_name })) }); return; }
        if (lock.current || !canManage) return;
        lock.current = true; setSaving(true); setFormError('');
        try {
            await request(editor.id ? '/' + editor.id : '', { method: editor.id ? 'PATCH' : 'POST', body: JSON.stringify({ ...form, leaders: deanApplies ? form.leaders : {}, confirm_dean_change: deanConfirmed, course_transfers: moves.map(course => ({ course_id: course.course_id, from_office_id: course.office_id })) }) });
            setTransfer(null); setEditor(null); showAppToast('success', 'Office saved', 'Office details, course links, and leadership saved.'); await load();
        } catch (err) { setFormError(err.message); showAppToast('error', 'Office not saved', err.message); }
        finally { lock.current = false; setSaving(false); }
    }
    async function changeStatus() {
        if (lock.current || !canChangeStatus) return;
        lock.current = true; setSaving(true);
        try {
            await request('/' + statusTarget.office_id + '/status', { method: 'PATCH', body: JSON.stringify({ is_active: !statusTarget.is_active }) });
            showAppToast('success', statusTarget.is_active ? 'Office archived' : 'Office restored'); setStatusTarget(null); await load();
        } catch (err) { showAppToast('error', 'Status not changed', err.message); }
        finally { lock.current = false; setSaving(false); }
    }
    return <div className="min-w-0 space-y-3">
        {data && !ready && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Office editing requires the Institutional Management migration. Existing records remain available to view.</p>}
        <div className="rounded-xl border border-stone-200 bg-white px-4 py-4">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div><h2 className={MAINTENANCE_CARD_TITLE_CLASS}>Offices & Departments</h2><p className={MAINTENANCE_CARD_SUBTITLE_CLASS}>{offices.filter(office => office.is_active).length} active &middot; {offices.filter(office => !office.is_active).length} archived</p></div>
                    <div className="relative w-full md:w-[320px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><Input aria-label="Search offices and departments" placeholder="Search offices and departments..." className="h-9 rounded-lg border-stone-200 bg-white pl-9 text-sm" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div>
                </div>
                <div className="flex flex-col gap-3 border-t border-stone-100 pt-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2">{[['active', 'Current'], ['inactive', 'Archived']].map(([key, label]) => <button type="button" key={key} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${status === key ? 'bg-[var(--portal-base)] text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`} style={status === key ? primaryStyle : undefined} aria-pressed={status === key} onClick={() => { setStatus(key); setPage(1); }}>{label} ({offices.filter(office => office.is_active === (key === 'active')).length})</button>)}</div>
                    <div className="flex flex-wrap items-center gap-2">{search && <Button variant="outline" size="sm" className="h-8 rounded-lg border-stone-200 text-xs" onClick={() => { setSearch(''); setPage(1); }}>Reset</Button>}{canManage && <Button size="sm" className="h-8 rounded-lg border-none text-xs text-white" style={primaryStyle} disabled={!ready || loading || saving} onClick={() => openEditor()}><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>}</div>
                </div>
            </div>
        </div>
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" className="ml-2 underline" onClick={load}>Try again</button></div>}
        {loading && !data ? <div role="status" className="flex min-h-52 items-center justify-center gap-2 text-sm text-stone-500"><Loader2 className="size-5 animate-spin" />Loading offices...</div> : <>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                {!filtered.length ? <div className="flex min-h-52 flex-col items-center justify-center p-4 text-center text-stone-500"><Building2 className="mb-3 size-9 text-stone-300" /><p className="text-sm font-medium">{search ? 'No matching offices or departments' : `No ${status} offices or departments`}</p><p className="mt-1 text-xs">{search ? 'Try another name or code.' : 'Add an office or switch the status filter.'}</p></div> : <div className="divide-y divide-stone-200">{filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(office => {
                    const linkedCourses = coursesByOffice.get(office.office_id) || [];
                    const dean = leadersFor(office.office_id).find(leader => leader.leadership_kind === 'dean');
                    return <div key={office.office_id} className="flex min-w-0 flex-col gap-3 px-4 py-3 hover:bg-stone-50 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 text-sm font-medium text-stone-900"><button type="button" className="break-words text-left outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring" title="View office personnel" aria-label={`View personnel in ${office.office_name}`} onClick={() => { setDetailsId(office.office_id); setMemberSearch(''); setMemberPage(1); }}>{office.office_name}</button></h3><span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${office.is_active ? 'bg-green-50 text-green-600' : 'bg-stone-100 text-stone-600'}`}>{office.is_active ? 'Active' : 'Archived'}</span></div>
                            <p className="mt-1 break-words text-xs text-stone-400">{formatOfficeUpdated(office.updated_at || office.created_at)}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">{linkedCourses.length ? linkedCourses.map((course, index) => <span key={course.course_id} title={course.course_name} className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${['bg-sky-100 text-sky-800','bg-violet-100 text-violet-800','bg-emerald-100 text-emerald-800','bg-amber-100 text-amber-800'][index % 4]}`}>{course.course_code}{course.is_archived ? ' (Archived)' : ''}</span>) : <span className="inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-600">No courses linked</span>}</div>
                            {office.supports_dean === true && <p className={`mt-1 break-words text-xs font-medium ${dean ? 'text-cyan-700' : 'text-amber-700'}`}>Dean: {dean ? personName(dean.user_id) : 'Unassigned'}{dean && members.find(member => member.user_id === dean.user_id)?.is_archived ? ' (Archived account)' : ''}</p>}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5 md:shrink-0"><OfficeServiceAreaAction office={office} /><Button size="sm" variant="outline" className="h-8 rounded-lg border-stone-200 px-2 text-xs sm:h-7" onClick={() => { setDetailsId(office.office_id); setMemberSearch(''); setMemberPage(1); }}><UsersRound className="size-3.5" />Details</Button>{canManage && office.is_active && <Button size="sm" variant="outline" className="h-8 rounded-lg border-stone-200 px-2 text-xs sm:h-7" disabled={saving || !ready} onClick={() => openEditor(office)}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>}{!office.is_protected ? <>{canChangeStatus && <Button size="sm" variant="outline" className={`h-8 rounded-lg px-2 text-xs sm:h-7 ${office.is_active ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`} disabled={saving || !ready} onClick={() => setStatusTarget(office)}><Power className="mr-1 h-3.5 w-3.5" />{office.is_active ? 'Archive' : 'Restore'}</Button>}</> : <span className="text-xs text-stone-400">Protected office</span>}</div>
                    </div>;
                })}</div>}
            </div>
            <Pager page={currentPage} total={totalPages} count={filtered.length} onChange={setPage} />
        </>}

        <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open && !saving) setEditor(null); }}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 rounded-xl border border-stone-200 bg-white shadow-xl sm:max-w-xl" showCloseButton={!saving}>
                <DialogHeader className="shrink-0 border-b border-stone-100 bg-stone-50 px-4 py-3 pr-12"><DialogTitle className="text-sm font-semibold text-stone-800">{editor?.id ? 'Edit Office' : 'Add Office / Department'}</DialogTitle><DialogDescription className="break-words text-xs text-stone-500">{editingOffice?.office_name || 'Enter office details and link the courses it manages.'}</DialogDescription></DialogHeader>
                <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={save}>
                    <div className="min-h-0 flex-1 space-y-4 px-4 py-4 sm:px-5" style={{ overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' }}>
                        {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
                        <div className="space-y-1.5"><label htmlFor="office-name" className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Office / Department name</label><Input id="office-name" autoFocus required minLength={2} maxLength={160} disabled={saving} value={form.office_name} onChange={event => setForm(previous => ({ ...previous, office_name: event.target.value }))} placeholder="Enter the full office or department name" className="h-9 rounded-lg border-stone-200 text-sm" /></div>
                        <div className="space-y-1.5"><label htmlFor="office-code" className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Office code</label><Input id="office-code" required maxLength={20} disabled={saving} value={form.office_code} onChange={event => setForm(previous => ({ ...previous, office_code: event.target.value.toUpperCase() }))} placeholder="e.g. CCS" className="h-9 rounded-lg text-sm" /></div>
                        <div className="space-y-1.5"><label htmlFor="office-description" className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Description</label><textarea id="office-description" maxLength={2000} disabled={saving} value={form.description} onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))} className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="Optional office description" /></div>
                        <section className="space-y-2 border-t border-stone-100 pt-3"><div><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold text-stone-700">Assigned courses</h3><span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">{form.course_ids.length} selected</span></div><p className="mt-1 text-xs text-stone-500">Checked courses belong to this office. Selecting a course assigned elsewhere will ask you to confirm the move.</p></div>
                            <Input aria-label="Search assigned courses" value={courseSearch} onChange={event => setCourseSearch(event.target.value)} placeholder="Search courses..." className="h-9 text-xs" />
                            <div className="max-h-56 space-y-1 rounded-lg border border-stone-200 bg-stone-50 p-2" style={{ overflowY: 'auto' }}>{visibleCourses.map(course => {
                                const unavailable = Boolean(course.office_id && course.office_id !== editor?.id);
                                return <label key={course.course_id} className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2.5 text-xs transition ${form.course_ids.includes(course.course_id) ? 'border-[var(--portal-base)] bg-[var(--portal-surface-soft)]' : 'border-transparent bg-white hover:bg-stone-100'}`}><input type="checkbox" className="mt-0.5 size-3.5 shrink-0 accent-[var(--portal-base)]" disabled={saving} checked={form.course_ids.includes(course.course_id)} onChange={event => toggle('course_ids', course.course_id, event.target.checked)} /><span className="min-w-0 break-words"><span className="font-semibold">{course.course_code}</span><span className="ml-2">{course.course_name}{course.is_archived ? ' (Archived)' : ''}</span><span className="mt-1 block text-[11px] text-stone-500">{unavailable ? `Assigned to: ${course.office_name || 'Another office'}` : course.office_id ? 'Assigned to this office' : 'Not assigned to an office'}</span></span></label>;
                            })}{!visibleCourses.length && <p className="py-3 text-center text-xs text-stone-500">No courses available.</p>}</div>
                        </section>
                        {deanApplies && <section className="space-y-3 border-t border-stone-100 pt-4"><h3 className="text-xs font-semibold text-stone-700">Dean assignment</h3><SearchableChoice id="office-dean" label="Dean" value={form.leaders.dean} options={leaderOptions('dean')} searchable={leaderOptions('dean').length > 6} disabled={saving} onChange={value => setForm(previous => ({ ...previous, leaders: { ...previous.leaders, dean: value || null } }))} emptyLabel="No Dean assigned" />{!leaderOptions('dean').length && <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">No eligible Dean accounts yet. Create a Dean account in User Accounts, then assign it here.</p>}<p className="text-xs text-stone-500">Program Directors are listed automatically from their course assignments.</p></section>}
                    </div>
                    <DialogFooter className="m-0 shrink-0 flex-row flex-wrap rounded-none border-stone-100 bg-stone-50 px-4 py-3"><Button type="button" variant="outline" className="h-8 rounded-lg border-stone-200 text-xs" disabled={saving} onClick={() => setEditor(null)}>Cancel</Button><Button type="submit" className="h-8 rounded-lg border-none text-xs" style={primaryStyle} disabled={saving || form.office_name.trim().length < 2 || !form.office_code.trim()}>{saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}{saving ? 'Saving...' : editor?.id ? 'Save' : 'Create'}</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
        <Dialog open={Boolean(detailsId)} onOpenChange={open => { if (!open) setDetailsId(null); }}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
                <DialogHeader className="shrink-0 border-b p-4 pr-12">
                    <DialogTitle className="break-words">{details?.office_name || 'Office personnel'}</DialogTitle>
                    <DialogDescription>Program Directors and other personnel assigned to this office.</DialogDescription>
                </DialogHeader>
                <div className="min-h-0 space-y-3 p-4" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
                    <Input aria-label="Search office personnel" placeholder="Search by name, position, or course..." value={memberSearch} onChange={event => { setMemberSearch(event.target.value); setMemberPage(1); }} />
                    <div className="divide-y rounded-xl border">
                        {matchingPersonnel.slice((currentMemberPage - 1) * PAGE_SIZE, currentMemberPage * PAGE_SIZE).map(person => <div key={person.user_id} className="min-w-0 space-y-1 p-3">
                            <p className="break-words text-sm font-medium">{person.name || 'Name not recorded'}</p>
                            <p className="break-words text-xs text-stone-500">{person.position || 'Position not recorded'}</p>
                            {person.courses.length > 0 && <p className="break-words text-xs text-muted-foreground">{person.courses.join(' ? ')}</p>}
                        </div>)}
                        {!matchingPersonnel.length && <p className="p-6 text-center text-sm text-stone-500">{memberSearch ? 'No matching personnel.' : 'No personnel assigned to this office.'}</p>}
                    </div>
                    {matchingPersonnel.length > PAGE_SIZE && <Pager label="Office personnel pagination" page={currentMemberPage} total={memberPages} count={matchingPersonnel.length} onChange={setMemberPage} />}
                </div>
            </DialogContent>
        </Dialog>
        <Dialog open={Boolean(statusTarget)} onOpenChange={open => { if (!open && !saving) setStatusTarget(null); }}>
            <DialogContent showCloseButton={!saving}><DialogHeader><DialogTitle>{statusTarget?.is_active ? 'Archive' : 'Restore'} Office?</DialogTitle><DialogDescription>{statusTarget?.is_active ? 'This office will be unavailable for new assignments. Existing course and leadership records are preserved.' : 'This office will be available again for its configured account roles.'}</DialogDescription></DialogHeader><p className="break-words text-sm font-medium">{statusTarget?.office_name}</p><DialogFooter className="flex-row flex-wrap"><Button variant="outline" disabled={saving} onClick={() => setStatusTarget(null)}>Cancel</Button><Button style={primaryStyle} disabled={saving} onClick={changeStatus}>{saving ? 'Saving...' : statusTarget?.is_active ? 'Archive' : 'Restore'}</Button></DialogFooter></DialogContent>
        </Dialog>
<Dialog open={deanConfirm} onOpenChange={setDeanConfirm}><DialogContent><DialogHeader><DialogTitle>Change Dean assignment?</DialogTitle><DialogDescription>This will replace or remove the current Dean. Program Director course assignments will remain unchanged.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeanConfirm(false)}>Cancel</Button><Button style={primaryStyle} onClick={() => { setDeanConfirm(false); setDeanApproved(true); save(null, false, true); }}>Confirm</Button></DialogFooter></DialogContent></Dialog>
        <TransferConfirmation transfer={transfer} busy={saving} onCancel={() => setTransfer(null)} onConfirm={() => save(null, true)} />
    </div>;
}
