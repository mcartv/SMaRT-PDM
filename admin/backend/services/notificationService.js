const supabase = require('../config/supabase');

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
        .select('user_id, role');

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

    return data;
}

exports.createUserNotification = createUserNotification;

async function getMyNotifications(userId, query = {}) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    const parsedLimit = Number.parseInt(query.limit, 10);
    const parsedOffset = Number.parseInt(query.offset, 10);
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;
    const offset = Number.isInteger(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    const { data, error, count } = await supabase
        .from('notifications')
        .select(
            `
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
        `,
            { count: 'exact' }
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (error) {
        console.error('SUPABASE NOTIFICATION LIST ERROR:', error);
        throw new Error(error.message);
    }

    return {
        items: data || [],
        total: count || 0,
        limit,
        offset,
        unreadCount: (data || []).filter((item) => item.is_read === false).length,
    };
}

async function getUnreadCount(userId) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    const { count, error } = await supabase
        .from('notifications')
        .select('notification_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

    if (error) {
        console.error('SUPABASE UNREAD NOTIFICATION COUNT ERROR:', error);
        throw new Error(error.message);
    }

    return {
        unreadCount: count || 0,
    };
}

async function markAsRead(userId, notificationId) {
    if (!userId || !notificationId) {
        throw new Error('User ID and notification ID are required');
    }

    const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('notification_id', notificationId)
        .eq('user_id', userId)
        .select(
            `
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
        `
        )
        .maybeSingle();

    if (error) {
        console.error('SUPABASE MARK NOTIFICATION READ ERROR:', error);
        throw new Error(error.message);
    }

    if (!data) {
        throw new Error('Notification not found.');
    }

    return {
        message: 'Notification marked as read.',
        notification: data,
    };
}

async function markAllAsRead(userId) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .select('notification_id');

    if (error) {
        console.error('SUPABASE MARK ALL NOTIFICATIONS READ ERROR:', error);
        throw new Error(error.message);
    }

    return {
        message: 'All notifications marked as read.',
        updatedCount: data?.length || 0,
    };
}

async function deleteNotification(userId, notificationId) {
    if (!userId || !notificationId) {
        throw new Error('User ID and notification ID are required');
    }

    const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('notification_id', notificationId)
        .eq('user_id', userId)
        .select('notification_id')
        .maybeSingle();

    if (error) {
        console.error('SUPABASE DELETE NOTIFICATION ERROR:', error);
        throw new Error(error.message);
    }

    if (!data) {
        throw new Error('Notification not found.');
    }

    return {
        message: 'Notification deleted.',
        notificationId,
    };
}

exports.getMyNotifications = getMyNotifications;
exports.getUnreadCount = getUnreadCount;
exports.markAsRead = markAsRead;
exports.markAllAsRead = markAllAsRead;
exports.deleteNotification = deleteNotification;
