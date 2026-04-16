import React, { useState } from 'react';
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

export default function SettingsMaintenance() {
    const [tab, setTab] = useState('general');

    const TABS = [
        { key: 'general', label: 'General', icon: Settings },
        { key: 'benefactors', label: 'Benefactors', icon: Building2 },
        { key: 'programs', label: 'Programs', icon: GraduationCap },
        { key: 'courses', label: 'Courses', icon: BookOpen },
        { key: 'registry', label: 'Student Registry', icon: Database },
        { key: 'system', label: 'System', icon: Cpu },
        { key: 'audit', label: 'Audit', icon: ClipboardList },
    ];

    const renderActiveTab = () => {
        switch (tab) {
            case 'general':
                return <GeneralPanel />;

            case 'benefactors':
                return <BenefactorsPanel />;

            case 'programs':
                return <ProgramsPanel />;

            case 'courses':
                return <CoursesPanel />;

            case 'registry':
                return <RegistrarSync />;

            case 'system':
                return <SystemPanel />;

            case 'audit':
                return <AuditPanel />;

            default:
                return <GeneralPanel />;
        }
    };

    return (
        <div
            className="space-y-5 py-2 animate-in fade-in duration-500"
            style={{ background: C.bg }}
        >
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                    Settings & Maintenance
                </h1>
                <p className="text-sm text-stone-500 mt-1">
                    Administrative configuration and reusable system templates
                </p>
            </div>

            <Card className="border-stone-200 shadow-none overflow-hidden min-h-[600px]">
                <div className="flex border-b border-stone-100 bg-stone-50/50 overflow-x-auto">
                    {TABS.map((t) => {
                        const Icon = t.icon;
                        const isActive = tab === t.key;

                        return (
                            <button
                                key={t.key}
                                type="button"
                                onClick={() => setTab(t.key)}
                                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all shrink-0 ${isActive
                                    ? 'text-stone-900 border-stone-900 bg-white'
                                    : 'text-stone-400 border-transparent hover:text-stone-600'
                                    }`}
                            >
                                <Icon size={14} />
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                <div className="p-5">
                    {renderActiveTab()}
                </div>
            </Card>

            <footer className="pt-6 pb-2 border-t border-stone-100">
                <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
                    SMaRT PDM · Administrative Maintenance Layer
                </p>
            </footer>
        </div>
    );
}