'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const backendRoot = join(__dirname, '..');
const migration = readFileSync(
    join(
        backendRoot,
        'sql',
        '20260804_fix_iot_ocr_request_and_snapshot_provenance.sql'
    ),
    'utf8'
);
const schemaService = readFileSync(
    join(backendRoot, 'services', 'iotOcrSchemaService.js'),
    'utf8'
);
const server = readFileSync(
    join(backendRoot, 'server', 'server.js'),
    'utf8'
);

test('catalog constraint columns are text[] before containment', () => {
    assert.match(
        migration,
        /SELECT\s+a\.attname::text\s+FROM\s+unnest\(c\.conkey\)/
    );
    assert.doesNotMatch(
        migration,
        /SELECT\s+a\.attname\s+FROM\s+unnest\(c\.conkey\)/
    );
    assert.match(
        migration,
        /constraint_info\.columns\s+@>\s+ARRAY\[[\s\S]*?\]::text\[\]/
    );
});

test('failed schema migration rolls back before client release', () => {
    const catchIndex = schemaService.indexOf('catch (error)');
    const rollbackIndex = schemaService.indexOf(
        "await client.query('ROLLBACK')",
        catchIndex
    );
    const releaseIndex = schemaService.indexOf(
        'client.release()',
        rollbackIndex
    );

    assert.ok(catchIndex >= 0);
    assert.ok(rollbackIndex > catchIndex);
    assert.ok(releaseIndex > rollbackIndex);
    assert.match(
        schemaService,
        /IOT_OCR_SCHEMA_ROLLBACK=PASSED/
    );
});

test('health endpoint exposes the deployed schema hotfix marker', () => {
    assert.match(
        server,
        /iot_ocr_schema_fix:\s*'name-array-cast-rollback-v1'/
    );
});
