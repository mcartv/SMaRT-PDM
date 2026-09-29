import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { buildApiUrl } from '@/api';
import { PublicLogoLoader } from '@/components/system/NetworkGate';
import { authService, AuthRequestError } from '@/services/authService';
import {
  getPortalNameFromTokenKey,
  getStoredItem,
  getStoredPortalSession,
  invalidateStoredPortalSession,
  isSessionInvalidationError,
} from '@/utils/authStorage';

const TRANSIENT_RETRY_MS = 3_000;
const SLOW_VALIDATION_MS = 10_000;
const VALIDATION_ERROR_AFTER_MS = 60_000;

export default function ProtectedRoute({ children, storageKey, redirectTo }) {
  const portalName = getPortalNameFromTokenKey(storageKey);
  const [status, setStatus] = useState('checking');
  const [showCheckingLoader, setShowCheckingLoader] = useState(false);
  const [connectionState, setConnectionState] = useState('loading');
  const [isRetrying, setIsRetrying] = useState(false);
  const validatedTokenRef = useRef('');
  const retryTimerRef = useRef(null);
  const validateRef = useRef(null);
  const validationStartedAtRef = useRef(Date.now());

  const scheduleRetry = useCallback((delay = TRANSIENT_RETRY_MS) => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
    }

    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      void validateRef.current?.();
    }, delay);
  }, []);

  const validate = useCallback(async () => {
    const token = getStoredItem(storageKey);

    if (!token) {
      validatedTokenRef.current = '';
      validationStartedAtRef.current = Date.now();
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

      // The backend validated `token`. If cross-tab synchronization replaced it
      // while this request was in flight, the replacement still needs its own
      // backend validation before protected content can render.
      if (getStoredItem(storageKey) !== token) {
        scheduleRetry(0);
        return;
      }

      validatedTokenRef.current = token;
      validationStartedAtRef.current = Date.now();
      setConnectionState('success');
      setStatus('allowed');
    } catch (error) {
      const latestToken = getStoredItem(storageKey);

      if (latestToken && latestToken !== token) {
        scheduleRetry(0);
        return;
      }

      if (
        error instanceof AuthRequestError &&
        error.code === 'NETWORK_ERROR'
      ) {
        // Do not erase a valid stored session on a network outage, but also do
        // not grant protected access to a token that this mount has never had
        // confirmed by the backend.
        if (validatedTokenRef.current === token) {
          setStatus('allowed');
        } else {
          const elapsed = Date.now() - validationStartedAtRef.current;
          setConnectionState(!navigator.onLine
            ? 'offline'
            : elapsed >= VALIDATION_ERROR_AFTER_MS
              ? 'server_error'
              : elapsed >= SLOW_VALIDATION_MS
                ? 'slow'
                : 'loading');
          setStatus('checking');
          scheduleRetry();
        }
        return;
      }

      if (!isSessionInvalidationError(error)) {
        // Temporary 5xx/proxy failures are treated like an unavailable
        // validation service: keep a previously confirmed token usable, or
        // wait/retry if this token has not yet been confirmed.
        if (validatedTokenRef.current === token) {
          setStatus('allowed');
        } else {
          const elapsed = Date.now() - validationStartedAtRef.current;
          setConnectionState(elapsed >= VALIDATION_ERROR_AFTER_MS
            ? 'server_error'
            : elapsed >= SLOW_VALIDATION_MS
              ? 'slow'
              : 'loading');
          setStatus('checking');
          scheduleRetry();
        }
        return;
      }

      const active = portalName ? getStoredPortalSession(portalName) : null;
      const invalidation = portalName
        ? invalidateStoredPortalSession({
            portalName,
            expectedToken: token,
            expectedBrowserSessionId: active?.token === token
              ? active.browserSessionId || ''
              : '',
            code: error?.code,
            message: error?.message,
          })
        : null;

      if (invalidation?.ignored) {
        scheduleRetry(0);
        return;
      }

      validatedTokenRef.current = '';
      validationStartedAtRef.current = Date.now();
      setStatus('denied');
    }
  }, [portalName, scheduleRetry, storageKey]);

  validateRef.current = validate;

  const retryValidation = useCallback(async () => {
    validationStartedAtRef.current = Date.now();
    setIsRetrying(true);
    try {
      await validate();
    } finally {
      setIsRetrying(false);
    }
  }, [validate]);

  useEffect(() => {
    void validate();

    const retry = () => void retryValidation();
    const markOffline = () => setConnectionState('offline');
    window.addEventListener('online', retry);
    window.addEventListener('offline', markOffline);

    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('offline', markOffline);
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [retryValidation, validate]);

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
    if (status !== 'checking' || connectionState !== 'loading') return undefined;
    const elapsed = Date.now() - validationStartedAtRef.current;
    const timer = window.setTimeout(() => {
      setConnectionState((current) => (current === 'loading' ? 'slow' : current));
    }, Math.max(0, SLOW_VALIDATION_MS - elapsed));
    return () => window.clearTimeout(timer);
  }, [connectionState, status]);

  useEffect(() => {
    if (status !== 'allowed') return undefined;

    const heartbeat = () => {
      if (document.visibilityState !== 'visible') return;
      const token = getStoredItem(storageKey);
      if (!token || validatedTokenRef.current !== token) return;

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
        status={connectionState}
        isRetrying={isRetrying}
        onRetry={retryValidation}
      />
    );
  }

  return children;
}
