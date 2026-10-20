const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..', '..');
const deployment = fs.readFileSync(
    path.join(root, 'scripts', 'Invoke-ApplicationSigningDevelopmentDeployment.ps1'),
    'utf8'
);
const synthetic = fs.readFileSync(
    path.join(root, 'scripts', 'Test-ApplicationSigningSynthetic.ps1'),
    'utf8'
);

test('development deployment is fail-closed and never uses the Supabase CLI link', () => {
    assert.match(deployment, /\[switch\]\$Apply/);
    assert.match(deployment, /\[switch\]\$NoRemote/);
    assert.match(deployment, /SMART_PDM_SIGNING_DEV_DATABASE_URL/);
    assert.match(deployment, /db\.\$ExpectedProjectRef\.supabase\.co/);
    assert.match(deployment, /APPLY-DEVELOPMENT-SIGNING-MIGRATIONS/);
    assert.doesNotMatch(deployment, /supabase\s+db\s+(push|reset|repair)/i);
    assert.match(deployment, /config -match 'ngqwdetlpsqetbahjvto'/);
});

test('development deployment keeps migration order, reports, and ACL checks deterministic', () => {
    const first = deployment.indexOf('20261020000000_add_application_signing_sessions.sql');
    const second = deployment.indexOf('20261020000100_add_application_signing_document_corrections.sql');
    const third = deployment.indexOf('20261020000200_add_atomic_application_signing_submission.sql');
    assert.ok(first >= 0 && first < second && second < third);
    assert.match(deployment, /ON_ERROR_STOP=1/);
    assert.match(deployment, /report\.json/);
    assert.match(deployment, /report\.md/);
    assert.match(deployment, /aclexplode/);
    assert.match(deployment, /relrowsecurity/);
    assert.match(deployment, /SMART_PDM_SIGNING_DEV_BACKUP_EVIDENCE/);
    assert.match(deployment, /Assert-SyntheticReadiness/);
    assert.match(deployment, /SupabaseWorkDirectory/);
    assert.match(deployment, /db push --dry-run/);
    assert.match(deployment, /db push --yes/);
    assert.match(deployment, /sslmode=verify-full/);
    assert.match(deployment, /SMART_PDM_SIGNING_SYNTHETIC_ADAPTER_SHA256/);
});

test('synthetic integration runner requires explicit fixture approval and all required cases', () => {
    for (const testCase of [
        'successful_submission', 'requested_correction', 'expired_session',
        'duplicate_submission', 'cross_account_authorization', 'atomic_rollback',
        'concurrent_submission',
    ]) {
        assert.match(synthetic, new RegExp(testCase));
    }
    assert.match(synthetic, /SMART_PDM_SIGNING_SYNTHETIC_APPROVED/);
    assert.match(synthetic, /SMART_PDM_SIGNING_SYNTHETIC_ADAPTER_PATH/);
    assert.match(synthetic, /SMART_PDM_SIGNING_SYNTHETIC_ADAPTER_SHA256/);
    assert.match(synthetic, /scripts[\\/]adapters/);
    assert.match(synthetic, /-Execute/);
});
