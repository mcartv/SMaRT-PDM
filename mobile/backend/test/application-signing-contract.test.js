'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..', '..');
const migration = fs.readFileSync(
    path.join(repoRoot, 'supabase', 'migrations', '20261020_add_application_signing_sessions.sql'),
    'utf8'
);
const signingService = fs.readFileSync(
    path.join(backendRoot, 'src', 'services', 'applicationSigningService.js'),
    'utf8'
);
const applicationService = fs.readFileSync(
    path.join(backendRoot, 'src', 'services', 'applicationService.js'),
    'utf8'
);
const routes = fs.readFileSync(
    path.join(backendRoot, 'src', 'routes', 'applicationRoutes.js'),
    'utf8'
);

test('signing session schema has ownership, expiry, consent, hashes and finalization state', () => {
    assert.match(migration, /user_id uuid not null references public\.users/);
    assert.match(migration, /application_form_hash text not null/);
    assert.match(migration, /consent_acknowledged_at timestamptz/);
    assert.match(migration, /expires_at timestamptz not null/);
    assert.match(migration, /finalized_at timestamptz/);
    assert.match(migration, /status text not null default 'draft'/);
    assert.match(migration, /student_signature_path text/);
    assert.match(migration, /guardian_signature_path text/);
    assert.match(migration, /guardian_id_path text/);
    assert.match(migration, /enable row level security/);
});

test('finalization RPC rejects incomplete, expired, mismatched and reused sessions', () => {
    assert.match(migration, /v_session\.expires_at <= now\(\)/);
    assert.match(migration, /v_session\.application_form_hash <> p_application_form_hash/);
    assert.match(migration, /Signing session is incomplete/);
    assert.match(migration, /Signing session has already been finalized/);
    assert.match(migration, /for update/);
    assert.match(migration, /Application does not belong to this signing session owner/);
    assert.match(migration, /replacement is allowed only after a correction request/);
    assert.match(migration, /coalesce\(max\(version_number\), 0\) \+ 1/);
    assert.match(migration, /application_document_versions/);
});

test('upload service validates magic bytes, type-specific sizes, ownership and retry hashes', () => {
    assert.match(signingService, /fileType\(file\)/);
    assert.match(signingService, /maxBytes/);
    assert.match(signingService, /session\[\`\$\{config\.path\}_sha256\`\] === sha256/);
    assert.match(signingService, /application-signing\/\$\{userId\}\/\$\{sessionId\}/);
    assert.match(signingService, /\.eq\('user_id', userId\)/);
    assert.match(signingService, /createSignedUrl\(path, 60 \* 10\)/);
});

test('authenticated signing endpoints exist before the generic application id route', () => {
    const signingRoute = routes.indexOf("'/me/signing-sessions'");
    const applicationIdRoute = routes.indexOf("'/:applicationId'");
    assert.ok(signingRoute >= 0);
    assert.ok(applicationIdRoute >= 0);
    assert.ok(signingRoute < applicationIdRoute);
    assert.match(routes, /protect,\s*signingUpload\.single\('document'\)/);
});

test('application submission binds signing evidence before endorsements can be created', () => {
    const finalize = applicationService.indexOf('await finalizeSigningSession({');
    const endorsement = applicationService.indexOf('await ensureApplicationEndorsementSlip(');
    assert.ok(finalize >= 0);
    assert.ok(endorsement >= 0);
    assert.ok(finalize < endorsement);
    assert.match(applicationService, /signingSessionId/);
});
