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

test('submitted form editability is driven by the persisted Application Form review', () => {
  assert.match(service, /\.from\('application_document_reviews'\)/);
  assert.match(service, /applicationFormCorrectionRequested/);
  assert.match(service, /correction_requested:/);
  assert.match(service, /correction_comment:/);
});

test('corrected form submission preserves the existing application and returns it to review', () => {
  assert.match(
    service,
    /editExistingApplication[\s\S]*existingEditSnapshot/
  );
  assert.match(service, /resetApplicationFormReviewError/);
  assert.match(service, /application_status:\s*hasRemainingCorrections/);
});
