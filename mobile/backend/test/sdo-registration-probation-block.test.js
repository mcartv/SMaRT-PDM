'use strict';
// Isolated behavior tests of the real mobile signup guard; no network or database writes.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../src/services/authService.js'),'utf8');
const start=source.indexOf('function isMajorOffense(');
const end=source.indexOf('// safeText:',start);
assert.ok(start>=0 && end>start,'Registration guard must exist');
function setup({master='No Offense', records=[],error=null}={}) {
  const calls=[];
  const supabase={from(table){assert.equal(table,'sdo_student_records');return {select(cols){assert.equal(cols,'offense_type');return {in(key,ids){assert.equal(key,'student_number');calls.push(ids);return {eq(field,value){assert.equal(field,'is_archived');assert.equal(value,false);return Promise.resolve({data:records.map(offense_type=>({offense_type})),error})}}}}}}}};
  const sandbox={supabase,normalizeStudentNumber:x=>String(x||'').trim().toUpperCase()};
  vm.runInNewContext(source.slice(start,end)+';globalThis.guard=ensureRegistrationAllowed;',sandbox);
  const student={student_number:'PDM-001',offense_type:master};
  return {run:()=>sandbox.guard(student,'PDM-001'),calls};
}
test('No Offense registration remains allowed',async()=>{await setup().run()});
test('Minor Offense in master record blocks signup',async()=>{await assert.rejects(setup({master:'Minor Offense'}).run(),e=>e.statusCode===403)});
test('Major Offense in master record blocks signup',async()=>{await assert.rejects(setup({master:'Major Offense'}).run(),e=>e.statusCode===403)});
test('Imported Minor Offense blocks signup even if master says No Offense',async()=>{await assert.rejects(setup({records:['Minor Offense']}).run(),e=>e.statusCode===403)});
test('Imported Major Offense blocks signup',async()=>{await assert.rejects(setup({records:['Major Offense']}).run(),e=>e.statusCode===403)});
test('Archived cases are excluded by the query',async()=>{const s=setup();await s.run();assert.equal(s.calls.length,1)});
test('Fail closed if disciplinary lookup is unavailable',async()=>{await assert.rejects(setup({error:{message:'offline'}}).run(),e=>e.statusCode===503)});
test('Direct classifier recognizes probationary and clear',async()=>{const sandbox={};vm.runInNewContext(source.slice(start,source.indexOf('async function ensureRegistrationAllowed',start))+';globalThis.check=isMajorOffense;',sandbox);assert.equal(sandbox.check('Probationary'),true);assert.equal(sandbox.check('No Offense'),false)});
