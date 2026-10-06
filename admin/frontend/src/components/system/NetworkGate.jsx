// SMaRT-PDM: Network Gate — Network Gate (admin frontend component); renders reusable UI and handles local interactions.
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, ServerOff, WifiOff } from 'lucide-react';
import { buildApiUrl } from '@/api';
import noConnectionIllustration from '@/assets/no-connection.png';
import pdmLogo from '@/assets/pdm-logo.png';
import './NetworkGate.css';

const CHECK_INTERVAL_MS = 15_000;
const CHECK_TIMEOUT_MS = 12_000;
const PUBLIC_CONNECT_GRACE_MS = 90_000;
const PUBLIC_CONNECT_RETRY_MS = 3_000;
const SLOW_CONNECTION_MS = 10_000;
const ENTRY_NETWORK_GATE_MIN_MS = 650;
const PUBLIC_REFRESH_LOADER_MIN_MS = 1_500;
const PUBLIC_VISIT_LOADER_MIN_MS = 450;
const SUCCESS_TRANSITION_MS = 300;
const PUBLIC_CHECK_PATHS = new Set([
  '/', '/landing', '/login', '/admin/login', '/admin/forgot-password',
  '/pd/login', '/guidance/login', '/sdo/login', '/ro-coordinator/login',
  '/about', '/about/pdm', '/about/smart-pdm', '/about/developers',
  '/how-to-apply', '/how-to-apply/process', '/how-to-apply/requirements',
  '/how-to-apply/obligations', '/privacy', '/data-processing-consent', '/terms',
]);

const CONNECTION_COPY = {
  loading: {
    title: 'Loading SMaRT-PDM',
    description: 'Preparing your portal. Please wait a moment.',
  },
  slow: {
    title: 'Taking a little longer',
    description: 'The server is taking longer than usual to respond. Please wait while we reconnect.',
  },
  offline: {
    title: 'No internet connection',
    description: 'Check your internet connection, then try again.',
  },
  server_error: {
    title: 'Unable to connect',
    description: 'SMaRT-PDM is temporarily unavailable. Please try again in a moment.',
  },
  success: {
    title: 'SMaRT-PDM is ready',
    description: 'Opening your portal.',
  },
};

// normalizePath: normalizes normalize path for the Network Gate flow.
function normalizePath(pathname = window.location.pathname) {
  return String(pathname || '/').replace(/\/+$/, '') || '/';
}

// isPublicCheckPath: checks whether is public check path for the Network Gate flow.
function isPublicCheckPath(pathname = window.location.pathname) {
  const normalized = normalizePath(pathname);
  return PUBLIC_CHECK_PATHS.has(normalized) || normalized.startsWith('/endorsement/verify/');
}

// isInitialWebsiteEntry: checks whether is initial website entry for the Network Gate flow.
function isInitialWebsiteEntry(pathname = window.location.pathname) {
  if (!isPublicCheckPath(pathname)) return false;
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  return !navigationEntry || navigationEntry.type === 'navigate';
}

// wait: handles wait for the Network Gate flow.
function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

// PublicLogoLoader: handles public logo loader for the Network Gate flow.
export function PublicLogoLoader({ status = 'loading', isRetrying = false, onRetry, onGoBack }) {
  const visualStatus = status === 'checking' ? 'loading' : status;
  const resolvedStatus = CONNECTION_COPY[visualStatus] ? visualStatus : 'loading';
  const copy = CONNECTION_COPY[resolvedStatus];
  const isError = resolvedStatus === 'offline' || resolvedStatus === 'server_error';
  const isActive = resolvedStatus === 'loading' || resolvedStatus === 'slow' || isRetrying;

  return (
    <div
      className={`fixed inset-0 z-[200] flex min-h-[100dvh] min-w-[280px] items-center justify-center overflow-hidden bg-white px-4 py-8 text-stone-900 sm:px-6 ${resolvedStatus === 'success' ? 'smartpdm-screen-exit' : ''}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-busy={isActive}
    >
      <main className={`relative z-10 flex w-full flex-col items-center text-center ${isError ? 'max-w-3xl' : 'max-w-md'}`}>
        {isError ? (
          <img
            src={noConnectionIllustration}
            alt=""
            draggable="false"
            className={`smartpdm-error-illustration mb-1 aspect-[3/2] w-full max-w-[430px] select-none object-cover sm:max-w-[520px] ${isRetrying ? 'is-retrying' : ''}`}
            aria-hidden="true"
          />
        ) : (
          <div className="smartpdm-loader-enter relative h-[72px] w-[72px] sm:h-[88px] sm:w-[88px] lg:h-[90px] lg:w-[90px]" aria-hidden="true">
            {isActive ? (
              <>
                <span className="smartpdm-logo-ripple absolute inset-1 rounded-full border border-[#D18B16]/30" />
                <span className="smartpdm-logo-ripple smartpdm-logo-ripple--delayed absolute inset-1 rounded-full border border-amber-300/20" />
              </>
            ) : null}
            <span className={`absolute inset-1 rounded-full border border-stone-200/60 bg-white shadow-[0_14px_36px_-22px_rgba(15,23,42,0.18)] ${isActive ? 'smartpdm-logo-plate' : ''}`} />
            <img src={pdmLogo} alt="" className={`relative h-full w-full select-none object-contain ${isActive ? 'smartpdm-logo-pulse' : ''}`} />
          </div>
        )}

        {isError ? (
          <div className="w-full" key={resolvedStatus}>
            <span className="mx-auto mb-4 block h-1 w-12 rounded-full bg-amber-400" aria-hidden="true" />
            <h1 className="smartpdm-title-enter mx-auto max-w-sm text-balance text-2xl font-extrabold leading-tight tracking-[-0.03em] text-[#3b2418] sm:text-3xl">{copy.title}</h1>
            <p className="smartpdm-description-enter mx-auto mt-3 max-w-sm text-pretty text-sm leading-6 text-stone-600 sm:text-[15px]">{copy.description}</p>
            <div className="smartpdm-button-enter mx-auto mt-6 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                className="inline-flex min-h-11 min-w-36 items-center justify-center gap-2 rounded-xl bg-[#704127] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-px hover:bg-[#835033] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
              >
                {isRetrying ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                {isRetrying ? 'Retrying...' : 'Try Again'}
              </button>
              {onGoBack ? (
                <button type="button" onClick={onGoBack} disabled={isRetrying} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#704127]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#704127] shadow-sm transition duration-200 hover:-translate-y-px hover:bg-stone-50 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
                  Go Back
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <span className="sr-only">{copy.title}. {copy.description}</span>
      </main>
    </div>
  );
}

export default function NetworkGate({ children }) {
  const publicPathAtMountRef = useRef(isPublicCheckPath());
  const contentRef = useRef(null);
  const activeCheckRef = useRef(null);
  const initialEntryRef = useRef(isInitialWebsiteEntry());
  const hasConnectedRef = useRef(!publicPathAtMountRef.current);
  const connectionStateRef = useRef(publicPathAtMountRef.current ? 'loading' : 'ready');
  const [connectionState, setConnectionState] = useState(connectionStateRef.current);
  const [isRetrying, setIsRetrying] = useState(false);

  const updateConnectionState = useCallback((nextState) => {
    connectionStateRef.current = nextState;
    setConnectionState(nextState);
  }, []);

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

    // runCheck: handles run check for the Network Gate flow.
    const runCheck = async () => {
      const checkStartedAt = Date.now();
      const publicCheckPath = isPublicCheckPath();
      const foregroundCheck = publicCheckPath && !hasConnectedRef.current;
      let slowTimerId = null;

      if (manual) setIsRetrying(true);
      if (foregroundCheck && !manual) {
        updateConnectionState('loading');
        slowTimerId = window.setTimeout(() => {
          if (connectionStateRef.current === 'loading') updateConnectionState('slow');
        }, SLOW_CONNECTION_MS);
      }

      try {
        if (!navigator.onLine) {
          updateConnectionState('offline');
          return false;
        }

        while (navigator.onLine) {
          const controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
          let connected = false;

          try {
            const response = await fetch(
              `${buildApiUrl('/api/health')}?networkCheck=${Date.now()}`,
              {
                method: 'GET', cache: 'no-store', signal: controller.signal,
                headers: { Accept: 'application/json' },
              }
            );
            // Authentication responses still prove the API is reachable. They
            // belong to the auth flow and are never server-connection errors.
            connected = response.ok || response.status === 401 || response.status === 403;
          } catch {
            connected = false;
          } finally {
            window.clearTimeout(timeoutId);
          }

          if (connected) {
            if (publicCheckPath) {
              const navigationEntry = performance.getEntriesByType('navigation')[0];
              const minimumDuration = initialEntryRef.current
                ? ENTRY_NETWORK_GATE_MIN_MS
                : navigationEntry?.type === 'reload'
                  ? PUBLIC_REFRESH_LOADER_MIN_MS
                  : PUBLIC_VISIT_LOADER_MIN_MS;
              const remainingDelay = minimumDuration - (Date.now() - checkStartedAt);
              if (remainingDelay > 0) await wait(remainingDelay);
            }

            const showSuccess = publicCheckPath && (
              foregroundCheck || manual
              || ['offline', 'server_error', 'slow', 'loading'].includes(connectionStateRef.current)
            );
            hasConnectedRef.current = true;
            initialEntryRef.current = false;

            if (showSuccess) {
              updateConnectionState('success');
              await wait(SUCCESS_TRANSITION_MS);
            }
            updateConnectionState('ready');
            return true;
          }

          const elapsed = Date.now() - checkStartedAt;
          if (!publicCheckPath || elapsed >= PUBLIC_CONNECT_GRACE_MS) {
            updateConnectionState(navigator.onLine ? 'server_error' : 'offline');
            return false;
          }
          await wait(Math.min(PUBLIC_CONNECT_RETRY_MS, PUBLIC_CONNECT_GRACE_MS - elapsed));
        }

        updateConnectionState('offline');
        return false;
      } finally {
        if (slowTimerId) window.clearTimeout(slowTimerId);
        if (manual) setIsRetrying(false);
      }
    };

    const checkPromise = runCheck();
    activeCheckRef.current = checkPromise;
    try {
      return await checkPromise;
    } finally {
      if (activeCheckRef.current === checkPromise) activeCheckRef.current = null;
    }
  }, [updateConnectionState]);

  useEffect(() => {
    if (isPublicCheckPath()) void checkConnection();
    // handleOnline: handles handle online for the Network Gate flow.
    const handleOnline = () => void checkConnection();
    // handleOffline: handles handle offline for the Network Gate flow.
    const handleOffline = () => updateConnectionState('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const intervalId = window.setInterval(() => void checkConnection(), CHECK_INTERVAL_MS);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(intervalId);
    };
  }, [checkConnection, updateConnectionState]);

  const publicCheckPath = isPublicCheckPath();
  const gateVisible = publicCheckPath && connectionState !== 'ready';
  const contentConcealed = publicCheckPath && !['success', 'ready'].includes(connectionState);
  const privateConnectionInterrupted = !publicCheckPath
    && (connectionState === 'offline' || connectionState === 'server_error');

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    content.inert = gateVisible;
    content.setAttribute('aria-hidden', gateVisible ? 'true' : 'false');
    if (gateVisible) document.activeElement?.blur?.();
    return () => {
      content.inert = false;
      content.removeAttribute('aria-hidden');
    };
  }, [gateVisible]);

  return (
    <>
      <div ref={contentRef} className={`smartpdm-gated-content ${contentConcealed ? 'is-concealed' : 'is-ready'}`}>
        {children}
      </div>

      {gateVisible ? (
        <PublicLogoLoader
          status={connectionState}
          isRetrying={isRetrying}
          onRetry={() => checkConnection({ manual: true })}
        />
      ) : null}

      {privateConnectionInterrupted ? (
        <div className="fixed left-1/2 top-4 z-[120] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-lg" role="status" aria-live="polite">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
            {connectionState === 'offline' ? <WifiOff className="h-4 w-4" aria-hidden="true" /> : <ServerOff className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-stone-900">
              {isRetrying ? 'Reconnecting to SMaRT-PDM...' : CONNECTION_COPY[connectionState].title}
            </p>
            <p className="mt-0.5 text-[11px] text-stone-500">Your current page stays open while the server reconnects.</p>
          </div>
          <button type="button" onClick={() => checkConnection({ manual: true })} disabled={isRetrying} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 text-[11px] font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${isRetrying ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      ) : null}
    </>
  );
}
