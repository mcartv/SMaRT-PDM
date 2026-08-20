import React from 'react';
import {
    Activity,
    Archive,
    BadgeCheck,
    Ban,
    Bell,
    ClipboardCheck,
    FileUp,
    KeyRound,
    LogIn,
    LogOut,
    Megaphone,
    Pencil,
    PlusCircle,
    RotateCcw,
    ScanLine,
    Settings,
    ShieldAlert,
    UserRoundCog,
    WalletCards,
    XCircle,
} from 'lucide-react';

const VISUAL_RULES = [
    {
        match: /(retry|rescan).*ocr|ocr.*(retry|rescan)/i,
        icon: RotateCcw,
        label: 'OCR retry or rescan',
        className: 'border-sky-100 bg-sky-50 text-sky-700',
    },
    {
        match: /(run|start).*ocr|ocr.*(run|start)/i,
        icon: ScanLine,
        label: 'OCR scan started',
        className: 'border-blue-100 bg-blue-50 text-blue-700',
    },
    {
        match: /cancel.*ocr|ocr.*cancel/i,
        icon: Ban,
        label: 'OCR scan cancelled',
        className: 'border-red-100 bg-red-50 text-red-700',
    },
    {
        match: /(confirm|verify|approve).*ocr|ocr.*(confirm|verify|approve)/i,
        icon: BadgeCheck,
        label: 'OCR result confirmed',
        className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    },
    {
        match: /reject.*ocr|ocr.*reject/i,
        icon: XCircle,
        label: 'OCR result rejected',
        className: 'border-red-100 bg-red-50 text-red-700',
    },
    {
        match: /import|registrar|student registry/i,
        icon: FileUp,
        label: 'Data import',
        className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    },
    {
        match: /archive/i,
        icon: Archive,
        label: 'Archived record',
        className: 'border-amber-100 bg-amber-50 text-amber-700',
    },
    {
        match: /login|signed in/i,
        icon: LogIn,
        label: 'Signed in',
        className: 'border-green-100 bg-green-50 text-green-700',
    },
    {
        match: /logout|signed out/i,
        icon: LogOut,
        label: 'Signed out',
        className: 'border-stone-200 bg-stone-50 text-stone-600',
    },
    {
        match: /password|credential|reset/i,
        icon: KeyRound,
        label: 'Account security',
        className: 'border-amber-100 bg-amber-50 text-amber-700',
    },
    {
        match: /announcement|publish/i,
        icon: Megaphone,
        label: 'Announcement',
        className: 'border-violet-100 bg-violet-50 text-violet-700',
    },
    {
        match: /notification/i,
        icon: Bell,
        label: 'Notification',
        className: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    },
    {
        match: /payout|disbursement|payment/i,
        icon: WalletCards,
        label: 'Payout activity',
        className: 'border-teal-100 bg-teal-50 text-teal-700',
    },
    {
        match: /return of obligation|ro coordinator|\bro\b|placement|assignment/i,
        icon: ClipboardCheck,
        label: 'Return of Obligation activity',
        className: 'border-cyan-100 bg-cyan-50 text-cyan-700',
    },
    {
        match: /account|profile|user/i,
        icon: UserRoundCog,
        label: 'Account activity',
        className: 'border-orange-100 bg-orange-50 text-orange-700',
    },
    {
        match: /reject|decline|disqualif|failed|error/i,
        icon: ShieldAlert,
        label: 'Rejected or failed action',
        className: 'border-red-100 bg-red-50 text-red-700',
    },
    {
        match: /approve|verify|confirm|qualif|complete/i,
        icon: BadgeCheck,
        label: 'Approved or completed action',
        className: 'border-green-100 bg-green-50 text-green-700',
    },
    {
        match: /create|add|new/i,
        icon: PlusCircle,
        label: 'Created record',
        className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    },
    {
        match: /update|edit|change|adjust/i,
        icon: Pencil,
        label: 'Updated record',
        className: 'border-blue-100 bg-blue-50 text-blue-700',
    },
    {
        match: /setting|maintenance|configure/i,
        icon: Settings,
        label: 'System setting',
        className: 'border-slate-200 bg-slate-50 text-slate-600',
    },
];

function buildSearchText(item = {}) {
    return [
        item.action_taken,
        item.description,
        item.module,
        item.entity_type,
    ]
        .filter(Boolean)
        .join(' ');
}

function resolveVisual(item = {}) {
    const text = buildSearchText(item);

    return (
        VISUAL_RULES.find((rule) => rule.match.test(text)) || {
            icon: Activity,
            label: 'System activity',
            className: 'border-stone-200 bg-stone-50 text-stone-600',
        }
    );
}

export default function SystemLogIcon({
    item,
    size = 'md',
    className = '',
}) {
    const visual = resolveVisual(item);
    const Icon = visual.icon;

    const dimensions =
        size === 'sm'
            ? 'h-7 w-7 rounded-lg'
            : 'h-9 w-9 rounded-xl';

    const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

    return (
        <div
            className={`flex shrink-0 items-center justify-center border ${dimensions} ${visual.className} ${className}`}
            title={visual.label}
            aria-label={visual.label}
        >
            <Icon className={iconSize} aria-hidden="true" />
        </div>
    );
}
