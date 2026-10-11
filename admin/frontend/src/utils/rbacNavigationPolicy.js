// UI-only visibility rules. API authorization remains authoritative.
export const NAV_PERMISSIONS = Object.freeze({
  '/admin/dashboard': 'reports.view',
  '/admin/applications': 'applications.view',
  '/admin/endorsements': 'endorsements.view',
  '/admin/scholars': 'students.view',
  '/admin/obligations': 'ro.view',
  '/admin/payout': 'payouts.view',
  '/admin/reports': 'reports.view',
  '/admin/openings': 'programs.view',
  '/admin/announcements': 'announcements.view',
  '/admin/profile-photos': 'documents.review',
  '/admin/maintenance': 'settings.view',
  '/sdo/queue': 'endorsements.view',
  '/sdo/tracker': 'endorsements.view',
  '/sdo/scholars': 'students.view',
  '/pd/queue': 'endorsements.view',
  '/pd/tracker': 'endorsements.view',
  '/guidance/queue': 'endorsements.view',
  '/guidance/tracker': 'endorsements.view',
  '/ro-coordinator/queue': 'ro.view',
});

// Longest matching route wins. Unlisted routes retain existing portal-level controls.
export function permissionForPath(pathname) {
  const clean = String(pathname || '').split('?')[0].replace(/\/$/, '') || '/';
  const candidates = Object.keys(NAV_PERMISSIONS).filter(path => clean === path || clean.startsWith(path + '/'));
  candidates.sort((a, b) => b.length - a.length);
  return candidates.length ? NAV_PERMISSIONS[candidates[0]] : null;
}

export function canSeePath(path, status, hasPermission) {
  const code = permissionForPath(path);
  if (!code) return true;
  return status === 'ready' && hasPermission(code);
}
