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

function normalizeReportType(value) {
    const type = safeText(value).toLowerCase();
    const allowed = ['applications', 'scholars', 'payouts', 'support'];
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
                sub: 'Approved scholars with program, course, year level, and status',
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

async function getApplicationsRows({ academicYearId, semester, programId, benefactorId }) {
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

async function getScholarsRows({ academicYearId, semester, programId, benefactorId }) {
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
      st.ro_progress,
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

function addRows(sheet, rows) {
    rows.forEach((row) => sheet.addRow(row));
}

async function previewReport(query = {}) {
    const reportType = normalizeReportType(query.reportType || query.type);
    const academicYearId = safeText(query.academicYearId || query.academic_year_id || 'all');
    const semester = safeText(query.semester || 'all');
    const programId = safeText(query.programId || query.program_id || 'all');
    const benefactorId = safeText(query.benefactorId || query.benefactor_id || 'all');

    let rows = [];

    if (reportType === 'applications') {
        rows = await getApplicationsRows({ academicYearId, semester, programId });
    }

    if (reportType === 'scholars') {
        rows = await getScholarsRows({
            academicYearId,
            semester,
            programId,
            benefactorId,
        });
    }

    if (reportType === 'payouts') {
        rows = await getPayoutRows({ academicYearId, semester, programId });
    }

    if (reportType === 'support') {
        rows = await getSupportRows();
    }

    return {
        reportType,
        total: rows.length,
        rows: rows.slice(0, 50),
    };
}

async function generateExcelReport(query = {}) {
    const reportType = normalizeReportType(query.reportType || query.type);
    const academicYearId = safeText(query.academicYearId || query.academic_year_id || 'all');
    const semester = safeText(query.semester || 'all');
    const programId = safeText(query.programId || query.program_id || 'all');
    const benefactorId = safeText(query.benefactorId || query.benefactor_id || 'all');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SMaRT-PDM';
    workbook.created = new Date();

    let sheet;
    let rows;
    let filename;

    if (reportType === 'applications') {
        sheet = workbook.addWorksheet('Applications');
        sheet.columns = [
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year Level', key: 'year_level' },
            { header: 'Program', key: 'program_name' },
            { header: 'Opening', key: 'opening_title' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Application Status', key: 'application_status' },
            { header: 'Document Status', key: 'document_status' },
            { header: 'Verification Status', key: 'verification_status' },
            { header: 'Submitted At', key: 'submission_date' },
            { header: 'Remarks', key: 'remarks' },
        ];
        rows = await getApplicationsRows({ academicYearId, semester, programId });
        filename = 'application_registry_report.xlsx';
    }

    if (reportType === 'scholars') {
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
            { header: 'RO Progress', key: 'ro_progress' },
        ];
        rows = await getScholarsRows({ academicYearId, semester, programId, benefactorId });
        filename = 'active_scholars_report.xlsx';
    }

    if (reportType === 'payouts') {
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
        rows = await getPayoutRows({ academicYearId, semester, programId });
        filename = 'payout_batch_report.xlsx';
    }

    if (reportType === 'support') {
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

module.exports = {
    getReportMetadata,
    previewReport,
    generateExcelReport,
};