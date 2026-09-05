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
  assert.match(s,/res\.statusCode\s*<\s*200\s*\|\|\s*res\.statusCode\s*>=\s*400/);
  assert.match(s,/req\.__systemAuditLogged\s*===\s*true/);
});
test('core modules are mapped',()=>{
  const s=read('middleware/systemAuditCoverageMiddleware.js');
  for(const name of ['Application Review','Endorsement Slips','Scholars','Renewals','Payout Management','Return of Obligation','Scholarship Openings','Announcements','Profile Photos','Student Registry','Accounts','Scholarship Programs','Academic Years','Courses','OCR / Document Verification']){
    assert.ok(s.includes(name),`missing module ${name}`);
  }
});
test('explicit logs suppress fallback duplicates',()=>{
  assert.match(read('services/auditLogService.js'),/req\.__systemAuditLogged = true/);
});
test('authenticated routes attach fallback audit coverage without blocking public routes',()=>{
  const server = read('server/server.js');
  const auth = read('middleware/authMiddleware.js');

  assert.match(auth, /attachSystemAuditCoverage\(req, res\)/);
  assert.doesNotMatch(server, /app\.use\(attachSystemAuditCoverage\)/);
  assert.doesNotMatch(server, /require\(['"]\.\.\/middleware\/systemAuditCoverageMiddleware['"]\)/);
});
test('fallback does not copy request bodies/files',()=>{
  const s=read('middleware/systemAuditCoverageMiddleware.js');
  assert.doesNotMatch(s,/req\.body/); assert.doesNotMatch(s,/req\.file/);
  assert.match(s,/protected_mutation_fallback/);
});
