'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..', '..');
const migration = fs.readFileSync(
    path.join(repoRoot, 'supabase', 'migrations', '20261020000200_add_atomic_application_signing_submission.sql'),
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

test('atomic signing submission owns application, creates legacy slots, and finalizes in one RPC', () => {
    assert.match(migration, /create or replace function public\.submit_application_with_signing\(/);
    assert.match(migration, /s\.student_id = p_student_id[\s\S]*s\.user_id = p_user_id/);
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /insert into public\.applications/);
    assert.match(migration, /insert into public\.application_documents/);
    assert.match(migration, /Birth Certificate \/ PSA/);
    assert.match(migration, /Certificate of Registration/);
    assert.match(migration, /Grade Report/);
    assert.match(migration, /Certificate of Indigency/);
    assert.match(migration, /Letter of Request/);
    assert.match(migration, /public\.finalize_application_signing_session\(/);
    assert.match(migration, /insert into public\.endorsement_slips/);
    assert.match(migration, /update public\.students/);
});

test('atomic signing submission preserves rollback and service-role-only execution boundaries', () => {
    const slots = migration.indexOf('insert into public.application_documents');
    const finalize = migration.indexOf('public.finalize_application_signing_session(');
    assert.ok(slots >= 0 && finalize > slots);
    assert.match(migration, /on conflict \(application_id, document_type\) do nothing/);
    assert.match(migration, /revoke all on function public\.submit_application_with_signing[\s\S]*from public, anon, authenticated/);
    assert.match(migration, /grant execute on function public\.submit_application_with_signing[\s\S]*to service_role/);
    assert.doesNotMatch(migration, /commit\s*;/i);
    assert.doesNotMatch(migration, /rollback\s*;/i);
});

test('expired, duplicate, and concurrent submissions remain guarded by the transaction and signing finalizer', () => {
    assert.match(migration, /v_finalization := public\.finalize_application_signing_session/);
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /already_finalized/);
    assert.match(migration, /for update/);
    assert.match(migration, /finalize_application_signing_session/);
});

test('mobile backend invokes the atomic RPC before legacy application writes can execute', () => {
    assert.match(signingService, /async function submitApplicationWithSigning/);
    assert.match(signingService, /supabase\.rpc\('submit_application_with_signing'/);
    const atomicCall = applicationService.indexOf('const atomicSubmission = await submitApplicationWithSigning({');
    const atomicReturn = applicationService.indexOf("next: 'documents',", atomicCall);
    const legacyApplicationWrite = applicationService.indexOf(".from('applications')", atomicCall);
    assert.ok(atomicCall >= 0);
    assert.ok(atomicReturn > atomicCall);
    assert.ok(legacyApplicationWrite > atomicReturn);
});
