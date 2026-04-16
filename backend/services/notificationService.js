const AUDIENCE_TO_ROLE_FILTER = {
  all: null,
  applicants: 'Applicant',
  scholars: 'Student',
  tes: 'Student',
  tdp: 'Student',
};

let ioRef = null;
let supabaseRef = null;

function configureNotificationService({ io, supabase }) {
  ioRef = io;
  supabaseRef = supabase;
}

function getSupabase() {
  if (!supabaseRef) {
    throw new Error('Notification service is not configured with Supabase.');
  }

  return supabaseRef;
}

function mapNotificationRow(row) {
  return {
    notificationId: row.notification_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    referenceId: row.reference_id,
    referenceType: row.reference_type,
    isRead: !!row.is_read,
    pushSent: !!row.push_sent,
    createdAt: row.created_at,
  };
}

function emitToUser(userId, eventName, payload) {
  if (!ioRef) return;
  ioRef.to(`user:${userId}`).emit(eventName, payload);
}

async function fetchAudienceUsers(audience) {
  const supabase = getSupabase();
  let usersQuery = supabase.from('users').select('user_id, role');
  const roleFilter = AUDIENCE_TO_ROLE_FILTER[audience] ?? null;

  if (roleFilter) {
    usersQuery = usersQuery.eq('role', roleFilter);
  }

  const { data, error } = await usersQuery;

  if (error) {
    console.error('NOTIFICATION USER FETCH ERROR:', error);
    throw new Error(error.message);
  }

  let users = data || [];

  if (audience === 'applicants') {
    users = users.filter((user) => user.role === 'Applicant');
  }

  if (['scholars', 'tes', 'tdp'].includes(audience)) {
    users = users.filter((user) => user.role === 'Student');
  }

  return users;
}

async function fetchUserDeviceTokens(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('mobile_sessions')
    .select('device_token, device_type')
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('device_token', 'is', null);

  if (error) {
    console.error('DEVICE TOKEN FETCH ERROR:', error);
    return [];
  }

  // Map device_type to platform for compatibility
  return (data || []).map(row => ({
    device_token: row.device_token,
    platform: row.device_type
  }));
}

async function sendPushNotification(userId, notificationRow) {
  const deviceTokens = await fetchUserDeviceTokens(userId);
  const fcmServerKey = process.env.FCM_SERVER_KEY;

  if (!deviceTokens.length || !fcmServerKey) {
    return false;
  }

  let hasSuccess = false;

  for (const device of deviceTokens) {
    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${fcmServerKey}`,
        },
        body: JSON.stringify({
          to: device.device_token,
          notification: {
            title: notificationRow.title,
            body: notificationRow.message,
          },
          data: {
            notificationId: String(notificationRow.notification_id),
            referenceId: notificationRow.reference_id
              ? String(notificationRow.reference_id)
              : '',
            referenceType: notificationRow.reference_type || '',
            type: notificationRow.type || '',
          },
        }),
      });

      if (response.ok) {
        hasSuccess = true;
      } else {
        const errorBody = await response.text();
        console.error('FCM PUSH ERROR:', errorBody);
      }
    } catch (error) {
      console.error('FCM REQUEST ERROR:', error.message);
    }
  }

  return hasSuccess;
}

async function createNotifications(rows = []) {
  if (!rows.length) {
    return [];
  }

  const supabase = getSupabase();
  const insertRows = rows.map((row) => ({
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    reference_id: row.reference_id ?? null,
    reference_type: row.reference_type ?? null,
    is_read: false,
    push_sent: false,
    created_at: row.created_at || new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('notifications')
    .insert(insertRows)
    .select(
      'notification_id, user_id, type, title, message, reference_id, reference_type, is_read, push_sent, created_at'
    );

  if (error) {
    console.error('NOTIFICATION INSERT ERROR:', error);
    throw new Error(error.message);
  }

  for (const row of data || []) {
    emitToUser(row.user_id, 'notification:new', mapNotificationRow(row));

    const pushSent = await sendPushNotification(row.user_id, row);
    if (pushSent) {
      await supabase
        .from('notifications')
        .update({ push_sent: true })
        .eq('notification_id', row.notification_id);
    }
  }

  return (data || []).map(mapNotificationRow);
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
  const [notification] = await createNotifications([
    {
      user_id: userId,
      type,
      title,
      message,
      reference_id: referenceId,
      reference_type: referenceType,
      created_at: createdAt,
    },
  ]);

  return notification || null;
}

async function createAudienceNotifications({
  audience,
  type,
  title,
  message,
  referenceId = null,
  referenceType = null,
  createdAt = null,
}) {
  const users = await fetchAudienceUsers(audience);

  if (!users.length) {
    return [];
  }

  return createNotifications(
    users.map((user) => ({
      user_id: user.user_id,
      type,
      title,
      message,
      reference_id: referenceId,
      reference_type: referenceType,
      created_at: createdAt,
    }))
  );
}

async function listUserNotifications(userId, { limit = 20, offset = 0 } = {}) {
  const supabase = getSupabase();
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const { data, error, count } = await supabase
    .from('notifications')
    .select(
      'notification_id, user_id, type, title, message, reference_id, reference_type, is_read, push_sent, created_at',
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    console.error('NOTIFICATION LIST ERROR:', error);
    throw new Error(error.message);
  }

  return {
    items: (data || []).map(mapNotificationRow),
    total: count || 0,
    limit: safeLimit,
    offset: safeOffset,
  };
}

async function getUnreadCount(userId) {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('notifications')
    .select('notification_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('NOTIFICATION UNREAD COUNT ERROR:', error);
    throw new Error(error.message);
  }

  return count || 0;
}

async function markNotificationRead(userId, notificationId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('notification_id', notificationId)
    .select(
      'notification_id, user_id, type, title, message, reference_id, reference_type, is_read, push_sent, created_at'
    )
    .maybeSingle();

  if (error) {
    console.error('NOTIFICATION MARK READ ERROR:', error);
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const mapped = mapNotificationRow(data);
  emitToUser(userId, 'notification:updated', mapped);
  return mapped;
}

async function markAllNotificationsRead(userId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .select(
      'notification_id, user_id, type, title, message, reference_id, reference_type, is_read, push_sent, created_at'
    );

  if (error) {
    console.error('NOTIFICATION MARK ALL READ ERROR:', error);
    throw new Error(error.message);
  }

  for (const row of data || []) {
    emitToUser(userId, 'notification:updated', mapNotificationRow(row));
  }

  return {
    updatedCount: (data || []).length,
    items: (data || []).map(mapNotificationRow),
  };
}

async function deleteNotification(userId, notificationId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('notification_id', notificationId)
    .select('notification_id')
    .maybeSingle();

  if (error) {
    console.error('NOTIFICATION DELETE ERROR:', error);
    throw new Error(error.message);
  }

  if (!data) {
    return false;
  }

  emitToUser(userId, 'notification:deleted', { notificationId });
  return true;
}

async function registerDeviceToken(userId, { deviceToken, platform }) {
  const supabase = getSupabase();

  // Update existing active session with device token, or create a new session
  const { data, error } = await supabase
    .from('mobile_sessions')
    .upsert(
      {
        user_id: userId,
        device_token: deviceToken,
        device_type: platform,
        session_token: `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
        is_active: true,
      },
      { onConflict: 'device_token' }
    )
    .select('user_id, device_token, device_type, is_active')
    .single();

  if (error) {
    console.error('DEVICE TOKEN UPSERT ERROR:', error);
    throw new Error(error.message);
  }

  return {
    user_id: data.user_id,
    device_token: data.device_token,
    platform: data.device_type,
    is_active: data.is_active
  };
}

module.exports = {
  configureNotificationService,
  createNotifications,
  createUserNotification,
  createAudienceNotifications,
  listUserNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  registerDeviceToken,
};
