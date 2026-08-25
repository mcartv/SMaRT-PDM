import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
    Building2,
    BookOpen,
    Cpu,
    ClipboardList,
    Database,
    Settings,
    GraduationCap,
    ChevronRight,
} from 'lucide-react';

import GeneralPanel from './maintenance/GeneralPanel';
import BenefactorsPanel from './maintenance/BenefactorsPanel';
import ProgramsPanel from './maintenance/ProgramsPanel';
import CoursesPanel from './maintenance/CoursesPanel';
import RegistrarSync from './maintenance/RegistrarSync';
import SystemPanel from './maintenance/SystemPanel';
import AuditPanel from './maintenance/AuditPanel';

const C = {
    bg: '#faf7f2',
};

const TAB_CONFIG = [
    {
        key: 'general',
        label: 'General',
        description: 'System-wide defaults, reusable settings, and foundational maintenance data.',
        icon: Settings,
        component: GeneralPanel,
    },
    {
        key: 'benefactors',
        label: 'Benefactors',
        description: 'Manage sponsoring organizations, funding sources, and benefactor records.',
        icon: Building2,
        component: BenefactorsPanel,
    },
    {
        key: 'programs',
        label: 'Programs',
        description: 'Maintain scholarship programs, eligibility settings, and renewal behavior.',
        icon: GraduationCap,
        component: ProgramsPanel,
    },
    {
        key: 'courses',
        label: 'Courses',
        description: 'Manage academic courses and department-linked records.',
        icon: BookOpen,
        component: CoursesPanel,
    },
    {
        key: 'registry',
        label: 'Student Registry',
        description: 'Sync and maintain registrar-linked student reference records.',
        icon: Database,
        component: RegistrarSync,
    },
    {
        key: 'system',
        label: 'System',
        description: 'Technical configuration, backend controls, and utilities.',
        icon: Cpu,
        component: SystemPanel,
    },
    {
        key: 'audit',
        label: 'Audit',
        description: 'Track administrative actions, maintenance history, and record-level changes.',
        icon: ClipboardList,
        component: AuditPanel,
    },
];

function MobileTabBar({ tabs, activeTab, onChange }) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;

                return (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => onChange(tab.key)}
                        className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${isActive
                                ? 'border-stone-900 bg-stone-900 text-white'
                                : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-800'
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            <Icon size={14} />
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

function DesktopSidebar({ tabs, activeTab, onChange }) {
    return (
        <aside className="hidden md:block md:w-[260px] lg:w-[280px] shrink-0">
            <div className="sticky top-4 rounded-2xl border border-stone-200 bg-white p-3 shadow-none">
                <div className="px-2 pb-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-stone-400">
                        Maintenance Sections
                    </p>
                </div>

                <div className="space-y-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;

                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => onChange(tab.key)}
                                className={`group flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-all ${isActive
                                        ? 'bg-stone-900 text-white'
                                        : 'bg-white text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                                    }`}
                            >
                                <span className="flex min-w-0 items-center gap-3">
                                    <span
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive
                                                ? 'bg-white/15 text-white'
                                                : 'bg-stone-100 text-stone-500 group-hover:bg-stone-200 group-hover:text-stone-700'
                                            }`}
                                    >
                                        <Icon size={15} />
                                    </span>

                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">
                                            {tab.label}
                                        </span>
                                    </span>
                                </span>

                                <ChevronRight
                                    size={15}
                                    className={isActive ? 'text-white/80' : 'text-stone-300'}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}

export default function SettingsMaintenance() {
    const [tab, setTab] = useState('general');

    const activeTab = useMemo(
        () => TAB_CONFIG.find((item) => item.key === tab) || TAB_CONFIG[0],
        [tab]
    );

    const ActiveComponent = activeTab.component;

    return (
        <div
            className="space-y-4 py-2 animate-in fade-in duration-300"
            style={{ background: C.bg }}
        >
            <header className="space-y-2">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                        Settings & Maintenance
                    </h1>
                    <p className="mt-1 text-sm text-stone-500">
                        Administrative configuration, master records, and reusable system setup.
                    </p>
                </div>

                <MobileTabBar
                    tabs={TAB_CONFIG}
                    activeTab={tab}
                    onChange={setTab}
                />
            </header>

            <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <DesktopSidebar
                    tabs={TAB_CONFIG}
                    activeTab={tab}
                    onChange={setTab}
                />

                <main className="min-w-0 flex-1">
                    <Card className="overflow-hidden border-stone-200 shadow-none bg-white">
                        <div className="border-b border-stone-100 bg-stone-50/70 px-5 py-4">
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-stone-200 text-stone-700">
                                    <activeTab.icon size={18} />
                                </div>

                                <div className="min-w-0">
                                    <h2 className="text-base font-semibold text-stone-900">
                                        {activeTab.label}
                                    </h2>
                                    <p className="mt-1 text-sm text-stone-500">
                                        {activeTab.description}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-5">
                            <ActiveComponent />
                        </div>
                    </Card>
                </main>
            </div>

            <footer className="border-t border-stone-100 pt-6 pb-2">
                <p className="text-center text-[11px] uppercase tracking-widest text-stone-300">
                    SMaRT PDM · Administrative Maintenance Layer
                </p>
            </footer>
        </div>
    );
}