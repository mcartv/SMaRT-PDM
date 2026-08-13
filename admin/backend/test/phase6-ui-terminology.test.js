const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, '../../frontend/src');
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), 'utf8');

test('landing uses Authorized Access without role Portal labels', () => {
  const source = read('pages/SmartPDMLanding.jsx');
  assert.match(source, /Authorized User Access/);
  assert.match(source, /Select your access/);
  assert.match(source, /Student Discipline Office/);
  assert.doesNotMatch(source, /Staff Access/);
  assert.doesNotMatch(source, /Office Portal Directory/);
  assert.doesNotMatch(source, /\{item\.label\} Portal/);
});

test('official landing requirements remain unchanged', () => {
  const source = read('constants/landingContent.js');
  assert.match(source, /The applicant must have no derogatory or disciplinary record from SDO\./);
  assert.match(source, /Applications are processed on a first-come, first-served basis\./);
});

test('department navigation uses For Endorsement and preserves RO Requests', () => {
  const sdoLayout = read('components/layout/SDOLayout.jsx');
  const departmentLayout = read('components/layout/DepartmentPortalLayout.jsx');
  assert.match(sdoLayout, /queuePath="\/sdo\/queue"/);
  assert.match(departmentLayout, /queueLabel = 'For Endorsement'/);
  assert.match(departmentLayout, /roQueueLabel = 'RO Requests'/);
});

test('endorsement queue uses compact review drawer', () => {
  const source = read('pages/EndorsementQueue.jsx');
  assert.match(source, /ReviewDrawer/);
  assert.match(source, /SheetContent/);
  assert.match(source, /Awaiting Review/);
  assert.match(source, /Review Endorsement/);
  assert.match(source, /Good Scholastic Standing/);
  assert.match(source, /Average Scholastic Standing/);
});
