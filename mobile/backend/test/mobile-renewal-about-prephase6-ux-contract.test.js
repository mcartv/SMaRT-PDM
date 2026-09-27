const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (parts) =>
  fs.readFileSync(path.join(root, 'frontend', 'lib', ...parts), 'utf8');

const renewal = read([
  'features',
  'applicant',
  'presentation',
  'screens',
  'scholar_renewal_requirements_screen.dart',
]);
const about = read([
  'features',
  'profile',
  'presentation',
  'screens',
  'about_pdm_screen.dart',
]);

test('Renewal uses a visual status card plus a separate academic period card', () => {
  assert.match(renewal, /Widget _buildHeaderCard/);
  assert.match(renewal, /Widget _buildPeriodCard/);
  assert.match(renewal, /Academic Period/);
  assert.match(renewal, /Renewal Progress/);
  assert.match(renewal, /Renewal Status/);
  assert.match(renewal, /\$uploadedCount of \$totalCount uploaded/);
});

test('Renewal unavailable wording is semester-specific and approved by product', () => {
  assert.match(
    renewal,
    /Renewal is not required for this semester because your scholarship is already active\. Renewal is only needed for the next semester\./
  );
  assert.doesNotMatch(renewal, /belongs to this semester/);
  assert.doesNotMatch(renewal, /next renewal period/);
});

test('Renewal no longer renders the OSFA Feedback card', () => {
  assert.doesNotMatch(renewal, /_shouldShowOsfaFeedback/);
  assert.doesNotMatch(renewal, /'OSFA Feedback'/);
  assert.doesNotMatch(renewal, /Check OSFA Feedback below/);
});

test('About makes every information section expandable except About this app', () => {
  assert.match(about, /class _AboutHeroSection/);
  assert.match(about, /initiallyExpanded: true/);
  assert.match(about, /class _AboutExpandableSection/);
  assert.match(about, /class _MissionVisionSection/);
  assert.match(about, /class _WhatYouCanDoRows/);
  assert.match(about, /class _AboutThisAppCard/);

  const aboutThisApp = about.slice(about.indexOf('class _AboutThisAppCard'));
  assert.doesNotMatch(aboutThisApp, /ExpansionTile\(/);
});

test('What you can do uses compact feature rows instead of one paragraph', () => {
  assert.match(about, /class _FeatureRow/);
  assert.match(about, /title: 'Application'/);
  assert.match(about, /title: 'Scholarship updates'/);
  assert.match(about, /title: 'Payout & renewal'/);
  assert.match(about, /title: 'Return of Obligation'/);
});
