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
    { key: 'general', label: 'General', icon: Settings, component: GeneralPanel },
    { key: 'benefactors', label: 'Benefactors', icon: Building2, component: BenefactorsPanel },
    { key: 'programs', label: 'Programs', icon: GraduationCap, component: ProgramsPanel },
    { key: 'courses', label: 'Courses', icon: BookOpen, component: CoursesPanel },
    { key: 'registry', label: 'Student Registry', icon: Database, component: RegistrarSync },
    { key: 'system', label: 'System', icon: Cpu, component: SystemPanel },
    { key: 'audit', label: 'Audit', icon: ClipboardList, component: AuditPanel },
];

function TopNavBar({ tabs, activeTab, onChange }) {
    return (
        <div className="border-b border-stone-200 bg-white">
            <div className="flex items-center gap-6 px-4 overflow-x-auto">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;

                    return (
                        <button
                            key={tab.key}
                            onClick={() => onChange(tab.key)}
                            className={`relative flex items-center gap-2 py-3 text-sm font-medium whitespace-nowrap transition-all
                                ${isActive
                                    ? 'text-stone-900'
                                    : 'text-stone-400 hover:text-stone-700'
                                }`}
                        >
                            <Icon size={14} />

                            {tab.label}

                            {/* underline indicator */}
                            {isActive && (
                                <span className="absolute left-0 bottom-0 h-[2px] w-full bg-stone-900" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function SettingsMaintenance() {
    const [tab, setTab] = useState('general');

    const activeTab = useMemo(
        () => TAB_CONFIG.find((t) => t.key === tab) || TAB_CONFIG[0],
        [tab]
    );

    const ActiveComponent = activeTab.component;
    const isRegistryTab = tab === 'registry';

    return (
        <div
            className="min-h-screen flex flex-col"
            style={{ background: C.bg }}
        >
            {/* TOP HEADER */}
            <div className="px-4 pt-4 pb-2">
                <h1 className="text-xl font-semibold text-stone-900">
                    Settings & Maintenance
                </h1>
                <p className="text-sm text-stone-500">
                    Administrative configuration and system setup
                </p>
            </div>

            {/* 🔥 TOP NAV BAR */}
            <TopNavBar
                tabs={TAB_CONFIG}
                activeTab={tab}
                onChange={setTab}
            />

            {/* CONTENT */}
            <div className="flex-1 p-4">
                <Card className="border-stone-200 shadow-none bg-white h-full flex flex-col">

                    {/* CONTENT BODY */}
                    <div
                        className={`flex-1 overflow-auto ${isRegistryTab
                                ? 'p-3 max-h-[calc(100vh-180px)]'
                                : 'p-5 max-h-[calc(100vh-180px)]'
                            }`}
                    >
                        <ActiveComponent />
                    </div>

                </Card>
            </div>
        </div>
    );
}