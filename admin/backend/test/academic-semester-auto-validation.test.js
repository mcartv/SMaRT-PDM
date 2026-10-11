// SMARTPDM_SEMESTER_AUTO_V1
const test=require('node:test'),assert=require('node:assert/strict');
const {validate}=require('../services/academicSemesterAutomationService');
const rows=[{term:'First Semester',start_date:'2027-08-01',end_date:'2027-12-20'},{term:'Second Semester',start_date:'2028-01-10',end_date:'2028-05-15'}];
test('validates non-overlapping calendar',()=>assert.equal(validate(rows).length,2));
test('rejects overlapping terms',()=>assert.throws(()=>validate([{...rows[0],end_date:'2028-02-01'},rows[1]]),/overlap/));
test('rejects invalid dates',()=>assert.throws(()=>validate([{...rows[0],start_date:'2027-02-30'},rows[1]]),/invalid/));
test('requires both terms',()=>assert.throws(()=>validate([rows[0],{...rows[1],term:'First Semester'}]),/required/));
