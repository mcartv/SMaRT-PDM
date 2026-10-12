'use strict';
// Read-only preview. NEVER import or call academicYearService.activateAcademicPeriod.
const pool = require('../config/db');
const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
function parseDate(input) {
  if (typeof input !== 'string' || !VALID_DATE.test(input)) throw Object.assign(new Error('Date must be YYYY-MM-DD.'), { statusCode: 400 });
  const d = new Date(input + 'T00:00:00Z');
  if (Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== input) throw Object.assign(new Error('Invalid calendar date.'), { statusCode: 400 });
  return input;
}
function isoDate(d) { return d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10); }
function orderNumber(row) { return Number(row.start_year) * 2 + (row.term === 'Second Semester' ? 1 : 0); }
function evaluate({date, candidates, active, unfinishedCount, openingCount}) {
  const due = candidates.filter(c => !c.is_archived && isoDate(c.start_date) <= date && isoDate(c.end_date) >= date);
  if (due.length === 0) return {status:'no-due-window',would_activate:false,reason:'No enabled semester window contains this date.'};
  if (due.length > 1) return {status:'ambiguous',would_activate:false,reason:'Multiple enabled semester windows overlap this date.'};
  const target = due[0];
  const base = {target:{period_id:target.period_id,academic_year_id:target.academic_year_id,academic_year:target.academic_year_label,term:target.term,start_date:isoDate(target.start_date),end_date:isoDate(target.end_date)},would_activate:false};
  if (active.length > 1) return {...base,status:'ambiguous-active-periods',reason:'More than one current semester exists.'};
  if (target.is_active || active.some(a=>String(a.period_id)===String(target.period_id))) return {...base,status:'already-current',reason:'Target is already current.'};
  if (active.length && orderNumber(target) <= orderNumber(active[0])) return {...base,status:'historical-target',reason:'Automatic activation cannot move backward or repeat an older semester.'};
  // SMARTPDM_HISTORY_SAFE_ROLLOVER_V15: pending old-cycle work stays recorded; draft/open old openings close transactionally.
  const projected_effects={historical_unfinished_applications:unfinishedCount,open_or_draft_openings_to_close:openingCount};
  return {...base,status:'ready',would_activate:true,reason:'Preliminary schedule checks pass. Previous-cycle openings will close; applications and uploaded requirements stay in history. Actual activation remains transactional and may fail additional checks.',projected_effects};
}
async function preview(simulatedDate) {
 const date=parseDate(simulatedDate);
 const client=await pool.connect();
 try {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const {rows:candidates}=await client.query(`SELECT s.period_id,s.start_date,s.end_date,ap.academic_year_id,ap.term,ap.is_active,ay.is_archived,ay.start_year,ay.end_year,ay.label AS academic_year_label
    FROM academic_semester_schedules s JOIN academic_period ap ON ap.period_id=s.period_id JOIN academic_years ay ON ay.academic_year_id=ap.academic_year_id
    WHERE s.auto_enabled=true AND s.start_date <= $1::date AND s.end_date >= $1::date ORDER BY s.start_date DESC`,[date]);
  const {rows:active}=await client.query(`SELECT ap.period_id,ap.term,ay.start_year FROM academic_period ap JOIN academic_years ay ON ay.academic_year_id=ap.academic_year_id WHERE ap.is_active=true`);
  let unfinishedCount=0, openingCount=0;
  if(candidates.length===1 && !candidates[0].is_archived && !candidates[0].is_active){
   const id=candidates[0].period_id;
   const unfinished=await client.query(`SELECT COUNT(*)::int AS n FROM applications a JOIN program_openings o ON o.opening_id=a.opening_id WHERE o.period_id IS DISTINCT FROM $1 AND COALESCE(a.is_archived,false)=false AND LOWER(COALESCE(a.application_status,'')) IN ('pending review','requires reupload')`,[id]);
   const openings=await client.query(`SELECT COUNT(*)::int AS n FROM program_openings WHERE period_id IS DISTINCT FROM $1 AND COALESCE(is_archived,false)=false AND LOWER(COALESCE(posting_status,'')) IN ('draft','open')`,[id]);
   unfinishedCount=Number(unfinished.rows[0].n);openingCount=Number(openings.rows[0].n);
  }
  return {simulated_date:date,read_only:true,database_modified:false,automation_enabled_required:true,...evaluate({date,candidates,active,unfinishedCount,openingCount})};
 } finally {try{await client.query('ROLLBACK')}finally{client.release()}}
}
module.exports={preview,parseDate,evaluate};
