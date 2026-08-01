import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { buildApiUrl } from '@/api';
import pdmLogo from '@/assets/pdm-logo.png';

const CHECK_INTERVAL_MS = 15_000;
const CHECK_TIMEOUT_MS = 5_000;
const LANDING_REFRESH_LOADER_MIN_MS = 1_500;
const LANDING_VISIT_LOADER_MIN_MS = 250;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function SkeletonBlock({ className = '', style }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-stone-200/80 ${className}`}
      style={style}
    />
  );
}

function NetworkSkeleton({ status, isRetrying, onRetry }) {
  const checking = status === 'checking' || isRetrying;

  return (
    <div className="min-h-screen bg-stone-100" role="status" aria-live="polite">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-stone-200 bg-white p-5 lg:block">
          <div className="flex items-center gap-3 border-b border-stone-100 pb-5">
            <SkeletonBlock className="h-11 w-11 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <SkeletonBlock className="h-3 w-28" />
              <SkeletonBlock className="h-2.5 w-20" />
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {[78, 62, 85, 70, 80, 58, 74].map((width, index) => (
              <div key={`${width}-${index}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                <SkeletonBlock className="h-8 w-8 rounded-lg" />
                <SkeletonBlock className="h-3" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-white px-5 sm:px-7">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 lg:hidden" />
              <SkeletonBlock className="h-4 w-36" />
            </div>
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-9 w-9 rounded-full" />
              <SkeletonBlock className="hidden h-9 w-28 sm:block" />
            </div>
          </header>

          <main className="mx-auto max-w-7xl space-y-6 p-5 sm:p-7">
            <div className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-500">
                  {checking ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <WifiOff className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800">
                    {checking ? 'Reconnecting to SMaRT-PDM' : 'Connection interrupted'}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {checking
                      ? 'Restoring the latest page data…'
                      : 'Your work is paused until the server is reachable.'}
                  </p>
                </div>
              </div>
              {!checking ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 text-xs font-semibold text-white hover:bg-stone-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Try again
                </button>
              ) : null}
            </div>

            <div className="space-y-3">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-8 w-72 max-w-full" />
              <SkeletonBlock className="h-3 w-96 max-w-full" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="rounded-2xl border border-stone-200 bg-white p-5">
                  <SkeletonBlock className="h-10 w-10" />
                  <SkeletonBlock className="mt-5 h-7 w-20" />
                  <SkeletonBlock className="mt-3 h-3 w-28" />
                </div>
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <SkeletonBlock className="h-4 w-40" />
                    <SkeletonBlock className="h-3 w-64 max-w-full" />
                  </div>
                  <SkeletonBlock className="h-9 w-24" />
                </div>
                <div className="mt-6 space-y-3">
                  {[0, 1, 2, 3, 4].map((item) => (
                    <SkeletonBlock key={item} className="h-14 w-full" />
                  ))}
                </div>
              </div>
              <div className="space-y-5">
                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <SkeletonBlock className="h-4 w-32" />
                  <SkeletonBlock className="mt-5 h-24 w-full" />
                  <SkeletonBlock className="mt-3 h-24 w-full" />
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="mt-5 h-32 w-full" />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
      <span className="sr-only">
        {checking ? 'Checking connection to the server.' : 'The server is currently unreachable.'}
      </span>
    </div>
  );
}

function LandingLogoLoader({ status, isRetrying, onRetry }) {
  const checking = status === 'checking' || isRetrying;

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[#faf7f2] px-6"
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
              The landing page cannot reach the server right now.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#4b2a1a] px-5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#5c3522] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-800/40 focus-visible:ring-offset-2"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </>
        ) : null}

        <span className="sr-only">
          {checking
            ? 'Loading the SMaRT-PDM landing page.'
            : 'The SMaRT-PDM server is currently unreachable.'}
        </span>
      </div>
    </div>
  );
}

export default function NetworkGate({ children }) {
  const contentRef = useRef(null);
  const [status, setStatus] = useState('checking');
  const [isRetrying, setIsRetrying] = useState(false);

  const checkConnection = useCallback(async ({ manual = false } = {}) => {
    const checkStartedAt = Date.now();
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
      const landingPath = ['/', '/landing'].includes(window.location.pathname);

      if (connected && landingPath) {
        const navigationEntry = performance.getEntriesByType('navigation')[0];
        const minimumDuration = navigationEntry?.type === 'reload'
          ? LANDING_REFRESH_LOADER_MIN_MS
          : LANDING_VISIT_LOADER_MIN_MS;
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
  const landingPath = ['/', '/landing'].includes(window.location.pathname);

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
      <div ref={contentRef} className={blocked ? 'hidden' : undefined}>
        {children}
      </div>

      {blocked && landingPath ? (
        <LandingLogoLoader
          status={status}
          isRetrying={isRetrying}
          onRetry={() => checkConnection({ manual: true })}
        />
      ) : null}

      {blocked && !landingPath ? (
        <NetworkSkeleton
          status={status}
          isRetrying={isRetrying}
          onRetry={() => checkConnection({ manual: true })}
        />
      ) : null}
    </>
  );
}
