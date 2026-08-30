import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { buildApiUrl } from '@/api';
import pdmLogo from '@/assets/pdm-logo.png';

const CHECK_INTERVAL_MS = 15_000;
const CHECK_TIMEOUT_MS = 8_000;
const SLOW_CONNECTION_MS = 2_500;
const PUBLIC_REFRESH_LOADER_MIN_MS = 1_500;
const PUBLIC_VISIT_LOADER_MIN_MS = 250;
const PUBLIC_ENTRY_PATHS = new Set([
  '/',
  '/landing',
  '/login',
  '/admin/login',
  '/admin/forgot-password',
  '/pd/login',
  '/guidance/login',
  '/sdo/login',
  '/ro-coordinator/login',
]);

function isPublicEntryPath(pathname = window.location.pathname) {
  const normalized = String(pathname || '/').replace(/\/+$/, '') || '/';
  return PUBLIC_ENTRY_PATHS.has(normalized);
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function PublicLogoLoader({ status, isRetrying, onRetry }) {
  const checking = status === 'checking' || isRetrying;

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-white px-6"
      role="status"
      aria-live="polite"
      aria-busy={checking}
    >
      <div className="w-full max-w-sm text-center">
        <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
          {checking ? (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-amber-900/10 motion-reduce:animate-none" aria-hidden="true" />
              <span className="absolute inset-2 animate-pulse rounded-full border border-amber-900/15 bg-white shadow-sm motion-reduce:animate-none" aria-hidden="true" />
            </>
          ) : (
            <span className="absolute inset-2 rounded-full border border-red-200 bg-red-50" aria-hidden="true" />
          )}
          <img
            src={pdmLogo}
            alt=""
            className={`relative h-20 w-20 object-contain ${checking ? 'animate-pulse motion-reduce:animate-none' : 'opacity-70'}`}
          />
        </div>

        {!checking ? (
          <>
            <p className="mt-5 text-sm font-bold tracking-wide text-stone-900">
              Connection interrupted
            </p>
            <p className="mt-1.5 text-xs leading-5 text-stone-500">
              SMaRT-PDM cannot reach the server right now.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--portal-base)] px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--portal-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-accent)]/30 focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </>
        ) : null}

        <span className="sr-only">
          {checking
            ? 'Loading SMaRT-PDM.'
            : 'The SMaRT-PDM server is currently unreachable.'}
        </span>
      </div>
    </div>
  );
}

export default function NetworkGate({ children }) {
  const contentRef = useRef(null);
  const [status, setStatus] = useState(() => (isPublicEntryPath() ? 'checking' : 'online'));
  const [isRetrying, setIsRetrying] = useState(false);
  const [slowConnection, setSlowConnection] = useState(false);

  const checkConnection = useCallback(async ({ manual = false } = {}) => {
    const checkStartedAt = Date.now();
    setSlowConnection(false);
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

      const elapsed = Date.now() - checkStartedAt;
      const connected = response.ok;
      setSlowConnection(connected && elapsed >= SLOW_CONNECTION_MS);
      const publicEntryPath = isPublicEntryPath();

      if (connected && publicEntryPath) {
        const navigationEntry = performance.getEntriesByType('navigation')[0];
        const minimumDuration = navigationEntry?.type === 'reload'
          ? PUBLIC_REFRESH_LOADER_MIN_MS
          : PUBLIC_VISIT_LOADER_MIN_MS;
        const remainingDelay = minimumDuration - (Date.now() - checkStartedAt);
        if (remainingDelay > 0) await wait(remainingDelay);
      }

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
    // Public entry pages use the logo loader while the API is checked.
    // Protected portal routes already validate the session against the backend,
    // so another blocking health-check loader here would be duplicate loading UI.
    if (isPublicEntryPath()) checkConnection();

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

  const publicEntryPath = isPublicEntryPath();
  const blocked = publicEntryPath && status !== 'online';
  const privateConnectionInterrupted = !publicEntryPath && status === 'offline';

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
      {status === 'online' && slowConnection ? (
        <div className="fixed right-4 top-4 z-[100] flex max-w-sm items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg" role="status">
          <Wifi className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="text-xs font-semibold text-amber-900">Slow network detected</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700">Pages and uploads may take longer than usual. Your current work remains available.</p>
          </div>
          <button type="button" onClick={() => setSlowConnection(false)} className="text-xs font-semibold text-amber-800" aria-label="Dismiss slow network message">×</button>
        </div>
      ) : null}
      <div ref={contentRef} className={blocked ? 'hidden' : undefined}>
        {children}
      </div>

      {blocked ? (
        <PublicLogoLoader
          status={status}
          isRetrying={isRetrying}
          onRetry={() => checkConnection({ manual: true })}
        />
      ) : null}

      {privateConnectionInterrupted ? (
        <div
          className="fixed left-1/2 top-4 z-[120] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
            <WifiOff className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-stone-900">
              {isRetrying ? 'Reconnecting to SMaRT-PDM…' : 'Connection interrupted'}
            </p>
            <p className="mt-0.5 text-[11px] text-stone-500">
              Your current page stays open while the server reconnects.
            </p>
          </div>
          <button
            type="button"
            onClick={() => checkConnection({ manual: true })}
            disabled={isRetrying}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 text-[11px] font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}
    </>
  );
}
