'use strict';
// PHASE6D2_SCOPE_V1. Never derive access from client query filters.
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value||''));
const bad = (status,message) => Object.assign(new Error(message),{status});
function ids(value) {
  if (!Array.isArray(value) || value.length > 250 || value.some(v=>!uuid(v))) throw bad(400,'Invalid scope identifiers.');
  const values=[...new Set(value.map(v=>String(v).toLowerCase()))];
  if(values.length!==value.length) throw bad(400,'Duplicate scope identifiers.');
  return values;
}
async function catalog(client) {
 const [offices,courses]=await Promise.all([
  client.query("SELECT office_id,office_name FROM public.ref_offices WHERE is_active=true ORDER BY office_name"),
  client.query("SELECT c.course_id,c.course_name,c.course_code,c.office_id FROM public.academic_course c JOIN public.ref_offices o ON o.office_id=c.office_id AND o.is_active=true WHERE COALESCE(c.is_archived,false)=false ORDER BY c.course_name")
 ]);
 return {offices:offices.rows,courses:courses.rows};
}
async function role(client,roleId) {
 const r=await client.query(`SELECT r.role_id FROM public.rbac_roles r WHERE r.role_id=$1 AND r.role_scope='staff' AND r.is_active=true
  AND NOT EXISTS(SELECT 1 FROM public.rbac_staff_role_catalog c WHERE c.role_id=r.role_id) FOR SHARE OF r`,[roleId]);
 if(r.rowCount!==1)throw bad(403,'An active custom role is required.');
}
async function user(client,userId,roleId) {
 const r=await client.query(`SELECT 1 FROM public.admin_profiles a JOIN public.rbac_user_roles ur ON ur.user_id=a.user_id
   WHERE a.user_id=$1 AND ur.role_id=$2 AND ur.is_active=true AND COALESCE(a.is_archived,false)=false FOR SHARE OF a,ur`,[userId,roleId]);
 if(r.rowCount!==1)throw bad(403,'An active custom-role account assignment is required.');
}
async function validateSelection(client,officeIds,courseIds) {
 const selected=await catalog(client);
 const offices=new Set(selected.offices.map(r=>String(r.office_id)));
 const courses=new Map(selected.courses.map(r=>[String(r.course_id),String(r.office_id)]));
 if(officeIds.some(x=>!offices.has(x))||courseIds.some(x=>!courses.has(x)))throw bad(400,'Inactive or unknown scope selected.');
 if(courseIds.some(x=>!officeIds.includes(courses.get(x))))throw bad(400,'Every selected course must belong to a selected office.');
}
async function get(client,roleId,userId=null) {
 await role(client,roleId);
 if(userId) await user(client,userId,roleId);
 const [office,course]=await Promise.all(userId?[
  client.query('SELECT office_id FROM public.workspace_user_office_scopes WHERE role_id=$1 AND user_id=$2',[roleId,userId]),
  client.query('SELECT course_id FROM public.workspace_user_course_scopes WHERE role_id=$1 AND user_id=$2',[roleId,userId])
 ]:[
  client.query('SELECT office_id FROM public.workspace_role_office_scopes WHERE role_id=$1',[roleId]),
  client.query('SELECT course_id FROM public.workspace_role_course_scopes WHERE role_id=$1',[roleId])
 ]);
 return {office_ids:office.rows.map(r=>r.office_id),course_ids:course.rows.map(r=>r.course_id)};
}
async function put(client,roleId,userId,body) {
 await role(client,roleId);
 if(userId) await user(client,userId,roleId);
 const officeIds=ids(body?.office_ids),courseIds=ids(body?.course_ids);
 await validateSelection(client,officeIds,courseIds);
 if(userId){
   const parent=await get(client,roleId);
   if(officeIds.some(x=>!parent.office_ids.includes(x)) || courseIds.some(x=>!parent.course_ids.includes(x)))
     throw bad(403,'User scope cannot exceed role scope.');
 }
 const oTable=userId?'workspace_user_office_scopes':'workspace_role_office_scopes';
 const cTable=userId?'workspace_user_course_scopes':'workspace_role_course_scopes';
 const where=userId?'user_id=$1 AND role_id=$2':'role_id=$1';
 const params=userId?[userId,roleId]:[roleId];
 // Editing role limits never broadens the existing user assignments. Out-of-bounds rows are removed.
 await client.query(`DELETE FROM public.${oTable} WHERE ${where}`,params);
 await client.query(`DELETE FROM public.${cTable} WHERE ${where}`,params);
 for(const officeId of officeIds)await client.query(`INSERT INTO public.${oTable}(${userId?'user_id,':''}role_id,office_id) VALUES(${userId?'$1,$2,$3':'$1,$2'})`,[...params,officeId]);
 for(const courseId of courseIds)await client.query(`INSERT INTO public.${cTable}(${userId?'user_id,':''}role_id,course_id) VALUES(${userId?'$1,$2,$3':'$1,$2'})`,[...params,courseId]);
 if(!userId){
  await client.query(`DELETE FROM public.workspace_user_office_scopes x WHERE x.role_id=$1 AND NOT EXISTS
   (SELECT 1 FROM public.workspace_role_office_scopes r WHERE r.role_id=x.role_id AND r.office_id=x.office_id)`,[roleId]);
  await client.query(`DELETE FROM public.workspace_user_course_scopes x WHERE x.role_id=$1 AND NOT EXISTS
   (SELECT 1 FROM public.workspace_role_course_scopes r WHERE r.role_id=x.role_id AND r.course_id=x.course_id)`,[roleId]);
  // Also remove courses whose office was removed from the user's assignment.
  await client.query(`DELETE FROM public.workspace_user_course_scopes x USING public.academic_course c
   WHERE x.role_id=$1 AND c.course_id=x.course_id AND NOT EXISTS
   (SELECT 1 FROM public.workspace_user_office_scopes u WHERE u.role_id=x.role_id AND u.user_id=x.user_id AND u.office_id=c.office_id)`,[roleId]);
 }
 return {office_ids:officeIds,course_ids:courseIds};
}
// Effective course scope is a four-way intersection, checked against live office/course state.
async function effective(client,userId,roleId) {
 await role(client,roleId);await user(client,userId,roleId);
 const r=await client.query(`SELECT c.course_id,c.office_id FROM public.academic_course c JOIN public.ref_offices o ON o.office_id=c.office_id AND o.is_active=true
  JOIN public.workspace_role_office_scopes ro ON ro.role_id=$2 AND ro.office_id=c.office_id
  JOIN public.workspace_role_course_scopes rc ON rc.role_id=$2 AND rc.course_id=c.course_id
  JOIN public.workspace_user_office_scopes uo ON uo.role_id=$2 AND uo.user_id=$1 AND uo.office_id=c.office_id
  JOIN public.workspace_user_course_scopes uc ON uc.role_id=$2 AND uc.user_id=$1 AND uc.course_id=c.course_id
  WHERE COALESCE(c.is_archived,false)=false`,[userId,roleId]);
 return r.rows;
}
module.exports={catalog,get,put,effective};
