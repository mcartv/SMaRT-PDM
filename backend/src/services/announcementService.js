const supabase = require('../config/supabase');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getUserRole(userId) {
  if (!userId) {
    throw createHttpError(401, 'Authentication required.');
  }

  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.role?.toString() || '';
}

function canViewAudience(role, audience) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedAudience = String(audience || 'all').trim().toLowerCase();

  if (!normalizedAudience || normalizedAudience === 'all') {
    return true;
  }

  if (normalizedAudience === 'applicants') {
    return normalizedRole === 'applicant';
  }

  if (
    normalizedAudience === 'scholars' ||
    normalizedAudience === 'tes' ||
    normalizedAudience === 'tdp'
  ) {
    return normalizedRole === 'student';
  }

  return true;
}

function mapAnnouncementRow(row = {}) {
  return {
    announcementId: row.announcement_id?.toString() || '',
    title: row.subject?.toString() || 'Announcement',
    content: row.content?.toString() || '',
    audienceKey: row.target_audience?.toString() || 'all',
    date:
      row.published_at?.toString() ||
      row.publish_date?.toString() ||
      row.created_at?.toString() ||
      new Date().toISOString(),
  };
}

async function listPublishedAnnouncements(userId) {
  const role = await getUserRole(userId);

  const { data, error } = await supabase
    .from('announcements')
    .select(`
      announcement_id,
      subject,
      content,
      target_audience,
      published_at,
      publish_date,
      created_at,
      status,
      is_archived
    `)
    .eq('is_archived', false)
    .eq('status', 'Published')
    .order('published_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || [])
    .filter((row) => canViewAudience(role, row.target_audience))
    .map(mapAnnouncementRow);
}

module.exports = {
  listPublishedAnnouncements,
};
