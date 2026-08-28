'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(
  path.join(repositoryRoot, relativePath),
  'utf8'
);

test('multistep account recovery supports email delivery only', () => {
  const backendService = read('mobile/backend/src/services/accountRecoveryService.js');
  const legacyRoutes = read('mobile/backend/server.legacy.backend.js');
  const clientModels = read('mobile/frontend/lib/features/auth/data/models/recovery_models.dart');
  const clientService = read('mobile/frontend/lib/features/auth/data/services/recovery_service.dart');
  const backendPackage = JSON.parse(read('mobile/backend/package.json'));

  assert.equal(backendPackage.dependencies.twilio, undefined);
  assert.doesNotMatch(backendService, /twilio|sendRecoverySms|TWILIO_/i);
  assert.match(backendService, /channel: 'email'/);
  assert.match(backendService, /data\.channel !== 'email'/);
  assert.doesNotMatch(legacyRoutes, /channel: req\.body\?\.channel/);
  assert.doesNotMatch(clientModels, /RecoveryChannel|maskedPhone|hasPhone|SMS/);
  assert.doesNotMatch(clientService, /RecoveryChannel|wireValue|['"]channel['"]/);
});

test('database migration closes non-email recovery sessions and enforces email', () => {
  const migration = read(
    'supabase/migrations/20260828160000_email_only_account_recovery.sql'
  );

  assert.match(migration, /WHERE channel <> 'email'/);
  assert.match(migration, /CHECK \(channel = 'email'\)/);
});
