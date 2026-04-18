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

import GeneralPanel from './GeneralPanel';
import BenefactorsPanel from './BenefactorsPanel';
import ProgramsPanel from './ProgramsPanel';
import CoursesPanel from './CoursesPanel';
import StudentRegistryPanel from './StudentRegistryPanel';
import SystemPanel from './SystemPanel';
import AuditPanel from './AuditPanel';

const C = {
  bg: '#faf7f2',
  line: '#e7e5e4',
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  brownSoft: '#f6efe8',
  text: '#1c1917',
};

const TABS = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'benefactors', label: 'Benefactors', icon: Building2 },
  { key: 'programs', label: 'Programs', icon: GraduationCap },
  { key: 'courses', label: 'Courses', icon: BookOpen },
  { key: 'registry', label: 'Student Registry', icon: Database },
  { key: 'system', label: 'System', icon: Cpu },
  { key: 'audit', label: 'Audit', icon: ClipboardList },
];

function NavItem({ item, active, onClick }) {
  const Icon = item.icon;

  return (
    <button
      onClick={() => onClick(item.key)}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm transition ${
        active
          ? 'bg-[#f6efe8] text-[#5c2d0e]'
          : 'text-stone-600 hover:bg-stone-100'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={16} />
        <span className="font-medium">{item.label}</span>
      </div>
      <ChevronRight size={14} className="opacity-50" />
    </button>
  );
}

export default function Maintenance() {
  const [tab, setTab] = useState('general');

  const activeTab = useMemo(
    () => TABS.find((t) => t.key === tab) || TABS[0],
    [tab]
  );

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
        return <StudentRegistryPanel />;
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
      className="h-[calc(100vh-80px)] flex gap-4 overflow-hidden"
      style={{ background: C.bg }}
    >
      {/* LEFT NAVIGATION */}
      <aside className="w-[260px] shrink-0">
        <Card className="h-full border-stone-200 shadow-none flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-stone-100 bg-stone-50">
            <h1 className="text-sm font-semibold text-stone-900">
              Maintenance
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              System configuration
            </p>
          </div>

          {/* Scrollable Tabs */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {TABS.map((item) => (
              <NavItem
                key={item.key}
                item={item}
                active={tab === item.key}
                onClick={setTab}
              />
            ))}
          </div>
        </Card>
      </aside>

      {/* RIGHT PANEL */}
      <main className="flex-1 min-w-0">
        <Card className="h-full border-stone-200 shadow-none flex flex-col overflow-hidden">
          
          {/* Panel Header */}
          <div className="px-5 py-4 border-b border-stone-100 bg-stone-50">
            <h2 className="text-sm font-semibold text-stone-900">
              {activeTab.label}
            </h2>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {renderActiveTab()}
          </div>
        </Card>
      </main>
    </div>
  );
}