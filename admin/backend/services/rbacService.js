// SMARTPDM_PHASE3_RBAC_AUDIT_V1
'use strict';
const db = require('../config/db');
// Only active staff roles grant permissions. Read fresh data on every audit/check;
// no stale in-process cache and no trusting JWT user-editable claims.
const SQL = `SELECT DISTINCT p.permission_code
   FROM public.rbac_user_roles ur
   JOIN public.rbac_roles r ON r.role_id = ur.role_id
   JOIN public.rbac_role_permissions rp ON rp.role_id = r.role_id
   JOIN public.rbac_permissions p ON p.permission_id = rp.permission_id
   WHERE ur.user_id = $1 AND ur.is_active = TRUE
     AND r.is_active = TRUE AND r.role_scope = 'staff'`;
async function loadPermissions(userId) {
  if (!userId) throw new Error('Missing authenticated user ID');
  const result = await db.query(SQL,[userId]);
  return new Set(result.rows.map(row => row.permission_code));
}
async function hasPermission(userId, code) {
  const permissions = await loadPermissions(userId);
  return permissions.has(code);
}
module.exports = { loadPermissions, hasPermission };
