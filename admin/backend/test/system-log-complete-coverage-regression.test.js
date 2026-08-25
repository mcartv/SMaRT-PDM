'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('fallback only covers successful mutations',()=>{
  const s=read('middleware/systemAuditCoverageMiddleware.js');
  assert.match(s,/POST/); assert.match(s,/PUT/); assert.match(s,/PATCH/); assert.match(s,/DELETE/);
  assert.match(s,/res\.statusCode<200\|\|res\.statusCode>=400/);
  assert.match(s,/req\.__systemAuditLogged===true/);
});
test('core modules are mapped',()=>{
  const s=read('middleware/systemAuditCoverageMiddleware.js');
  for(const name of ['Applications','Endorsements','Scholars','Renewals','Payout','Obligations / RO','Openings','Announcements','Profile Photos','Student Registry','Accounts','Scholarship Programs','Academic Years','Courses','OCR']){
    assert.ok(s.includes(name),`missing module ${name}`);
  }
});
test('explicit logs suppress fallback duplicates',()=>{
  assert.match(read('services/auditLogService.js'),/req\.__systemAuditLogged = true/);
});
test('server installs fallback middleware',()=>{
  assert.match(read('server/server.js'),/app\.use\(systemAuditCoverageMiddleware\)/);
});
test('fallback does not copy request bodies/files',()=>{
  const s=read('middleware/systemAuditCoverageMiddleware.js');
  assert.doesNotMatch(s,/req\.body/); assert.doesNotMatch(s,/req\.file/);
  assert.match(s,/automatic_mutation_fallback/);
});
