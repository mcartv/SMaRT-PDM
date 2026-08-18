import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  BookOpen,
  ClipboardList,
  Database,
  Settings,
  GraduationCap,
  CalendarRange,
  UsersRound,
  Palette,
  Clock3,
} from 'lucide-react';

import GeneralPanel from './GeneralPanel';
import StudentRegistryPanel from './StudentRegistryPanel';
import ScholarshipProgramsPanel from './ScholarshipProgramsPanel';
import CoursesPanel from './CoursesPanel';
import AuditPanel from './AuditPanel';
import AcademicYearPanel from './AcademicYearPanel';
import AccountsPanel from './AccountsPanel';
import ThemePanel from './ThemePanel';
import LandingThemePanel from './LandingThemePanel';
import ROSettingsPanel from './ROSettingsPanel';
import usePortalTheme from '@/hooks/usePortalTheme';

const TABS = [
  { key: 'general', label: 'General', icon: Settings },
  { key: 'accounts', label: 'Accounts', icon: UsersRound },
  { key: 'theme', label: 'Theme', icon: Palette },
  { key: 'scholarship-programs', label: 'Scholarship Programs', icon: GraduationCap },
  { key: 'academic-years', label: 'Academic Years', icon: CalendarRange },
  { key: 'courses', label: 'Courses', icon: BookOpen },
  { key: 'ro-settings', label: 'Obligation', icon: Clock3 },
  { key: 'registry', label: 'Student Registry', icon: Database },
  { key: 'audit', label: 'System Logs', icon: ClipboardList },
];

function TopNav({ tabs, active, onChange }) {
  return (
    <div className="sticky top-0 z-20 border-b border-stone-200 bg-white px-2 py-2">
      <div className="overflow-x-auto">
        <div className="inline-flex min-w-max items-center gap-1 rounded-xl bg-stone-100 p-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onChange(item.key)}
                className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition 2xl:px-3 2xl:text-sm ${
                  isActive
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:bg-white/70 hover:text-stone-900'
                }`}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Maintenance() {
  const [tab, setTab] = useState('general');
  const [themeView, setThemeView] = useState('landing');
  const { theme } = usePortalTheme('admin');

  const renderActiveTab = () => {
    switch (tab) {
      case 'general':
        return <GeneralPanel />;

      case 'accounts':
        return <AccountsPanel />;

      case 'theme':
        return (
          <div className="space-y-5">
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                Theme Presets
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Choose which theme area you want to manage.
              </p>

              <div className="mt-4 inline-flex rounded-xl bg-stone-100 p-1">
                <button
                  type="button"
                  onClick={() => setThemeView('landing')}
                  className={`h-9 rounded-lg px-3 text-sm font-medium transition ${
                    themeView === 'landing'
                      ? 'text-white shadow-sm'
                      : 'text-stone-600 hover:bg-white/70 hover:text-stone-900'
                  }`}
                  style={
                    themeView === 'landing'
                      ? { background: 'var(--portal-base)' }
                      : undefined
                  }
                >
                  Landing Page
                </button>

                <button
                  type="button"
                  onClick={() => setThemeView('admin')}
                  className={`h-9 rounded-lg px-3 text-sm font-medium transition ${
                    themeView === 'admin'
                      ? 'text-white shadow-sm'
                      : 'text-stone-600 hover:bg-white/70 hover:text-stone-900'
                  }`}
                  style={
                    themeView === 'admin'
                      ? { background: 'var(--portal-base)' }
                      : undefined
                  }
                >
                  Admin Theme
                </button>
              </div>
            </div>

            {themeView === 'landing' ? (
              <LandingThemePanel tokenStorageKey="adminToken" />
            ) : (
              <ThemePanel
                tokenStorageKey="adminToken"
                allowedPortals={['admin', 'sdo', 'guidance', 'pd', 'ro_coordinator']}
                editablePortals={['admin']}
                title="Admin Theme"
                subtitle="Manage your personal Admin theme here. Other office login defaults are shown as quick previews only."
              />
            )}
          </div>
        );

      case 'scholarship-programs':
        return <ScholarshipProgramsPanel />;

      case 'academic-years':
        return <AcademicYearPanel />;

      case 'courses':
        return <CoursesPanel />;

      case 'ro-settings':
        return <ROSettingsPanel />;

      case 'registry':
        return <StudentRegistryPanel />;

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
        background: theme.mainBg,
        minHeight: 'calc(100dvh - 120px)',
      }}
    >
      <TopNav tabs={TABS} active={tab} onChange={setTab} />

      <div className="flex-1 p-2.5">
        <Card className="flex h-full flex-col overflow-hidden rounded-xl border-stone-200 shadow-none">
          <div
            className={`flex-1 overflow-auto ${
              isRegistry
                ? 'max-h-[calc(100vh-132px)] p-2.5'
                : 'max-h-[calc(100vh-132px)] p-3'
            }`}
          >
            {renderActiveTab()}
          </div>
        </Card>
      </div>
    </div>
  );
}
