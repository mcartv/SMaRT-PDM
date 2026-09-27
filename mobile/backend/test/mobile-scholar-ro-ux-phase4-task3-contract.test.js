const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const roPath = path.join(
  mobileRoot,
  'frontend',
  'lib',
  'features',
  'scholar',
  'presentation',
  'screens',
  'ro_assignment_screen.dart'
);
const ro = fs.readFileSync(roPath, 'utf8');

test('RO student workflows remain available', () => {
  assert.match(ro, /Future<void> _acknowledge/);
  assert.match(ro, /Future<void> _reportConcern/);
  assert.match(ro, /Future<void> _timeIn/);
  assert.match(ro, /Future<void> _timeOut/);
  assert.match(ro, /_pickRoProofPhoto/);
  assert.match(ro, /Geolocator\.getCurrentPosition/);
  assert.match(ro, /img\.drawString/);
  assert.match(ro, /\/time-in/);
  assert.match(ro, /\/time-out/);
});

test('RO attendance photo instructions are student-facing', () => {
  assert.match(ro, /Take an attendance photo/);
  assert.match(
    ro,
    /The photo will include the date, time, assigned RO area, and location for verification/
  );
  assert.match(ro, /Attendance photo ready/);
  assert.match(ro, /Location recorded/);
  assert.doesNotMatch(ro, /GPS coordinates will be burned into the image/);
  assert.doesNotMatch(ro, /Live camera proof is required/);
});

test('RO progress and review terms are easier for students to understand', () => {
  assert.match(ro, /Hours Submitted/);
  assert.match(ro, /Hours Verified/);
  assert.match(ro, /RO Coordinator Feedback/);
  assert.match(ro, /Recent Attendance/);
  assert.match(ro, /Waiting for Review/);
  assert.match(ro, /Verified: \$progress%/);
  assert.doesNotMatch(ro, /Validation Feedback/);
  assert.doesNotMatch(ro, / validated of /);
});

test('RO concern UI does not expose endpoint implementation details', () => {
  assert.match(
    ro,
    /If OSFA needs supporting documents, they can request them separately/
  );
  assert.doesNotMatch(ro, /current RO concern endpoint/);
  assert.doesNotMatch(ro, /stores text concerns only/);
});

test('RO action errors keep technical details out of student messages', () => {
  assert.match(ro, /String _studentSafeError/);
  assert.match(ro, /RO LOAD ERROR/);
  assert.match(ro, /RO PHOTO CAPTURE ERROR/);
  assert.match(ro, /RO ACKNOWLEDGMENT ERROR/);
  assert.match(ro, /RO CONCERN SUBMIT ERROR/);
  assert.match(ro, /RO TIME IN ERROR/);
  assert.match(ro, /RO TIME OUT ERROR/);
  assert.match(ro, /We could not connect right now/);
  assert.doesNotMatch(ro, /ensure your backend is running and accessible/);
  assert.doesNotMatch(ro, /Unexpected response from server/);
});

test('RO completed-time guidance does not mention backend behavior', () => {
  assert.match(ro, /allowed Time Out period/);
  assert.match(ro, /This attendance session will close automatically/);
  assert.doesNotMatch(ro, /backend will automatically close this session/);
});
