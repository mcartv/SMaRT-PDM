// SMaRT-PDM: rbac Middleware — rbac Middleware (admin backend middleware); validates or transforms requests before controller handling.
const ROLE_GROUPS = Object.freeze({
  ALL_STAFF: Object.freeze(['admin', 'sdo', 'guidance', 'pd', 'ro_coordinator']),
  ENDORSEMENT_STAFF: Object.freeze(['admin', 'sdo', 'guidance', 'pd']),
  REPORT_STAFF: Object.freeze(['admin', 'sdo', 'guidance', 'pd', 'ro_coordinator']),
  RO_COORDINATOR_CAPABLE: Object.freeze(['sdo', 'guidance', 'pd', 'ro_coordinator']),
  ADMIN_ONLY: Object.freeze(['admin']),
});

// normalizeRole: normalizes normalize role for the rbac Middleware flow.
function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

// authorizeRoleGroup: handles authorize role group for the rbac Middleware flow.
function authorizeRoleGroup(groupName) {
  const allowed = ROLE_GROUPS[groupName];
  if (!allowed) throw new Error(`Unknown RBAC role group: ${groupName}`);

  return (req, res, next) => {
    const role = normalizeRole(req.user?.role);
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({
        code: 'RBAC_ACCESS_DENIED',
        message: 'Access denied for this account.',
      });
    }
    return next();
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

module.exports = {
  ROLE_GROUPS,
  normalizeRole,
  authorizeRoleGroup,
  authorizeOwnPortalTheme,
};
