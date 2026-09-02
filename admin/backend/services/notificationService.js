const supabase = require('../config/supabase');
const db = require('../config/db');
const { resolveStaffRole } = require('../utils/staffRoles');

const { relayNotificationBatch } = require('./studentRealtimeRelayService');
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


async function getMobileAudienceStudents() {
    const { data, error } = await supabase
        .from('students')
        .select('user_id,is_active_scholar,scholarship_status,current_program_id,scholar_is_archived,is_archived,account_status');
    if (error) throw new Error(error.message);
    return (data || []).filter((student) => {
        if (!student?.user_id) return false;
        if (student.scholar_is_archived === true || student.is_archived === true) return false;
        return String(student.account_status || 'verified').trim().toLowerCase() !== 'disabled';
    });
}
function isActiveScholarAudienceStudent(student) {
    return student?.is_active_scholar === true ||
        String(student?.scholarship_status || '').trim().toLowerCase() === 'active';
}
async function resolveLegacyProgramId(audience) {
    const key = normalizeAudience(audience);
    if (!['tes','tdp'].includes(key)) return null;
    const { data, error } = await supabase
        .from('scholarship_program')
        .select('program_id,program_name,is_archived');
    if (error) throw new Error(error.message);
    const aliases = key === 'tes' ? ['tertiary education subsidy','tes'] : ['tulong dunong','tdp'];
    const match=(data||[]).find(p=>{
        if(p?.is_archived===true)return false;
        const n=String(p?.program_name||'').trim().toLowerCase();
        return aliases.some(a=>n===a||n.includes(a));
    });
    return match?.program_id || null;
}
async function getAudienceUsers(audience,{programId=null}={}) {
    const key=normalizeAudience(audience);
    const students=await getMobileAudienceStudents();
    const targets=(rows)=>dedupeAudienceUsers(rows.map(s=>({
        user_id:s.user_id,
        role:isActiveScholarAudienceStudent(s)?'student':'applicant'
    })));
    if(key==='all') return targets(students);
    if(key==='applicants') return targets(students.filter(s=>!isActiveScholarAudienceStudent(s)));
    if(key==='scholars') return targets(students.filter(isActiveScholarAudienceStudent));
    if(key==='program'){
        if(!programId) throw new Error('Program ID is required for a program recipient announcement.');
        return targets(students.filter(s=>isActiveScholarAudienceStudent(s)&&String(s.current_program_id||'')===String(programId)));
    }
    if(['tes','tdp'].includes(key)){
        const id=await resolveLegacyProgramId(key);
        return id ? targets(students.filter(s=>isActiveScholarAudienceStudent(s)&&String(s.current_program_id||'')===String(id))) : [];
    }
    throw new Error('Unsupported announcement audience.');
}


function relayCreatedNotifications(rows = []) {
    const notifications = Array.isArray(rows)
        ? rows.filter((row) => row?.notification_id && row?.user_id)
        : [];

    if (!notifications.length) return;

    // Do not block Admin publishing on a cross-backend request. The database
    // realtime bridge remains the fallback, while this direct one-request
    // relay gives connected Mobile clients immediate badge/list updates.
    relayNotificationBatch({
        event: 'notification:new',
        notifications,
    }).catch((error) => {
        console.error(
            '[Announcement Notification Relay] failed:',
            error?.message || error
        );
    });
}

async function createNotificationsForAudience({
    audience,title,message,referenceId=null,referenceType='announcement',
    type='Announcement',createdAt=null,programId=null,
}) {
    if (!title || !message || !audience) throw new Error('Title, message, and audience are required');
    const users=await getAudienceUsers(audience,{programId});
    if(!users.length)return [];
    const timestamp=createdAt||new Date().toISOString();
    const canonical=referenceId &&
        String(referenceType||'').trim().toLowerCase()==='announcement' &&
        String(type||'').trim().toLowerCase()==='announcement';

    if(canonical){
        const userIds=users.map(u=>String(u.user_id||'').trim()).filter(Boolean);
        const {data:existing,error:existingError}=await supabase
            .from('notifications')
            .select('user_id')
            .eq('reference_id',String(referenceId))
            .eq('reference_type','announcement')
            .ilike('type','Announcement')
            .in('user_id',userIds);
        if(existingError)throw new Error(existingError.message);
        const seen=new Set((existing||[]).map(r=>String(r.user_id)));
        const rows=users.filter(u=>!seen.has(String(u.user_id))).map(u=>({
            user_id:u.user_id,type,title,message,
            reference_id:String(referenceId),reference_type:'announcement',
            is_read:false,push_sent:false,created_at:timestamp
        }));
        if(!rows.length)return [];
        const {data,error}=await supabase.from('notifications').insert(rows).select();
        if(error)throw new Error(error.message);
        const createdRows = data || [];
        relayCreatedNotifications(createdRows);
        return createdRows;
    }

    const rows=users.map(u=>({
        user_id:u.user_id,type,title,message,reference_id:referenceId,
        reference_type:referenceType,is_read:false,push_sent:false,created_at:timestamp
    }));
    const {data,error}=await supabase.from('notifications').insert(rows).select();
    if(error)throw new Error(error.message);
    const createdRows = data || [];
        relayCreatedNotifications(createdRows);
        return createdRows;
}


async function syncAnnouncementNotifications({
    audience,title,message,referenceId,createdAt=null,programId=null,
}) {
    if(!title||!message||!audience||!referenceId)
        throw new Error('Title, message, audience, and referenceId are required');

    const users=await getAudienceUsers(audience,{programId});
    const userIds=users.map(u=>String(u.user_id||'').trim()).filter(Boolean);

    const {data:existing,error:existingError}=await supabase
        .from('notifications')
        .select('notification_id,user_id')
        .eq('reference_id',String(referenceId))
        .eq('reference_type','announcement')
        .ilike('type','Announcement');
    if(existingError)throw new Error(existingError.message);

    const target=new Set(userIds);
    const byUser=new Map((existing||[]).map(r=>[String(r.user_id),r.notification_id]));
    const stale=(existing||[]).filter(r=>!target.has(String(r.user_id))).map(r=>r.notification_id).filter(Boolean);
    if(stale.length){
        const {error}=await supabase.from('notifications').delete().in('notification_id',stale);
        if(error)throw new Error(error.message);
    }

    const current=userIds.map(id=>byUser.get(id)).filter(Boolean);
    let updated=0;
    if(current.length){
        const {data,error}=await supabase.from('notifications').update({title,message}).in('notification_id',current).select('notification_id');
        if(error)throw new Error(error.message);
        updated=data?.length||0;
    }

    const rows=users.filter(u=>!byUser.has(String(u.user_id))).map(u=>({
        user_id:u.user_id,type:'Announcement',title,message,
        reference_id:String(referenceId),reference_type:'announcement',
        is_read:false,push_sent:false,created_at:createdAt||new Date().toISOString()
    }));
    let inserted=0;
    if(rows.length){
        const {data,error}=await supabase.from('notifications').insert(rows).select('notification_id');
        if(error)throw new Error(error.message);
        inserted=data?.length||0;
    }
    return {inserted,updated,removedStale:stale.length>0};
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
