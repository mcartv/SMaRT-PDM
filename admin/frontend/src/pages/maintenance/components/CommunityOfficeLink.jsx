import { Link2, Unlink } from 'lucide-react';
import OfficeLinkConfirmation from './OfficeLinkConfirmation';
import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableChoice } from './InstitutionalControls';
import { useRbacPermissions } from '@/context/RbacPermissionContext';
import { buildApiUrl } from '@/api';
import { showAppToast } from '@/utils/appToast';

export default function CommunityOfficeLink({ area, catalog, onSaved }) {
    const { hasPermission } = useRbacPermissions();
    const [confirming, setConfirming] = useState(false);
    const [open, setOpen] = useState(false);
    const [data, setData] = useState(null);
    const [selected, setSelected] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const original = data?.links?.find(link => link.department_id === area.department_id)?.office_id || null;
    const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem('adminToken') || ''}`, 'Content-Type': 'application/json' });
    async function load() {
        setConfirming(false); setOpen(true); setBusy(true); setData(null); setError('');
        try {
            const response = await fetch(buildApiUrl('/api/offices/community-links'), { headers: headers(), cache: 'no-store' });
            const result = await response.json();
            if (!response.ok) throw Error(result.error || 'Unable to load office links.');
            setData(result);
            const existing = result.links.find(link => link.department_id === area.department_id)?.office_id;
            const matches = (result.suggestions || []).filter(item => item.department_ids.length === 1 && item.department_ids[0] === area.department_id && !result.links.some(link => link.office_id === item.office_id));
            const suggestion = matches.length === 1 && result.offices.find(office => office.office_id === matches[0].office_id && office.is_active && office.is_institutional !== false);
            setSelected(existing || suggestion?.office_id || '');
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
            showAppToast('success', selected ? original ? 'Office link updated' : 'Office linked' : 'Office unlinked'); setConfirming(false); setOpen(false); onSaved?.();
        } catch (err) { setConfirming(false); setError(err.message); showAppToast('error', 'Unable to update office link', err.message); }
        finally { lock.current = false; setBusy(false); }
    }
    if (!hasPermission('ro.view')) return null;
    const linkedId = catalog?.links?.find(link => link.department_id === area.department_id)?.office_id;
    const linkedOffice = catalog?.offices?.find(office => office.office_id === linkedId);
    const selectedOffice = data?.offices?.find(office => office.office_id === selected);
    return <><Button variant="outline" size="sm" title={linkedOffice?.office_name || 'Choose an office'} aria-label={linkedId ? 'Manage office link for ' + area.department_name : 'Link office for ' + area.department_name} disabled={!catalog?.ready} className={`h-7 shrink-0 gap-1.5 rounded-lg px-2 text-xs ${linkedId ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-stone-200'}`} onClick={load}>
        {linkedId ? <Link2 className="size-3.5" /> : <Unlink className="size-3.5" />}{linkedId ? 'Linked' : 'Link office'}
    </Button>
    <OfficeLinkConfirmation open={confirming} onClose={() => setConfirming(false)} onConfirm={save} busy={busy} title={selected ? original ? 'Change office link?' : 'Link this office?' : 'Unlink this office?'} confirmLabel={selected ? original ? 'Confirm change' : 'Confirm link' : 'Confirm unlink'}>
        {selected ? `Connect “${area.department_name}” to “${selectedOffice?.office_name}”?` : `Remove the office connection for “${area.department_name}”? The area will remain available.`}
    </OfficeLinkConfirmation>
        <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
            <DialogContent overlayClassName="z-[60]" className="z-[61] flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" showCloseButton={!busy}>
                <DialogHeader className="shrink-0 border-b p-4 pr-12"><DialogTitle>Link institutional office</DialogTitle><DialogDescription>{area.department_name}</DialogDescription></DialogHeader>
                <div className="min-h-0 space-y-3 p-4" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
                    <p className="text-xs text-muted-foreground">Optional. Personnel-In-Charge is managed in Community Service. Course assignments stay in Offices & Departments.</p>
                    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                    {busy && !data && <p className="text-sm">Loading offices...</p>}
                    {data && !data.ready && <p className="text-sm">Apply the Institutional Management migration before linking offices.</p>}
                    {data?.ready && <SearchableChoice id={'community-office-' + area.department_id} label="Institutional office" value={selected} onChange={setSelected} disabled={busy || !hasPermission('ro.settings_manage')} options={data.offices.filter(office => office.is_active || office.office_id === original).map(office => ({ value: office.office_id, label: office.office_name + (office.is_institutional === false ? ' (Legacy office)' : !office.is_active ? ' (Archived)' : '') + (data.links.some(link => link.office_id === office.office_id && link.department_id !== area.department_id) ? ' (Already linked)' : ''), disabled: office.is_institutional === false || !office.is_active || data.links.some(link => link.office_id === office.office_id && link.department_id !== area.department_id) }))} emptyLabel="No office linked" />}
                </div>
                <DialogFooter className="m-0 flex-row flex-wrap rounded-none p-4"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !data?.ready || !hasPermission('ro.settings_manage') || (selected || null) === original} style={{ background: 'var(--portal-base)', color: 'white' }} onClick={() => setConfirming(true)}>{selected ? original ? 'Change link' : 'Link office' : 'Unlink office'}</Button></DialogFooter>
            </DialogContent>
        </Dialog></>;
}
