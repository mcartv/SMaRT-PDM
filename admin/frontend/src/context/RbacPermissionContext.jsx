import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchMyPermissions, getCurrentPermissionSession } from '@/services/rbacPermissionService';

const RbacPermissionContext = createContext(null);

export function RbacPermissionProvider({ children }) {
  const [snapshot, setSnapshot] = useState({
    token: '', status: 'idle', roles: [], permissions: [], error: null,
  });
  const refresh = useCallback(async () => {
    const session = getCurrentPermissionSession();
    const token = session?.token || '';
    if (!token) {
      setSnapshot({ token:'', status:'idle', roles:[], permissions:[], error:null });
      return;
    }
    setSnapshot({ token, status:'loading', roles:[], permissions:[], error:null });
    try {
      const result = await fetchMyPermissions(token);
      // Never publish stale results if the signed-in session changed mid-request.
      if (getCurrentPermissionSession()?.token !== token) return;
      setSnapshot({ token, status:'ready', ...result, error:null });
    } catch (error) {
      if (getCurrentPermissionSession()?.token !== token) return;
      // Fail closed for UI visibility; the backend remains authoritative.
      setSnapshot({ token, status:'error', roles:[], permissions:[], error:error.message });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener('focus', onChange);
    window.addEventListener('storage', onChange);
    window.addEventListener('smartpdm:rbac-refresh', onChange);
    return () => {
      window.removeEventListener('focus', onChange);
      window.removeEventListener('storage', onChange);
      window.removeEventListener('smartpdm:rbac-refresh', onChange);
    };
  }, [refresh]);

  const value = useMemo(() => ({
    status: snapshot.status,
    roles: snapshot.roles,
    permissions: snapshot.permissions,
    error: snapshot.error,
    hasPermission: (code) => snapshot.status === 'ready' && snapshot.permissions.includes(code),
    refresh,
  }), [snapshot, refresh]);
  return <RbacPermissionContext.Provider value={value}>{children}</RbacPermissionContext.Provider>;
}

export function useRbacPermissions() {
  const context = useContext(RbacPermissionContext);
  if (!context) throw new Error('useRbacPermissions requires RbacPermissionProvider');
  return context;
}
