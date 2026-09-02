'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

const service = read('admin/backend/services/applicationService.js');
const controller = read('admin/backend/controllers/applicationController.js');
const selection = read('admin/backend/services/selectionService.js');
const migration = read(
    'supabase/migrations/20260902121700_fix_scholar_conversion_process_flow.sql'
);

test('final selection reserves a slot but does not activate a scholar', () => {
    assert.match(
        selection,
        /Final selection reserves a slot only[\s\S]*explicit action in the Readiness workflow/
    );
    assert.match(selection, /activation_status = 'Not Activated'/);
});

test('explicit activation is transactional and suppresses generic duplicate notices', () => {
    assert.match(service, /await client\.query\('BEGIN'\)/);
    assert.match(
        service,
        /set_config\('smart_pdm\.scholar_activation', '1', true\)/
    );
    assert.match(service, /await client\.query\('COMMIT'\)/);
    assert.match(service, /await client\.query\('ROLLBACK'\)/);
});

test('fresh activation rechecks verification, endorsement, FCFS and reserved slot under lock', () => {
    assert.match(service, /verificationComplete/);
    assert.match(service, /endorsementComplete/);
    assert.match(service, /fcfs_completed_at/);
    assert.match(service, /queuePosition > 0/);
    assert.match(
        service,
        /\['reserved', 'selected', 'promoted'\]\.includes\(selectionStatus\)/
    );
    assert.match(service, /FOR UPDATE OF a, st, po/);
});

test('partial conversion state is reconciled instead of treated as already complete', () => {
    assert.match(service, /const partialConversion =/);
    assert.match(service, /reconciled: partialConversion/);
    assert.match(
        service,
        /outcome: partialConversion \? 'reconciled' : 'activated'/
    );
    assert.match(controller, /updated\.reconciled/);
});

test('application and student scholar states are written as one conversion transaction', () => {
    assert.match(
        service,
        /application_status = 'Approved'[\s\S]*selection_status = 'Selected'[\s\S]*activation_status = 'Activated'/
    );
    assert.match(
        service,
        /UPDATE students[\s\S]*is_active_scholar = true[\s\S]*scholarship_status = 'Active'[\s\S]*current_program_id = \$2[\s\S]*current_application_id = \$3/
    );
});

test('occupied slots use canonical active students linked to their current application', () => {
    assert.match(
        service,
        /INNER JOIN applications a2[\s\S]*a2\.application_id = st2\.current_application_id[\s\S]*is_active_scholar[\s\S]*scholarship_status/
    );
    assert.doesNotMatch(
        service.slice(
            service.indexOf('exports.approveApplicationWithSlotCheck'),
            service.indexOf('exports.fetchApplicationRealtimeTarget')
        ),
        /FROM applications\s+WHERE opening_id = \$1[\s\S]*activation_status/
    );
});

test('fresh conversion sends one canonical application notification', () => {
    assert.match(
        service,
        /!activationResult\.already_activated[\s\S]*!activationResult\.reconciled/
    );
    assert.match(
        service,
        /referenceId: applicationId/
    );
});

test('database migration suppresses generic notices and repairs historical partial states', () => {
    assert.match(
        migration,
        /current_setting\('smart_pdm\.scholar_activation', true\)/
    );
    assert.match(
        migration,
        /update public\.applications a[\s\S]*activation_status = 'Activated'/
    );
    assert.match(
        migration,
        /update public\.students st[\s\S]*is_active_scholar = true/
    );
    assert.match(
        migration,
        /filled_slots = least\(cc\.allocated_slots, cc\.occupied_slots\)/
    );
});
