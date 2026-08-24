const supabase = require('../config/supabase');
const notificationService = require('./notificationService');

const AUDIENCE_LABEL = {
    all: 'All Students',
    applicants: 'New Applicants',
    scholars: 'Current Scholars',
    tes: 'TES Recipients',
    tdp: 'TDP Recipients',
};

const ALLOWED_AUDIENCES = new Set([
    'all',
    'applicants',
    'scholars',
    'program',
    // Kept for historical announcements created before dynamic program targeting.
    'tes',
    'tdp',
]);

function normalizeAudience(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeProgramId(value) {
    const programId = String(value || '').trim();
    if (!programId) return null;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(programId)) {
        throw new Error('Program ID is invalid.');
    }

    return programId;
}

async function validateAudienceTarget(audience, programId) {
    const normalizedAudience = normalizeAudience(audience);

    if (!ALLOWED_AUDIENCES.has(normalizedAudience)) {
        throw new Error('Unsupported announcement audience.');
    }

    if (normalizedAudience !== 'program') {
        return {
            audience: normalizedAudience,
            programId: null,
            programName: null,
        };
    }

    const normalizedProgramId = normalizeProgramId(programId);
    if (!normalizedProgramId) {
        throw new Error('Select a scholarship program for the recipient audience.');
    }

    const { data, error } = await supabase
        .from('scholarship_program')
        .select('program_id, program_name, visibility_status, is_archived')
        .eq('program_id', normalizedProgramId)
        .maybeSingle();

    if (error) {
        throw new Error(error.message);
    }

    if (!data) {
        throw new Error('Selected scholarship program does not exist.');
    }

    if (data.is_archived === true || data.visibility_status !== 'Published') {
        throw new Error('Selected scholarship program is not active for announcements.');
    }

    return {
        audience: normalizedAudience,
        programId: data.program_id,
        programName: data.program_name,
    };
}

async function getProgramNameMap(rows = []) {
    const programIds = [
        ...new Set(
            rows
                .map((row) => row?.target_program_id)
                .filter(Boolean)
                .map(String)
        ),
    ];

    if (!programIds.length) return new Map();

    const { data, error } = await supabase
        .from('scholarship_program')
        .select('program_id, program_name')
        .in('program_id', programIds);

    if (error) {
        console.error('SUPABASE ANNOUNCEMENT PROGRAM LABEL FETCH ERROR:', error);
        return new Map();
    }

    return new Map(
        (data || []).map((program) => [String(program.program_id), program.program_name])
    );
}

function mapAnnouncementRow(row, programName = null, viewCount = 0) {
    const audienceKey = normalizeAudience(row.target_audience) || 'all';
    const resolvedProgramName = programName || null;
    const audienceLabel = audienceKey === 'program'
        ? `${resolvedProgramName || 'Scholarship Program'} Recipients`
        : AUDIENCE_LABEL[audienceKey] || row.target_audience;

    return {
        id: row.announcement_id,
        title: row.subject,
        content: row.content,
        status: row.is_archived ? 'Archived' : row.status,
        date: row.published_at || row.scheduled_at || row.publish_date || row.created_at,
        audience: audienceLabel,
        audienceKey,
        targetProgramId: row.target_program_id || null,
        targetProgramName: resolvedProgramName,
        templateKey: row.template_key || 'blank',
        isRoVoluntary: !!row.is_ro_voluntary,
        is_archived: !!row.is_archived,
        scheduledAt: row.scheduled_at || null,
        publishedAt: row.published_at || null,
        createdAt: row.created_at || null,
        updatedAt: row.updated_at || null,
        views: Number(viewCount || 0),
    };
}

async function getAnnouncementViewCountMap(rows = []) {
    const announcementIds = [
        ...new Set(
            rows
                .map((row) => row?.announcement_id)
                .filter(Boolean)
                .map(String)
        ),
    ];

    if (!announcementIds.length) return new Map();

    const { data, error } = await supabase
        .from('announcement_views')
        .select('announcement_id')
        .in('announcement_id', announcementIds);

    if (error) {
        // Keep announcement management usable if the migration has not been
        // applied yet, but make the missing tracking table obvious in logs.
        console.error('SUPABASE ANNOUNCEMENT VIEW COUNT FETCH ERROR:', error);
        return new Map();
    }

    const counts = new Map();
    for (const view of data || []) {
        const id = String(view.announcement_id || '');
        if (!id) continue;
        counts.set(id, Number(counts.get(id) || 0) + 1);
    }

    return counts;
}

async function mapAnnouncementRows(rows = []) {
    const [programNames, viewCounts] = await Promise.all([
        getProgramNameMap(rows),
        getAnnouncementViewCountMap(rows),
    ]);

    return rows.map((row) =>
        mapAnnouncementRow(
            row,
            row.target_program_id
                ? programNames.get(String(row.target_program_id)) || null
                : null,
            viewCounts.get(String(row.announcement_id)) || 0
        )
    );
}

async function mapSingleAnnouncementRow(row) {
    const [mapped] = await mapAnnouncementRows(row ? [row] : []);
    return mapped || null;
}

async function createAnnouncementNotifications(announcementRow) {
    try {
        const rows = await notificationService.createNotificationsForAudience({
            audience: announcementRow.target_audience,
            programId: announcementRow.target_program_id || null,
            title: announcementRow.subject,
            message: announcementRow.content,
            referenceId: announcementRow.announcement_id,
            referenceType: 'announcement',
            type: 'Announcement',
            createdAt: announcementRow.published_at || new Date().toISOString(),
        });

        return Array.isArray(rows) ? rows.length : 0;
    } catch (err) {
        console.error('CREATE ANNOUNCEMENT NOTIFICATIONS ERROR:', err.message);
        return 0;
    }
}

async function syncPublishedAnnouncementNotifications(announcementRow) {
    try {
        return await notificationService.syncAnnouncementNotifications({
            audience: announcementRow.target_audience,
            programId: announcementRow.target_program_id || null,
            title: announcementRow.subject,
            message: announcementRow.content,
            referenceId: announcementRow.announcement_id,
            createdAt:
                announcementRow.published_at ||
                announcementRow.publish_date ||
                new Date().toISOString(),
        });
    } catch (err) {
        console.error('SYNC ANNOUNCEMENT NOTIFICATIONS ERROR:', err.message);
        return { inserted: 0, updated: 0, removedStale: false };
    }
}

async function publishAnnouncementInternal(announcementId) {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
        .from('announcements')
        .update({
            status: 'Published',
            publish_date: nowIso,
            published_at: nowIso,
            scheduled_at: null,
            updated_at: nowIso,
        })
        .eq('announcement_id', announcementId)
        .eq('is_archived', false)
        .in('status', ['Draft', 'Scheduled'])
        .select()
        .single();

    if (error) {
        console.error('SUPABASE PUBLISH ANNOUNCEMENT ERROR:', error);
        throw new Error(error.message);
    }

    const notificationsInserted = await createAnnouncementNotifications(data);

    return {
        ...(await mapSingleAnnouncementRow(data)),
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

    return mapAnnouncementRows(data || []);
};

exports.fetchArchivedAnnouncements = async () => {
    const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_archived', true)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('SUPABASE FETCH ARCHIVED ANNOUNCEMENTS ERROR:', error);
        throw new Error(error.message);
    }

    return mapAnnouncementRows(data || []);
};

exports.createAnnouncement = async (payload, user) => {
    const {
        title,
        content,
        audience,
        programId,
        targetProgramId,
        schedDate,
        templateKey = 'blank',
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

    const target = await validateAudienceTarget(
        audience,
        programId || targetProgramId || null
    );
    const isScheduled = !!schedDate && !forceDraft;
    const nowIso = new Date().toISOString();

    const insertRow = {
        author_id: user?.userId || user?.user_id || null,
        subject: (title || '').trim(),
        content: (content || '').trim(),
        target_audience: target.audience,
        target_program_id: target.programId,
        template_key: String(templateKey || 'blank').trim() || 'blank',
        is_ro_voluntary: !!isRoVoluntary,
        publish_date: forceDraft ? null : isScheduled ? null : nowIso,
        status: forceDraft ? 'Draft' : isScheduled ? 'Scheduled' : 'Published',
        scheduled_at: forceDraft ? null : isScheduled ? schedDate : null,
        published_at: forceDraft ? null : isScheduled ? null : nowIso,
        updated_at: nowIso,
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

    let notificationsInserted = 0;

    if (data.status === 'Published') {
        notificationsInserted = await createAnnouncementNotifications(data);
    }

    return {
        ...(await mapSingleAnnouncementRow(data)),
        notificationsInserted,
    };
};

exports.updateAnnouncement = async (announcementId, payload) => {
    const {
        title,
        content,
        audience,
        programId,
        targetProgramId,
        schedDate,
        templateKey = 'blank',
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

    const target = await validateAudienceTarget(
        audience,
        programId || targetProgramId || null
    );
    const isScheduled = !!schedDate && !forceDraft;
    const nowIso = new Date().toISOString();

    const { data: currentAnnouncement, error: currentError } = await supabase
        .from('announcements')
        .select('status, publish_date, published_at')
        .eq('announcement_id', announcementId)
        .eq('is_archived', false)
        .single();

    if (currentError) {
        console.error('SUPABASE LOAD ANNOUNCEMENT BEFORE UPDATE ERROR:', currentError);
        throw new Error(currentError.message);
    }

    const wasPublished =
        String(currentAnnouncement?.status || '').trim().toLowerCase() === 'published';
    const publishesImmediately = !forceDraft && !isScheduled;
    const publishedNow = publishesImmediately && !wasPublished;

    const updateRow = {
        subject: (title || '').trim(),
        content: (content || '').trim(),
        target_audience: target.audience,
        target_program_id: target.programId,
        template_key: String(templateKey || 'blank').trim() || 'blank',
        is_ro_voluntary: !!isRoVoluntary,
        status: forceDraft ? 'Draft' : isScheduled ? 'Scheduled' : 'Published',
        scheduled_at: forceDraft ? null : isScheduled ? schedDate : null,
        publish_date: forceDraft
            ? null
            : isScheduled
                ? null
                : wasPublished
                    ? currentAnnouncement?.publish_date || currentAnnouncement?.published_at || nowIso
                    : nowIso,
        published_at: forceDraft
            ? null
            : isScheduled
                ? null
                : wasPublished
                    ? currentAnnouncement?.published_at || currentAnnouncement?.publish_date || nowIso
                    : nowIso,
        updated_at: nowIso,
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

    let notificationsInserted = 0;
    let notificationsUpdated = 0;

    if (publishedNow && data.status === 'Published') {
        notificationsInserted = await createAnnouncementNotifications(data);
    } else if (data.status === 'Published') {
        const syncResult = await syncPublishedAnnouncementNotifications(data);
        notificationsInserted = syncResult.inserted;
        notificationsUpdated = syncResult.updated;
    }

    return {
        ...(await mapSingleAnnouncementRow(data)),
        notificationsInserted,
        notificationsUpdated,
        publishedNow,
    };
};

exports.publishAnnouncement = async (announcementId) => {
    return publishAnnouncementInternal(announcementId);
};

exports.publishDueAnnouncements = async () => {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
        .from('announcements')
        .select('announcement_id')
        .eq('status', 'Scheduled')
        .eq('is_archived', false)
        .lte('scheduled_at', nowIso);

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
            console.error(
                `FAILED TO AUTO-PUBLISH ANNOUNCEMENT ${row.announcement_id}:`,
                err.message
            );
        }
    }

    return published;
};

exports.archiveAnnouncement = async (announcementId) => {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
        .from('announcements')
        .update({
            is_archived: true,
            updated_at: nowIso,
        })
        .eq('announcement_id', announcementId)
        .eq('is_archived', false)
        .select()
        .single();

    if (error) {
        console.error('SUPABASE ARCHIVE ANNOUNCEMENT ERROR:', error);
        throw new Error(error.message);
    }

    return mapSingleAnnouncementRow(data);
};

// Archived scheduled announcements remain archived even after their scheduled time.
// The due-date conversion below runs only when an Admin explicitly restores one.
exports.restoreAnnouncement = async (announcementId) => {
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: archived, error: archivedError } = await supabase
        .from('announcements')
        .select('announcement_id, status, scheduled_at, publish_date, published_at')
        .eq('announcement_id', announcementId)
        .eq('is_archived', true)
        .single();

    if (archivedError) {
        console.error('SUPABASE LOAD ARCHIVED ANNOUNCEMENT ERROR:', archivedError);
        throw new Error(archivedError.message);
    }

    const scheduledAt = archived?.scheduled_at ? new Date(archived.scheduled_at) : null;
    const scheduledIsDue =
        String(archived?.status || '').trim().toLowerCase() === 'scheduled' &&
        scheduledAt instanceof Date &&
        !Number.isNaN(scheduledAt.getTime()) &&
        scheduledAt.getTime() <= now.getTime();

    const updateRow = {
        is_archived: false,
        updated_at: nowIso,
    };

    if (scheduledIsDue) {
        updateRow.status = 'Published';
        updateRow.scheduled_at = null;
        updateRow.publish_date = archived.publish_date || archived.published_at || nowIso;
        updateRow.published_at = archived.published_at || archived.publish_date || nowIso;
    }

    const { data, error } = await supabase
        .from('announcements')
        .update(updateRow)
        .eq('announcement_id', announcementId)
        .eq('is_archived', true)
        .select()
        .single();

    if (error) {
        console.error('SUPABASE RESTORE ANNOUNCEMENT ERROR:', error);
        throw new Error(error.message);
    }

    let notificationsInserted = 0;
    if (scheduledIsDue && data.status === 'Published') {
        notificationsInserted = await createAnnouncementNotifications(data);
    }

    return {
        ...(await mapSingleAnnouncementRow(data)),
        notificationsInserted,
        publishedNow: scheduledIsDue && data.status === 'Published',
    };
};
