import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { buildApiUrl } from '@/api';

const VISITOR_ID_KEY = 'smartpdm_public_visitor_id';
const LAST_PING_KEY = 'smartpdm_public_visit_last_ping';
const PING_INTERVAL_MS = 5 * 60 * 1000;
let publicVisitInFlight = false;
let fallbackVisitorId = null;
let fallbackLastPingAt = 0;

const PUBLIC_PATHS = [
  '/landing',
  '/about',
  '/how-to-apply',
  '/privacy',
  '/terms',
  '/login',
  '/admin/login',
  '/admin/forgot-password',
  '/endorsement/verify',
];

function isPublicWebPath(pathname) {
  const path = String(pathname || '/');
  return PUBLIC_PATHS.some((entry) => path === entry || path.startsWith(`${entry}/`));
}

function createVisitorId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 18)}`;
}

function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) return existing;

    const created = createVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, created);
    return created;
  } catch {
    // Keep one anonymous ID for this page session when privacy settings block
    // localStorage. Route changes must not create additional unique visitors.
    fallbackVisitorId ||= createVisitorId();
    return fallbackVisitorId;
  }
}

function getLastPingAt() {
  try {
    return Number(localStorage.getItem(LAST_PING_KEY) || 0);
  } catch {
    return fallbackLastPingAt;
  }
}

function rememberLastPing() {
  const timestamp = Date.now();
  fallbackLastPingAt = timestamp;

  try {
    localStorage.setItem(LAST_PING_KEY, String(timestamp));
  } catch {
    // The in-memory timestamp still throttles this page session.
  }
}

export default function PublicVisitorTracker() {
  const location = useLocation();

  useEffect(() => {
    if (!isPublicWebPath(location.pathname)) return;

    const now = Date.now();
    const lastPing = getLastPingAt();
    if (Number.isFinite(lastPing) && now - lastPing < PING_INTERVAL_MS) return;

    // React StrictMode mounts effects twice in development. Do not abort the
    // first registration during its cleanup and do not start a duplicate while
    // the first request is still in flight. The unique visitor key remains the
    // browser identifier, so normal route changes do not inflate visitor count.
    if (publicVisitInFlight) return;
    publicVisitInFlight = true;

    const visitorId = getVisitorId();

    void fetch(buildApiUrl('/api/system-maintenance/public-visit'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: visitorId,
        path: location.pathname,
      }),
      keepalive: true,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Visitor registration failed with ${response.status}`);
        }

        // Only throttle future registrations after the backend actually
        // accepted this browser. A failed/offline request can retry later.
        rememberLastPing();
        window.dispatchEvent(new CustomEvent('smartpdm:public-visit-recorded'));
      })
      .catch(() => {
        // Visitor diagnostics must never interfere with public-page rendering.
      })
      .finally(() => {
        publicVisitInFlight = false;
      });
  }, [location.pathname]);

  return null;
}
