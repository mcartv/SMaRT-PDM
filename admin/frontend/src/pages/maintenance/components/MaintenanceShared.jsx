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
        <label className="text-[11px] font-medium uppercase tracking-wide block mb-1.5 text-stone-400">
            {children}
        </label>
    );
}

export function GroupCard({ title, icon: Icon, children }) {
    return (
        <Card className="overflow-hidden border-stone-200 shadow-none bg-white">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-stone-100 bg-stone-50/60">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-white border border-stone-200">
                    <Icon className="w-4 h-4 text-stone-600" />
                </div>
                <p className="text-sm font-semibold text-stone-800">{title}</p>
            </div>
            <CardContent className="p-5 space-y-5">{children}</CardContent>
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
                <ToggleRight className="w-7 h-7 text-green-600" />
            ) : (
                <ToggleLeft className="w-7 h-7 text-stone-300" />
            )}
            <span className={`text-xs font-medium ${value ? 'text-green-700' : 'text-stone-400'}`}>
                {value ? labels[0] : labels[1]}
            </span>
        </button>
    );
}

export function EmptyState({ icon: Icon = Building2, title, subtitle }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
            <Icon size={40} className="mb-3 text-stone-300" />
            <p className="text-sm font-semibold text-stone-700">{title}</p>
            <p className="text-xs text-stone-400 mt-1">{subtitle}</p>
        </div>
    );
}