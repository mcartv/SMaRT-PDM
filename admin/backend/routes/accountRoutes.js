// SMARTPDM_CUSTOM_ROLE_ACCOUNTS_20261013_V1
// SMaRT-PDM: Return of Obligations — account Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const router = express.Router();
const multer = require('multer');

const accountController = require('../controllers/accountController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
// SMARTPDM_PHASE3_RBAC_AUDIT_V1
const { authorizeRoleGroup, requirePermission } = require('../middleware/rbacMiddleware');
const {
    adminAccountMutationLimiter,
    passwordActionLimiter,
    profileEditLimiter,
    profilePhotoLimiter,
} = require('../middleware/accountRateLimiters');
const allStaff = authorizeRoleGroup('ALL_STAFF');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

const logo = require('../services/portalLogoService');
const ownLogoKey = req => req.user?.user_id ? `account/${req.user.user_id}` : null;
router.get('/me/sidebar-logo', protect, allStaff, logo.handler(ownLogoKey, 'read'));
router.patch('/me/sidebar-logo', protect, allStaff, profilePhotoLimiter, upload.single('file'), logo.handler(ownLogoKey, 'upload'));
router.delete('/me/sidebar-logo', protect, allStaff, profilePhotoLimiter, logo.handler(ownLogoKey, 'reset'));
router.get('/me', protect, allStaff, accountController.getCurrentStaffProfile);
router.patch('/me', protect, allStaff, profileEditLimiter, accountController.updateCurrentStaffProfile);
router.post('/me/password/verify', protect, allStaff, passwordActionLimiter, accountController.verifyCurrentStaffPassword);
router.patch('/me/password/verify', protect, allStaff, passwordActionLimiter, accountController.verifyCurrentStaffPassword);
router.patch('/me/password', protect, allStaff, passwordActionLimiter, accountController.changeCurrentStaffPassword);
router.patch(
    '/me/profile-photo',
    protect,
    allStaff,
    profilePhotoLimiter,
    upload.single('file'),
    accountController.uploadCurrentStaffProfilePhoto
);
router.delete('/me/profile-photo', protect, allStaff, profilePhotoLimiter, accountController.removeCurrentStaffProfilePhoto);

router.get('/staff', protect, authorizeRoles('admin'), requirePermission('accounts.view'), accountController.getStaffAccounts);
router.post('/staff', protect, authorizeRoles('admin'), requirePermission('accounts.create'), adminAccountMutationLimiter, accountController.createStaffAccount);
router.post('/admin', protect, authorizeRoles('admin'), requirePermission('accounts.create'), adminAccountMutationLimiter, accountController.createAdminAccount);
router.patch('/staff/:id', protect, authorizeRoles('admin'), requirePermission('accounts.update'), adminAccountMutationLimiter, accountController.updateStaffAccount);
router.patch('/staff/:id/archive', protect, authorizeRoles('admin'), requirePermission('accounts.archive'), adminAccountMutationLimiter, accountController.archiveStaffAccount);
router.patch('/staff/:id/restore', protect, authorizeRoles('admin'), requirePermission('accounts.archive'), adminAccountMutationLimiter, accountController.restoreStaffAccount); // SMARTPDM_PHASE4_1_RESTORE_PERMISSION_V2


// SMARTPDM_DB_STAFF_CATALOG_V1 — managed staff roles and permitted offices.
router.get('/staff-catalog', protect, authorizeRoles('admin'), requirePermission('accounts.view'), async(req,res)=>{
 try {
  const db=require('../config/db');
  const [roles,offices,positions]=await Promise.all([
   db.query(`SELECT c.app_role_code AS value,r.role_name AS label,
     c.default_position,c.db_user_role,c.is_active
     FROM public.rbac_staff_role_catalog c JOIN public.rbac_roles r ON r.role_id=c.role_id
     WHERE c.is_active=true AND r.is_active=true AND r.role_scope='staff'
     UNION ALL
     SELECT r.role_code AS value,r.role_name AS label,r.role_name AS default_position,
            'Admin'::text AS db_user_role,r.is_active
     FROM public.rbac_roles r WHERE r.role_scope='staff' AND r.is_active=true
       AND NOT EXISTS
        (SELECT 1 FROM public.rbac_staff_role_catalog c WHERE c.role_id=r.role_id)
     ORDER BY label`),
   require('../services/accountOfficeService').listAccountOffices(db),
   db.query('SELECT position_id,position_name FROM public.ref_staff_positions WHERE is_active=true ORDER BY position_name')
  ]);
  res.set('Cache-Control','no-store');res.json({roles:roles.rows,offices:roles.rows.flatMap(role=>offices.map(office=>({...office,role:role.value}))),positions:positions.rows});
 }catch(error){console.error('[Staff Catalog]',error.message);res.status(503).json({error:'Staff catalog temporarily unavailable.'});}
});

// OFFICE_ACCOUNT_AUTOLINK_V1: role permissions available for one account. Read only.
router.get('/access-options', protect, authorizeRoles('admin'), requirePermission('accounts.view'), async(req,res)=>{
 try {
  const code=String(req.query.role||'');
  if(!/^[a-z0-9_]{1,90}$/.test(code))return res.status(400).json({error:'Choose a valid role.'});
  const id=req.query.user_id?String(req.query.user_id):null;
  if(id&&!/^[0-9a-f-]{36}$/i.test(id))return res.status(400).json({error:'Invalid account.'});
  const result=await require('../services/officeAccountAccessService').choices(require('../config/db'),code,id);
  // OFFICE_ACCOUNT_UI_CORRECTION_20261021_V1: independently look up courses attached to the selected active office.
  const office=String(req.query.office||'').trim();
  if(office.length>200)return res.status(400).json({error:'Invalid office selection.'});
  if(office){
    const courses=await require('../config/db').query(
      `SELECT c.course_id,c.course_code,c.course_name FROM public.academic_course c
       JOIN public.ref_offices o ON o.office_id=c.office_id
       WHERE o.office_name=$1 AND o.is_active=true AND COALESCE(c.is_archived,false)=false
       ORDER BY c.course_code`,[office]);
    result.office_courses=courses.rows;
  } else result.office_courses=[];
  res.set('Cache-Control','no-store').json(result);
 }catch(e){console.error('[Account access options]',e.message);res.status(e.status||503).json({error:e.status?e.message:'Permissions are temporarily unavailable.'});}
});

module.exports = router;
