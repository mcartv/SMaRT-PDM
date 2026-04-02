const supabase = require('../config/supabase');

const AUDIENCE_LABEL = {
    all: 'All Students',
    applicants: 'New Applicants',
    scholars: 'Current Scholars',
    tes: 'TES Recipients',
    tdp: 'TDP Recipients',
};

function mapAnnouncementRow(row) {
    return {
        id: row.announcement_id,
        title: row.subject,
        content: row.content,
        status: row.status,
        date: row.published_at || row.scheduled_at || row.publish_date || row.created_at,
        audience: AUDIENCE_LABEL[row.target_audience] || row.target_audience,
        audienceKey: row.target_audience,
        isRoVoluntary: !!row.is_ro_voluntary,
        views: 0,
    };
}

async function getTargetUsersForAudience(audience) {
    let usersQuery = supabase
        .from('users')
        .select('user_id, role');

    if (audience === 'applicants') {
        usersQuery = usersQuery.eq('role', 'Applicant');
    } else if (['scholars', 'tes', 'tdp'].includes(audience)) {
        usersQuery = usersQuery.eq('role', 'Student');
    }

    const { data, error } = await usersQuery;

    if (error) {
        console.error('SUPABASE USERS FETCH ERROR:', error);
        throw new Error(error.message);
    }

    return data || [];
}

async function createAnnouncementNotifications(announcementRow) {
    const targetUsers = await getTargetUsersForAudience(announcementRow.target_audience);

    if (!targetUsers.length) {
        return 0;
    }

    const notificationRows = targetUsers.map((user) => ({
        user_id: user.user_id,
        type: 'Announcement',
        title: announcementRow.subject,
        message: announcementRow.content,
        reference_id: announcementRow.announcement_id,
        reference_type: 'announcement',
        is_read: false,
        push_sent: false,
        created_at: announcementRow.published_at || new Date().toISOString(),
    }));

    const { data, error } = await supabase
        .from('notifications')
        .insert(notificationRows)
        .select('notification_id');

    if (error) {
        console.error('SUPABASE ANNOUNCEMENT NOTIFICATION INSERT ERROR:', error);
        throw new Error(error.message);
    }

    return data?.length || 0;
}

async function publishAnnouncementInternal(announcementId) {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
        .from('announcements')
        .update({
            status: 'Published',
            publish_date: nowIso,
            published_at: nowIso,
            updated_at: nowIso,
        })
        .eq('announcement_id', announcementId)
        .eq('is_archived', false)
        .select()
        .single();

    if (error) {
        console.error('SUPABASE PUBLISH ANNOUNCEMENT ERROR:', error);
        throw new Error(error.message);
    }

    const notificationsInserted = await createAnnouncementNotifications(data);

    return {
        ...mapAnnouncementRow(data),
        notificationsInserted,
    };
}

exports.fetchAnnouncements = async () => {
    const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('SUPABASE FETCH ANNOUNCEMENTS ERROR:', error);
        throw new Error(error.message);
    }

    return (data || []).map(mapAnnouncementRow);
};

exports.createAnnouncement = async (payload, user) => {
    const {
        title,
        content,
        audience,
        schedDate,
        isRoVoluntary = false,
        forceDraft = false,
    } = payload || {};

    if (!audience) {
        throw new Error('Audience is required');
    }

    if (!forceDraft && (!title || !content)) {
        throw new Error('Title and content are required');
    }

    if (schedDate) {
        const scheduledTime = new Date(schedDate);
        const now = new Date();

        if (scheduledTime < now) {
            throw new Error('Scheduled date must be current or future.');
        }
    }

    const isScheduled = !!schedDate && !forceDraft;

    const insertRow = {
        author_id: user?.userId || null,
        subject: (title || '').trim(),
        content: (content || '').trim(),
        target_audience: audience,
        is_ro_voluntary: !!isRoVoluntary,
        publish_date: forceDraft ? null : (isScheduled ? null : new Date().toISOString()),
        status: forceDraft ? 'Draft' : (isScheduled ? 'Scheduled' : 'Published'),
        scheduled_at: forceDraft ? null : (isScheduled ? schedDate : null),
        published_at: forceDraft ? null : (isScheduled ? null : new Date().toISOString()),
        updated_at: new Date().toISOString(),
        is_archived: false,
    };

    const { data, error } = await supabase
        .from('announcements')
        .insert(insertRow)
        .select()
        .single();

    if (error) {
        console.error('SUPABASE CREATE ANNOUNCEMENT ERROR:', error);
        throw new Error(error.message);
    }

    if (data.status === 'Published') {
        await createAnnouncementNotifications(data);
    }

    return mapAnnouncementRow(data);
};

exports.updateAnnouncement = async (announcementId, payload) => {
    const {
        title,
        content,
        audience,
        schedDate,
        isRoVoluntary = false,
        forceDraft = false,
    } = payload || {};

    if (!audience) {
        throw new Error('Audience is required');
    }

    if (!forceDraft && (!title || !content)) {
        throw new Error('Title and content are required');
    }

    if (schedDate) {
        const scheduledTime = new Date(schedDate);
        const now = new Date();

        if (scheduledTime < now) {
            throw new Error('Scheduled date must be current or future.');
        }
    }

    const isScheduled = !!schedDate && !forceDraft;

    const updateRow = {
        subject: (title || '').trim(),
        content: (content || '').trim(),
        target_audience: audience,
        is_ro_voluntary: !!isRoVoluntary,
        status: forceDraft ? 'Draft' : (isScheduled ? 'Scheduled' : 'Published'),
        scheduled_at: forceDraft ? null : (isScheduled ? schedDate : null),
        publish_date: forceDraft ? null : (isScheduled ? null : new Date().toISOString()),
        published_at: forceDraft ? null : (isScheduled ? null : new Date().toISOString()),
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('announcements')
        .update(updateRow)
        .eq('announcement_id', announcementId)
        .eq('is_archived', false)
        .select()
        .single();

    if (error) {
        console.error('SUPABASE UPDATE ANNOUNCEMENT ERROR:', error);
        throw new Error(error.message);
    }

    return mapAnnouncementRow(data);
};

exports.publishAnnouncement = async (announcementId) => {
    return await publishAnnouncementInternal(announcementId);
};

exports.publishDueAnnouncements = async () => {
    const now = new Date();
    const nowLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 19);

    const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('status', 'Scheduled')
        .eq('is_archived', false)
        .lte('scheduled_at', nowLocal);

    if (error) {
        console.error('SUPABASE FETCH DUE ANNOUNCEMENTS ERROR:', error);
        throw new Error(error.message);
    }

    if (!data || data.length === 0) {
        return [];
    }

    const published = [];

    for (const row of data) {
        try {
            const result = await publishAnnouncementInternal(row.announcement_id);
            published.push(result);
        } catch (err) {
            console.error(`FAILED TO AUTO-PUBLISH ANNOUNCEMENT ${row.announcement_id}:`, err.message);
        }
    }

    return published;
};

exports.archiveAnnouncement = async (announcementId) => {
    const { error } = await supabase
        .from('announcements')
        .update({
            is_archived: true,
            updated_at: new Date().toISOString(),
        })
        .eq('announcement_id', announcementId);

    if (error) {
        console.error('SUPABASE ARCHIVE ANNOUNCEMENT ERROR:', error);
        throw new Error(error.message);
    }

    return true;
};