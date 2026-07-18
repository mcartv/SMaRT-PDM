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
  UsersRound,
  Palette,
  Clock3,
} from 'lucide-react';

import GeneralPanel from './GeneralPanel';
import StudentRegistryPanel from './StudentRegistryPanel';
import BenefactorsPanel from './BenefactorsPanel';
import ProgramsPanel from './ProgramsPanel';
import CoursesPanel from './CoursesPanel';
import SystemPanel from './SystemPanel';
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
  { key: 'benefactors', label: 'Benefactors', icon: Building2 },
  { key: 'programs', label: 'Programs', icon: GraduationCap },
  { key: 'academic-years', label: 'Academic Years', icon: CalendarRange },
  { key: 'courses', label: 'Courses', icon: BookOpen },
  { key: 'ro-settings', label: 'Obligation', icon: Clock3 },
  { key: 'registry', label: 'Student Registry', icon: Database },
  { key: 'system', label: 'System', icon: Cpu },
  { key: 'audit', label: 'Audit', icon: ClipboardList },
];

function TopNav({ tabs, active, onChange, accentColor }) {
  return (
    <div className="sticky top-0 z-20 border-b border-stone-200 bg-white">
      <div className="flex items-center gap-6 overflow-x-auto px-4">
        {tabs.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`relative flex items-center gap-2 whitespace-nowrap py-3 text-sm font-medium transition ${isActive
                  ? 'text-stone-900'
                  : 'text-stone-400 hover:text-stone-700'
                }`}
            >
              <Icon size={14} />
              {item.label}

              {isActive ? (
                <span
                  className="absolute bottom-0 left-0 h-[2px] w-full"
                  style={{ background: accentColor }}
                />
              ) : null}
            </button>
          );
        })}
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Theme Presets
              </p>
              <p className="mt-1 text-sm text-stone-500">
                Choose which theme area you want to manage.
              </p>

              <div className="mt-4 inline-flex rounded-full border border-stone-200 bg-stone-50 p-1">
                <button
                  type="button"
                  onClick={() => setThemeView('landing')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${themeView === 'landing'
                      ? 'text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                    }`}
                  style={themeView === 'landing' ? { background: theme.base } : undefined}
                >
                  Landing Page
                </button>

                <button
                  type="button"
                  onClick={() => setThemeView('admin')}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${themeView === 'admin'
                      ? 'text-white shadow-sm'
                      : 'text-stone-600 hover:text-stone-900'
                    }`}
                  style={themeView === 'admin' ? { background: theme.base } : undefined}
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
                allowedPortals={['admin', 'sdo', 'guidance', 'pd']}
                editablePortals={['admin']}
                title="Admin Theme"
                subtitle="Manage the admin portal theme here. Other office themes are shown as quick previews only."
              />
            )}
          </div>
        );

      case 'benefactors':
        return <BenefactorsPanel />;

      case 'programs':
        return <ProgramsPanel />;

      case 'academic-years':
        return <AcademicYearPanel />;

      case 'courses':
        return <CoursesPanel />;

      case 'ro-settings':
        return <ROSettingsPanel />;

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
        background: theme.mainBg,
        minHeight: 'calc(100dvh - 120px)',
      }}
    >
      <TopNav
        tabs={TABS}
        active={tab}
        onChange={setTab}
        accentColor={theme.base}
      />

      <div className="flex-1 p-4">
        <Card className="flex h-full flex-col overflow-hidden rounded-2xl border-stone-200 shadow-none">
          <div
            className={`flex-1 overflow-auto ${isRegistry
                ? 'max-h-[calc(100vh-140px)] p-3'
                : 'max-h-[calc(100vh-140px)] p-5'
              }`}
          >
            {renderActiveTab()}
          </div>
        </Card>
      </div>
    </div>
  );
}