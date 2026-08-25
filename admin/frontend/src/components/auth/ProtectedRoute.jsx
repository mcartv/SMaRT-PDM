import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';

import { authService, AuthRequestError } from '@/services/authService';
import {
  clearPortalSession,
  getPortalNameFromTokenKey,
  getStoredItem,
} from '@/utils/authStorage';

export default function ProtectedRoute({ children, storageKey, redirectTo }) {
  const portalName = getPortalNameFromTokenKey(storageKey);
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('Checking your session...');

  const validate = useCallback(async () => {
    const token = getStoredItem(storageKey);

    if (!token) {
      setStatus('denied');
      return;
    }

    // Only the true Admin account uses the managed one-device session.
    if (portalName !== 'admin') {
      setStatus('allowed');
      return;
    }

    setStatus('checking');
    setMessage('Restoring your Admin session...');

    try {
      await authService.resumeAdminSession(token);
      setStatus('allowed');
    } catch (error) {
      if (
        error instanceof AuthRequestError &&
        error.code === 'NETWORK_ERROR'
      ) {
        setMessage('Waiting for the server connection...');
        return;
      }

      clearPortalSession('admin');
      setStatus('denied');
    }
  }, [portalName, storageKey]);

  useEffect(() => {
    validate();

    const retry = () => validate();
    window.addEventListener('online', retry);

    return () => window.removeEventListener('online', retry);
  }, [validate]);

  if (status === 'denied') {
    return <Navigate to={redirectTo} replace />;
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-700">
            {navigator.onLine ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <ShieldAlert className="h-6 w-6" />
            )}
          </div>
          <p className="text-sm font-semibold text-stone-800">{message}</p>
          <p className="mt-1 text-xs text-stone-500">
            The Admin portal will continue automatically when the session is available.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
