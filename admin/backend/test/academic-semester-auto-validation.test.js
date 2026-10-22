// SMARTPDM_SEMESTER_AUTO_V1
const test=require('node:test'),assert=require('node:assert/strict');
const {validate}=require('../services/academicSemesterAutomationService');
const rows=[{term:'First Semester',start_date:'2027-08-01',end_date:'2027-12-20'},{term:'Second Semester',start_date:'2028-01-10',end_date:'2028-05-15'}];
test('validates non-overlapping calendar',()=>assert.equal(validate(rows).length,2));
test('rejects overlapping terms',()=>assert.throws(()=>validate([{...rows[0],end_date:'2028-02-01'},rows[1]]),/overlap/));
test('rejects invalid dates',()=>assert.throws(()=>validate([{...rows[0],start_date:'2027-02-30'},rows[1]]),/invalid/));
test('requires both terms',()=>assert.throws(()=>validate([rows[0],{...rows[1],term:'First Semester'}]),/required/));

const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('manual Set Current pauses automatic switching; scheduled activation keeps it enabled',async()=>{
  for(const scheduled of [false,true]) {
    let paused=false,released=false;
    const period={period_id:'period',academic_year_id:'year',term:'First Semester',start_year:2026,end_year:2027,academic_year_label:'2026-2027',academic_year_archived:false};
    const client={release(){released=true},async query(sql){
      if(sql.includes('calendar_year'))return{rows:[{calendar_year:2026,calendar_month:10}],rowCount:1};
      if(sql.includes('FOR UPDATE OF ap, ay'))return{rows:[period],rowCount:1};
      if(sql.includes('to_regclass'))return{rows:[{ready:true}],rowCount:1};
      if(sql.startsWith('UPDATE academic_semester_schedules'))paused=true;
      if(sql.includes('RETURNING *'))return{rows:[period],rowCount:1};
      return{rows:[],rowCount:0};
    }};
    const exports={};const context={exports,module:{exports},require:()=>({connect:async()=>client}),console,process:{env:{}}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/academicYearService.js'),'utf8'),context);
    await exports.activateAcademicPeriod('period',null,{scheduled});
    assert.equal(paused,!scheduled);assert.equal(released,true);
  }
});

test('semester date status includes both boundary dates and client validation rejects overlap',async()=>{
  const{pathToFileURL}=require('node:url');
  const ui=await import(pathToFileURL(path.resolve(__dirname,'../../frontend/src/pages/maintenance/components/semesterSchedule.js')).href);
  assert.equal(ui.semesterScheduleStatus(rows[0],'2027-07-31'),'Upcoming');
  assert.equal(ui.semesterScheduleStatus(rows[0],'2027-08-01'),'In progress');
  assert.equal(ui.semesterScheduleStatus(rows[0],'2027-12-20'),'In progress');
  assert.equal(ui.semesterScheduleStatus(rows[0],'2027-12-21'),'Completed');
  const year={start_year:2027,end_year:2028,start_date:'2027-08-01',end_date:'2028-05-31'};
  assert.equal(ui.validateSemesterSchedule(rows,year,true,'2027-08-01'),'');
  assert.match(ui.validateSemesterSchedule([{...rows[0],end_date:'2028-01-10'},rows[1]],year,true,'2027-08-01'),/overlap/);
});

test('academic year cannot be shortened around an existing semester schedule',async()=>{
  let rollback=false,updated=false,released=false;
  const client={release(){released=true},async query(sql){
    if(sql==='ROLLBACK')rollback=true;
    if(sql.includes('FROM academic_years')&&sql.includes('FOR UPDATE'))return{rows:[{academic_year_id:'year',start_year:2026,end_year:2027,start_date:'2026-07-01',end_date:'2027-05-31',is_active:false,is_archived:false}],rowCount:1};
    if(sql.includes('to_regclass'))return{rows:[{ready:true}],rowCount:1};
    if(sql.includes('FROM academic_semester_schedules'))return{rows:[{}],rowCount:1};
    if(sql.includes('UPDATE academic_years'))updated=true;
    return{rows:[],rowCount:0};
  }};
  const exports={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/academicYearService.js'),'utf8'),{exports,module:{exports},require:()=>({connect:async()=>client}),console,process:{env:{}}});
  await assert.rejects(exports.updateAcademicYear('year',{start_date:'2026-08-01',end_date:'2027-05-31'}),{statusCode:409});
  assert.equal(rollback,true);assert.equal(updated,false);assert.equal(released,true);
});
