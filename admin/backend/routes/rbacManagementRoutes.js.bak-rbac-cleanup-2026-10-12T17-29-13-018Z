'use strict';
// Admin-only RBAC management. Core roles are immutable to prevent production lockout.
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
const coreCodes = ['admin','sdo','guidance','pd','ro_coordinator','student','benefactor'];
const isUuid = x => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x||''));
router.get('/overview',view,safe(async(req,res)=>{
  const [roles,permissions,links,assignments] = await Promise.all([
    db.query('SELECT role_id,role_code,role_name,role_scope,is_active FROM public.rbac_roles ORDER BY role_scope,role_name'),
    db.query('SELECT permission_id,permission_code,description FROM public.rbac_permissions ORDER BY permission_code'),
    db.query('SELECT rp.role_id,p.permission_code FROM public.rbac_role_permissions rp JOIN public.rbac_permissions p ON p.permission_id=rp.permission_id ORDER BY p.permission_code'),
    db.query(`SELECT ur.user_id, u.username, ur.role_id, ur.is_active, r.role_name FROM public.rbac_user_roles ur JOIN public.rbac_roles r ON r.role_id=ur.role_id LEFT JOIN public.users u ON u.user_id=ur.user_id ORDER BY r.role_name, u.username NULLS LAST LIMIT 500`)
  ]);
  res.set('Cache-Control','no-store');res.json({roles:roles.rows,permissions:permissions.rows,rolePermissions:links.rows,assignments:assignments.rows});
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
 const r=await db.query(`UPDATE public.rbac_roles SET role_name=$2 WHERE role_id=$1 AND role_code LIKE 'custom_%' RETURNING role_id,role_name`,[req.params.id,name]);
 if(!r.rowCount)return res.status(403).json({error:'Only custom roles can be renamed; built-in role identifiers are reserved.'});
 res.json(r.rows[0]);
}));
router.patch('/roles/:id/status',manage,safe(async(req,res)=>{
 if(!isUuid(req.params.id)||typeof req.body?.is_active!=='boolean')return res.status(400).json({error:'Invalid role/status.'});
 const r=await db.query(`UPDATE public.rbac_roles SET is_active=$2 WHERE role_id=$1 AND role_code LIKE 'custom_%' RETURNING role_id,is_active`,[req.params.id,req.body.is_active]);
 if(!r.rowCount)return res.status(403).json({error:'Built-in roles cannot be archived.'});
 res.json(r.rows[0]);
}));
// Built-in operational roles support configurable grants. The administrator role
// remains protected to prevent permanent loss of management access.
router.put('/roles/:id/permissions/:permissionId',manage,safe(async(req,res)=>{
 if(!isUuid(req.params.id)||!isUuid(req.params.permissionId)||typeof req.body?.granted!=='boolean')return res.status(400).json({error:'Invalid permission change.'});
 const role=await db.query('SELECT role_code,role_scope,is_active FROM public.rbac_roles WHERE role_id=$1',[req.params.id]);
 if(!role.rowCount)return res.status(404).json({error:'Role not found.'});
 const target=role.rows[0];
 if(target.role_code==='admin'||target.role_scope!=='staff'||!target.is_active)return res.status(403).json({error:'Administrator, non-user, and inactive role grants are protected.'});
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
 if(!['sdo','guidance','pd','ro_coordinator'].includes(portal))return res.status(400).json({error:'Unknown or protected portal'});
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
 if(group.rows[0].group_code==='ADMIN_ONLY')return res.status(403).json({error:'Administrator-only group is protected'});
 const role=await db.query("SELECT role_scope,is_active FROM public.rbac_roles WHERE role_id=$1 AND role_code<>'admin'",[req.params.id]);
 if(!role.rowCount||role.rows[0].role_scope!=='staff'||!role.rows[0].is_active)return res.status(403).json({error:'Role is unavailable'});
 if(req.body.granted)await db.query('INSERT INTO public.rbac_role_group_members(group_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.groupId,req.params.id]);
 else await db.query('DELETE FROM public.rbac_role_group_members WHERE group_id=$1 AND role_id=$2',[req.params.groupId,req.params.id]);
 res.json({ok:true});
}));
module.exports=router;
