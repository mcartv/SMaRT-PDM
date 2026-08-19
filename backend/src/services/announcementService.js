const supabase = require('../config/supabase');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function parseDate(value) {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function publicationDate(row = {}) {
  return (
    parseDate(row.published_at) ||
    parseDate(row.publish_date) ||
    parseDate(row.scheduled_at) ||
    parseDate(row.created_at)
  );
}

function isPublishedNow(row = {}, now = new Date()) {
  if (row.is_archived === true) return false;
  if (normalizeText(row.status) !== 'published') return false;

  const published = publicationDate(row);
  return published === null || published.getTime() <= now.getTime();
}

async function getAudienceContext(userId) {
  if (!userId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (userError) {
    throw userError;
  }

  const role = normalizeText(user?.role);
  const context = {
    role,
    isApplicant: role === 'applicant',
    isActiveScholar: false,
    currentProgramId: null,
    currentProgramName: '',
  };

  if (role !== 'student') {
    return context;
  }

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(`
      current_program_id,
      is_active_scholar,
      scholarship_status,
      scholar_is_archived,
      is_archived,
      account_status
    `)
    .eq('user_id', userId)
    .maybeSingle();

  if (studentError) {
    throw studentError;
  }

  context.currentProgramId = student?.current_program_id || null;
  context.isActiveScholar =
    student?.is_active_scholar === true &&
    normalizeText(student?.scholarship_status) === 'active' &&
    student?.scholar_is_archived !== true &&
    student?.is_archived !== true &&
    normalizeText(student?.account_status) !== 'disabled';

  if (context.currentProgramId) {
    const { data: program, error: programError } = await supabase
      .from('scholarship_program')
      .select('program_name')
      .eq('program_id', context.currentProgramId)
      .maybeSingle();

    if (programError) {
      throw programError;
    }

    context.currentProgramName = normalizeText(program?.program_name);
  }

  return context;
}

function matchesLegacyProgramAudience(context, audience) {
  if (!context.isActiveScholar) return false;

  const programName = context.currentProgramName;
  if (!programName) return false;

  if (audience === 'tes') {
    return (
      programName.includes('tertiary education subsidy') ||
      /^tes(?:\b|\s|-)/.test(programName) ||
      /\btes\b/.test(programName)
    );
  }

  if (audience === 'tdp') {
    return (
      programName.includes('tulong dunong') ||
      /^tdp(?:\b|\s|-)/.test(programName) ||
      /\btdp\b/.test(programName)
    );
  }

  return false;
}

function canViewAudience(context, row = {}) {
  const audience = normalizeText(row.target_audience || 'all');

  if (audience === 'all') {
    return context.isApplicant || context.isActiveScholar;
  }

  if (audience === 'applicants') {
    return context.isApplicant;
  }

  if (audience === 'scholars') {
    return context.isActiveScholar;
  }

  if (audience === 'program') {
    return (
      context.isActiveScholar &&
      Boolean(context.currentProgramId) &&
      String(context.currentProgramId) === String(row.target_program_id || '')
    );
  }

  if (audience === 'tes' || audience === 'tdp') {
    return matchesLegacyProgramAudience(context, audience);
  }

  return false;
}

function mapAnnouncementRow(row = {}) {
  const date = publicationDate(row);

  return {
    announcementId: row.announcement_id?.toString() || '',
    title: row.subject?.toString() || 'Announcement',
    content: row.content?.toString() || '',
    audienceKey: row.target_audience?.toString() || 'all',
    targetProgramId: row.target_program_id?.toString() || null,
    date: date ? date.toISOString() : new Date().toISOString(),
  };
}

async function getVisibleAnnouncementForUser(userId, announcementId) {
  const normalizedId = String(announcementId || '').trim();
  if (!normalizedId) {
    throw createHttpError(400, 'Announcement ID is required.');
  }

  const context = await getAudienceContext(userId);
  const { data: row, error } = await supabase
    .from('announcements')
    .select(`
      announcement_id,
      subject,
      content,
      target_audience,
      target_program_id,
      published_at,
      publish_date,
      scheduled_at,
      created_at,
      status,
      is_archived
    `)
    .eq('announcement_id', normalizedId)
    .maybeSingle();

  if (error) throw error;
  if (!row || !isPublishedNow(row) || !canViewAudience(context, row)) {
    throw createHttpError(404, 'Announcement not found.');
  }

  return row;
}

async function markAnnouncementViewed(userId, announcementId) {
  if (!userId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const row = await getVisibleAnnouncementForUser(userId, announcementId);
  const now = new Date().toISOString();

  // The compound primary key keeps the view count unique per user and
  // announcement. ignoreDuplicates prevents repeat opens from creating rows.
  const { error: upsertError } = await supabase
    .from('announcement_views')
    .upsert(
      {
        announcement_id: row.announcement_id,
        user_id: userId,
        first_viewed_at: now,
        last_viewed_at: now,
      },
      {
        onConflict: 'announcement_id,user_id',
        ignoreDuplicates: true,
      }
    );

  if (upsertError) throw upsertError;

  // Repeat opens should not increase the unique count, but keeping this fresh
  // makes the record useful for later engagement/audit reporting.
  const { error: updateError } = await supabase
    .from('announcement_views')
    .update({ last_viewed_at: now })
    .eq('announcement_id', row.announcement_id)
    .eq('user_id', userId);

  if (updateError) throw updateError;

  return {
    announcementId: String(row.announcement_id),
    viewed: true,
  };
}

async function listPublishedAnnouncements(userId) {
  const context = await getAudienceContext(userId);
  const now = new Date();

  const { data, error } = await supabase
    .from('announcements')
    .select(`
      announcement_id,
      subject,
      content,
      target_audience,
      target_program_id,
      published_at,
      publish_date,
      scheduled_at,
      created_at,
      status,
      is_archived
    `)
    .eq('is_archived', false)
    .eq('status', 'Published');

  if (error) {
    throw error;
  }

  return (data || [])
    .filter((row) => isPublishedNow(row, now))
    .filter((row) => canViewAudience(context, row))
    .sort((a, b) => {
      const aDate = publicationDate(a)?.getTime() || 0;
      const bDate = publicationDate(b)?.getTime() || 0;
      return bDate - aDate;
    })
    .map(mapAnnouncementRow);
}

module.exports = {
  listPublishedAnnouncements,
  markAnnouncementViewed,
  canViewAudience,
  isPublishedNow,
};
