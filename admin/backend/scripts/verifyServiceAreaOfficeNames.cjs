'use strict';
// Offline only. No connection to Supabase or the application database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
async function main() {
    const db = await PGlite.create();
    try {
        await db.exec(`CREATE TABLE ref_offices(office_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),office_name text,is_institutional boolean DEFAULT true,is_active boolean DEFAULT true);
            CREATE TABLE ro_departments(department_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_name text,is_active boolean DEFAULT true,updated_at timestamptz DEFAULT now());
            CREATE TABLE institutional_service_area_links(department_id uuid PRIMARY KEY REFERENCES ro_departments,office_id uuid UNIQUE REFERENCES ref_offices);
            CREATE TABLE existing_service_records(department_id uuid REFERENCES ro_departments,pic text,logged_hours integer);
            INSERT INTO ref_offices(office_name) VALUES('College of Computer Studies (CCS)'),('College of Hospitality and Tourism Management (CHTM)'),('Student Welfare and Development Office'),('Guidance and Counseling Office'),('Office of Program Head Teacher Education Program'),('Office of Subject Area Coordinators'),('NSTP Office');
            INSERT INTO ro_departments(department_name) VALUES('CCS Office'),('CHTM Office'),('Student Disciplinary Office'),('Independent Library'),('Guidance Counseling Office'),('Educ Office'),('Subject Area Coordinator Office'),('NSTP Office');
            UPDATE ro_departments SET is_active=false WHERE department_name='NSTP Office';
            INSERT INTO existing_service_records SELECT department_id,'Existing PIC',8 FROM ro_departments;`);
        const areaSnapshot = (await db.query('SELECT department_id,is_active FROM ro_departments ORDER BY department_id')).rows;
        const before = (await db.query('SELECT * FROM existing_service_records ORDER BY department_id')).rows;
        const migration = fs.readFileSync(path.resolve(__dirname,'../../../supabase/migrations/20261022095000_reconcile_service_area_office_names.sql'),'utf8');
        await db.exec(migration);
        await db.exec(migration);
        assert.equal((await db.query('SELECT * FROM institutional_service_area_links')).rows.length,7);
        assert.deepEqual((await db.query('SELECT * FROM existing_service_records ORDER BY department_id')).rows,before);
        assert.equal((await db.query('SELECT * FROM ro_departments')).rows.length,8);
        assert.deepEqual((await db.query('SELECT department_id,is_active FROM ro_departments ORDER BY department_id')).rows,areaSnapshot);
        assert.equal((await db.query('SELECT * FROM institutional_service_area_links l JOIN ref_offices o USING(office_id) JOIN ro_departments a USING(department_id) WHERE o.office_name<>a.department_name')).rows.length,0);
        await db.exec(`DELETE FROM institutional_service_area_links;
            INSERT INTO institutional_service_area_links SELECT a.department_id,o.office_id FROM ro_departments a CROSS JOIN ref_offices o
            WHERE a.department_name='Independent Library' AND o.office_name='College of Hospitality and Tourism Management (CHTM)';`);
        await assert.rejects(db.exec(migration),/Conflicting link/);
        await db.exec('ROLLBACK');
        assert.equal((await db.query('SELECT * FROM institutional_service_area_links')).rows.length,1);
        // A second area with an old name must abort instead of merging records.
        await db.exec("DELETE FROM institutional_service_area_links; INSERT INTO ro_departments(department_name) VALUES('CCS Office');");
        await assert.rejects(db.exec(migration),/duplicate records/);
        await db.exec('ROLLBACK');
        assert.equal((await db.query('SELECT * FROM institutional_service_area_links')).rows.length,0);
        console.log('PASS seven office links and canonical names, inactive NSTP preserved, duplicate rejection; manual reconciliation: repeat-safe, preserves service records/PICs/IDs, leaves independent areas, rolls back the entire batch on conflict');
    } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });

