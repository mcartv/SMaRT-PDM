const ExcelJS = require('exceljs');
const pool = require('../config/db');

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function appendDateRange(where, params, fieldExpression, dateFrom, dateTo) {
    if (dateFrom) {
        params.push(dateFrom);
        where.push(`DATE(${fieldExpression}) >= $${params.length}`);
    }

    if (dateTo) {
        params.push(dateTo);
        where.push(`DATE(${fieldExpression}) <= $${params.length}`);
    }
}

function normalizeReportType(value) {
    const type = safeText(value).toLowerCase();
    const allowed = [
        'applications',
        'scholars',
        'payouts',
        'support',
        'sdo',
        'guidance',
        'pd',
    ];

    return allowed.includes(type) ? type : 'applications';
}

async function getReportMetadata() {
    const [programsResult, yearsResult, benefactorsResult] = await Promise.all([
        pool.query(`
      SELECT program_id, program_name
      FROM scholarship_program
      WHERE COALESCE(is_archived, FALSE) = FALSE
      ORDER BY program_name ASC;
    `),
        pool.query(`
      SELECT academic_year_id, label, start_year, end_year, is_active
      FROM academic_years
      ORDER BY start_year DESC;
    `),
        pool.query(`
      SELECT benefactor_id, benefactor_name
      FROM benefactors
      WHERE COALESCE(is_archived, FALSE) = FALSE
      ORDER BY benefactor_name ASC;
    `),
    ]);

    return {
        reportTypes: [
            {
                id: 'applications',
                name: 'Application Registry Report',
                sub: 'Submitted, approved, rejected, and document status summary',
            },
            {
                id: 'scholars',
                name: 'Active Scholars Master List',
                sub: 'Approved scholars with program, course, year level, and RO status',
            },
            {
                id: 'payouts',
                name: 'Payout Batch Report',
                sub: 'Payout batches, release status, amount, and recipients',
            },
            {
                id: 'support',
                name: 'Support Ticket Report',
                sub: 'Student concerns, ticket status, and handler records',
            },
            {
                id: 'sdo',
                name: 'SDO Endorsement Report',
                sub: 'SDO findings, offense details, remarks, and endorsement stage status',
            },
            {
                id: 'guidance',
                name: 'Guidance Endorsement Report',
                sub: 'Guidance decisions, prior SDO context, and review status summary',
            },
            {
                id: 'pd',
                name: 'PD Endorsement Report',
                sub: 'Program Director decisions with full endorsement progression summary',
            },
        ],
        programs: [
            { program_id: 'all', program_name: 'All Programs' },
            ...(programsResult.rows || []),
        ],
        academicYears: [
            { academic_year_id: 'all', label: 'All Academic Years' },
            ...(yearsResult.rows || []),
        ],
        semesters: [
            { value: 'all', label: 'All Semesters' },
            { value: 'First Semester', label: 'First Semester' },
            { value: 'Second Semester', label: 'Second Semester' },
            { value: 'Summer', label: 'Summer' },
        ],
        benefactors: [
            { benefactor_id: 'all', benefactor_name: 'All Benefactors' },
            ...(benefactorsResult.rows || []),
        ],
    };
}

function styleSheet(sheet) {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7C4A2E' },
    };

    sheet.columns.forEach((column) => {
        column.width = Math.max(column.header?.length || 12, 18);
    });
}

async function getApplicationsRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
}) {
    const params = [];
    const where = [`COALESCE(a.is_archived, FALSE) = FALSE`];

    if (academicYearId && academicYearId !== 'all') {
        params.push(academicYearId);
        where.push(`po.academic_year_id = $${params.length}`);
    }

    if (semester && semester !== 'all') {
        params.push(semester);
        where.push(`ap.term = $${params.length}`);
    }

    if (programId && programId !== 'all') {
        params.push(programId);
        where.push(`a.program_id = $${params.length}`);
    }

    if (benefactorId && benefactorId !== 'all') {
        params.push(benefactorId);
        where.push(`b.benefactor_id = $${params.length}`);
    }

    const query = `
    SELECT
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name,
      ac.course_code,
      st.year_level,
      sp.program_name,
      b.benefactor_name,
      po.opening_title,
      ay.label AS academic_year,
      ap.term AS semester,
      a.application_status,
      a.document_status,
      a.verification_status,
      a.submission_date,
      a.remarks
    FROM applications a
    LEFT JOIN students st ON a.student_id = st.student_id
    LEFT JOIN academic_course ac ON st.course_id = ac.course_id
    LEFT JOIN scholarship_program sp ON a.program_id = sp.program_id
    LEFT JOIN benefactors b ON sp.benefactor_id = b.benefactor_id
    LEFT JOIN program_openings po ON a.opening_id = po.opening_id
    LEFT JOIN academic_years ay ON po.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap ON po.period_id = ap.period_id
    WHERE ${where.join(' AND ')}
    ORDER BY a.submission_date DESC;
  `;

    const { rows } = await pool.query(query, params);
    return rows;
}

async function getScholarsRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
}) {
    const params = [];
    const where = [
        `st.is_active_scholar = TRUE`,
        `st.scholarship_status = 'Active'`,
    ];

    if (academicYearId && academicYearId !== 'all') {
        params.push(academicYearId);
        where.push(`st.active_academic_year_id = $${params.length}`);
    }

    if (semester && semester !== 'all') {
        params.push(semester);
        where.push(`ap.term = $${params.length}`);
    }

    if (programId && programId !== 'all') {
        params.push(programId);
        where.push(`st.current_program_id = $${params.length}`);
    }

    if (benefactorId && benefactorId !== 'all') {
        params.push(benefactorId);
        where.push(`b.benefactor_id = $${params.length}`);
    }

    const query = `
    SELECT
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name,
      ac.course_code,
      st.year_level,
      sp.program_name,
      ay.label AS academic_year,
      ap.term AS semester,
      st.scholarship_status,
      st.date_awarded,
      COALESCE(st.ro_status, 'Pending') AS ro_status,
      b.benefactor_name
    FROM students st
    LEFT JOIN academic_course ac ON st.course_id = ac.course_id
    LEFT JOIN scholarship_program sp ON st.current_program_id = sp.program_id
    LEFT JOIN academic_years ay ON st.active_academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap ON st.active_period_id = ap.period_id
    LEFT JOIN benefactors b ON sp.benefactor_id = b.benefactor_id
    WHERE ${where.join(' AND ')}
    ORDER BY st.last_name ASC, st.first_name ASC;
  `;

    const { rows } = await pool.query(query, params);
    return rows;
}

async function getPayoutRows({ academicYearId, semester, programId }) {
    const params = [];
    const where = [`COALESCE(pb.is_archived, FALSE) = FALSE`];

    if (academicYearId && academicYearId !== 'all') {
        params.push(academicYearId);
        where.push(`pb.academic_year_id = $${params.length}`);
    }

    if (semester && semester !== 'all') {
        params.push(semester);
        where.push(`ap.term = $${params.length}`);
    }

    if (programId && programId !== 'all') {
        params.push(programId);
        where.push(`pb.program_id = $${params.length}`);
    }

    const query = `
    SELECT
      pb.payout_title,
      sp.program_name,
      ay.label AS academic_year,
      ap.term AS semester,
      pb.payout_date,
      pb.payment_mode,
      pb.amount_per_scholar,
      pb.total_amount,
      pb.batch_status,
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name,
      pbs.amount_received,
      pbs.release_status,
      pbs.released_at,
      pbs.remarks
    FROM payout_batches pb
    LEFT JOIN scholarship_program sp ON pb.program_id = sp.program_id
    LEFT JOIN academic_years ay ON pb.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap ON pb.period_id = ap.period_id
    LEFT JOIN payout_batch_students pbs ON pb.payout_batch_id = pbs.payout_batch_id
    LEFT JOIN students st ON pbs.student_id = st.student_id
    WHERE ${where.join(' AND ')}
    ORDER BY pb.created_at DESC, st.last_name ASC;
  `;

    const { rows } = await pool.query(query, params);
    return rows;
}

async function getSupportRows() {
    const query = `
    SELECT
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name,
      t.issue_category,
      t.description,
      t.status,
      CONCAT(ap.last_name, ', ', ap.first_name) AS handled_by,
      t.created_at,
      t.resolved_at
    FROM support_tickets t
    LEFT JOIN students st ON t.student_id = st.student_id
    LEFT JOIN admin_profiles ap ON t.handled_by = ap.admin_id
    ORDER BY t.created_at DESC;
  `;

    const { rows } = await pool.query(query);
    return rows;
}

async function getSdoRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
    reviewResult,
    dateFrom,
    dateTo,
}) {
    const params = [];
    const where = [`COALESCE(a.is_archived, FALSE) = FALSE`];

    const normalizedReviewResult = safeText(reviewResult || 'all').toLowerCase();
    const normalizedDateFrom = safeText(dateFrom || '');
    const normalizedDateTo = safeText(dateTo || '');

    if (academicYearId && academicYearId !== 'all') {
        params.push(academicYearId);
        where.push(`po.academic_year_id = $${params.length}`);
    }

    if (semester && semester !== 'all') {
        params.push(semester);
        where.push(`ap.term = $${params.length}`);
    }

    if (programId && programId !== 'all') {
        params.push(programId);
        where.push(`a.program_id = $${params.length}`);
    }

    if (benefactorId && benefactorId !== 'all') {
        params.push(benefactorId);
        where.push(`b.benefactor_id = $${params.length}`);
    }

    if (normalizedReviewResult && normalizedReviewResult !== 'all') {
        if (normalizedReviewResult === 'pending') {
            where.push(`es.sdo_status IS NULL`);
        } else {
            params.push(normalizedReviewResult);
            where.push(`es.sdo_status = $${params.length}`);
        }
    }

    appendDateRange(
        where,
        params,
        `COALESCE(es.sdo_acted_at, a.submission_date)`,
        normalizedDateFrom,
        normalizedDateTo
    );

    const query = `
    SELECT
      es.slip_id,
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name,
      ac.course_code,
      st.year_level,
      sp.program_name,
      b.benefactor_name,
      po.opening_title,
      ay.label AS academic_year,
      ap.term AS semester,
      es.current_stage,
      es.overall_status,
      es.sdo_status,
      es.sdo_offense_type,
      es.sdo_incident_date,
      es.sdo_case_reference_number,
      es.sdo_remarks,
      CONCAT(COALESCE(sdo_profile.last_name, ''), CASE WHEN sdo_profile.last_name IS NOT NULL AND sdo_profile.first_name IS NOT NULL THEN ', ' ELSE '' END, COALESCE(sdo_profile.first_name, '')) AS reviewed_by,
      es.sdo_acted_at,
      a.submission_date
    FROM endorsement_slips es
    JOIN applications a ON es.application_id = a.application_id
    LEFT JOIN students st ON a.student_id = st.student_id
    LEFT JOIN academic_course ac ON st.course_id = ac.course_id
    LEFT JOIN scholarship_program sp ON a.program_id = sp.program_id
    LEFT JOIN benefactors b ON sp.benefactor_id = b.benefactor_id
    LEFT JOIN program_openings po ON a.opening_id = po.opening_id
    LEFT JOIN academic_years ay ON po.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap ON po.period_id = ap.period_id
    LEFT JOIN admin_profiles sdo_profile ON es.sdo_acted_by_user_id = sdo_profile.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY es.sdo_acted_at DESC NULLS LAST, a.submission_date DESC;
  `;

    const { rows } = await pool.query(query, params);
    return rows;
}

async function getGuidanceRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
    reviewResult,
    dateFrom,
    dateTo,
}) {
    const params = [];
    const where = [`COALESCE(a.is_archived, FALSE) = FALSE`];

    const normalizedReviewResult = safeText(reviewResult || 'all').toLowerCase();
    const normalizedDateFrom = safeText(dateFrom || '');
    const normalizedDateTo = safeText(dateTo || '');

    if (academicYearId && academicYearId !== 'all') {
        params.push(academicYearId);
        where.push(`po.academic_year_id = $${params.length}`);
    }

    if (semester && semester !== 'all') {
        params.push(semester);
        where.push(`ap.term = $${params.length}`);
    }

    if (programId && programId !== 'all') {
        params.push(programId);
        where.push(`a.program_id = $${params.length}`);
    }

    if (benefactorId && benefactorId !== 'all') {
        params.push(benefactorId);
        where.push(`b.benefactor_id = $${params.length}`);
    }

    if (normalizedReviewResult && normalizedReviewResult !== 'all') {
        if (normalizedReviewResult === 'pending') {
            where.push(`es.guidance_status IS NULL`);
        } else {
            params.push(normalizedReviewResult);
            where.push(`es.guidance_status = $${params.length}`);
        }
    }

    appendDateRange(
        where,
        params,
        `COALESCE(es.guidance_acted_at, a.submission_date)`,
        normalizedDateFrom,
        normalizedDateTo
    );

    const query = `
    SELECT
      es.slip_id,
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name,
      ac.course_code,
      st.year_level,
      sp.program_name,
      b.benefactor_name,
      po.opening_title,
      ay.label AS academic_year,
      ap.term AS semester,
      es.current_stage,
      es.overall_status,
      es.sdo_status,
      es.sdo_offense_type,
      es.sdo_incident_date,
      es.sdo_case_reference_number,
      es.guidance_status,
      es.guidance_remarks,
      CONCAT(COALESCE(guidance_profile.last_name, ''), CASE WHEN guidance_profile.last_name IS NOT NULL AND guidance_profile.first_name IS NOT NULL THEN ', ' ELSE '' END, COALESCE(guidance_profile.first_name, '')) AS reviewed_by,
      es.guidance_acted_at,
      a.submission_date
    FROM endorsement_slips es
    JOIN applications a ON es.application_id = a.application_id
    LEFT JOIN students st ON a.student_id = st.student_id
    LEFT JOIN academic_course ac ON st.course_id = ac.course_id
    LEFT JOIN scholarship_program sp ON a.program_id = sp.program_id
    LEFT JOIN benefactors b ON sp.benefactor_id = b.benefactor_id
    LEFT JOIN program_openings po ON a.opening_id = po.opening_id
    LEFT JOIN academic_years ay ON po.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap ON po.period_id = ap.period_id
    LEFT JOIN admin_profiles guidance_profile ON es.guidance_acted_by_user_id = guidance_profile.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY es.guidance_acted_at DESC NULLS LAST, a.submission_date DESC;
  `;

    const { rows } = await pool.query(query, params);
    return rows;
}

async function getPdRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
    reviewResult,
    dateFrom,
    dateTo,
}) {
    const params = [];
    const where = [`COALESCE(a.is_archived, FALSE) = FALSE`];

    const normalizedReviewResult = safeText(reviewResult || 'all').toLowerCase();
    const normalizedDateFrom = safeText(dateFrom || '');
    const normalizedDateTo = safeText(dateTo || '');

    if (academicYearId && academicYearId !== 'all') {
        params.push(academicYearId);
        where.push(`po.academic_year_id = $${params.length}`);
    }

    if (semester && semester !== 'all') {
        params.push(semester);
        where.push(`ap.term = $${params.length}`);
    }

    if (programId && programId !== 'all') {
        params.push(programId);
        where.push(`a.program_id = $${params.length}`);
    }

    if (benefactorId && benefactorId !== 'all') {
        params.push(benefactorId);
        where.push(`b.benefactor_id = $${params.length}`);
    }

    if (normalizedReviewResult && normalizedReviewResult !== 'all') {
        if (normalizedReviewResult === 'pending') {
            where.push(`es.pd_status IS NULL`);
        } else if (normalizedReviewResult === 'completed') {
            where.push(`es.overall_status = 'completed'`);
        } else {
            params.push(normalizedReviewResult);
            where.push(`es.pd_status = $${params.length}`);
        }
    }

    appendDateRange(
        where,
        params,
        `COALESCE(es.pd_acted_at, a.submission_date)`,
        normalizedDateFrom,
        normalizedDateTo
    );

    const query = `
    SELECT
      es.slip_id,
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name,
      ac.course_code,
      st.year_level,
      sp.program_name,
      b.benefactor_name,
      po.opening_title,
      ay.label AS academic_year,
      ap.term AS semester,
      es.current_stage,
      es.overall_status,
      es.sdo_status,
      es.guidance_status,
      es.pd_status,
      es.pd_remarks,
      CONCAT(COALESCE(pd_profile.last_name, ''), CASE WHEN pd_profile.last_name IS NOT NULL AND pd_profile.first_name IS NOT NULL THEN ', ' ELSE '' END, COALESCE(pd_profile.first_name, '')) AS reviewed_by,
      es.pd_acted_at,
      es.completed_at,
      es.final_pdf_url,
      a.submission_date
    FROM endorsement_slips es
    JOIN applications a ON es.application_id = a.application_id
    LEFT JOIN students st ON a.student_id = st.student_id
    LEFT JOIN academic_course ac ON st.course_id = ac.course_id
    LEFT JOIN scholarship_program sp ON a.program_id = sp.program_id
    LEFT JOIN benefactors b ON sp.benefactor_id = b.benefactor_id
    LEFT JOIN program_openings po ON a.opening_id = po.opening_id
    LEFT JOIN academic_years ay ON po.academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap ON po.period_id = ap.period_id
    LEFT JOIN admin_profiles pd_profile ON es.pd_acted_by_user_id = pd_profile.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY es.pd_acted_at DESC NULLS LAST, a.submission_date DESC;
  `;

    const { rows } = await pool.query(query, params);
    return rows;
}

function addRows(sheet, rows) {
    rows.forEach((row) => sheet.addRow(row));
}

function buildOfficeSummary(reportType, rows = []) {
    const summary = {
        total: rows.length,
        pending: 0,
        completed: 0,
        rejected: 0,
    };

    if (reportType === 'sdo') {
        summary.cleared = 0;
        summary.minor = 0;
        summary.major = 0;

        rows.forEach((row) => {
            const status = safeText(row.sdo_status).toLowerCase();

            if (!status) summary.pending += 1;
            if (status === 'cleared') summary.cleared += 1;
            if (status === 'disqualified_minor') summary.minor += 1;
            if (status === 'disqualified_major') summary.major += 1;
            if (safeText(row.overall_status).toLowerCase() === 'completed') {
                summary.completed += 1;
            }
            if (status === 'disqualified_major') summary.rejected += 1;
        });
    }

    if (reportType === 'guidance') {
        summary.cleared = 0;
        summary.held = 0;

        rows.forEach((row) => {
            const status = safeText(row.guidance_status).toLowerCase();

            if (!status) summary.pending += 1;
            if (status === 'cleared') summary.cleared += 1;
            if (status === 'held') summary.held += 1;
            if (status === 'rejected') summary.rejected += 1;
            if (safeText(row.overall_status).toLowerCase() === 'completed') {
                summary.completed += 1;
            }
        });
    }

    if (reportType === 'pd') {
        summary.approved = 0;

        rows.forEach((row) => {
            const status = safeText(row.pd_status).toLowerCase();

            if (!status) summary.pending += 1;
            if (status === 'approved') summary.approved += 1;
            if (status === 'rejected') summary.rejected += 1;
            if (safeText(row.overall_status).toLowerCase() === 'completed') {
                summary.completed += 1;
            }
        });
    }

    return summary;
}

function escapeCsvValue(value) {
    if (value === null || value === undefined) return '';

    const normalized = String(value).replace(/"/g, '""');

    return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
}

async function getRowsByReportType({
    reportType,
    academicYearId,
    semester,
    programId,
    benefactorId,
    reviewResult,
    dateFrom,
    dateTo,
}) {
    if (reportType === 'applications') {
        return await getApplicationsRows({
            academicYearId,
            semester,
            programId,
            benefactorId,
        });
    }

    if (reportType === 'scholars') {
        return await getScholarsRows({
            academicYearId,
            semester,
            programId,
            benefactorId,
        });
    }

    if (reportType === 'payouts') {
        return await getPayoutRows({
            academicYearId,
            semester,
            programId,
        });
    }

    if (reportType === 'support') {
        return await getSupportRows();
    }

    if (reportType === 'sdo') {
        return await getSdoRows({
            academicYearId,
            semester,
            programId,
            benefactorId,
            reviewResult,
            dateFrom,
            dateTo,
        });
    }

    if (reportType === 'guidance') {
        return await getGuidanceRows({
            academicYearId,
            semester,
            programId,
            benefactorId,
            reviewResult,
            dateFrom,
            dateTo,
        });
    }

    if (reportType === 'pd') {
        return await getPdRows({
            academicYearId,
            semester,
            programId,
            benefactorId,
            reviewResult,
            dateFrom,
            dateTo,
        });
    }

    throw createHttpError(400, 'Invalid report type.');
}

function normalizeReportQuery(query = {}) {
    return {
        reportType: normalizeReportType(query.reportType || query.type),
        academicYearId: safeText(query.academicYearId || query.academic_year_id || 'all'),
        semester: safeText(query.semester || 'all'),
        programId: safeText(query.programId || query.program_id || 'all'),
        benefactorId: safeText(query.benefactorId || query.benefactor_id || 'all'),
        reviewResult: safeText(query.reviewResult || query.review_result || 'all'),
        dateFrom: safeText(query.dateFrom || query.date_from || ''),
        dateTo: safeText(query.dateTo || query.date_to || ''),
    };
}

async function previewReport(query = {}) {
    const normalized = normalizeReportQuery(query);
    const rows = await getRowsByReportType(normalized);

    return {
        reportType: normalized.reportType,
        total: rows.length,
        rows: rows.slice(0, 50),
        summary: ['sdo', 'guidance', 'pd'].includes(normalized.reportType)
            ? buildOfficeSummary(normalized.reportType, rows)
            : null,
    };
}

async function generateExcelReport(query = {}) {
    const normalized = normalizeReportQuery(query);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SMaRT-PDM';
    workbook.created = new Date();

    let sheet;
    let rows;
    let filename;

    if (normalized.reportType === 'applications') {
        sheet = workbook.addWorksheet('Applications');
        sheet.columns = [
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year Level', key: 'year_level' },
            { header: 'Program', key: 'program_name' },
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'Opening', key: 'opening_title' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Application Status', key: 'application_status' },
            { header: 'Document Status', key: 'document_status' },
            { header: 'Verification Status', key: 'verification_status' },
            { header: 'Submitted At', key: 'submission_date' },
            { header: 'Remarks', key: 'remarks' },
        ];
        rows = await getApplicationsRows(normalized);
        filename = 'application_registry_report.xlsx';
    }

    if (normalized.reportType === 'scholars') {
        sheet = workbook.addWorksheet('Scholars');
        sheet.columns = [
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year Level', key: 'year_level' },
            { header: 'Program', key: 'program_name' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'Scholarship Status', key: 'scholarship_status' },
            { header: 'Date Awarded', key: 'date_awarded' },
            { header: 'RO Status', key: 'ro_status' },
        ];
        rows = await getScholarsRows(normalized);
        filename = 'active_scholars_report.xlsx';
    }

    if (normalized.reportType === 'payouts') {
        sheet = workbook.addWorksheet('Payouts');
        sheet.columns = [
            { header: 'Payout Title', key: 'payout_title' },
            { header: 'Program', key: 'program_name' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Payout Date', key: 'payout_date' },
            { header: 'Payment Mode', key: 'payment_mode' },
            { header: 'Amount Per Scholar', key: 'amount_per_scholar' },
            { header: 'Batch Total', key: 'total_amount' },
            { header: 'Batch Status', key: 'batch_status' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Amount Received', key: 'amount_received' },
            { header: 'Release Status', key: 'release_status' },
            { header: 'Released At', key: 'released_at' },
            { header: 'Remarks', key: 'remarks' },
        ];
        rows = await getPayoutRows(normalized);
        filename = 'payout_batch_report.xlsx';
    }

    if (normalized.reportType === 'support') {
        sheet = workbook.addWorksheet('Support Tickets');
        sheet.columns = [
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Category', key: 'issue_category' },
            { header: 'Description', key: 'description' },
            { header: 'Status', key: 'status' },
            { header: 'Handled By', key: 'handled_by' },
            { header: 'Created At', key: 'created_at' },
            { header: 'Resolved At', key: 'resolved_at' },
        ];
        rows = await getSupportRows();
        filename = 'support_ticket_report.xlsx';
    }

    if (normalized.reportType === 'sdo') {
        sheet = workbook.addWorksheet('SDO Endorsements');
        sheet.columns = [
            { header: 'Slip ID', key: 'slip_id' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year Level', key: 'year_level' },
            { header: 'Program', key: 'program_name' },
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'Opening', key: 'opening_title' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Current Stage', key: 'current_stage' },
            { header: 'Overall Status', key: 'overall_status' },
            { header: 'SDO Result', key: 'sdo_status' },
            { header: 'Offense Type', key: 'sdo_offense_type' },
            { header: 'Incident Date', key: 'sdo_incident_date' },
            { header: 'Case Ref No.', key: 'sdo_case_reference_number' },
            { header: 'SDO Remarks', key: 'sdo_remarks' },
            { header: 'Reviewed By', key: 'reviewed_by' },
            { header: 'Reviewed At', key: 'sdo_acted_at' },
            { header: 'Submitted At', key: 'submission_date' },
        ];
        rows = await getSdoRows(normalized);
        filename = 'sdo_endorsement_report.xlsx';
    }

    if (normalized.reportType === 'guidance') {
        sheet = workbook.addWorksheet('Guidance Endorsements');
        sheet.columns = [
            { header: 'Slip ID', key: 'slip_id' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year Level', key: 'year_level' },
            { header: 'Program', key: 'program_name' },
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'Opening', key: 'opening_title' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Current Stage', key: 'current_stage' },
            { header: 'Overall Status', key: 'overall_status' },
            { header: 'SDO Result', key: 'sdo_status' },
            { header: 'Offense Type', key: 'sdo_offense_type' },
            { header: 'Incident Date', key: 'sdo_incident_date' },
            { header: 'Case Ref No.', key: 'sdo_case_reference_number' },
            { header: 'Guidance Result', key: 'guidance_status' },
            { header: 'Guidance Remarks', key: 'guidance_remarks' },
            { header: 'Reviewed By', key: 'reviewed_by' },
            { header: 'Reviewed At', key: 'guidance_acted_at' },
            { header: 'Submitted At', key: 'submission_date' },
        ];
        rows = await getGuidanceRows(normalized);
        filename = 'guidance_endorsement_report.xlsx';
    }

    if (normalized.reportType === 'pd') {
        sheet = workbook.addWorksheet('PD Endorsements');
        sheet.columns = [
            { header: 'Slip ID', key: 'slip_id' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year Level', key: 'year_level' },
            { header: 'Program', key: 'program_name' },
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'Opening', key: 'opening_title' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Current Stage', key: 'current_stage' },
            { header: 'Overall Status', key: 'overall_status' },
            { header: 'SDO Result', key: 'sdo_status' },
            { header: 'Guidance Result', key: 'guidance_status' },
            { header: 'PD Result', key: 'pd_status' },
            { header: 'PD Remarks', key: 'pd_remarks' },
            { header: 'Reviewed By', key: 'reviewed_by' },
            { header: 'Reviewed At', key: 'pd_acted_at' },
            { header: 'Completed At', key: 'completed_at' },
            { header: 'Final PDF URL', key: 'final_pdf_url' },
            { header: 'Submitted At', key: 'submission_date' },
        ];
        rows = await getPdRows(normalized);
        filename = 'pd_endorsement_report.xlsx';
    }

    if (!sheet) {
        throw createHttpError(400, 'Invalid report type.');
    }

    addRows(sheet, rows || []);
    styleSheet(sheet);

    return {
        workbook,
        filename,
    };
}

async function generateCsvReport(query = {}) {
    const excelResult = await generateExcelReport(query);
    const sheet = excelResult.workbook.worksheets[0];
    const headers = (sheet.columns || []).map((column) => column.header);
    const keys = (sheet.columns || []).map((column) => column.key);
    const rows = [];

    rows.push(headers.map(escapeCsvValue).join(','));

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const values = keys.map((key) =>
            escapeCsvValue(row.getCell(key).value ?? '')
        );

        rows.push(values.join(','));
    });

    return {
        filename: excelResult.filename.replace(/\.xlsx$/i, '.csv'),
        content: rows.join('\n'),
    };
}

module.exports = {
    getReportMetadata,
    previewReport,
    generateExcelReport,
    generateCsvReport,
};