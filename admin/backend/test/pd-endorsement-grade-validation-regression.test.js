const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const queueSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/EndorsementQueue.jsx'),
  'utf8'
);

const detailSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/EndorsementSlipDetail.jsx'),
  'utf8'
);

const controllerSource = fs.readFileSync(
  path.resolve(__dirname, '../controllers/endorsementSlipController.js'),
  'utf8'
);

test('PD endorsement workflow has its own scholastic-standing queue', () => {
  assert.match(queueSource, /pd:\s*\{/);

  assert.match(
    queueSource,
    /endpoint:\s*['"]\/api\/endorsement-slips\/pd['"]/
  );

  assert.match(
    queueSource,
    /actionEndpoint:\s*\(slipId\)\s*=>\s*`\/api\/endorsement-slips\/\$\{slipId\}\/pd-action`/
  );

  assert.match(
    queueSource,
    /allowedRoles:\s*\[['"]pd['"]\]/
  );

  assert.match(queueSource, /good_scholastic_standing/);
  assert.match(queueSource, /average_scholastic_standing/);
});

test('PD can preview the uploaded Grade Report', () => {
  assert.match(queueSource, /Grade Report Preview/);
  assert.match(queueSource, /row\.grade_document\?\.url/);
  assert.match(queueSource, /Preview Grade Report/);
  assert.match(detailSource, /No Grade Report uploaded/);
});

test('PD sees extracted GWA where available', () => {
  assert.match(queueSource, /row\.grade_summary\?\.gwa/);
  assert.match(detailSource, /slip\.grade_summary\?\.gwa/);
});

test('PD validation requires an uploaded grade document', () => {
  assert.match(queueSource, /function hasUploadedGrade/);

  assert.match(
    queueSource,
    /A Grade Report must be uploaded before PD endorsement\./
  );

  assert.match(
    queueSource,
    /disabled=\{saving \|\| !gradeReady \|\| !standing\}/
  );
});

test('PD can select scholastic validation and add remarks', () => {
  assert.match(queueSource, /Select scholastic standing/);
  assert.match(queueSource, /Good Scholastic Standing/);
  assert.match(queueSource, /Average Scholastic Standing/);
  assert.match(queueSource, /placeholder="Optional remarks"/);
});

test('PD decision goes through confirmation and backend action endpoint', () => {
  assert.match(queueSource, /Confirm Scholastic Standing/);
  assert.match(queueSource, /\/pd-action/);
  assert.match(controllerSource, /pd/i);
});

test('PD queue refreshes from realtime endorsement updates', () => {
  assert.match(queueSource, /useSocketEvent/);
  assert.match(queueSource, /endorsement:updated/);
});

test('PD detail displays the saved decision timestamp/remarks through endorsement stages', () => {
  assert.match(detailSource, /acted_at/);
  assert.match(detailSource, /remarks/);
});