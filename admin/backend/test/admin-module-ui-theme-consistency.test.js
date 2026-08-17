const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const payout = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/PayoutManagement.jsx'),
  'utf8'
);
const openings = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/ScholarshipOpenings.jsx'),
  'utf8'
);
const dashboard = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/AdminDashboard.jsx'),
  'utf8'
);
const announcements = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/AnnouncementsManagement.jsx'),
  'utf8'
);
const profilePhotos = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/ProfilePhotoQueue.jsx'),
  'utf8'
);
const obligations = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/ROAdmin.jsx'),
  'utf8'
);
const adminLayout = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/components/layout/AdminLayout.jsx'),
  'utf8'
);
const departmentLayout = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/components/layout/DepartmentPortalLayout.jsx'),
  'utf8'
);
const dashboardService = fs.readFileSync(
  path.resolve(__dirname, '../services/dashboardService.js'),
  'utf8'
);

test('admin payout controls inherit the active portal theme and keep neutral segmented filters', () => {
  assert.match(payout, /brownMid: 'var\(--portal-base\)'/);
  assert.match(payout, /bg: 'var\(--portal-main-bg/);
  assert.match(payout, /Payout Proof Review/);
  assert.match(payout, /bg-white text-stone-900 shadow-sm/);
  assert.doesNotMatch(payout, /style=\{workspaceView === key/);
  assert.doesNotMatch(payout, /brownMid: '#7c4a2e'/);
});

test('payout batches use wider admin operational cards instead of cramped three-column cards', () => {
  assert.match(payout, /2xl:grid-cols-2/);
  assert.match(payout, /sm:grid-cols-2/);
  assert.doesNotMatch(payout, /2xl:grid-cols-3/);
  assert.match(payout, /Batch Total/);
  assert.match(payout, /Academic Period/);
  assert.match(payout, /Amount \/ Scholar/);
  assert.match(payout, /borderLeft: '4px solid var\(--portal-base\)'/);
});

test('opening registry cards use consistent text and button sizing with theme-aware primary actions', () => {
  assert.match(openings, /text-base font-semibold leading-6 text-stone-900/);
  assert.match(openings, /h-9 rounded-lg/);
  assert.match(openings, /Allocated Slots/);
  assert.match(openings, /Available/);
  assert.match(openings, /background: C\.brownMid/);
  assert.match(openings, /borderLeft: '4px solid var\(--portal-base\)'/);
  assert.doesNotMatch(openings, /brownMid: '#7c4a2e'/);
});

test('opening page filters use the same neutral segmented-control pattern as Registry/Renewals', () => {
  assert.match(openings, /bg-white text-stone-900 shadow-sm/);
  assert.match(openings, /Filters/);
  assert.match(openings, /bg-stone-900 px-2 py-0\.5/);
  assert.match(openings, /Create Opening/);
  assert.doesNotMatch(openings, /style=\{pageTab === 'current' \? \{ background: C\.brownMid/);
});

test('admin dashboard keeps the gradient hero and replaces duplicated workload chart with application flow', () => {
  assert.match(dashboard, /linear-gradient\(135deg/);
  assert.match(dashboard, /OSFA Administration/);
  assert.match(dashboard, /Administrator Dashboard/);
  assert.match(dashboard, /Scholarship operations/);
  assert.match(dashboard, /Application Flow/);
  assert.match(dashboard, /applicationPipeline/);
  assert.match(dashboard, /pipelineTotal/);
  assert.match(dashboard, /Ready for Activation/);
  assert.match(dashboard, /Waiting List/);
  assert.match(dashboard, /Benefactors/);
  assert.doesNotMatch(dashboard, /OSFA Workload/);
  assert.doesNotMatch(dashboard, /BarChart/);
});

test('announcements use readable card-based UI and neutral filter tabs', () => {
  assert.match(announcements, /brownMid: 'var\(--portal-base\)'/);
  assert.match(announcements, /rounded-2xl border border-stone-200 bg-white transition/);
  assert.match(announcements, /line-clamp-3 text-sm leading-6 text-stone-600/);
  assert.match(announcements, /xl:grid-cols-2/);
  assert.match(announcements, /bg-white text-stone-900 shadow-sm/);
  assert.doesNotMatch(announcements, /tab === 'active' \? \{ background: 'var\(--portal-accent-soft\)'/);
});

test('profile photo review uses a focused review workspace and neutral queue filters', () => {
  assert.match(profilePhotos, /var\(--portal-main-bg/);
  assert.match(profilePhotos, /xl:grid-cols-\[minmax\(0,1fr\)_360px\]/);
  assert.match(profilePhotos, /Review Decision/);
  assert.match(profilePhotos, /Current Approved Photo/);
  assert.match(profilePhotos, /xl:sticky xl:top-4/);
  assert.match(profilePhotos, /bg-white text-stone-900 shadow-sm/);
  assert.match(profilePhotos, /min-w-\[760px\]/);
  assert.doesNotMatch(profilePhotos, /bg-\[var\(--portal-base\)\] text-white shadow-sm/);
});

test('RO obligations use the active Admin theme, neutral segmented filters, and normal module typography', () => {
  assert.match(obligations, /brownMid: 'var\(--portal-base\)'/);
  assert.match(obligations, /rounded-xl bg-stone-100 p-1/);
  assert.match(obligations, /px-4 py-2 text-sm font-medium/);
  assert.match(obligations, /text-base font-semibold text-stone-900/);
  assert.match(obligations, /h-10 shrink-0 rounded-xl/);
  assert.doesNotMatch(obligations, /brownMid: '#7c4a2e'/);
});

test('global staff headers no longer show the redundant welcome subtitle', () => {
  assert.doesNotMatch(adminLayout, /Welcome to SMaRT-PDM\./);
  assert.doesNotMatch(departmentLayout, /Welcome to SMaRT-PDM\./);
});

test('Admin dashboard includes pending profile-photo review work from the dashboard service', () => {
  assert.match(dashboardService, /profile_photo_reviews/);
  assert.match(dashboardService, /label: 'Profile Photo Review'/);
  assert.match(dashboardService, /path: '\/admin\/profile-photos'/);
});
