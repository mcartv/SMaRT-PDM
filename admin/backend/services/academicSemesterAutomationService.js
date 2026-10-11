// SMARTPDM_SEMESTER_AUTO_V1 — safe, date-based activation.
const pool = require('../config/db');
const academic = require('./academicYearService');
const fmt = (value) => value instanceof Date ? value.toISOString().slice(0,10) : String(value || '').slice(0,10);
const todayManila = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function validDate(value){const v=fmt(value);return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v}
function validate(rows){if(!Array.isArray(rows)||rows.length!==2)throw Error('Exactly two semester windows are required.');
 const sorted=[...rows].sort((a,b)=>a.start_date.localeCompare(b.start_date));
 for(const r of sorted){if(!validDate(r.start_date)||!validDate(r.end_date)||r.start_date>r.end_date)throw Error('Semester dates are invalid.');}
 if(sorted[0].end_date>=sorted[1].start_date)throw Error('Semester windows cannot overlap.');
 const terms=new Set(rows.map(r=>r.term));if(terms.size!==2||!terms.has('First Semester')||!terms.has('Second Semester'))throw Error('First and Second Semester required.');return sorted;
}
async function getSchedules(){const {rows}=await pool.query(
  'SELECT s.period_id,s.start_date,s.end_date,s.auto_enabled,s.last_error,s.last_attempt_at,ap.term,ay.label AS academic_year_label FROM academic_semester_schedules s JOIN academic_period ap USING(period_id) JOIN academic_years ay ON ay.academic_year_id=ap.academic_year_id ORDER BY s.start_date');return rows.map(r=>({...r,start_date:fmt(r.start_date),end_date:fmt(r.end_date)}));}
async function saveYear(academicYearId, payload){
 const client=await pool.connect();try{await client.query('BEGIN');
 const {rows:periods}=await client.query('SELECT ap.period_id,ap.term,ay.start_year,ay.end_year,ay.is_archived FROM academic_period ap JOIN academic_years ay USING(academic_year_id) WHERE ap.academic_year_id=$1 FOR UPDATE OF ap,ay',[academicYearId]);
 if(periods.length!==2||periods.some(p=>p.is_archived))throw Error('Select a non-archived academic year with both semesters.');
 const windows=validate(periods.map(p=>{const input=(payload.windows||[]).find(w=>w.term===p.term);if(!input)throw Error('Missing schedule for '+p.term);const start=fmt(input.start_date),end=fmt(input.end_date);if(Number(start.slice(0,4))<p.start_year||Number(start.slice(0,4))>p.end_year||Number(end.slice(0,4))<p.start_year||Number(end.slice(0,4))>p.end_year)throw Error('Date outside academic year.');return {period_id:p.period_id,term:p.term,start_date:start,end_date:end};}));
 // An already elapsed start date cannot silently trigger historical transitions.
 const today=todayManila();if(windows.some(w=>w.end_date<today))throw Error('Completed semesters cannot be configured for automatic activation.');
 for(const w of windows){await client.query(
 'INSERT INTO academic_semester_schedules(period_id,start_date,end_date,auto_enabled,updated_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(period_id) DO UPDATE SET start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,auto_enabled=EXCLUDED.auto_enabled,last_error=NULL,updated_at=NOW()',
 [w.period_id,w.start_date,w.end_date,payload.auto_enabled===true]);}
 await client.query('COMMIT');return {ok:true};}catch(e){await client.query('ROLLBACK');throw e}finally{client.release();}}
async function tick(){
 const client=await pool.connect();let locked=false;
 try{const l=await client.query("SELECT pg_try_advisory_lock(hashtext('smartpdm-semester-auto-v1')::bigint) AS ok");locked=l.rows[0]?.ok===true;if(!locked)return {status:'busy'};
 const today=todayManila();const q=await client.query(
 'SELECT s.period_id,ap.academic_year_id,s.start_date,s.end_date,ap.is_active,ap.term,ay.is_archived,ay.start_year,ay.end_year FROM academic_semester_schedules s JOIN academic_period ap USING(period_id) JOIN academic_years ay USING(academic_year_id) WHERE s.auto_enabled=true AND s.start_date<=$1 AND s.end_date>=$1 ORDER BY s.start_date DESC',[today]);
 if(q.rows.length!==1)return {status:q.rows.length?'ambiguous':'no-due-window'};
 const target=q.rows[0];if(target.is_archived)return {status:'archived'};if(target.is_active)return {status:'already-current'};
 const currentYear=Number(today.slice(0,4));if(currentYear<target.start_year||currentYear>target.end_year)return {status:'year-mismatch'};
 // Safety checks: never silently detach pending applicant work or close live openings.
 const unfinished=await client.query("SELECT COUNT(*)::int AS n FROM applications a JOIN program_openings o ON o.opening_id=a.opening_id WHERE o.period_id IS DISTINCT FROM $1 AND COALESCE(a.is_archived,false)=false AND LOWER(COALESCE(a.application_status,'')) IN ('pending review','requires reupload')",[target.period_id]);
 const openings=await client.query("SELECT COUNT(*)::int AS n FROM program_openings WHERE period_id IS DISTINCT FROM $1 AND COALESCE(is_archived,false)=false AND LOWER(COALESCE(posting_status,'')) IN ('draft','open')",[target.period_id]);
 if(unfinished.rows[0].n||openings.rows[0].n){const detail='Blocked: '+unfinished.rows[0].n+' incomplete applications; '+openings.rows[0].n+' open/draft openings. Review and use manual Set Current after resolving.';
 await client.query('UPDATE academic_semester_schedules SET last_error=$2,last_attempt_at=NOW() WHERE period_id=$1',[target.period_id,detail]);return {status:'blocked',reason:detail};}
 try{const outcome=await academic.activateAcademicPeriod(target.period_id,null);
 await client.query('UPDATE academic_semester_schedules SET last_error=NULL,last_attempt_at=NOW(),last_transition_at=NOW() WHERE period_id=$1',[target.period_id]);
 return {status:'activated',period:outcome.period};}catch(e){await client.query('UPDATE academic_semester_schedules SET last_error=$2,last_attempt_at=NOW() WHERE period_id=$1',[target.period_id,e.message]);return {status:'failed',reason:e.message};}
 }finally{if(locked)await client.query("SELECT pg_advisory_unlock(hashtext('smartpdm-semester-auto-v1')::bigint)").catch(()=>{});client.release();}}
module.exports={getSchedules,saveYear,tick,validate,todayManila};
