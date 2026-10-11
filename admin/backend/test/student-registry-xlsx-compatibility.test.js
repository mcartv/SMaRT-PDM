const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');

function loadReader() {
  const context = { module: { exports: {} }, exports: {}, Buffer, Date, console, require: name => {
    if (['../config/supabase', '../config/db', './studentRegistryIdentity'].includes(name)) return {};
    return require(name);
  } };
  const source = fs.readFileSync(path.resolve(__dirname, '../services/studentRegistryService.js'), 'utf8');
  vm.runInNewContext(source + '\nmodule.exports = { readWorkbookRows };', context);
  return context.module.exports.readWorkbookRows;
}

async function workbookBuffer({ prefixed = false } = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('SDO Import');
  sheet.addRow(['Student Number', 'Offense Type', 'Course', 'Year Level', 'Incident Date', 'Remarks']);
  sheet.addRow(['PDM-2026-000001', 'Major Offense', 'BSIT', '1', new Date('2026-10-10T00:00:00Z'), 'Review & follow up']);
  sheet.getCell('E2').numFmt = 'yyyy-mm-dd';
  workbook.addWorksheet('Instructions').addRow(['Do not import this sheet']);
  const buffer = await workbook.xlsx.writeBuffer();
  if (!prefixed) return buffer;
  const zip = await JSZip.loadAsync(buffer);
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !entry.name.endsWith('.xml')) continue;
    const xml = await entry.async('string');
    if (!xml.includes('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')) continue;
    zip.file(entry.name, xml.replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', 'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
      .replace(/(<\/?)([A-Za-z][\w.-]*)(?=[\s/>])/g, '$1x:$2'));
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('namespace-prefixed XLSX files retain Student IDs, dates, strings, and first-sheet selection', async () => {
  const buffer = await workbookBuffer({ prefixed: true });
  await assert.rejects(new ExcelJS.Workbook().xlsx.load(buffer), /sheetNo|reading 'sheets'/);
  const rows = await loadReader()({ originalname: 'sdo.xlsx', buffer });
  assert.equal(rows.length, 2);
  assert.equal(rows[0][0], 'Student Number');
  assert.equal(rows[1][0], 'PDM-2026-000001');
  assert.equal(rows[1][1], 'Major Offense');
  assert.equal(rows[1][4].toISOString(), '2026-10-10T00:00:00.000Z');
  assert.equal(rows[1][5], 'Review & follow up');
});

test('ordinary XLSX and CSV imports continue using the shared reader', async () => {
  const read = loadReader();
  const rows = await read({ originalname: 'admin.xlsx', buffer: await workbookBuffer() });
  assert.equal(rows[1][0], 'PDM-2026-000001');
  assert.equal(rows[1][4].toISOString(), '2026-10-10T00:00:00.000Z');
  const csv = await read({ originalname: 'sdo.csv', buffer: Buffer.from('Student Number,Offense Type\nPDM-2026-000001,Minor Offense') });
  assert.equal(csv[1][1], 'Minor Offense');
});

test('corrupt Excel uploads return an actionable validation error instead of a 500', async () => {
  await assert.rejects(loadReader()({ originalname: 'corrupt.xlsx', buffer: Buffer.from('not a workbook') }), error => {
    assert.equal(error.statusCode, 400);
    assert.match(error.message, /save it as a new .xlsx or .csv/);
    return true;
  });
});
