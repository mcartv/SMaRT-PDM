const supabase = require('../config/supabase');
const db = require('../config/db');
const { resolveStaffRole } = require('../utils/staffRoles');

function normalizeAudience(value) {
    return String(value || '').trim().toLowerCase();
}

function dedupeAudienceUsers(users = []) {
    const seen = new Set();
    return users.filter((user) => {
        const userId = String(user?.user_id || '').trim();
        if (!userId || seen.has(userId)) return false;
        seen.add(userId);
        return true;
    });
}

async function getApplicantAudienceUsers() {
    const { rows } = await db.query(
        `
        SELECT DISTINCT u.user_id, u.role
        FROM users u
        LEFT JOIN students s ON s.user_id = u.user_id
        WHERE lower(coalesce(u.role, '')) IN ('student', 'applicant')
          AND (
            lower(coalesce(u.role, '')) = 'applicant'
            OR NOT (
              coalesce(s.is_active_scholar, false) = true
              OR lower(coalesce(s.scholarship_status, '')) = 'active'
            )
          )
          AND coalesce(s.scholar_is_archived, false) = false
          AND coalesce(s.is_archived, false) = false
          AND lower(coalesce(s.account_status, 'verified')) <> 'disabled'
        `
    );

    return rows || [];
}

async function getActiveScholarAudienceUsers(programId = null) {
    const params = [];
    let programCondition = '';

    if (programId) {
        params.push(programId);
        programCondition = `AND s.current_program_id = $${params.length}`;
    }

    const { rows } = await db.query(
        `
        SELECT DISTINCT u.user_id, u.role
        FROM users u
        INNER JOIN students s ON s.user_id = u.user_id
        WHERE lower(coalesce(u.role, '')) = 'student'
          AND (
            coalesce(s.is_active_scholar, false) = true
            OR lower(coalesce(s.scholarship_status, '')) = 'active'
          )
          AND coalesce(s.scholar_is_archived, false) = false
          AND coalesce(s.is_archived, false) = false
          AND lower(coalesce(s.account_status, 'verified')) <> 'disabled'
          ${programCondition}
        `,
        params
    );

    return rows || [];
}

async function resolveLegacyProgramId(audience) {
    const normalizedAudience = normalizeAudience(audience);
    if (!['tes', 'tdp'].includes(normalizedAudience)) return null;

    const patterns = normalizedAudience === 'tes'
        ? ['%tertiary education subsidy%', 'tes%', '% tes %']
        : ['%tulong dunong%', 'tdp%', '% tdp %'];

    const { rows } = await db.query(
        `
        SELECT program_id
        FROM scholarship_program
        WHERE coalesce(is_archived, false) = false
          AND (
            lower(program_name) LIKE $1
            OR lower(program_name) LIKE $2
            OR (' ' || lower(program_name) || ' ') LIKE $3
          )
        ORDER BY program_name
        LIMIT 1
        `,
        patterns
    );

    return rows[0]?.program_id || null;
}

async function getAudienceUsers(audience, { programId = null } = {}) {
    const normalizedAudience = normalizeAudience(audience);

    if (normalizedAudience === 'applicants') {
        return getApplicantAudienceUsers();
    }

    if (normalizedAudience === 'scholars') {
        return getActiveScholarAudienceUsers();
    }

    if (normalizedAudience === 'program') {
        if (!programId) {
            throw new Error('Program ID is required for a program recipient announcement.');
        }
        return getActiveScholarAudienceUsers(programId);
    }

    if (['tes', 'tdp'].includes(normalizedAudience)) {
        const legacyProgramId = await resolveLegacyProgramId(normalizedAudience);
        return legacyProgramId ? getActiveScholarAudienceUsers(legacyProgramId) : [];
    }

    if (normalizedAudience === 'all') {
        const [applicants, scholars] = await Promise.all([
            getApplicantAudienceUsers(),
            getActiveScholarAudienceUsers(),
        ]);
        return dedupeAudienceUsers([...applicants, ...scholars]);
    }

    throw new Error('Unsupported announcement audience.');
}

async function createNotificationsForAudience({
    audience,
    title,
    message,
    referenceId = null,
    referenceType = 'announcement',
    type = 'Announcement',
    createdAt = null,
    programId = null,
}) {
    if (!title || !message || !audience) {
        throw new Error('Title, message, and audience are required');
    }

    const users = await getAudienceUsers(audience, { programId });

    if (!users.length) {
        return [];
    }

    const timestamp = createdAt || new Date().toISOString();
    const isCanonicalAnnouncement =
        referenceId &&
        String(referenceType || '').trim().toLowerCase() === 'announcement' &&
        String(type || '').trim().toLowerCase() === 'announcement';

    if (isCanonicalAnnouncement) {
        const userIds = users
            .map((targetUser) => String(targetUser?.user_id || '').trim())
            .filter(Boolean);

        const { rows } = await db.query(
            `
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                reference_id,
                reference_type,
                is_read,
                push_sent,
                created_at
            )
            SELECT
                target.user_id,
                $2,
                $3,
                $4,
                $5,
                $6,
                false,
                false,
                $7::timestamptz
            FROM unnest($1::uuid[]) AS target(user_id)
            WHERE NOT EXISTS (
                SELECT 1
                FROM notifications existing
                WHERE existing.user_id = target.user_id
                  AND existing.reference_id = $5
                  AND existing.reference_type = $6
                  AND lower(existing.type) = lower($2)
            )
            ON CONFLICT DO NOTHING
            RETURNING
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
            [
                userIds,
                type,
                title,
                message,
                referenceId,
                referenceType,
                timestamp,
            ]
        );

        return rows || [];
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
        created_at: timestamp,
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

async function syncAnnouncementNotifications({
    audience,
    title,
    message,
    referenceId,
    createdAt = null,
    programId = null,
}) {
    if (!title || !message || !audience || !referenceId) {
        throw new Error('Title, message, audience, and referenceId are required');
    }

    const users = await getAudienceUsers(audience, { programId });
    const userIds = users
        .map((targetUser) => String(targetUser?.user_id || '').trim())
        .filter(Boolean);

    if (!userIds.length) {
        await db.query(
            `
            DELETE FROM notifications
            WHERE reference_id = $1
              AND lower(coalesce(reference_type, '')) = 'announcement'
              AND lower(coalesce(type, '')) = 'announcement'
            `,
            [referenceId]
        );

        return { inserted: 0, updated: 0, removedStale: true };
    }

    await db.query(
        `
        DELETE FROM notifications
        WHERE reference_id = $1
          AND lower(coalesce(reference_type, '')) = 'announcement'
          AND lower(coalesce(type, '')) = 'announcement'
          AND NOT (user_id = ANY($2::uuid[]))
        `,
        [referenceId, userIds]
    );

    const { rowCount: updated = 0 } = await db.query(
        `
        UPDATE notifications
        SET title = $2,
            message = $3
        WHERE reference_id = $1
          AND lower(coalesce(reference_type, '')) = 'announcement'
          AND lower(coalesce(type, '')) = 'announcement'
          AND user_id = ANY($4::uuid[])
        `,
        [referenceId, title, message, userIds]
    );

    const timestamp = createdAt || new Date().toISOString();
    const { rows: insertedRows } = await db.query(
        `
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            reference_id,
            reference_type,
            is_read,
            push_sent,
            created_at
        )
        SELECT
            target.user_id,
            'Announcement',
            $2,
            $3,
            $4,
            'announcement',
            false,
            false,
            $5::timestamptz
        FROM unnest($1::uuid[]) AS target(user_id)
        WHERE NOT EXISTS (
            SELECT 1
            FROM notifications existing
            WHERE existing.user_id = target.user_id
              AND existing.reference_id = $4
              AND lower(coalesce(existing.reference_type, '')) = 'announcement'
              AND lower(coalesce(existing.type, '')) = 'announcement'
        )
        RETURNING notification_id
        `,
        [userIds, title, message, referenceId, timestamp]
    );

    return {
        inserted: insertedRows?.length || 0,
        updated,
        removedStale: true,
    };
}

exports.createAnnouncementNotifications = async (payload) => {
    const {
        title,
        content,
        audience,
        schedDate,
        programId = null,
        targetProgramId = null,
    } = payload || {};

    const createdRows = await createNotificationsForAudience({
        audience,
        title,
        message: content,
        referenceType: 'announcement',
        type: 'Announcement',
        createdAt: schedDate ? new Date(schedDate).toISOString() : new Date().toISOString(),
        programId: programId || targetProgramId || null,
    });

    return {
        inserted: createdRows.length,
        audience,
        title,
    };
};

exports.getAudienceUsers = getAudienceUsers;
exports.createNotificationsForAudience = createNotificationsForAudience;
exports.syncAnnouncementNotifications = syncAnnouncementNotifications;

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

async function createUserNotificationOnce({
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

    const timestamp = createdAt || new Date().toISOString();
    const { rows } = await db.query(
        `
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            reference_id,
            reference_type,
            is_read,
            read_at,
            push_sent,
            created_at
        )
        SELECT $1, $2, $3, $4, $5, $6, false, false, $7
        WHERE NOT EXISTS (
            SELECT 1
            FROM notifications existing
            WHERE existing.user_id = $1
              AND existing.type = $2
              AND existing.title = $3
              AND existing.reference_id IS NOT DISTINCT FROM $5
              AND existing.reference_type IS NOT DISTINCT FROM $6
        )
        RETURNING
            notification_id,
            user_id,
            type,
            title,
            message,
            reference_id,
            reference_type,
            is_read,
            read_at,
            push_sent,
            created_at
        `,
        [
            userId,
            type,
            title,
            message,
            referenceId,
            referenceType,
            timestamp,
        ]
    );

    return rows[0] || null;
}

exports.createUserNotificationOnce = createUserNotificationOnce;

async function getStaffTargets({ roles = [], courseId = null, excludeUserIds = [] } = {}) {
    const normalizedRoles = new Set(
        (Array.isArray(roles) ? roles : [roles])
            .map((role) => String(role || '').trim().toLowerCase())
            .filter(Boolean)
    );
    const excluded = new Set(
        (Array.isArray(excludeUserIds) ? excludeUserIds : [excludeUserIds])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
    );

    if (!normalizedRoles.size) return [];

    const { rows } = await db.query(
        `
        SELECT
            u.user_id,
            u.email,
            u.role AS user_role,
            ap.admin_id,
            ap.first_name,
            ap.last_name,
            ap.department,
            ap.position
        FROM users u
        INNER JOIN admin_profiles ap ON ap.user_id = u.user_id
        WHERE COALESCE(ap.is_archived, false) = false
        `
    );

    let targets = rows
        .map((row) => ({
            ...row,
            resolved_role: resolveStaffRole(row),
        }))
        .filter((row) => normalizedRoles.has(row.resolved_role))
        .filter((row) => !excluded.has(String(row.user_id)))
        .map((row) => ({
            user_id: row.user_id,
            role: row.resolved_role,
            email: row.email,
            name:
                [row.first_name, row.last_name].filter(Boolean).join(' ') ||
                row.email ||
                'User',
        }));

    if (courseId && normalizedRoles.has('pd')) {
        const assignmentResult = await db.query(
            `
            SELECT pd_user_id
            FROM program_director_course_assignments
            WHERE course_id = $1
              AND is_active = true
            `,
            [courseId]
        );
        const assignedPdIds = new Set(
            assignmentResult.rows.map((row) => String(row.pd_user_id))
        );

        targets = targets.filter(
            (target) =>
                target.role !== 'pd' || assignedPdIds.has(String(target.user_id))
        );
    }

    return targets;
}

async function createStaffNotifications({
    roles,
    type,
    title,
    message,
    referenceId = null,
    referenceType = null,
    courseId = null,
    excludeUserIds = [],
}) {
    const targets = await getStaffTargets({ roles, courseId, excludeUserIds });
    const notifications = [];

    for (const target of targets) {
        const notification = await createUserNotification({
            userId: target.user_id,
            type,
            title,
            message,
            referenceId,
            referenceType,
        });

        notifications.push({
            ...notification,
            target_user_id: target.user_id,
            target_role: target.role,
        });
    }

    return notifications;
}

exports.getStaffTargets = getStaffTargets;
exports.createStaffNotifications = createStaffNotifications;

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
            read_at,
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
        .update({ is_read: true, read_at: new Date().toISOString() })
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
            read_at,
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

async function markAsUnread(userId, notificationId) {
    if (!userId || !notificationId) {
        throw new Error('User ID and notification ID are required');
    }

    const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: false, read_at: null })
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
            read_at,
            push_sent,
            created_at
        `
        )
        .maybeSingle();

    if (error) {
        console.error('SUPABASE MARK NOTIFICATION UNREAD ERROR:', error);
        throw new Error(error.message);
    }

    if (!data) {
        throw new Error('Notification not found.');
    }

    return {
        message: 'Notification marked as unread.',
        notification: data,
    };
}

async function markAllAsRead(userId) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
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
exports.markAsUnread = markAsUnread;
exports.markAllAsRead = markAllAsRead;
exports.deleteNotification = deleteNotification;
