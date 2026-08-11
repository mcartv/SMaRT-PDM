import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiUrl } from '@/config/api';
import { useSocketListener } from './useSocket';

function normalizeNotification(raw = {}) {
  return {
    notification_id: raw.notification_id || raw.notificationId || raw.id || '',
    user_id: raw.user_id || raw.userId || '',
    type: raw.type || 'General',
    title: raw.title || 'Notification',
    message: raw.message || '',
    reference_id: raw.reference_id || raw.referenceId || null,
    reference_type: raw.reference_type || raw.referenceType || null,
    is_read: raw.is_read === true,
    created_at: raw.created_at || raw.createdAt || null,
  };
}


function isEndorsementNotificationForPortal(portalRootPath, notification) {
  const referenceType = String(notification.reference_type || '').toLowerCase();
  if (!['endorsement_slip', 'endorsement', 'endorsement_stage'].includes(referenceType)) {
    return false;
  }

  const descriptor = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();

  if (portalRootPath === '/sdo') {
    return descriptor.includes('sdo');
  }

  if (portalRootPath === '/guidance') {
    return descriptor.includes('guidance');
  }

  if (portalRootPath === '/pd') {
    return descriptor.includes('pd') || descriptor.includes('program director');
  }

  return false;
}

function isRelevantPortalNotification(
  portalRootPath,
  notification,
  { hasRoCoordinatorAccess = false } = {}
) {
  if (portalRootPath === '/admin') return true;

  const referenceType = String(notification.reference_type || '').toLowerCase();
  const type = String(notification.type || '').toLowerCase();

  const common = new Set([
    'staff_account',
    'staff_profile',
    'personal_reminder',
  ]);

  if (common.has(referenceType) || type === 'security' || type === 'account activity') {
    return true;
  }

  if (['/sdo', '/guidance', '/pd'].includes(portalRootPath)) {
    if (isEndorsementNotificationForPortal(portalRootPath, notification)) {
      return true;
    }
  }

  const roReferenceTypes = new Set([
    'return_of_obligation',
    'ro_time_log',
    'ro_scholar_request',
  ]);

  if (roReferenceTypes.has(referenceType)) {
    return (
      hasRoCoordinatorAccess === true &&
      ['/sdo', '/guidance', '/pd', '/ro-coordinator'].includes(portalRootPath)
    );
  }

  return false;
}

function sortNotifications(items = []) {
  return [...items].sort((a, b) => {
    const aUnread = a.is_read !== true ? 1 : 0;
    const bUnread = b.is_read !== true ? 1 : 0;
    if (aUnread !== bUnread) {
      return bUnread - aUnread;
    }

    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
}

function formatNotificationTime(value) {
  if (!value) return 'Unknown time';

  const date = new Date(value);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) return 'Unknown time';

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  if (diffHours < 48) return 'Yesterday';

  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildNotificationTarget(portalRootPath, notification) {
  const referenceType = String(notification.reference_type || '').toLowerCase();
  const referenceId = notification.reference_id;

  if (['endorsement_slip', 'endorsement', 'endorsement_stage'].includes(referenceType) && referenceId) {
    return `${portalRootPath}/endorsements/${referenceId}`;
  }

  if (referenceType === 'announcement') {
    return portalRootPath === '/admin' ? '/admin/announcements' : `${portalRootPath}/dashboard`;
  }

  if (referenceType === 'payout_batch') {
    return portalRootPath === '/admin' ? '/admin/payout' : `${portalRootPath}/dashboard`;
  }

  if (
    ['application', 'application_document', 'document_review'].includes(referenceType) &&
    referenceId &&
    portalRootPath === '/admin'
  ) {
    return `/admin/applications/${referenceId}/documents`;
  }

  if (
    referenceType === 'profile_photo_review' &&
    referenceId &&
    portalRootPath === '/admin'
  ) {
    return `/admin/profile-photos/${referenceId}`;
  }

  if (['staff_account', 'staff_profile'].includes(referenceType)) {
    if (portalRootPath === '/admin') {
      return referenceType === 'staff_profile'
        ? '/admin/adminprofile'
        : '/admin/maintenance';
    }

    return `${portalRootPath}/profile`;
  }

  if (['message', 'message_room', 'chat'].includes(referenceType) && portalRootPath === '/admin') {
    return '/admin/messages';
  }

  if (['scholar', 'student'].includes(referenceType) && portalRootPath === '/admin') {
    return '/admin/scholars';
  }

  if (referenceType === 'personal_reminder' && referenceId) {
    return `${portalRootPath}/dashboard`;
  }

  if (['return_of_obligation', 'ro_time_log', 'ro_scholar_request'].includes(referenceType)) {
    if (portalRootPath === '/admin') return '/admin/obligations';
    if (portalRootPath === '/ro-coordinator') return '/ro-coordinator/queue';
    if (['/sdo', '/guidance', '/pd'].includes(portalRootPath)) {
      return `${portalRootPath}/ro-requests`;
    }
    return `${portalRootPath}/dashboard`;
  }

  return null;
}

export default function usePortalNotifications({
  tokenStorageKey,
  portalRootPath,
  limit = 8,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [hasRoCoordinatorAccess, setHasRoCoordinatorAccess] = useState(false);

  const syncItems = useCallback((updater) => {
    setItems((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return sortNotifications(next);
    });
  }, []);

  const loadRoCoordinatorAccess = useCallback(async () => {
    if (portalRootPath === '/admin') {
      setHasRoCoordinatorAccess(false);
      return;
    }

    const token = sessionStorage.getItem(tokenStorageKey);
    if (!token) {
      setHasRoCoordinatorAccess(false);
      return;
    }

    try {
      const response = await fetch(buildApiUrl('/api/accounts/me'), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to resolve RO access.');
      }

      setHasRoCoordinatorAccess(payload?.data?.has_ro_coordinator_access === true);
    } catch (error) {
      console.error('NOTIFICATION RO CAPABILITY CHECK ERROR:', error);
      setHasRoCoordinatorAccess(false);
    }
  }, [portalRootPath, tokenStorageKey]);

  useEffect(() => {
    loadRoCoordinatorAccess();
  }, [loadRoCoordinatorAccess]);

  const loadNotifications = useCallback(async () => {
    const token = sessionStorage.getItem(tokenStorageKey);
    if (!token) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(buildApiUrl(`/api/notifications?limit=${limit}`), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to load notifications.');
      }

      const rows = Array.isArray(payload?.items) ? payload.items : [];
      const normalized = rows
        .map(normalizeNotification)
        .filter((item) =>
          isRelevantPortalNotification(portalRootPath, item, {
            hasRoCoordinatorAccess,
          })
        );
      setItems(sortNotifications(normalized));
    } catch (error) {
      console.error('NOTIFICATION LOAD ERROR:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [hasRoCoordinatorAccess, limit, portalRootPath, tokenStorageKey]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = useCallback(
    async (notificationId) => {
      if (!notificationId) return;

      const token = sessionStorage.getItem(tokenStorageKey);
      if (!token) return;

      try {
        const response = await fetch(buildApiUrl(`/api/notifications/${notificationId}/read`), {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || 'Failed to mark notification as read.');
        }

        const updated = normalizeNotification(payload?.notification || {});
        syncItems((current) =>
          current.map((item) =>
            item.notification_id === updated.notification_id ? { ...item, ...updated } : item
          )
        );
      } catch (error) {
        console.error('MARK NOTIFICATION READ ERROR:', error);
      }
    },
    [syncItems, tokenStorageKey]
  );

  const markAllAsRead = useCallback(async () => {
    const token = sessionStorage.getItem(tokenStorageKey);
    if (!token) return;

    try {
      setMarkingAll(true);
      const response = await fetch(buildApiUrl('/api/notifications/read-all'), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to mark all notifications as read.');
      }

      syncItems((current) => current.map((item) => ({ ...item, is_read: true })));
    } catch (error) {
      console.error('MARK ALL NOTIFICATIONS READ ERROR:', error);
    } finally {
      setMarkingAll(false);
    }
  }, [syncItems, tokenStorageKey]);

  useSocketListener({
    'notification:created': (raw) => {
      const next = normalizeNotification(raw);
      if (!isRelevantPortalNotification(portalRootPath, next, { hasRoCoordinatorAccess })) return;
      syncItems((current) =>
        [next, ...current.filter((item) => item.notification_id !== next.notification_id)].slice(0, limit)
      );
    },
    'notification:new': (raw) => {
      const next = normalizeNotification(raw);
      if (!isRelevantPortalNotification(portalRootPath, next, { hasRoCoordinatorAccess })) return;
      syncItems((current) =>
        [next, ...current.filter((item) => item.notification_id !== next.notification_id)].slice(0, limit)
      );
    },
    'notification:updated': (raw) => {
      const next = normalizeNotification(raw?.notification || raw);
      syncItems((current) =>
        current.map((item) =>
          item.notification_id === next.notification_id ? { ...item, ...next } : item
        )
      );
    },
    'notification:read-all': () => {
      syncItems((current) => current.map((item) => ({ ...item, is_read: true })));
    },
    'notification:deleted': (raw) => {
      const targetId = raw?.notificationId || raw?.notification_id;
      syncItems((current) => current.filter((item) => item.notification_id !== targetId));
    },
  });

  const unreadCount = useMemo(
    () => items.filter((item) => item.is_read !== true).length,
    [items]
  );

  const newNotifications = useMemo(
    () => items.filter((item) => item.is_read !== true),
    [items]
  );

  const earlierNotifications = useMemo(
    () => items.filter((item) => item.is_read === true),
    [items]
  );

  const openNotification = useCallback(
    async (notification, navigate) => {
      if (!notification) return;

      if (notification.is_read !== true) {
        await markAsRead(notification.notification_id);
      }

      const target = buildNotificationTarget(portalRootPath, notification);
      if (target) {
        navigate(target);

        if (
          String(notification.reference_type || '').toLowerCase() ===
          'personal_reminder'
        ) {
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent('personal-planner:open', {
                detail: { eventId: notification.reference_id },
              })
            );
          }, 0);
        }
      }
    },
    [markAsRead, portalRootPath]
  );

  return {
    notifications: items,
    newNotifications,
    earlierNotifications,
    unreadCount,
    loading,
    markingAll,
    reloadNotifications: loadNotifications,
    markAsRead,
    markAllAsRead,
    openNotification,
    formatNotificationTime,
  };
}
