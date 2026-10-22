// SMARTPDM_SEMESTER_AUTO_V1 — safe, date-based activation.
const pool = require('../config/db');
const academic = require('./academicYearService');
const todayManila = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function fail(message, statusCode = 400) { throw Object.assign(new Error(message), { statusCode }); }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0,10) === value; }
function validate(rows) {
  if (!Array.isArray(rows) || rows.length !== 2) fail('Exactly two semester windows are required.');
  for (const row of rows) if (!row || !validDate(row.start_date) || !validDate(row.end_date) || row.start_date > row.end_date) fail('Semester dates are invalid.');
  const terms = new Set(rows.map(row => row.term));
  if (terms.size !== 2 || !terms.has('First Semester') || !terms.has('Second Semester')) fail('First and Second Semester required.');
  const sorted = [...rows].sort((a,b) => a.start_date.localeCompare(b.start_date));
  if (sorted[0].end_date >= sorted[1].start_date) fail('Semester windows cannot overlap.');
  if (sorted[0].term !== 'First Semester') fail('First Semester must come before Second Semester.');
  return sorted;
}
async function getSchedules() {
  try {
    const {rows} = await pool.query('SELECT s.period_id,s.start_date::text,s.end_date::text,s.auto_enabled,s.last_error,s.last_attempt_at,ap.term,ap.academic_year_id,ay.label AS academic_year_label FROM academic_semester_schedules s JOIN academic_period ap USING(period_id) JOIN academic_years ay ON ay.academic_year_id=ap.academic_year_id ORDER BY s.start_date');
    return rows;
  } catch (error) { if(error.code==='42P01') fail('Apply the academic semester schedule migration before configuring dates.',503); throw error; }
}
async function saveYear(academicYearId, payload = {}) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(academicYearId || ''))) fail('Select a valid academic year.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('Provide semester dates and an automatic switching setting.');
  if (typeof payload.auto_enabled !== 'boolean') fail('Choose whether automatic semester switching is enabled.');
  const windows = validate(payload.windows);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('smartpdm-semester-auto-v1')::bigint)");
    const {rows:periods} = await client.query('SELECT ap.period_id,ap.term,ay.start_year,ay.end_year,ay.start_date::text AS year_start_date,ay.end_date::text AS year_end_date,ay.is_archived FROM academic_period ap JOIN academic_years ay USING(academic_year_id) WHERE ap.academic_year_id=$1 FOR UPDATE OF ap,ay',[academicYearId]);
    if (periods.length !== 2 || periods.some(p=>p.is_archived)) fail('Select a non-archived academic year with both semesters.');
    const year = periods[0];
    const minimum = year.year_start_date || year.start_year + '-01-01';
    const maximum = year.year_end_date || year.end_year + '-12-31';
    if (windows.some(w=>w.start_date<minimum || w.end_date>maximum)) fail('Semester dates must stay within the academic year: ' + minimum + ' to ' + maximum + '.');
    if (payload.auto_enabled && windows.every(w=>w.end_date<todayManila())) fail('Cannot enable automation when both semesters have ended.');
    if (payload.auto_enabled) {
      for (const w of windows) {
        const overlap=await client.query('SELECT 1 FROM academic_semester_schedules s JOIN academic_period ap USING(period_id) JOIN academic_years ay USING(academic_year_id) WHERE ap.academic_year_id<>$1 AND ay.is_archived=false AND s.auto_enabled=true AND s.start_date<=$3::date AND s.end_date>=$2::date LIMIT 1',[academicYearId,w.start_date,w.end_date]);
        if(overlap.rowCount) fail('These dates overlap an automatic semester schedule in another academic year.');
      }
    }
    for (const w of windows) {
      const period=periods.find(p=>p.term===w.term);
      if(!period) fail('Both semester records are required.');
      await client.query('INSERT INTO academic_semester_schedules(period_id,start_date,end_date,auto_enabled,updated_at) VALUES($1,$2,$3,$4,NOW()) ON CONFLICT(period_id) DO UPDATE SET start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,auto_enabled=EXCLUDED.auto_enabled,last_error=NULL,updated_at=NOW()',[period.period_id,w.start_date,w.end_date,payload.auto_enabled]);
    }
    await client.query('COMMIT');
    return {ok:true};
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
async function tick() {
  const client = await pool.connect(); let locked = false;
  try {
    const l = await client.query("SELECT pg_try_advisory_lock(hashtext('smartpdm-semester-auto-v1')::bigint) AS ok"); locked = l.rows[0]?.ok === true; if (!locked) return { status: 'busy' };
    const today = todayManila(); const q = await client.query(
      'SELECT s.period_id,ap.academic_year_id,s.start_date,s.end_date,ap.is_active,ap.term,ay.is_archived,ay.start_year,ay.end_year FROM academic_semester_schedules s JOIN academic_period ap USING(period_id) JOIN academic_years ay USING(academic_year_id) WHERE ay.is_archived=false AND s.auto_enabled=true AND s.start_date<=$1 AND s.end_date>=$1 ORDER BY s.start_date DESC', [today]);
    if (q.rows.length !== 1) return { status: q.rows.length ? 'ambiguous' : 'no-due-window' };
    const target = q.rows[0]; if (target.is_archived) return { status: 'archived' }; if (target.is_active) return { status: 'already-current' };
    // SMARTPDM_SCHEDULE_BASED_ROLLOVER_V13: schedule dates decide when an academic year starts.
    // Safety checks: never silently detach pending applicant work or close live openings.
    // SMARTPDM_SCHEDULE_BASED_ROLLOVER_V13: never move automatically backward to an earlier configured cycle.
    const active = await client.query('SELECT ap.period_id,ay.start_year,ap.term FROM academic_period ap JOIN academic_years ay USING(academic_year_id) WHERE ap.is_active=true');
    if (active.rows.length > 1) return { status: 'ambiguous-active-periods' };
    if (active.rows.length === 1) {
      const current = active.rows[0];
      if (current.period_id === target.period_id) return { status: 'already-current' };
      if (Number(target.start_year) < Number(current.start_year) ||
        (Number(target.start_year) === Number(current.start_year) && target.term === 'First Semester' && current.term === 'Second Semester')) return { status: 'historical-target' };
    }
    // SMARTPDM_HISTORY_SAFE_ROLLOVER_V15: prior-cycle applications and openings are historical, not blockers.
    // The existing activation transaction closes old openings and creates missing Renewal/RO cycles.
    // Its failure still rolls back all activation-side mutations.
    try {
      const outcome = await academic.activateAcademicPeriod(target.period_id, null, { scheduled: true });
      await client.query('UPDATE academic_semester_schedules SET last_error=NULL,last_attempt_at=NOW(),last_transition_at=NOW() WHERE period_id=$1', [target.period_id]);
      return { status: 'activated', period: outcome.period, cycle_summary: outcome.cycle_summary };
    } catch (e) { await client.query('UPDATE academic_semester_schedules SET last_error=$2,last_attempt_at=NOW() WHERE period_id=$1', [target.period_id, e.message]); return { status: 'failed', reason: e.message }; }
  } finally {
    let releaseError;
    if (locked) {try {await client.query("SELECT pg_advisory_unlock(hashtext('smartpdm-semester-auto-v1')::bigint)");} catch(error) {releaseError=error;}}
    client.release(releaseError);
  }
}
module.exports = { getSchedules, saveYear, tick, validate, todayManila };
