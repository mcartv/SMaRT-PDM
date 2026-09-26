'use strict';

const pool = require('../config/db');
const applicationService = require('./applicationService');

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function safePositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

function normalizeFilter(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizePdmSearch(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function mapRegistryRow(row) {
    const firstName = row.first_name || '';
    const lastName = row.last_name || '';
    const fullName =
        `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim() || 'Unnamed Applicant';

    return {
        application_id: row.application_id,
        student_id: row.student_id,
        program_id: row.program_id,
        opening_id: row.opening_id,
        evaluator_id: row.evaluator_id,

        first_name: firstName,
        last_name: lastName,
        student_name: fullName,
        applicant_name: fullName,
        pdm_id: row.pdm_id || 'N/A',
        gwa: row.gwa ?? null,
        sdo_status: row.sdo_status || 'Clear',

        program_name: row.program_name || 'No Program',

        opening_title: row.opening_title || 'Untitled Opening',
        semester: row.semester || null,
        academic_year: row.academic_year || null,
        allocated_slots: Number(row.allocated_slots || 0),
        filled_slots: Number(row.filled_slots || 0),
        financial_allocation: row.financial_allocation ?? null,
        per_scholar_amount: row.per_scholar_amount ?? null,
        posting_status: row.posting_status || 'Open',
        opening_status: row.posting_status || 'Open',
        opening_is_archived: !!row.opening_is_archived,

        application_status: row.application_status || 'Pending Review',
        status: row.application_status || 'Pending Review',
        document_status: row.document_status || 'Missing Docs',
        verification_status: row.verification_status || null,
        remarks: row.remarks || null,

        is_disqualified: !!row.is_disqualified,
        rejection_reason: row.rejection_reason || null,

        selection_status: row.selection_status || null,
        queue_position: row.queue_position == null ? null : Number(row.queue_position),
        waitlist_position: row.waitlist_position == null ? null : Number(row.waitlist_position),
        fcfs_completed_at: row.fcfs_completed_at || null,
        requirements_completed_at: row.requirements_completed_at || null,
        requirements_verified_at: row.requirements_verified_at || null,

        submission_date: row.submission_date || null,
        submitted_at: row.submission_date || null,
        is_archived: !!row.is_archived,
    };
}

function buildBaseCte({ lifecycleAware = true } = {}) {
    const lifecycleColumns = lifecycleAware
        ? `
        st.scholarship_status,
        st.current_application_id,`
        : '';

    const rankPriority = lifecycleAware
        ? `
                CASE
                    WHEN st.current_application_id IS NOT NULL
                     AND a.application_id = st.current_application_id
                        THEN 0
                    ELSE 1
                END ASC,`
        : '';

    const lifecycleFilter = lifecycleAware
        ? `
        AND NOT (
            COALESCE(st.scholarship_status, 'None') = 'Active'
            AND st.current_application_id IS NOT NULL
            AND st.current_application_id <> a.application_id
        )`
        : '';

    return `
WITH ranked_applications AS (
    SELECT
        a.application_id,
        a.student_id,
        a.program_id,
        a.opening_id,
        a.application_status,
        a.evaluator_id,
        a.submission_date,
        a.is_disqualified,
        a.rejection_reason,
        a.document_status,
        a.verification_status,
        a.remarks,
        a.is_archived,
        a.selection_status,
        a.queue_position,
        a.waitlist_position,
        a.fcfs_completed_at,
        a.requirements_completed_at,
        a.requirements_verified_at,

        st.first_name,
        st.last_name,
        st.pdm_id,
        st.gwa,
        st.sdo_status,${lifecycleColumns}

        po.opening_title,
        po.allocated_slots,
        po.filled_slots,
        po.financial_allocation,
        po.per_scholar_amount,
        po.posting_status,
        po.is_archived AS opening_is_archived,

        ay.label AS academic_year,
        ap.term AS semester,
        sp.program_name,

        es.slip_id AS endorsement_slip_id,
        es.overall_status AS endorsement_overall_status,
        es.current_stage AS endorsement_current_stage,

        ROW_NUMBER() OVER (
            PARTITION BY a.student_id, a.opening_id
            ORDER BY${rankPriority}
                a.submission_date DESC NULLS LAST,
                a.application_id DESC
        ) AS operational_rank
    FROM applications a
    INNER JOIN students st
        ON a.student_id = st.student_id
    INNER JOIN users u
        ON st.user_id = u.user_id
    LEFT JOIN program_openings po
        ON a.opening_id = po.opening_id
    LEFT JOIN academic_years ay
        ON po.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap
        ON po.period_id = ap.period_id
    LEFT JOIN scholarship_program sp
        ON a.program_id = sp.program_id
    LEFT JOIN endorsement_slips es
        ON es.application_id = a.application_id
    WHERE
        COALESCE(a.is_archived, FALSE) = FALSE
        AND COALESCE(st.is_archived, FALSE) = FALSE
        AND st.user_id IS NOT NULL
        AND COALESCE(u.is_otp_verified, FALSE) = TRUE
        AND LOWER(COALESCE(u.username, '')) NOT LIKE 'deleted-%'
        AND LOWER(COALESCE(u.email, '')) NOT LIKE 'deleted-%'
        AND COALESCE(po.is_archived, FALSE) = FALSE
        AND LOWER(COALESCE(po.posting_status, '')) <> 'closed'
        AND COALESCE(a.is_disqualified, FALSE) = FALSE
        AND LOWER(COALESCE(a.application_status, '')) NOT IN ('approved')${lifecycleFilter}
),
operational_applications AS (
    SELECT *
    FROM ranked_applications
    WHERE operational_rank = 1
)`;
}

const READINESS_PREDICATE = `
    LOWER(COALESCE(oa.verification_status, '')) = 'verified'
    AND LOWER(COALESCE(oa.endorsement_overall_status, '')) = 'completed'
    AND COALESCE(oa.queue_position, 0) > 0
    AND oa.fcfs_completed_at IS NOT NULL
    AND LOWER(COALESCE(oa.selection_status, '')) IN ('reserved', 'promoted', 'waitlisted')
    AND LOWER(COALESCE(oa.application_status, '')) <> 'approved'
`;

const SCHOLAR_READY_PREDICATE = `
    LOWER(COALESCE(oa.verification_status, '')) = 'verified'
    AND LOWER(COALESCE(oa.endorsement_overall_status, '')) = 'completed'
    AND COALESCE(oa.queue_position, 0) > 0
    AND oa.fcfs_completed_at IS NOT NULL
    AND LOWER(COALESCE(oa.selection_status, '')) IN ('reserved', 'promoted', 'selected')
    AND LOWER(COALESCE(oa.selection_status, '')) <> 'waitlisted'
`;

function selectRegistryColumns(alias = 'oa') {
    return `
    ${alias}.application_id,
    ${alias}.student_id,
    ${alias}.program_id,
    ${alias}.opening_id,
    ${alias}.application_status,
    ${alias}.evaluator_id,
    ${alias}.submission_date,
    ${alias}.is_disqualified,
    ${alias}.rejection_reason,
    ${alias}.document_status,
    ${alias}.verification_status,
    ${alias}.remarks,
    ${alias}.is_archived,
    ${alias}.selection_status,
    ${alias}.queue_position,
    ${alias}.waitlist_position,
    ${alias}.fcfs_completed_at,
    ${alias}.requirements_completed_at,
    ${alias}.requirements_verified_at,
    ${alias}.first_name,
    ${alias}.last_name,
    ${alias}.pdm_id,
    ${alias}.gwa,
    ${alias}.sdo_status,
    ${alias}.opening_title,
    ${alias}.allocated_slots,
    ${alias}.filled_slots,
    ${alias}.financial_allocation,
    ${alias}.per_scholar_amount,
    ${alias}.posting_status,
    ${alias}.opening_is_archived,
    ${alias}.academic_year,
    ${alias}.semester,
    ${alias}.program_name
`;
}

function buildFilterSql(options = {}, values = []) {
    const clauses = [];
    const search = String(options.search || '').trim();
    const academicYear = String(options.academicYear || '').trim();
    const applicationStatus = normalizeFilter(options.applicationStatus);
    const documentStatus = normalizeFilter(options.documentStatus);

    if (search) {
        const likeParam = `%${search.toLowerCase()}%`;
        values.push(likeParam);
        const searchIndex = values.length;

        const normalizedPdm = normalizePdmSearch(search);
        if (normalizedPdm) {
            values.push(`%${normalizedPdm}%`);
        } else {
            values.push('%__no_pdm_match__%');
        }
        const pdmIndex = values.length;

        clauses.push(`(
            LOWER(CONCAT_WS(' ', oa.first_name, oa.last_name)) LIKE $${searchIndex}
            OR LOWER(COALESCE(oa.pdm_id, '')) LIKE $${searchIndex}
            OR REGEXP_REPLACE(LOWER(COALESCE(oa.pdm_id, '')), '[^a-z0-9]', '', 'g') LIKE $${pdmIndex}
            OR LOWER(COALESCE(oa.program_name, '')) LIKE $${searchIndex}
            OR LOWER(COALESCE(oa.application_status, '')) LIKE $${searchIndex}
            OR LOWER(COALESCE(oa.document_status, '')) LIKE $${searchIndex}
            OR LOWER(COALESCE(oa.opening_title, '')) LIKE $${searchIndex}
            OR LOWER(COALESCE(oa.academic_year, '')) LIKE $${searchIndex}
        )`);
    }

    if (academicYear && normalizeFilter(academicYear) !== 'all') {
        values.push(academicYear);
        clauses.push(`COALESCE(oa.academic_year, '') = $${values.length}`);
    }

    if (applicationStatus && applicationStatus !== 'all') {
        if (applicationStatus === 'qualified') {
            clauses.push(`LOWER(COALESCE(oa.application_status, '')) IN ('approved', 'qualified', 'accepted')`);
        } else if (applicationStatus === 'disqualified') {
            clauses.push(`LOWER(COALESCE(oa.application_status, '')) IN ('rejected', 'disqualified', 'declined')`);
        } else if (applicationStatus === 'review') {
            clauses.push(`LOWER(COALESCE(oa.application_status, '')) IN ('review', 'under review', 'for review', 'interview')`);
        } else if (applicationStatus === 'pending') {
            clauses.push(`LOWER(COALESCE(oa.application_status, '')) NOT IN (
                'approved', 'qualified', 'accepted',
                'rejected', 'disqualified', 'declined',
                'review', 'under review', 'for review', 'interview'
            )`);
        }
    }

    if (documentStatus && documentStatus !== 'all') {
        if (documentStatus === 'ready') {
            clauses.push(`LOWER(COALESCE(oa.document_status, '')) IN ('documents ready', 'verified', 'complete')`);
        } else if (documentStatus === 'missing') {
            clauses.push(`LOWER(COALESCE(oa.document_status, '')) IN ('missing docs', 'missing', 'incomplete')`);
        } else if (documentStatus === 'review') {
            clauses.push(`LOWER(COALESCE(oa.document_status, '')) IN ('under review', 'review')`);
        }
    }

    return clauses.length ? `AND ${clauses.join('\n        AND ')}` : '';
}

function isMissingLifecycleColumn(error) {
    const message = String(error?.message || '').toLowerCase();
    return (
        message.includes('scholarship_status') ||
        message.includes('current_application_id')
    );
}

async function queryWithLifecycleFallback(buildQuery) {
    try {
        return await buildQuery(true);
    } catch (error) {
        if (!isMissingLifecycleColumn(error)) throw error;

        console.warn('APPLICATION REGISTRY READ FALLBACK MODE:', error.message);
        return buildQuery(false);
    }
}

async function decorateRows(rows = []) {
    const mappedRows = (rows || []).map(mapRegistryRow);
    return applicationService.decorateApplicationRecordsWithReadiness(mappedRows);
}

async function fetchRegistryApplications() {
    // This Applications registry service is intentionally read-only. FCFS queue
    // synchronization remains at the mutation points that actually change readiness.
    // Backwards-compatible full-array mode for callers that do not opt in to
    // the paginated registry contract. This path is still read-only.
    const result = await queryWithLifecycleFallback(async (lifecycleAware) => {
        const query = `
${buildBaseCte({ lifecycleAware })}
SELECT
${selectRegistryColumns('oa')}
FROM operational_applications oa
ORDER BY oa.submission_date DESC NULLS LAST, oa.application_id DESC;`;
        return pool.query(query);
    });

    return decorateRows(result.rows || []);
}

async function fetchRegistryPage(options = {}) {
    const page = safePositiveInteger(options.page, 1);
    const limit = safePositiveInteger(options.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (page - 1) * limit;

    const result = await queryWithLifecycleFallback(async (lifecycleAware) => {
        const values = [];
        const filterSql = buildFilterSql(options, values);
        values.push(limit);
        const limitIndex = values.length;
        values.push(offset);
        const offsetIndex = values.length;

        const query = `
${buildBaseCte({ lifecycleAware })},
filtered_registry AS (
    SELECT oa.*
    FROM operational_applications oa
    WHERE NOT (${READINESS_PREDICATE})
        ${filterSql}
),
registry_total AS (
    SELECT COUNT(*)::int AS filtered_total
    FROM filtered_registry
),
paged_registry AS (
    SELECT *
    FROM filtered_registry
    ORDER BY submission_date DESC NULLS LAST, application_id DESC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
)
SELECT
${selectRegistryColumns('pr')},
    rt.filtered_total
FROM registry_total rt
LEFT JOIN paged_registry pr ON TRUE
ORDER BY pr.submission_date DESC NULLS LAST, pr.application_id DESC;`;

        return pool.query(query, values);
    });

    const rows = result.rows || [];
    const total = Number(rows[0]?.filtered_total || 0);
    const pageRows = rows.filter((row) => row.application_id);
    const items = await decorateRows(pageRows);

    return {
        items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        },
    };
}

async function fetchReadinessApplications(options = {}) {
    const result = await queryWithLifecycleFallback(async (lifecycleAware) => {
        const values = [];
        const filterSql = buildFilterSql(options, values);

        const query = `
${buildBaseCte({ lifecycleAware })}
SELECT
${selectRegistryColumns('oa')}
FROM operational_applications oa
WHERE (${READINESS_PREDICATE})
    ${filterSql}
ORDER BY
    oa.queue_position ASC NULLS LAST,
    oa.fcfs_completed_at ASC NULLS LAST,
    oa.submission_date ASC NULLS LAST,
    oa.application_id ASC;`;

        return pool.query(query, values);
    });

    const items = await decorateRows(result.rows || []);

    return {
        items,
        pagination: {
            page: 1,
            limit: items.length,
            total: items.length,
            totalPages: 1,
        },
    };
}

async function fetchOpeningSummaries() {
    const result = await queryWithLifecycleFallback(async (lifecycleAware) => {
        const query = `
${buildBaseCte({ lifecycleAware })},
summary AS (
    SELECT
        oa.opening_id,
        COUNT(*)::int AS applicants,
        COUNT(*) FILTER (
            WHERE LOWER(COALESCE(oa.verification_status, '')) = 'verified'
        )::int AS requirements_complete,
        COUNT(*) FILTER (
            WHERE LOWER(COALESCE(oa.endorsement_overall_status, '')) = 'completed'
        )::int AS endorsement_complete,
        COUNT(*) FILTER (
            WHERE ${SCHOLAR_READY_PREDICATE}
        )::int AS scholar_ready,
        COUNT(*) FILTER (
            WHERE ${SCHOLAR_READY_PREDICATE}
        )::int AS fcfs_queued,
        STRING_AGG(
            CONCAT_WS(
                ':',
                oa.application_id::text,
                LOWER(COALESCE(oa.selection_status, '')),
                COALESCE(oa.queue_position, 0)::text,
                COALESCE(oa.waitlist_position, 0)::text,
                COALESCE(oa.fcfs_completed_at::text, '')
            ),
            '|' ORDER BY oa.queue_position ASC NULLS LAST, oa.application_id ASC
        ) FILTER (
            WHERE ${READINESS_PREDICATE}
        ) AS readiness_signature
    FROM operational_applications oa
    WHERE oa.opening_id IS NOT NULL
    GROUP BY oa.opening_id
),
next_fcfs AS (
    SELECT DISTINCT ON (oa.opening_id)
        oa.opening_id,
        oa.application_id,
        oa.first_name,
        oa.last_name,
        oa.pdm_id,
        oa.queue_position,
        oa.fcfs_completed_at,
        oa.selection_status
    FROM operational_applications oa
    WHERE oa.opening_id IS NOT NULL
      AND (${SCHOLAR_READY_PREDICATE})
    ORDER BY
        oa.opening_id,
        oa.queue_position ASC NULLS LAST,
        oa.fcfs_completed_at ASC NULLS LAST,
        oa.application_id ASC
)
SELECT
    s.opening_id,
    s.applicants,
    s.requirements_complete,
    s.endorsement_complete,
    s.scholar_ready,
    s.fcfs_queued,
    s.readiness_signature,
    nf.application_id AS next_application_id,
    nf.first_name AS next_first_name,
    nf.last_name AS next_last_name,
    nf.pdm_id AS next_pdm_id,
    nf.queue_position AS next_queue_position,
    nf.fcfs_completed_at AS next_fcfs_completed_at,
    nf.selection_status AS next_selection_status
FROM summary s
LEFT JOIN next_fcfs nf
    ON nf.opening_id = s.opening_id
ORDER BY s.opening_id;`;

        return pool.query(query);
    });

    return (result.rows || []).map((row) => {
        const nextName = `${row.next_first_name || ''} ${row.next_last_name || ''}`
            .replace(/\s+/g, ' ')
            .trim();

        return {
            opening_id: row.opening_id,
            applicants: Number(row.applicants || 0),
            requirements_complete: Number(row.requirements_complete || 0),
            endorsement_complete: Number(row.endorsement_complete || 0),
            scholar_ready: Number(row.scholar_ready || 0),
            fcfs_queued: Number(row.fcfs_queued || 0),
            readiness_signature: row.readiness_signature || '',
            next_fcfs_applicant: row.next_application_id
                ? {
                    application_id: row.next_application_id,
                    applicant_name: nextName || 'Unnamed Applicant',
                    pdm_id: row.next_pdm_id || 'N/A',
                    queue_position:
                        row.next_queue_position == null
                            ? null
                            : Number(row.next_queue_position),
                    fcfs_completed_at: row.next_fcfs_completed_at || null,
                    selection_status: row.next_selection_status || null,
                }
                : null,
        };
    });
}

module.exports = {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    fetchRegistryApplications,
    fetchRegistryPage,
    fetchReadinessApplications,
    fetchOpeningSummaries,
};
