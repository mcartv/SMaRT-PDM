import React, { useRef, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildApiUrl } from '@/api';
import { showAppToast } from '@/utils/appToast';
import { SEMESTER_TERMS, semesterScheduleStatus, validateSemesterSchedule } from './semesterSchedule';

export default function SemesterScheduleDialog({ year, periods, schedules, today, onClose, onSaved }) {
    const [windows, setWindows] = useState(() => SEMESTER_TERMS.map(term => {
        const period = periods.find(row => row.term === term);
        const existing = schedules.find(row => row.period_id === period?.period_id);
        return {term,start_date:existing?.start_date || '',end_date:existing?.end_date || ''};
    }));
    const [automatic, setAutomatic] = useState(() => periods.length === 2 && periods.every(period => schedules.some(row => row.period_id === period.period_id && row.auto_enabled)));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const lock = useRef(false);
    const minimum = year.start_date || `${year.start_year}-01-01`;
    const maximum = year.end_date || `${year.end_year}-12-31`;
    function update(index, field, value) {
        setWindows(rows => rows.map((row, i) => i === index ? {...row,[field]:value} : row));
        setError('');
    }
    async function save(event) {
        event.preventDefault();
        if(lock.current) return;
        const validation = validateSemesterSchedule(windows, year, automatic, today);
        if(validation) {setError(validation); return;}
        lock.current = true; setSaving(true); setError('');
        try {
            const response = await fetch(buildApiUrl(`/api/academic-years/${year.academic_year_id}/schedules`), {method:'PUT',headers:{Authorization:`Bearer ${sessionStorage.getItem('adminToken') || ''}`,'Content-Type':'application/json'},body:JSON.stringify({windows,auto_enabled:automatic})});
            const body = await response.json().catch(() => ({}));
            if(!response.ok) throw Error(body.error || 'Unable to save semester dates.');
            showAppToast('success','Semester schedule saved',automatic ? 'Automatic switching is enabled. The matching semester is checked every minute.' : 'Dates saved. Semester switching remains manual.');
            onSaved();
        } catch(failure) {setError(failure.message);}
        finally {lock.current = false; setSaving(false);}
    }
    return <Dialog open onOpenChange={open => {if(!open && !saving) onClose();}}>
        <DialogContent showCloseButton={!saving} onInteractOutside={event=>event.preventDefault()} onEscapeKeyDown={event=>{if(saving)event.preventDefault();}} className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-0 overflow-hidden rounded-xl border border-stone-200 bg-white p-0 sm:max-w-xl">
            <DialogHeader className="shrink-0 border-b border-stone-100 bg-stone-50 px-4 py-4 pr-12"><DialogTitle className="text-base">Semester Schedule</DialogTitle><DialogDescription>{year.label || `${year.start_year}-${year.end_year}`} · Philippine time</DialogDescription></DialogHeader>
            <form onSubmit={save} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 space-y-4 p-4" style={{overflowY:'auto',overflowX:'hidden'}}>
                    <p className="text-xs leading-relaxed text-stone-500">Set the actual dates for each semester. Semester breaks may fall between the two date ranges.</p>
                    {windows.map((row,index)=><section key={row.term} className="rounded-xl border border-stone-200 p-3 sm:p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{row.term}</h3><span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] text-stone-600">{semesterScheduleStatus(row,today)}</span></div>
                        <div className="grid gap-3 sm:grid-cols-2">{[['start_date','Start date'],['end_date','End date']].map(([field,label])=><div className="min-w-0" key={field}><label htmlFor={`semester-${index}-${field}`} className="mb-1 block text-xs font-medium text-stone-600">{label}</label><Input id={`semester-${index}-${field}`} required type="date" min={field==='end_date' && row.start_date ? row.start_date : minimum} max={maximum} value={row[field]} onChange={event=>update(index,field,event.target.value)} disabled={saving} className="h-10 w-full min-w-0 rounded-lg" /></div>)}</div>
                    </section>)}
                    <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--portal-base)]" checked={automatic} disabled={saving} onChange={event=>{setAutomatic(event.target.checked);setError('');}} /><span className="min-w-0"><span className="block text-sm font-medium">Switch semesters automatically</span><span className="mt-1 block text-xs leading-relaxed text-stone-500">Checks every minute using Philippine time. Enabling this can activate today's matching semester and run the normal semester rollover.</span></span></label></div>
                    <p className="text-xs leading-relaxed text-stone-500">During breaks, the current cycle is retained. Using Set Current manually pauses automatic switching for that academic year.</p>
                    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
                </div>
                <DialogFooter className="m-0 shrink-0 flex-row flex-wrap rounded-none border-t border-stone-200 bg-stone-50 px-4 py-3"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving} style={{background:'var(--portal-base)',color:'white'}}>{saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}{saving ? 'Saving...' : 'Save Schedule'}</Button></DialogFooter>
            </form>
        </DialogContent>
    </Dialog>;
}
