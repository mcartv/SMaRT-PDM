'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const mockDb = {
    query: async () => ({ rows: [] }),
};

const originalLoad = Module._load;
Module._load = function mockedLoad(request, parent, isMain) {
    if (
        request === '../config/db' &&
        String(parent?.filename || '').replace(/\\/g, '/').endsWith('/services/staffSessionService.js')
    ) {
        return mockDb;
    }

    return originalLoad.call(this, request, parent, isMain);
};

const staffSessionService = require('../services/staffSessionService');
Module._load = originalLoad;

function row(overrides = {}) {
    return {
        user_id: '11111111-1111-4111-8111-111111111111',
        user_role: 'Admin',
        token_version: 1,
        admin_id: '22222222-2222-4222-8222-222222222222',
        first_name: 'Test',
        last_name: 'User',
        department: 'Office of the College of Computer Studies',
        position: 'Program Director',
        is_archived: false,
        ...overrides,
    };
}

function decoded(overrides = {}) {
    return {
        user_id: '11111111-1111-4111-8111-111111111111',
        role: 'pd',
        token_version: 1,
        ...overrides,
    };
}

test('active staff session accepts the current token version and role backing', async () => {
    mockDb.query = async () => ({ rows: [row()] });

    const account = await staffSessionService.assertCurrentStaffSession({
        decoded: decoded(),
    });

    assert.equal(account.user_id, row().user_id);
    assert.equal(account.role, 'pd');
    assert.equal(account.token_version, 1);
});

test('legacy staff token without token_version is treated as version 1', async () => {
    mockDb.query = async () => ({ rows: [row({ token_version: 1 })] });
    const legacy = decoded();
    delete legacy.token_version;

    const account = await staffSessionService.assertCurrentStaffSession({
        decoded: legacy,
    });

    assert.equal(account.token_version, 1);
});

test('archived staff account is rejected immediately', async () => {
    mockDb.query = async () => ({ rows: [row({ is_archived: true })] });

    await assert.rejects(
        staffSessionService.assertCurrentStaffSession({ decoded: decoded() }),
        (error) => {
            assert.equal(error.code, 'ACCOUNT_DEACTIVATED');
            assert.equal(error.statusCode, 401);
            return true;
        }
    );
});

test('stale token version is rejected after archive, restore, or role change', async () => {
    mockDb.query = async () => ({ rows: [row({ token_version: 3 })] });

    await assert.rejects(
        staffSessionService.assertCurrentStaffSession({ decoded: decoded({ token_version: 1 }) }),
        (error) => {
            assert.equal(error.code, 'SESSION_REVOKED');
            assert.equal(error.statusCode, 401);
            return true;
        }
    );
});

test('database role-family mismatch rejects the old portal session', async () => {
    mockDb.query = async () => ({ rows: [row({ user_role: 'Admin' })] });

    await assert.rejects(
        staffSessionService.assertCurrentStaffSession({
            decoded: decoded({ role: 'sdo' }),
        }),
        (error) => {
            assert.equal(error.code, 'SESSION_ROLE_CHANGED');
            assert.equal(error.statusCode, 401);
            return true;
        }
    );
});

test('missing staff account rejects the session', async () => {
    mockDb.query = async () => ({ rows: [] });

    await assert.rejects(
        staffSessionService.assertCurrentStaffSession({ decoded: decoded() }),
        (error) => {
            assert.equal(error.code, 'STAFF_ACCOUNT_NOT_FOUND');
            return true;
        }
    );
});
