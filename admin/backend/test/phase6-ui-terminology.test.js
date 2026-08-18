'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('landing keeps the approved authorized-access terminology', () => {
  const source = read('frontend/src/pages/SmartPDMLanding.jsx');

  assert.match(source, /Authorized User Access/);
  assert.match(source, /Select your access/);
  assert.match(source, /Student Discipline Office/);
});

test('SDO current direct layout keeps For Endorsement and All Applicants', () => {
  const sdo = read('frontend/src/components/layout/SDOLayout.jsx');

  assert.match(sdo, /\/sdo\/queue/);
  assert.match(sdo, /For Endorsement/);
  assert.match(sdo, /\/sdo\/tracker/);
  assert.match(sdo, /All Applicants/);
});

test('endorsement review keeps its compact review surface and standing options', () => {
  const source = read('frontend/src/pages/EndorsementQueue.jsx');

  assert.match(source, /ReviewDrawer|SheetContent/);
  assert.match(source, /Good Scholastic Standing/);
  assert.match(source, /Average Scholastic Standing/);
});
