'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const provider = fs.readFileSync(
  path.resolve(
    __dirname,
    '..',
    '..',
    'frontend',
    'lib',
    'features',
    'notifications',
    'presentation',
    'providers',
    'notification_provider.dart'
  ),
  'utf8'
);
const adminController = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'admin', 'backend', 'controllers', 'applicationController.js'),
  'utf8'
);
const internalRoutes = fs.readFileSync(
  path.resolve(__dirname, '..', 'src', 'routes', 'internalRealtimeRoutes.js'),
  'utf8'
);
const applicantGate = fs.readFileSync(
  path.resolve(
    __dirname,
    '..',
    '..',
    'frontend',
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'applicant_access_gate.dart'
  ),
  'utf8'
);

test('mobile recognizes the canonical admin activation notification', () => {
  assert.match(provider, /normalizedReference == 'application'/);
  assert.match(provider, /normalizedType == 'application'/);
  assert.match(provider, /normalizedTitle == 'scholarship application approved'/);
  assert.match(provider, /await _applyScholarAccess\(true\)/);
});

test('mobile preserves compatibility with the legacy scholar approval payload', () => {
  assert.match(provider, /normalizedReference == 'scholar'/);
  assert.match(provider, /normalizedType == 'scholar approved'/);
});

test('admin relays a targeted immediate scholar access grant to mobile', () => {
  assert.match(adminController, /event: 'application:approved'/);
  assert.match(adminController, /scholar_access_granted: true/);
  assert.match(adminController, /targetUserIds: \[activatedUserId\]/);
  assert.match(internalRoutes, /'application:approved'/);
});

test('mobile applies only the access grant targeted to the initialized user', () => {
  assert.match(provider, /_isTargetedScholarAccessGrant\(event\)/);
  assert.match(provider, /targetUserId == _initializedUserId/);
  assert.match(provider, /await _applyScholarAccess\(true\)/);
  assert.match(provider, /notifyListeners\(\);[\s\S]*?saveScholarAccess/);
});

test('mounted applicant-only routes react to scholar access changes', () => {
  assert.match(applicantGate, /context\.watch<NotificationProvider>\(\)/);
  assert.match(applicantGate, /provider\.scholarAccessRevision > 0/);
  assert.match(applicantGate, /_redirectScholar\(\)/);
});
