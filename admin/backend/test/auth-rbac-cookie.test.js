const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-rbac-cookie-secret';

const { protect, authorizeRoles } = require('../middleware/authMiddleware');

function responseRecorder() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

test('protect accepts an HttpOnly-cookie token for departmental staff', async () => {
    const token = jwt.sign({ sub: 'staff-1', role: 'guidance' }, process.env.JWT_SECRET);
    const req = { headers: { cookie: `smartpdm_session=${encodeURIComponent(token)}` } };
    const res = responseRecorder();
    let nextCalled = false;

    await protect(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.user.userId, 'staff-1');
    assert.equal(req.user.role, 'guidance');
});

test('role policy rejects a departmental token on an admin endpoint', () => {
    const req = { user: { role: 'sdo' } };
    const res = responseRecorder();
    let nextCalled = false;

    authorizeRoles('admin')(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
});
