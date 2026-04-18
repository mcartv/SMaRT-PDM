import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, ToggleLeft, ToggleRight } from 'lucide-react';

export const C = {
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

export function FieldLabel({ children }) {
    return (
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-stone-400">
            {children}
        </label>
    );
}

export function GroupCard({ title, icon: Icon = Building2, children }) {
    return (
        <Card className="overflow-hidden rounded-xl border-stone-200 bg-white shadow-none">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100 bg-stone-50/70">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 bg-white">
                    <Icon className="h-3.5 w-3.5 text-stone-600" />
                </div>
                <p className="text-xs font-semibold text-stone-800">{title}</p>
            </div>

            <CardContent className="p-4 space-y-4">
                {children}
            </CardContent>
        </Card>
    );
}

export function Toggle({ value, onChange, labels = ['Enabled', 'Disabled'] }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!value)}
            className="flex items-center gap-2"
        >
            {value ? (
                <ToggleRight className="h-6 w-6 text-green-600" />
            ) : (
                <ToggleLeft className="h-6 w-6 text-stone-300" />
            )}

            <span
                className={`text-[11px] font-medium ${value ? 'text-green-700' : 'text-stone-400'
                    }`}
            >
                {value ? labels[0] : labels[1]}
            </span>
        </button>
    );
}

export function EmptyState({ icon: Icon = Building2, title, subtitle }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 px-5 py-10 text-center">
            <Icon size={32} className="mb-2 text-stone-300" />
            <p className="text-sm font-medium text-stone-700">{title}</p>
            <p className="mt-1 text-xs text-stone-400">{subtitle}</p>
        </div>
    );
}