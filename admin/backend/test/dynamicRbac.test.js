'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ROUTES = path.join(ROOT, 'routes', 'rbacManagementRoutes.js');
const SERVICE = path.join(ROOT, 'services', 'rbacService.js');
const MIDDLEWARE = path.join(ROOT, 'middleware', 'rbacMiddleware.js');

// Inject dependencies temporarily and restore them on completion; no DB writes.
function isolated(file, replacements) {
  const real = Module._load;
  delete require.cache[require.resolve(file)];
  Module._load = function(request, parent, isMain) {
    if (Object.hasOwn(replacements, request)) return replacements[request];
    return real.apply(this, arguments);
  };
  try { return require(file); } finally {
    Module._load = real;
    delete require.cache[require.resolve(file)];
  }
}
function mockRouter() {
  const routes = new Map();
  const router = { use() {} };
  for (const method of ['get', 'post', 'patch', 'put']) {
    router[method] = (route, ...handlers) => routes.set(method.toUpperCase() + ' ' + route, handlers.at(-1));
  }
  return { routes, express: { Router: () => router } };
}
async function invoke(handler, body = {}, params = {}) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
    set() { return this; } };
  await handler({ body, params }, res);
  return res;
}
const ROLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PERM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function routesWithQuery(query) {
  const { routes, express } = mockRouter();
  isolated(ROUTES, {
    express,
    '../config/db': { query },
    '../middleware/authMiddleware': { protect: (_req, _res, next) => next(), authorizeRoles: () => (_req, _res, next) => next() },
    '../middleware/rbacMiddleware': { requirePermission: () => (_req, _res, next) => next() },
  });
  return routes;
}

test('RBAC service reads grants from database, not a hardcoded list', async () => {
  let sql = '';
  const service = isolated(SERVICE, { '../config/db': { query: async (q, args) => {
    sql = q; assert.deepEqual(args, ['u1']);
    return { rows: [{permission_code:'reports.view'}, {permission_code:'accounts.view'}] };
  } } });
  const grants = await service.loadPermissions('u1');
  assert.equal(grants.has('reports.view'), true);
  assert.equal(grants.has('programs.archive'), false);
  assert.match(sql, /rbac_role_permissions/);
  assert.match(sql, /r\.is_active\s*=\s*TRUE/i);
  assert.match(sql, /ur\.is_active\s*=\s*TRUE/i);
});

test('permission middleware rejects missing identity in enforcement mode', async () => {
  const middleware = isolated(MIDDLEWARE, {
    '../services/rbacService': { hasPermission: async () => false },
    '../config/db': { query: async () => ({rows:[]}) },
  });
  const old = process.env.RBAC_PERMISSION_MODE;
  process.env.RBAC_PERMISSION_MODE = 'enforce';
  try {
    const res = {statusCode:200,status(x){this.statusCode=x;return this},json(v){this.payload=v;return this}};
    await middleware.requirePermission('accounts.view')({user:null},res,()=>assert.fail('Must not allow'));
    assert.equal(res.statusCode,401);
  } finally { if(old===undefined)delete process.env.RBAC_PERMISSION_MODE;else process.env.RBAC_PERMISSION_MODE=old; }
});

test('role creation remains disabled; supplemental Dean is added only by the reviewed migration', async () => {
  const routes = routesWithQuery(async () => assert.fail('Disabled role creation must not write to the database'));
  for (const endpoint of ['POST /roles', 'POST /roles/with-permissions']) {
    const res = await invoke(routes.get(endpoint), { role_name: 'Dean', permission_ids: [] });
    assert.equal(res.statusCode, 403);
    assert.equal(res.payload.code, 'ROLE_CREATION_DISABLED');
  }
});

test('updates a custom role name', async()=>{
  const routes=routesWithQuery(async (sql, params)=>{
    assert.match(sql,/UPDATE public\.rbac_roles/i);
    assert.deepEqual(params,[ROLE_ID,'Records Officer']);
    return {rowCount:1,rows:[{role_id:ROLE_ID,role_name:'Records Officer'}]};
  });
  const res=await invoke(routes.get('PATCH /roles/:id'),{role_name:'Records Officer'},{id:ROLE_ID});
  assert.equal(res.statusCode,200);
  assert.equal(res.payload.role_name,'Records Officer');
});

test('archives and restores custom roles',async()=>{
  const calls=[];
  const routes=routesWithQuery(async (sql, params)=>{
    calls.push(params[1]);
    assert.match(sql,/UPDATE public\.rbac_roles/i);
    return {rowCount:1,rows:[{role_id:ROLE_ID,is_active:params[1]}]};
  });
  for(const active of [false,true]){
    const res=await invoke(routes.get('PATCH /roles/:id/status'),{is_active:active},{id:ROLE_ID});
    assert.equal(res.statusCode,200);
    assert.equal(res.payload.is_active,active);
  }
  assert.deepEqual(calls,[false,true]);
});

test('grants then revokes an operational role permission',async()=>{
  const writes=[];
  const routes=routesWithQuery(async(sql,values)=>{
    if(sql.startsWith('SELECT role_code')) return {rowCount:1,rows:[{role_code:'guidance',role_scope:'staff',is_active:true}]};
    if(sql.startsWith('SELECT 1 FROM public.rbac_permissions')) return {rowCount:1,rows:[{}]};
    writes.push(sql);
    assert.deepEqual(values,[ROLE_ID,PERM_ID]);
    return {rowCount:1,rows:[]};
  });
  for(const granted of [true,false]){
    const res=await invoke(routes.get('PUT /roles/:id/permissions/:permissionId'),{granted},{id:ROLE_ID,permissionId:PERM_ID});
    assert.equal(res.statusCode,200);
    assert.equal(res.payload.ok,true);
  }
  assert.match(writes[0],/INSERT INTO public\.rbac_role_permissions/);
  assert.match(writes[1],/DELETE FROM public\.rbac_role_permissions/);
});

test('refuses to change protected admin permissions',async()=>{
  const routes=routesWithQuery(async sql=>{
    if(sql.startsWith('SELECT role_code')) return {rowCount:1,rows:[{role_code:'admin',role_scope:'staff',is_active:true}]};
    assert.fail('Protected admin role must never be modified');
  });
  const res=await invoke(routes.get('PUT /roles/:id/permissions/:permissionId'),{granted:false},{id:ROLE_ID,permissionId:PERM_ID});
  assert.equal(res.statusCode,403);
});

test('refuses permission grants to archived roles',async()=>{
  const routes=routesWithQuery(async sql=>{
    if(sql.startsWith('SELECT role_code')) return {rowCount:1,rows:[{role_code:'custom_abc',role_scope:'staff',is_active:false}]};
    assert.fail('Archived role must never gain permissions');
  });
  const res=await invoke(routes.get('PUT /roles/:id/permissions/:permissionId'),{granted:true},{id:ROLE_ID,permissionId:PERM_ID});
  assert.equal(res.statusCode,403);
});
