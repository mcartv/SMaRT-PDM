import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function OfficeLinkConfirmation({ open, onClose, onConfirm, busy, title, children, confirmLabel = 'Confirm link' }) {
    return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}>
        <DialogContent overlayClassName="z-[70]" className="z-[71] max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-md" showCloseButton={!busy}>
            <DialogHeader className="border-b p-4 pr-12"><DialogTitle>{title}</DialogTitle><DialogDescription className="break-words">{children}</DialogDescription></DialogHeader>
            <p className="px-4 text-xs text-muted-foreground">Existing Personnel-In-Charge assignments and Community Service records will be kept.</p>
            <DialogFooter className="m-0 flex-row flex-wrap rounded-none p-4">
                <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
                <Button disabled={busy} onClick={onConfirm} style={{ background: 'var(--portal-base)', color: 'white' }}>{busy ? 'Saving...' : confirmLabel}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>;
}
