'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPool(relativePath, overrides = {}) {
    let options;
    const events = new Map();
    class Pool {
        constructor(config) { options = config; }
        on(event, callback) { events.set(event, callback); }
        query() { }
        connect() { }
    }
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8'), {
        require: name => name === 'pg' ? { Pool } : { config() { } },
        process: { env: { DATABASE_URL: 'postgresql://test.invalid/database', ...overrides } },
        console: { log() { }, error() { } }, module: { exports: {} },
    });
    return { options, events };
}

const admin = '../config/db.js';
const mobile = '../../../mobile/backend/src/config/db.js';

test('admin and mobile session pools leave room within a shared 15-client budget', () => {
    const a = loadPool(admin).options;
    const m = loadPool(mobile).options;
    assert.equal(a.max, 4);
    assert.equal(m.max, 3);
    assert.equal(2 * (a.max + m.max), 14);
    for (const options of [a, m]) {
        assert.equal(options.idleTimeoutMillis, 5000);
        assert.equal(options.connectionTimeoutMillis, 10000);
        assert.equal(options.keepAlive, true);
    }
    assert.ok(loadPool(admin).events.has('error'));
});

test('invalid pool settings cannot disable connection limits or timeouts', () => {
    for (const value of ['', '0', '-1', 'Infinity', 'no', '1.5']) {
        const overrides = { DB_POOL_MAX: value, DB_IDLE_TIMEOUT_MS: value, DB_CONNECTION_TIMEOUT_MS: value };
        assert.equal(loadPool(admin, overrides).options.max, 4);
        assert.equal(loadPool(mobile, overrides).options.max, 3);
        assert.equal(loadPool(admin, overrides).options.connectionTimeoutMillis, 10000);
    }
    assert.equal(loadPool(admin, { DB_POOL_MAX: '1' }).options.max, 4);
    assert.equal(loadPool(admin, { DB_POOL_MAX: '6' }).options.max, 6);
});

test('RBAC pool-capacity errors return retryable 503 responses instead of generic 500s', async () => {
    for (const failure of [
        { code: 'EMAXCONNSESSION', message: 'max clients reached in session mode' },
        { code: '53300', message: 'too many connections' },
        { message: 'timeout exceeded when trying to connect' },
    ]) {
        const routes = [];
        const router = {};
        for (const method of ['use', 'get', 'post', 'put', 'patch', 'delete']) {
            router[method] = (...args) => routes.push({ method, args });
        }
        const noop = () => { };
        vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../routes/rbacManagementRoutes.js'), 'utf8'), {
            require: name => {
                if (name === 'express') return { Router: () => router };
                if (name === '../config/db') return { query: async () => { throw failure; } };
                if (name.includes('authMiddleware')) return { protect: noop, authorizeRoles: () => noop };
                if (name.includes('rbacMiddleware')) return { requirePermission: () => noop };
                if (name === 'crypto') return require('node:crypto');
                if (name === '../services/workspaceScopeService') return {};

                throw Error('Unexpected dependency: ' + name);
            },
            console: { error() { } }, module: { exports: {} },
        });
        const overview = routes.find(route => route.method === 'get' && route.args[0] === '/overview');
        const response = { headers: {}, set(key, value) { this.headers[key] = value; return this; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
        await overview.args.at(-1)({}, response);
        assert.equal(response.statusCode, 503);
        assert.equal(response.headers['Retry-After'], '5');
        assert.equal(response.body.code, 'DATABASE_BUSY');
    }
});
