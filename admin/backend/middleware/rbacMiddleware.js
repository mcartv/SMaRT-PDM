// SMaRT-PDM: rbac Middleware — rbac Middleware (admin backend middleware); validates or transforms requests before controller handling.
// SMARTPDM_PHASE3_RBAC_AUDIT_V1
const rbacService = require('../services/rbacService');
const db = require('../config/db');
// Named capability groups are configured in rbac_role_groups/
// rbac_role_group_members; no JavaScript membership arrays.
const ROLE_GROUPS = Object.freeze({});

// normalizeRole: normalizes normalize role for the rbac Middleware flow.
function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

// authorizeRoleGroup: handles authorize role group for the rbac Middleware flow.
function authorizeRoleGroup(groupName) {
  return async (req,res,next)=>{
    const userId=req.user?.user_id||req.user?.userId||req.user?.sub;
    if(!userId)return res.status(401).json({message:'Authentication required'});
    try {
      const result=await db.query(`SELECT 1 FROM public.rbac_user_roles ur
        JOIN public.rbac_roles r ON r.role_id=ur.role_id
        JOIN public.rbac_role_group_members m ON m.role_id=r.role_id
        JOIN public.rbac_role_groups g ON g.group_id=m.group_id
        WHERE ur.user_id=$1 AND ur.is_active=TRUE AND r.is_active=TRUE
        AND g.group_code=$2 LIMIT 1`,[userId,groupName]);
      if(result.rowCount)return next();
      return res.status(403).json({code:'RBAC_ACCESS_DENIED',message:'Access denied'});
    }catch(err){console.error('[RBAC group lookup]',err.message);return res.status(503).json({code:'RBAC_UNAVAILABLE',message:'Authorization unavailable'});}
  };
}

// authorizeOwnPortalTheme: handles authorize own portal theme for the rbac Middleware flow.
function authorizeOwnPortalTheme(req, res, next) {
  const role = normalizeRole(req.user?.role);
  const requestedPortal = normalizeRole(req.params?.portalKey).replace(/-/g, '_');

  if (!role) {
    return res.status(403).json({ code: 'RBAC_ACCESS_DENIED', message: 'Access denied for this account.' });
  }

  // Admin owns the global admin/landing configuration and can inspect all portal themes.
  if (role === 'admin') return next();

  if (requestedPortal !== role) {
    return res.status(403).json({
      code: 'RBAC_PORTAL_SCOPE_DENIED',
      message: 'You may only access theme settings for your own portal.',
    });
  }

  return next();
}


// Audit by default. Enforcement requires RBAC_PERMISSION_MODE=enforce and
// should only be enabled after the module-by-module rollout and tests.
function requirePermission(permissionCode) {
  if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(permissionCode)) {
    throw new Error('Invalid RBAC permission code');
  }
  return async (req,res,next) => {
    const userId = req.user?.user_id || req.user?.userId || req.user?.sub;
    if (!userId) return res.status(401).json({code:'AUTH_REQUIRED',message:'Authentication required.'});
    const enforcing = process.env.RBAC_PERMISSION_MODE === 'enforce';
    try {
      const allowed = await rbacService.hasPermission(userId,permissionCode);
      if (!allowed) {
        console.warn('[RBAC]',enforcing?'denied':'audit-would-deny',
          {permission:permissionCode,user_id:userId,method:req.method,path:req.originalUrl});
        if (enforcing) return res.status(403).json({code:'RBAC_PERMISSION_DENIED',message:'Access denied.'});
      }
      return next();
    } catch(err) {
      console.error('[RBAC] Permission lookup failed', {permission:permissionCode,message:err.message});
      if (enforcing) return res.status(503).json({code:'RBAC_UNAVAILABLE',message:'Authorization temporarily unavailable.'});
      return next(); // Only in explicitly non-enforcing audit mode; legacy guards still apply.
    }
  };
}

module.exports = {
  requirePermission,
  ROLE_GROUPS,
  normalizeRole,
  authorizeRoleGroup,
  authorizeOwnPortalTheme,
};
