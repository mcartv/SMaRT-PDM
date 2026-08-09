const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const backendRoot = path.resolve(__dirname, '..');

test('canonical migration completes before HTTP listen', () => {
  const server = fs.readFileSync(path.join(backendRoot, 'server/server.js'), 'utf8');
  const migration = server.indexOf('await ensureCanonicalIotOcrMigration()');
  const listen = server.indexOf("server.listen(PORT, '0.0.0.0'");
  assert.ok(migration >= 0 && listen > migration);
  assert.match(server, /if \(!global\._applicationStartupReady\) return/);
  assert.match(server, /SERVER_START_BLOCKED_BY_MIGRATION[\s\S]*process\.exit\(1\)/);
});

test('live migration uses a session lock, runner-owned transaction, and verification', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'services/liveMigrationService.js'), 'utf8');
  assert.match(source, /pg_advisory_lock/);
  assert.match(source, /pg_advisory_unlock/);
  assert.match(source, /migrationBody/);
  assert.match(source, /smart_pdm_runtime_migrations/);
  assert.match(source, /trg_iot_ocr_candidates_immutable/);
  assert.match(source, /review_required/);
});

test('production prefers a separate DDL connection and safely falls back to DATABASE_URL', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'services/liveMigrationService.js'), 'utf8');
  assert.match(source, /MIGRATION_DATABASE_URL/);
  assert.match(source, /DATABASE_URL_FALLBACK/);
  assert.doesNotMatch(source, /MIGRATION_DATABASE_URL is required in production/);
});

test('migration body removes file-level transaction boundaries', () => {
  const { migrationBody } = require('../services/liveMigrationService');
  assert.equal(migrationBody('BEGIN;\nSELECT 1;\nCOMMIT;'), 'SELECT 1;');
});

test('production startup can migrate through DATABASE_URL when the dedicated URL is absent', () => {
  const { migrationConnectionString } = require('../services/liveMigrationService');
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    migrationUrl: process.env.MIGRATION_DATABASE_URL,
    databaseUrl: process.env.DATABASE_URL,
  };
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.MIGRATION_DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://runtime.example/test';
    assert.equal(migrationConnectionString(), process.env.DATABASE_URL);
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.migrationUrl === undefined) delete process.env.MIGRATION_DATABASE_URL;
    else process.env.MIGRATION_DATABASE_URL = previous.migrationUrl;
    if (previous.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.databaseUrl;
  }
});
