import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function SearchableChoice({ id, label, value, onChange, options, disabled, searchable = true, placeholder = 'Select an option', emptyLabel = 'None' }) {
    const [query, setQuery] = useState('');
    const visible = options.filter(option => !searchable || option.value === value || option.label.toLowerCase().includes(query.trim().toLowerCase()));
    return <div className="min-w-0 space-y-1.5">
        <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
        {searchable && <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" /><Input aria-label={`Search ${label.toLowerCase()}`} value={query} onChange={event => setQuery(event.target.value)} disabled={disabled} placeholder={`Search ${label.toLowerCase()}...`} className="h-9 pl-8 text-xs" /></div>}
        <select id={id} value={value || ''} disabled={disabled} onChange={event => onChange(event.target.value)} className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-xs text-foreground">
            <option value="">{emptyLabel || placeholder}</option>
            {visible.map(option => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
        </select>
    </div>;
}

export function TransferConfirmation({ transfer, onCancel, onConfirm, busy = false }) {
    return <Dialog open={Boolean(transfer)} onOpenChange={open => { if (!open && !busy) onCancel(); }}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col gap-0 p-0 sm:max-w-lg" showCloseButton={!busy}>
            <DialogHeader className="shrink-0 border-b p-4 pr-12"><DialogTitle>Confirm course reassignment</DialogTitle><DialogDescription>These supervising office links will change. Existing course IDs, student records, applications, and Program Director review assignments will be preserved.</DialogDescription></DialogHeader>
            <div className="min-h-0 space-y-2 p-4 text-sm" style={{ overflowY: 'auto' }}>{(transfer?.items || []).map(item => <p key={item.course_id} className="break-words"><strong>{item.course_code}</strong><span className="block text-xs text-muted-foreground">{item.from_name || 'Unassigned'} → {item.to_name || 'Unassigned'}</span></p>)}</div>
            <DialogFooter className="m-0 shrink-0 flex-row flex-wrap rounded-none p-4"><Button variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button><Button disabled={busy} style={{ background: 'var(--portal-base)', color: 'white' }} onClick={onConfirm}>{busy ? 'Saving...' : 'Confirm & Save'}</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}
