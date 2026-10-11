const test = require('node:test');
const assert = require('node:assert/strict');
const batchId = '00000000-0000-0000-0000-000000000001';

function load({ count = 70, missing = false } = {}) {
  const calls = [];
  const db = { query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT pb.payout_batch_id')) return { rows: missing ? [] : [{ payout_title: 'Second Semester Payout', program_name: 'Foundation Scholarship', academic_year: '2025-2026', semester: 'Second Semester', payout_date: '2026-10-11', payout_time: '14:00:00', payout_venue: 'OSFA', payment_mode: 'Cash', amount_per_scholar: 10000 }] };
      return { rows: Array.from({ length: count }, (_, index) => ({ pdm_id: `PDM-2026-${String(index + 1).padStart(6, '0')}`, student_name: `Student ${index + 1}`, course_code: 'BSIT', year_level: 2, payout_amount: 10000 })) };
    } };
  const dbPath = require.resolve('../config/db');
  const servicePath = require.resolve('../services/payoutAcknowledgmentReportService');
  const previousDb = require.cache[dbPath];
  const previousService = require.cache[servicePath];
  try {
    require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
    delete require.cache[servicePath];
    return { service: require(servicePath), calls };
  } finally {
    if (previousDb) require.cache[dbPath] = previousDb; else delete require.cache[dbPath];
    if (previousService) require.cache[servicePath] = previousService; else delete require.cache[servicePath];
  }
}

test('one selected batch scopes recipient rows and reports only essential signature-sheet fields', async () => {
  const { service, calls } = load();
  const data = await service.preview({ payoutBatchId: batchId });
  assert.equal(data.total, 70);
  assert.equal(data.rows.length, 50);
  assert.equal(data.totalAmount, 700000);
  assert.deepEqual(Array.from(data.columns, column => column.key), ['row_number', 'pdm_id', 'student_name', 'course_code', 'year_level', 'payout_amount', 'payment_mode', 'academic_period', 'recipient_signature', 'date_received']);
  assert.equal(data.rows[0].course_code, 'BSIT');
  assert.equal(data.rows[0].year_level, 2);
  assert.ok(data.rows.every(row => row.recipient_signature === ''));
  assert.ok(data.rows.every(row => row.date_received === ''));
  assert.match(calls[0].sql, /COALESCE\(pb.is_archived, false\) = false/);
  assert.match(calls[1].sql, /WHERE pbs.payout_batch_id = \$1/);
  assert.ok(calls.every(call => call.params[0] === batchId));
  assert.ok(data.rows.every(row => row.payment_mode === 'Cash'));
  assert.ok(data.rows.every(row => row.academic_period === 'Second Semester · 2025-2026'));
  assert.equal(data.subtitle, 'Second Semester Payout');
  assert.equal(data.details, undefined);
  assert.equal((await service.preview({ payoutBatchId: batchId, print: 'true' })).rows.length, 70);
});

test('Excel keeps all recipients, blank signature space, totals and certification on printable landscape pages', async () => {
  const { service } = load();
  const data = await service.excel({ payoutBatchId: batchId });
  const sheet = data.workbook.worksheets[0];
  assert.equal(sheet.getCell('B12').value, 'PDM-2026-000001');
  assert.equal(sheet.getCell('B81').value, 'PDM-2026-000070');
  assert.equal(sheet.getCell('D11').value, 'Course');
  assert.equal(sheet.getCell('E11').value, 'Year Level');
  assert.equal(sheet.getCell('D12').value, 'BSIT');
  assert.equal(sheet.getCell('E12').value, 2);
  assert.equal(sheet.getCell('G11').value, 'Payout Mode');
  assert.equal(sheet.getCell('G12').value, 'Cash');
  assert.equal(sheet.getCell('H11').value, 'Academic Period');
  assert.equal(sheet.getCell('H12').value, 'Second Semester · 2025-2026');
  assert.equal(sheet.getCell('I12').value, '');
  assert.equal(sheet.getCell('J11').value, 'Date Received');
  assert.equal(sheet.getCell('J12').value, '');
  assert.equal(sheet.getRow(12).height, 38);
  assert.equal(sheet.getCell('F12').numFmt, '"₱"#,##0');
  assert.match(sheet.getCell('A83').value, /₱700,000/);
  assert.match(sheet.getCell('A88').value, /Certified by/);
  assert.equal(sheet.getCell('A8').value, 'PAYOUT BATCH ACKNOWLEDGMENT');
  assert.equal(sheet.getCell('A8').alignment.horizontal, 'center');
  assert.equal(sheet.getCell('D11').alignment.horizontal, 'center');
  assert.equal(sheet.getImages().length, 1);
  assert.ok(data.workbook.getImage(sheet.getImages()[0].imageId).filename.endsWith('pdm-excel-header.png'));
  assert.equal(sheet.pageSetup.printArea, 'A1:J89');
  assert.equal(sheet.pageSetup.orientation, 'landscape');
  assert.equal(sheet.pageSetup.fitToWidth, 1);
  assert.equal(sheet.pageSetup.fitToHeight, 0);
  assert.equal(sheet.pageSetup.printTitlesRow, '11:11');
  assert.ok((await data.workbook.xlsx.writeBuffer()).length > 1000);
});

test('missing or invalid batch selection is rejected before querying and absent batches return 404', async () => {
  const { service, calls } = load();
  await assert.rejects(service.preview({}), error => error.statusCode === 400);
  await assert.rejects(service.preview({ payoutBatchId: "' OR true" }), error => error.statusCode === 400);
  assert.equal(calls.length, 0);
  await assert.rejects(load({ missing: true }).service.preview({ payoutBatchId: batchId }), error => error.statusCode === 404);
});
