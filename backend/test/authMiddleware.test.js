const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeRole,
    requireAdmin,
    requireRole,
} = require('../src/middleware/authMiddleware');

function invoke(middleware, role) {
    let nextCalled = false;
    let responseStatus = null;
    let responseBody = null;
    const req = { user: role === undefined ? {} : { role } };
    const res = {
        status(status) {
            responseStatus = status;
            return this;
        },
        json(body) {
            responseBody = body;
            return this;
        },
    };
    middleware(req, res, () => { nextCalled = true; });
    return { nextCalled, responseStatus, responseBody };
}

test('normalizes known staff role aliases', () => {
    assert.equal(normalizeRole('OSFA Administrator'), 'admin');
    assert.equal(normalizeRole('Program Director'), 'pd');
    assert.equal(normalizeRole('RO-Coordinator'), 'ro_coordinator');
});

test('admin policy permits administrators and rejects students', () => {
    assert.equal(invoke(requireAdmin, 'osfa_admin').nextCalled, true);
    const denied = invoke(requireAdmin, 'Student');
    assert.equal(denied.nextCalled, false);
    assert.equal(denied.responseStatus, 403);
    assert.match(denied.responseBody.error, /permission/i);
});

test('role policies deny missing roles and accept configured roles', () => {
    const policy = requireRole('guidance', 'sdo');
    assert.equal(invoke(policy, 'guidance').nextCalled, true);
    assert.equal(invoke(policy).responseStatus, 403);
});
