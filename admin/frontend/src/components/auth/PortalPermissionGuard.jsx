import { useLocation } from 'react-router-dom';
import { useRbacPermissions } from '@/context/RbacPermissionContext';
import { permissionForPath } from '@/utils/rbacNavigationPolicy';

export default function PortalPermissionGuard({ children }) {
  const location = useLocation();
  const { status, hasPermission, error } = useRbacPermissions();
  const permission = permissionForPath(location.pathname);
  if (!permission) return children;
  if (status === 'idle') {
    return <div role="alert" className="p-8 text-center">Permission session not loaded. Please sign in again or refresh this page.</div>;
  }
  if (status === 'loading') {
    return <div role="status" className="p-8 text-center">Loading permissions…</div>;
  }
  if (status === 'error') {
    return <div role="alert" className="p-8 text-center">Permissions are temporarily unavailable. {error || 'Please refresh the page.'}</div>;
  }
  const allowed = Array.isArray(permission) ? permission.some(hasPermission) : hasPermission(permission);
  if (!allowed) {
    return <div role="alert" className="p-8 text-center">You do not have permission to view this page.</div>;
  }
  return children;
}
