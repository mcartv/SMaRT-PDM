'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const service = fs.readFileSync(
    path.join(backendRoot, 'src', 'services', 'applicationService.js'),
    'utf8'
);
const controller = fs.readFileSync(
    path.join(backendRoot, 'src', 'controllers', 'applicationController.js'),
    'utf8'
);
const routes = fs.readFileSync(
    path.join(backendRoot, 'src', 'routes', 'applicationRoutes.js'),
    'utf8'
);

test('submitted Form-02 evidence is authenticated and bound to final immutable versions', () => {
    assert.match(service, /async function getMySubmittedFormSignatureEvidence\(userId\)/);
    assert.match(service, /getMySubmittedFormData\(userId\)/);
    assert.match(service, /\.eq\('user_id', userId\)/);
    assert.match(service, /\.eq\('application_id', applicationId\)/);
    assert.match(service, /\.eq\('status', 'finalized'\)/);
    assert.match(service, /\.not\('finalized_at', 'is', null\)/);
    assert.match(service, /\.from\('application_document_versions'\)/);
    assert.match(service, /candidate\.document_type === documentType/);
    assert.match(service, /candidate\.file_path\) === expectedPath/);
    assert.match(service, /candidate\.content_sha256\).*=== expectedHash/);
});

test('evidence download verifies private PNG bytes and hashes before response', () => {
    assert.match(service, /\.storage\s*\.from\(APPLICATION_DOCUMENT_BUCKET\)\s*\.download\(item\.path\)/);
    assert.match(service, /MAX_FORM_SIGNATURE_BYTES/);
    assert.match(service, /crypto\.createHash\('sha256'\)\.update\(bytes\)\.digest\('hex'\)/);
    assert.match(service, /Finalized signature evidence failed integrity verification/);
    assert.match(controller, /Cache-Control', 'no-store, private/);
});

test('evidence route remains protected and precedes the generic application id route', () => {
    const evidenceRoute = routes.indexOf("'/me/submitted-form/signatures'");
    const applicationIdRoute = routes.indexOf("'/:applicationId'");
    assert.ok(evidenceRoute >= 0);
    assert.ok(evidenceRoute < applicationIdRoute);
    assert.match(routes, /'\/me\/submitted-form\/signatures',\s*protect,\s*applicationController\.getMySubmittedFormSignatureEvidence/);
});
