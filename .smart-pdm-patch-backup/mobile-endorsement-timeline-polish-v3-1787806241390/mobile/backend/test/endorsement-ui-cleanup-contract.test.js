const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const screen = fs.readFileSync(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'forms',
    'presentation',
    'screens',
    'endorsement_screen.dart'
  ),
  'utf8'
);

test('Uses the shared mobile light and dark color scheme', () => {
  assert.match(screen, /app\/theme\/app_colors\.dart/);
  assert.match(screen, /AppColors\.applicantLightSurface/);
  assert.match(screen, /AppColors\.applicantDarkSurface/);
  assert.match(screen, /AppColors\.applicantLightOutline/);
  assert.match(screen, /AppColors\.applicantDarkOutline/);
});

test('Removes noisy metadata from the Endorsement header', () => {
  assert.doesNotMatch(screen, /Realtime tracking on/);
  assert.doesNotMatch(screen, /Code:/);
  assert.doesNotMatch(screen, /Now in:/);
  assert.doesNotMatch(screen, /_EndorsementTag/);
});

test('Current Step becomes Done after all endorsement reviews complete', () => {
  assert.match(screen, /String _currentStepLabel/);
  assert.match(screen, /if \(_isCompleted\(endorsement\)\) return 'Done'/);
  assert.match(screen, /'Current Step'/);
});

test('Removes the redundant Slip Status summary', () => {
  assert.doesNotMatch(screen, /'Slip Status'/);
  assert.doesNotMatch(screen, /_OverviewMiniItem/);
});

test('Renders a clean five-node connected Endorsement timeline', () => {
  assert.match(screen, /SMART_PDM_ENDORSEMENT_TIMELINE_POLISH_V1/);
  assert.match(screen, /'Submitted'/);
  assert.match(screen, /'SDO'/);
  assert.match(screen, /'Guidance'/);
  assert.match(screen, /shortLabel: 'PD'/);
  assert.match(screen, /semanticLabel: 'Program Director review'/);
  assert.match(screen, /'Done'/);
  assert.match(screen, /Stack\(/);
  assert.match(screen, /mainAxisAlignment: MainAxisAlignment\.spaceBetween/);
  assert.match(screen, /safeTrackWidth \* progressFraction/);
});

test('Keeps Office Results', () => {
  assert.match(screen, /title: 'Office Results'/);
  assert.match(screen, /_ReviewTile\(label: 'SDO'/);
  assert.match(screen, /label: 'Guidance'/);
  assert.match(screen, /label: 'Program Director'/);
});

test('Office Results support dark mode', () => {
  assert.match(screen, /class _ReviewTile/);
  assert.match(screen, /AppColors\.applicantDarkSurface/);
  assert.doesNotMatch(screen, /color: Colors\.white,[\s\S]*class _ReviewTile/);
});

test('Redesigns official slip information without exposing internal slip code', () => {
  assert.match(screen, /title: 'Official Endorsement Slip'/);
  assert.match(screen, /'PDF ready'/);
  assert.match(screen, /'PDF not ready yet'/);
  assert.doesNotMatch(screen, /'Slip Code'/);
  assert.doesNotMatch(screen, /'Now in Office'/);
});

test('Keeps separate View and Download PDF actions', () => {
  assert.match(screen, /'View Slip'/);
  assert.match(screen, /'Download PDF'/);
  assert.match(screen, /onViewSlip/);
  assert.match(screen, /onDownloadSlip/);
  assert.match(screen, /constraints\.maxWidth < 390/);
});

test('Status refresh no longer blocks the page every few seconds', () => {
  assert.match(screen, /bool _isRefreshingStatus = false/);
  assert.match(screen, /Duration\(seconds: 60\)/);
  assert.match(screen, /_loadStatus\(silent: true\)/);
  assert.match(screen, /if \(_isRefreshingStatus\) return/);
  assert.doesNotMatch(screen, /Duration\(seconds: 8\)/);
});

test('Background refresh preserves the currently visible status', () => {
  assert.match(
    screen,
    /A background refresh must not erase a valid page that is already on/
  );
  assert.doesNotMatch(
    screen,
    /catch \(error\)[\s\S]{0,300}_summary = null/
  );
});

test('Realtime updates remain enabled', () => {
  assert.match(screen, /provider\.scholarAccessRevision/);
  assert.match(screen, /provider\.applicationRevision/);
  assert.match(screen, /_handleNotificationProviderChange/);
});

test('Uses responsive controls and compact status components', () => {
  assert.match(screen, /LayoutBuilder\(/);
  assert.match(screen, /constraints\.maxWidth < 390/);
  assert.match(screen, /BoxConstraints\(maxWidth: 180\)/);
});

test('Removes the old vertical stage list and extra clutter sections', () => {
  assert.doesNotMatch(screen, /class _EndorsementStageList/);
  assert.doesNotMatch(screen, /'Where Your Slip Is Now'/);
  assert.doesNotMatch(screen, /'What Still Needs To Happen'/);
  assert.doesNotMatch(screen, /'Quick Actions'/);
});
