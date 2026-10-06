// SMaRT-PDM: Notifications — notification Service (mobile backend service); contains mobile-facing business logic and data operations.
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { notificationsEnabled } = require('../config/notificationPolicy');
const { relayNotificationCreated } = require('./adminRealtimeRelayService');
const pushNotificationService = require('./pushNotificationService');

let ioInstance = null;

// configureNotificationService: handles configure notification service for the Notifications flow.
function configureNotificationService(config = {}) {
  ioInstance = config.io || null;
}

// createHttpError: creates create http error for the Notifications flow.
function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// safeText: handles safe text for the Notifications flow.
function safeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

// normalizeText: normalizes normalize text for the Notifications flow.
function normalizeText(value) {
  return safeText(value).toLowerCase();
}

// safeInteger: handles safe integer for the Notifications flow.
function safeInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

// safeCompareSecrets: handles safe compare secrets for the Notifications flow.
function safeCompareSecrets(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');

  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

// isLoopbackAddress: checks whether is loopback address for the Notifications flow.
function isLoopbackAddress(value) {
  const normalized = String(value || '').trim().replace(/^::ffff:/, '');

  return (
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === 'localhost'
  );
}

// isAuthorizedInternalRequest: checks whether is authorized internal request for the Notifications flow.
function isAuthorizedInternalRequest(req) {
  const expectedSecret = safeText(process.env.INTERNAL_NOTIFICATION_SECRET);
  const providedSecret = safeText(req.get('x-internal-notification-secret'));

  if (expectedSecret) {
    return safeCompareSecrets(providedSecret, expectedSecret);
  }

  return (
    isLoopbackAddress(req.ip) ||
    isLoopbackAddress(req.socket?.remoteAddress)
  );
}

// normalizeNotification: normalizes normalize notification for the Notifications flow.
function normalizeNotification(row = {}) {
  const id = row.notification_id || row.notificationId || row.id || null;
  const userId = row.user_id || row.userId || null;
  const referenceId = row.reference_id || row.referenceId || null;
  const referenceType = row.reference_type || row.referenceType || null;
  const createdAt = row.created_at || row.createdAt || new Date().toISOString();

  return {
    id,
    notificationId: id,
    notification_id: id,

    userId,
    user_id: userId,

    type: row.type || 'General',
    title: row.title || '',
    message: row.message || '',

    referenceId,
    reference_id: referenceId,

    referenceType,
    reference_type: referenceType,

    isRead: row.is_read === true || row.isRead === true,
    is_read: row.is_read === true || row.isRead === true,

    pushSent: row.push_sent === true || row.pushSent === true,
    push_sent: row.push_sent === true || row.pushSent === true,

    createdAt,
    created_at: createdAt,
  };
}

// emitToUser: handles emit to user for the Notifications flow.
function emitToUser(userId, eventName, payload) {
  if (!ioInstance || !userId) return;

  ioInstance.to(`user:${userId}`).emit(eventName, payload);
}

// emitNotificationCreated: handles emit notification created for the Notifications flow.
function emitNotificationCreated(userId, notification) {
  const payload = normalizeNotification(notification);

  emitToUser(userId, 'notification:new', payload);
  emitToUser(userId, 'notification:created', payload);

  // Compatibility aliases.
  emitToUser(userId, 'notifications:updated', payload);
  emitToUser(userId, 'notificationCreated', payload);
}

// emitNotificationUpdated: handles emit notification updated for the Notifications flow.
function emitNotificationUpdated(userId, notification) {
  const payload = normalizeNotification(notification);

  emitToUser(userId, 'notification:updated', payload);

  // Compatibility aliases.
  emitToUser(userId, 'notifications:updated', payload);
  emitToUser(userId, 'notificationUpdated', payload);
}

// emitNotificationReadAll: handles emit notification read all for the Notifications flow.
function emitNotificationReadAll(userId, updatedCount = 0) {
  const payload = {
    user_id: userId,
    userId,
    updatedCount,
    updated_count: updatedCount,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  emitToUser(userId, 'notification:read-all', payload);
  emitToUser(userId, 'notification:updated', payload);

  // Compatibility aliases.
  emitToUser(userId, 'notifications:updated', payload);
  emitToUser(userId, 'notificationUpdated', payload);
}

// emitNotificationDeleted: handles emit notification deleted for the Notifications flow.
function emitNotificationDeleted(userId, notificationId) {
  const payload = {
    notificationId,
    notification_id: notificationId,
    referenceId: notificationId,
    reference_id: notificationId,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  emitToUser(userId, 'notification:deleted', payload);

  // Compatibility aliases.
  emitToUser(userId, 'notifications:updated', payload);
}

// isAnnouncementNotification: checks whether is announcement notification for the Notifications flow.
function isAnnouncementNotification(row = {}) {
  const type = normalizeText(row.type);
  const referenceType = normalizeText(row.reference_type || row.referenceType);

  return type.includes('announcement') || referenceType === 'announcement';
}

// isOpeningNotification: checks whether is opening notification for the Notifications flow.
function isOpeningNotification(row = {}) {
  const type = normalizeText(row.type);
  const referenceType = normalizeText(row.reference_type || row.referenceType);

  return (
    type.includes('opening') ||
    referenceType === 'opening' ||
    referenceType === 'program_opening'
  );
}

// filterLiveNotificationRows: handles filter live notification rows for the Notifications flow.
async function filterLiveNotificationRows(rows = []) {
  const source = Array.isArray(rows) ? rows : [];

  const announcementIds = [
    ...new Set(
      source
        .filter(isAnnouncementNotification)
        .map((row) => row.reference_id || row.referenceId)
        .filter(Boolean)
        .map(String)
    ),
  ];

  const openingIds = [
    ...new Set(
      source
        .filter(isOpeningNotification)
        .map((row) => row.reference_id || row.referenceId)
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
      const referenceId = row.reference_id || row.referenceId;

      if (!referenceId) return false;

      return liveAnnouncementIds.has(String(referenceId));
    }

    if (isOpeningNotification(row)) {
      const referenceId = row.reference_id || row.referenceId;

      if (!referenceId) return false;

      return liveOpeningIds.has(String(referenceId));
    }

    return true;
  });
}

const NOTIFICATION_SELECT = `
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
`;

// createUserNotification: creates create user notification for the Notifications flow.
async function createUserNotification({
  userId,
  type,
  title,
  message,
  referenceId = null,
  referenceType = null,
  createdAt = null,
}) {
  if (!(await notificationsEnabled())) return null;
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
    .select(NOTIFICATION_SELECT)
    .maybeSingle();

  if (error) throw error;

  // The database may suppress creation after the cached policy read.
  if (!data) return null;

  emitNotificationCreated(userId, data);
  relayNotificationCreated({ notification: normalizeNotification(data) }).catch(
    (error) => {
      console.error(
        '[Notification Relay] failed:',
        error?.message || error
      );
    }
  );

  let pushResult = null;

  try {
    pushResult = await pushNotificationService.sendUserNotificationPush({
      userId,
      notification: data,
    });
  } catch (error) {
    console.error(
      '[FCM] Notification push failed:',
      error?.message || error
    );
  }

  return pushResult?.sent
    ? { ...data, push_sent: true }
    : data;
}

// resolveStaffRole: resolves resolve staff role for the Notifications flow.
function resolveStaffRole(profile = {}) {
  const department = normalizeText(profile.department);
  const position = normalizeText(profile.position);

  if (
    position.includes('program director') ||
    position.includes('program chair') ||
    department.includes('program department')
  ) {
    return 'pd';
  }
  if (department.includes('guidance') || position.includes('guidance')) {
    return 'guidance';
  }
  if (
    department.includes('student welfare') ||
    department.includes('student disciplin') ||
    position.includes('sdo')
  ) {
    return 'sdo';
  }
  if (
    department.includes('osfa') ||
    department.includes('scholarship and financial assistance') ||
    position.includes('osfa administrator')
  ) {
    return 'admin';
  }

  return null;
}

// getStaffTargets: reads and returns get staff targets for the Notifications flow.
async function getStaffTargets({ roles = [], courseId = null } = {}) {
  if (!(await notificationsEnabled())) return [];
  const normalizedRoles = new Set(
    (Array.isArray(roles) ? roles : [roles])
      .map(normalizeText)
      .filter(Boolean)
  );

  if (!normalizedRoles.size) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from('admin_profiles')
    .select(
      'user_id, first_name, last_name, department, position, is_archived'
    )
    .or('is_archived.eq.false,is_archived.is.null');

  if (profilesError) throw profilesError;

  let targets = (profiles || [])
    .map((profile) => ({
      ...profile,
      role: resolveStaffRole(profile),
    }))
    .filter((profile) => normalizedRoles.has(profile.role));

  if (courseId && normalizedRoles.has('pd')) {
    const { data: assignments, error: assignmentError } = await supabase
      .from('program_director_course_assignments')
      .select('pd_user_id')
      .eq('course_id', courseId)
      .eq('is_active', true);

    if (assignmentError) throw assignmentError;

    const assignedPdIds = new Set(
      (assignments || []).map((row) => String(row.pd_user_id))
    );

    targets = targets.filter(
      (target) =>
        target.role !== 'pd' || assignedPdIds.has(String(target.user_id))
    );
  }

  return targets;
}

// createStaffNotifications: creates create staff notifications for the Notifications flow.
async function createStaffNotifications({
  roles,
  type,
  title,
  message,
  referenceId = null,
  referenceType = null,
  courseId = null,
}) {
  if (!(await notificationsEnabled())) return [];
  const targets = await getStaffTargets({ roles, courseId });

  return (await Promise.all(
    targets.map((target) =>
      createUserNotification({
        userId: target.user_id,
        type,
        title,
        message,
        referenceId,
        referenceType,
      })
    )
  )).filter(Boolean);
}

// getMyNotifications: reads and returns get my notifications for the Notifications flow.
async function getMyNotifications(userId, query = {}) {
  const enabled = await notificationsEnabled();
  const limit = Math.min(safeInteger(query.limit, 50), 100);
  const offset = safeInteger(query.offset, 0);

  const fetchLimit = Math.min(offset + limit + 200, 300);

  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(0, fetchLimit - 1);

  if (error) throw error;

  const filtered = await filterLiveNotificationRows(data || []);
  const paginated = filtered.slice(offset, offset + limit);

  const items = paginated.map(normalizeNotification);

  return {
    items,
    notificationsEnabled: enabled,
    notifications: items,
    data: items,
    total: filtered.length,
    limit,
    offset,
    unreadCount: filtered.filter((item) => item.is_read === false).length,
  };
}

// getUnreadCount: reads and returns get unread count for the Notifications flow.
async function getUnreadCount(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_SELECT)
    .eq('user_id', userId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) throw error;

  const filtered = await filterLiveNotificationRows(data || []);

  return {
    unreadCount: filtered.length,
    count: filtered.length,
  };
}

// markAsRead: marks mark as read for the Notifications flow.
async function markAsRead(userId, notificationId) {
  if (!notificationId) {
    throw createHttpError(400, 'Notification ID is required.');
  }

  const { data, error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('notification_id', notificationId)
    .eq('user_id', userId)
    .select(NOTIFICATION_SELECT)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw createHttpError(404, 'Notification not found.');
  }

  const notification = normalizeNotification(data);

  emitNotificationUpdated(userId, notification);

  return {
    message: 'Notification marked as read.',
    notification,
  };
}

// markAllAsRead: marks mark all as read for the Notifications flow.
async function markAllAsRead(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('is_read', false)
    .select('notification_id');

  if (error) throw error;

  const updatedCount = data?.length || 0;

  emitNotificationReadAll(userId, updatedCount);

  return {
    message: 'All notifications marked as read.',
    updatedCount,
  };
}

// deleteNotification: deletes delete notification for the Notifications flow.
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

  if (!data) {
    throw createHttpError(404, 'Notification not found.');
  }

  emitNotificationDeleted(userId, notificationId);

  return {
    message: 'Notification deleted.',
    notificationId,
    notification_id: notificationId,
  };
}

// registerDeviceToken: handles register device token for the Notifications flow.
async function registerDeviceToken(userId, body = {}) {
  const deviceToken = safeText(body.deviceToken || body.device_token);
  const platform = safeText(body.platform) || 'unknown';

  if (!deviceToken) {
    throw createHttpError(400, 'deviceToken is required.');
  }

  // One FCM token belongs to the currently authenticated account on the
  // device. Remove stale ownership before upserting the current user.
  const { error: staleOwnerError } = await supabase
    .from('user_device_tokens')
    .delete()
    .eq('device_token', deviceToken)
    .neq('user_id', userId);

  if (staleOwnerError) throw staleOwnerError;

  const payload = {
    user_id: userId,
    device_token: deviceToken,
    platform,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('user_device_tokens')
    .upsert(payload, {
      onConflict: 'user_id,device_token',
    })
    .select('*')
    .single();

  if (error) throw error;

  return {
    message: 'Device token registered.',
    token: data,
  };
}

// createInternalUserNotification: creates create internal user notification for the Notifications flow.
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
    message: notification ? 'Notification created.' : 'Notifications are disabled.',
    notification: notification ? normalizeNotification(notification) : null,
    skipped: !notification,
  };
}

module.exports = {
  configureNotificationService,
  createUserNotification,
  createStaffNotifications,
  getStaffTargets,
  createInternalUserNotification,
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  registerDeviceToken,
  normalizeNotification,
};
