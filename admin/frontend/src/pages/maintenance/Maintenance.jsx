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

function TopNav({ tabs, active, onChange }) {
  return (
    <div className="sticky top-0 z-20 border-b border-stone-200 bg-white">
      <div className="flex items-center gap-6 px-4 overflow-x-auto">
        {tabs.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={`relative flex items-center gap-2 py-3 text-sm font-medium whitespace-nowrap transition
                ${isActive
                  ? 'text-stone-900'
                  : 'text-stone-400 hover:text-stone-700'
                }`}
            >
              <Icon size={14} />
              {item.label}

              {isActive && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-stone-900" />
              )}
            </button>
          );
        })}
      </div>
    </div>
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

  const isRegistry = tab === 'registry';

  return (
    <div
      className="flex flex-col"
      style={{
        background: C.bg,
        minHeight: 'calc(100dvh - 120px)',
      }}
    >
      {/* TOP NAV ONLY */}
      <TopNav tabs={TABS} active={tab} onChange={setTab} />

      {/* CONTENT */}
      <div className="flex-1 p-4">
        <Card className="border-stone-200 shadow-none flex flex-col overflow-hidden rounded-2xl h-full">

          <div
            className={`flex-1 overflow-auto ${isRegistry
                ? 'p-3 max-h-[calc(100vh-140px)]'
                : 'p-5 max-h-[calc(100vh-140px)]'
              }`}
          >
            {renderActiveTab()}
          </div>

        </Card>
      </div>
    </div>
  );
}