// SMARTPDM_RBAC_MIGRATION_20261013_V1
'use strict';
// Admin-only RBAC management. All staff roles are editable; preserve a live administrator to avoid lockout.
const express = require('express');
const db = require('../config/db');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
const router = express.Router();
router.use(protect, authorizeRoles('admin'));
const view = requirePermission('accounts.view');
const manage = requirePermission('accounts.update');
const safe = fn => async (req,res) => { try { await fn(req,res); } catch(e) { console.error('[RBAC Management]',e.message); res.status(e.code==='23505'?409:500).json({error:e.code==='23505'?'Duplicate record.':'RBAC operation failed.'}); } };
const crypto = require('crypto');
const isUuid = x => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x||''));
router.get('/overview',view,safe(async(req,res)=>{
  const [roles,permissions,links,assignments] = await Promise.all([
    db.query("SELECT role_id,role_code,role_name,role_scope,is_active FROM public.rbac_roles WHERE role_code <> 'benefactor' ORDER BY role_scope,role_name"),
    db.query('SELECT permission_id,permission_code,description FROM public.rbac_permissions ORDER BY permission_code'),
    db.query('SELECT rp.role_id,p.permission_code FROM public.rbac_role_permissions rp JOIN public.rbac_permissions p ON p.permission_id=rp.permission_id ORDER BY p.permission_code'),
    db.query(`SELECT ur.user_id, u.username, ur.role_id, ur.is_active, r.role_name FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.role_id=ur.role_id LEFT JOIN public.users u ON u.user_id=ur.user_id ORDER BY r.role_name, u.username NULLS LAST LIMIT 500`)
  ]);
  res.set('Cache-Control','no-store');res.json({roles:roles.rows,permissions:permissions.rows,rolePermissions:links.rows,assignments:assignments.rows});
}));
// SMARTPDM_CONSOLIDATED_ROLE_ASSIGNMENTS_V1
// Supplemental RBAC role assignments; existing account sign-in identity remains unchanged.
router.get('/eligible-users',view,safe(async(req,res)=>{
 const result=await db.query(`SELECT u.user_id,u.username,u.email,
   concat_ws(' ',ap.first_name,ap.last_name) AS display_name,
   COALESCE(ap.is_archived,false) AS is_archived
   FROM public.users u JOIN public.admin_profiles ap ON ap.user_id=u.user_id
   ORDER BY COALESCE(ap.is_archived,false),u.username LIMIT 500`);
 res.set('Cache-Control','no-store');res.json({users:result.rows});
}));
router.put('/roles/:id/users/:userId',manage,safe(async(req,res)=>{
 if(!isUuid(req.params.id)||!isUuid(req.params.userId)||typeof req.body?.granted!=='boolean')
  return res.status(400).json({error:'Invalid role assignment request.'});
 const client=await db.connect();
 try {
  await client.query('BEGIN');
  const role=await client.query('SELECT role_code,role_scope,is_active FROM public.rbac_roles WHERE role_id=$1 FOR UPDATE',[req.params.id]);
  if(!role.rowCount){const e=new Error('Role not found.');e.httpStatus=404;throw e;}
  const target=role.rows[0];
  if(target.role_code==='admin'||target.role_scope!=='staff'||!target.is_active)
    {const e=new Error('OSFA Coordinator and unavailable roles cannot be assigned here.');e.httpStatus=403;throw e;}
  const user=await client.query(`SELECT u.user_id,COALESCE(a.is_archived,false) AS is_archived
    FROM public.users u JOIN public.admin_profiles a ON a.user_id=u.user_id
    WHERE u.user_id=$1 FOR UPDATE OF u,a`,[req.params.userId]);
  if(!user.rowCount||user.rows[0].is_archived)
    {const e=new Error('An active user account is required.');e.httpStatus=404;throw e;}
  if(req.body.granted) await client.query(`INSERT INTO public.rbac_user_roles(user_id,role_id,is_active)
     VALUES($1,$2,TRUE) ON CONFLICT(user_id,role_id) DO UPDATE SET is_active=TRUE`,[req.params.userId,req.params.id]);
  else await client.query('UPDATE public.rbac_user_roles SET is_active=FALSE WHERE user_id=$1 AND role_id=$2',[req.params.userId,req.params.id]);
  await client.query('COMMIT');
  return res.json({ok:true});
 } catch(e){await client.query('ROLLBACK');if(e.httpStatus)return res.status(e.httpStatus).json({error:e.message});throw e} finally{client.release()}
}));
// SMARTPDM_ATOMIC_CREATE_ROLE_MODAL_V1: create the role and all selected permissions atomically.
router.post('/roles/with-permissions',manage,safe(async(req,res)=>{
 const name=String(req.body?.role_name||'').trim();
 const ids=req.body?.permission_ids;
 if(name.length<3||name.length>80||!Array.isArray(ids)||ids.length>200||!ids.every(isUuid)||new Set(ids).size!==ids.length)
   return res.status(400).json({error:'Provide a role name and valid permission selections.'});
 const client=await db.connect();
 try{
  await client.query('BEGIN');
  if(ids.length){const q=await client.query('SELECT permission_id FROM public.rbac_permissions WHERE permission_id=ANY($1::uuid[])',[ids]);
   if(q.rowCount!==ids.length){await client.query('ROLLBACK');return res.status(400).json({error:'One or more permissions do not exist.'});}}
  const code='custom_'+crypto.randomUUID().replace(/-/g,'').slice(0,24);
  const created=await client.query("INSERT INTO public.rbac_roles(role_code,role_name,role_scope,is_active) VALUES($1,$2,'staff',true) RETURNING role_id,role_name,role_code",[code,name]);
  if(ids.length)await client.query('INSERT INTO public.rbac_role_permissions(role_id,permission_id) SELECT $1,unnest($2::uuid[])',[created.rows[0].role_id,ids]);
  await client.query('COMMIT');res.status(201).json({role:created.rows[0],permission_count:ids.length});
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}));
// Role codes are internal identifiers; administrators only supply names.
router.post('/roles',manage,safe(async(req,res)=>{
 const name=String(req.body?.role_name||'').trim();
 if(name.length<3||name.length>80)return res.status(400).json({error:'Role name must be 3–80 characters.'});
 const code='custom_'+crypto.randomUUID().replace(/-/g,'').slice(0,24);
 const r=await db.query(`INSERT INTO public.rbac_roles(role_code,role_name,role_scope,is_active) VALUES ($1,$2,'staff',true) RETURNING role_id,role_code,role_name,role_scope,is_active`,[code,name]);
 res.status(201).json(r.rows[0]);
}));
router.patch('/roles/:id',manage,safe(async(req,res)=>{
 if(!isUuid(req.params.id))return res.status(400).json({error:'Invalid role ID'});
 const name=String(req.body?.role_name||'').trim();
 if(name.length<3||name.length>80)return res.status(400).json({error:'Name must be 3–80 characters.'});
 const r=await db.query(`UPDATE public.rbac_roles SET role_name=$2 WHERE role_id=$1 AND role_scope='staff' RETURNING role_id,role_name`,[req.params.id,name]);
 if(!r.rowCount)return res.status(403).json({error:'Staff role not found.'});
 res.json(r.rows[0]);
}));
router.patch('/roles/:id/status',manage,safe(async(req,res)=>{
 if(!isUuid(req.params.id)||typeof req.body?.is_active!=='boolean')return res.status(400).json({error:'Invalid role/status.'});
 const r=await db.query(`UPDATE public.rbac_roles SET is_active=$2 WHERE role_id=$1 AND role_scope='staff' AND (role_code<>'admin' OR $2=true) RETURNING role_id,is_active`,[req.params.id,req.body.is_active]);
 if(!r.rowCount)return res.status(403).json({error:'The administrator role must stay active.'});
 res.json(r.rows[0]);
}));
// Built-in operational roles support configurable grants. The administrator role
// remains protected to prevent permanent loss of management access.
router.put('/roles/:id/permissions/:permissionId',manage,safe(async(req,res)=>{
 if(!isUuid(req.params.id)||!isUuid(req.params.permissionId)||typeof req.body?.granted!=='boolean')return res.status(400).json({error:'Invalid permission change.'});
 const role=await db.query('SELECT role_code,role_scope,is_active FROM public.rbac_roles WHERE role_id=$1',[req.params.id]);
 if(!role.rowCount)return res.status(404).json({error:'Role not found.'});
 const target=role.rows[0];
 if(target.role_code==='admin'||target.role_scope!=='staff'||!target.is_active)return res.status(403).json({error:'OSFA Coordinator, non-user, and inactive role grants are protected.'});
 const exists=await db.query('SELECT 1 FROM public.rbac_permissions WHERE permission_id=$1',[req.params.permissionId]);
 if(!exists.rowCount)return res.status(404).json({error:'Permission not found.'});
 if(req.body.granted)await db.query('INSERT INTO public.rbac_role_permissions(role_id,permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[req.params.id,req.params.permissionId]);
 else await db.query('DELETE FROM public.rbac_role_permissions WHERE role_id=$1 AND permission_id=$2',[req.params.id,req.params.permissionId]);
 res.json({ok:true});
}));
// Configure legacy portal access and named role groups without source edits.
router.get('/capabilities',view,safe(async(req,res)=>{
 const [portals,groups,groupMembers]=await Promise.all([
 db.query('SELECT role_id,portal_code FROM public.rbac_role_portals ORDER BY portal_code'),
 db.query('SELECT group_id,group_code FROM public.rbac_role_groups ORDER BY group_code'),
 db.query('SELECT group_id,role_id FROM public.rbac_role_group_members')
 ]);res.json({portals:portals.rows,groups:groups.rows,groupMembers:groupMembers.rows});
}));
router.put('/roles/:id/portals/:portal',manage,safe(async(req,res)=>{
 if(!isUuid(req.params.id)||typeof req.body?.granted!=='boolean')return res.status(400).json({error:'Invalid request'});
 const portal=String(req.params.portal||'').toLowerCase();
 const availablePortal=await db.query("SELECT 1 FROM public.rbac_staff_role_catalog WHERE app_role_code=$1 AND is_active=true AND app_role_code<>'admin' LIMIT 1",[portal]);
 if(!availablePortal.rowCount)return res.status(400).json({error:'Unknown or protected portal'});
 const role=await db.query("SELECT role_scope,is_active FROM public.rbac_roles WHERE role_id=$1 AND role_code<>'admin'",[req.params.id]);
 if(!role.rowCount||role.rows[0].role_scope!=='staff'||!role.rows[0].is_active)return res.status(403).json({error:'Role is unavailable'});
 if(req.body.granted)await db.query('INSERT INTO public.rbac_role_portals(role_id,portal_code) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,portal]);
 else await db.query('DELETE FROM public.rbac_role_portals WHERE role_id=$1 AND portal_code=$2',[req.params.id,portal]);
 res.json({ok:true});
}));
router.put('/roles/:id/groups/:groupId',manage,safe(async(req,res)=>{
 if(!isUuid(req.params.id)||!isUuid(req.params.groupId)||typeof req.body?.granted!=='boolean')return res.status(400).json({error:'Invalid request'});
 const group=await db.query('SELECT group_code FROM public.rbac_role_groups WHERE group_id=$1',[req.params.groupId]);
 if(!group.rowCount)return res.status(404).json({error:'Group not found'});
 if(group.rows[0].group_code==='ADMIN_ONLY')return res.status(403).json({error:'OSFA Coordinator-only group is protected'});
 const role=await db.query("SELECT role_scope,is_active FROM public.rbac_roles WHERE role_id=$1 AND role_code<>'admin'",[req.params.id]);
 if(!role.rowCount||role.rows[0].role_scope!=='staff'||!role.rows[0].is_active)return res.status(403).json({error:'Role is unavailable'});
 if(req.body.granted)await db.query('INSERT INTO public.rbac_role_group_members(group_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.groupId,req.params.id]);
 else await db.query('DELETE FROM public.rbac_role_group_members WHERE group_id=$1 AND role_id=$2',[req.params.groupId,req.params.id]);
 res.json({ok:true});
}));
module.exports=router;
