'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const service = fs.readFileSync(
  path.join(root, 'src', 'services', 'applicationService.js'),
  'utf8'
);
const routes = fs.readFileSync(
  path.join(root, 'src', 'routes', 'applicationRoutes.js'),
  'utf8'
);
const controller = fs.readFileSync(
  path.join(root, 'src', 'controllers', 'applicationController.js'),
  'utf8'
);

test('submitted application form preview endpoint is wired', () => {
  assert.match(
    routes,
    /router\.get\(\s*['"]\/me\/submitted-form['"][\s\S]*getMySubmittedFormData/
  );
  assert.match(controller, /async function getMySubmittedFormData/);
  assert.match(service, /async function getMySubmittedFormData/);
});

test('submitted application editing is explicitly requested and server guarded', () => {
  assert.match(service, /edit_existing_application/);
  assert.match(service, /can_edit/);
  assert.match(
    service,
    /OSFA has already started reviewing this application/
  );
  assert.match(service, /iot_ocr_requests/);
});

test('editing an existing application preserves workflow document state', () => {
  assert.match(
    service,
    /editExistingApplication[\s\S]*existingEditSnapshot/
  );
  assert.match(
    service,
    /document_status:[\s\S]*editExistingApplication/
  );
  assert.match(
    service,
    /verification_status:[\s\S]*editExistingApplication/
  );
});
