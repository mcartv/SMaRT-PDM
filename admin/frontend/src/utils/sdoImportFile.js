export const SDO_IMPORT_MAX_BYTES = 15 * 1024 * 1024;

export function validateSdoImportFile(file) {
  if (!file) return 'Choose an XLSX or CSV file.';
  if (!/\.(xlsx|csv)$/i.test(file.name)) return 'Use an XLSX or CSV file. Save older XLS files as XLSX first.';
  if (!file.size) return 'This file is empty. Choose a file containing student records.';
  if (file.size > SDO_IMPORT_MAX_BYTES) return 'The file must be 15 MB or smaller.';
  return '';
}

export function buildImportIssuesCsv(rows) {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[=+@-]/.test(text.trimStart())) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [['Row', 'Student Number', 'Result', 'Reason'], ...rows.filter(row => row.status !== 'ready')
    .map(row => [row.row_number, row.student_number, row.status, row.reason])]
    .map(row => row.map(cell).join(',')).join('\r\n');
}
