'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {assertEligible} = require('../services/roCourseEligibilityService');
const queryRows = rows => ({ query: async(sql,args)=>{ assert.match(sql,/ro_department_courses/); assert.deepEqual(args,['student-1','area-1']);return {rows}; } });
test('allows unmapped active area (legacy unrestricted rule)',async()=>{
  await assert.doesNotReject(assertEligible({studentId:'student-1',departmentId:'area-1',client:queryRows([{is_active:true,mapping_count:0,course_allowed:false}])}));
});
test('allows eligible course in configured active area',async()=>{
  await assert.doesNotReject(assertEligible({studentId:'student-1',departmentId:'area-1',client:queryRows([{is_active:true,mapping_count:2,course_allowed:true}])}));
});
test('blocks course not linked to configured area',async()=>{
  await assert.rejects(assertEligible({studentId:'student-1',departmentId:'area-1',client:queryRows([{is_active:true,mapping_count:2,course_allowed:false}])}),e=>e.statusCode===409 && /not eligible/.test(e.message));
});
test('blocks inactive area even when course is eligible',async()=>{
  await assert.rejects(assertEligible({studentId:'student-1',departmentId:'area-1',client:queryRows([{is_active:false,mapping_count:1,course_allowed:true}])}),e=>e.statusCode===409 && /inactive/.test(e.message));
});
test('blocks missing course when restrictions configured',async()=>{
  await assert.rejects(assertEligible({studentId:'student-1',departmentId:'area-1',client:queryRows([{is_active:true,mapping_count:1,course_allowed:false}])}),{statusCode:409});
});
test('fails closed when scholar or area is missing',async()=>{
  await assert.rejects(assertEligible({studentId:'student-1',departmentId:'area-1',client:queryRows([])}),{statusCode:404});
});
test('rejects missing identifiers before query',async()=>{
  await assert.rejects(assertEligible({studentId:'',departmentId:'area-1',client:queryRows([])}),{statusCode:400});
});
test('propagates database failure rather than allowing assignments',async()=>{
  await assert.rejects(assertEligible({studentId:'student-1',departmentId:'area-1',client:{query:async()=>{throw new Error('db unavailable')}}}),/db unavailable/);
});
