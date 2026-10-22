// SMaRT-PDM: Return of Obligations — ro Coordinator Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoleGroup, requirePermission } = require('../middleware/rbacMiddleware');
const db = require('../config/db');
const rbacService = require('../services/rbacService');
const controller = require('../controllers/roCoordinatorController');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const router = express.Router();
const roCoordinatorCache = cacheJsonResponse({
    namespace: 'ro-coordinator',
    ttlMs: 3000,
});
const invalidateCoordinator = invalidateCacheOnSuccess([
    'ro-coordinator',
    'ro',
]);

// RO coordination is an additional assignment-based capability. PD, SDO, and Guidance
// staff keep their primary role and access these routes only with an active RO Area assignment.
// Staff can enter the Community Service request module through their active
// coordinator assignment OR a delegated permission. Never trust a client flag.
const groupGuard = authorizeRoleGroup('RO_COORDINATOR_CAPABLE');
router.use(protect, async (req,res,next) => {
  const userId=req.user?.user_id||req.user?.userId||req.user?.sub;
  if(!userId)return res.status(401).json({message:'Authentication required'});
  try {
    const assigned=await db.query('SELECT 1 FROM public.ro_area_coordinators rac JOIN public.ro_departments rd ON rd.department_id=rac.ro_area_id JOIN public.admin_profiles ap ON ap.user_id=rac.user_id WHERE rac.user_id=$1 AND rac.is_active=true AND rd.is_active=true AND COALESCE(ap.is_archived,false)=false LIMIT 1',[userId]);
    if(assigned.rowCount){req.roCoordinatorAssigned=true;return next();}
    const granted=await db.query(`SELECT 1 FROM public.rbac_user_roles ur
      JOIN public.rbac_roles r ON r.role_id=ur.role_id
      JOIN public.rbac_role_permissions rp ON rp.role_id=r.role_id
      JOIN public.rbac_permissions p ON p.permission_id=rp.permission_id
      WHERE ur.user_id=$1 AND ur.is_active=true AND r.is_active=true
      AND p.permission_code IN ('ro.assign','ro.view','ro.validate') LIMIT 1`,[userId]);
    if(granted.rowCount)return next();
    return groupGuard(req,res,next);
  }catch(error){console.error('[Community Service access]',error.message);return res.status(503).json({code:'RBAC_UNAVAILABLE',message:'Authorization unavailable'});}
});
// Existing assigned coordinators retain access; delegates need a live permission.
const canAct = code => async (req,res,next) => {
  if(req.roCoordinatorAssigned)return next();
  const userId=req.user?.user_id||req.user?.userId||req.user?.sub;
  try {
    if(await rbacService.hasPermission(userId,code))return next();
    return groupGuard(req,res,next);
  }catch(err){return res.status(503).json({code:'RBAC_UNAVAILABLE',message:'Authorization unavailable'});}
};
// Reading Community Service assignment queues is also required to make an assignment.
const canRead = async (req,res,next) => {
  if(req.roCoordinatorAssigned)return next();
  const userId=req.user?.user_id||req.user?.userId||req.user?.sub;
  try {
    if(await rbacService.hasPermission(userId,'ro.view') || await rbacService.hasPermission(userId,'ro.assign'))return next();
    return groupGuard(req,res,next);
  }catch(err){return res.status(503).json({code:'RBAC_UNAVAILABLE',message:'Authorization unavailable'}); }
};
router.get('/summary', canRead, roCoordinatorCache, controller.getSummary);
router.get('/summary', roCoordinatorCache, controller.getSummary);
router.get('/requests', canRead, roCoordinatorCache, controller.getRequests);
router.get('/scholar-requests', canRead, roCoordinatorCache, controller.getScholarRequests);
router.post('/scholar-requests', canAct('ro.assign'), invalidateCoordinator, controller.createScholarRequest);
router.patch('/scholar-requests/:requestId/cancel', canAct('ro.assign'), invalidateCoordinator, controller.cancelScholarRequest);
router.patch('/requests/:placementId/decision', canAct('ro.assign'), invalidateCoordinator, controller.decideRequest);
router.get('/attendance', canAct('ro.validate'), roCoordinatorCache, controller.getAttendanceQueue);
router.patch('/attendance/:logId/decision', canAct('ro.validate'), invalidateCoordinator, controller.validateAttendance);

module.exports = router;
