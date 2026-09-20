const path = require('path');
const ExcelJS = require('exceljs');
const pool = require('../config/db');

const EXCEL_HEADER_IMAGE_PATH = path.resolve(
    __dirname,
    '../assets/report-templates/pdm-excel-header.png'
);

function createHttpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function safeText(value) {
    return value === null || value === undefined ? '' : String(value).trim();
}

function humanizeLabel(value) {
    const text = safeText(value);
    if (!text) return '';
    if (!/[_-]/.test(text)) return text;

    return text
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .replace(/\bSdo\b/g, 'SDO')
        .replace(/\bPd\b/g, 'PD')
        .replace(/\bRo\b/g, 'RO')
        .replace(/\bGwa\b/g, 'GWA');
}

function buildMetadataOptions(rows, key, allLabel) {
    return [
        { value: 'all', label: allLabel },
        ...(rows || [])
            .map((row) => safeText(row?.[key]))
            .filter(Boolean)
            .map((value) => ({ value, label: humanizeLabel(value) })),
    ];
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
        'payout_proofs',
        'sdo',
        'guidance',
        'pd',
        'scholars_by_benefactor',
        'scholarship_history',
        'endorsements',
        'ro',
        'ro_compliance',
        'renewals',
        'slot_utilization',
    ];

    if (!type) return 'applications';
    if (!allowed.includes(type)) {
        throw createHttpError(400, 'Invalid report type.');
    }

    return type;
}

function normalizeDate(value, fieldName) {
    const normalized = safeText(value);
    if (!normalized) return '';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        throw createHttpError(400, `${fieldName} must use YYYY-MM-DD format.`);
    }

    const parsed = new Date(`${normalized}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
        throw createHttpError(400, `${fieldName} is not a valid date.`);
    }

    return normalized;
}

async function getReportMetadata() {
    const [
        programsResult,
        yearsResult,
        benefactorsResult,
        coursesResult,
        roAreasResult,
        yearLevelsResult,
        gendersResult,
        applicationStatusesResult,
        documentStatusesResult,
        verificationStatusesResult,
        payoutBatchStatusesResult,
        payoutReleaseStatusesResult,
        payoutPaymentModesResult,
    ] = await Promise.all([
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
        pool.query(`
      SELECT course_id, course_code, course_name
      FROM academic_course
      WHERE COALESCE(is_archived, FALSE) = FALSE
      ORDER BY course_code ASC;
    `),
        pool.query(`
      SELECT department_id, department_name
      FROM ro_departments
      WHERE COALESCE(is_active, TRUE) = TRUE
      ORDER BY department_name ASC;
    `),
        pool.query(`
      SELECT DISTINCT year_level
      FROM students
      WHERE year_level IS NOT NULL
        AND TRIM(year_level::text) <> ''
      ORDER BY year_level;
    `),
        pool.query(`
      SELECT DISTINCT gender
      FROM (
        SELECT NULLIF(TRIM(COALESCE(st.sex_at_birth, smr.sex_at_birth)), '') AS gender
        FROM students st
        LEFT JOIN student_master_records smr ON smr.master_student_id = st.master_student_id
      ) values_with_gender
      WHERE gender IS NOT NULL
      ORDER BY gender;
    `),
        pool.query(`
      SELECT DISTINCT TRIM(application_status) AS value
      FROM applications
      WHERE NULLIF(TRIM(COALESCE(application_status, '')), '') IS NOT NULL
      ORDER BY value;
    `),
        pool.query(`
      SELECT DISTINCT TRIM(document_status) AS value
      FROM applications
      WHERE NULLIF(TRIM(COALESCE(document_status, '')), '') IS NOT NULL
      ORDER BY value;
    `),
        pool.query(`
      SELECT DISTINCT TRIM(verification_status) AS value
      FROM applications
      WHERE NULLIF(TRIM(COALESCE(verification_status, '')), '') IS NOT NULL
      ORDER BY value;
    `),
        pool.query(`
      SELECT DISTINCT TRIM(batch_status) AS value
      FROM payout_batches
      WHERE NULLIF(TRIM(COALESCE(batch_status, '')), '') IS NOT NULL
      ORDER BY value;
    `),
        pool.query(`
      SELECT DISTINCT TRIM(release_status) AS value
      FROM payout_batch_students
      WHERE NULLIF(TRIM(COALESCE(release_status, '')), '') IS NOT NULL
      ORDER BY value;
    `),
        pool.query(`
      SELECT DISTINCT TRIM(payment_mode) AS value
      FROM payout_batches
      WHERE NULLIF(TRIM(COALESCE(payment_mode, '')), '') IS NOT NULL
      ORDER BY value;
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
                id: 'scholars_by_benefactor',
                name: 'Scholar Count by Benefactor',
                sub: 'Active scholar totals grouped by benefactor or program for the selected benefactor',
            },
            {
                id: 'scholarship_history',
                name: 'Scholarship Program History',
                sub: 'Student history by scholarship program across an academic-year range',
            },
            {
                id: 'payouts',
                name: 'Payout Batch Report',
                sub: 'Payout batches, release status, amount, and recipients',
            },
            {
                id: 'payout_proofs',
                name: 'Payout Proof Upload Report',
                sub: 'Scholars who uploaded payout proof with submission and review details',
            },
            {
                id: 'endorsements',
                name: 'Endorsement Report',
                sub: 'Consolidated SDO, Guidance, and Program Director endorsement results',
            },
            {
                id: 'sdo',
                name: 'SDO Endorsement Report',
                sub: 'SDO disciplinary standing, remarks, and endorsement stage status',
            },
            {
                id: 'guidance',
                name: 'Guidance Endorsement Report',
                sub: 'Guidance Good Moral Standing results with prior SDO context',
            },
            {
                id: 'pd',
                name: 'PD Endorsement Report',
                sub: 'Program Director scholastic standing with full endorsement progression summary',
            },
            {
                id: 'ro',
                name: 'RO Personnel-In-Charge Report',
                sub: 'Assigned scholars, placement status, validated hours, and RO progress for your assigned area',
            },
            {
                id: 'ro_compliance',
                name: 'RO Scholar Compliance Report',
                sub: 'Finished and not fully complied scholars by RO Area, course, year level, gender, and PIC',
            },
            {
                id: 'renewals',
                name: 'Scholarship Renewal Report',
                sub: 'Renewed and non-renewed scholars by academic period, program, and benefactor',
            },
            {
                id: 'slot_utilization',
                name: 'Scholarship Slot Report',
                sub: 'Allocated, filled, available, and released scholarship slots by program and benefactor',
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
        courses: [
            { course_id: 'all', course_code: 'All Courses', course_name: 'All Courses' },
            ...(coursesResult.rows || []),
        ],
        roAreas: [
            { department_id: 'all', department_name: 'All RO Areas' },
            ...(roAreasResult.rows || []),
        ],
        yearLevels: [
            { value: 'all', label: 'All Year Levels' },
            ...(yearLevelsResult.rows || []).map((row) => ({
                value: String(row.year_level),
                label: `Year ${row.year_level}`,
            })),
        ],
        genders: [
            { value: 'all', label: 'All Genders' },
            ...(gendersResult.rows || []).map((row) => ({
                value: String(row.gender),
                label: String(row.gender),
            })),
        ],
        applicationStatuses: buildMetadataOptions(applicationStatusesResult.rows, 'value', 'All Application Statuses'),
        documentStatuses: buildMetadataOptions(documentStatusesResult.rows, 'value', 'All Document Statuses'),
        verificationStatuses: buildMetadataOptions(verificationStatusesResult.rows, 'value', 'All Verification Statuses'),
        payoutBatchStatuses: buildMetadataOptions(payoutBatchStatusesResult.rows, 'value', 'All Batch Statuses'),
        payoutReleaseStatuses: buildMetadataOptions(payoutReleaseStatusesResult.rows, 'value', 'All Release Statuses'),
        payoutPaymentModes: buildMetadataOptions(payoutPaymentModesResult.rows, 'value', 'All Payout Modes'),
    };
}

function appendScholarDetailFilters(
    where,
    params,
    { courseId, yearLevel, gender } = {},
    studentAlias = 'st'
) {
    if (courseId && courseId !== 'all') {
        params.push(courseId);
        where.push(`${studentAlias}.course_id = $${params.length}`);
    }

    if (yearLevel && yearLevel !== 'all') {
        params.push(yearLevel);
        where.push(`${studentAlias}.year_level::text = $${params.length}`);
    }

    if (gender && gender !== 'all') {
        params.push(gender);
        where.push(`LOWER(TRIM(COALESCE(${studentAlias}.sex_at_birth, ''))) = LOWER(TRIM($${params.length}))`);
    }
}

function appendTextEqualityFilter(where, params, expression, value) {
    if (!value || value === 'all') return;
    params.push(value);
    where.push(`LOWER(TRIM(COALESCE(${expression}, ''))) = LOWER(TRIM($${params.length}))`);
}

const EXCEL_COLUMN_MAX_WIDTHS = {
    row_number: 7,
    pdm_id: 18,
    student_name: 32,
    _last_name: 24,
    _given_name: 24,
    _middle_initial: 7,
    email_address: 34,
    phone_number: 18,
    gender: 14,
    course_code: 14,
    course_name: 32,
    year_level: 11,
    program_name: 34,
    history_range: 18,
    history_summary: 78,
    latest_status: 20,
    benefactor_name: 30,
    opening_title: 34,
    academic_year: 18,
    applicable_academic_year: 20,
    previous_academic_year: 20,
    semester: 20,
    remarks: 40,
    sdo_remarks: 40,
    guidance_remarks: 40,
    pd_remarks: 40,
    final_pdf_url: 38,
    personnel_in_charge: 32,
    assigned_areas: 30,
    application_status: 22,
    document_status: 22,
    verification_status: 22,
    scholarship_status: 22,
    renewal_status: 20,
    release_status: 20,
    batch_status: 20,
    payment_mode: 22,
    compliance_status: 24,
    progress_status: 22,
    assignment_status: 22,
    clearance_status: 22,
    opening_status: 18,
};

const EXCEL_COLUMN_MIN_WIDTHS = {
    row_number: 5,
    _middle_initial: 5,
    gender: 9,
    course_code: 9,
    year_level: 8,
    gwa: 8,
    _gwa: 8,
    total_slots: 11,
    filled_slots: 11,
    available_slots: 13,
    released_slots: 13,
    scholar_count: 12,
    required_hours: 12,
    submitted_hours: 13,
    validated_hours: 13,
    remaining_hours: 13,
    completion_percentage: 12,
};


const INSTITUTIONAL_EXCEL_COLUMN_MAX_WIDTHS = {
    row_number: 6,
    pdm_id: 14,
    _last_name: 18,
    _given_name: 20,
    _middle_initial: 7,
    course_code: 11,
    year_level: 8,
    gender: 10,
    gwa: 9,
    _gwa: 9,
    program_name: 20,
    benefactor_name: 20,
    academic_year: 14,
    applicable_academic_year: 14,
    semester: 16,
    scholarship_status: 16,
    ro_status: 13,
    renewal_status: 16,
    date_awarded: 15,
    renewal_date: 15,
    remarks: 26,
};

function normalizeExcelCellValue(value) {
    return typeof value === 'string' ? value.trim() : value;
}

function normalizeReportDisplayValue(key, value) {
    const normalized = normalizeExcelCellValue(value);
    if (typeof normalized !== 'string') return normalized;

    if (/(status|stage|result|compliance)/i.test(String(key || '')) && /[_-]/.test(normalized)) {
        return humanizeLabel(normalized);
    }

    return normalized;
}

function stripInternalReportFields(row = {}) {
    return Object.fromEntries(
        Object.entries(row)
            .filter(([key]) => !String(key).startsWith('_'))
            .map(([key, value]) => [key, normalizeReportDisplayValue(key, value)])
    );
}

function getExcelPeriodLabel(normalized, rows = []) {
    const resolvedAcademicYear =
        rows.find((row) => safeText(row.applicable_academic_year))?.applicable_academic_year ||
        rows.find((row) => safeText(row.academic_year))?.academic_year ||
        rows.find((row) => safeText(row.previous_academic_year))?.previous_academic_year;

    const academicYear = normalized.academicYearId !== 'all'
        ? safeText(resolvedAcademicYear) || 'Selected Academic Year'
        : 'All Academic Years';

    const semester = normalized.semester !== 'all'
        ? safeText(normalized.semester)
        : 'All Semesters';

    return { academicYear, semester };
}

function formatExcelPeriodSubtitle(normalized, rows = []) {
    const { academicYear, semester } = getExcelPeriodLabel(normalized, rows);
    const hasAcademicYear = normalized.academicYearId !== 'all';
    const hasSemester = normalized.semester !== 'all';

    if (hasAcademicYear && hasSemester) {
        return `${semester.toUpperCase()} A.Y. ${academicYear}`;
    }
    if (hasAcademicYear) {
        return `ALL SEMESTERS • A.Y. ${academicYear}`;
    }
    if (hasSemester) {
        return `${semester.toUpperCase()} • ALL ACADEMIC YEARS`;
    }
    return 'ALL ACADEMIC YEARS • ALL SEMESTERS';
}

function getInstitutionalReportTitle(reportType) {
    const titles = {
        applications: 'APPLICATION REGISTRY REPORT',
        scholars: 'FINANCIAL ASSISTANCE BENEFICIARIES',
        scholars_by_benefactor: 'SCHOLAR COUNT BY BENEFACTOR',
        scholarship_history: 'SCHOLARSHIP PROGRAM HISTORY',
        payouts: 'PAYOUT BATCH REPORT',
        payout_proofs: 'PAYOUT PROOF UPLOAD REPORT',
        renewals: 'SCHOLARSHIP RENEWAL REPORT',
        slot_utilization: 'SCHOLARSHIP SLOT REPORT',
        sdo: 'SDO ENDORSEMENT REPORT',
        guidance: 'GUIDANCE ENDORSEMENT REPORT',
        pd: 'PD ENDORSEMENT REPORT',
        ro: 'RO PERSONNEL-IN-CHARGE REPORT',
        ro_compliance: 'RO SCHOLAR COMPLIANCE REPORT',
        endorsements: 'ENDORSEMENT REPORT',
    };

    return titles[reportType] || 'SMaRT-PDM REPORT';
}

function excelCellText(cell) {
    if (!cell) return '';
    if (cell.text !== undefined && cell.text !== null && String(cell.text) !== '') {
        return String(cell.text).replace(/\r\n/g, '\n').trim();
    }

    const value = cell.value;
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString().replace('T', ' ').slice(0, 16);
    if (typeof value === 'object') {
        if (value.text !== undefined) return String(value.text).trim();
        if (value.result !== undefined) return String(value.result).trim();
    }
    return String(value).replace(/\r\n/g, '\n').trim();
}

function visualTextWidth(text) {
    const lines = String(text || '').split('\n');
    return Math.max(0, ...lines.map((line) => {
        let width = 0;
        for (const char of Array.from(line)) {
            if (/\s/.test(char)) width += 0.55;
            else if (/[MW@#%&]/.test(char)) width += 1.35;
            else if (/[ilI1.,'`|]/.test(char)) width += 0.55;
            else if (char.charCodeAt(0) > 255) width += 1.8;
            else width += 1;
        }
        return width;
    }));
}

function resolveExcelWidthBounds(key, headerText, { institutional = false } = {}) {
    const normalizedKey = String(key || '');
    const institutionalMax = institutional ? INSTITUTIONAL_EXCEL_COLUMN_MAX_WIDTHS[normalizedKey] : null;
    const explicitMax = institutionalMax || EXCEL_COLUMN_MAX_WIDTHS[normalizedKey];
    const maxWidth = explicitMax || (/remarks|reason|description|address/i.test(normalizedKey) ? 40 : 28);
    const headerWidth = Math.ceil(visualTextWidth(headerText));
    const explicitMin = EXCEL_COLUMN_MIN_WIDTHS[normalizedKey];
    const defaultMin = institutional ? 6 : 7;
    const headerMinCap = institutional ? 13 : 16;
    const minWidth = Math.min(maxWidth, explicitMin || Math.max(defaultMin, Math.min(headerMinCap, headerWidth + 2)));
    return { minWidth, maxWidth };
}

function estimateWrappedLines(text, columnWidth) {
    const available = Math.max(4, Number(columnWidth || 10) - 1.5);
    const rawLines = String(text || '').split('\n');
    return Math.max(1, rawLines.reduce((total, line) => {
        const width = Math.max(1, visualTextWidth(line));
        return total + Math.max(1, Math.ceil(width / available));
    }, 0));
}

function applyAdaptiveWorksheetLayout(sheet, {
    headerRow = 1,
    dataStartRow = headerRow + 1,
    freezeRow = headerRow,
    alternateRows = true,
    institutional = false,
} = {}) {
    const lastRow = Math.max(headerRow, sheet.lastRow?.number || headerRow);
    const lastColumn = Math.max(1, sheet.columnCount);
    let totalColumnWidth = 0;

    const header = sheet.getRow(headerRow);
    header.font = {
        ...(header.font || {}),
        bold: true,
        color: { argb: institutional ? 'FF111111' : 'FFFFFFFF' },
        size: lastColumn >= 18 ? 9 : 10,
    };
    header.fill = institutional
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C4A2E' } };
    header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    sheet.views = institutional
        ? [{
            state: 'normal',
            showGridLines: true,
            zoomScale: 85,
            zoomScaleNormal: 100,
        }]
        : [{
            state: 'frozen',
            ySplit: freezeRow,
            showGridLines: false,
            zoomScale: 100,
            zoomScaleNormal: 100,
        }];
    if (!institutional) {
        sheet.autoFilter = {
            from: { row: headerRow, column: 1 },
            to: { row: headerRow, column: lastColumn },
        };
    }
    sheet.properties.defaultRowHeight = 18;

    sheet.columns.forEach((column) => {
        const key = String(column.key || '');
        const headerCell = sheet.getCell(headerRow, column.number);
        const headerText = excelCellText(headerCell) || String(column.header || '');
        const { minWidth, maxWidth } = resolveExcelWidthBounds(key, headerText, { institutional });
        let bestWidth = Math.max(minWidth, Math.ceil(visualTextWidth(headerText)) + 2);

        column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
            if (rowNumber < dataStartRow) return;
            const text = excelCellText(cell);
            if (!text) return;
            bestWidth = Math.max(bestWidth, Math.ceil(visualTextWidth(text)) + 2);
        });

        column.width = Math.min(maxWidth, Math.max(minWidth, bestWidth));
        totalColumnWidth += Number(column.width || minWidth);

        const numericKey = /(amount|total|count|slots|hours|percentage|gwa|year_level)$/i.test(key);
        const compactKey = /^(row_number|_middle_initial|course_code|year_level|gender|gwa|_gwa)$/i.test(key);

        column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
            if (rowNumber < dataStartRow) return;
            cell.alignment = {
                vertical: 'middle',
                horizontal: numericKey || compactKey ? 'center' : 'left',
                wrapText: true,
                shrinkToFit: false,
            };
            cell.border = {
                top: { style: 'thin', color: { argb: institutional ? 'FF555555' : 'FFE7E5E4' } },
                left: { style: 'thin', color: { argb: institutional ? 'FF555555' : 'FFE7E5E4' } },
                bottom: { style: 'thin', color: { argb: institutional ? 'FF555555' : 'FFE7E5E4' } },
                right: { style: 'thin', color: { argb: institutional ? 'FF555555' : 'FFE7E5E4' } },
            };
            if (lastColumn >= 18 && !institutional) {
                cell.font = { ...(cell.font || {}), size: 9 };
            }
        });

        if (/amount|total_amount|amount_received/i.test(key)) {
            column.numFmt = '₱#,##0.00;[Red]-₱#,##0.00';
        } else if (/percentage/i.test(key)) {
            column.numFmt = '0.0';
        } else if (/gwa|hours/i.test(key)) {
            column.numFmt = '0.00';
        } else if (/slots|count/i.test(key)) {
            column.numFmt = '0';
        }

        if (/date|_at$|submitted|requested|decided|cleared/i.test(key)) {
            column.numFmt = 'yyyy-mm-dd hh:mm';
        }
    });

    let headerLines = 1;
    for (let columnNumber = 1; columnNumber <= lastColumn; columnNumber += 1) {
        const cell = header.getCell(columnNumber);
        const width = sheet.getColumn(columnNumber).width || 10;
        headerLines = Math.max(headerLines, estimateWrappedLines(excelCellText(cell), width));
    }
    const maxHeaderHeight = institutional ? 46 : 60;
    header.height = Math.max(28, Math.min(maxHeaderHeight, 18 + headerLines * 10));

    for (let rowNumber = dataStartRow; rowNumber <= lastRow; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        let wrappedLines = 1;
        for (let columnNumber = 1; columnNumber <= lastColumn; columnNumber += 1) {
            const cell = row.getCell(columnNumber);
            const width = sheet.getColumn(columnNumber).width || 10;
            wrappedLines = Math.max(wrappedLines, estimateWrappedLines(excelCellText(cell), width));
        }
        row.height = Math.max(18, Math.min(institutional ? 42 : 84, 7 + wrappedLines * (institutional ? 12 : 14)));

        if (alternateRows && (rowNumber - dataStartRow) % 2 === 1) {
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF7F3EF' },
            };
        }
    }

    const orientation = lastColumn <= 7 && totalColumnWidth <= 95 ? 'portrait' : 'landscape';
    const veryWide = lastColumn >= 18 || totalColumnWidth >= 230;
    const lastColumnLetter = sheet.getColumn(lastColumn).letter;

    sheet.pageSetup = {
        orientation,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: veryWide ? 8 : 9,
        horizontalCentered: true,
        verticalCentered: false,
        margins: {
            left: 0.2,
            right: 0.2,
            top: institutional ? 0.3 : 0.45,
            bottom: 0.45,
            header: 0.15,
            footer: 0.2,
        },
        printArea: `A1:${lastColumnLetter}${lastRow}`,
        printTitlesRow: `${headerRow}:${headerRow}`,
    };
    sheet.headerFooter.oddHeader = institutional ? '' : '&C&BOSFA - Pambayang Dalubhasaan ng Marilao';
    sheet.headerFooter.oddFooter = '&LGenerated by SMaRT-PDM&CPage &P of &N&RConfidential';

    return { totalColumnWidth, orientation, lastRow, lastColumn };
}

function addInstitutionalWorksheetHeader(workbook, sheet, {
    title,
    subtitle,
    lastColumn,
    headerRow = 11,
    sectionLabel = '',
}) {
    const imageId = workbook.addImage({
        filename: EXCEL_HEADER_IMAGE_PATH,
        extension: 'png',
    });

    // Keep the PDM banner at a stable aspect ratio. Tying the image to the
    // worksheet columns stretches it whenever auto-fit changes column widths.
    sheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 662, height: 140 },
        editAs: 'oneCell',
    });

    [1, 2, 3, 4, 5, 6, 7].forEach((rowNumber) => {
        sheet.getRow(rowNumber).height = rowNumber === 7 ? 6 : 18;
    });

    sheet.mergeCells(`A8:${lastColumn}8`);
    sheet.getCell('A8').value = title;
    sheet.getCell('A8').font = { bold: true, size: 12, color: { argb: 'FF111111' } };
    sheet.getCell('A8').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sheet.getRow(8).height = Math.max(24, Math.min(42, 18 + estimateWrappedLines(title, Math.max(18, sheet.columnCount * 10)) * 10));

    sheet.mergeCells(`A9:${lastColumn}9`);
    sheet.getCell('A9').value = subtitle;
    sheet.getCell('A9').font = { bold: true, size: 10, color: { argb: 'FF111111' } };
    sheet.getCell('A9').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sheet.getRow(9).height = 20;

    sheet.getRow(10).height = 6;

    if (sectionLabel) {
        const sectionRow = headerRow + 1;
        sheet.mergeCells(`A${sectionRow}:${lastColumn}${sectionRow}`);
        sheet.getCell(`A${sectionRow}`).value = sectionLabel;
        sheet.getCell(`A${sectionRow}`).font = { bold: true, size: 10, color: { argb: 'FF111111' } };
        sheet.getCell(`A${sectionRow}`).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD9D9D9' },
        };
        sheet.getCell(`A${sectionRow}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        sheet.getRow(sectionRow).height = 20;
    }
}

function styleSheet(sheet, {
    headerRow = 1,
    dataStartRow = headerRow + 1,
    freezeRow = headerRow,
    alternateRows = true,
    institutional = false,
} = {}) {
    return applyAdaptiveWorksheetLayout(sheet, {
        headerRow,
        dataStartRow,
        freezeRow,
        alternateRows,
        institutional,
    });
}

async function getApplicationsRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
    courseId,
    yearLevel,
    gender,
    applicationStatus,
    documentStatus,
    verificationStatus,
    dateFrom,
    dateTo,
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

    appendScholarDetailFilters(where, params, { courseId, yearLevel, gender });
    appendTextEqualityFilter(where, params, 'a.application_status', applicationStatus);
    appendTextEqualityFilter(where, params, 'a.document_status', documentStatus);
    appendTextEqualityFilter(where, params, 'a.verification_status', verificationStatus);
    appendDateRange(where, params, 'a.submission_date', dateFrom, dateTo);

    const query = `
    SELECT
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name,
      COALESCE(NULLIF(TRIM(st.sex_at_birth), ''), 'Not specified') AS gender,
      ac.course_code,
      st.year_level,
      st.gwa,
      st.email_address,
      st.phone_number,
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
    courseId,
    yearLevel,
    gender,
    dateFrom,
    dateTo,
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

    appendScholarDetailFilters(where, params, { courseId, yearLevel, gender });
    appendDateRange(where, params, 'st.date_awarded', dateFrom, dateTo);

    const query = `
    SELECT
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name,
      st.last_name AS _last_name,
      st.first_name AS _given_name,
      CASE WHEN NULLIF(TRIM(st.middle_name), '') IS NULL THEN '' ELSE CONCAT(LEFT(TRIM(st.middle_name), 1), '.') END AS _middle_initial,
      COALESCE(NULLIF(TRIM(st.sex_at_birth), ''), 'Not specified') AS gender,
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


async function resolveAcademicYearHistoryRange(
    academicYearFromId = 'all',
    academicYearToId = 'all'
) {
    const ids = [
        academicYearFromId,
        academicYearToId,
    ].filter((value) => value && value !== 'all');

    if (!ids.length) {
        return {
            fromStartYear: null,
            toStartYear: null,
        };
    }

    const result = await pool.query(
        `
        SELECT academic_year_id::text AS academic_year_id, start_year
        FROM academic_years
        WHERE academic_year_id::text = ANY($1::text[]);
        `,
        [ids]
    );

    const yearMap = new Map(
        (result.rows || []).map((row) => [
            String(row.academic_year_id),
            Number(row.start_year),
        ])
    );

    const fromStartYear =
        academicYearFromId && academicYearFromId !== 'all'
            ? yearMap.get(String(academicYearFromId))
            : null;

    const toStartYear =
        academicYearToId && academicYearToId !== 'all'
            ? yearMap.get(String(academicYearToId))
            : null;

    if (
        academicYearFromId !== 'all' &&
        !Number.isFinite(fromStartYear)
    ) {
        throw createHttpError(400, 'Invalid starting academic year.');
    }

    if (
        academicYearToId !== 'all' &&
        !Number.isFinite(toStartYear)
    ) {
        throw createHttpError(400, 'Invalid ending academic year.');
    }

    if (
        Number.isFinite(fromStartYear) &&
        Number.isFinite(toStartYear) &&
        fromStartYear > toStartYear
    ) {
        throw createHttpError(
            400,
            'Starting academic year cannot be later than ending academic year.'
        );
    }

    return {
        fromStartYear:
            Number.isFinite(fromStartYear) ? fromStartYear : null,
        toStartYear:
            Number.isFinite(toStartYear) ? toStartYear : null,
    };
}

async function getScholarshipHistoryRows({
    academicYearFromId,
    academicYearToId,
    semester,
    programId,
    benefactorId,
    courseId,
    yearLevel,
    gender,
}) {
    const {
        fromStartYear,
        toStartYear,
    } = await resolveAcademicYearHistoryRange(
        academicYearFromId,
        academicYearToId
    );

    const params = [];
    const where = [
        `COALESCE(st.is_archived, FALSE) = FALSE`,
        `a.program_id IS NOT NULL`,
    ];

    if (Number.isFinite(fromStartYear)) {
        params.push(fromStartYear);
        where.push(`ay.start_year >= $${params.length}`);
    }

    if (Number.isFinite(toStartYear)) {
        params.push(toStartYear);
        where.push(`ay.start_year <= $${params.length}`);
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

    appendScholarDetailFilters(
        where,
        params,
        { courseId, yearLevel, gender },
        'st'
    );

    const query = `
      WITH ranked_history AS (
        SELECT
          a.student_id,
          a.application_id,
          a.program_id,
          po.academic_year_id,
          po.period_id,
          ay.start_year,
          ay.end_year,
          ay.label AS academic_year,
          ap.term AS semester,
          sp.program_name,
          b.benefactor_name,
          CASE
            WHEN a.is_disqualified = TRUE THEN 'Disqualified'
            WHEN LOWER(COALESCE(a.application_status, '')) = 'rejected'
              THEN 'Rejected'
            WHEN LOWER(COALESCE(a.activation_status, '')) = 'activated'
              OR a.activated_at IS NOT NULL
              THEN 'Activated'
            WHEN LOWER(COALESCE(a.application_status, '')) = 'approved'
              THEN 'Approved'
            WHEN LOWER(COALESCE(a.selection_status, '')) = 'promoted'
              THEN 'Promoted'
            WHEN LOWER(COALESCE(a.selection_status, '')) = 'reserved'
              THEN 'Reserved'
            WHEN LOWER(COALESCE(a.selection_status, '')) = 'selected'
              THEN 'Selected'
            ELSE COALESCE(
              NULLIF(TRIM(a.application_status), ''),
              'Applied'
            )
          END AS history_status,
          COALESCE(
            placement.department_name,
            NULLIF(TRIM(ro.assigned_area), '')
          ) AS ro_assigned_office,
          COALESCE(
            a.activated_at,
            a.selected_at,
            a.finalized_at,
            a.submission_date,
            a.created_at
          ) AS event_at,
          ROW_NUMBER() OVER (
            PARTITION BY
              a.student_id,
              a.program_id,
              po.academic_year_id,
              po.period_id
            ORDER BY
              CASE
                WHEN st.current_application_id = a.application_id THEN 0
                ELSE 1
              END,
              COALESCE(
                a.activated_at,
                a.selected_at,
                a.finalized_at,
                a.submission_date,
                a.created_at
              ) DESC NULLS LAST,
              a.application_id DESC
          ) AS history_rank
        FROM applications a
        JOIN students st
          ON st.student_id = a.student_id
        JOIN program_openings po
          ON po.opening_id = a.opening_id
        JOIN academic_years ay
          ON ay.academic_year_id = po.academic_year_id
        LEFT JOIN academic_period ap
          ON ap.period_id = po.period_id
        LEFT JOIN scholarship_program sp
          ON sp.program_id = a.program_id
        LEFT JOIN benefactors b
          ON b.benefactor_id = sp.benefactor_id
        LEFT JOIN LATERAL (
          SELECT ro_row.*
          FROM return_of_obligations ro_row
          WHERE ro_row.student_id = a.student_id
            AND (
              ro_row.application_id = a.application_id
              OR (
                ro_row.period_id = po.period_id
                AND (
                  ro_row.program_id = a.program_id
                  OR ro_row.program_id IS NULL
                )
              )
            )
          ORDER BY
            CASE
              WHEN ro_row.application_id = a.application_id THEN 0
              ELSE 1
            END,
            ro_row.created_at DESC NULLS LAST
          LIMIT 1
        ) ro ON TRUE
        LEFT JOIN LATERAL (
          SELECT rd.department_name
          FROM ro_placements rp
          JOIN ro_departments rd
            ON rd.department_id = rp.ro_area_id
          WHERE rp.ro_id = ro.ro_id
          ORDER BY
            CASE
              WHEN LOWER(COALESCE(rp.placement_status, '')) = 'approved'
                THEN 0
              WHEN LOWER(COALESCE(rp.placement_status, '')) = 'pending'
                THEN 1
              ELSE 2
            END,
            rp.created_at DESC
          LIMIT 1
        ) placement ON TRUE
        WHERE ${where.join(' AND ')}
      ),
      canonical_history AS (
        SELECT *
        FROM ranked_history
        WHERE history_rank = 1
      )
      SELECT
        st.pdm_id,
        CONCAT(st.last_name, ', ', st.first_name) AS student_name,
        COALESCE(NULLIF(TRIM(st.sex_at_birth), ''), 'Not specified') AS gender,
        ac.course_code,
        st.year_level,
        h.program_name,
        h.benefactor_name,
        CASE
          WHEN MIN(h.start_year) = MAX(h.start_year)
            THEN MIN(h.academic_year)
          ELSE CONCAT(MIN(h.start_year), '-', MAX(h.end_year))
        END AS history_range,
        COUNT(*)::int AS history_records,
        (
          ARRAY_AGG(
            h.history_status
            ORDER BY
              h.start_year DESC,
              h.event_at DESC NULLS LAST
          )
        )[1] AS latest_status,
        STRING_AGG(
          CONCAT(
            h.academic_year,
            ' · ',
            COALESCE(h.semester, 'Semester not set'),
            ' · ',
            h.history_status,
            CASE
              WHEN h.ro_assigned_office IS NOT NULL
                THEN CONCAT(' · RO: ', h.ro_assigned_office)
              ELSE ''
            END
          ),
          ' | '
          ORDER BY
            h.start_year ASC,
            CASE
              WHEN LOWER(COALESCE(h.semester, '')) LIKE '%first%' THEN 1
              WHEN LOWER(COALESCE(h.semester, '')) LIKE '%second%' THEN 2
              WHEN LOWER(COALESCE(h.semester, '')) LIKE '%summer%' THEN 3
              ELSE 4
            END,
            h.event_at ASC NULLS LAST
        ) AS history_summary
      FROM canonical_history h
      JOIN students st
        ON st.student_id = h.student_id
      LEFT JOIN academic_course ac
        ON ac.course_id = st.course_id
      GROUP BY
        st.student_id,
        st.pdm_id,
        st.last_name,
        st.first_name,
        st.sex_at_birth,
        ac.course_code,
        st.year_level,
        h.program_id,
        h.program_name,
        h.benefactor_name
      ORDER BY
        h.program_name ASC NULLS LAST,
        st.last_name ASC,
        st.first_name ASC;
    `;

    const { rows } = await pool.query(query, params);
    return rows;
}

// SMART_PDM_SCHOLARSHIP_HISTORY_REPORT_V1

async function getScholarCountRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
    courseId,
    yearLevel,
    gender,
    dateFrom,
    dateTo,
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

    appendScholarDetailFilters(where, params, { courseId, yearLevel, gender });
    appendDateRange(where, params, 'st.date_awarded', dateFrom, dateTo);

    const isSpecificBenefactor = benefactorId && benefactorId !== 'all';

    const groupBy = isSpecificBenefactor
        ? ['b.benefactor_id', 'b.benefactor_name', 'sp.program_id', 'sp.program_name']
        : ['b.benefactor_id', 'b.benefactor_name'];

    const orderBy = isSpecificBenefactor
        ? 'ORDER BY scholar_count DESC, sp.program_name ASC NULLS LAST'
        : 'ORDER BY scholar_count DESC, b.benefactor_name ASC NULLS LAST';

    const query = `
    SELECT
      b.benefactor_id,
      COALESCE(b.benefactor_name, 'Unassigned Benefactor') AS benefactor_name,
      ${isSpecificBenefactor ? "sp.program_id, COALESCE(sp.program_name, 'Unassigned Program') AS program_name," : ''}
      COUNT(DISTINCT st.student_id)::int AS scholar_count
    FROM students st
    LEFT JOIN scholarship_program sp ON st.current_program_id = sp.program_id
    LEFT JOIN benefactors b ON sp.benefactor_id = b.benefactor_id
    LEFT JOIN academic_years ay ON st.active_academic_year_id = ay.academic_year_id
    LEFT JOIN academic_period ap ON st.active_period_id = ap.period_id
    WHERE ${where.join(' AND ')}
    GROUP BY ${groupBy.join(', ')}
    ${orderBy};
  `;

    const { rows } = await pool.query(query, params);
    return rows;
}

async function getPayoutRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
    courseId,
    yearLevel,
    gender,
    batchStatus,
    releaseStatus,
    paymentMode,
    dateFrom,
    dateTo,
}) {
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

    if (benefactorId && benefactorId !== 'all') {
        params.push(benefactorId);
        where.push(`b.benefactor_id = $${params.length}`);
    }

    appendScholarDetailFilters(where, params, { courseId, yearLevel, gender });
    appendTextEqualityFilter(where, params, 'pb.batch_status', batchStatus);
    appendTextEqualityFilter(where, params, 'pbs.release_status', releaseStatus);
    appendTextEqualityFilter(where, params, 'pb.payment_mode', paymentMode);
    appendDateRange(where, params, 'pb.payout_date', dateFrom, dateTo);

    const query = `
    SELECT
      pb.payout_title,
      sp.program_name,
      ay.label AS academic_year,
      ap.term AS semester,
      pb.payout_date,
      CASE
        WHEN pb.payment_mode = 'Other'
          AND NULLIF(TRIM(pb.payment_mode_other), '') IS NOT NULL
          THEN CONCAT('Other - ', TRIM(pb.payment_mode_other))
        ELSE pb.payment_mode
      END AS payment_mode,
      pb.amount_per_scholar,
      pb.total_amount,
      pb.batch_status,
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name,
      COALESCE(NULLIF(TRIM(st.sex_at_birth), ''), 'Not specified') AS gender,
      pbs.amount_received,
      pbs.release_status,
      pbs.released_at,
      pbs.remarks
    FROM payout_batches pb
    LEFT JOIN scholarship_program sp ON pb.program_id = sp.program_id
    LEFT JOIN benefactors b ON sp.benefactor_id = b.benefactor_id
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

// SMART_PDM_PAYOUT_PROOF_UPLOAD_REPORT_V1
async function getPayoutProofRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
    reviewResult,
    courseId,
    yearLevel,
    dateFrom,
    dateTo,
}) {
    const params = [];
    // Proof uploads are historical records, so completed/archived payout batches
    // must remain visible in this report.
    const where = ['1 = 1'];

    if (academicYearId && academicYearId !== 'all') {
        params.push(academicYearId);
        where.push(`pb.academic_year_id = $${params.length}`);
    }

    if (semester && semester !== 'all') {
        params.push(semester);
        where.push(`period.term = $${params.length}`);
    }

    if (programId && programId !== 'all') {
        params.push(programId);
        where.push(`pb.program_id = $${params.length}`);
    }

    if (benefactorId && benefactorId !== 'all') {
        params.push(benefactorId);
        where.push(`b.benefactor_id = $${params.length}`);
    }

    if (courseId && courseId !== 'all') {
        params.push(courseId);
        where.push(`COALESCE(st.course_id, smr.course_id) = $${params.length}`);
    }

    appendScholarDetailFilters(where, params, { yearLevel });
    appendTextEqualityFilter(where, params, 'pp.proof_status', reviewResult);
    appendDateRange(where, params, 'pp.submitted_at', dateFrom, dateTo);

    const query = `
    SELECT
      st.pdm_id,
      CONCAT(st.last_name, ', ', st.first_name) AS student_name,
      course.course_code,
      st.year_level,
      sp.program_name,
      b.benefactor_name,
      ay.label AS academic_year,
      period.term AS semester,
      pb.payout_title,
      pb.payout_date,
      pbs.amount_received,
      pbs.release_status,
      pp.file_name,
      pp.submitted_at,
      pp.proof_status,
      COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', reviewer_profile.first_name, reviewer_profile.last_name)), ''),
        reviewer.username,
        ''
      ) AS reviewed_by,
      pp.reviewed_at,
      COALESCE(pp.admin_comment, pp.rejection_reason, '') AS review_comment
    FROM payout_proofs pp
    INNER JOIN payout_batch_students pbs ON pbs.payout_entry_id = pp.payout_entry_id
    INNER JOIN payout_batches pb ON pb.payout_batch_id = pp.payout_batch_id
    INNER JOIN students st ON st.student_id = pp.student_id
    LEFT JOIN student_master_records smr ON smr.master_student_id = st.master_student_id
    LEFT JOIN academic_course course ON course.course_id = COALESCE(st.course_id, smr.course_id)
    LEFT JOIN scholarship_program sp ON sp.program_id = pb.program_id
    LEFT JOIN benefactors b ON b.benefactor_id = sp.benefactor_id
    LEFT JOIN academic_years ay ON ay.academic_year_id = pb.academic_year_id
    LEFT JOIN academic_period period ON period.period_id = pb.period_id
    LEFT JOIN users reviewer ON reviewer.user_id = pp.reviewed_by
    LEFT JOIN admin_profiles reviewer_profile ON reviewer_profile.user_id = reviewer.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY pp.submitted_at DESC, st.last_name ASC, st.first_name ASC;
  `;

    const { rows } = await pool.query(query, params);
    return rows;
}

async function getRenewalRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
    reviewResult,
    courseId,
    yearLevel,
    dateFrom,
    dateTo,
}) {
    const params = [];
    const where = [`r.status IN ('Approved', 'Rejected')`];

    if (academicYearId && academicYearId !== 'all') {
        params.push(academicYearId);
        where.push(`COALESCE(r.academic_year_id, renewal_period.academic_year_id) = $${params.length}`);
    }
    if (semester && semester !== 'all') {
        params.push(semester);
        where.push(`renewal_period.term = $${params.length}`);
    }

    if (programId && programId !== 'all') {
        params.push(programId);
        where.push(`r.program_id = $${params.length}`);
    }

    if (benefactorId && benefactorId !== 'all') {
        params.push(benefactorId);
        where.push(`b.benefactor_id = $${params.length}`);
    }

    appendScholarDetailFilters(where, params, { courseId, yearLevel });

    const normalizedStatus = safeText(reviewResult || 'all').toLowerCase();
    if (normalizedStatus === 'approved') {
        where.push(`r.status = 'Approved'`);
    } else if (normalizedStatus === 'rejected') {
        where.push(`r.status = 'Rejected'`);
    } else if (normalizedStatus !== 'all') {
        throw createHttpError(400, 'Invalid scholarship renewal status filter.');
    }

    appendDateRange(
        where,
        params,
        'COALESCE(r.reviewed_at, r.submitted_on, r.updated_at, r.created_at)',
        dateFrom,
        dateTo
    );

    const query = `
      SELECT
        r.renewal_id,
        st.pdm_id,
        CONCAT(st.last_name, ', ', st.first_name, CASE WHEN NULLIF(st.middle_name, '') IS NULL THEN '' ELSE CONCAT(' ', LEFT(st.middle_name, 1), '.') END) AS student_name,
        st.last_name AS _last_name,
        st.first_name AS _given_name,
        CASE WHEN NULLIF(TRIM(st.middle_name), '') IS NULL THEN '' ELSE CONCAT(LEFT(TRIM(st.middle_name), 1), '.') END AS _middle_initial,
        st.gwa AS _gwa,
        sp.program_name,
        b.benefactor_name,
        ac.course_code,
        ac.course_name,
        st.year_level,
        source_year.label AS previous_academic_year,
        source_period.term AS previous_semester,
        renewal_year.label AS applicable_academic_year,
        renewal_period.term AS semester,
        CASE
          WHEN r.status = 'Approved' THEN 'Renewed'
          WHEN r.status = 'Rejected' THEN 'Did Not Renew'
        END AS renewal_status,
        r.reviewed_at AS renewal_date,
        r.submitted_on,
        COALESCE(r.decision_reason, r.flagged_reason) AS remarks
      FROM renewals r
      JOIN students st ON st.student_id = r.student_id
      LEFT JOIN academic_course ac ON ac.course_id = st.course_id
      LEFT JOIN scholarship_program sp ON sp.program_id = r.program_id
      LEFT JOIN benefactors b ON b.benefactor_id = sp.benefactor_id
      LEFT JOIN academic_period renewal_period ON renewal_period.period_id = r.period_id
      LEFT JOIN academic_years renewal_year
        ON renewal_year.academic_year_id = COALESCE(r.academic_year_id, renewal_period.academic_year_id)
      LEFT JOIN applications source_application ON source_application.application_id = r.application_id
      LEFT JOIN program_openings source_opening ON source_opening.opening_id = source_application.opening_id
      LEFT JOIN academic_period source_period ON source_period.period_id = source_opening.period_id
      LEFT JOIN academic_years source_year ON source_year.academic_year_id = source_opening.academic_year_id
      WHERE ${where.join(' AND ')}
      ORDER BY COALESCE(r.reviewed_at, r.submitted_on, r.updated_at, r.created_at) DESC;
    `;

    const { rows } = await pool.query(query, params);
    return rows;
}

async function getSlotUtilizationRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
    reviewResult,
    dateFrom,
    dateTo,
}) {
    const params = [];
    const where = [];

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
        where.push(`po.program_id = $${params.length}`);
    }

    if (benefactorId && benefactorId !== 'all') {
        params.push(benefactorId);
        where.push(`b.benefactor_id = $${params.length}`);
    }

    const normalizedStatus = safeText(reviewResult || 'all').toLowerCase();
    if (normalizedStatus !== 'all') {
        if (!['draft', 'open', 'closed', 'archived'].includes(normalizedStatus)) {
            throw createHttpError(400, 'Invalid scholarship opening status filter.');
        }
        params.push(normalizedStatus);
        where.push(`LOWER(CASE WHEN po.is_archived THEN 'archived' ELSE COALESCE(po.posting_status, 'draft') END) = $${params.length}`);
    }

    // program_openings.created_at is the persisted opening creation date and
    // provides a stable basis for the optional date range.
    appendDateRange(where, params, 'po.created_at', dateFrom, dateTo);

    const query = `
      WITH opening_slot_counts AS (
        SELECT
          po_count.opening_id,
          COUNT(DISTINCT st_active.student_id)::int AS occupied_slots,
          COUNT(DISTINCT st_removed.student_id)::int AS removed_scholars
        FROM program_openings po_count
        LEFT JOIN applications a_active
          ON a_active.opening_id = po_count.opening_id
         AND LOWER(COALESCE(a_active.application_status, '')) = 'approved'
        LEFT JOIN students st_active
          ON st_active.current_application_id = a_active.application_id
         AND st_active.student_id = a_active.student_id
         AND COALESCE(st_active.is_active_scholar, FALSE) = TRUE
         AND LOWER(COALESCE(st_active.scholarship_status, '')) = 'active'
         AND COALESCE(st_active.scholar_is_archived, FALSE) = FALSE
        LEFT JOIN applications a_removed
          ON a_removed.opening_id = po_count.opening_id
         AND LOWER(COALESCE(a_removed.application_status, '')) = 'approved'
        LEFT JOIN students st_removed
          ON st_removed.current_application_id = a_removed.application_id
         AND st_removed.student_id = a_removed.student_id
         AND COALESCE(st_removed.scholar_is_archived, FALSE) = TRUE
         AND LOWER(COALESCE(st_removed.scholarship_status, '')) = 'removed'
        GROUP BY po_count.opening_id
      ), normalized_counts AS (
        SELECT
          po_count.opening_id,
          GREATEST(COALESCE(po_count.allocated_slots, 0), 0)::int AS total_slots,
          LEAST(
            GREATEST(COALESCE(po_count.allocated_slots, 0), 0),
            GREATEST(COALESCE(counts.occupied_slots, 0), 0)
          )::int AS filled_slots,
          GREATEST(
            GREATEST(COALESCE(po_count.allocated_slots, 0), 0) -
            LEAST(
              GREATEST(COALESCE(po_count.allocated_slots, 0), 0),
              GREATEST(COALESCE(counts.occupied_slots, 0), 0)
            ),
            0
          )::int AS available_slots,
          GREATEST(COALESCE(counts.removed_scholars, 0), 0)::int AS removed_scholars
        FROM program_openings po_count
        LEFT JOIN opening_slot_counts counts ON counts.opening_id = po_count.opening_id
      )
      SELECT
        po.opening_id,
        po.opening_title,
        sp.program_name,
        b.benefactor_name,
        ay.label AS academic_year,
        ap.term AS semester,
        counts.total_slots,
        counts.filled_slots,
        counts.available_slots,
        LEAST(counts.available_slots, counts.removed_scholars)::int AS released_slots,
        CASE
          WHEN po.is_archived THEN 'Archived'
          ELSE INITCAP(COALESCE(po.posting_status, 'draft'))
        END AS opening_status,
        po.created_at AS opening_created_at
      FROM program_openings po
      JOIN normalized_counts counts ON counts.opening_id = po.opening_id
      LEFT JOIN scholarship_program sp ON sp.program_id = po.program_id
      LEFT JOIN benefactors b ON b.benefactor_id = sp.benefactor_id
      LEFT JOIN academic_years ay ON ay.academic_year_id = po.academic_year_id
      LEFT JOIN academic_period ap ON ap.period_id = po.period_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ay.start_year DESC NULLS LAST, ap.term ASC NULLS LAST, sp.program_name ASC;
    `;

    const { rows } = await pool.query(query, params);
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
    courseId,
    yearLevel,
    gender,
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

    appendScholarDetailFilters(where, params, { courseId, yearLevel, gender });

    if (normalizedReviewResult && normalizedReviewResult !== 'all') {
        if (normalizedReviewResult === 'pending') {
            where.push(`es.sdo_status IS NULL`);
        } else if (normalizedReviewResult === 'no_offense') {
            where.push(`es.sdo_status IN ('no_offense', 'cleared')`);
        } else if (normalizedReviewResult === 'minor_offense') {
            where.push(`es.sdo_status IN ('minor_offense', 'disqualified_minor')`);
        } else if (normalizedReviewResult === 'major_offense') {
            where.push(`es.sdo_status IN ('major_offense', 'disqualified_major')`);
        } else {
            throw createHttpError(400, 'Invalid SDO endorsement result filter.');
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
      COALESCE(NULLIF(TRIM(st.sex_at_birth), ''), 'Not specified') AS gender,
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
    courseId,
    yearLevel,
    gender,
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

    appendScholarDetailFilters(where, params, { courseId, yearLevel, gender });

    if (normalizedReviewResult && normalizedReviewResult !== 'all') {
        if (normalizedReviewResult === 'pending') {
            where.push(`es.guidance_status IS NULL`);
        } else if (normalizedReviewResult === 'good_moral_standing') {
            where.push(`es.guidance_status IN ('good_moral_standing', 'cleared')`);
        } else {
            throw createHttpError(400, 'Invalid Guidance endorsement result filter.');
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
      COALESCE(NULLIF(TRIM(st.sex_at_birth), ''), 'Not specified') AS gender,
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
    pdUserId,
    consolidated = false,
    courseId,
    yearLevel,
    gender,
}) {
    const params = [];
    const where = [`COALESCE(a.is_archived, FALSE) = FALSE`];

    const normalizedReviewResult = safeText(reviewResult || 'all').toLowerCase();
    const normalizedDateFrom = safeText(dateFrom || '');
    const normalizedDateTo = safeText(dateTo || '');

    if (pdUserId) {
        params.push(pdUserId);
        where.push(`EXISTS (
          SELECT 1 FROM program_director_course_assignments assignment
          WHERE assignment.pd_user_id = $${params.length}
            AND assignment.course_id = st.course_id
            AND assignment.is_active = true
        )`);
    }

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

    appendScholarDetailFilters(where, params, { courseId, yearLevel, gender });

    if (normalizedReviewResult && normalizedReviewResult !== 'all') {
        if (consolidated && normalizedReviewResult === 'pending') {
            where.push(`es.overall_status IN ('pending_sdo', 'pending_guidance', 'pending_pd')`);
        } else if (consolidated && normalizedReviewResult === 'major_offense') {
            where.push(`(es.overall_status = 'disqualified_major' OR es.sdo_status IN ('major_offense', 'disqualified_major'))`);
        } else if (consolidated && normalizedReviewResult === 'completed') {
            where.push(`es.overall_status = 'completed'`);
        } else if (consolidated) {
            throw createHttpError(400, 'Invalid consolidated endorsement result filter.');
        } else if (normalizedReviewResult === 'pending') {
            where.push(`es.pd_status IS NULL AND es.current_stage = 'pending_pd'`);
        } else if (normalizedReviewResult === 'completed') {
            where.push(`es.overall_status = 'completed'`);
        } else if (normalizedReviewResult === 'good_scholastic_standing') {
            where.push(`es.pd_status = 'good_scholastic_standing'`);
        } else if (normalizedReviewResult === 'average_scholastic_standing') {
            where.push(`es.pd_status = 'average_scholastic_standing'`);
        } else {
            throw createHttpError(400, 'Invalid Program Director endorsement result filter.');
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
      COALESCE(NULLIF(TRIM(st.sex_at_birth), ''), 'Not specified') AS gender,
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


async function getRoRows({
    academicYearId,
    semester,
    programId,
    reviewResult,
    dateFrom,
    dateTo,
    roUserId,
    courseId,
    yearLevel,
    gender,
    roAreaId,
    applicationStatus,
    documentStatus,
    verificationStatus,
    batchStatus,
    releaseStatus,
    paymentMode,
}) {
    if (!roUserId) {
        throw createHttpError(403, 'RO Personnel-In-Charge assignment is required for this report.');
    }

    const params = [roUserId];
    const where = [
        `rac.user_id = $1`,
        `rac.is_active = TRUE`,
        `rd.is_active = TRUE`,
    ];

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
        where.push(`ro.program_id = $${params.length}`);
    }

    appendScholarDetailFilters(where, params, { courseId, yearLevel, gender });

    if (roAreaId && roAreaId !== 'all') {
        params.push(roAreaId);
        where.push(`rp.ro_area_id = $${params.length}`);
    }

    const normalizedReviewResult = safeText(reviewResult || 'all').toLowerCase();
    if (normalizedReviewResult && normalizedReviewResult !== 'all') {
        if (normalizedReviewResult === 'pending_validation') {
            where.push(`EXISTS (
                SELECT 1
                FROM ro_time_logs rtl_pending
                WHERE rtl_pending.ro_id = ro.ro_id
                  AND rtl_pending.log_status = 'Timed Out'
                  AND COALESCE(rtl_pending.department_validation_status, 'Pending') = 'Pending'
            )`);
        } else if (normalizedReviewResult === 'assigned') {
            where.push(`rp.placement_status = 'Approved'`);
        } else if (normalizedReviewResult === 'completed') {
            where.push(`COALESCE(ro.ro_status, '') = 'Cleared'`);
        } else {
            throw createHttpError(400, 'Invalid RO report status filter.');
        }
    }

    appendDateRange(
        where,
        params,
        `COALESCE(rp.decided_at, rp.requested_at, rp.created_at)`,
        safeText(dateFrom || ''),
        safeText(dateTo || '')
    );

    const query = `
      SELECT
        ro.ro_id,
        st.pdm_id,
        CONCAT(st.last_name, ', ', st.first_name) AS student_name,
        COALESCE(NULLIF(TRIM(st.sex_at_birth), ''), 'Not specified') AS gender,
        ac.course_code,
        st.year_level,
        sp.program_name,
        po.opening_title,
        ay.label AS academic_year,
        ap.term AS semester,
        rd.department_name AS ro_area,
        rp.placement_status,
        rp.requested_at,
        rp.decided_at,
        ro.required_hours,
        ROUND(COALESCE(ro.submitted_minutes, 0)::numeric / 60, 2) AS submitted_hours,
        ROUND(COALESCE(ro.validated_minutes, 0)::numeric / 60, 2) AS validated_hours,
        ro.progress_status,
        ro.assignment_status,
        ro.ro_status,
        COALESCE((
          SELECT COUNT(*)
          FROM ro_time_logs rtl
          WHERE rtl.ro_id = ro.ro_id
            AND rtl.log_status = 'Timed Out'
            AND COALESCE(rtl.department_validation_status, 'Pending') = 'Pending'
        ), 0)::int AS pending_validation_count
      FROM ro_placements rp
      JOIN return_of_obligations ro ON ro.ro_id = rp.ro_id
      JOIN ro_area_coordinators rac
        ON rac.coordinator_assignment_id = rp.coordinator_assignment_id
      JOIN ro_departments rd ON rd.department_id = rp.ro_area_id
      JOIN students st ON st.student_id = ro.student_id
      LEFT JOIN academic_course ac ON ac.course_id = st.course_id
      LEFT JOIN scholarship_program sp ON sp.program_id = ro.program_id
      LEFT JOIN program_openings po ON po.opening_id = ro.opening_id
      LEFT JOIN academic_years ay ON ay.academic_year_id = po.academic_year_id
      LEFT JOIN academic_period ap ON ap.period_id = po.period_id
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE WHEN rp.placement_status = 'Approved' THEN 0 ELSE 1 END,
        COALESCE(rp.decided_at, rp.requested_at, rp.created_at) ASC;
    `;

    const { rows } = await pool.query(query, params);
    return rows;
}

async function getRoComplianceRows({
    academicYearId,
    semester,
    programId,
    benefactorId,
    reviewResult,
    courseId,
    yearLevel,
    gender,
    roAreaId,
    dateFrom,
    dateTo,
}) {
    const params = [];
    const where = [
        `EXISTS (
            SELECT 1
            FROM ro_placements rp_assigned
            WHERE rp_assigned.ro_id = ro.ro_id
              AND rp_assigned.placement_status = 'Approved'
        )`,
    ];

    if (academicYearId && academicYearId !== 'all') {
        params.push(academicYearId);
        where.push(`COALESCE(ro.academic_year_id, po.academic_year_id) = $${params.length}`);
    }

    if (semester && semester !== 'all') {
        params.push(semester);
        where.push(`COALESCE(ro_period.term, opening_period.term) = $${params.length}`);
    }

    if (programId && programId !== 'all') {
        params.push(programId);
        where.push(`ro.program_id = $${params.length}`);
    }

    if (benefactorId && benefactorId !== 'all') {
        params.push(benefactorId);
        where.push(`b.benefactor_id = $${params.length}`);
    }

    if (courseId && courseId !== 'all') {
        params.push(courseId);
        where.push(`COALESCE(st.course_id, smr.course_id) = $${params.length}`);
    }

    if (yearLevel && yearLevel !== 'all') {
        params.push(yearLevel);
        where.push(`st.year_level::text = $${params.length}`);
    }

    if (gender && gender !== 'all') {
        params.push(gender);
        where.push(`LOWER(TRIM(COALESCE(st.sex_at_birth, smr.sex_at_birth, ''))) = LOWER(TRIM($${params.length}))`);
    }

    if (roAreaId && roAreaId !== 'all') {
        params.push(roAreaId);
        where.push(`EXISTS (
            SELECT 1
            FROM ro_placements rp_area
            WHERE rp_area.ro_id = ro.ro_id
              AND rp_area.placement_status = 'Approved'
              AND rp_area.ro_area_id = $${params.length}
        )`);
    }

    const normalizedCompliance = safeText(reviewResult || 'all').toLowerCase();
    const finishedExpression = `(
        COALESCE(ro.ro_status, '') = 'Cleared'
        OR (
          COALESCE(ro.required_hours, 0) > 0
          AND COALESCE(ro.validated_minutes, 0) >= COALESCE(ro.required_hours, 0) * 60
        )
    )`;

    if (normalizedCompliance === 'finished') {
        where.push(finishedExpression);
    } else if (normalizedCompliance === 'not_fully_complied') {
        where.push(`NOT ${finishedExpression}`);
    } else if (normalizedCompliance !== 'all') {
        throw createHttpError(400, 'Invalid RO compliance status filter.');
    }

    appendDateRange(
        where,
        params,
        `COALESCE(ro.assigned_at, ro.created_at)`,
        safeText(dateFrom || ''),
        safeText(dateTo || '')
    );

    const query = `
      SELECT
        ro.ro_id,
        st.pdm_id,
        CONCAT(st.last_name, ', ', st.first_name, CASE WHEN NULLIF(st.middle_name, '') IS NULL THEN '' ELSE CONCAT(' ', LEFT(st.middle_name, 1), '.') END) AS student_name,
        COALESCE(u.email, st.email_address) AS email_address,
        COALESCE(st.phone_number, u.phone_number) AS phone_number,
        COALESCE(NULLIF(TRIM(st.sex_at_birth), ''), NULLIF(TRIM(smr.sex_at_birth), ''), 'Not specified') AS gender,
        ac.course_code,
        ac.course_name,
        st.year_level,
        sp.program_name,
        b.benefactor_name,
        COALESCE(ay.label, CONCAT(ay.start_year, '-', ay.end_year)) AS academic_year,
        COALESCE(ro_period.term, opening_period.term) AS semester,
        placement_details.assigned_areas,
        placement_details.personnel_in_charge,
        ro.required_hours,
        ROUND(COALESCE(ro.submitted_minutes, 0)::numeric / 60, 2) AS submitted_hours,
        ROUND(COALESCE(ro.validated_minutes, 0)::numeric / 60, 2) AS validated_hours,
        ROUND(GREATEST(COALESCE(ro.required_hours, 0) * 60 - COALESCE(ro.validated_minutes, 0), 0)::numeric / 60, 2) AS remaining_hours,
        CASE
          WHEN COALESCE(ro.required_hours, 0) <= 0 THEN 0
          ELSE LEAST(100, ROUND(COALESCE(ro.validated_minutes, 0)::numeric * 100 / (ro.required_hours * 60), 1))
        END AS completion_percentage,
        CASE WHEN ${finishedExpression} THEN 'Finished' ELSE 'Not Fully Complied' END AS compliance_status,
        ro.progress_status,
        ro.assignment_status,
        ro.ro_status AS clearance_status,
        COALESCE((
          SELECT COUNT(*)
          FROM ro_time_logs rtl
          WHERE rtl.ro_id = ro.ro_id
            AND rtl.log_status = 'Timed Out'
            AND COALESCE(rtl.department_validation_status, 'Pending') = 'Pending'
        ), 0)::int AS pending_validation_count,
        placement_details.assigned_at,
        ro.cleared_at
      FROM return_of_obligations ro
      JOIN students st ON st.student_id = ro.student_id
      LEFT JOIN users u ON u.user_id = st.user_id
      LEFT JOIN student_master_records smr ON smr.master_student_id = st.master_student_id
      LEFT JOIN academic_course ac ON ac.course_id = COALESCE(st.course_id, smr.course_id)
      LEFT JOIN scholarship_program sp ON sp.program_id = ro.program_id
      LEFT JOIN benefactors b ON b.benefactor_id = sp.benefactor_id
      LEFT JOIN program_openings po ON po.opening_id = ro.opening_id
      LEFT JOIN academic_period opening_period ON opening_period.period_id = po.period_id
      LEFT JOIN academic_period ro_period ON ro_period.period_id = ro.period_id
      LEFT JOIN academic_years ay ON ay.academic_year_id = COALESCE(ro.academic_year_id, po.academic_year_id)
      JOIN LATERAL (
        SELECT
          STRING_AGG(DISTINCT rd.department_name, ', ' ORDER BY rd.department_name) AS assigned_areas,
          STRING_AGG(
            DISTINCT NULLIF(TRIM(CONCAT_WS(' ', pic.first_name, pic.last_name)), ''),
            ', '
          ) AS personnel_in_charge,
          MIN(COALESCE(rp.decided_at, rp.requested_at, rp.created_at)) AS assigned_at
        FROM ro_placements rp
        JOIN ro_departments rd ON rd.department_id = rp.ro_area_id
        LEFT JOIN ro_area_coordinators rac
          ON rac.coordinator_assignment_id = rp.coordinator_assignment_id
        LEFT JOIN admin_profiles pic ON pic.user_id = rac.user_id
        WHERE rp.ro_id = ro.ro_id
          AND rp.placement_status = 'Approved'
      ) placement_details ON placement_details.assigned_areas IS NOT NULL
      WHERE ${where.join(' AND ')}
      ORDER BY
        CASE WHEN ${finishedExpression} THEN 0 ELSE 1 END,
        st.last_name ASC,
        st.first_name ASC;
    `;

    const { rows } = await pool.query(query, params);
    return rows;
}

function addRows(sheet, rows, columns = sheet.columns || []) {
    const keys = columns.map((column) => String(column.key || '')).filter(Boolean);

    rows.forEach((row, index) => {
        const normalizedRow = {};
        keys.forEach((key) => {
            const rawValue = key === 'row_number' ? index + 1 : row?.[key];
            normalizedRow[key] = normalizeReportDisplayValue(key, rawValue);
        });
        sheet.addRow(normalizedRow);
    });
}

function styleInstitutionalTable(sheet, { headerRow, dataStartRow }) {
    const lastRow = sheet.lastRow?.number || headerRow;
    const lastColumn = Math.max(1, sheet.columnCount);
    const header = sheet.getRow(headerRow);
    header.font = { bold: true, color: { argb: 'FF111111' }, size: 9 };
    header.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' },
    };
    header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    header.height = Math.max(header.height || 0, 28);

    for (let rowNumber = headerRow; rowNumber <= lastRow; rowNumber += 1) {
        const row = sheet.getRow(rowNumber);
        for (let columnNumber = 1; columnNumber <= lastColumn; columnNumber += 1) {
            const cell = row.getCell(columnNumber);
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF333333' } },
                left: { style: 'thin', color: { argb: 'FF333333' } },
                bottom: { style: 'thin', color: { argb: 'FF333333' } },
                right: { style: 'thin', color: { argb: 'FF333333' } },
            };
            if (rowNumber >= dataStartRow) {
                cell.font = { ...(cell.font || {}), size: 9 };
                cell.alignment = {
                    ...(cell.alignment || {}),
                    vertical: 'middle',
                    wrapText: true,
                };
            }
        }
    }
}

function buildOfficeSummary(reportType, rows = []) {
    const summary = {
        total: rows.length,
        pending: 0,
        completed: 0,
    };

    if (reportType === 'sdo') {
        summary.noOffense = 0;
        summary.minor = 0;
        summary.major = 0;

        rows.forEach((row) => {
            const status = safeText(row.sdo_status).toLowerCase();
            if (!status) summary.pending += 1;
            if (['no_offense', 'cleared'].includes(status)) summary.noOffense += 1;
            if (['minor_offense', 'disqualified_minor'].includes(status)) summary.minor += 1;
            if (['major_offense', 'disqualified_major'].includes(status)) summary.major += 1;
            if (safeText(row.overall_status).toLowerCase() === 'completed') {
                summary.completed += 1;
            }
        });
    }

    if (reportType === 'guidance') {
        summary.goodMoral = 0;

        rows.forEach((row) => {
            const status = safeText(row.guidance_status).toLowerCase();
            if (!status && safeText(row.current_stage).toLowerCase() === 'pending_guidance') {
                summary.pending += 1;
            }
            if (['good_moral_standing', 'cleared'].includes(status)) summary.goodMoral += 1;
            if (safeText(row.overall_status).toLowerCase() === 'completed') {
                summary.completed += 1;
            }
        });
    }

    if (reportType === 'pd') {
        summary.goodStanding = 0;
        summary.averageStanding = 0;
        summary.legacyApproved = 0;

        rows.forEach((row) => {
            const status = safeText(row.pd_status).toLowerCase();
            if (!status && safeText(row.current_stage).toLowerCase() === 'pending_pd') {
                summary.pending += 1;
            }
            if (status === 'good_scholastic_standing') summary.goodStanding += 1;
            if (status === 'average_scholastic_standing') summary.averageStanding += 1;
            // Historical approved rows cannot be truthfully classified as Good or Average.
            if (status === 'approved') summary.legacyApproved += 1;
            if (safeText(row.overall_status).toLowerCase() === 'completed') {
                summary.completed += 1;
            }
        });
    }

    if (reportType === 'ro') {
        summary.pendingValidation = 0;
        summary.assignedScholars = rows.length;
        summary.cleared = 0;

        rows.forEach((row) => {
            summary.pendingValidation += Number(row.pending_validation_count || 0);
            if (safeText(row.ro_status).toLowerCase() === 'cleared') summary.cleared += 1;
        });
    }

    if (reportType === 'ro_compliance') {
        summary.finished = 0;
        summary.notFullyComplied = 0;
        summary.pendingValidation = 0;

        rows.forEach((row) => {
            if (safeText(row.compliance_status).toLowerCase() === 'finished') {
                summary.finished += 1;
            } else {
                summary.notFullyComplied += 1;
            }
            summary.pendingValidation += Number(row.pending_validation_count || 0);
        });
        summary.completed = summary.finished;
        summary.pending = summary.notFullyComplied;
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
    pdUserId,
    roUserId,
    courseId,
    yearLevel,
    gender,
    roAreaId,
    applicationStatus,
    documentStatus,
    verificationStatus,
    batchStatus,
    releaseStatus,
    paymentMode,
    academicYearFromId,
    academicYearToId,
}) {
    const sharedFilters = {
        academicYearId,
        semester,
        programId,
        benefactorId,
        reviewResult,
        dateFrom,
        dateTo,
        pdUserId,
        roUserId,
        courseId,
        yearLevel,
        gender,
        roAreaId,
        applicationStatus,
        documentStatus,
        verificationStatus,
        batchStatus,
        releaseStatus,
        paymentMode,
        academicYearFromId,
        academicYearToId,
    };

    if (reportType === 'applications') {
        return await getApplicationsRows(sharedFilters);
    }

    if (reportType === 'scholars') {
        return await getScholarsRows(sharedFilters);
    }

    if (reportType === 'scholarship_history') {
        return await getScholarshipHistoryRows(sharedFilters);
    }

    if (reportType === 'payouts') {
        return await getPayoutRows(sharedFilters);
    }
    if (reportType === 'payout_proofs') {
        return await getPayoutProofRows(sharedFilters);
    }
    if (reportType === 'renewals') {
        return await getRenewalRows(sharedFilters);
    }

    if (reportType === 'slot_utilization') {
        return await getSlotUtilizationRows(sharedFilters);
    }


    if (reportType === 'scholars_by_benefactor') {
        return await getScholarCountRows(sharedFilters);
    }

    if (reportType === 'sdo') {
        return await getSdoRows(sharedFilters);
    }

    if (reportType === 'guidance') {
        return await getGuidanceRows(sharedFilters);
    }

    if (reportType === 'pd') {
        return await getPdRows(sharedFilters);
    }

    if (reportType === 'ro') {
        return await getRoRows(sharedFilters);
    }


    if (reportType === 'ro_compliance') {
        return await getRoComplianceRows(sharedFilters);
    }

    if (reportType === 'endorsements') {
        return await getPdRows({
            ...sharedFilters,
            consolidated: true,
        });
    }

    throw createHttpError(400, 'Invalid report type.');
}

function normalizeReportQuery(query = {}) {
    const normalized = {
        reportType: normalizeReportType(query.reportType || query.type),
        academicYearId: safeText(query.academicYearId || query.academic_year_id || 'all'),
        semester: safeText(query.semester || 'all'),
        programId: safeText(query.programId || query.program_id || 'all'),
        benefactorId: safeText(query.benefactorId || query.benefactor_id || 'all'),
        reviewResult: safeText(query.reviewResult || query.review_result || 'all'),
        dateFrom: normalizeDate(query.dateFrom || query.date_from || '', 'dateFrom'),
        dateTo: normalizeDate(query.dateTo || query.date_to || '', 'dateTo'),
        pdUserId: safeText(query.pdUserId || ''),
        roUserId: safeText(query.roUserId || ''),
        courseId: safeText(query.courseId || query.course_id || 'all'),
        yearLevel: safeText(query.yearLevel || query.year_level || 'all'),
        gender: safeText(query.gender || 'all'),
        roAreaId: safeText(query.roAreaId || query.ro_area_id || 'all'),
        applicationStatus: safeText(query.applicationStatus || query.application_status || 'all'),
        documentStatus: safeText(query.documentStatus || query.document_status || 'all'),
        verificationStatus: safeText(query.verificationStatus || query.verification_status || 'all'),
        batchStatus: safeText(query.batchStatus || query.batch_status || 'all'),
        releaseStatus: safeText(query.releaseStatus || query.release_status || 'all'),
        paymentMode: safeText(query.paymentMode || query.payment_mode || 'all'),
        academicYearFromId: safeText(
            query.academicYearFromId ||
            query.academic_year_from_id ||
            'all'
        ),
        academicYearToId: safeText(
            query.academicYearToId ||
            query.academic_year_to_id ||
            'all'
        ),
    };

    if (normalized.dateFrom && normalized.dateTo && normalized.dateFrom > normalized.dateTo) {
        throw createHttpError(400, 'dateFrom cannot be later than dateTo.');
    }

    return normalized;
}

async function previewReport(query = {}) {
    const normalized = normalizeReportQuery(query);
    const rows = await getRowsByReportType(normalized);

    const previewResult = {
        reportType: normalized.reportType,
        total: rows.length,
        rows: rows.slice(0, 50).map(stripInternalReportFields),
        summary: ['sdo', 'guidance', 'pd', 'ro', 'ro_compliance'].includes(normalized.reportType)
            ? buildOfficeSummary(normalized.reportType, rows)
            : null,
    };

    if (normalized.reportType === 'scholars_by_benefactor') {
        previewResult.total = rows.reduce(
            (sum, row) => sum + Number(row.scholar_count || 0),
            0
        );
    }



    if (normalized.reportType === 'endorsements') {
        const completed = rows.filter(
            (row) => safeText(row.overall_status).toLowerCase() === 'completed'
        ).length;
        const stopped = rows.filter((row) => {
            const overall = safeText(row.overall_status).toLowerCase();
            const sdo = safeText(row.sdo_status).toLowerCase();
            return overall === 'disqualified_major' || ['major_offense', 'disqualified_major'].includes(sdo);
        }).length;
        const pending = rows.filter((row) =>
            ['pending_sdo', 'pending_guidance', 'pending_pd'].includes(
                safeText(row.overall_status).toLowerCase()
            )
        ).length;
        previewResult.summary = {
            total: rows.length,
            pending,
            completed,
            stopped,
        };
    }

    return previewResult;
}

async function buildExportDefinition(normalized) {
    let rows = [];
    let columns = [];
    let sheetName = 'Report';
    let filename = 'report.xlsx';
    let institutional = null;

    if (normalized.reportType === 'applications') {
        rows = await getApplicationsRows(normalized);
        sheetName = 'Applications';
        filename = 'application_registry_report.xlsx';
        columns = [
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Gender', key: 'gender' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year Level', key: 'year_level' },
            { header: 'GWA', key: 'gwa' },
            { header: 'Email Address', key: 'email_address' },
            { header: 'Mobile Number', key: 'phone_number' },
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
    } else if (normalized.reportType === 'scholars') {
        rows = await getScholarsRows(normalized);
        sheetName = 'Active Scholars';
        filename = 'active_scholars_master_list.xlsx';
        columns = [
            { header: 'No.', key: 'row_number' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Last Name', key: '_last_name' },
            { header: 'Given Name', key: '_given_name' },
            { header: 'MI', key: '_middle_initial' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year', key: 'year_level' },
            { header: 'Gender', key: 'gender' },
            { header: 'Scholarship Program', key: 'program_name' },
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Scholarship Status', key: 'scholarship_status' },
            { header: 'RO Status', key: 'ro_status' },
            { header: 'Date Awarded', key: 'date_awarded' },
        ];
        institutional = {
            title: 'FINANCIAL ASSISTANCE BENEFICIARIES',
            subtitle: formatExcelPeriodSubtitle(normalized, rows),
            headerRow: 11,
            dataStartRow: 12,
        };
    } else if (normalized.reportType === 'scholarship_history') {
        rows = await getScholarshipHistoryRows(normalized);
        sheetName = 'Program History';
        filename = 'scholarship_program_history_report.xlsx';
        columns = [
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Gender', key: 'gender' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year Level', key: 'year_level' },
            { header: 'Scholarship Program', key: 'program_name' },
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'History Range', key: 'history_range' },
            { header: 'History Records', key: 'history_records' },
            { header: 'Latest Status', key: 'latest_status' },
            { header: 'History', key: 'history_summary' },
        ];
    } else if (normalized.reportType === 'scholars_by_benefactor') {
        rows = await getScholarCountRows(normalized);
        sheetName = 'Scholar Counts';
        filename = 'scholar_count_by_benefactor_report.xlsx';
        columns = [
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'Program', key: 'program_name' },
            { header: 'Scholar Count', key: 'scholar_count' },
        ];
    } else if (normalized.reportType === 'payouts') {
        rows = await getPayoutRows(normalized);
        sheetName = 'Payouts';
        filename = 'payout_batch_report.xlsx';
        columns = [
            { header: 'Payout Title', key: 'payout_title' },
            { header: 'Program', key: 'program_name' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Payout Date', key: 'payout_date' },
            { header: 'Payout Mode', key: 'payment_mode' },
            { header: 'Amount Per Scholar', key: 'amount_per_scholar' },
            { header: 'Batch Total', key: 'total_amount' },
            { header: 'Batch Status', key: 'batch_status' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Gender', key: 'gender' },
            { header: 'Amount Received', key: 'amount_received' },
            { header: 'Release Status', key: 'release_status' },
            { header: 'Released At', key: 'released_at' },
            { header: 'Remarks', key: 'remarks' },
        ];
    } else if (normalized.reportType === 'payout_proofs') {
        rows = await getPayoutProofRows(normalized);
        sheetName = 'Payout Proof Uploads';
        filename = 'payout_proof_upload_report.xlsx';
        columns = [
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year Level', key: 'year_level' },
            { header: 'Scholarship Program', key: 'program_name' },
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Payout Title', key: 'payout_title' },
            { header: 'Payout Date', key: 'payout_date' },
            { header: 'Amount Received', key: 'amount_received' },
            { header: 'Release Status', key: 'release_status' },
            { header: 'Proof File', key: 'file_name' },
            { header: 'Uploaded At', key: 'submitted_at' },
            { header: 'Proof Status', key: 'proof_status' },
            { header: 'Reviewed By', key: 'reviewed_by' },
            { header: 'Reviewed At', key: 'reviewed_at' },
            { header: 'Review Comment', key: 'review_comment' },
        ];
    } else if (normalized.reportType === 'renewals') {
        rows = await getRenewalRows(normalized);
        sheetName = 'Scholarship Renewals';
        filename = 'scholarship_renewal_report.xlsx';
        const selectedBenefactor = normalized.benefactorId !== 'all'
            ? safeText(rows.find((row) => safeText(row.benefactor_name))?.benefactor_name)
            : '';
        const titleSuffix = selectedBenefactor ? ` OF ${selectedBenefactor.toUpperCase()}` : '';
        columns = [
            { header: 'No.', key: 'row_number' },
            { header: 'Last Name', key: '_last_name' },
            { header: 'Given Name', key: '_given_name' },
            { header: 'MI', key: '_middle_initial' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year', key: 'year_level' },
            { header: 'GWA', key: '_gwa' },
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'Scholarship Program', key: 'program_name' },
            { header: 'Academic Year', key: 'applicable_academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Renewal Status', key: 'renewal_status' },
            { header: 'Renewal Date', key: 'renewal_date' },
            { header: 'Remarks', key: 'remarks' },
        ];
        institutional = {
            title: `STATUS AND RECOMMENDED FINANCIAL ASSISTANCE BENEFICIARIES${titleSuffix}`,
            subtitle: formatExcelPeriodSubtitle(normalized, rows),
            headerRow: 11,
            dataStartRow: 13,
            sectionLabel: 'FOR RENEWAL',
        };
    } else if (normalized.reportType === 'slot_utilization') {
        rows = await getSlotUtilizationRows(normalized);
        sheetName = 'Scholarship Slots';
        filename = 'scholarship_slot_report.xlsx';
        columns = [
            { header: 'Opening ID', key: 'opening_id' },
            { header: 'Opening', key: 'opening_title' },
            { header: 'Scholarship Program', key: 'program_name' },
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Total Slots', key: 'total_slots' },
            { header: 'Filled Slots', key: 'filled_slots' },
            { header: 'Available Slots', key: 'available_slots' },
            { header: 'Released Slots', key: 'released_slots' },
            { header: 'Opening Status', key: 'opening_status' },
            { header: 'Opening Created At', key: 'opening_created_at' },
        ];
    } else if (normalized.reportType === 'sdo') {
        rows = await getSdoRows(normalized);
        sheetName = 'SDO Endorsements';
        filename = 'sdo_endorsement_report.xlsx';
        columns = [
            { header: 'Slip ID', key: 'slip_id' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Gender', key: 'gender' },
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
            { header: 'SDO Remarks', key: 'sdo_remarks' },
            { header: 'Reviewed By', key: 'reviewed_by' },
            { header: 'Reviewed At', key: 'sdo_acted_at' },
            { header: 'Submitted At', key: 'submission_date' },
        ];
    } else if (normalized.reportType === 'guidance') {
        rows = await getGuidanceRows(normalized);
        sheetName = 'Guidance Endorsements';
        filename = 'guidance_endorsement_report.xlsx';
        columns = [
            { header: 'Slip ID', key: 'slip_id' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Gender', key: 'gender' },
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
            { header: 'Guidance Remarks', key: 'guidance_remarks' },
            { header: 'Reviewed By', key: 'reviewed_by' },
            { header: 'Reviewed At', key: 'guidance_acted_at' },
            { header: 'Submitted At', key: 'submission_date' },
        ];
    } else if (normalized.reportType === 'pd') {
        rows = await getPdRows(normalized);
        sheetName = 'PD Endorsements';
        filename = 'pd_endorsement_report.xlsx';
        columns = [
            { header: 'Slip ID', key: 'slip_id' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Gender', key: 'gender' },
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
    } else if (normalized.reportType === 'ro') {
        rows = await getRoRows(normalized);
        sheetName = 'RO Personnel-In-Charge';
        filename = 'ro_coordinator_report.xlsx';
        columns = [
            { header: 'RO ID', key: 'ro_id' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Gender', key: 'gender' },
            { header: 'Course', key: 'course_code' },
            { header: 'Year Level', key: 'year_level' },
            { header: 'Program', key: 'program_name' },
            { header: 'Opening', key: 'opening_title' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'RO Area', key: 'ro_area' },
            { header: 'Placement Status', key: 'placement_status' },
            { header: 'Required Hours', key: 'required_hours' },
            { header: 'Submitted Hours', key: 'submitted_hours' },
            { header: 'Validated Hours', key: 'validated_hours' },
            { header: 'Pending Validation', key: 'pending_validation_count' },
            { header: 'Progress Status', key: 'progress_status' },
            { header: 'Assignment Status', key: 'assignment_status' },
            { header: 'RO Status', key: 'ro_status' },
            { header: 'Requested At', key: 'requested_at' },
            { header: 'Decided At', key: 'decided_at' },
        ];
    } else if (normalized.reportType === 'ro_compliance') {
        rows = await getRoComplianceRows(normalized);
        sheetName = 'RO Scholar Compliance';
        filename = 'ro_scholar_compliance_report.xlsx';
        columns = [
            { header: 'RO ID', key: 'ro_id' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Email', key: 'email_address' },
            { header: 'Mobile Number', key: 'phone_number' },
            { header: 'Gender', key: 'gender' },
            { header: 'Course', key: 'course_code' },
            { header: 'Course Name', key: 'course_name' },
            { header: 'Year Level', key: 'year_level' },
            { header: 'Scholarship Program', key: 'program_name' },
            { header: 'Benefactor', key: 'benefactor_name' },
            { header: 'Academic Year', key: 'academic_year' },
            { header: 'Semester', key: 'semester' },
            { header: 'Assigned RO Area', key: 'assigned_areas' },
            { header: 'PIC Name', key: 'personnel_in_charge' },
            { header: 'Required Hours', key: 'required_hours' },
            { header: 'Submitted Hours', key: 'submitted_hours' },
            { header: 'Validated Hours', key: 'validated_hours' },
            { header: 'Remaining Hours', key: 'remaining_hours' },
            { header: 'Completion %', key: 'completion_percentage' },
            { header: 'Compliance Status', key: 'compliance_status' },
            { header: 'Progress Status', key: 'progress_status' },
            { header: 'Assignment Status', key: 'assignment_status' },
            { header: 'Clearance Status', key: 'clearance_status' },
            { header: 'Pending Validation', key: 'pending_validation_count' },
            { header: 'Assigned At', key: 'assigned_at' },
            { header: 'Cleared At', key: 'cleared_at' },
        ];
    } else if (normalized.reportType === 'endorsements') {
        rows = await getPdRows({ ...normalized, consolidated: true });
        sheetName = 'Endorsements';
        filename = 'endorsement_report.xlsx';
        columns = [
            { header: 'Slip ID', key: 'slip_id' },
            { header: 'Student Number', key: 'pdm_id' },
            { header: 'Student Name', key: 'student_name' },
            { header: 'Gender', key: 'gender' },
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
            { header: 'PD Reviewed By', key: 'reviewed_by' },
            { header: 'PD Reviewed At', key: 'pd_acted_at' },
            { header: 'Completed At', key: 'completed_at' },
            { header: 'Final PDF URL', key: 'final_pdf_url' },
            { header: 'Submitted At', key: 'submission_date' },
        ];
    } else {
        throw createHttpError(400, 'Invalid report type.');
    }

    if (!institutional) {
        institutional = {
            title: getInstitutionalReportTitle(normalized.reportType),
            subtitle: formatExcelPeriodSubtitle(normalized, rows),
            headerRow: 11,
            dataStartRow: 12,
            autoFilter: true,
        };
    }

    return { rows, columns, sheetName, filename, institutional };
}

async function generateExcelReport(query = {}) {
    const normalized = normalizeReportQuery(query);
    const definition = await buildExportDefinition(normalized);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SMaRT-PDM';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(definition.sheetName);
    sheet.columns = definition.columns;
    addRows(sheet, definition.rows || [], definition.columns);

    if (definition.institutional) {
        // The base table is created at row 1, then shifted to preserve the exact
        // PDM-style institutional header area shown in the existing OSFA sheets.
        sheet.spliceRows(1, 0, ...Array.from({ length: 10 }, () => []));
        if (definition.institutional.sectionLabel) {
            sheet.spliceRows(12, 0, []);
        }

        addInstitutionalWorksheetHeader(workbook, sheet, {
            ...definition.institutional,
            lastColumn: sheet.getColumn(definition.columns.length).letter,
        });
        styleSheet(sheet, {
            headerRow: definition.institutional.headerRow,
            dataStartRow: definition.institutional.dataStartRow,
            freezeRow: 0,
            alternateRows: false,
            institutional: true,
        });
        styleInstitutionalTable(sheet, {
            headerRow: definition.institutional.headerRow,
            dataStartRow: definition.institutional.dataStartRow,
        });
        if (definition.institutional.autoFilter) {
            sheet.autoFilter = {
                from: { row: definition.institutional.headerRow, column: 1 },
                to: { row: definition.institutional.headerRow, column: definition.columns.length },
            };
        }
    } else {
        styleSheet(sheet);
    }

    return {
        workbook,
        filename: definition.filename,
        columns: definition.columns,
        rows: definition.rows,
    };
}

async function generateCsvReport(query = {}) {
    const normalized = normalizeReportQuery(query);
    const definition = await buildExportDefinition(normalized);
    const lines = [];

    lines.push(definition.columns.map((column) => escapeCsvValue(column.header)).join(','));
    (definition.rows || []).forEach((row, index) => {
        const values = definition.columns.map((column) => {
            const rawValue = column.key === 'row_number' ? index + 1 : row?.[column.key];
            return escapeCsvValue(normalizeReportDisplayValue(column.key, rawValue) ?? '');
        });
        lines.push(values.join(','));
    });

    return {
        filename: definition.filename.replace(/\.xlsx$/i, '.csv'),
        content: `\uFEFF${lines.join('\n')}`,
    };
}

module.exports = {
    getReportMetadata,
    previewReport,
    generateExcelReport,
    generateCsvReport,
};
