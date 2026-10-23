'use strict';
// Offline PostgreSQL verification. Never loads application .env or connects to Supabase.
const {PGlite}=require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const seed=fs.readFileSync(path.resolve(__dirname,'../../../supabase/test-data/registry-scholars-five-per-opening.sql'),'utf8');
async function fixture(){
 const db=await PGlite.create();
 await db.exec(`
 CREATE TABLE academic_years(academic_year_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),label text,is_archived boolean DEFAULT false);
 CREATE TABLE academic_period(period_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),academic_year_id uuid REFERENCES academic_years,term text,is_active boolean DEFAULT false);
 CREATE TABLE academic_course(course_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),is_archived boolean DEFAULT false);
 CREATE TABLE scholarship_program(program_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_name text,is_archived boolean DEFAULT false);
 CREATE TABLE program_openings(opening_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),program_id uuid REFERENCES scholarship_program,
 academic_year_id uuid REFERENCES academic_years,period_id uuid REFERENCES academic_period,opening_title text,
 is_archived boolean DEFAULT false,allocated_slots int DEFAULT 15,filled_slots int DEFAULT 0,posting_status text DEFAULT 'closed',updated_at timestamptz DEFAULT now());
 CREATE TABLE student_master_records(master_student_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_number text UNIQUE,pdm_id text,
 first_name text,middle_name text,last_name text,course_id uuid REFERENCES academic_course,year_level int,sex_at_birth text,
 email_address text,phone_number text,sequence_number int,is_active boolean DEFAULT true,is_archived boolean DEFAULT false,
 source_registry boolean DEFAULT true,latest_import_batch_id uuid DEFAULT gen_random_uuid(),has_disciplinary_action boolean DEFAULT false,offense_type text);
 CREATE TABLE students(student_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),master_student_id uuid UNIQUE REFERENCES student_master_records,
 pdm_id text NOT NULL UNIQUE,registrar_student_number text UNIQUE,course_id uuid REFERENCES academic_course,first_name text,middle_name text,last_name text,
 year_level int CHECK(year_level BETWEEN 1 AND 6),sex_at_birth text,email_address text,phone_number text,sequence_number int,
 is_active_scholar boolean DEFAULT false,scholarship_status text DEFAULT 'None',current_program_id uuid REFERENCES scholarship_program,
 active_academic_year_id uuid REFERENCES academic_years,active_period_id uuid REFERENCES academic_period,date_awarded date,sdo_status text DEFAULT 'Clear',
 current_application_id uuid,is_archived boolean DEFAULT false,scholar_is_archived boolean DEFAULT false);
 CREATE TABLE applications(application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid REFERENCES students,opening_id uuid REFERENCES program_openings,
 program_id uuid REFERENCES scholarship_program,application_status text DEFAULT 'Pending Review',selection_status text DEFAULT 'Unranked',
 activation_status text DEFAULT 'Not Activated',selected_at timestamptz,finalized_at timestamptz,activated_at timestamptz,endorsement_completed_at timestamptz,
 application_payload jsonb DEFAULT '{}',is_archived boolean DEFAULT false,is_disqualified boolean DEFAULT false);
 ALTER TABLE students ADD FOREIGN KEY(current_application_id) REFERENCES applications;
 CREATE TABLE endorsement_slips(slip_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),application_id uuid UNIQUE REFERENCES applications,
 student_id uuid REFERENCES students,opening_id uuid REFERENCES program_openings,current_stage text DEFAULT 'pending_sdo',overall_status text DEFAULT 'pending_sdo',
 sdo_status text,guidance_status text,pd_status text,completed_at timestamptz,updated_at timestamptz DEFAULT now());
 CREATE FUNCTION make_slip() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO endorsement_slips(application_id,student_id,opening_id) VALUES(NEW.application_id,NEW.student_id,NEW.opening_id); RETURN NEW; END $$;
 CREATE TRIGGER make_slip AFTER INSERT ON applications FOR EACH ROW EXECUTE FUNCTION make_slip();
 INSERT INTO academic_years(label) VALUES('2026-2027');
 INSERT INTO academic_period(academic_year_id,term,is_active) SELECT academic_year_id,'First Semester',true FROM academic_years;
 INSERT INTO academic_course SELECT gen_random_uuid(),false FROM generate_series(1,4);
 INSERT INTO scholarship_program(program_name) VALUES('Food Crafters'),('BC Packaging'),('Kaizen'),('Genmart');
 INSERT INTO program_openings(program_id,academic_year_id,period_id,opening_title,filled_slots)
 SELECT p.program_id,ap.academic_year_id,ap.period_id,p.program_name||' Opening',7 FROM scholarship_program p CROSS JOIN academic_period ap;
 INSERT INTO program_openings(program_id,academic_year_id,period_id,opening_title,is_archived)
 SELECT p.program_id,ap.academic_year_id,ap.period_id,'Archived Opening',true FROM scholarship_program p CROSS JOIN academic_period ap LIMIT 1;
 INSERT INTO student_master_records(student_number,pdm_id,first_name,last_name,course_id,year_level,email_address)
 SELECT 'REG-'||lpad(i::text,4,'0'),'PDM-'||lpad(i::text,6,'0'),'Registry '||i,'Person',
 (SELECT course_id FROM academic_course ORDER BY course_id LIMIT 1 OFFSET ((i-1)%4)),1,'registry'||i||'@example.invalid' FROM generate_series(1,50) i;
 INSERT INTO students(master_student_id,pdm_id,registrar_student_number,first_name,last_name,course_id,year_level)
 SELECT master_student_id,pdm_id,student_number,first_name,last_name,course_id,year_level FROM student_master_records ORDER BY student_number LIMIT 1;
 INSERT INTO academic_period(academic_year_id,term,is_active) SELECT academic_year_id,'Second Semester',false FROM academic_years;
 INSERT INTO program_openings(program_id,academic_year_id,period_id,opening_title)
 SELECT p.program_id,ap.academic_year_id,ap.period_id,'Other Semester Opening' FROM scholarship_program p CROSS JOIN academic_period ap WHERE ap.term='Second Semester' LIMIT 1;
 INSERT INTO scholarship_program(program_name,is_archived) VALUES('Archived Parent',true);
 INSERT INTO program_openings(program_id,academic_year_id,period_id,opening_title)
 SELECT p.program_id,ap.academic_year_id,ap.period_id,'Unarchived Child Opening' FROM scholarship_program p CROSS JOIN academic_period ap WHERE p.program_name='Archived Parent' LIMIT 1;
 CREATE TABLE general_settings(general_settings_id int PRIMARY KEY,notifications_enabled boolean,updated_at timestamptz DEFAULT now());
 INSERT INTO general_settings VALUES(1,true,now());
 CREATE TABLE notifications(notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),message text,is_read boolean DEFAULT false);
 INSERT INTO notifications(message) VALUES('Existing notification; keep it exactly');
 INSERT INTO applications(student_id,opening_id,application_payload)
 SELECT s.student_id,o.opening_id,'{"original":true}'::jsonb FROM students s CROSS JOIN program_openings o WHERE NOT o.is_archived LIMIT 1;
 -- Reproduce the reported production failure: helper references a missing table.
 CREATE FUNCTION missing_delivery_table() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO public.notification_delivery_attempts(user_id) VALUES(NULL); RETURN NEW; END $$;
 CREATE TRIGGER trg_notifications_application_submitted AFTER INSERT ON applications FOR EACH ROW EXECUTE FUNCTION missing_delivery_table();
 CREATE TRIGGER trg_notifications_application_status_changed AFTER UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION missing_delivery_table();
 ALTER TABLE applications DISABLE TRIGGER trg_notifications_application_status_changed;
 CREATE FUNCTION mutate_original_queue() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 UPDATE applications SET selection_status='Changed unexpectedly' WHERE application_payload->>'original'='true'; RETURN NEW; END $$;
 CREATE TRIGGER trg_applications_fcfs AFTER INSERT ON applications FOR EACH ROW EXECUTE FUNCTION mutate_original_queue();
 CREATE TRIGGER trg_endorsement_slips_fcfs AFTER INSERT OR UPDATE ON endorsement_slips FOR EACH ROW EXECUTE FUNCTION mutate_original_queue();
 CREATE TRIGGER trg_notifications_endorsement_slip_changed AFTER INSERT OR UPDATE ON endorsement_slips FOR EACH ROW EXECUTE FUNCTION missing_delivery_table();
 ALTER TABLE endorsement_slips ENABLE ALWAYS TRIGGER trg_notifications_endorsement_slip_changed;
 CREATE TRIGGER trg_program_openings_slots_fcfs AFTER UPDATE ON program_openings FOR EACH ROW EXECUTE FUNCTION mutate_original_queue();
 ALTER TABLE program_openings ENABLE REPLICA TRIGGER trg_program_openings_slots_fcfs;
 `);
 return db;
}
(async()=>{
 let db=await fixture();
 try{
  const before=(await db.query('SELECT * FROM students')).rows;
  const registry=(await db.query('SELECT * FROM student_master_records ORDER BY master_student_id')).rows;
  const originals=async()=>({
   applications:(await db.query("SELECT * FROM applications WHERE application_payload->>'original'='true'")).rows,
   notifications:(await db.query('SELECT * FROM notifications ORDER BY notification_id')).rows,
   settings:(await db.query('SELECT * FROM general_settings')).rows,
   triggers:(await db.query("SELECT tgrelid,tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgrelid,tgname")).rows,
  });
  const preserved=await originals();
  await assert.rejects(db.query("INSERT INTO applications(student_id,opening_id) SELECT s.student_id,o.opening_id FROM students s CROSS JOIN program_openings o LIMIT 1"),/notification_delivery_attempts/);
  await db.exec(seed);
  const counts=(await db.query("SELECT opening_id,count(*)::int n FROM applications WHERE application_payload ? 'seed_batch' GROUP BY opening_id")).rows;
  assert.equal(counts.length,6);assert(counts.every(row=>row.n===5));
  assert.equal((await db.query("SELECT count(*)::int n FROM students WHERE scholarship_status='Active' AND is_active_scholar")).rows[0].n,30);
  assert.equal((await db.query("SELECT count(*)::int n FROM endorsement_slips WHERE overall_status='completed'")).rows[0].n,30);
  assert.equal((await db.query('SELECT count(*)::int n FROM students s JOIN applications a ON a.application_id=s.current_application_id WHERE a.student_id=s.student_id')).rows[0].n,30);
  assert.deepEqual((await db.query('SELECT * FROM students WHERE student_id=$1',[before[0].student_id])).rows,before);
  assert.deepEqual((await db.query('SELECT * FROM student_master_records ORDER BY master_student_id')).rows,registry);
  assert.equal((await db.query("SELECT count(*)::int n FROM students s JOIN student_master_records m USING(master_student_id) WHERE s.is_active_scholar AND (s.first_name<>m.first_name OR s.pdm_id<>m.pdm_id OR s.email_address IS DISTINCT FROM m.email_address)")).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM program_openings WHERE NOT is_archived AND filled_slots=5 AND allocated_slots=15')).rows[0].n,6);
  assert.deepEqual(await originals(),preserved);
  const snapshot=(await db.query('SELECT * FROM students ORDER BY student_id')).rows;
  await db.exec(seed);
  assert.deepEqual((await db.query('SELECT * FROM students ORDER BY student_id')).rows,snapshot);
  assert.equal((await db.query('SELECT count(*)::int n FROM applications')).rows[0].n,31);
  assert.deepEqual(await originals(),preserved);
 }finally{await db.close()}
 for(const failure of ['capacity','registry','partial','preservation']){
  db=await fixture();try{
   if(failure==='capacity')await db.exec("UPDATE program_openings SET allocated_slots=4 WHERE opening_title='Kaizen Opening';");
   if(failure==='registry')await db.exec('UPDATE student_master_records SET is_active=false;');
   if(failure==='partial')await db.exec("UPDATE applications SET application_payload='{\"seed_batch\":\"registry-scholars-five-per-opening-v1\"}'::jsonb WHERE application_payload->>'original'='true';");
   if(failure==='preservation')await db.exec("CREATE FUNCTION touch_existing_student() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE students SET first_name='Unexpected mutation' WHERE current_application_id IS NULL AND student_id<>NEW.student_id; RETURN NEW; END $$; CREATE TRIGGER unexpected_side_effect AFTER INSERT ON students FOR EACH ROW EXECUTE FUNCTION touch_existing_student();");
   const initial=(await db.query('SELECT count(*)::int n FROM students')).rows[0].n;
   const triggerStates=(await db.query("SELECT tgrelid,tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgrelid,tgname")).rows;
   const originalStudents=(await db.query('SELECT * FROM students ORDER BY student_id')).rows;
   await assert.rejects(db.exec(seed),/slots|unused imported|incomplete|Existing students records changed/);
   await db.exec('ROLLBACK');
   assert.equal((await db.query('SELECT count(*)::int n FROM students')).rows[0].n,initial);
   assert.deepEqual((await db.query('SELECT * FROM students ORDER BY student_id')).rows,originalStudents);
   assert.deepEqual((await db.query("SELECT tgrelid,tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgrelid,tgname")).rows,triggerStates);
  }finally{await db.close()}
 }
 console.log('PASS: missing notification table reproduced and bypassed only during seed; original students, applications, notifications and settings preserved; exact O/D/A/R trigger states restored on success/failure; unexpected mutations roll back; 5 scholars per opening, 30 total, capacity guards and repeat safety.');
})().catch(error=>{console.error(error);process.exitCode=1});
