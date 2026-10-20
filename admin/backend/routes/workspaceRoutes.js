// SMARTPDM_WORKSPACE_RBAC_20261013_V1: authenticated self-scoped workspace capabilities.
'use strict';
const express=require('express');
const db=require('../config/db');
const {protect}=require('../middleware/authMiddleware');
const router=express.Router();
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.use(protect,(req,res,next)=>req.user?.role==='workspace'?next():res.status(403).json({message:'Workspace access denied.'}));
router.get('/me',async(req,res)=>{
 try {
  const userId=req.user.user_id;
  const roles=await db.query(`SELECT r.role_name, r.role_id FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.role_id=ur.role_id
    WHERE ur.user_id=$1 AND ur.is_active=true AND r.is_active=true AND r.role_scope='staff'
      AND NOT EXISTS (SELECT 1 FROM public.rbac_staff_role_catalog catalog WHERE catalog.role_id=r.role_id) ORDER BY ur.assigned_at DESC LIMIT 1`,[userId]);
  if(!roles.rowCount)return res.status(403).json({message:'No active workspace role.'});
  const permissions=await db.query(`SELECT DISTINCT p.permission_code FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.role_id=ur.role_id
    JOIN public.rbac_role_permissions rp ON rp.role_id=r.role_id
    JOIN public.rbac_permissions p ON p.permission_id=rp.permission_id
    WHERE ur.user_id=$1 AND ur.is_active=true AND r.is_active=true
      AND r.role_scope='staff' AND NOT EXISTS (SELECT 1 FROM public.rbac_staff_role_catalog catalog WHERE catalog.role_id=r.role_id) ORDER BY p.permission_code`,[userId]);
  res.set('Cache-Control','no-store').json({role_name:roles.rows[0].role_name,permissions:permissions.rows.map(x=>x.permission_code)});
 }catch(e){console.error('[workspace/me]',e.message);res.status(503).json({message:'Workspace permissions unavailable.'})}
});
// SMARTPDM_WORKSPACE_PHASE3_REAL_DATA_V1
// Require an active custom-role assignment AND an explicit view grant on every request.
const dataPermission = { applications:'applications.view', payouts:'payouts.view', accounts:'accounts.view', reports:'reports.view' };
router.get('/data/:module',async(req,res)=>{
 const moduleKey=String(req.params.module||'');
// SMARTPDM_WORKSPACE_PHASE4_FAIL_CLOSED_V1
  // Module grants do not imply unrestricted access to every office's records.
  // Fail closed until a verified row-level scope is configured for these modules.
  if (['applications','payouts','accounts'].includes(moduleKey)) {
    res.set('Cache-Control','no-store');
    return res.status(403).json({
      code:'WORKSPACE_RECORD_SCOPE_REQUIRED',
      message:'This module requires an administrator-configured record scope before its records can be viewed.'
    });
  }

 const permission=dataPermission[moduleKey];
 if(!permission)return res.status(404).json({message:'Module data is not available.'});
 try {
  const allowed=await db.query(`SELECT 1 FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.role_id=ur.role_id
    JOIN public.rbac_role_permissions rp ON rp.role_id=r.role_id
    JOIN public.rbac_permissions p ON p.permission_id=rp.permission_id
    WHERE ur.user_id=$1 AND ur.is_active=true AND r.is_active=true
      AND r.role_scope='staff' AND NOT EXISTS (SELECT 1 FROM public.rbac_staff_role_catalog catalog WHERE catalog.role_id=r.role_id)
      AND p.permission_code=$2 LIMIT 1`,[req.user.user_id,permission]);
  if(!allowed.rowCount)return res.status(403).json({message:'Your role does not grant '+permission+'.'});
  res.set('Cache-Control','no-store');
  if(moduleKey==='applications'){
    const result=await db.query(`SELECT application_id,application_status,document_status,submission_date FROM public.applications WHERE COALESCE(is_archived,false)=false ORDER BY submission_date DESC NULLS LAST LIMIT 30`);
    return res.json({items:result.rows});
  }
  if(moduleKey==='payouts'){
    const result=await db.query(`SELECT payout_batch_id,payout_title,batch_status,payout_date,total_amount FROM public.payout_batches WHERE COALESCE(is_archived,false)=false ORDER BY payout_date DESC NULLS LAST LIMIT 30`);
    return res.json({items:result.rows});
  }
  if(moduleKey==='accounts'){
    const result=await db.query(`SELECT u.user_id,u.username,trim(concat_ws(' ',a.first_name,a.last_name)) AS name,a.department
      FROM public.users u JOIN public.admin_profiles a ON a.user_id=u.user_id
      WHERE COALESCE(a.is_archived,false)=false ORDER BY u.created_at DESC LIMIT 30`);
    return res.json({items:result.rows});
  }
  if(moduleKey==='reports'){
    const result=await db.query(`SELECT
      (SELECT COUNT(*)::int FROM public.applications WHERE COALESCE(is_archived,false)=false) AS applications,
      (SELECT COUNT(*)::int FROM public.scholarship_program WHERE COALESCE(is_archived,false)=false) AS scholarship_programs,
      (SELECT COUNT(*)::int FROM public.payout_batches WHERE COALESCE(is_archived,false)=false) AS payout_batches`);
    return res.json({summary:result.rows[0]||{}});
  }
 }catch(error){console.error('[workspace/data]',error.message);return res.status(503).json({message:'Workspace records temporarily unavailable.'});}
});

module.exports=router;
