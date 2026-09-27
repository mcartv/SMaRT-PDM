const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (parts) =>
  fs.readFileSync(path.join(root, 'frontend', 'lib', ...parts), 'utf8');

const payout = read(['features','scholar','presentation','screens','payout_schedule_screen.dart']);
const renewal = read(['features','applicant','presentation','screens','scholar_renewal_requirements_screen.dart']);
const dashboard = read(['features','dashboard','presentation','screens','dashboard_screen.dart']);
const about = read(['features','profile','presentation','screens','about_pdm_screen.dart']);

test('payout supports multiple releases and starts with cards closed', () => {
  assert.match(payout, /_expandedPayouts/);
  assert.match(payout, /AnimatedSize/);
  assert.match(payout, /keyboard_arrow_down_rounded/);
  assert.doesNotMatch(payout, /_initializedPayoutExpansion/);
  assert.match(payout, /Batch Status/);
  assert.match(payout, /useCompactPhoneLayout/);
  assert.match(payout, /constraints\.maxWidth < 420/);
  assert.match(payout, /payout\.benefactorName/);
  assert.match(payout, /_formatAmount\(payout\.amount\)/);
  assert.match(payout, /width: double\.infinity/);
  assert.match(payout, /'Payout amount'/);
  assert.match(payout, /AnimatedContainer/);
});

test('renewal uses the approved semester wording and visual period card', () => {
  const header = renewal.slice(
    renewal.indexOf('Widget _buildHeaderCard'),
    renewal.indexOf('Widget _buildDocumentRow')
  );
  assert.doesNotMatch(header, /package\.studentName|package\.studentNumber/);
  assert.match(renewal, /Renewal is not required for this semester because your scholarship is already active/);
  assert.match(renewal, /Renewal is only needed for the next semester/);
  assert.match(renewal, /Widget _buildPeriodCard/);
  assert.doesNotMatch(renewal, /'OSFA Feedback'/);
});

test('active scholar dashboard skips redundant scholar overview', () => {
  assert.doesNotMatch(dashboard, /Scholar Overview|Scholarship Overview/);
  assert.match(dashboard, /showOverview = !_hasScholarAccess \|\| _scholarPrivilegeRemoved/);
  assert.match(dashboard, /Scholar Updates/);
});

test('About SMaRT-PDM is expandable except for About this app', () => {
  assert.match(about, /class _AboutHeroSection/);
  assert.match(about, /initiallyExpanded: true/);
  assert.match(about, /class _AboutExpandableSection/);
  assert.match(about, /class _MissionVisionSection/);
  assert.match(about, /class _WhatYouCanDoRows/);
  assert.match(about, /class _AboutThisAppCard/);
  const footer = about.slice(about.indexOf('class _AboutThisAppCard'));
  assert.doesNotMatch(footer, /ExpansionTile\(/);
});
