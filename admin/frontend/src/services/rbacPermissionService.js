import { buildApiUrl } from '@/api';
import { getStoredPortalSession } from '@/utils/authStorage';

export async function fetchMyPermissions(token) {
  if (!token) throw new Error('No authenticated session');
  const response = await fetch(buildApiUrl('/api/rbac/me/permissions'), {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Permissions request failed (${response.status})`);
  const data = await response.json();
  if (!Array.isArray(data.permissions) || !Array.isArray(data.roles)) {
    throw new Error('Unexpected permission response');
  }
  return {
    roles: data.roles.filter(value => typeof value === 'string'),
    permissions: data.permissions.filter(value => typeof value === 'string'),
  };
}

export function getCurrentPermissionSession() {
  const session = getStoredPortalSession();
  return session ? { token: session.token, portalName: session.portalName } : null;
}
