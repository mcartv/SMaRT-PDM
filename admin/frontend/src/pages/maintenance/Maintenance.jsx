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
  CalendarRange,
} from 'lucide-react';

import GeneralPanel from './GeneralPanel';
import BenefactorsPanel from './BenefactorsPanel';
import ProgramsPanel from './ProgramsPanel';
import CoursesPanel from './CoursesPanel';
import StudentRegistryPanel from './StudentRegistryPanel';
import SystemPanel from './SystemPanel';
import AuditPanel from './AuditPanel';
import AcademicYearPanel from './AcademicYearPanel';

const C = {
  bg: '#faf7f2',
};

const TABS = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'benefactors', label: 'Benefactors', icon: Building2 },
  { key: 'programs', label: 'Programs', icon: GraduationCap },
  { key: 'academic-years', label: 'Academic Years', icon: CalendarRange },
  { key: 'courses', label: 'Courses', icon: BookOpen },
  { key: 'registry', label: 'Student Registry', icon: Database },
  { key: 'system', label: 'System', icon: Cpu },
  { key: 'audit', label: 'Audit', icon: ClipboardList },
];

function NavItem({ item, active, onClick }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => onClick(item.key)}
      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm transition ${active
          ? 'bg-[#f6efe8] text-[#5c2d0e]'
          : 'text-stone-600 hover:bg-stone-100'
        }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon size={16} className="shrink-0" />
        <span className="font-medium truncate">{item.label}</span>
      </div>
      <ChevronRight size={14} className="opacity-50 shrink-0" />
    </button>
  );
}

export default function Maintenance() {
  const [tab, setTab] = useState('general');

  const renderActiveTab = () => {
    switch (tab) {
      case 'general':
        return <GeneralPanel />;
      case 'benefactors':
        return <BenefactorsPanel />;
      case 'programs':
        return <ProgramsPanel />;
      case 'academic-years':
        return <AcademicYearPanel />;
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

  const activeTab = useMemo(
    () => TABS.find((t) => t.key === tab) || TABS[0],
    [tab]
  );

  return (
    <div
      className="flex gap-4"
      style={{
        background: C.bg,
        minHeight: 'calc(100dvh - 150px)',
      }}
    >
      <aside className="w-[260px] shrink-0 self-start sticky top-0">
        <Card className="border-stone-200 shadow-none flex flex-col overflow-hidden rounded-2xl">
          <div className="px-5 py-4 border-b border-stone-100 bg-stone-50 shrink-0">
            <h1 className="text-sm font-semibold text-stone-900">Maintenance</h1>
            <p className="text-xs text-stone-500 mt-1">System configuration</p>
          </div>

          <div className="max-h-[calc(100dvh-230px)] overflow-y-auto p-3 space-y-1">
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

      <main className="flex-1 min-w-0">
        <Card className="border-stone-200 shadow-none flex flex-col overflow-hidden rounded-2xl min-h-[calc(100dvh-150px)]">
          <div className="flex-1 overflow-y-auto p-5">
            {renderActiveTab()}
          </div>
        </Card>
      </main>
    </div>
  );
}