import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { buildApiUrl } from '@/api';
import pdmLogo from '@/assets/pdm-logo.png';

const CHECK_INTERVAL_MS = 15_000;
const CHECK_TIMEOUT_MS = 12_000;
const PUBLIC_CONNECT_GRACE_MS = 90_000;
const PUBLIC_CONNECT_RETRY_MS = 3_000;
const SLOW_CONNECTION_MS = 2_500;
const ENTRY_NETWORK_GATE_MIN_MS = 650;
const POST_CONNECT_LOGO_LOADER_MS = 900;
const PUBLIC_REFRESH_LOADER_MIN_MS = 1_500;
const PUBLIC_VISIT_LOADER_MIN_MS = 450;
const PUBLIC_CHECK_PATHS = new Set([
  '/',
  '/landing',
  '/login',
  '/admin/login',
  '/admin/forgot-password',
  '/pd/login',
  '/guidance/login',
  '/sdo/login',
  '/ro-coordinator/login',
  '/about',
  '/about/pdm',
  '/about/smart-pdm',
  '/about/developers',
  '/how-to-apply',
  '/how-to-apply/process',
  '/how-to-apply/requirements',
  '/how-to-apply/obligations',
  '/privacy',
  '/data-processing-consent',
  '/terms',
]);

function normalizePath(pathname = window.location.pathname) {
  return String(pathname || '/').replace(/\/+$/, '') || '/';
}

function isPublicCheckPath(pathname = window.location.pathname) {
  const normalized = normalizePath(pathname);
  return PUBLIC_CHECK_PATHS.has(normalized) || normalized.startsWith('/endorsement/verify/');
}

function isInitialWebsiteEntry(pathname = window.location.pathname) {
  if (!isPublicCheckPath(pathname)) return false;
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  return !navigationEntry || navigationEntry.type === 'navigate';
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function PublicLogoLoader({ status, isRetrying, onRetry }) {
  const checking = status === 'checking' || isRetrying;

  return (
    <div
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f8f7f4] px-4 py-8 sm:px-6"
      role="status"
      aria-live="polite"
      aria-busy={checking}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#6f3f24] via-[#d6a800] to-[#6f3f24]"
        aria-hidden="true"
      />

      <div className="w-full max-w-[420px]">
        <div className="rounded-[26px] border border-stone-200/90 bg-white px-6 py-8 text-center shadow-[0_22px_60px_-34px_rgba(75,48,30,0.38)] sm:px-8 sm:py-9">
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
            {checking ? (
              <>
                <span
                  className="absolute inset-[7px] rounded-full border border-[#704127]/[0.08] bg-[#704127]/[0.025]"
                  aria-hidden="true"
                />
                <span
                  className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#704127]/10 border-r-[#704127]/45 border-t-[#704127] motion-reduce:animate-none"
                  aria-hidden="true"
                  style={{
                    boxShadow: '0 0 0 1px rgba(112, 65, 39, 0.02), 0 8px 22px rgba(112, 65, 39, 0.08)',
                    animationDuration: '1.15s',
                  }}
                />
              </>
            ) : (
              <>
                <span
                  className="absolute inset-[7px] rounded-full border border-[#704127]/[0.08] bg-[#704127]/[0.025]"
                  aria-hidden="true"
                />
                <span
                  className="absolute inset-[17px] rounded-full border border-stone-200/80 bg-white"
                  aria-hidden="true"
                />
              </>
            )}

            <img
              src={pdmLogo}
              alt=""
              aria-hidden="true"
              className="relative h-[68px] w-[68px] object-contain"
            />
          </div>

          {checking ? (
            <div className="mt-5">
              <p className="text-[17px] font-semibold tracking-[-0.015em] text-stone-900">
                Connecting to SMaRT-PDM
              </p>
              <p className="mx-auto mt-2 max-w-[310px] text-[13px] leading-5 text-stone-500">
                Establishing a secure connection to the server. This may take a little longer while the server starts.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                Connection unavailable
              </div>

              <h1 className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-stone-900">
                Connection interrupted
              </h1>
              <p className="mx-auto mt-2 max-w-[320px] text-[13px] leading-5 text-stone-500">
                SMaRT-PDM cannot reach the server right now. Check your connection, then try again.
              </p>

              <button
                type="button"
                onClick={onRetry}
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#704127] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5f351f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b98a58]/40 focus-visible:ring-offset-2 active:bg-[#542f1c]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>

              <p className="mt-3 text-[11px] leading-4 text-stone-400">
                Your current session and saved records are not affected.
              </p>
            </>
          )}

          <span className="sr-only">
            {checking
              ? 'Connecting to SMaRT-PDM.'
              : 'The SMaRT-PDM server is currently unreachable.'}
          </span>
        </div>

        <p className="mt-4 text-center text-[11px] text-stone-400">
          SMaRT-PDM · Pambayang Dalubhasaan ng Marilao
        </p>
      </div>
    </div>
  );
}

function PlainPdmLogoLoader() {
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center bg-[#f8f7f4]"
      role="status"
      aria-label="Loading SMaRT-PDM"
      aria-busy="true"
    >
      <style>{`
        @keyframes smartPdmLogoBlink {
          0%, 100% {
            opacity: 0.34;
            transform: scale(0.985);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes smartPdmLoaderCircleBlink {
          0%, 100% {
            opacity: 0.42;
            transform: scale(0.99);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>

      <div className="relative flex h-[116px] w-[116px] items-center justify-center">
        <span
          className="absolute inset-0 rounded-full motion-reduce:!animate-none"
          aria-hidden="true"
          style={{
            background: 'rgba(112, 65, 39, 0.028)',
            border: '1px solid rgba(112, 65, 39, 0.05)',
            boxShadow: '0 12px 34px rgba(78, 45, 27, 0.035)',
            animation: 'smartPdmLoaderCircleBlink 3.2s ease-in-out infinite',
          }}
        />

        <img
          src={pdmLogo}
          alt=""
          aria-hidden="true"
          className="relative h-[72px] w-[72px] object-contain motion-reduce:!animate-none"
          style={{
            animation: 'smartPdmLogoBlink 2.8s ease-in-out infinite',
            willChange: 'opacity, transform',
          }}
        />
      </div>
    </div>
  );
}

export default function NetworkGate({ children }) {
  const contentRef = useRef(null);
  const activeCheckRef = useRef(null);
  const initialEntryRef = useRef(isInitialWebsiteEntry());
  const [status, setStatus] = useState(() => (isPublicCheckPath() ? 'checking' : 'online'));
  const [isRetrying, setIsRetrying] = useState(false);
  const [slowConnection, setSlowConnection] = useState(false);
  const [showEntryNetworkGate, setShowEntryNetworkGate] = useState(initialEntryRef.current);

  const checkConnection = useCallback(async ({ manual = false } = {}) => {
    if (activeCheckRef.current) {
      if (!manual) return activeCheckRef.current;

      setIsRetrying(true);
      try {
        return await activeCheckRef.current;
      } finally {
        setIsRetrying(false);
      }
    }

    const runCheck = async () => {
      const checkStartedAt = Date.now();
      const publicCheckPath = isPublicCheckPath();
      setSlowConnection(false);
      if (manual) setIsRetrying(true);

      try {
        if (!navigator.onLine) {
          setStatus('offline');
          return false;
        }

        while (navigator.onLine) {
          const attemptStartedAt = Date.now();
          const controller = new AbortController();
          const timeoutId = window.setTimeout(
            () => controller.abort(),
            CHECK_TIMEOUT_MS
          );

          let connected = false;

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
            connected = response.ok;
          } catch {
            connected = false;
          } finally {
            window.clearTimeout(timeoutId);
          }

          const attemptElapsed = Date.now() - attemptStartedAt;

          if (connected) {
            setSlowConnection(attemptElapsed >= SLOW_CONNECTION_MS);

            if (publicCheckPath) {
              const navigationEntry = performance.getEntriesByType('navigation')[0];
              const entryGateActive = initialEntryRef.current;
              const minimumDuration = entryGateActive
                ? ENTRY_NETWORK_GATE_MIN_MS
                : navigationEntry?.type === 'reload'
                  ? PUBLIC_REFRESH_LOADER_MIN_MS
                  : PUBLIC_VISIT_LOADER_MIN_MS;

              const remainingDelay = minimumDuration - (Date.now() - checkStartedAt);
              if (remainingDelay > 0) await wait(remainingDelay);

              // Initial URL entry deliberately uses two stages:
              // 1) full connection gate, then 2) the minimal blinking PDM logo.
              if (entryGateActive) {
                initialEntryRef.current = false;
                setShowEntryNetworkGate(false);
                await wait(POST_CONNECT_LOGO_LOADER_MS);
              }
            }

            setStatus('online');
            return true;
          }

          const elapsed = Date.now() - checkStartedAt;
          const shouldKeepWaiting = publicCheckPath
            && elapsed < PUBLIC_CONNECT_GRACE_MS;

          if (!shouldKeepWaiting) {
            setStatus('offline');
            return false;
          }

          await wait(Math.min(
            PUBLIC_CONNECT_RETRY_MS,
            PUBLIC_CONNECT_GRACE_MS - elapsed
          ));
        }

        setStatus('offline');
        return false;
      } finally {
        if (manual) setIsRetrying(false);
      }
    };

    const checkPromise = runCheck();
    activeCheckRef.current = checkPromise;

    try {
      return await checkPromise;
    } finally {
      if (activeCheckRef.current === checkPromise) {
        activeCheckRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    // Public pages check the API before rendering. A true browser entry uses
    // the full connection gate first, then transitions briefly to the minimal
    // blinking PDM-logo loader before the page is revealed. Reloads and later
    // public loading checks use only the minimal logo state. Protected routes
    // keep their own session/connection handling and are not blocked here.
    if (isPublicCheckPath()) checkConnection();

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

  const publicCheckPath = isPublicCheckPath();
  const blocked = publicCheckPath && status !== 'online';
  const privateConnectionInterrupted = !publicCheckPath && status === 'offline';

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
        showEntryNetworkGate ? (
          <PublicLogoLoader
            status={status}
            isRetrying={isRetrying}
            onRetry={() => checkConnection({ manual: true })}
          />
        ) : (
          <PlainPdmLogoLoader />
        )
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
