'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('Maintenance current top-level naming matches the live system', () => {
  const maintenance = read('frontend/src/pages/maintenance/Maintenance.jsx');
  const general = read('frontend/src/pages/maintenance/GeneralPanel.jsx');

  assert.match(maintenance, /Scholarship Programs/);
  assert.match(maintenance, /System Logs/);
  assert.match(general, /key:\s*'system',\s*label:\s*'System'/);

  assert.doesNotMatch(general, /System & OCR/);
});

test('Maintenance navigation remains compact and horizontally scrollable', () => {
  const maintenance = read('frontend/src/pages/maintenance/Maintenance.jsx');

  assert.match(maintenance, /overflow-x-auto/);
  assert.match(maintenance, /flex w-max min-w-max/);
  assert.match(maintenance, /min-w-max/);
  assert.match(maintenance, /text-sm font-semibold leading-tight/);
  assert.match(maintenance, /strokeWidth=\{1\.8\}/);
  assert.doesNotMatch(maintenance, /text-\[13px\]|2xl:text-sm|font-medium transition 2xl:/);
});

test('Maintenance cards share one title and subtitle typography system', () => {
  const typography = read('frontend/src/pages/maintenance/components/maintenanceTypography.js');
  const panels = [
    'frontend/src/pages/maintenance/GeneralPanel.jsx',
    'frontend/src/pages/maintenance/AccountsPanel.jsx',
    'frontend/src/pages/maintenance/Maintenance.jsx',
    'frontend/src/pages/maintenance/LandingThemePanel.jsx',
    'frontend/src/pages/maintenance/ThemePanel.jsx',
    'frontend/src/pages/maintenance/ScholarshipProgramsPanel.jsx',
    'frontend/src/pages/maintenance/AcademicYearPanel.jsx',
    'frontend/src/pages/maintenance/CoursesPanel.jsx',
    'frontend/src/pages/maintenance/ROSettingsPanel.jsx',
    'frontend/src/pages/maintenance/StudentRegistryPanel.jsx',
    'frontend/src/pages/maintenance/AuditPanel.jsx',
    'frontend/src/pages/maintenance/SystemPanel.jsx',
  ].map(read).join('\n');

  assert.match(typography, /MAINTENANCE_CARD_TITLE_CLASS[\s\S]*text-base font-semibold leading-6/);
  assert.match(typography, /MAINTENANCE_CARD_SUBTITLE_CLASS[\s\S]*text-sm font-normal leading-5/);
  assert.equal((panels.match(/MAINTENANCE_CARD_TITLE_CLASS/g) || []).length >= 10, true);
  assert.equal((panels.match(/MAINTENANCE_CARD_SUBTITLE_CLASS/g) || []).length >= 9, true);
});

test('General maintenance is locked by default while view navigation remains available', () => {
  const general = read('frontend/src/pages/maintenance/GeneralPanel.jsx');

  assert.match(general, /const \[generalEditing, setGeneralEditing\] = useState\(false\)/);
  assert.equal((general.match(/General Configuration/g) || []).length, 1);
  assert.match(general, /aria-pressed=\{generalEditing\}/);
  assert.match(general, /function EditableRegion\(\{ editing, className = '', children \}\)/);
  assert.equal((general.match(/editing=\{generalEditing\}/g) || []).length >= 11, true);
  assert.match(general, /disabled=\{!generalEditing \|\| savingKey === key\}/);
  assert.match(general, /onClick=\{\(\) => setActiveLandingSection\('about'\)\}/);
  assert.match(general, /onClick=\{onToggle\}/);
  assert.match(general, /onClick=\{\(\) => setActiveFaqTab\('current'\)\}/);
  assert.doesNotMatch(general, /officeEditing|setAboutOsfa/);
});

test('Every authenticated Admin account can manage General maintenance', () => {
  const routes = read('backend/routes/generalSettingRoutes.js');
  const service = read('backend/services/generalSettingService.js');

  assert.match(routes, /const adminOnly = \[protect, authorizeRoles\('admin'\)\]/);
  assert.match(routes, /router\.patch\('\/', \.\.\.adminOnly, generalSettingController\.updateGeneralSettings\)/);
  assert.match(service, /String\(actor\.role \|\| ''\)\.trim\(\)\.toLowerCase\(\) === 'admin'/);
});
