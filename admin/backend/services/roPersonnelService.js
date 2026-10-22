'use strict';
const db = require('../config/db');
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const fail = (statusCode,message) => { throw Object.assign(new Error(message),{statusCode}); };
async function setPersonnelInTransaction(areaId,body={},actorId=null,client,options={}) {
    if (!uuid(areaId)) fail(400,'Select a valid Community Service Area.');
    let ids = body.user_ids ?? (body.user_id || body.userId ? [body.user_id || body.userId] : []);
    if (!Array.isArray(ids) || ids.length>100 || !ids.every(uuid) || new Set(ids).size!==ids.length) fail(400,'Select unique, valid Personnel-In-Charge accounts.');
    const expected=body.expected_user_ids;
    if (expected!==undefined && (!Array.isArray(expected) || !expected.every(uuid) || new Set(expected).size!==expected.length)) fail(400,'Invalid assignment snapshot. Refresh and try again.');
    // Serialize roster changes across areas, including assignments of previously unassigned accounts.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('smartpdm:pic-rosters'))");
    const requestedIds=[...ids];
        const area=(await client.query('SELECT department_id,is_active FROM public.ro_departments WHERE department_id=$1 FOR UPDATE',[areaId])).rows[0];
        if(!area) fail(404,'Community Service Area not found.');
        if(!area.is_active) fail(409,'Activate this area before assigning Personnel-In-Charge.');
        const current=(await client.query('SELECT coordinator_assignment_id,user_id FROM public.ro_area_coordinators WHERE ro_area_id=$1 AND is_active=true ORDER BY user_id FOR UPDATE',[areaId])).rows;
        if(options.add) ids=[...new Set([...current.map(person=>person.user_id),...ids])];
        if(!Object.hasOwn(body,'user_ids') && current.length>1) fail(409,'Use the multiple Personnel-In-Charge selection to update this area.');
        if(expected && [...expected].sort().join()!==current.map(r=>r.user_id).sort().join()) fail(409,'Personnel assignments changed. Reopen the dialog before saving.');
        if(ids.length>1) {
            const ready=await client.query("SELECT to_regclass('public.uq_ro_area_active_personnel') IS NOT NULL AS ready");
            if(!ready.rows[0]?.ready) fail(503,'Apply the multiple Personnel-In-Charge migration before assigning several people.');
        }
        if(!ids.length) {
            const work=await client.query("SELECT 1 FROM public.ro_placements rp JOIN public.return_of_obligations ro ON ro.ro_id=rp.ro_id WHERE rp.ro_area_id=$1 AND rp.placement_status IN ('Pending','Approved') AND COALESCE(ro.ro_status,'')<>'Cleared' LIMIT 1",[areaId]);
            if(work.rowCount) fail(409,'Keep at least one Personnel-In-Charge while this area has pending or approved placements.');
        }
        const removed=current.filter(person=>!ids.includes(person.user_id));
        if(removed.length) {
            const work=await client.query("SELECT 1 FROM public.ro_placements rp JOIN public.return_of_obligations ro ON ro.ro_id=rp.ro_id WHERE rp.coordinator_assignment_id=ANY($1::uuid[]) AND rp.placement_status IN ('Pending','Approved') AND COALESCE(ro.ro_status,'')<>'Cleared' LIMIT 1",[removed.map(person=>person.coordinator_assignment_id)]);
            if(work.rowCount) fail(409,'This person has active scholar assignments. Finish or reassign their scholars before removing PIC access.');
            const requests=await client.query("SELECT 1 FROM public.ro_scholar_requests WHERE coordinator_assignment_id=ANY($1::uuid[]) AND request_status IN ('Pending','Acknowledged') LIMIT 1",[removed.map(person=>person.coordinator_assignment_id)]);
            if(requests.rowCount) fail(409,"Resolve this person's pending scholar requests before removing PIC access.");
        }
        const profiles=ids.length ? (await client.query(
            'SELECT ap.user_id,ap.office_id,ap.position,u.role AS user_role FROM public.admin_profiles ap JOIN public.users u ON u.user_id=ap.user_id WHERE ap.user_id=ANY($1::uuid[]) AND COALESCE(ap.is_archived,false)=false FOR UPDATE OF ap',[ids])).rows : [];
        if(profiles.length!==ids.length) fail(400,'Select active accounts.');
        if(options.officeId && profiles.some(person=>requestedIds.includes(person.user_id) && person.office_id!==options.officeId)) fail(400,'Select only accounts assigned to this office.');
        const conflicts=ids.length ? await client.query('SELECT rac.user_id,d.department_name FROM public.ro_area_coordinators rac JOIN public.ro_departments d ON d.department_id=rac.ro_area_id WHERE rac.user_id=ANY($1::uuid[]) AND rac.is_active=true AND rac.ro_area_id<>$2 ORDER BY d.department_name',[ids,areaId]) : {rows:[]};
        if(conflicts.rows.length) fail(409,'A selected person is already assigned to '+conflicts.rows[0].department_name+'. Unassign them there before assigning another area.');
        // Retain old assignment rows and placement routing references as historical records.
        await client.query('UPDATE public.ro_area_coordinators SET is_active=false,archived_at=now(),updated_at=now() WHERE ro_area_id=$1 AND is_active=true AND NOT(user_id=ANY($2::uuid[]))',[areaId,ids]);
        for(const id of ids) {
            if(current.some(row=>row.user_id===id)) continue;
            const previous=(await client.query('SELECT coordinator_assignment_id FROM public.ro_area_coordinators WHERE ro_area_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 1',[areaId,id])).rows[0];
            if(previous) await client.query('UPDATE public.ro_area_coordinators SET is_active=true,archived_at=NULL,assigned_by_user_id=$2,assigned_at=now(),updated_at=now() WHERE coordinator_assignment_id=$1',[previous.coordinator_assignment_id,actorId]);
            else await client.query('INSERT INTO public.ro_area_coordinators(ro_area_id,user_id,assigned_by_user_id) VALUES($1,$2,$3)',[areaId,id,actorId]);
        }
        return {message:'Personnel-In-Charge assignments updated.',user_ids:ids,previous_user_ids:current.map(row=>row.user_id)};
}

async function setPersonnel(areaId,body={},actorId=null,pool=db) {
    const client=await pool.connect();
    try {
        await client.query('BEGIN');
        const result=await setPersonnelInTransaction(areaId,body,actorId,client);
        await client.query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
async function candidates(pool=db,officeId=null) {
    if(officeId && !uuid(officeId)) fail(400,'Select a valid office.');
    const result=await pool.query("SELECT ap.user_id,ap.office_id,concat_ws(' ',ap.first_name,ap.last_name) AS name,COALESCE(ap.position,'') AS position,COALESCE((SELECT json_agg(json_build_object('department_id',rac.ro_area_id,'department_name',d.department_name)) FROM public.ro_area_coordinators rac JOIN public.ro_departments d ON d.department_id=rac.ro_area_id WHERE rac.user_id=ap.user_id AND rac.is_active=true),'[]'::json) AS active_areas FROM public.admin_profiles ap JOIN public.users u ON u.user_id=ap.user_id WHERE COALESCE(ap.is_archived,false)=false AND ($1::uuid IS NULL OR ap.office_id=$1) ORDER BY ap.first_name,ap.last_name,ap.user_id",[officeId]);
    return result.rows;
}
async function createArea(body={},actorId=null,pool=db) {
    const name=String(body.department_name || body.departmentName || '').trim().replace(/\s+/g,' ');
    if(name.length<2 || name.length>160) fail(400,'Enter an area name of 2 to 160 characters.');
    if(!Array.isArray(body.user_ids) || !body.user_ids.length) fail(400,'Assign at least one Personnel-In-Charge.');
    const client=await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query("SELECT pg_advisory_xact_lock(hashtext('smartpdm:service-area-create'))");
        const existing=await client.query('SELECT department_id FROM public.ro_departments WHERE lower(btrim(department_name))=lower($1)',[name]);
        if(existing.rowCount) fail(409,'This Community Service Area already exists. Check inactive areas too.');
        const area=(await client.query('INSERT INTO public.ro_departments(department_name,is_active) VALUES($1,true) RETURNING department_id,department_name,is_active,created_at,updated_at',[name])).rows[0];
        const assignment=await setPersonnelInTransaction(area.department_id,{user_ids:body.user_ids},actorId,client);
        await client.query('COMMIT');return {message:'Community Service Area created and Personnel-In-Charge assigned.',department:area,...{user_ids:assignment.user_ids}};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
module.exports={setPersonnel,setPersonnelInTransaction,candidates,createArea};
