const {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

const supabase = require('../config/supabase');

const MAX_FCM_BATCH_SIZE = 500;
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

let firebaseApp = null;
let configurationWarningShown = false;

function safeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const existing = getApps();
  if (existing.length > 0) {
    firebaseApp = existing[0];
    return firebaseApp;
  }

  const projectId = safeText(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = safeText(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = safeText(process.env.FIREBASE_PRIVATE_KEY).replace(
    /\\n/g,
    '\n'
  );

  try {
    if (projectId && clientEmail && privateKey) {
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });

      return firebaseApp;
    }

    if (safeText(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      firebaseApp = initializeApp({
        credential: applicationDefault(),
        ...(projectId ? { projectId } : {}),
      });

      return firebaseApp;
    }
  } catch (error) {
    console.error(
      '[FCM] Firebase Admin initialization failed:',
      error?.message || error
    );
    return null;
  }

  if (!configurationWarningShown) {
    configurationWarningShown = true;
    console.warn(
      '[FCM] Push sending is disabled. Configure FIREBASE_PROJECT_ID, ' +
        'FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY on the mobile backend.'
    );
  }

  return null;
}

function stringData(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function buildMessage(token, notification) {
  const notificationId =
    notification.notification_id ||
    notification.notificationId ||
    notification.id ||
    '';

  const referenceId =
    notification.reference_id ||
    notification.referenceId ||
    '';

  const referenceType =
    notification.reference_type ||
    notification.referenceType ||
    '';

  return {
    token,
    notification: {
      title: safeText(notification.title) || 'SMaRT-PDM',
      body: safeText(notification.message) || 'You have a new update.',
    },
    data: {
      notificationId: stringData(notificationId),
      referenceId: stringData(referenceId),
      referenceType: stringData(referenceType),
      type: stringData(notification.type || 'General'),
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'smart_pdm_notifications',
        sound: 'default',
      },
    },
  };
}

async function removeInvalidTokens(tokens = []) {
  const uniqueTokens = [...new Set(tokens.map(safeText).filter(Boolean))];
  if (uniqueTokens.length === 0) return;

  const { error } = await supabase
    .from('user_device_tokens')
    .delete()
    .in('device_token', uniqueTokens);

  if (error) {
    console.error('[FCM] Failed to remove invalid device tokens:', error.message);
  }
}

async function markPushSent(notificationId) {
  if (!notificationId) return;

  const { error } = await supabase
    .from('notifications')
    .update({ push_sent: true })
    .eq('notification_id', notificationId);

  if (error) {
    console.error('[FCM] Failed to mark push_sent:', error.message);
  }
}

async function sendUserNotificationPush({ userId, notification = {} }) {
  const cleanUserId = safeText(userId);
  if (!cleanUserId) {
    return { sent: false, skipped: true, reason: 'missing_user_id' };
  }

  const app = getFirebaseApp();
  if (!app) {
    return { sent: false, skipped: true, reason: 'firebase_not_configured' };
  }

  const { data: tokenRows, error: tokenError } = await supabase
    .from('user_device_tokens')
    .select('device_token, platform')
    .eq('user_id', cleanUserId);

  if (tokenError) {
    console.error('[FCM] Device-token lookup failed:', tokenError.message);
    return {
      sent: false,
      skipped: true,
      reason: 'device_token_lookup_failed',
      error: tokenError.message,
    };
  }

  const tokens = [
    ...new Set(
      (tokenRows || [])
        .filter((row) => {
          const platform = safeText(row.platform).toLowerCase();
          return platform === '' || platform === 'android';
        })
        .map((row) => safeText(row.device_token))
        .filter(Boolean)
    ),
  ];

  if (tokens.length === 0) {
    return { sent: false, skipped: true, reason: 'no_device_tokens' };
  }

  const messaging = getMessaging(app);
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  for (let offset = 0; offset < tokens.length; offset += MAX_FCM_BATCH_SIZE) {
    const batchTokens = tokens.slice(offset, offset + MAX_FCM_BATCH_SIZE);
    const messages = batchTokens.map((token) =>
      buildMessage(token, notification)
    );

    const response = await messaging.sendEach(messages);

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((item, index) => {
      if (item.success) return;

      const code = item.error?.code || '';
      if (INVALID_TOKEN_CODES.has(code)) {
        invalidTokens.push(batchTokens[index]);
      }

      console.warn('[FCM] Push delivery failed:', {
        code,
        message: item.error?.message || 'Unknown FCM error',
      });
    });
  }

  await removeInvalidTokens(invalidTokens);

  const notificationId =
    notification.notification_id ||
    notification.notificationId ||
    notification.id ||
    null;

  if (successCount > 0) {
    await markPushSent(notificationId);
  }

  return {
    sent: successCount > 0,
    skipped: false,
    successCount,
    failureCount,
    invalidTokenCount: invalidTokens.length,
  };
}

module.exports = {
  sendUserNotificationPush,
};
