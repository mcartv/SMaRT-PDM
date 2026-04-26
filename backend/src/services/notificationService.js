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

  const { data, error, count } = await supabase
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
    `, { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    items: data || [],
    total: count || 0,
    limit,
    offset,
    unreadCount: (data || []).filter((item) => item.is_read === false).length,
  };
}

async function getUnreadCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('notification_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;

  return {
    unreadCount: count || 0,
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
        onConflict: 'user_id,device_token', // matches your unique constraint
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