'use strict';
// Office is authoritative: course moves take effect immediately, no duplicated per-course grants.
const error=(status,message)=>Object.assign(new Error(message),{status});
const customRoleSql=`SELECT r.role_id,r.role_code FROM public.rbac_roles r
 WHERE r.role_code=$1 AND r.role_scope='staff' AND r.is_active=true
 AND NOT EXISTS(SELECT 1 FROM public.rbac_staff_role_catalog c WHERE c.role_id=r.role_id)`;
async function roleForCode(db,code) {
 const result=await db.query(customRoleSql,[code]);
 return result.rows.length===1?result.rows[0]:null;
}
async function choices(db,code,userId=null) {
 const role=await roleForCode(db,code);
 if(!role)return {role_id:null,permissions:[],allowed:[]};
 const r=await db.query(`SELECT p.permission_id,p.permission_code FROM public.rbac_role_permissions rp
 JOIN public.rbac_permissions p ON p.permission_id=rp.permission_id
 WHERE rp.role_id=$1 ORDER BY p.permission_code`,[role.role_id]);
 let denied=[];
 if(userId){
  const owns=await db.query(`SELECT 1 FROM public.rbac_user_roles ur JOIN public.admin_profiles a ON a.user_id=ur.user_id
   WHERE ur.user_id=$1 AND ur.role_id=$2 AND ur.is_active=true AND COALESCE(a.is_archived,false)=false`,[userId,role.role_id]);
  if(owns.rowCount!==1)throw error(403,'Account is not assigned to this active role.');
  const d=await db.query('SELECT permission_id FROM public.workspace_account_permission_denials WHERE user_id=$1 AND role_id=$2',[userId,role.role_id]);
  denied=d.rows.map(x=>String(x.permission_id));
 }
 return {role_id:role.role_id,permissions:r.rows,allowed:r.rows.filter(p=>!denied.includes(String(p.permission_id))).map(p=>p.permission_code)};
}
async function saveSelections(db,userId,code,selectedCodes) {
 const role=await roleForCode(db,code);
 if(!role)return;
 if(!Array.isArray(selectedCodes)||selectedCodes.length>250||selectedCodes.some(s=>typeof s!=='string')||new Set(selectedCodes).size!==selectedCodes.length)
  throw error(400,'Invalid permission selection.');
 const available=await db.query(`SELECT p.permission_id,p.permission_code FROM public.rbac_role_permissions rp
 JOIN public.rbac_permissions p ON p.permission_id=rp.permission_id WHERE rp.role_id=$1`,[role.role_id]);
 const allowedSet=new Set(available.rows.map(p=>p.permission_code));
 if(selectedCodes.some(s=>!allowedSet.has(s)))throw error(400,'A selected permission is not available for this role.');
 await db.query('DELETE FROM public.workspace_account_permission_denials WHERE user_id=$1 AND role_id=$2',[userId,role.role_id]);
 for(const p of available.rows)if(!selectedCodes.includes(p.permission_code))
  await db.query('INSERT INTO public.workspace_account_permission_denials(user_id,role_id,permission_id) VALUES($1,$2,$3)',[userId,role.role_id,p.permission_id]);
}
async function allowed(db,userId,roleId,permission){
 const q=await db.query(`SELECT 1 FROM public.rbac_user_roles ur
 JOIN public.rbac_roles r ON r.role_id=ur.role_id AND r.is_active=true
 JOIN public.admin_profiles a ON a.user_id=ur.user_id AND COALESCE(a.is_archived,false)=false
 JOIN public.rbac_role_permissions rp ON rp.role_id=r.role_id
 JOIN public.rbac_permissions p ON p.permission_id=rp.permission_id
 WHERE ur.user_id=$1 AND ur.role_id=$2 AND ur.is_active=true AND p.permission_code=$3
 AND NOT EXISTS(SELECT 1 FROM public.workspace_account_permission_denials d
 WHERE d.user_id=$1 AND d.role_id=$2 AND d.permission_id=p.permission_id)`,[userId,roleId,permission]);
 return q.rowCount===1;
}
// Auto-assign within existing four-way scope model. Always use account's current office.
// No access when office has zero active courses.
async function autoAssign(client,userId,code){
 const role=await roleForCode(client,code);
 if(!role)return; // Existing built-in accounts and portals are unaffected.
 // Remove stale custom-role grants after role or office changes.
 await client.query('DELETE FROM public.workspace_user_course_scopes WHERE user_id=$1',[userId]);
 await client.query('DELETE FROM public.workspace_user_office_scopes WHERE user_id=$1',[userId]);
 const q=await client.query(`SELECT a.office_id,c.course_id FROM public.admin_profiles a
   JOIN public.ref_offices o ON o.office_id=a.office_id AND o.is_active=true
   LEFT JOIN public.academic_course c ON c.office_id=o.office_id AND COALESCE(c.is_archived,false)=false
   WHERE a.user_id=$1 AND COALESCE(a.is_archived,false)=false`,[userId]);
 if(!q.rows.length||!q.rows.some(x=>x.course_id))return;
 const officeId=q.rows[0].office_id;
 // Role capacity may include multiple offices; the user's grant remains limited to their own office.
 await client.query(`INSERT INTO public.workspace_role_office_scopes(role_id,office_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[role.role_id,officeId]);
 await client.query(`INSERT INTO public.workspace_user_office_scopes(user_id,role_id,office_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[userId,role.role_id,officeId]);
 for(const course of q.rows){
   if(!course.course_id)continue;
   await client.query(`INSERT INTO public.workspace_role_course_scopes(role_id,course_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[role.role_id,course.course_id]);
   await client.query(`INSERT INTO public.workspace_user_course_scopes(user_id,role_id,course_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[userId,role.role_id,course.course_id]);
 }
}
async function refreshOffice(client,officeId){
 // Move/removal is reflected by removing previous per-user courses then assigning the office's current courses.
 const q=await client.query(`SELECT a.user_id,r.role_code FROM public.admin_profiles a
 JOIN public.rbac_user_roles ur ON ur.user_id=a.user_id AND ur.is_active=true
 JOIN public.rbac_roles r ON r.role_id=ur.role_id AND r.is_active=true AND r.role_scope='staff'
 WHERE a.office_id=$1 AND NOT EXISTS(SELECT 1 FROM public.rbac_staff_role_catalog c WHERE c.role_id=r.role_id)
 AND COALESCE(a.is_archived,false)=false`,[officeId]);
 for(const row of q.rows)await autoAssign(client,row.user_id,row.role_code);
}
module.exports={choices,saveSelections,allowed,autoAssign,refreshOffice};
