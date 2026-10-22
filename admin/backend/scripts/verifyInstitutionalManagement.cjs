'use strict';
// Offline PostgreSQL verification. Never imports the project's database configuration.
// Supply PGLITE_MODULE pointing to a temporary @electric-sql/pglite installation.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const ROOT = path.resolve(__dirname, '../../..');

async function main() {
    const pg = await PGlite.create();
    try {
        // Relevant existing schema only, with real foreign keys and uniqueness.
        await pg.exec(`
            CREATE ROLE anon; CREATE ROLE authenticated;
            CREATE TABLE users(user_id uuid PRIMARY KEY DEFAULT gen_random_uuid());
            CREATE TABLE ref_offices(office_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),office_code text UNIQUE,office_name text UNIQUE,is_active boolean DEFAULT true);
            CREATE TABLE ref_staff_positions(position_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),position_name text UNIQUE,is_active boolean DEFAULT true);
            CREATE TABLE admin_profiles(user_id uuid UNIQUE REFERENCES users(user_id),first_name text,last_name text,department text,position text,position_id uuid REFERENCES ref_staff_positions(position_id),office_id uuid REFERENCES ref_offices(office_id),is_archived boolean DEFAULT false,updated_at timestamptz DEFAULT now());
            CREATE TABLE academic_course(course_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),course_code text UNIQUE,course_name text,office_id uuid REFERENCES ref_offices(office_id),is_archived boolean DEFAULT false,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
            CREATE TABLE rbac_roles(role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),role_code text UNIQUE,role_name text,role_scope text,is_active boolean DEFAULT true);
            CREATE TABLE rbac_staff_role_catalog(role_id uuid REFERENCES rbac_roles(role_id),app_role_code text,default_position text,db_user_role text,is_active boolean DEFAULT true);
            CREATE TABLE rbac_user_roles(user_id uuid REFERENCES users(user_id),role_id uuid REFERENCES rbac_roles(role_id),is_active boolean DEFAULT true,assigned_at timestamptz DEFAULT now(),PRIMARY KEY(user_id,role_id));
            CREATE TABLE rbac_staff_role_offices(office_id uuid REFERENCES ref_offices(office_id),app_role_code text);
            CREATE TABLE rbac_role_permissions(role_id uuid REFERENCES rbac_roles(role_id),permission_code text);
            -- Office updates also synchronize existing custom-role course scopes.
            CREATE TABLE workspace_role_office_scopes(role_id uuid REFERENCES rbac_roles,office_id uuid REFERENCES ref_offices,PRIMARY KEY(role_id,office_id));
            CREATE TABLE workspace_user_office_scopes(user_id uuid REFERENCES users,role_id uuid REFERENCES rbac_roles,office_id uuid REFERENCES ref_offices,PRIMARY KEY(user_id,role_id,office_id));
            CREATE TABLE workspace_role_course_scopes(role_id uuid REFERENCES rbac_roles,course_id uuid REFERENCES academic_course,PRIMARY KEY(role_id,course_id));
            CREATE TABLE workspace_user_course_scopes(user_id uuid REFERENCES users,role_id uuid REFERENCES rbac_roles,course_id uuid REFERENCES academic_course,PRIMARY KEY(user_id,role_id,course_id));
            CREATE TABLE ro_departments(department_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_name text UNIQUE,is_active boolean DEFAULT true);
            CREATE TABLE ro_department_courses(department_id uuid REFERENCES ro_departments(department_id),course_id uuid REFERENCES academic_course(course_id));
            CREATE TABLE ro_area_coordinators(department_id uuid REFERENCES ro_departments(department_id),user_id uuid REFERENCES users(user_id),ro_area_id uuid GENERATED ALWAYS AS (department_id) STORED,is_active boolean DEFAULT true);
            CREATE TABLE program_director_course_assignments(pd_user_id uuid REFERENCES users(user_id),course_id uuid REFERENCES academic_course(course_id),is_active boolean DEFAULT true);
            CREATE TABLE students(student_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),course_id uuid REFERENCES academic_course(course_id));
            CREATE TABLE audit_logs(log_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES users(user_id),action_taken text,module text,entity_type text,entity_id text,description text,metadata jsonb,actor_role text,actor_email text,"timestamp" timestamptz DEFAULT now());
            INSERT INTO ref_offices(office_code,office_name) VALUES('CCS','Office of the College of Computer Studies'),('CLINIC','Clinic');
            INSERT INTO ref_staff_positions(position_name) VALUES('Program Director');
            INSERT INTO rbac_roles(role_code,role_name,role_scope) VALUES('pd','Program Director','staff');
            INSERT INTO ro_departments(department_name) VALUES('Clinic');
            INSERT INTO academic_course(course_code,course_name,office_id) SELECT 'BSIT','Information Technology',office_id FROM ref_offices WHERE office_code='CCS';
            INSERT INTO academic_course(course_code,course_name) VALUES('BSCS','Computer Science');
            INSERT INTO students(course_id) SELECT course_id FROM academic_course WHERE course_code='BSIT';
        `);
        const migrations = ['20261020145715_institutional_management.sql', '20261020153228_institutional_office_reconciliation.sql', '20261020155906_office_dean_applicability.sql','20261020160544_official_office_display_names.sql','20261020162255_official_office_account_catalog.sql'];
        for (const file of migrations) await pg.exec(fs.readFileSync(path.join(ROOT, 'supabase/migrations', file), 'utf8'));
        for (const file of migrations) await pg.exec(fs.readFileSync(path.join(ROOT, 'supabase/migrations', file), 'utf8'));
        await pg.exec('ALTER TABLE public.ref_offices DROP COLUMN supports_dean');
        await pg.exec(fs.readFileSync(path.join(ROOT,'supabase/migrations','20261020160544_official_office_display_names.sql'),'utf8'));
        console.log('PASS office-name migration recovers when supports_dean was not added previously');
        const one = async (sql, args = []) => (await pg.query(sql, args)).rows[0];
        assert.equal((await one('SELECT count(*)::int AS count FROM ref_offices WHERE supports_dean=true')).count,4);
        assert.equal((await one("SELECT supports_dean FROM ref_offices WHERE office_code='CLINIC'")).supports_dean,false);
        console.log('PASS Dean applicability is limited to the four configured academic offices');
        const ccs = await one("SELECT * FROM ref_offices WHERE office_code='CCS'");
        assert.equal(ccs.office_name, 'College of Computer Studies (CCS)');
        assert.equal((await one("SELECT count(*)::int AS count FROM ref_offices WHERE office_code='ORD'")).count, 1);
        assert.equal((await one("SELECT count(*)::int AS count FROM ref_offices WHERE office_code='CLINIC'")).count, 1);
        assert.equal((await one("SELECT count(*)::int AS count FROM rbac_role_permissions p JOIN rbac_roles r USING(role_id) WHERE r.role_code='dean'")).count, 0);
        console.log('PASS migrations execute twice; existing offices preserved; missing official offices added; Dean has zero default permissions');

        const dean = (await one('INSERT INTO users DEFAULT VALUES RETURNING user_id')).user_id;
        const director = (await one('INSERT INTO users DEFAULT VALUES RETURNING user_id')).user_id;
        for (const [id, first, position] of [[dean,'Eligible Dean','Dean'], [director,'Course Director','Program Director']]) {
            await pg.query(`INSERT INTO admin_profiles(user_id,first_name,last_name,position,position_id,office_id)
                SELECT $1,$2,'Account',$3,position_id,$4 FROM ref_staff_positions WHERE position_name=$3`, [id, first, position, ccs.office_id]);
            await pg.query("INSERT INTO rbac_user_roles(user_id,role_id) SELECT $1,role_id FROM rbac_roles WHERE role_code='pd'", [id]);
        }
        const it = await one("SELECT course_id FROM academic_course WHERE course_code='BSIT'");
        const cs = await one("SELECT course_id FROM academic_course WHERE course_code='BSCS'");
        await pg.query('INSERT INTO program_director_course_assignments(pd_user_id,course_id) VALUES($1,$2)', [director,it.course_id]);
        const area = await one("SELECT department_id FROM ro_departments WHERE department_name='Clinic'");
        await pg.query('INSERT INTO ro_area_coordinators(department_id,user_id) VALUES($1,$2)', [area.department_id,director]);
        await pg.query('INSERT INTO ro_department_courses VALUES($1,$2)', [area.department_id,cs.course_id]);
        const query = async (sql, args) => { const result = await pg.query(sql,args); return { ...result, rowCount: result.rows.length || result.affectedRows || 0 }; };
        const pool = { query, connect: async () => ({ query, release() {} }) };
        const originalLoad = Module._load;
        Module._load = function(request) { if(request === '../config/db') return pool; return originalLoad.apply(this,arguments); };
        let offices, courses, community, serviceEligibility, accountOffices;
        try {
            offices = require('../services/officeService'); courses = require('../services/courseService'); community = require('../services/institutionalCommunityService'); serviceEligibility = require('../services/roCourseEligibilityService'); accountOffices = require('../services/accountOfficeService');
        } finally { Module._load = originalLoad; }
        const officialChoices = await accountOffices.listAccountOffices(pool);
        assert.equal(officialChoices.length,10);
        assert.equal((await offices.listOffices(pool)).offices.length,10);
        assert.ok(!officialChoices.some(office => office.office_name==='Clinic'));
        await assert.rejects(accountOffices.requireAccountOffice('Clinic',pool),{statusCode:400});
        for (const office of officialChoices) assert.equal((await accountOffices.requireAccountOffice(office.office_name,pool)).office_id,office.office_id);
        const research = officialChoices.find(office => office.office_code==='ORD');
        await pg.query("UPDATE admin_profiles SET department='Clinic' WHERE user_id=$1",[director]);
        await accountOffices.setAccountOffice(pool,director,research);
        assert.equal((await one('SELECT department FROM admin_profiles WHERE user_id=$1',[director])).department,'Clinic');
        assert.equal((await one('SELECT office_id FROM admin_profiles WHERE user_id=$1',[director])).office_id,research.office_id);
        await accountOffices.setAccountOffice(pool,director,ccs);
        assert.equal((await one("SELECT is_active FROM ref_offices WHERE office_code='CLINIC'")).is_active,true);
        console.log('PASS one catalog supplies exactly ten offices; all ten validate for accounts; legacy locations excluded without breaking RO area or personnel references');
        const scholar = await one('SELECT student_id FROM students LIMIT 1');
        await serviceEligibility.assertEligible({studentId:scholar.student_id,departmentId:area.department_id,client:pool});
        console.log('PASS Community Service assignment ignores historical course restrictions');
        const body = { office_name: ccs.office_name, office_code: 'CCS', description: 'Academic office', course_ids: [it.course_id,cs.course_id], leaders: { dean }, confirm_dean_change: true };
        await offices.saveOffice(ccs.office_id,body,pool,dean);
        assert.equal((await offices.listOffices(pool)).programDirectors[0].course_code, 'BSIT');
        assert.equal((await one("SELECT ur.is_active FROM rbac_user_roles ur JOIN rbac_roles r USING(role_id) WHERE user_id=$1 AND role_code='dean'", [dean])).is_active,true);
        await pg.query('UPDATE admin_profiles SET is_archived=true WHERE user_id=$1',[dean]);
        await pg.query('UPDATE rbac_user_roles SET is_active=false WHERE user_id=$1',[dean]);
        const archivedIdentity = await one(`SELECT COALESCE((SELECT r.role_code FROM rbac_user_roles ur JOIN rbac_roles r USING(role_id)
            WHERE ur.user_id=a.user_id AND ur.is_active=true AND r.role_code<>'dean' LIMIT 1),to_jsonb(a)->>'institutional_primary_role') AS role
            FROM admin_profiles a WHERE a.user_id=$1`,[dean]);
        assert.equal(archivedIdentity.role,'pd');
        await pg.query('UPDATE admin_profiles SET is_archived=false WHERE user_id=$1',[dean]);
        await pg.query("UPDATE rbac_user_roles SET is_active=true WHERE user_id=$1 AND role_id=(SELECT role_id FROM rbac_roles WHERE role_code='pd')",[dean]);
        await offices.saveOffice(ccs.office_id,body,pool,dean);
        console.log('PASS archived Dean retains the original PD portal identity');
        await assert.rejects(pg.query("INSERT INTO office_academic_leaders(office_id,leadership_kind,user_id) VALUES($1,'dean',$2)", [ccs.office_id,director]), error => error.code==='23505');
        await assert.rejects(offices.saveOffice(ccs.office_id,{ ...body,leaders:{dean:null},confirm_dean_change:false },pool), {statusCode:409});
        const other = await offices.saveOffice(null,{office_name:'Test Academic Office',office_code:'TEST',course_ids:[],leaders:{}},pool);
        await assert.rejects(courses.updateCourse(it.course_id,{course_code:'BSIT',course_name:'Information Technology',office_id:other.office_id}), {statusCode:409});
        await courses.updateCourse(it.course_id,{course_code:'BSIT',course_name:'Information Technology',office_id:other.office_id,previous_office_id:ccs.office_id,confirm_office_change:true});
        assert.equal((await offices.listOffices(pool)).programDirectors[0].office_id,other.office_id);
        await community.setLink(area.department_id,ccs.office_id,null,pool,dean);
        await assert.rejects(community.setLink(area.department_id,null,null,pool), {statusCode:409});
        await community.setLink(area.department_id,null,ccs.office_id,pool,dean);
        const promoted = await community.useOfficeAsArea(other.office_id,null,pool,dean);
        const repeated = await community.useOfficeAsArea(other.office_id,null,pool,dean);
        assert.equal(promoted.department_id,repeated.department_id);
        assert.equal(repeated.already_linked,true);
        assert.equal((await one('SELECT count(*)::int AS count FROM ro_departments WHERE department_name=$1',['Test Academic Office'])).count,1);
        await community.useOfficeAsArea(ccs.office_id,area.department_id,pool,dean);
        assert.equal((await one('SELECT count(*)::int AS count FROM ro_departments')).count,2);
        console.log('PASS office-to-area creation/linking is repeat-safe and reuses existing areas without course restrictions');
        assert.equal((await one('SELECT count(*)::int AS count FROM students')).count,1);
        assert.equal((await one('SELECT count(*)::int AS count FROM program_director_course_assignments WHERE is_active')).count,1);
        assert.equal((await one('SELECT count(*)::int AS count FROM ro_department_courses')).count,1);
        assert.equal((await one('SELECT count(*)::int AS count FROM ro_area_coordinators')).count,1);
        console.log('PASS real service SQL: course ownership, reassignment confirmation, Dean uniqueness/role grant, derived PD list and independent Community Service links');
        await offices.saveOffice(ccs.office_id,{ ...body,course_ids:[cs.course_id],leaders:{dean:null} },pool,dean);
        assert.equal((await one("SELECT ur.is_active FROM rbac_user_roles ur JOIN rbac_roles r USING(role_id) WHERE user_id=$1 AND role_code='dean'",[dean])).is_active,false);
        await offices.setOfficeStatus(other.office_id,false,pool,dean);
        await offices.setOfficeStatus(other.office_id,true,pool,dean);
        assert.equal((await one('SELECT office_id FROM academic_course WHERE course_id=$1',[it.course_id])).office_id,other.office_id);
        await pg.exec(`CREATE FUNCTION reject_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'audit test failure'; END;$$;
            CREATE TRIGGER reject_test_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_test_audit();`);
        await assert.rejects(offices.saveOffice(null,{office_name:'Rolled back office',office_code:'ROLLBACK',course_ids:[],leaders:{}},pool));
        assert.equal((await one("SELECT count(*)::int AS count FROM ref_offices WHERE office_code='ROLLBACK'")).count,0);
        await pg.exec('DROP TRIGGER reject_test_audit ON audit_logs;');
        // Reproduce the live split: EDUC owns courses, the older office owns staff.
        await pg.exec(`DELETE FROM ref_offices WHERE office_code='TEP';
            INSERT INTO ref_offices(office_id,office_code,office_name,is_active) VALUES
              ('5ae7ef24-9d15-40d7-8a33-e3372d01da0a','EDUC','Office of Program Head Teacher Education Program',true),
              ('e26592d1-1d9c-4444-bdc4-96899b46d156',NULL,'Office of the Program Head - Teacher Education Program',true);
            INSERT INTO academic_course(course_code,course_name,office_id) VALUES
              ('BECED','Teacher Education','5ae7ef24-9d15-40d7-8a33-e3372d01da0a'),
              ('BTLED','Technology Education','5ae7ef24-9d15-40d7-8a33-e3372d01da0a');
            INSERT INTO rbac_staff_role_offices(app_role_code,office_id) VALUES('pd','e26592d1-1d9c-4444-bdc4-96899b46d156');`);
        const teacherUsers=[];
        for (let i=0;i<2;i++) {
            const user=(await one('INSERT INTO users DEFAULT VALUES RETURNING user_id')).user_id;
            teacherUsers.push(user);
            await pg.query("INSERT INTO admin_profiles(user_id,first_name,department,office_id) VALUES($1,'Teacher staff','Office of the Program Head - Teacher Education Program','e26592d1-1d9c-4444-bdc4-96899b46d156')",[user]);
        }
        const teacherCourses=(await pg.query("SELECT course_id FROM academic_course WHERE office_id='5ae7ef24-9d15-40d7-8a33-e3372d01da0a' ORDER BY course_code")).rows;
        await pg.query('INSERT INTO program_director_course_assignments(pd_user_id,course_id) VALUES($1,$2)',[teacherUsers[0],teacherCourses[0].course_id]);
        const nameMigration=fs.readFileSync(path.join(ROOT,'supabase/migrations',migrations[3]),'utf8');
        await assert.rejects(pg.exec(nameMigration),/Ambiguous office Office of Program Head Teacher Education Program/);
        await pg.exec('ROLLBACK');
        const repair=fs.readFileSync(path.join(ROOT,'admin/backend/sql/reconcile_teacher_education_office.sql'),'utf8');
        await pg.exec('ALTER TABLE ref_offices DROP COLUMN supports_dean');
        await pg.exec(repair);
        await pg.exec(repair);
        await pg.exec(nameMigration);
        assert.equal((await one("SELECT count(*)::int AS count FROM admin_profiles WHERE office_id='5ae7ef24-9d15-40d7-8a33-e3372d01da0a'")).count,2);
        assert.equal((await one("SELECT is_active FROM ref_offices WHERE office_id='e26592d1-1d9c-4444-bdc4-96899b46d156'")).is_active,false);
        assert.deepEqual((await pg.query("SELECT course_id FROM academic_course WHERE office_id='5ae7ef24-9d15-40d7-8a33-e3372d01da0a' ORDER BY course_code")).rows,teacherCourses);
        assert.equal((await one("SELECT count(*)::int AS count FROM rbac_staff_role_offices WHERE app_role_code='pd' AND office_id='5ae7ef24-9d15-40d7-8a33-e3372d01da0a'")).count,1);
        assert.equal((await one('SELECT count(*)::int AS count FROM program_director_course_assignments WHERE pd_user_id=$1',[teacherUsers[0]])).count,1);
        console.log('PASS exact Teacher Education split reproduced; repair preserves courses, accounts and PD assignments; repeat repair and office-name migration succeed');
        await pg.query("INSERT INTO ref_offices(office_name) VALUES('College of Computer Studies')");
        await assert.rejects(pg.exec(fs.readFileSync(path.join(ROOT,'supabase/migrations',migrations[1]),'utf8')), /Multiple existing offices match/);
        await pg.exec('ROLLBACK');
        console.log('PASS Dean removal, archive/restore preservation, audit failure rollback, and ambiguous reconciliation rejection');
        // Exercise standalone Dean account mapping and references against real SQL.
        const accountSource=fs.readFileSync(path.join(ROOT,'admin/backend/services/accountService.js'),'utf8');
        const fallbackSql=accountSource.split('const custom = await client.query')[1].split(String.fromCharCode(96))[1];
        assert.deepEqual((await pg.query(fallbackSql,['dean'])).rows[0],{dbRole:'Admin',position:'Dean',department:'Role-Based Access'});
        await pg.query("INSERT INTO rbac_roles(role_code,role_name,role_scope) VALUES('scholarship_auditor','Scholarship Auditor','staff')");
        assert.equal((await pg.query(fallbackSql,['scholarship_auditor'])).rows[0].position,'Scholarship Auditor');
        const catalogSource=fs.readFileSync(path.join(ROOT,'admin/backend/routes/accountRoutes.js'),'utf8');
        const catalogSql=catalogSource.split('db.query(')[1].split(String.fromCharCode(96))[1];
        assert.ok((await pg.query(catalogSql)).rows.some(r=>r.value==='scholarship_auditor'));
        const auditor=(await pg.query('INSERT INTO users DEFAULT VALUES RETURNING user_id')).rows[0].user_id;
        await pg.query("INSERT INTO admin_profiles(user_id,first_name,department,position) VALUES($1,'Auditor',$2,'Scholarship Auditor')",[auditor,ccs.office_name]);
        await require('../utils/syncStaffReferences').syncStaffReferences(pool,auditor,{role:'scholarship_auditor',department:ccs.office_name,position:'Scholarship Auditor'});
        const workspaceSource=fs.readFileSync(path.join(ROOT,'admin/backend/routes/workspaceRoutes.js'),'utf8');
        const workspaceSql=workspaceSource.split('db.query(')[1].split(String.fromCharCode(96))[1];
        assert.equal((await pg.query(workspaceSql,[auditor])).rows[0].role_name,'Scholarship Auditor');
        const loginSource=fs.readFileSync(path.join(ROOT,'admin/backend/controllers/authController.js'),'utf8');
        const loginSql=loginSource.split('const customRoleResult = await db.query(')[1].split(String.fromCharCode(96))[1];
        assert.equal((await pg.query(loginSql,[auditor])).rows[0].role_code,'scholarship_auditor');
        assert.equal((await one("SELECT count(*)::int AS count FROM rbac_user_roles ur JOIN rbac_roles r USING(role_id) WHERE user_id=$1 AND role_code='admin'",[auditor])).count,0);
        await pg.query("UPDATE rbac_roles SET is_active=false WHERE role_code='scholarship_auditor'");
        assert.equal((await pg.query(workspaceSql,[auditor])).rows.length,0);
        assert.equal((await pg.query(fallbackSql,['scholarship_auditor'])).rows.length,0);
        assert.ok(!(await pg.query(catalogSql)).rows.some(r=>r.value==='scholarship_auditor'));
        console.log('PASS a newly added role with any code appears in the account catalog and validates; archived roles are excluded');
        const standalone=(await pg.query('INSERT INTO users DEFAULT VALUES RETURNING user_id')).rows[0].user_id;
        await pg.query("INSERT INTO admin_profiles(user_id,first_name,department,position) VALUES($1,'New Dean',$2,'Dean')",[standalone,ccs.office_name]);
        const {syncStaffReferences}=require('../utils/syncStaffReferences');
        for(const archived of [false,true,false]) {
            await syncStaffReferences(pool,standalone,{role:'dean',department:ccs.office_name,position:'Dean',archived});
            const memberships=(await pg.query('SELECT r.role_code,ur.is_active FROM rbac_user_roles ur JOIN rbac_roles r USING(role_id) WHERE user_id=$1',[standalone])).rows;
            assert.equal(memberships.find(r=>r.role_code==='dean').is_active,!archived);
            assert.ok(!memberships.some(r=>r.role_code==='admin'||r.role_code==='pd'));
            assert.equal((await one('SELECT institutional_primary_role FROM admin_profiles WHERE user_id=$1',[standalone])).institutional_primary_role,'dean');
        }
        assert.equal((await one("SELECT count(*)::int AS count FROM rbac_role_permissions p JOIN rbac_roles r USING(role_id) WHERE r.role_code='dean'")).count,0);
        console.log('PASS standalone Dean uses its own role, survives archive/restore and receives no administrator or PD grants');
    } finally { await pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
