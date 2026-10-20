import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableChoice } from './InstitutionalControls';
import { useRbacPermissions } from '@/context/RbacPermissionContext';
import { buildApiUrl } from '@/api';
import { showAppToast } from '@/utils/appToast';

export default function CommunityOfficeLink({ area }) {
    const { hasPermission } = useRbacPermissions();
    const [open, setOpen] = useState(false);
    const [data, setData] = useState(null);
    const [selected, setSelected] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const original = data?.links?.find(link => link.department_id === area.department_id)?.office_id || null;
    const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem('adminToken') || ''}`, 'Content-Type': 'application/json' });
    async function load() {
        setOpen(true); setBusy(true); setData(null); setError('');
        try {
            const response = await fetch(buildApiUrl('/api/offices/community-links'), { headers: headers(), cache: 'no-store' });
            const result = await response.json();
            if (!response.ok) throw Error(result.error || 'Unable to load office links.');
            setData(result); setSelected(result.links.find(link => link.department_id === area.department_id)?.office_id || '');
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
    }
    async function save() {
        if (lock.current) return;
        lock.current = true; setBusy(true); setError('');
        try {
            const response = await fetch(buildApiUrl('/api/offices/community-links/' + area.department_id), { method: 'PUT', headers: headers(), body: JSON.stringify({ office_id: selected || null, expected_office_id: original }) });
            const result = await response.json();
            if (!response.ok) throw Error(result.error || 'Unable to save the office link.');
            showAppToast('success', 'Office link saved'); setOpen(false);
        } catch (err) { setError(err.message); }
        finally { lock.current = false; setBusy(false); }
    }
    if (!hasPermission('ro.view')) return null;
    return <><Button variant="outline" size="sm" className="h-7 rounded-lg px-2 text-xs" onClick={load}>Office link</Button>
        <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
            <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={!busy}>
                <DialogHeader className="shrink-0 border-b p-4 pr-12"><DialogTitle>Link institutional office</DialogTitle><DialogDescription>{area.department_name}</DialogDescription></DialogHeader>
                <div className="min-h-0 space-y-3 p-4" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
                    <p className="text-xs text-muted-foreground">Optional. Personnel-In-Charge is managed in Community Service. Course assignments stay in Offices & Departments.</p>
                    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                    {busy && !data && <p className="text-sm">Loading offices...</p>}
                    {data && !data.ready && <p className="text-sm">Apply the Institutional Management migration before linking offices.</p>}
                    {data?.ready && <SearchableChoice id={'community-office-' + area.department_id} label="Institutional office" value={selected} onChange={setSelected} disabled={busy || !hasPermission('ro.settings_manage')} options={data.offices.filter(office => office.is_active || office.office_id === original).map(office => ({ value: office.office_id, label: office.office_name + (office.is_institutional === false ? ' (Legacy office)' : !office.is_active ? ' (Archived)' : '') + (data.links.some(link => link.office_id === office.office_id && link.department_id !== area.department_id) ? ' (Already linked)' : ''), disabled: office.is_institutional === false || !office.is_active || data.links.some(link => link.office_id === office.office_id && link.department_id !== area.department_id) }))} emptyLabel="No office linked" />}
                </div>
                <DialogFooter className="m-0 flex-row flex-wrap rounded-none p-4"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !data?.ready || !hasPermission('ro.settings_manage') || (selected || null) === original} style={{ background: 'var(--portal-base)', color: 'white' }} onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
        </Dialog></>;
}
