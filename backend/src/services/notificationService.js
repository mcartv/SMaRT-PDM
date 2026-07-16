const crypto = require('crypto');
const supabase = require('../config/supabase');

let ioInstance = null;

function configureNotificationService(config = {}) {
  ioInstance = config.io || null;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function safeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeText(value) {
  return safeText(value).toLowerCase();
}

function safeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function safeCompareSecrets(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');

  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isLoopbackAddress(value) {
  const normalized = String(value || '').trim().replace(/^::ffff:/, '');
  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === 'localhost'
  );
}

function isAuthorizedInternalRequest(req) {
  const expectedSecret = safeText(process.env.INTERNAL_NOTIFICATION_SECRET);
  const providedSecret = safeText(req.get('x-internal-notification-secret'));

  if (expectedSecret) {
    return safeCompareSecrets(providedSecret, expectedSecret);
  }

  return isLoopbackAddress(req.ip) || isLoopbackAddress(req.socket?.remoteAddress);
}

function emitToUser(userId, eventName, payload) {
  if (!ioInstance || !userId) return;
  ioInstance.to(`user:${userId}`).emit(eventName, payload);
}

function isAnnouncementNotification(row = {}) {
  const type = normalizeText(row.type);
  const referenceType = normalizeText(row.reference_type);

  return type.includes('announcement') || referenceType === 'announcement';
}

function isOpeningNotification(row = {}) {
  const type = normalizeText(row.type);
  const referenceType = normalizeText(row.reference_type);

  return (
    type.includes('opening') ||
    referenceType === 'opening' ||
    referenceType === 'program_opening'
  );
}

async function filterLiveNotificationRows(rows = []) {
  const source = Array.isArray(rows) ? rows : [];

  const announcementIds = [
    ...new Set(
      source
        .filter(isAnnouncementNotification)
        .map((row) => row.reference_id)
        .filter(Boolean)
        .map(String)
    ),
  ];

  const openingIds = [
    ...new Set(
      source
        .filter(isOpeningNotification)
        .map((row) => row.reference_id)
        .filter(Boolean)
        .map(String)
    ),
  ];

  const liveAnnouncementIds = new Set();
  const liveOpeningIds = new Set();

  if (announcementIds.length > 0) {
    const { data, error } = await supabase
      .from('announcements')
      .select('announcement_id, status, is_archived')
      .in('announcement_id', announcementIds)
      .eq('is_archived', false)
      .eq('status', 'Published');

    if (error) throw error;

    for (const row of data || []) {
      if (row?.announcement_id) {
        liveAnnouncementIds.add(String(row.announcement_id));
      }
    }
  }

  if (openingIds.length > 0) {
    const { data, error } = await supabase
      .from('program_openings')
      .select('opening_id, posting_status, is_archived')
      .in('opening_id', openingIds)
      .eq('is_archived', false)
      .in('posting_status', ['open', 'filled']);

    if (error) throw error;

    for (const row of data || []) {
      if (row?.opening_id) {
        liveOpeningIds.add(String(row.opening_id));
      }
    }
  }

  return source.filter((row) => {
    if (isAnnouncementNotification(row)) {
      if (!row.reference_id) return false;
      return liveAnnouncementIds.has(String(row.reference_id));
    }

    if (isOpeningNotification(row)) {
      if (!row.reference_id) return false;
      return liveOpeningIds.has(String(row.reference_id));
    }

    return true;
  });
}

async function createUserNotification({
  userId,
  type,
  title,
  message,
  referenceId = null,
  referenceType = null,
  createdAt = null,
}) {
  if (!userId) throw createHttpError(400, 'userId is required.');
  if (!title) throw createHttpError(400, 'title is required.');
  if (!message) throw createHttpError(400, 'message is required.');

  const normalizedReferenceType = normalizeText(referenceType);

  if (normalizedReferenceType === 'announcement' && referenceId) {
    const { data: announcement, error } = await supabase
      .from('announcements')
      .select('announcement_id, status, is_archived')
      .eq('announcement_id', referenceId)
      .eq('is_archived', false)
      .eq('status', 'Published')
      .maybeSingle();

    if (error) throw error;

    if (!announcement) {
      throw createHttpError(
        400,
        'Cannot create notification for archived, draft, or missing announcement.'
      );
    }
  }

  if (
    ['opening', 'program_opening'].includes(normalizedReferenceType) &&
    referenceId
  ) {
    const { data: opening, error } = await supabase
      .from('program_openings')
      .select('opening_id, posting_status, is_archived')
      .eq('opening_id', referenceId)
      .eq('is_archived', false)
      .in('posting_status', ['open', 'filled'])
      .maybeSingle();

    if (error) throw error;

    if (!opening) {
      throw createHttpError(
        400,
        'Cannot create notification for archived, closed, draft, or missing opening.'
      );
    }
  }

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: safeText(type) || 'General',
      title: safeText(title),
      message: safeText(message),
      reference_id: referenceId || null,
      reference_type: referenceType || null,
      is_read: false,
      push_sent: false,
      created_at: createdAt || new Date().toISOString(),
    })
    .select(`
      notification_id,
      user_id,
      type,
      title,
      message,
      reference_id,
      reference_type,
      is_read,
      push_sent,
      created_at
    `)
    .single();

  if (error) throw error;

  emitToUser(userId, 'notification:new', data);

  return data;
}

async function getMyNotifications(userId, query = {}) {
  const limit = Math.min(safeInteger(query.limit, 50), 100);
  const offset = safeInteger(query.offset, 0);

  /*
    We over-fetch first, then filter stale announcement/opening rows.
    Reason: notifications.reference_id has no FK to announcements/openings,
    so Supabase cannot directly join/filter this safely in one query.
  */
  const fetchLimit = Math.min(offset + limit + 200, 300);

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      notification_id,
      user_id,
      type,
      title,
      message,
      reference_id,
      reference_type,
      is_read,
      push_sent,
      created_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(0, fetchLimit - 1);

  if (error) throw error;

  const filtered = await filterLiveNotificationRows(data || []);
  const paginated = filtered.slice(offset, offset + limit);

  return {
    items: paginated,
    total: filtered.length,
    limit,
    offset,
    unreadCount: filtered.filter((item) => item.is_read === false).length,
  };
}

async function getUnreadCount(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      notification_id,
      user_id,
      type,
      title,
      message,
      reference_id,
      reference_type,
      is_read,
      push_sent,
      created_at
    `)
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw error;

  const filtered = await filterLiveNotificationRows(data || []);

  return {
    unreadCount: filtered.length,
  };
}

async function markAsRead(userId, notificationId) {
  if (!notificationId) {
    throw createHttpError(400, 'Notification ID is required.');
  }

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('notification_id', notificationId)
    .eq('user_id', userId)
    .select(`
      notification_id,
      user_id,
      type,
      title,
      message,
      reference_id,
      reference_type,
      is_read,
      push_sent,
      created_at
    `)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw createHttpError(404, 'Notification not found.');

  emitToUser(userId, 'notification:updated', data);

  return {
    message: 'Notification marked as read.',
    notification: data,
  };
}

async function markAllAsRead(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .select('notification_id');

  if (error) throw error;

  emitToUser(userId, 'notification:read-all', {
    user_id: userId,
    updatedCount: data?.length || 0,
  });

  return {
    message: 'All notifications marked as read.',
    updatedCount: data?.length || 0,
  };
}

async function deleteNotification(userId, notificationId) {
  if (!notificationId) {
    throw createHttpError(400, 'Notification ID is required.');
  }

  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .eq('notification_id', notificationId)
    .eq('user_id', userId)
    .select('notification_id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw createHttpError(404, 'Notification not found.');

  emitToUser(userId, 'notification:deleted', {
    notificationId,
    notification_id: notificationId,
  });

  return {
    message: 'Notification deleted.',
    notificationId,
  };
}

async function registerDeviceToken(userId, body = {}) {
  const deviceToken = safeText(body.deviceToken || body.device_token);
  const platform = safeText(body.platform) || 'unknown';

  if (!deviceToken) {
    throw createHttpError(400, 'deviceToken is required.');
  }

  const { data, error } = await supabase
    .from('user_device_tokens')
    .upsert(
      {
        user_id: userId,
        device_token: deviceToken,
        platform,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,device_token',
      }
    )
    .select('*')
    .single();

  if (error) throw error;

  return {
    message: 'Device token registered.',
    token: data,
  };
}

async function createInternalUserNotification(req) {
  if (!isAuthorizedInternalRequest(req)) {
    throw createHttpError(403, 'Unauthorized internal notification request.');
  }

  const body = req.body || {};

  const userId = safeText(body.userId || body.user_id);
  const type = safeText(body.type) || 'General';
  const title = safeText(body.title);
  const message = safeText(body.message);
  const referenceId = body.referenceId || body.reference_id || null;
  const referenceType = body.referenceType || body.reference_type || null;
  const createdAt = body.createdAt || body.created_at || null;

  const notification = await createUserNotification({
    userId,
    type,
    title,
    message,
    referenceId,
    referenceType,
    createdAt,
  });

  return {
    message: 'Notification created.',
    notification,
  };
}

module.exports = {
  configureNotificationService,
  createUserNotification,
  createInternalUserNotification,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  registerDeviceToken,
};