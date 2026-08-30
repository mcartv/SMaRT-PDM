const supabase = require('../config/supabase');

const DEFAULT_MAINTENANCE_MESSAGE =
    'SMaRT-PDM is temporarily unavailable while system maintenance is in progress. Please try again later.';

function safeText(value, maxLength = Number.MAX_SAFE_INTEGER) {
    const normalized = value === null || value === undefined ? '' : String(value).trim();
    return normalized.slice(0, maxLength);
}

function normalizeDate(value) {
    const normalized = safeText(value);
    if (!normalized) return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeDateTime(value) {
    const normalized = safeText(value);
    if (!normalized) return null;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizeMaintenanceMessage(value) {
    const message = safeText(value);
    return message ? message.slice(0, 500) : DEFAULT_MAINTENANCE_MESSAGE;
}

function sanitizeFaqs(value) {
    if (!Array.isArray(value)) return [];

    return value
        .slice(0, 20)
        .map((item, index) => ({
            faq_id: safeText(item?.faq_id || item?.id, 80) || `faq-${index + 1}`,
            question: safeText(item?.question, 180),
            answer: safeText(item?.answer, 700),
            is_archived: item?.is_archived === true,
        }))
        .filter((item) => item.question && item.answer);
}

function sanitizeFeaturedNotices(value) {
    const source = Array.isArray(value)
        ? value
        : value && typeof value === 'object'
            ? [value]
            : [];

    return source
        .slice(0, 20)
        .map((notice, index) => ({
            notice_id:
                safeText(notice?.notice_id, 80) || `notice-legacy-${index + 1}`,
            title: safeText(notice?.title, 140),
            message: safeText(notice?.message, 5000),
            link_label: safeText(notice?.link_label, 60),
            link_url: safeText(notice?.link_url, 500),
            is_visible: notice?.is_visible === true,
            is_archived: notice?.is_archived === true,
            start_date: normalizeDate(notice?.start_date),
            end_date: normalizeDate(notice?.end_date),
            created_at: normalizeDateTime(notice?.created_at),
        }))
        .filter((notice) => notice.title || notice.message);
}

function getManilaDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function isFeaturedNoticePublished(notice = {}) {
    if (!notice.is_visible || !notice.title || !notice.message) return false;
    const today = getManilaDateKey();
    if (notice.start_date && notice.start_date > today) return false;
    if (notice.end_date && notice.end_date < today) return false;
    return true;
}

function sortFeaturedNoticesNewestFirst(notices = []) {
    return notices
        .map((notice, index) => ({ notice, index }))
        .sort((left, right) => {
            const createdLeft = Date.parse(left.notice.created_at || '') || 0;
            const createdRight = Date.parse(right.notice.created_at || '') || 0;
            if (createdLeft !== createdRight) return createdRight - createdLeft;

            const startLeft = Date.parse(left.notice.start_date || '') || 0;
            const startRight = Date.parse(right.notice.start_date || '') || 0;
            if (startLeft !== startRight) return startRight - startLeft;

            return left.index - right.index;
        })
        .map(({ notice }) => notice);
}

function getFeaturedNoticeNextChangeAt(notice = {}) {
    if (!notice.is_visible || !notice.title || !notice.message) return null;
    const today = getManilaDateKey();

    if (notice.start_date && notice.start_date > today) {
        return new Date(`${notice.start_date}T00:00:00+08:00`).toISOString();
    }

    if (
        (!notice.start_date || notice.start_date <= today) &&
        notice.end_date &&
        notice.end_date >= today
    ) {
        const endBoundary =
            new Date(`${notice.end_date}T00:00:00+08:00`).getTime() + 86400000;
        return new Date(endBoundary).toISOString();
    }

    return null;
}

function getFeaturedNoticesNextChangeAt(notices = []) {
    const boundaries = notices
        .map((notice) => getFeaturedNoticeNextChangeAt(notice))
        .filter(Boolean)
        .map((value) => Date.parse(value))
        .filter(Number.isFinite);

    if (!boundaries.length) return null;
    return new Date(Math.min(...boundaries)).toISOString();
}

async function getPublicGeneralSettings() {
    const { data, error } = await supabase
        .from('general_settings')
        .select(`
            general_settings_id,
            institution_name,
            office_name,
            office_email,
            office_address,
            landline_number,
            office_hours,
            about_osfa,
            eligibility_summary,
            landing_content,
            policy_content,
            featured_notice,
            landing_faqs,
            global_deadline,
            applications_open,
            updated_at
        `)
        .eq('general_settings_id', 1)
        .maybeSingle();

    if (error) throw error;

    const settings = data || {};
    const featuredNotices = sanitizeFeaturedNotices(settings.featured_notice);
    const activeFeaturedNotices = sortFeaturedNoticesNewestFirst(
        featuredNotices.filter(
            (notice) => notice.is_archived !== true && isFeaturedNoticePublished(notice)
        )
    );

    return {
        ...settings,
        landing_faqs: sanitizeFaqs(settings.landing_faqs).filter(
            (item) => item.is_archived !== true
        ),
        featured_notices: activeFeaturedNotices,
        featured_notice: activeFeaturedNotices[0] || null,
        featured_notice_next_change_at: getFeaturedNoticesNextChangeAt(
            featuredNotices.filter((notice) => notice.is_archived !== true)
        ),
    };
}

async function getMaintenanceState() {
    const { data, error } = await supabase
        .from('general_settings')
        .select('maintenance_mode, maintenance_message, updated_at')
        .eq('general_settings_id', 1)
        .maybeSingle();

    if (error) throw error;

    return {
        maintenance_mode: data?.maintenance_mode === true,
        maintenance_message: normalizeMaintenanceMessage(data?.maintenance_message),
        updated_at: data?.updated_at || null,
    };
}

async function getPublishedScholarshipPrograms() {
    const { data, error } = await supabase
        .from('scholarship_program')
        .select(`
            program_id,
            benefactor_id,
            program_name,
            description,
            target_audience,
            gwa_threshold,
            renewal_cycle,
            visibility_status,
            is_archived,
            created_at,
            updated_at,
            benefactors:benefactor_id (
                benefactor_id,
                benefactor_name,
                benefactor_type,
                is_archived
            )
        `)
        .eq('is_archived', false)
        .eq('visibility_status', 'Published')
        .order('program_name', { ascending: true });

    if (error) throw error;

    return (data || [])
        .filter((row) => row.benefactors?.is_archived !== true)
        .map((row) => ({
            program_id: row.program_id,
            benefactor_id: row.benefactor_id,
            benefactor_name: row.benefactors?.benefactor_name || null,
            benefactor_type: row.benefactors?.benefactor_type || null,
            program_name: row.program_name || '',
            description: row.description || '',
            target_audience: row.target_audience || 'Applicants',
            gwa_threshold: row.gwa_threshold ?? null,
            renewal_cycle: row.renewal_cycle || 'None',
            visibility_status: row.visibility_status || 'Published',
            is_archived: false,
            created_at: row.created_at || null,
            updated_at: row.updated_at || null,
        }));
}

module.exports = {
    getPublicGeneralSettings,
    getMaintenanceState,
    getPublishedScholarshipPrograms,
};
