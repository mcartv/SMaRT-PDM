const ExcelJS = require('exceljs');
const db = require('../config/db');
const { addInstitutionalWorksheetHeader, styleInstitutionalTable, estimateWrappedLines } = require('./reportWorksheetTemplate');

const columns = [
  { key: 'row_number', header: 'No.', width: 6 },
  { key: 'pdm_id', header: 'Student Number', width: 23 },
  { key: 'student_name', header: 'Student Name', width: 28 },
  { key: 'course_code', header: 'Course', width: 11 },
  { key: 'year_level', header: 'Year Level', width: 9 },
  { key: 'payout_amount', header: 'Amount', width: 17 },
  { key: 'payment_mode', header: 'Payout Mode', width: 14 },
  { key: 'academic_period', header: 'Academic Period', width: 26 },
  { key: 'recipient_signature', header: 'Recipient Signature', width: 30 },
  { key: 'date_received', header: 'Date Received', width: 16 },
];
const title = 'PAYOUT BATCH ACKNOWLEDGMENT';
const peso = value => `₱${Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });

async function getData(query) {
  const id = String(query.payoutBatchId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw error(400, 'Select a payout batch to generate the acknowledgment report.');
  }
  const batchResult = await db.query(`
    SELECT pb.payout_batch_id, pb.payout_title,
      pb.payment_mode, pb.payment_mode_other, ay.label AS academic_year, ap.term AS semester
    FROM payout_batches pb
    LEFT JOIN academic_years ay ON ay.academic_year_id = pb.academic_year_id
    LEFT JOIN academic_period ap ON ap.period_id = pb.period_id
    WHERE pb.payout_batch_id = $1 AND COALESCE(pb.is_archived, false) = false
  `, [id]);
  const batch = batchResult.rows[0];
  if (!batch) throw error(404, 'Payout batch not found.');
  const result = await db.query(`
    SELECT st.pdm_id, CONCAT_WS(' ', st.first_name, NULLIF(st.middle_name, ''), st.last_name) AS student_name,
      ac.course_code, COALESCE(NULLIF(BTRIM(st.year_level::text), ''), smr.year_level::text) AS year_level, pbs.amount_received,
      CASE WHEN lower(COALESCE(pbs.release_status, '')) = 'released'
        THEN COALESCE(pbs.amount_received, pb.amount_per_scholar, 0)
        ELSE COALESCE(pb.amount_per_scholar, 0) END AS payout_amount
    FROM payout_batch_students pbs
    INNER JOIN payout_batches pb ON pb.payout_batch_id = pbs.payout_batch_id
    INNER JOIN students st ON st.student_id = pbs.student_id
    LEFT JOIN student_master_records smr ON smr.master_student_id = st.master_student_id
    LEFT JOIN academic_course ac ON ac.course_id = COALESCE(st.course_id, smr.course_id)
    WHERE pbs.payout_batch_id = $1
    ORDER BY st.last_name, st.first_name, st.pdm_id
  `, [id]);
  const paymentMode = batch.payment_mode === 'Other'
    ? `Other${batch.payment_mode_other ? ` - ${batch.payment_mode_other}` : ''}`
    : batch.payment_mode || 'Not recorded';
  const academicPeriod = [batch.semester, batch.academic_year].filter(Boolean).join(' · ') || 'Not recorded';
  const rows = result.rows.map((row, index) => ({
    row_number: index + 1, pdm_id: row.pdm_id, student_name: row.student_name,
    course_code: row.course_code || '', year_level: row.year_level || '',
    payout_amount: Number(row.payout_amount || 0), recipient_signature: '', date_received: '',
    payment_mode: paymentMode, academic_period: academicPeriod,
  }));
  const totalAmount = rows.reduce((total, row) => total + row.payout_amount, 0);
  return { title, subtitle: batch.payout_title || '', columns, rows, totalAmount, total: rows.length, filename: 'payout_batch_acknowledgment.xlsx', sheetName: 'Payout Acknowledgment' };
}

async function preview(query) {
  const data = await getData(query);
  return { ...data, reportType: 'payout_acknowledgment', rows: query.print === 'true' ? data.rows : data.rows.slice(0, 50) };
}

async function excel(query) {
  const data = await getData(query);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SMaRT-PDM';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(data.sheetName);
  sheet.columns = columns;
  sheet.getRow(1).values = [];
  const lastColumn = sheet.getColumn(columns.length).letter;
  const mergeLine = (row, text) => { sheet.mergeCells(row, 1, row, columns.length); sheet.getCell(row, 1).value = text; };
  addInstitutionalWorksheetHeader(workbook, sheet, {
    title, subtitle: data.subtitle, lastColumn,
  });
  const headerRow = 11;
  sheet.getRow(headerRow).values = columns.map(column => column.header);
  sheet.getRow(headerRow).height = 30;
  sheet.getRow(headerRow).font = { bold: true };
  data.rows.forEach((record, index) => {
    const row = sheet.getRow(headerRow + index + 1);
    row.values = columns.map(column => record[column.key]);
    row.height = Math.max(38, ...columns.map(column => 7 + estimateWrappedLines(record[column.key], column.width) * 14));
    row.getCell(columns.findIndex(column => column.key === 'payout_amount') + 1).numFmt = '"₱"#,##0';
  });
  styleInstitutionalTable(sheet, { headerRow, dataStartRow: headerRow + 1 });
  const totalRow = headerRow + data.rows.length + 2;
  mergeLine(totalRow, `Recipients: ${data.total}     Total Amount: ${peso(data.totalAmount)}`);
  mergeLine(totalRow + 2, 'Recipient signature acknowledges receipt of the amount listed above.');
  mergeLine(totalRow + 5, 'Prepared / Certified by: ____________________________________');
  mergeLine(totalRow + 6, 'OSFA Coordinator                         Date: ____________________');
  sheet.views = [{ state: 'normal', showGridLines: true, zoomScale: 85 }];
  sheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, printTitlesRow: `${headerRow}:${headerRow}`, printArea: `A1:${lastColumn}${totalRow + 6}`, margins: { left: 0.2, right: 0.2, top: 0.3, bottom: 0.45, header: 0.15, footer: 0.2 } };
  sheet.headerFooter.oddFooter = '&LGenerated by SMaRT-PDM&CPage &P of &N&RConfidential';
  return { ...data, workbook };
}

module.exports = { getData, preview, excel };
