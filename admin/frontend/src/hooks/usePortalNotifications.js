import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildApiUrl } from '@/config/api';
import { useSocketListener } from './useSocket';

const NOTIFICATION_STATUS_OPTIONS = Object.freeze([
  { value: 'all', label: 'All' },
  { value: 'major', label: 'Major' },
]);

const NOTIFICATION_TYPE_OPTIONS = Object.freeze([
  { value: 'need_review', label: 'Review' },
  { value: 'ro', label: 'RO' },
]);

function deriveNotificationCategory(notification = {}) {
  const type = String(notification.type || '').trim().toLowerCase();
  const title = String(notification.title || '').trim().toLowerCase();
  const message = String(notification.message || '').trim().toLowerCase();
  const referenceType = String(notification.reference_type || '').trim().toLowerCase();
  const combined = [type, title, message, referenceType].filter(Boolean).join(' ');

  if (
    type === 'disqualification notice' ||
    combined.includes('disqualif') ||
    combined.includes('major offense') ||
    combined.includes('major disciplinary offense') ||
    combined.includes('endorsement stopped')
  ) return 'disqualification';

  if (
    ['return_of_obligation', 'ro_time_log', 'ro_scholar_request'].includes(referenceType) ||
    type.includes('return of obligation') || /\bro\b/.test(type) || /\bro\b/.test(title)
  ) return 'ro';

  if (
    ['application_document', 'document_review', 'profile_photo_review', 'renewal_document'].includes(referenceType) ||
    combined.includes('review pending') || combined.includes('pending review') ||
    combined.includes('need review') || combined.includes('needs review') ||
    combined.includes('review required') ||
    (combined.includes('ready for') && combined.includes('review')) ||
    combined.includes('submitted for review')
  ) return 'need_review';

  return 'other';
}

function deriveNotificationPriority(category) {
  if (category === 'disqualification') return 'major';
  if (category === 'need_review' || category === 'ro') return 'normal';
  return 'minor';
}

function normalizeNotification(raw = {}) {
  const normalized = {
    notification_id: raw.notification_id || raw.notificationId || raw.id || '',
    user_id: raw.user_id || raw.userId || '',
    type: raw.type || 'General',
    title: raw.title || 'Notification',
    message: raw.message || '',
    reference_id: raw.reference_id || raw.referenceId || null,
    reference_type: raw.reference_type || raw.referenceType || null,
    is_read: raw.is_read === true,
    read_at: raw.read_at || raw.readAt || null,
    created_at: raw.created_at || raw.createdAt || null,
  };
  const category = deriveNotificationCategory(normalized);
  return { ...normalized, category, priority: deriveNotificationPriority(category) };
}

// SMART_PDM_NOTIFICATION_CATEGORY_PRIORITY_V2
function sortNotifications(items = []) {
  return [...items].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });
}

function isTodayNotification(notification, now = Date.now()) {
  if (!notification?.created_at) return false;

  const createdAt = new Date(notification.created_at);
  if (Number.isNaN(createdAt.getTime())) return false;
  const today = new Date(now);

  return createdAt.getFullYear() === today.getFullYear() &&
    createdAt.getMonth() === today.getMonth() &&
    createdAt.getDate() === today.getDate();
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

  if (referenceType === 'staff_account') {
    return null;
  }

  if (referenceType === 'staff_profile') {
    return portalRootPath === '/admin'
      ? '/admin/adminprofile'
      : `${portalRootPath}/profile`;
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
  limit = 30,
}) {
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const knownNotificationIdsRef = useRef(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [sectionNow, setSectionNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSectionNow(Date.now());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const syncItems = useCallback((updater) => {
    setItems((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      const sorted = sortNotifications(next);
      knownNotificationIdsRef.current = new Set(
        sorted.map((item) => item.notification_id).filter(Boolean)
      );
      return sorted;
    });
  }, []);

  const loadUnreadCount = useCallback(async () => {
    const token = sessionStorage.getItem(tokenStorageKey);
    if (!token) {
      setUnreadCount(0);
      return null;
    }

    try {
      const response = await fetch(buildApiUrl('/api/notifications/unread-count'), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to load unread count.');
      }

      const nextCount = Math.max(0, Number(payload?.unreadCount ?? payload?.count ?? 0) || 0);
      setUnreadCount(nextCount);
      return nextCount;
    } catch (error) {
      console.error('NOTIFICATION UNREAD COUNT ERROR:', error);
      return null;
    }
  }, [tokenStorageKey]);

  const loadNotifications = useCallback(async () => {
    const token = sessionStorage.getItem(tokenStorageKey);
    if (!token) {
      setItems([]);
      knownNotificationIdsRef.current = new Set();
      setUnreadCount(0);
      setTotalCount(0);
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
      const normalized = rows.map(normalizeNotification);
      syncItems(normalized);
      setTotalCount(Math.max(normalized.length, Number(payload?.total) || 0));

      const exactUnreadCount = await loadUnreadCount();
      if (exactUnreadCount === null) {
        setUnreadCount(normalized.filter((item) => item.is_read !== true).length);
      }
    } catch (error) {
      console.error('NOTIFICATION LOAD ERROR:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [
    limit,
    loadUnreadCount,
    syncItems,
    tokenStorageKey,
  ]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const loadMore = useCallback(async () => {
    const token = sessionStorage.getItem(tokenStorageKey);
    if (!token || loadingMore || items.length >= totalCount) return;

    try {
      setLoadingMore(true);
      const response = await fetch(
        buildApiUrl(`/api/notifications?limit=${limit}&offset=${items.length}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to load more notifications.');
      }

      const additional = (Array.isArray(payload?.items) ? payload.items : [])
        .map(normalizeNotification);
      syncItems((current) => {
        const knownIds = new Set(current.map((item) => item.notification_id));
        return [
          ...current,
          ...additional.filter((item) => !knownIds.has(item.notification_id)),
        ];
      });
      setTotalCount((current) => Math.max(current, Number(payload?.total) || 0));
    } catch (error) {
      console.error('LOAD MORE NOTIFICATIONS ERROR:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [items.length, limit, loadingMore, syncItems, tokenStorageKey, totalCount]);

  const markAsRead = useCallback(
    async (notificationId) => {
      if (!notificationId) return;

      const token = sessionStorage.getItem(tokenStorageKey);
      if (!token) return;

      const wasUnread = items.some(
        (item) => item.notification_id === notificationId && item.is_read !== true
      );

      syncItems((current) =>
        current.map((item) =>
          item.notification_id === notificationId ? { ...item, is_read: true } : item
        )
      );
      if (wasUnread) {
        setUnreadCount((current) => Math.max(0, current - 1));
      }

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
        if (wasUnread) {
          syncItems((current) =>
            current.map((item) =>
              item.notification_id === notificationId ? { ...item, is_read: false } : item
            )
          );
          setUnreadCount((current) => current + 1);
        }
      }
    },
    [items, syncItems, tokenStorageKey]
  );

  const markAsUnread = useCallback(
    async (notificationId) => {
      if (!notificationId) return;

      const token = sessionStorage.getItem(tokenStorageKey);
      if (!token) return;

      const previous = items.find((item) => item.notification_id === notificationId) || null;
      const wasRead = previous?.is_read === true;

      syncItems((current) =>
        current.map((item) =>
          item.notification_id === notificationId
            ? { ...item, is_read: false, read_at: null }
            : item
        )
      );
      if (wasRead) {
        setUnreadCount((current) => current + 1);
      }

      try {
        const response = await fetch(buildApiUrl(`/api/notifications/${notificationId}/unread`), {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error || payload?.message || 'Failed to mark notification as unread.');
        }

        const updated = normalizeNotification(payload?.notification || {});
        syncItems((current) =>
          current.map((item) =>
            item.notification_id === updated.notification_id ? { ...item, ...updated } : item
          )
        );
      } catch (error) {
        console.error('MARK NOTIFICATION UNREAD ERROR:', error);
        if (wasRead) {
          syncItems((current) =>
            current.map((item) =>
              item.notification_id === notificationId
                ? { ...item, is_read: true, read_at: previous?.read_at || null }
                : item
            )
          );
          setUnreadCount((current) => Math.max(0, current - 1));
        }
      }
    },
    [items, syncItems, tokenStorageKey]
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
      setUnreadCount(0);
    } catch (error) {
      console.error('MARK ALL NOTIFICATIONS READ ERROR:', error);
    } finally {
      setMarkingAll(false);
    }
  }, [syncItems, tokenStorageKey]);

  useSocketListener({
    'notification:created': (raw) => {
      const next = normalizeNotification(raw);

      const wasKnown = knownNotificationIdsRef.current.has(next.notification_id);
      if (next.notification_id) {
        knownNotificationIdsRef.current.add(next.notification_id);
      }

      syncItems((current) =>
        [next, ...current.filter((item) => item.notification_id !== next.notification_id)]
      );

      if (!wasKnown) setTotalCount((current) => current + 1);
      if (!wasKnown && next.is_read !== true) {
        setUnreadCount((current) => current + 1);
      }
    },
    'notification:new': (raw) => {
      const next = normalizeNotification(raw);

      const wasKnown = knownNotificationIdsRef.current.has(next.notification_id);
      if (next.notification_id) {
        knownNotificationIdsRef.current.add(next.notification_id);
      }

      syncItems((current) =>
        [next, ...current.filter((item) => item.notification_id !== next.notification_id)]
      );

      if (!wasKnown) setTotalCount((current) => current + 1);
      if (!wasKnown && next.is_read !== true) {
        setUnreadCount((current) => current + 1);
      }
    },
    'notification:updated': (raw) => {
      const next = normalizeNotification(raw?.notification || raw);
      syncItems((current) =>
        current.map((item) =>
          item.notification_id === next.notification_id ? { ...item, ...next } : item
        )
      );
      void loadUnreadCount();
    },
    'notification:read-all': () => {
      syncItems((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    },
    'notification:deleted': (raw) => {
      const targetId = raw?.notificationId || raw?.notification_id;
      const wasKnown = knownNotificationIdsRef.current.has(targetId);
      knownNotificationIdsRef.current.delete(targetId);
      syncItems((current) => current.filter((item) => item.notification_id !== targetId));
      if (wasKnown) setTotalCount((current) => Math.max(0, current - 1));
      void loadUnreadCount();
    },
  });

  const filteredNotifications = useMemo(
    () => {
      return items.filter((item) => {
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'major' && item.priority === 'major');
        const matchesType =
          typeFilter === 'all' || item.category === typeFilter;
        const matchesReadState = !unreadOnly || item.is_read !== true;

        return matchesStatus && matchesType && matchesReadState;
      });
    },
    [items, statusFilter, typeFilter, unreadOnly]
  );

  const majorNotifications = useMemo(
    () => filteredNotifications.filter((item) => item.priority === 'major'),
    [filteredNotifications]
  );

  const newNotifications = useMemo(
    () => filteredNotifications.filter((item) => isTodayNotification(item, sectionNow)),
    [filteredNotifications, sectionNow]
  );

  const earlierNotifications = useMemo(
    () => filteredNotifications.filter((item) => !isTodayNotification(item, sectionNow)),
    [filteredNotifications, sectionNow]
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
    filteredNotifications,
    majorNotifications,
    newNotifications,
    earlierNotifications,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    unreadOnly,
    setUnreadOnly,
    notificationStatusOptions: NOTIFICATION_STATUS_OPTIONS,
    notificationTypeOptions: NOTIFICATION_TYPE_OPTIONS,
    unreadCount,
    loading,
    loadingMore,
    hasMore: items.length < totalCount,
    markingAll,
    reloadNotifications: loadNotifications,
    loadMore,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    openNotification,
    formatNotificationTime,
  };
}
