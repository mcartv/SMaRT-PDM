'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('public access copy uses User terminology and the single Login entry', () => {
  const landing = read('frontend/src/pages/SmartPDMLanding.jsx');
  const loginCard = read('frontend/src/components/auth/UnifiedUserLoginCard.jsx');
  const landingDefaults = read('frontend/src/constants/landingContent.js');

  assert.match(landing, />\s*Login\s*</);
  assert.match(loginCard, />\s*Login Access\s*</);
  assert.match(landingDefaults, /authorized users manage scholarship/);
  assert.doesNotMatch(loginCard, /\bstaff\b/i);
  assert.doesNotMatch(landing, /Select your access/);
  assert.doesNotMatch(landing, /const portalLinks = \[/);
});

test('visible fallback copy no longer renders Staff terminology', () => {
  const files = [
    'frontend/src/pages/EndorsementSlipDetail.jsx',
    'frontend/src/pages/PDProfile.jsx',
    'frontend/src/pages/SDOProfile.jsx',
    'frontend/src/pages/PDMaintenance.jsx',
    'frontend/src/pages/SDOMaintenance.jsx',
    'frontend/src/pages/maintenance/ROSettingsPanel.jsx',
    'frontend/src/pages/AdminMessages.jsx',
    'frontend/src/components/department/DepartmentSettingsPage.jsx',
    'frontend/src/components/layout/AdminLayout.jsx',
    'frontend/src/components/layout/SDOLayout.jsx',
  ];

  for (const file of files) {
    assert.doesNotMatch(read(file), /['\"`]([^'\"`]*\bStaff\b[^'\"`]*)['\"`]/);
  }
});

test('SDO current direct layout keeps For Endorsement and All Applicants', () => {
  const sdo = read('frontend/src/components/layout/SDOLayout.jsx');

  assert.match(sdo, /\/sdo\/queue/);
  assert.match(sdo, /For Endorsement/);
  assert.match(sdo, /\/sdo\/tracker/);
  assert.match(sdo, /All Applicants/);
});

test('department navigation uses For Endorsement and preserves RO Requests', () => {
  const sdoLayout = read('frontend/src/components/layout/SDOLayout.jsx');
  const departmentLayout = read('frontend/src/components/layout/DepartmentPortalLayout.jsx');

  assert.match(sdoLayout, /label: 'For Endorsement'/);
  assert.match(departmentLayout, /queueLabel = 'For Endorsement'/);
  assert.match(departmentLayout, /label: 'RO Requests'/);
});

test('endorsement review keeps its compact review surface and standing options', () => {
  const source = read('frontend/src/pages/EndorsementQueue.jsx');

  assert.match(source, /ReviewDrawer|SheetContent/);
  assert.match(source, /Good Scholastic Standing/);
  assert.match(source, /Average Scholastic Standing/);
});
