const supabase = require('../config/supabase');
const { mailFrom, transporter } = require('../config/mailer');

const AUDIENCE_TO_ROLE_FILTER = {
    all: null,
    applicants: 'Applicant',
    scholars: 'Student',
    tes: 'Student',
    tdp: 'Student',
};

async function getAudienceUsers(audience) {
    let usersQuery = supabase
        .from('users')
        .select('user_id, role, email');

    const roleFilter = AUDIENCE_TO_ROLE_FILTER[audience];

    if (roleFilter) {
        usersQuery = usersQuery.eq('role', roleFilter);
    }

    const { data: users, error } = await usersQuery;

    if (error) {
        console.error('SUPABASE USERS FETCH ERROR:', error);
        throw new Error(error.message);
    }

    let filteredUsers = users || [];

    if (audience === 'applicants') {
        filteredUsers = filteredUsers.filter((user) => user.role === 'Applicant');
    }

    if (['scholars', 'tes', 'tdp'].includes(audience)) {
        filteredUsers = filteredUsers.filter((user) => user.role === 'Student');
    }

    return filteredUsers;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function isEmailNotificationEnabled() {
    const value = String(process.env.EMAIL_NOTIFICATIONS_ENABLED || 'true')
        .trim()
        .toLowerCase();
    return !['false', '0', 'no'].includes(value);
}

function escapeHtml(value) {
    return safeText(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function fetchUserEmail(userId) {
    const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    return safeText(data?.email);
}

async function sendNotificationEmailCopy(notification, emailOverride = '') {
    if (!isEmailNotificationEnabled() || !notification?.user_id) return;

    const email = safeText(emailOverride) || await fetchUserEmail(notification.user_id);
    if (!email) return;

    await transporter.sendMail({
        from: mailFrom,
        to: email,
        subject: `[SMaRT-PDM] ${safeText(notification.title) || 'New notification'}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>${escapeHtml(notification.title || 'New notification')}</h2>
                <p>${escapeHtml(notification.message)}</p>
                <p style="color: #666; font-size: 12px;">Open SMaRT-PDM to view the latest details.</p>
            </div>
        `,
        text: `${safeText(notification.title)}\n\n${safeText(notification.message)}\n\nOpen SMaRT-PDM to view the latest details.`,
    });
}

function queueNotificationEmailCopy(notification, emailOverride = '') {
    // Database notifications power the app UI; email copies are best-effort and must not
    // undo the persisted notification if the provider is temporarily unavailable.
    sendNotificationEmailCopy(notification, emailOverride).catch((error) => {
        console.error('ADMIN NOTIFICATION EMAIL COPY ERROR:', {
            notificationId: notification?.notification_id,
            userId: notification?.user_id,
            message: error.message || String(error),
        });
    });
}
async function createNotificationsForAudience({
    audience,
    title,
    message,
    referenceId = null,
    referenceType = 'announcement',
    type = 'Announcement',
    createdAt = null,
}) {
    if (!title || !message || !audience) {
        throw new Error('Title, message, and audience are required');
    }

    const users = await getAudienceUsers(audience);

    if (!users.length) {
        return [];
    }

    const rows = users.map((targetUser) => ({
        user_id: targetUser.user_id,
        type,
        title,
        message,
        reference_id: referenceId,
        reference_type: referenceType,
        is_read: false,
        push_sent: false,
        created_at: createdAt || new Date().toISOString(),
    }));

    const { data, error } = await supabase
        .from('notifications')
        .insert(rows)
        .select();

    if (error) {
        console.error('SUPABASE NOTIFICATION INSERT ERROR:', error);
        throw new Error(error.message);
    }

    const emailByUserId = new Map(users.map((user) => [user.user_id, user.email]));
    for (const row of data || []) {
        queueNotificationEmailCopy(row, emailByUserId.get(row.user_id));
    }
    return data || [];
}

exports.createAnnouncementNotifications = async (payload) => {
    const {
        title,
        content,
        audience,
        schedDate,
    } = payload || {};

    const createdRows = await createNotificationsForAudience({
        audience,
        title,
        message: content,
        referenceType: 'announcement',
        type: 'Announcement',
        createdAt: schedDate ? new Date(schedDate).toISOString() : new Date().toISOString(),
    });

    return {
        inserted: createdRows.length,
        audience,
        title,
    };
};

exports.createNotificationsForAudience = createNotificationsForAudience;

async function createUserNotification({
    userId,
    type,
    title,
    message,
    referenceId = null,
    referenceType = null,
    createdAt = null,
}) {
    if (!userId || !type || !title || !message) {
        throw new Error('userId, type, title, and message are required');
    }

    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            type,
            title,
            message,
            reference_id: referenceId,
            reference_type: referenceType,
            is_read: false,
            push_sent: false,
            created_at: createdAt || new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error('SUPABASE SINGLE NOTIFICATION INSERT ERROR:', error);
        throw new Error(error.message);
    }

    queueNotificationEmailCopy(data);
    return data;
}

exports.createUserNotification = createUserNotification;
