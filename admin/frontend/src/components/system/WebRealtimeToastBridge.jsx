// SMaRT-PDM: Web Realtime Toast Bridge — Web Realtime Toast Bridge (admin frontend component); renders reusable UI and handles local interactions.
import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { useSocketEvent } from '@/hooks/useSocket';
import { getStoredPortalSession } from '@/utils/authStorage';

const TOAST_DURATION_MS = 3000;
const MAX_PREVIEW_LENGTH = 180;

// getPortalNameFromPath: reads and returns get portal name from path for the Web Realtime Toast Bridge flow.
function getPortalNameFromPath(pathname = '') {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/sdo')) return 'sdo';
  if (pathname.startsWith('/guidance')) return 'guidance';
  if (pathname.startsWith('/pd')) return 'pd';
  if (pathname.startsWith('/ro-coordinator')) return 'ro_coordinator';
  return null;
}

// decodeJwtPayload: handles decode jwt payload for the Web Realtime Toast Bridge flow.
function decodeJwtPayload(token = '') {
  try {
    const parts = String(token || '').trim().split('.');
    if (parts.length < 2) return {};

    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';

    return JSON.parse(globalThis.atob(base64)) || {};
  } catch {
    return {};
  }
}

// getCurrentUserId: reads and returns get current user id for the Web Realtime Toast Bridge flow.
function getCurrentUserId(session) {
  const payload = decodeJwtPayload(session?.token || '');

  return String(
    payload?.userId ||
      payload?.user_id ||
      payload?.sub ||
      payload?.id ||
      ''
  ).trim();
}

// unwrapPayload: handles unwrap payload for the Web Realtime Toast Bridge flow.
function unwrapPayload(raw, nestedKey) {
  if (!raw || typeof raw !== 'object') return {};

  const nested = raw[nestedKey];
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested;
  }

  return raw;
}

// pickText: handles pick text for the Web Realtime Toast Bridge flow.
function pickText(source, keys = []) {
  for (const key of keys) {
    const value = source?.[key];
    if (value === null || value === undefined) continue;

    const text = String(value).trim();
    if (text) return text;
  }

  return '';
}

// clipPreview: handles clip preview for the Web Realtime Toast Bridge flow.
function clipPreview(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= MAX_PREVIEW_LENGTH) return text;
  return `${text.slice(0, MAX_PREVIEW_LENGTH - 1).trimEnd()}…`;
}

// getCurrentPortalSession: reads and returns get current portal session for the Web Realtime Toast Bridge flow.
function getCurrentPortalSession(pathname) {
  const portalName = getPortalNameFromPath(pathname);
  if (!portalName) return null;

  const session = getStoredPortalSession(portalName);
  if (!session?.token) return null;

  return session;
}

export default function WebRealtimeToastBridge() {
  const location = useLocation();

  const showNotificationToast = useCallback(
    (rawPayload = {}) => {
      const session = getCurrentPortalSession(location.pathname);
      if (!session) return;

      const payload = unwrapPayload(rawPayload, 'notification');
      const currentUserId = getCurrentUserId(session);
      const targetUserId = pickText(payload, ['user_id', 'userId']);

      if (targetUserId && currentUserId && targetUserId !== currentUserId) {
        return;
      }

      const notificationId = pickText(payload, [
        'notification_id',
        'notificationId',
        'id',
      ]);

      const title =
        pickText(payload, ['title', 'type']) || 'New notification';

      const description =
        clipPreview(
          pickText(payload, ['message', 'body', 'description'])
        ) || 'You have a new SMaRT-PDM notification.';

      const createdAt = pickText(payload, ['created_at', 'createdAt']);
      const toastId = notificationId
        ? `realtime-notification:${notificationId}`
        : `realtime-notification:${createdAt}:${title}:${description}`;

      toast(title, {
        id: toastId,
        description,
        duration: TOAST_DURATION_MS,
      });
    },
    [location.pathname]
  );

  useSocketEvent(
    'notification:new',
    showNotificationToast,
    [showNotificationToast]
  );

  return null;
}
