// SMARTPDM_WORKSPACE_RBAC_20261013_V1: authenticated self-scoped workspace capabilities.
'use strict';
const express=require('express');
const db=require('../config/db');
const {protect}=require('../middleware/authMiddleware');
const workspaceScope=require('../services/workspaceScopeService');
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
// PHASE6D2C_SCOPE_GATE_V1
 // No client-supplied role or scope identifiers are trusted for record access.
 const userId=req.user?.user_id;
 if(!userId)return res.status(403).json({message:'Workspace identity unavailable.'});
 const moduleKey=String(req.params.module||'');
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
  // Scope enforcement is independent of a permission grant.
  const roles=await db.query(`SELECT r.role_id FROM public.rbac_user_roles ur
    JOIN public.rbac_roles r ON r.role_id=ur.role_id
    JOIN public.admin_profiles ap ON ap.user_id=ur.user_id
    WHERE ur.user_id=$1 AND ur.is_active=true AND r.is_active=true
      AND r.role_scope='staff' AND COALESCE(ap.is_archived,false)=false
      AND NOT EXISTS (SELECT 1 FROM public.rbac_staff_role_catalog c WHERE c.role_id=r.role_id)
      AND EXISTS (SELECT 1 FROM public.rbac_role_permissions rp
        JOIN public.rbac_permissions p ON p.permission_id=rp.permission_id
        WHERE rp.role_id=r.role_id AND p.permission_code=$2)
    ORDER BY ur.assigned_at DESC LIMIT 2`,[userId,permission]);
  if(roles.rows.length!==1)return res.status(403).json({message:'An unambiguous active workspace role with this permission is required.'});
  const scoped=await workspaceScope.effective(db,userId,roles.rows[0].role_id);
  const courseIds=[...new Set(scoped.map(row=>String(row.course_id)).filter(Boolean))];
  if(!courseIds.length)return res.status(403).json({code:'WORKSPACE_SCOPE_REQUIRED',message:'No authorized office/course scope is assigned.'});
  // Unreviewed record modules stay denied. A grant and scope alone do not unlock them.
  if(['payouts','accounts'].includes(moduleKey))return res.status(403).json({
    code:'WORKSPACE_RECORD_SCOPE_REQUIRED',message:'This module is awaiting scoped record integration.'
  });
  res.set('Cache-Control','no-store');
  // PHASE6D2D_APPLICATIONS_V1
  if(moduleKey==='applications'){
    // Course IDs are derived server-side from the role/user scope intersection.
    // Do not trust client-supplied course, office, or role identifiers.
    const result=await db.query(`SELECT a.application_id,a.application_status,a.document_status,a.submission_date
      FROM public.applications a
      JOIN public.students st ON st.student_id=a.student_id
      JOIN public.academic_course c ON c.course_id=st.course_id
      JOIN public.ref_offices o ON o.office_id=c.office_id AND o.is_active=true
      WHERE COALESCE(a.is_archived,false)=false
        AND COALESCE(st.is_archived,false)=false
        AND COALESCE(c.is_archived,false)=false
        AND c.course_id=ANY($1::uuid[])
      ORDER BY a.submission_date DESC NULLS LAST,a.application_id DESC
      LIMIT 30`,[courseIds]);
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
    // Only include applications attached to authorized current student courses.
    const result=await db.query(`SELECT COUNT(*)::int AS applications
      FROM public.applications a JOIN public.students st ON st.student_id=a.student_id
      JOIN public.academic_course c ON c.course_id=st.course_id
      WHERE COALESCE(a.is_archived,false)=false AND c.course_id=ANY($1::uuid[])`,[courseIds]);
    return res.json({summary:result.rows[0]||{applications:0}});
  }
 }catch(error){console.error('[workspace/data]',error.message);return res.status(503).json({message:'Workspace records temporarily unavailable.'});}
});

module.exports=router;
