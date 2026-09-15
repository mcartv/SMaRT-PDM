const path = require('path');
const PDFDocument = require('pdfkit');

// Faithful raster of the supplied one-page PDM PDF template. PDFKit uses the
// rendered page as a full-page background so the institutional header/footer stay exact.
const TEMPLATE_PATH = path.join(
    __dirname,
    '..',
    'assets',
    'report-templates',
    'pdm-report-template.png'
);

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_LEFT = 54;
const CONTENT_RIGHT = 558;
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
const BRAND_BROWN = '#7C4A2E';
const BRAND_YELLOW = '#E9C31B';
const TEXT_DARK = '#292524';
const TEXT_MUTED = '#78716C';
const BORDER = '#E7E5E4';
const TRACK = '#F5F5F4';


function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function fitSingleLineText(doc, text, x, y, {
    width,
    font = 'Helvetica',
    fontSize = 7.6,
    minFontSize = 6.2,
    color = TEXT_MUTED,
    align = 'left',
} = {}) {
    const value = safeText(text);
    let resolvedSize = fontSize;

    doc.font(font);
    while (resolvedSize > minFontSize) {
        doc.fontSize(resolvedSize);
        if (doc.widthOfString(value) <= width) break;
        resolvedSize -= 0.2;
    }

    doc
        .font(font)
        .fontSize(resolvedSize)
        .fillColor(color)
        .text(value, x, y, {
            width,
            align,
            lineBreak: false,
            ellipsis: true,
        });
}

function resolveChartLayout(rows = []) {
    const longestLabel = rows.reduce(
        (longest, row) => Math.max(longest, safeText(row?.label).length),
        0
    );
    const labelWidth = clamp(154 + Math.max(0, longestLabel - 24) * 1.35, 154, 208);
    const labelFontSize = longestLabel >= 55 ? 6.7 : longestLabel >= 38 ? 7.1 : 7.6;
    const rowHeight = longestLabel >= 55 ? 34 : longestLabel >= 38 ? 30 : longestLabel >= 28 ? 27 : 24;
    const countWidth = 46;
    const countX = CONTENT_RIGHT - countWidth;
    const barX = CONTENT_LEFT + labelWidth + 12;
    const barMaxWidth = Math.max(120, countX - barX - 10);
    const chartTop = 254;
    const chartBottom = 646;
    const rowsPerPage = Math.max(8, Math.floor((chartBottom - chartTop) / rowHeight));

    return {
        chartTop,
        chartBottom,
        labelWidth,
        labelFontSize,
        rowHeight,
        countWidth,
        countX,
        barX,
        barMaxWidth,
        rowsPerPage,
        barHeight: clamp(rowHeight * 0.48, 10, 14),
    };
}

function safeText(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
}

function resolveLabel(items, idKey, labelKey, selectedValue, fallback) {
    if (!selectedValue || selectedValue === 'all') return fallback;
    const match = (items || []).find((item) => String(item?.[idKey]) === String(selectedValue));
    return safeText(match?.[labelKey], fallback);
}

function buildFilterLabels(query = {}, metadata = {}) {
    const academicYear = resolveLabel(
        metadata.academicYears,
        'academic_year_id',
        'label',
        query.academicYearId,
        'All Academic Years'
    );
    const semester = query.semester && query.semester !== 'all'
        ? safeText(query.semester)
        : 'All Semesters';
    const benefactor = resolveLabel(
        metadata.benefactors,
        'benefactor_id',
        'benefactor_name',
        query.benefactorId,
        'All Benefactors'
    );
    const program = resolveLabel(
        metadata.programs,
        'program_id',
        'program_name',
        query.programId,
        'All Programs'
    );
    const course = resolveLabel(
        metadata.courses,
        'course_id',
        'course_code',
        query.courseId,
        'All Courses'
    );
    const yearLevel = query.yearLevel && query.yearLevel !== 'all'
        ? `Year ${safeText(query.yearLevel)}`
        : 'All Year Levels';
    const gender = query.gender && query.gender !== 'all'
        ? safeText(query.gender)
        : 'All Genders';

    let dateRange = 'All Dates';
    if (query.dateFrom && query.dateTo) {
        dateRange = `${query.dateFrom} to ${query.dateTo}`;
    } else if (query.dateFrom) {
        dateRange = `From ${query.dateFrom}`;
    } else if (query.dateTo) {
        dateRange = `Up to ${query.dateTo}`;
    }

    return {
        academicYear,
        semester,
        benefactor,
        program,
        course,
        yearLevel,
        gender,
        dateRange,
    };
}

function extractChartRows(workbook, query = {}) {
    const sheet = workbook?.worksheets?.[0];
    if (!sheet) return [];

    const useProgram = query.benefactorId && query.benefactorId !== 'all';
    const rows = [];

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const label = useProgram
            ? safeText(row.getCell('program_name').value, 'Unassigned Program')
            : safeText(row.getCell('benefactor_name').value, 'Unassigned Benefactor');
        const count = Number(row.getCell('scholar_count').value || 0);

        if (!Number.isFinite(count)) return;
        rows.push({ label, count });
    });

    return rows;
}

function drawTemplate(doc) {
    doc.image(TEMPLATE_PATH, 0, 0, {
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
    });
}

function drawHeader(doc, { filters, groupedBy, totalScholars, pageNumber, totalPages }) {
    drawTemplate(doc);

    doc
        .fillColor(TEXT_DARK)
        .font('Helvetica-Bold')
        .fontSize(16)
        .text('Scholar Count by Benefactor', CONTENT_LEFT, 126, {
            width: CONTENT_WIDTH,
            align: 'center',
        });

    doc
        .fillColor(TEXT_MUTED)
        .font('Helvetica')
        .fontSize(8.5)
        .text(`Active scholar distribution grouped by ${groupedBy}.`, CONTENT_LEFT, 148, {
            width: CONTENT_WIDTH,
            align: 'center',
        });

    doc
        .moveTo(CONTENT_LEFT, 166)
        .lineTo(CONTENT_RIGHT, 166)
        .lineWidth(1)
        .strokeColor(BRAND_YELLOW)
        .stroke();

    const summaryY = 179;
    doc
        .fillColor(TEXT_DARK)
        .font('Helvetica-Bold')
        .fontSize(8.2)
        .text(`Academic Year: ${filters.academicYear}`, CONTENT_LEFT, summaryY, { width: 245 });
    doc.text(`Semester: ${filters.semester}`, 313, summaryY, { width: 245 });

    fitSingleLineText(doc, `Benefactor: ${filters.benefactor}`, CONTENT_LEFT, summaryY + 15, { width: 245 });
    fitSingleLineText(doc, `Program: ${filters.program}`, 313, summaryY + 15, { width: 245 });
    fitSingleLineText(doc, `Course: ${filters.course}`, CONTENT_LEFT, summaryY + 30, { width: 245 });
    fitSingleLineText(doc, `Year Level: ${filters.yearLevel}`, 313, summaryY + 30, { width: 120 });
    fitSingleLineText(doc, `Gender: ${filters.gender}`, 438, summaryY + 30, { width: 120 });
    fitSingleLineText(doc, `Date Range: ${filters.dateRange}`, CONTENT_LEFT, summaryY + 45, { width: 330 });

    doc
        .font('Helvetica-Bold')
        .fillColor(BRAND_BROWN)
        .fontSize(8.2)
        .text(`Total Active Scholars: ${totalScholars}`, 390, summaryY + 45, {
            width: 168,
            align: 'right',
        });

    if (totalPages > 1) {
        doc
            .font('Helvetica')
            .fillColor(TEXT_MUTED)
            .fontSize(7)
            .text(`Chart page ${pageNumber} of ${totalPages}`, CONTENT_LEFT, 665, {
                width: CONTENT_WIDTH,
                align: 'right',
            });
    }
}

function drawChartPage(doc, rows, {
    groupedBy,
    pageNumber,
    totalPages,
    filters,
    totalScholars,
    layout,
}) {
    drawHeader(doc, { filters, groupedBy, totalScholars, pageNumber, totalPages });

    const {
        chartTop,
        labelWidth,
        labelFontSize,
        rowHeight,
        countX,
        countWidth,
        barX,
        barMaxWidth,
        barHeight,
    } = layout;
    const maxValue = Math.max(1, ...rows.map((row) => row.count));

    doc
        .font('Helvetica-Bold')
        .fillColor(TEXT_DARK)
        .fontSize(8)
        .text(groupedBy === 'program' ? 'Scholarship Program' : 'Benefactor', CONTENT_LEFT, chartTop - 17, {
            width: labelWidth,
        });
    doc.text('Scholar Count', barX, chartTop - 17, {
        width: CONTENT_RIGHT - barX,
        align: 'right',
    });

    rows.forEach((row, index) => {
        const rowY = chartTop + index * rowHeight;
        const barWidth = row.count <= 0 ? 0 : Math.max(3, (row.count / maxValue) * barMaxWidth);
        const barY = rowY + Math.max(2, (rowHeight - barHeight) / 2 - 1);

        doc
            .font('Helvetica')
            .fillColor(TEXT_DARK)
            .fontSize(labelFontSize)
            .text(row.label, CONTENT_LEFT, rowY + 1, {
                width: labelWidth,
                height: rowHeight - 4,
                lineGap: 0,
                ellipsis: true,
            });

        doc
            .roundedRect(barX, barY, barMaxWidth, barHeight, 2)
            .fill(TRACK);

        if (barWidth > 0) {
            doc
                .roundedRect(barX, barY, barWidth, barHeight, 2)
                .fill(BRAND_BROWN);
        }

        doc
            .font('Helvetica-Bold')
            .fillColor(TEXT_DARK)
            .fontSize(7.8)
            .text(String(row.count), countX, barY + Math.max(0, (barHeight - 8) / 2), {
                width: countWidth,
                align: 'right',
                lineBreak: false,
            });

        doc
            .moveTo(CONTENT_LEFT, rowY + rowHeight - 3)
            .lineTo(CONTENT_RIGHT, rowY + rowHeight - 3)
            .lineWidth(0.4)
            .strokeColor(BORDER)
            .stroke();
    });
}

function drawEmptyState(doc, { groupedBy, filters }) {
    drawHeader(doc, {
        filters,
        groupedBy,
        totalScholars: 0,
        pageNumber: 1,
        totalPages: 1,
    });

    doc
        .roundedRect(102, 285, 408, 118, 8)
        .lineWidth(1)
        .strokeColor(BORDER)
        .stroke();

    doc
        .fillColor(TEXT_DARK)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('No matching scholar records', 126, 321, {
            width: 360,
            align: 'center',
        });

    doc
        .fillColor(TEXT_MUTED)
        .font('Helvetica')
        .fontSize(8.5)
        .text('No active scholars matched the selected report filters.', 126, 343, {
            width: 360,
            align: 'center',
        });
}

function generateScholarCountPdf({ workbook, query = {}, metadata = {} } = {}) {
    const chartRows = extractChartRows(workbook, query);
    const filters = buildFilterLabels(query, metadata);
    const groupedBy = query.benefactorId && query.benefactorId !== 'all' ? 'program' : 'benefactor';
    const totalScholars = chartRows.reduce((sum, row) => sum + Number(row.count || 0), 0);
    const layout = resolveChartLayout(chartRows);
    const rowsPerPage = layout.rowsPerPage;
    const totalPages = Math.max(1, Math.ceil(chartRows.length / rowsPerPage));

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            margin: 0,
            autoFirstPage: false,
            info: {
                Title: 'Scholar Count by Benefactor Report',
                Author: 'SMaRT-PDM',
                Subject: 'Active scholar counts by benefactor or scholarship program',
            },
        });
        const chunks = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('error', reject);
        doc.on('end', () => {
            resolve({
                buffer: Buffer.concat(chunks),
                filename: 'scholar_count_by_benefactor_report.pdf',
            });
        });

        if (chartRows.length === 0) {
            doc.addPage({ size: 'LETTER', margin: 0 });
            drawEmptyState(doc, { groupedBy, filters });
        } else {
            for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
                doc.addPage({ size: 'LETTER', margin: 0 });
                const pageRows = chartRows.slice(
                    pageIndex * rowsPerPage,
                    (pageIndex + 1) * rowsPerPage
                );
                drawChartPage(doc, pageRows, {
                    groupedBy,
                    pageNumber: pageIndex + 1,
                    totalPages,
                    filters,
                    totalScholars,
                    layout,
                });
            }
        }

        doc.end();
    });
}

module.exports = {
    generateScholarCountPdf,
};
