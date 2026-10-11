import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMyPermissions, getCurrentPermissionSession } from '@/services/rbacPermissionService';

const RbacPermissionContext = createContext(null);
const empty = (status = 'idle', error = null) => ({ token: '', portalName: '', status, roles: [], permissions: [], error });

export function RbacPermissionProvider({ children }) {
  const [snapshot, setSnapshot] = useState(() => empty());
  const currentRef = useRef('');
  const generationRef = useRef(0);
  const inFlightRef = useRef('');
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const refresh = useCallback(async (force = false) => {
    const session = getCurrentPermissionSession();
    const token = session?.token || '';
    const portalName = session?.portalName || '';
    const identity = `${portalName}:${token}`;
    if (!token) {
      generationRef.current += 1;
      currentRef.current = '';
      inFlightRef.current = '';
      setSnapshot(previous => previous.status === 'idle' && !previous.token ? previous : empty());
      return;
    }
    if (!force && currentRef.current === identity && inFlightRef.current === identity) return;
    if (!force && currentRef.current === identity && snapshotRef.current.status === 'ready'
        && snapshotRef.current.token === token && snapshotRef.current.portalName === portalName) return;
    const generation = ++generationRef.current;
    currentRef.current = identity;
    inFlightRef.current = identity;
    setSnapshot(previous => previous.status === 'ready' && previous.token === token && previous.portalName === portalName
      ? previous : { token, portalName, status: 'loading', roles: [], permissions: [], error: null });
    try {
      const result = await fetchMyPermissions(token);
      const latest = getCurrentPermissionSession();
      if (generationRef.current !== generation || latest?.token !== token || latest?.portalName !== portalName) return;
      setSnapshot({ token, portalName, status: 'ready', roles: result.roles, permissions: result.permissions, error: null });
    } catch (error) {
      const latest = getCurrentPermissionSession();
      if (generationRef.current !== generation || latest?.token !== token || latest?.portalName !== portalName) return;
      setSnapshot({ token, portalName, status: 'error', roles: [], permissions: [], error: error.message });
    } finally {
      if (generationRef.current === generation) inFlightRef.current = '';
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onSessionChange = () => void refresh();
    const onForceRefresh = () => void refresh(true);
    window.addEventListener('focus', onSessionChange);
    window.addEventListener('storage', onSessionChange);
    window.addEventListener('popstate', onSessionChange);
    window.addEventListener('portal-session:invalidated', onSessionChange);
    window.addEventListener('portal-session:established', onSessionChange);
    window.addEventListener('smartpdm:rbac-refresh', onForceRefresh);
    // React Router navigations and same-tab sessionStorage writes do not emit
    // native storage/popstate events. Observe session identity cheaply instead.
    const interval = window.setInterval(onSessionChange, 1000);
    return () => {
      generationRef.current += 1;
      inFlightRef.current = '';
      currentRef.current = '';
      window.clearInterval(interval);
      window.removeEventListener('focus', onSessionChange);
      window.removeEventListener('storage', onSessionChange);
      window.removeEventListener('popstate', onSessionChange);
      window.removeEventListener('portal-session:invalidated', onSessionChange);
      window.removeEventListener('portal-session:established', onSessionChange);
      window.removeEventListener('smartpdm:rbac-refresh', onForceRefresh);
    };
  }, [refresh]);

  const value = useMemo(() => ({
    status: snapshot.status,
    roles: snapshot.roles,
    permissions: snapshot.permissions,
    error: snapshot.error,
    hasPermission: code => snapshot.status === 'ready' && snapshot.permissions.includes(code),
    refresh: () => refresh(true),
  }), [snapshot, refresh]);
  return <RbacPermissionContext.Provider value={value}>{children}</RbacPermissionContext.Provider>;
}

export function useRbacPermissions() {
  const context = useContext(RbacPermissionContext);
  if (!context) throw new Error('useRbacPermissions requires RbacPermissionProvider');
  return context;
}
