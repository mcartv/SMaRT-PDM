import { useCallback, useEffect, useRef, useState } from 'react';
import { CloudOff, Loader2, RefreshCw, Wifi } from 'lucide-react';
import { buildApiUrl } from '@/api';

const CHECK_INTERVAL_MS = 15_000;
const CHECK_TIMEOUT_MS = 5_000;

export default function NetworkGate({ children }) {
  const contentRef = useRef(null);
  const [status, setStatus] = useState('checking');
  const [isRetrying, setIsRetrying] = useState(false);

  const checkConnection = useCallback(async ({ manual = false } = {}) => {
    if (manual) setIsRetrying(true);

    if (!navigator.onLine) {
      setStatus('offline');
      if (manual) setIsRetrying(false);
      return false;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      CHECK_TIMEOUT_MS
    );

    try {
      const response = await fetch(
        `${buildApiUrl('/api/health')}?networkCheck=${Date.now()}`,
        {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        }
      );

      const connected = response.ok;
      setStatus(connected ? 'online' : 'offline');
      return connected;
    } catch {
      setStatus('offline');
      return false;
    } finally {
      window.clearTimeout(timeoutId);
      if (manual) setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();

    const handleOnline = () => checkConnection();
    const handleOffline = () => setStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const intervalId = window.setInterval(
      () => checkConnection(),
      CHECK_INTERVAL_MS
    );

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(intervalId);
    };
  }, [checkConnection]);

  const blocked = status !== 'online';

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    content.inert = blocked;
    content.setAttribute('aria-hidden', blocked ? 'true' : 'false');

    if (blocked) {
      document.activeElement?.blur?.();
    }

    return () => {
      content.inert = false;
      content.removeAttribute('aria-hidden');
    };
  }, [blocked]);

  return (
    <>
      <div ref={contentRef}>{children}</div>

      {blocked && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-stone-950/75 px-5 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
              {status === 'checking' ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <CloudOff className="h-8 w-8" />
              )}
            </div>

            <h1 className="text-xl font-bold text-stone-900">
              {status === 'checking'
                ? 'Checking connection'
                : 'No Internet Connection'}
            </h1>

            <p className="mt-2 text-sm leading-6 text-stone-500">
              SMaRT-PDM requires an active connection to the server. Forms,
              typing, navigation, uploads, and other actions are temporarily
              disabled.
            </p>

            <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-stone-50 px-4 py-3 text-xs font-medium text-stone-600">
              <Wifi className="h-4 w-4" />
              Reconnect to continue using the system.
            </div>

            <button
              type="button"
              onClick={() => checkConnection({ manual: true })}
              disabled={isRetrying}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`}
              />
              Check connection
            </button>
          </div>
        </div>
      )}
    </>
  );
}
