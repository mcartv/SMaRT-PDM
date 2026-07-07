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
