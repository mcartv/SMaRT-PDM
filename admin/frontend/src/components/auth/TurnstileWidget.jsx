import { useEffect, useRef } from 'react';

const TURNSTILE_SCRIPT_ID = 'smartpdm-cloudflare-turnstile';
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise = null;

function loadTurnstile() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile requires a browser environment.'));
  }

  if (window.turnstile) {
    return Promise.resolve(window.turnstile);
  }

  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        reject(new Error('Cloudflare Turnstile did not initialize.'));
      }
    };

    let script = document.getElementById(TURNSTILE_SCRIPT_ID);

    if (!script) {
      script = document.createElement('script');
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener('load', finish, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Unable to load Cloudflare Turnstile.')),
      { once: true }
    );

    // The script may have finished loading before listeners were attached.
    if (window.turnstile) finish();
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

export default function TurnstileWidget({
  siteKey,
  resetSignal = 0,
  onTokenChange,
  onStatusChange,
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const tokenCallbackRef = useRef(onTokenChange);
  const statusCallbackRef = useRef(onStatusChange);

  useEffect(() => {
    tokenCallbackRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    statusCallbackRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    let cancelled = false;
    let turnstileApi = null;

    tokenCallbackRef.current?.('');

    if (!siteKey) {
      statusCallbackRef.current?.('misconfigured');
      return undefined;
    }

    statusCallbackRef.current?.('loading');

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;

        turnstileApi = turnstile;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: 'login',
          theme: 'light',
          size: 'flexible',
          appearance: 'interaction-only',
          retry: 'auto',
          'refresh-expired': 'auto',
          'refresh-timeout': 'auto',
          'response-field': false,
          callback: (token) => {
            if (cancelled) return;
            tokenCallbackRef.current?.(token);
            statusCallbackRef.current?.('verified');
          },
          'expired-callback': () => {
            if (cancelled) return;
            tokenCallbackRef.current?.('');
            statusCallbackRef.current?.('loading');
          },
          'timeout-callback': () => {
            if (cancelled) return;
            tokenCallbackRef.current?.('');
            statusCallbackRef.current?.('loading');
          },
          'error-callback': () => {
            if (cancelled) return true;
            tokenCallbackRef.current?.('');
            statusCallbackRef.current?.('error');
            return true;
          },
          'unsupported-callback': () => {
            if (cancelled) return;
            tokenCallbackRef.current?.('');
            statusCallbackRef.current?.('unsupported');
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        tokenCallbackRef.current?.('');
        statusCallbackRef.current?.('error');
      });

    return () => {
      cancelled = true;

      if (turnstileApi && widgetIdRef.current !== null) {
        try {
          turnstileApi.remove(widgetIdRef.current);
        } catch {
          // The widget may already have been removed by a page transition.
        }
      }

      widgetIdRef.current = null;
    };
  }, [siteKey, resetSignal]);

  return <div ref={containerRef} className="w-full" aria-label="Security verification" />;
}
