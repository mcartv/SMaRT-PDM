'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getReportColumns, prepareReportRow } = require('../services/reportColumns');

function loadReports(rows, calls = []) {
    const filename = path.resolve(__dirname, '../services/reportService.js');
    const pool = { async query(sql, params) { calls.push({ sql, params }); return { rows }; } };
    function loadFile(filename) {
    const context = vm.createContext({
        __dirname: path.dirname(filename), module: { exports: {} }, console, Date, Buffer,
        require(name) {
            if (name === '../config/db') return pool;
            if (name === './osfaReportService') return loadFile(path.resolve(path.dirname(filename), 'osfaReportService.js'));
            if (name.startsWith('./')) return require(path.resolve(path.dirname(filename), name));
            return require(name);
        },
    });
    vm.runInContext(fs.readFileSync(filename, 'utf8'), context);
    return context.module.exports;
    }
    return loadFile(filename);
}

test('each report exposes at most nine essential columns without internal IDs or contact details', () => {
    const types = ['applications', 'scholars', 'beneficiary_graduates', 'newly_recommended', 'benefactor_grades', 'scholarship_history',
        'scholars_by_benefactor', 'payouts', 'payout_proofs', 'renewals', 'slot_utilization',
        'sdo', 'sdo_offenses', 'guidance', 'pd', 'endorsements', 'ro', 'ro_compliance'];
    for (const type of types) {
        const columns = getReportColumns(type);
        assert.ok(columns.length <= 9, type);
        assert.equal(new Set(columns.map((c) => c.key)).size, columns.length);
        for (const { key, header } of columns) {
            assert.ok(header);
            assert.doesNotMatch(key, /^(slip_id|opening_id|ro_id|email_address|phone_number|final_pdf_url)$/);
        }
    }
});

test('beneficiaries export matches the seven-column supplied name/course/year layout', async () => {
    const service = loadReports([{ pdm_id: '001', _last_name: 'Doe', _given_name: 'Jane',
        _middle_initial: 'A.', course_code: 'BSIT', year_level: 3, benefactor_name: 'Foundation' }]);
    const result = await service.generateExcelReport({ reportType: 'scholars' });
    assert.deepEqual(result.columns.map((c) => c.header), ['No.', 'Last Name', 'Given Name', 'MI', 'Course', 'Year', 'Benefactor']);
    const sheet = result.workbook.worksheets[0];
    assert.equal(sheet.getCell('B12').value, 'Doe');
    assert.equal(sheet.getCell('D12').value, 'A.');
    const preview = await service.previewReport({ reportType: 'scholars' });
    assert.equal(preview.rows[0].last_name, 'Doe');
    assert.equal(preview.rows[0].row_number, 1);
});

test('graduate report uses explicit Graduated records and approved scholarship coverage, not year-level inference', async () => {
    const calls = [];
    const service = loadReports([{ last_name: 'Doe', given_name: 'Jane', benefactor_name: 'Foundation',
        period_from: 'First Semester A.Y. 2022-2023', period_to: 'Second Semester A.Y. 2025-2026' }], calls);
    const preview = await service.previewReport({ reportType: 'beneficiary_graduates', benefactorId: 'sponsor', dateFrom: '2026-01-01' });
    assert.match(calls[0].sql, /scholar_removal_reason.*'graduated'/);
    assert.match(calls[0].sql, /scholar_is_archived/);
    assert.match(calls[0].sql, /FROM renewals/);
    assert.match(calls[0].sql, /ARRAY_AGG\(covered_period ORDER BY start_year DESC, term_order DESC\)/);
    assert.match(calls[0].sql, /st\.scholar_archived_at >= \$2::date/);
    assert.deepEqual(Array.from(calls[0].params), ['sponsor', '2026-01-01']);
    assert.equal(preview.rows[0].period_to, 'Second Semester A.Y. 2025-2026');
    assert.equal((await service.generateExcelReport({ reportType: 'beneficiary_graduates' })).columns.length, 8);
});

test('new recommendations exclude returning beneficiaries and retain full middle names and GWA', async () => {
    const calls = [];
    const service = loadReports([{ last_name: 'Doe', given_name: 'Jane', middle_name: 'Anderson', gwa: 1.75,
        benefactor_name: 'Foundation', academic_year: '2025-2026', semester: 'Second Semester' }], calls);
    const query = { reportType: 'newly_recommended', benefactorId: 'sponsor', academicYearId: 'year', semester: 'Second Semester' };
    const result = await service.generateExcelReport(query);
    assert.match(calls[0].sql, /NOT EXISTS/);
    assert.match(calls[0].sql, /prior_program\.benefactor_id = sp\.benefactor_id/);
    assert.match(calls[0].sql, /'reserved', 'selected', 'promoted'/);
    assert.deepEqual(Array.from(calls[0].params), ['sponsor', 'year', 'Second Semester']);
    assert.equal(result.columns.length, 7);
    const sheet = result.workbook.worksheets[0];
    assert.equal(sheet.getCell('D12').value, 'Anderson');
    assert.equal(sheet.getCell('G12').value, 1.75);
    assert.match(sheet.getCell('A8').value, /OF FOUNDATION/);
    assert.equal(sheet.getCell('A9').value, 'SECOND SEMESTER A.Y. 2025-2026');
});

test('GWA report filters active scholars by benefactor and period with parameterized SQL', async () => {
    const calls = [];
    const service = loadReports([{ pdm_id: '100', student_name: 'Doe, Jane', gwa: '1.75',
        academic_year: '2026-2027', semester: 'First Semester', benefactor_name: 'Foundation' }], calls);
    const result = await service.previewReport({ reportType: 'benefactor_grades', benefactorId: 'benefactor-1',
        academicYearId: 'year-1', semester: 'First Semester' });
    assert.match(calls[0].sql, /st\.gwa/);
    assert.match(calls[0].sql, /st\.is_active_scholar = TRUE/);
    assert.match(calls[0].sql, /b\.benefactor_id = \$3/);
    assert.deepEqual(Array.from(calls[0].params), ['year-1', 'First Semester', 'benefactor-1']);
    assert.equal(result.rows[0].gwa, '1.75');
    assert.equal(result.rows[0].academic_period, '2026-2027 / First Semester');
    assert.ok(result.columns.some((c) => c.key === 'gwa'));
});

test('print retrieves every matching row while normal preview remains limited to 50', async () => {
    const rows = Array.from({ length: 75 }, (_, i) => ({ pdm_id: String(i), student_name: `Scholar ${i}`, gwa: null }));
    const service = loadReports(rows);
    assert.equal((await service.previewReport({ reportType: 'benefactor_grades' })).rows.length, 50);
    assert.equal((await service.previewReport({ reportType: 'benefactor_grades', print: 'true' })).rows.length, 75);
    assert.equal(prepareReportRow({ gwa: null }).gwa, null);
});

test('GWA spreadsheet and CSV share the compact columns and preserve grade decimals', async () => {
    const service = loadReports([{ pdm_id: '001', student_name: 'Doe, Jane', gwa: 1.75,
        benefactor_name: 'Foundation', academic_year: '2026-2027', semester: 'First Semester' }]);
    const result = await service.generateExcelReport({ reportType: 'benefactor_grades' });
    const sheet = result.workbook.worksheets[0];
    assert.equal(sheet.columnCount, 8);
    assert.equal(sheet.getCell('H12').value, 1.75);
    assert.equal(sheet.getCell('H12').numFmt, '0.00');
    assert.equal(sheet.getCell('H12').font.size, 10);
    assert.equal(sheet.pageSetup.fitToWidth, 1);
    assert.equal(sheet.pageSetup.printTitlesRow, '11:11');
    assert.ok((await result.workbook.xlsx.writeBuffer()).length > 0);
    const csv = await service.generateCsvReport({ reportType: 'benefactor_grades' });
    assert.match(csv.content, /Student Number,Student Name,Course,Year,Benefactor,Program,Academic Period,GWA/);
    assert.match(csv.content, /1\.75/);
});
