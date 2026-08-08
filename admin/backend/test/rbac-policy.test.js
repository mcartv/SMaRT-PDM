const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  ROLE_GROUPS,
  authorizeRoleGroup,
  authorizeOwnPortalTheme,
} = require('../middleware/rbacMiddleware');

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

function runMiddleware(middleware, req) {
  const res = mockResponse();
  let nextCalled = false;
  middleware(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test('ALL_STAFF includes only supported staff portal roles', () => {
  assert.deepEqual(ROLE_GROUPS.ALL_STAFF, ['admin', 'sdo', 'guidance', 'pd', 'ro_coordinator']);
});

test('role-group middleware blocks non-staff tokens', () => {
  const middleware = authorizeRoleGroup('ALL_STAFF');
  const denied = runMiddleware(middleware, { user: { role: 'student' } });
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.res.statusCode, 403);
  assert.equal(denied.res.body.code, 'RBAC_ACCESS_DENIED');

  const allowed = runMiddleware(middleware, { user: { role: 'pd' } });
  assert.equal(allowed.nextCalled, true);
});

test('department users can only mutate their own portal theme', () => {
  const allowed = runMiddleware(authorizeOwnPortalTheme, {
    user: { role: 'guidance' }, params: { portalKey: 'guidance' },
  });
  assert.equal(allowed.nextCalled, true);

  const denied = runMiddleware(authorizeOwnPortalTheme, {
    user: { role: 'guidance' }, params: { portalKey: 'admin' },
  });
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.res.statusCode, 403);
  assert.equal(denied.res.body.code, 'RBAC_PORTAL_SCOPE_DENIED');
});

test('endorsement routes enforce separation of duties', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/endorsementSlipRoutes.js'), 'utf8');
  assert.match(source, /pd-action'.*authorizeRoles\('pd'\)/s);
  assert.match(source, /guidance-action'.*authorizeRoles\('guidance'\)/s);
  assert.match(source, /sdo-action'.*authorizeRoles\('sdo'\)/s);
  assert.doesNotMatch(source, /pd-action'.*authorizeRoles\([^\n]*'admin'/s);
});

test('OSFA application routes use the admin-only gate', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/applicationRoutes.js'), 'utf8');
  assert.match(source, /const adminOnly = \[protect, authorizeRoles\('admin'\)\]/);
  assert.match(source, /router\.patch\('\/:id\/approve', \.\.\.adminOnly/);
  assert.match(source, /router\.post\('\/:id\/verify', \.\.\.adminOnly/);
  assert.match(source, /router\.patch\('\/:id\/disqualify', \.\.\.adminOnly/);
});


test('RO coordinator capability allows assigned department staff roles but excludes Admin', () => {
  assert.deepEqual(
    ROLE_GROUPS.RO_COORDINATOR_CAPABLE,
    ['sdo', 'guidance', 'pd', 'ro_coordinator']
  );

  const middleware = authorizeRoleGroup('RO_COORDINATOR_CAPABLE');
  for (const allowedRole of ['sdo', 'guidance', 'pd', 'ro_coordinator']) {
    const result = runMiddleware(middleware, { user: { role: allowedRole } });
    assert.equal(result.nextCalled, true);
  }

  for (const blockedRole of ['admin', 'student']) {
    const result = runMiddleware(middleware, { user: { role: blockedRole } });
    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, 403);
    assert.equal(result.res.body.code, 'RBAC_ACCESS_DENIED');
  }
});
