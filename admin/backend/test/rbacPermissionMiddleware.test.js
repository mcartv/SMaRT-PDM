// SMARTPDM_PHASE3_RBAC_AUDIT_V1
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
// Test middleware without a real database or application server.
test('RBAC pilot middleware: audit mode allows legacy behavior, enforce mode denies', async()=>{
  const serviceFile=require.resolve('../services/rbacService');
  const middlewareFile=require.resolve('../middleware/rbacMiddleware');
  const oldService=require.cache[serviceFile];
  const oldMiddleware=require.cache[middlewareFile];
  const oldMode=process.env.RBAC_PERMISSION_MODE;
  try {
    require.cache[serviceFile]={id:serviceFile,filename:serviceFile,loaded:true,exports:{hasPermission:async()=>false}};
    delete require.cache[middlewareFile];
    const {requirePermission}=require('../middleware/rbacMiddleware');
    const req={user:{user_id:'test-user'},method:'GET',originalUrl:'/accounts/staff'};
    let nextCount=0;
    const res={statusCode:200,status(n){this.statusCode=n;return this},json(body){this.body=body;return this}};
    process.env.RBAC_PERMISSION_MODE='audit';
    await requirePermission('accounts.view')(req,res,()=>nextCount++);
    assert.equal(nextCount,1);
    process.env.RBAC_PERMISSION_MODE='enforce';
    await requirePermission('accounts.view')(req,res,()=>nextCount++);
    assert.equal(nextCount,1);
    assert.equal(res.statusCode,403);
    assert.equal(res.body.code,'RBAC_PERMISSION_DENIED');
  } finally {
    if(oldMode===undefined)delete process.env.RBAC_PERMISSION_MODE;else process.env.RBAC_PERMISSION_MODE=oldMode;
    if(oldService)require.cache[serviceFile]=oldService;else delete require.cache[serviceFile];
    if(oldMiddleware)require.cache[middlewareFile]=oldMiddleware;else delete require.cache[middlewareFile];
  }
});
