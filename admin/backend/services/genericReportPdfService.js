'use strict';
// PDF export for the existing, permission-scoped report workbook.
// Long reports print in landscape with horizontal column panels instead of tiny text.
const PDFDocument = require('pdfkit');

function display(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) return display(value.result);
    if (Object.prototype.hasOwnProperty.call(value, 'text')) return String(value.text);
    if (Object.prototype.hasOwnProperty.call(value, 'formula')) return '';
    return '';
  }
  return String(value).replace(/[\r\n\t]+/g, ' ').trim();
}
function safeName(value) {
  return String(value || 'report').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'report';
}
function workbookToPdf(workbook, title = 'SMaRT-PDM Report', filename = 'report.xlsx') {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 34, bufferPages: true,
      info: { Title: String(title).slice(0, 160), Creator: 'SMaRT-PDM' } });
    const chunks = [];
    doc.on('data', part => chunks.push(part));
    doc.on('error', reject);
    doc.on('end', () => resolve({ buffer: Buffer.concat(chunks), filename: safeName(filename.replace(/\.[^.]+$/, '')) + '.pdf' }));
    const left = 34;
    const printableWidth = doc.page.width - 68;
    const bottom = doc.page.height - 46;
    const rowHeight = 19;
    let totalPages = 0;
    for (const sheet of workbook.worksheets) {
      if (!sheet.rowCount) continue;
      const raw = [];
      sheet.eachRow({ includeEmpty: false }, row => {
        const vals = [];
        for (let i = 1; i <= Math.min(sheet.columnCount || row.cellCount, 80); i++) vals.push(display(row.getCell(i).value));
        if (vals.some(Boolean)) raw.push(vals);
      });
      if (!raw.length) continue;
      // Repeat the first identifying column on continuation panels.
      const columnCount = Math.min(Math.max(...raw.map(x => x.length)), 80);
      const panels = [];
      if (columnCount <= 6) panels.push(Array.from({ length: columnCount }, (_, i) => i));
      else for (let start = 1; start < columnCount; start += 5) panels.push([0, ...Array.from({length: Math.min(5, columnCount - start)}, (_, i) => start + i)]);
      const headings = raw[0];
      const data = raw.slice(1);
      for (const [panelIndex, indexes] of panels.entries()) {
        let at = 0;
        do {
          if (totalPages > 0) doc.addPage();
          totalPages += 1;
          doc.font('Helvetica-Bold').fontSize(12).fillColor('#483024')
            .text(String(title).slice(0, 115), left, 28, { width: printableWidth });
          doc.font('Helvetica').fontSize(8).fillColor('#68615c')
            .text(`${sheet.name}   •   Columns ${panelIndex + 1}/${panels.length}   •   ${data.length} record(s)`, left, 46);
          let y = 69;
          const w = printableWidth / indexes.length;
          doc.rect(left, y, printableWidth, rowHeight).fill('#EFE7E0');
          indexes.forEach((idx, j) => doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#3f3029')
            .text((headings[idx] || `Column ${idx + 1}`).slice(0, 45), left + w*j + 5, y + 5, { width: w - 10, height: 12, ellipsis: true }));
          y += rowHeight;
          const maxRows = Math.floor((bottom - y) / rowHeight);
          const take = Math.min(maxRows, data.length - at);
          for (let k = 0; k < take; k++) {
            const vals = data[at + k];
            if (k % 2 === 1) doc.rect(left, y, printableWidth, rowHeight).fill('#F9F7F5');
            indexes.forEach((idx, j) => doc.font('Helvetica').fontSize(7.3).fillColor('#292524')
              .text((vals[idx] || '').slice(0, 180), left + w*j + 5, y + 5, { width: w - 10, height: 12, ellipsis: true }));
            y += rowHeight;
          }
          at += take;
          if (data.length === 0) at = 1;
        } while (at < data.length);
      }
    }
    if (totalPages === 0) {
      doc.font('Helvetica-Bold').fontSize(14).text(String(title), 35, 40);
      doc.font('Helvetica').fontSize(10).text('No records available for the selected report filters.', 35, 75);
    }
    const count = doc.bufferedPageRange().count;
    for (let i = 0; i < count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#78716c')
        .text(`SMaRT-PDM  •  Page ${i + 1} of ${count}`, 35, doc.page.height - 27,
          { width: doc.page.width - 70, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}
module.exports = { workbookToPdf };
