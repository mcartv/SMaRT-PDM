'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const backendRoot = path.resolve(__dirname, '..');
const read = (relativePath) =>
    fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');

test('authenticated mutations receive fallback System Log coverage', () => {
    const auth = read('middleware/authMiddleware.js');
    const coverage = read('middleware/systemAuditCoverageMiddleware.js');

    assert.match(auth, /attachSystemAuditCoverage\(req, res\)/);
    assert.match(coverage, /POST/);
    assert.match(coverage, /PUT/);
    assert.match(coverage, /PATCH/);
    assert.match(coverage, /DELETE/);
    assert.match(coverage, /res\.statusCode < 200 \|\| res\.statusCode >= 400/);
});

test('fallback covers major SMaRT-PDM mutation modules', () => {
    const coverage = read('middleware/systemAuditCoverageMiddleware.js');
    for (const moduleName of [
        'Application Selection',
        'Application Review',
        'Endorsement Slips',
        'Scholars',
        'Renewals',
        'Payout Management',
        'RO Coordinator',
        'Return of Obligation',
        'Scholarship Openings',
        'Announcements',
        'Profile Photos',
        'Student Registry',
        'Accounts',
        'Scholarship Programs',
        'Academic Years',
        'Courses',
        'OCR / Document Verification',
        'Authentication',
    ]) {
        assert.ok(coverage.includes(moduleName), `missing module ${moduleName}`);
    }
});

test('routine UI bookkeeping is not turned into System Logs', () => {
    const coverage = read('middleware/systemAuditCoverageMiddleware.js');
    const service = read('services/auditLogService.js');

    assert.match(coverage, /notifications/);
    assert.match(coverage, /session/);
    assert.match(service, /VIEW_/);
    assert.match(service, /PREVIEW_/);
    assert.match(service, /MARK_NOTIFICATION_READ/);
    assert.match(service, /MARK_ALL_NOTIFICATIONS_READ/);
});

test('Pi worker machine lifecycle spam is hidden and suppressed', () => {
    const service = read('services/auditLogService.js');
    assert.match(service, /Pi IoT OCR Worker/);
    assert.match(service, /HIDDEN_SYSTEM_LOG_MODULES/);
    assert.match(service, /VISIBLE_SYSTEM_LOG_SQL/);
});

test('explicit controller logs suppress duplicate fallback logs', () => {
    const service = read('services/auditLogService.js');
    const coverage = read('middleware/systemAuditCoverageMiddleware.js');

    assert.match(service, /__systemAuditPending/);
    assert.match(service, /__systemAuditLogged/);
    assert.match(coverage, /__systemAuditPending/);
    assert.match(coverage, /__systemAuditLogged/);
});

test('fallback never copies request bodies or uploaded files into metadata', () => {
    const coverage = read('middleware/systemAuditCoverageMiddleware.js');
    assert.doesNotMatch(coverage, /req\.body/);
    assert.doesNotMatch(coverage, /req\.file/);
    assert.match(coverage, /protected_mutation_fallback/);
});
