'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('Phase 5 report filters use canonical endorsement results', () => {
  const ui = read('admin/frontend/src/pages/ReportGeneration.jsx');
  assert.match(ui, /value: 'no_offense'/);
  assert.match(ui, /value: 'minor_offense'/);
  assert.match(ui, /value: 'major_offense'/);
  assert.match(ui, /value: 'good_moral_standing'/);
  assert.match(ui, /value: 'good_scholastic_standing'/);
  assert.match(ui, /value: 'average_scholastic_standing'/);
  assert.doesNotMatch(ui, /value: 'disqualified_minor'/);
  assert.doesNotMatch(ui, /value: 'disqualified_major'/);
  assert.doesNotMatch(ui, /value: 'held', label: 'For Counseling \/ Hold'/);
});

test('Phase 5 reports do not expose deprecated SDO endorsement detail fields', () => {
  const service = read('admin/backend/services/reportService.js');
  assert.doesNotMatch(service, /header: 'Offense Type'/);
  assert.doesNotMatch(service, /header: 'Incident Date'/);
  assert.doesNotMatch(service, /header: 'Case Ref No\.'/);
  assert.match(service, /es\.sdo_status IN \('minor_offense', 'disqualified_minor'\)/);
  assert.match(service, /es\.sdo_status IN \('major_offense', 'disqualified_major'\)/);
});

test('student endorsement status API no longer exposes obsolete offense detail payload', () => {
  const service = read('backend/src/services/applicationService.js');
  assert.doesNotMatch(service, /offense_detail:/);
  assert.doesNotMatch(service, /sdo_offense_type,/);
  assert.doesNotMatch(service, /sdo_incident_date,/);
  assert.doesNotMatch(service, /sdo_case_reference_number,/);
});

test('mobile endorsement views use canonical standing labels and no offense detail model', () => {
  const endorsement = read('mobile/smartpdm_mobileapp/lib/features/forms/presentation/screens/endorsement_screen.dart');
  const status = read('mobile/smartpdm_mobileapp/lib/features/forms/presentation/screens/status_tracking_screen.dart');
  const model = read('mobile/smartpdm_mobileapp/lib/shared/models/application_status_summary.dart');

  for (const source of [endorsement, status]) {
    assert.match(source, /No Disciplinary Offense/);
    assert.match(source, /Good Moral Standing/);
    assert.match(source, /Good Scholastic Standing/);
    assert.match(source, /Average Scholastic Standing/);
    assert.doesNotMatch(source, /offenseDetail/);
  }
  assert.doesNotMatch(model, /offenseDetail/);
});

test('PD, SDO, and Guidance retain their primary roles and gain RO Coordinator capability only through active assignment', () => {
  const routes = read('admin/backend/routes/roCoordinatorRoutes.js');
  const controller = read('admin/backend/controllers/roCoordinatorController.js');
  const accountService = read('admin/backend/services/accountService.js');

  assert.match(routes, /PD, SDO, and Guidance/);
  assert.match(routes, /authorizeRoleGroup\('RO_COORDINATOR_CAPABLE'\)/);
  assert.doesNotMatch(routes, /authorizeRoles\('ro_coordinator'\)/);
  assert.match(accountService, /\['pd', 'sdo', 'guidance', 'ro_coordinator'\]\.includes\(account\.role\)/);
  assert.match(controller, /JOIN ro_area_coordinators rac/);
  assert.match(controller, /rac\.is_active = true/);
  assert.match(controller, /You do not have an active RO Area coordinator assignment\./);
});
