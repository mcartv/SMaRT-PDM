'use strict';
// Phase 6D-2D2 regression: route gate and filtered query, no database connections.
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');

function setup({roles=true,permit=true,courses=['c0000000-0000-4000-8000-000000000001'],staff=[]}={}){
 const calls=[];
 const handlers={};
 const router={use(){},get(k,fn){handlers[k]=fn;}};
 const express=()=>router;express.Router=()=>router;
 const pool={async query(sql,args=[]){calls.push({sql,args});
   if(sql.includes('SELECT 1 FROM public.rbac_user_roles ur'))return {rowCount:roles?1:0,rows:roles?[{}]:[]};
   if(sql.includes('SELECT r.role_id FROM public.rbac_user_roles ur'))return {rowCount:roles?1:0,rows:roles?[{role_id:'role1'}]:[]};
   if(sql.includes('SELECT u.user_id,u.username,')){
     // Stub only returns office-authorized fixture rows; inspect query to ensure the
     // route really delegates mandatory office and course restrictions to SQL.
     assert.match(sql,/JOIN public\.ref_offices o ON o\.office_id=a\.office_id AND o\.is_active=true/);
     assert.match(sql,/c\.course_id=ANY\(\$1::uuid\[\]\)/);
     assert.match(sql,/COALESCE\(a\.is_archived,false\)=false/);
     assert.deepEqual(args,[courses]);
     return {rows:staff,rowCount:staff.length};
   }
   throw Error('Unexpected SQL: '+sql.slice(0,120));
 }};
 const real=Module._load;
 const target=require.resolve('../routes/workspaceRoutes');
 delete require.cache[target];
 Module._load=function(name,parent,isMain){
   if(name==='express'&&parent?.filename===target)return express;
   if(name==='../config/db'&&parent?.filename===target)return pool;
   if(name==='../middleware/authMiddleware'&&parent?.filename===target)return {protect:(req,res,next)=>next()};
   if(name==='../services/workspaceScopeService'&&parent?.filename===target)return {effective:async()=>courses.map(course_id=>({course_id}))};
   if(name==='../services/officeAccountAccessService'&&parent?.filename===target)return {allowed:async()=>permit};
   return real.apply(this,arguments);
 };
 try{require(target)}finally{Module._load=real;delete require.cache[target]}
 async function request(module='accounts'){
   const req={params:{module},user:{user_id:'user1',role:'workspace'}};
   const res={code:200,body:null,status(n){this.code=n;return this},set(){return this},json(x){this.body=x;return this}};
   await handlers['/data/:module'](req,res);
   return res;
 }
 return {request,calls};
}
test('Accounts returns only fields from an office-and-course-filtered, read-only query',async()=>{
 const s=setup({staff:[{user_id:'u1',username:'staff1',name:'Office Staff',department:'CCS'}]});
 const res=await s.request();assert.equal(res.code,200);assert.equal(res.body.items.length,1);
 assert.equal(s.calls.filter(x=>x.sql.includes('SELECT u.user_id,u.username,')).length,1);
 assert.ok(s.calls.every(x=>/^\s*SELECT/i.test(x.sql)));
});
test('Accounts denies role permission absence without reading staff',async()=>{
 const s=setup({roles:false});const res=await s.request();assert.equal(res.code,403);
 assert.ok(!s.calls.some(x=>x.sql.includes('SELECT u.user_id,u.username,')));
});
test('Accounts denies account-specific permission restriction',async()=>{
 const s=setup({permit:false});const res=await s.request();assert.equal(res.code,403);
 assert.ok(!s.calls.some(x=>x.sql.includes('SELECT u.user_id,u.username,')));
});
test('Accounts denies empty office/course access',async()=>{
 const s=setup({courses:[]});const res=await s.request();assert.equal(res.code,403);
 assert.ok(!s.calls.some(x=>x.sql.includes('SELECT u.user_id,u.username,')));
});
test('Payouts still denied',async()=>{
 const s=setup();const res=await s.request('payouts');assert.equal(res.code,403);
 assert.equal(res.body.code,'WORKSPACE_RECORD_SCOPE_REQUIRED');
});
