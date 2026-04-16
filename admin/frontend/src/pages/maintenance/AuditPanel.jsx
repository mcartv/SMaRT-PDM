import React from 'react';
import { ClipboardList } from 'lucide-react';

export default function AuditPanel() {
    return (
        <div className="flex flex-col items-center justify-center h-64 text-stone-400 opacity-50">
            <ClipboardList size={42} className="mb-4" />
            <p className="text-sm font-medium">Audit Trail Access Restricted</p>
        </div>
    );
}