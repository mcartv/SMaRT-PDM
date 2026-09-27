const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const migrationPath = require.resolve('../../../supabase/migrations/20260927000300_add_iot_ocr_request_processing_metadata.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');
const liveMigration = require('../services/liveMigrationService');
const schemaService = fs.readFileSync(require.resolve('../services/iotOcrSchemaService'), 'utf8');
const birthService = fs.readFileSync(require.resolve('../services/birthOcrV2Service'), 'utf8');

test('Phase 4.6 adds request-level Birth processing metadata without altering document metadata', () => {
  assert.match(migration, /alter table public\.iot_ocr_requests/);
  assert.match(migration, /add column if not exists ocr_processing_metadata jsonb/);
  assert.match(migration, /not null default '\{\}'::jsonb/);
  assert.ok(!migration.includes('ocr_extracted_documents'));
  assert.match(birthService, /setProcessingMetadata/);
});

test('Phase 4.6 migration is registered after Phase 3', () => {
  const keys = liveMigration.MIGRATIONS.map(({ key }) => key);
  assert.deepEqual(keys.slice(-3), [
    '20260927000100_iot_ocr_async_processing_owner',
    '20260927000200_iot_ocr_retry_recovery',
    '20260927000300_add_iot_ocr_request_processing_metadata',
  ]);
});

test('Phase 4.6 schema verification requires JSONB request metadata', () => {
  assert.match(schemaService, /has_request_processing_metadata/);
  assert.match(schemaService, /column_name = 'ocr_processing_metadata'/);
  assert.match(schemaService, /data_type = 'jsonb'/);
});
