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

  if (referenceType === 'endorsement_slip' && referenceId) {
    return `${portalRootPath}/endorsements/${referenceId}`;
  }

  if (referenceType === 'announcement') {
    return portalRootPath === '/admin' ? '/admin/announcements' : `${portalRootPath}/dashboard`;
  }

  if (referenceType === 'payout_batch') {
    return portalRootPath === '/admin' ? '/admin/payout' : `${portalRootPath}/dashboard`;
  }

  if (referenceType === 'application' && referenceId && portalRootPath === '/admin') {
    return `/admin/applications/${referenceId}/documents`;
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

  const syncItems = useCallback((updater) => {
    setItems((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return sortNotifications(next);
    });
  }, []);

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
      setItems(sortNotifications(rows.map(normalizeNotification)));
    } catch (error) {
      console.error('NOTIFICATION LOAD ERROR:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [limit, tokenStorageKey]);

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
      syncItems((current) =>
        [next, ...current.filter((item) => item.notification_id !== next.notification_id)].slice(0, limit)
      );
    },
    'notification:new': (raw) => {
      const next = normalizeNotification(raw);
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
