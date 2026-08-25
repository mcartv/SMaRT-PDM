import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');

const themeScopedFiles = [
  'src/components/layout/AdminLayout.jsx',
  'src/components/payout/PayoutProofReviewPanel.jsx',
  'src/pages/ApplicationReview.jsx',
  'src/pages/AnnouncementsManagement.jsx',
  'src/pages/PayoutManagement.jsx',
  'src/pages/ProfilePhotoQueue.jsx',
  'src/pages/ROAdmin.jsx',
  'src/pages/ScholarMonitoring.jsx',
  'src/pages/ScholarshipOpenings.jsx',
  'src/pages/maintenance/AcademicYearPanel.jsx',
  'src/pages/maintenance/AccountsPanel.jsx',
  'src/pages/maintenance/AuditPanel.jsx',
  'src/pages/maintenance/BenefactorsPanel.jsx',
  'src/pages/maintenance/CoursesPanel.jsx',
  'src/pages/maintenance/ProgramsPanel.jsx',
  'src/pages/maintenance/ROSettingsPanel.jsx',
  'src/pages/maintenance/StudentRegistryPanel.jsx',
  'src/pages/maintenance/components/MaintenanceShared.jsx',
];

test('admin modules use portal theme tokens instead of legacy brown literals', () => {
  for (const file of themeScopedFiles) {
    const source = read(file);
    assert.doesNotMatch(source, /#7c4a2e|#9a5d3a|#5c2d0e/i, `${file} still contains a legacy Admin theme color`);
  }
});

test('admin primary controls retain the portal token contract', () => {
  const combined = themeScopedFiles.map(read).join('\n');
  assert.match(combined, /var\(--portal-base\)/);
  assert.match(combined, /var\(--portal-accent-soft\)/);
});
