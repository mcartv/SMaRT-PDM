const supabase = require('../config/supabase');

let ioInstance = null;
let supabaseClient = null;

function configureNotificationService(config = {}) {
  ioInstance = config.io || null;
  supabaseClient = config.supabase || null;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getMyNotifications(userId) {
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
    .limit(50);

  if (error) throw error;

  const unreadCount = (data || []).filter((item) => item.is_read === false).length;

  return {
    unreadCount,
    items: data || [],
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
    .select('*')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw createHttpError(404, 'Notification not found.');
  }

  return {
    message: 'Notification marked as read.',
    notification: data,
  };
}

async function markAllAsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;

  return {
    message: 'All notifications marked as read.',
  };
}

module.exports = {
  configureNotificationService,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
};