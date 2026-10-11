const pool = require('../config/db');

function addFilters(filters, where, params, { period = true, dateColumn, yearColumn = 'po.academic_year_id' }) {
    const equal = (column, value) => {
        if (value && value !== 'all') { params.push(value); where.push(`${column} = $${params.length}`); }
    };
    equal('sp.benefactor_id', filters.benefactorId);
    equal('sp.program_id', filters.programId);
    equal('st.course_id', filters.courseId);
    if (period) {
        equal(yearColumn, filters.academicYearId);
        equal('ap.term', filters.semester);
        equal('st.year_level::text', filters.yearLevel);
    }
    if (dateColumn && filters.dateFrom) { params.push(filters.dateFrom); where.push(`${dateColumn} >= $${params.length}::date`); }
    if (dateColumn && filters.dateTo) { params.push(filters.dateTo); where.push(`${dateColumn} < ($${params.length}::date + INTERVAL '1 day')`); }
}

async function getNewlyRecommendedRows(filters = {}) {
    const params = [];
    const where = [
        `COALESCE(a.is_archived, FALSE) = FALSE`,
        `COALESCE(a.is_disqualified, FALSE) = FALSE`,
        `LOWER(COALESCE(a.application_status, '')) <> 'rejected'`,
        `LOWER(COALESCE(a.selection_status, '')) IN ('reserved', 'selected', 'promoted')`,
        // A new recommendation must not be a returning beneficiary of this sponsor.
        `NOT EXISTS (
            SELECT 1 FROM applications prior
            JOIN scholarship_program prior_program ON prior_program.program_id = prior.program_id
            WHERE prior.student_id = a.student_id AND prior.application_id <> a.application_id
              AND prior_program.benefactor_id = sp.benefactor_id
              AND (LOWER(COALESCE(prior.activation_status, '')) = 'activated'
                   OR LOWER(COALESCE(prior.application_status, '')) = 'approved')
              AND COALESCE(prior.activated_at, prior.submission_date, prior.created_at)
                  < COALESCE(a.activated_at, a.selected_at, a.submission_date, a.created_at)
        )`,
    ];
    addFilters(filters, where, params, { dateColumn: 'COALESCE(a.selected_at, a.submission_date, a.created_at)' });
    const { rows } = await pool.query(`
        WITH recommendations AS (
            SELECT st.pdm_id, st.last_name, st.first_name AS given_name, st.middle_name,
                CONCAT(st.last_name, ', ', st.first_name) AS student_name,
                ac.course_code, st.year_level, st.gwa, sp.program_name, b.benefactor_name,
                ay.label AS academic_year, ap.term AS semester,
                a.selection_status AS recommendation_status,
                ROW_NUMBER() OVER (PARTITION BY st.student_id, sp.benefactor_id
                    ORDER BY COALESCE(a.selected_at, a.submission_date, a.created_at) DESC, a.application_id DESC) AS rank
            FROM applications a
            JOIN students st ON st.student_id = a.student_id
            JOIN scholarship_program sp ON sp.program_id = a.program_id
            LEFT JOIN benefactors b ON b.benefactor_id = sp.benefactor_id
            JOIN program_openings po ON po.opening_id = a.opening_id
            LEFT JOIN academic_years ay ON ay.academic_year_id = po.academic_year_id
            LEFT JOIN academic_period ap ON ap.period_id = po.period_id
            LEFT JOIN academic_course ac ON ac.course_id = st.course_id
            WHERE ${where.join(' AND ')}
        ) SELECT * FROM recommendations WHERE rank = 1
        ORDER BY benefactor_name, last_name, given_name;
    `, params);
    return rows;
}

async function getGraduateRows(filters = {}) {
    const params = [];
    const where = [`LOWER(TRIM(COALESCE(st.scholar_removal_reason, ''))) = 'graduated'`,
        `COALESCE(st.scholar_is_archived, FALSE) = TRUE`];
    addFilters(filters, where, params, { period: false, dateColumn: 'st.scholar_archived_at' });
    const { rows } = await pool.query(`
        WITH awards AS (
            SELECT a.student_id, a.program_id, po.academic_year_id, po.period_id
            FROM applications a JOIN program_openings po ON po.opening_id = a.opening_id
            WHERE LOWER(COALESCE(a.application_status, '')) = 'approved'
               OR LOWER(COALESCE(a.activation_status, '')) = 'activated'
            UNION
            SELECT r.student_id, r.program_id, COALESCE(r.academic_year_id, ap.academic_year_id), r.period_id
            FROM renewals r LEFT JOIN academic_period ap ON ap.period_id = r.period_id
            WHERE LOWER(COALESCE(r.status, '')) = 'approved'
        ), coverage AS (
            SELECT DISTINCT aw.student_id, sp.benefactor_id,
                st.pdm_id, st.last_name, st.first_name AS given_name,
                CASE WHEN NULLIF(TRIM(st.middle_name), '') IS NULL THEN '' ELSE CONCAT(LEFT(TRIM(st.middle_name), 1), '.') END AS middle_initial,
                CONCAT(st.last_name, ', ', st.first_name) AS student_name,
                ac.course_code, b.benefactor_name,
                ay.start_year, COALESCE(ap.term, '') AS semester,
                CONCAT_WS(' ', ap.term, CONCAT('A.Y. ', ay.label)) AS covered_period,
                CASE WHEN LOWER(ap.term) LIKE '%first%' THEN 1 WHEN LOWER(ap.term) LIKE '%second%' THEN 2 ELSE 3 END AS term_order
            FROM awards aw JOIN students st ON st.student_id = aw.student_id
            JOIN scholarship_program sp ON sp.program_id = aw.program_id
            LEFT JOIN benefactors b ON b.benefactor_id = sp.benefactor_id
            JOIN academic_years ay ON ay.academic_year_id = aw.academic_year_id
            LEFT JOIN academic_period ap ON ap.period_id = aw.period_id
            LEFT JOIN academic_course ac ON ac.course_id = st.course_id
            WHERE ${where.join(' AND ')}
        )
        SELECT pdm_id, last_name, given_name, middle_initial, student_name, course_code, benefactor_name,
            (ARRAY_AGG(covered_period ORDER BY start_year, term_order))[1] AS period_from,
            (ARRAY_AGG(covered_period ORDER BY start_year DESC, term_order DESC))[1] AS period_to
        FROM coverage GROUP BY student_id, benefactor_id, pdm_id, last_name, given_name,
            middle_initial, student_name, course_code, benefactor_name
        ORDER BY benefactor_name, last_name, given_name;
    `, params);
    return rows;
}

module.exports = { getNewlyRecommendedRows, getGraduateRows };
