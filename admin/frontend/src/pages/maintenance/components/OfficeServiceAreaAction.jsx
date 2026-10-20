import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableChoice } from './InstitutionalControls';
import { buildApiUrl } from '@/api';
import { showAppToast } from '@/utils/appToast';
import { useRbacPermissions } from '@/context/RbacPermissionContext';

export default function OfficeServiceAreaAction({ office }) {
    const { hasPermission } = useRbacPermissions();
    const [open,setOpen] = useState(false);
    const [data,setData] = useState(null);
    const [selected,setSelected] = useState('');
    const [busy,setBusy] = useState(false);
    const [error,setError] = useState('');
    const [linked,setLinked] = useState(false);
    const lock = useRef(false);
    const headers = () => ({ Authorization:`Bearer ${sessionStorage.getItem('adminToken') || ''}`, 'Content-Type':'application/json' });
    const current = data?.links?.find(link => link.office_id === office.office_id);
    async function load() {
        setOpen(true); setBusy(true); setError(''); setData(null);
        try {
            const response = await fetch(buildApiUrl('/api/offices/community-links'), { headers:headers(), cache:'no-store' });
            const result = await response.json();
            if (!response.ok) throw Error(result.error || 'Unable to load Community Service Areas.');
            setData(result);
            const existing = result.links.find(link => link.office_id === office.office_id);
            const matching = result.areas?.find(area => area.is_active && area.department_name.trim().toLowerCase() === office.office_name.trim().toLowerCase());
            setSelected(existing?.department_id || matching?.department_id || '');
            setLinked(Boolean(existing));
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }
    async function save() {
        if (lock.current) return;
        lock.current=true; setBusy(true); setError('');
        try {
            const response = await fetch(buildApiUrl('/api/offices/' + office.office_id + '/community-area'), { method:'POST', headers:headers(), body:JSON.stringify({ department_id:selected || null }) });
            const result = await response.json();
            if (!response.ok) throw Error(result.error || 'Unable to make this office available in Community Service.');
            setLinked(true); setOpen(false); showAppToast('success','Community Service Area linked','This office is now available in Community Service. Assign its Personnel-In-Charge there.');
        } catch (err) { setError(err.message); }
        finally { lock.current=false; setBusy(false); }
    }
    if (!office.is_active || !['settings.manage','ro.view','ro.settings_manage'].every(hasPermission)) return null;
    return <><Button variant="outline" size="sm" className="h-8 rounded-lg border-stone-200 px-2 text-xs sm:h-7" onClick={load}>{linked ? 'Service Area Linked' : 'Use as Service Area'}</Button>
        <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={!busy}>
            <DialogHeader className="shrink-0 border-b p-4 pr-12"><DialogTitle>Use as Community Service Area</DialogTitle><DialogDescription className="break-words">{office.office_name}</DialogDescription></DialogHeader>
            <div className="min-h-0 space-y-3 p-4" style={{ overflowY:'auto',overflowX:'hidden' }}>
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                {!data && busy && <p className="text-sm">Loading existing areas...</p>}
                {data && !data.ready && <p className="text-sm">Apply the Institutional Management migrations before linking areas.</p>}
                {data?.ready && <><SearchableChoice id={'office-service-area-' + office.office_id} label="Community Service Area" value={selected} onChange={setSelected} disabled={busy || Boolean(current)} emptyLabel="Create an area using this office name" options={(data.areas || []).filter(area => area.is_active || area.department_id === current?.department_id).map(area => ({ value:area.department_id,label:area.department_name + (data.links.some(link => link.department_id === area.department_id && link.office_id !== office.office_id) ? ' (Already linked)' : ''),disabled:!area.is_active || data.links.some(link => link.department_id === area.department_id && link.office_id !== office.office_id) }))} /><p className="text-xs text-muted-foreground">Link an existing area to avoid duplicates, or create one using this office name. Personnel-In-Charge is managed in Community Service; course assignments stay in Offices & Departments.</p>{current && <p className="text-xs text-muted-foreground">Already linked. Manage this area and its office link in Community Service.</p>}</>}
            </div>
            <DialogFooter className="m-0 flex-row flex-wrap rounded-none p-4"><Button variant="outline" disabled={busy} onClick={()=>setOpen(false)}>{current ? 'Close' : 'Cancel'}</Button>{!current && <Button disabled={busy || !data?.ready} onClick={save} style={{ background:'var(--portal-base)',color:'white' }}>{busy ? 'Saving...' : 'Use as Service Area'}</Button>}</DialogFooter>
        </DialogContent></Dialog></>;
}
