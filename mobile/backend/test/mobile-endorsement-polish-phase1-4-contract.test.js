const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const endorsement = read(
  'mobile/frontend/lib/features/forms/presentation/screens/endorsement_screen.dart'
);
const status = read(
  'mobile/frontend/lib/features/forms/presentation/screens/status_tracking_screen.dart'
);

test('endorsement progress uses full student-facing office names', () => {
  assert.match(endorsement, /Student Discipline Office/);
  assert.match(endorsement, /Guidance and Counseling Office/);
  assert.match(endorsement, /Program Director/);
});

test('endorsement progress combines office status and review details', () => {
  assert.match(endorsement, /_EndorsementProgressCard/);
  assert.match(endorsement, /OfficeReviewSummary/);
  assert.match(endorsement, /review\.actedAt/);
  assert.match(endorsement, /review\.actedByName/);
  assert.match(endorsement, /review\.remarks/);
  assert.match(endorsement, /View details/);
  assert.match(endorsement, /Hide details/);
});

test('redundant office review and readiness-style sections are removed', () => {
  assert.doesNotMatch(endorsement, /title: 'Office Results'/);
  assert.doesNotMatch(endorsement, /title: 'What Still Needs To Happen'/);
  assert.doesNotMatch(endorsement, /'Quick Actions'/);
  assert.doesNotMatch(endorsement, /_OverviewMiniItem/);
  assert.doesNotMatch(endorsement, /_RelatedStatusRow/);
  assert.doesNotMatch(endorsement, /_ReviewTile/);
});

test('technical realtime and duplicate hero tags are not shown', () => {
  assert.doesNotMatch(endorsement, /Realtime tracking on/);
  assert.doesNotMatch(endorsement, /Now in:/);
  assert.doesNotMatch(endorsement, /Code:/);
});

test('endorsement slip uses Reference No and hides disabled PDF action', () => {
  assert.match(endorsement, /'Reference No\.'/);
  assert.doesNotMatch(endorsement, /'Slip Code'/);
  assert.doesNotMatch(endorsement, /PDF Available After Completion/);
  assert.match(endorsement, /Not available yet/);
  assert.match(endorsement, /Download Endorsement Slip/);
});

test('legacy terminology is translated for students', () => {
  assert.match(endorsement, /Guidance Review on Hold/);
  assert.match(endorsement, /Endorsement Not Approved/);
  assert.doesNotMatch(endorsement, /Legacy Approved/);
  assert.doesNotMatch(endorsement, /Legacy Guidance Hold/);
  assert.doesNotMatch(endorsement, /Historical Rejected Endorsement/);
});

test('alert actions use context-appropriate icons', () => {
  assert.match(endorsement, /actionIcon: Icons\.upload_file_rounded/);
  assert.match(endorsement, /actionIcon: Icons\.fact_check_rounded/);
});

test('progress tracker has connected polished step states', () => {
  assert.match(endorsement, /_CompactStatusLabel/);
  assert.match(endorsement, /label: 'Current'/);
  assert.match(endorsement, /label: 'Done'/);
  assert.match(endorsement, /label: 'Waiting'/);
  assert.match(endorsement, /Positioned\(/);
  assert.match(endorsement, /Endorsement Complete/);
});

test('show more is styled as a secondary dropdown control', () => {
  const showMoreIndex = status.indexOf("_showMore ? 'Show less' : 'Show more'");
  assert.ok(showMoreIndex >= 0, 'Show more control must exist');
  const section = status.slice(showMoreIndex, showMoreIndex + 700);
  assert.match(section, /textTheme\.labelSmall/);
  assert.match(section, /AppSurfacePalette\.mutedText\(context\)/);
  assert.match(section, /size: 18/);
});

test('realtime refresh and endorsement slip download behavior remain intact', () => {
  assert.match(endorsement, /Timer\.periodic\(const Duration\(seconds: 12\)/);
  assert.match(endorsement, /MobileRealtimeService\.instance\.isRealtimeHealthy/);
  assert.match(endorsement, /fetchMyApplicationStatusSummary\(\)/);
  assert.match(endorsement, /downloadMyEndorsementSlip\(\)/);
  assert.match(endorsement, /saveAndOpenDownloadedFile\(/);
});
