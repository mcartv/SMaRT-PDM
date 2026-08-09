'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const backendRoot = join(__dirname, '..');
const liveMigration = readFileSync(join(backendRoot, 'services', 'liveMigrationService.js'), 'utf8');
const schemaService = readFileSync(join(backendRoot, 'services', 'iotOcrSchemaService.js'), 'utf8');

test('live migration rollback precedes advisory unlock and release', () => {
    const rollback = liveMigration.indexOf("await client.query('ROLLBACK')");
    const unlock = liveMigration.indexOf('pg_advisory_unlock');
    const release = liveMigration.indexOf('client.release()');
    assert.ok(rollback >= 0 && unlock > rollback && release > unlock);
});

test('request-time schema guard verifies only and never performs DDL', () => {
    assert.match(schemaService, /verifyRuntimeSchema/);
    assert.match(schemaService, /to_regclass\('public\.iot_ocr_candidates'\)/);
    assert.doesNotMatch(schemaService, /CREATE TABLE|ALTER TABLE|readFileSync/);
});
