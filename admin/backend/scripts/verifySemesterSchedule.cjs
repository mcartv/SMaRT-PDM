'use strict';
// Isolated PostgreSQL verification; never loads live connection settings.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {PGlite} = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const root = path.resolve(__dirname, '../../..');

async function main() {
    const pg = await PGlite.create();
    try {
        await pg.exec(`CREATE TABLE academic_years(academic_year_id uuid PRIMARY KEY,label text,start_year int,end_year int,start_date date,end_date date,is_archived boolean DEFAULT false);
            CREATE TABLE academic_period(period_id uuid PRIMARY KEY,academic_year_id uuid REFERENCES academic_years,term text,is_active boolean DEFAULT false);
            INSERT INTO academic_years VALUES('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2030-2031',2030,2031,'2030-08-01','2031-05-31',false);
            INSERT INTO academic_period VALUES('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','First Semester',false),('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Second Semester',false);`);
        await pg.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261011190000_academic_semester_auto_schedule.sql'),'utf8'));
        let now='2030-08-01T04:00:00Z', injectFailure=false, failActivation=false;
        const calls=[];
        const query=async(sql,args=[])=>{
            if(injectFailure && sql.startsWith('INSERT INTO academic_semester_schedules') && args[0].startsWith('2222')) throw Error('Injected write failure');
            const result=await pg.query(sql,args); return {...result,rowCount:result.rows.length};
        };
        const pool={query,connect:async()=>({query,release(){}})};
        class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}}
        const module={exports:{}};
        vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../services/academicSemesterAutomationService.js'),'utf8'),{
            module,Date:Clock,Intl,require:name=>name==='../config/db'?pool:{activateAcademicPeriod:async(id,actor,options)=>{
                if(failActivation) throw Error('Activation rolled back');
                calls.push({id,actor,options});
                await pg.query('UPDATE academic_period SET is_active=(period_id=$1)',[id]);
                return {period:{period_id:id},cycle_summary:{preserved:true}};
            }},
        });
        const service=module.exports;
        const year='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
        const windows=[{term:'First Semester',start_date:'2030-08-01',end_date:'2030-12-20'},{term:'Second Semester',start_date:'2031-01-10',end_date:'2031-05-31'}];
        await service.saveYear(year,{windows,auto_enabled:true});
        assert.equal((await service.getSchedules()).length,2);
        assert.equal((await service.tick()).status,'activated');
        assert.equal(calls[0].options.scheduled,true);
        assert.equal((await service.tick()).status,'already-current');
        now='2030-12-25T04:00:00Z';
        assert.equal((await service.tick()).status,'no-due-window');
        assert.equal((await query('SELECT period_id FROM academic_period WHERE is_active=true')).rows[0].period_id,windows.length && '11111111-1111-4111-8111-111111111111');
        now='2031-01-09T16:01:00Z'; // Jan 10 in Philippine time.
        failActivation=true;
        assert.equal((await service.tick()).status,'failed');
        assert.match((await service.getSchedules())[1].last_error,/rolled back/);
        failActivation=false;
        assert.equal((await service.tick()).status,'activated');
        assert.equal(calls[1].id,'22222222-2222-4222-8222-222222222222');
        assert.equal((await service.getSchedules())[1].last_error,null);
        console.log('PASS scheduled switching, retry after failure, Philippine midnight, idempotency, and semester-break retention');
        await assert.rejects(service.saveYear(year,{windows:[{...windows[0],start_date:'2030-07-01'},windows[1]],auto_enabled:false}),/within the academic year/);
        await assert.rejects(service.saveYear(year,{windows:[{...windows[0],end_date:'2031-02-01'},windows[1]],auto_enabled:false}),/overlap/);
        await assert.rejects(service.saveYear(year,{windows:[{...windows[0],start_date:null},windows[1]],auto_enabled:false}),/invalid/);
        await assert.rejects(service.saveYear(year,{windows:[...windows,windows[0]],auto_enabled:false}),/Exactly two/);
        await assert.rejects(service.saveYear(year,{windows,auto_enabled:'true'}),/whether automatic/);
        injectFailure=true;
        await assert.rejects(service.saveYear(year,{windows:[{...windows[0],end_date:'2030-12-19'},windows[1]],auto_enabled:false}),/Injected/);
        injectFailure=false;
        assert.equal((await service.getSchedules())[0].end_date,'2030-12-20');
        console.log('PASS bounds, overlap, invalid input and atomic rollback');
        await pg.exec(`INSERT INTO academic_years VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','2030-2031 copy',2030,2031,'2030-08-01','2031-05-31',false);
            INSERT INTO academic_period VALUES('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','First Semester',false),('44444444-4444-4444-8444-444444444444','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Second Semester',false);`);
        await assert.rejects(service.saveYear('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',{windows,auto_enabled:true}),/another academic year/);
        await service.saveYear(year,{windows,auto_enabled:false});
        assert.equal((await service.tick()).status,'no-due-window');
        now='2031-06-01T04:00:00Z';
        await assert.rejects(service.saveYear(year,{windows,auto_enabled:true}),/both semesters have ended/);
        await service.saveYear(year,{windows,auto_enabled:false});
        console.log('PASS cross-year conflicts, automation off, and completed-year safeguards');
    } finally {await pg.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
