const supabase = require('../config/supabase');

const AUDIENCE_TO_ROLE_FILTER = {
    all: null,
    applicants: 'Applicant',
    scholars: 'Student',
    tes: 'Student',
    tdp: 'Student',
};

exports.createAnnouncementNotifications = async (payload, user) => {
    const {
        title,
        content,
        audience,
        schedDate,
    } = payload || {};

    if (!title || !content || !audience) {
        throw new Error('Title, content, and audience are required');
    }

    // Base query: all users
    let usersQuery = supabase
        .from('users')
        .select('user_id, role');

    const roleFilter = AUDIENCE_TO_ROLE_FILTER[audience];

    if (roleFilter) {
        usersQuery = usersQuery.eq('role', roleFilter);
    }

    const { data: users, error: usersError } = await usersQuery;

    if (usersError) {
        console.error('SUPABASE USERS FETCH ERROR:', usersError);
        throw new Error(usersError.message);
    }

    let filteredUsers = users || [];

    // Optional audience refinement hooks
    // Adjust these later if you have exact tables/flags for TES/TDP/applicants
    if (audience === 'applicants') {
        filteredUsers = filteredUsers.filter((u) => u.role === 'Applicant');
    }

    if (audience === 'scholars') {
        filteredUsers = filteredUsers.filter((u) => u.role === 'Student');
    }

    if (audience === 'tes') {
        // Placeholder logic: currently same as student role filter
        filteredUsers = filteredUsers.filter((u) => u.role === 'Student');
    }

    if (audience === 'tdp') {
        // Placeholder logic: currently same as student role filter
        filteredUsers = filteredUsers.filter((u) => u.role === 'Student');
    }

    if (!filteredUsers.length) {
        return {
            inserted: 0,
            audience,
            title,
        };
    }

    const createdAt = schedDate ? new Date(schedDate).toISOString() : new Date().toISOString();

    const rows = filteredUsers.map((targetUser) => ({
        user_id: targetUser.user_id,
        type: 'Announcement',
        title,
        message: content,
        reference_id: null,
        reference_type: 'announcement',
        is_read: false,
        push_sent: false,
        created_at: createdAt,
    }));

    const { data, error } = await supabase
        .from('notifications')
        .insert(rows)
        .select();

    if (error) {
        console.error('SUPABASE NOTIFICATION INSERT ERROR:', error);
        throw new Error(error.message);
    }

    return {
        inserted: data?.length || 0,
        audience,
        title,
    };
};