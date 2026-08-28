import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { buildApiUrl } from '@/api';
import { PublicLogoLoader } from '@/components/system/NetworkGate';
import { authService, AuthRequestError } from '@/services/authService';
import {
  clearPortalSession,
  getPortalNameFromTokenKey,
  savePortalSessionFeedback,
  getStoredItem,
} from '@/utils/authStorage';

export default function ProtectedRoute({ children, storageKey, redirectTo }) {
  const portalName = getPortalNameFromTokenKey(storageKey);
  const [status, setStatus] = useState('checking');
  const [showCheckingLoader, setShowCheckingLoader] = useState(false);

  const validate = useCallback(async () => {
    const token = getStoredItem(storageKey);

    if (!token) {
      setStatus('denied');
      return;
    }

    setStatus('checking');

    try {
      if (portalName === 'admin') {
        await authService.resumeAdminSession(token);
      } else {
        await authService.validateStaffSession(token);
      }

      setStatus('allowed');
    } catch (error) {
      if (
        error instanceof AuthRequestError &&
        error.code === 'NETWORK_ERROR'
      ) {
        return;
      }

      if (portalName) {
        savePortalSessionFeedback({
          portalName,
          code: error?.code,
          message: error?.message,
        });
        clearPortalSession(portalName);
      }
      setStatus('denied');
    }
  }, [portalName, storageKey]);

  useEffect(() => {
    validate();

    const retry = () => validate();
    window.addEventListener('online', retry);

    return () => window.removeEventListener('online', retry);
  }, [validate]);

  useEffect(() => {
    if (status !== 'checking') {
      setShowCheckingLoader(false);
      return undefined;
    }

    // Avoid flashing a loader for session checks that finish almost immediately.
    const timer = window.setTimeout(() => {
      setShowCheckingLoader(true);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status !== 'allowed') return undefined;

    const heartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      const token = getStoredItem(storageKey);
      if (!token) return;

      void fetch(buildApiUrl('/api/system-maintenance/activity/heartbeat'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {
        // Presence diagnostics are best-effort and must not interrupt portal use.
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') heartbeat();
    };

    const timer = window.setInterval(heartbeat, 4 * 60 * 1000);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [status, storageKey]);

  if (status === 'denied') {
    return <Navigate to={redirectTo} replace />;
  }

  if (status === 'checking') {
    if (!showCheckingLoader) {
      return <div className="min-h-screen bg-white" aria-hidden="true" />;
    }

    return (
      <PublicLogoLoader
        status="checking"
        isRetrying={false}
        onRetry={validate}
      />
    );
  }

  return children;
}
