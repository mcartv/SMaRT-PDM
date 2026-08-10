'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase-a-test-secret';

class MockStaffSessionError extends Error {
    constructor(message, { statusCode = 401, code = 'STAFF_SESSION_ERROR' } = {}) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

class MockAdminSessionError extends Error {
    constructor(message, { statusCode = 401, code = 'ADMIN_SESSION_ERROR' } = {}) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

const tokenPayloads = new Map();
const mockJwt = {
    verify(token) {
        if (!tokenPayloads.has(token)) throw new Error('invalid token');
        return tokenPayloads.get(token);
    },
};

const mockStaffSessionService = {
    StaffSessionError: MockStaffSessionError,
    normalizeRole: (value) => String(value || '').trim().toLowerCase(),
    assertCurrentStaffSession: async ({ decoded }) => ({
        user_id: decoded.user_id,
        role: decoded.role,
        token_version: decoded.token_version || 1,
    }),
};

const mockAdminSessionService = {
    AdminSessionError: MockAdminSessionError,
    assertActiveAdminSession: async () => ({ session_id: 'session-1' }),
};

const originalLoad = Module._load;
Module._load = function mockedLoad(request, parent, isMain) {
    const parentFile = String(parent?.filename || '').replace(/\\/g, '/');

    if (parentFile.endsWith('/utils/socketAuth.js')) {
        if (request === 'jsonwebtoken') return mockJwt;
        if (request === '../services/staffSessionService') return mockStaffSessionService;
        if (request === '../services/adminSessionService') return mockAdminSessionService;
    }

    return originalLoad.call(this, request, parent, isMain);
};

const {
    authenticateStaffSocket,
    createStaffSocketAuthMiddleware,
} = require('../utils/socketAuth');
Module._load = originalLoad;

function makeSocket(token = '') {
    return {
        handshake: {
            auth: token ? { token } : {},
            query: {},
            headers: {},
        },
        data: {},
    };
}

function registerToken(token, role = 'sdo', extras = {}) {
    tokenPayloads.set(token, {
        user_id: '11111111-1111-4111-8111-111111111111',
        role,
        token_version: 1,
        ...extras,
    });
    return token;
}

test.afterEach(() => {
    tokenPayloads.clear();
    mockStaffSessionService.assertCurrentStaffSession = async ({ decoded }) => ({
        user_id: decoded.user_id,
        role: decoded.role,
        token_version: decoded.token_version || 1,
    });
    mockAdminSessionService.assertActiveAdminSession = async () => ({ session_id: 'session-1' });
});

test('socket middleware rejects a connection without a JWT', async () => {
    const middleware = createStaffSocketAuthMiddleware();
    const error = await new Promise((resolve) => {
        middleware(makeSocket(), (nextError) => resolve(nextError));
    });

    assert.equal(error?.data?.code, 'SOCKET_AUTH_REQUIRED');
    assert.equal(error?.data?.status, 401);
});

test('socket middleware rejects an invalid JWT', async () => {
    const middleware = createStaffSocketAuthMiddleware();
    const error = await new Promise((resolve) => {
        middleware(makeSocket('not-a-valid-token'), (nextError) => resolve(nextError));
    });

    assert.equal(error?.data?.code, 'SOCKET_AUTH_INVALID');
});

test('valid current staff JWT authenticates identity from verified token, not client userId', async () => {
    const socket = makeSocket(registerToken('valid-sdo', 'sdo'));
    socket.handshake.auth.userId = 'attacker-controlled-id';

    await authenticateStaffSocket(socket);

    assert.equal(socket.data.authenticated, true);
    assert.equal(socket.data.userId, '11111111-1111-4111-8111-111111111111');
    assert.equal(socket.data.role, 'sdo');
});

test('admin socket also requires an active managed Admin session', async () => {
    let adminSessionChecked = false;

    mockAdminSessionService.assertActiveAdminSession = async () => {
        adminSessionChecked = true;
        return { session_id: 'session-1' };
    };

    const socket = makeSocket(
        registerToken('valid-admin', 'admin', {
            sid: '33333333-3333-4333-8333-333333333333',
        })
    );
    await authenticateStaffSocket(socket);

    assert.equal(adminSessionChecked, true);
    assert.equal(socket.data.role, 'admin');
});

test('archived/revoked session error is returned to Socket.IO client', async () => {
    mockStaffSessionService.assertCurrentStaffSession = async () => {
        throw new MockStaffSessionError(
            'This account has been deactivated. Contact an administrator.',
            { code: 'ACCOUNT_DEACTIVATED', statusCode: 401 }
        );
    };

    const middleware = createStaffSocketAuthMiddleware();
    const error = await new Promise((resolve) => {
        middleware(makeSocket(registerToken('archived-sdo', 'sdo')), (nextError) => resolve(nextError));
    });

    assert.equal(error?.data?.code, 'ACCOUNT_DEACTIVATED');
    assert.equal(error?.data?.status, 401);
});
