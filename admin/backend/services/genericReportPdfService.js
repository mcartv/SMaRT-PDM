'use strict';
// Professional PDF rendering for SMaRT-PDM report workbooks.
// Reads the actual worksheet table (not the institutional banner rows).
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const HEADER_IMAGE = path.resolve(__dirname, '../assets/report-templates/pdm-excel-header.png');
const BROWN = '#75462D';
const INK = '#292524';
const MUTED = '#68615C';
const BORDER = '#DBD5CF';
const STRIPE = '#F8F6F3';
const HEADER_BG = '#EEE7DF';
const PAGE_MARGIN = 35;
const MAX_COLUMNS = 80;

function display(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) return display(value.result);
    if (Object.prototype.hasOwnProperty.call(value, 'text')) return display(value.text);
    if (Object.prototype.hasOwnProperty.call(value, 'richText')) {
      return value.richText.map(part => part.text || '').join('');
    }
    if (Object.prototype.hasOwnProperty.call(value, 'formula')) return display(value.result);
    return '';
  }
  return String(value).replace(/\s+/g, ' ').trim();
}
function safeName(value) {
  return String(value || 'report').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'report';
}
function normalized(value) {
  return display(value).toLowerCase().replace(/\s+/g, ' ');
}
function titleize(value) {
  return String(value || 'SMaRT-PDM Report').replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}
function cellText(row, column) {
  return display(row.getCell(column).value);
}

// The source XLSX has a banner, report title and filter rows above the real
// table header (normally row 11). Match the declared ExcelJS column headers,
// rather than treating the first visible row as the table headings.
function extractTable(sheet) {
  const columnCount = Math.min(sheet.columnCount || 0, MAX_COLUMNS);
  const declared = (sheet.columns || []).slice(0, columnCount)
    .map(col => display(col.header));
  let headerRow = 0;
  let bestScore = 0;
  const scanTo = Math.min(sheet.rowCount || 0, 35);
  for (let n = 1; n <= scanTo; n += 1) {
    const row = sheet.getRow(n);
    let score = 0;
    for (let c = 1; c <= columnCount; c += 1) {
      if (declared[c - 1] && normalized(cellText(row, c)) === normalized(declared[c - 1])) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      headerRow = n;
    }
  }
  // Fallback for an imported workbook with no declared headers.
  if (!headerRow || bestScore < Math.min(2, columnCount)) {
    headerRow = 0;
    for (let n = 1; n <= scanTo; n += 1) {
      const populated = Array.from({ length: columnCount }, (_, c) => cellText(sheet.getRow(n), c + 1)).filter(Boolean);
      if (populated.length >= Math.min(2, columnCount)) { headerRow = n; break; }
    }
  }
  if (!headerRow) return { headings: [], rows: [], subtitle: '' };
  const headings = Array.from({ length: columnCount }, (_, c) =>
    cellText(sheet.getRow(headerRow), c + 1) || declared[c] || 'Column ' + (c + 1));
  const rows = [];
  for (let n = headerRow + 1; n <= sheet.rowCount; n += 1) {
    const row = sheet.getRow(n);
    const values = headings.map((_, c) => cellText(row, c + 1));
    // Ignore separated section labels and empty/formatting rows.
    if (!values.some(Boolean) || (values.slice(1).every(v => !v) && /^for renewal$/i.test(values[0]))) continue;
    rows.push(values);
  }
  const subtitle = headerRow > 1 ? cellText(sheet.getRow(headerRow - 2), 1) : '';
  return { headings, rows, subtitle };
}

function numericColumn(label) {
  return /amount|allocation|total|count|percentage|%|gwa|hours|balance/i.test(label);
}
function preferredWidth(label, rows, index) {
  const name = normalized(label);
  let width = 75;
  if (/student name|scholar name|full name|benefactor|program|venue|address|remarks|description|assigned area/.test(name)) width = 124;
  else if (/student number|academic period|academic year|scholarship/.test(name)) width = 107;
  else if (/status|semester|payout mode|payment mode/.test(name)) width = 86;
  else if (/date|time/.test(name)) width = 83;
  else if (/amount|allocation/.test(name)) width = 90;
  const longest = rows.slice(0, 80).reduce((max, row) => Math.max(max, (row[index] || '').length), 0);
  return Math.min(160, Math.max(width, Math.min(130, 36 + longest * 3.4)));
}
function panelColumns(headings, rows, availableWidth) {
  const widths = headings.map((h, i) => preferredWidth(h, rows, i));
  // Up to ten reasonably legible columns can fit one landscape sheet.
  // Further columns use horizontal panels, repeating student number/name.
  if (headings.length <= 10 && widths.reduce((a, b) => a + b, 0) <= availableWidth * 1.38) {
    return [headings.map((_, i) => i)];
  }
  const identifiers = headings.map((h, i) => /^(student number|student name|scholar name)$/i.test(h.trim()) ? i : -1)
    .filter(i => i >= 0).slice(0, 2);
  if (!identifiers.length && headings.length) identifiers.push(0);
  const remaining = headings.map((_, i) => i).filter(i => !identifiers.includes(i));
  const panels = [];
  while (remaining.length) {
    const panel = identifiers.slice();
    let sum = panel.reduce((t, i) => t + widths[i], 0);
    while (remaining.length) {
      const next = remaining[0];
      if (panel.length > identifiers.length && (sum + widths[next] > availableWidth * 1.12 || panel.length >= 9)) break;
      panel.push(remaining.shift());
      sum += widths[next];
    }
    panels.push(panel);
  }
  return panels.length ? panels : [identifiers];
}
function sizedColumns(indexes, headings, rows, availableWidth) {
  const desired = indexes.map(i => preferredWidth(headings[i], rows, i));
  const total = desired.reduce((a, b) => a + b, 0) || 1;
  return desired.map(n => n / total * availableWidth);
}
function addText(doc, text, x, y, width, options = {}) {
  const { bold = false, size = 7.5, color = INK, height = 25, align = 'left' } = options;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(color);
  doc.text(String(text || ''), x, y, {
    width, height, align, ellipsis: true, lineGap: 1, paragraphGap: 0,
  });
}
function heightForRow(doc, values, indexes, widths) {
  let needed = 22;
  indexes.forEach((column, j) => {
    const value = values[column] || '';
    const w = Math.max(20, widths[j] - 12);
    doc.font('Helvetica').fontSize(7.7);
    const h = doc.heightOfString(value || ' ', { width: w, lineGap: 1 });
    needed = Math.max(needed, Math.min(70, Math.ceil(h + 11)));
  });
  return needed;
}
function drawReportHeader(doc, sheetName, title, subtitle, records, panel, panelCount) {
  const width = doc.page.width;
  const printable = width - PAGE_MARGIN * 2;
  if (fs.existsSync(HEADER_IMAGE)) {
    // Existing institution-approved landscape header artwork.
    doc.image(HEADER_IMAGE, (width - 485) / 2, 16, { fit: [485, 103] });
  } else {
    addText(doc, 'SMaRT-PDM  |  Office of Scholarship and Financial Assistance',
      PAGE_MARGIN, 36, printable, { bold: true, size: 12, height: 20, align: 'center' });
  }
  addText(doc, titleize(title), PAGE_MARGIN, 128, printable, {
    bold: true, size: 14, height: 25, align: 'center', color: BROWN,
  });
  if (subtitle) {
    addText(doc, subtitle, PAGE_MARGIN, 153, printable, {
      size: 8.5, height: 18, align: 'center', color: MUTED,
    });
  }
  const infoY = 179;
  doc.moveTo(PAGE_MARGIN, 171).lineTo(width - PAGE_MARGIN, 171).lineWidth(0.8).strokeColor(BORDER).stroke();
  const label = panelCount > 1 ? sheetName + ' | Column group ' + panel + ' of ' + panelCount : sheetName;
  addText(doc, label, PAGE_MARGIN, infoY, printable * 0.67, { bold: true, size: 8.5, height: 15 });
  addText(doc, records + ' record(s)', PAGE_MARGIN + printable * 0.68, infoY,
    printable * 0.32, { size: 8.5, height: 15, align: 'right', color: MUTED });
  return 205;
}
function drawColumnHeader(doc, headings, indexes, widths, y) {
  const h = 31;
  doc.rect(PAGE_MARGIN, y, widths.reduce((a, b) => a + b, 0), h).fill(HEADER_BG);
  let x = PAGE_MARGIN;
  indexes.forEach((i, j) => {
    addText(doc, headings[i], x + 5, y + 4, widths[j] - 10, {
      bold: true, size: 7.6, height: h - 7, align: numericColumn(headings[i]) ? 'right' : 'left',
    });
    x += widths[j];
  });
  doc.moveTo(PAGE_MARGIN, y + h).lineTo(x, y + h).lineWidth(0.8).strokeColor(BORDER).stroke();
  return y + h;
}
function drawDataRow(doc, values, headings, indexes, widths, y, h, rowIndex) {
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  if (rowIndex % 2) doc.rect(PAGE_MARGIN, y, totalWidth, h).fill(STRIPE);
  let x = PAGE_MARGIN;
  indexes.forEach((i, j) => {
    addText(doc, values[i], x + 5, y + 5, widths[j] - 10, {
      size: 7.7, height: h - 8, align: numericColumn(headings[i]) ? 'right' : 'left',
    });
    x += widths[j];
  });
  doc.moveTo(PAGE_MARGIN, y + h).lineTo(x, y + h).lineWidth(0.35).strokeColor(BORDER).stroke();
}
function workbookToPdf(workbook, title = 'SMaRT-PDM Report', filename = 'report.xlsx') {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', layout: 'landscape', margin: 0, autoFirstPage: false, bufferPages: true,
      info: { Title: titleize(title), Creator: 'SMaRT-PDM' },
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve({
      buffer: Buffer.concat(chunks), filename: safeName(filename.replace(/\.[^.]+$/, '')) + '.pdf',
    }));
    let pages = 0;
    const printable = 841.89 - PAGE_MARGIN * 2;
    for (const sheet of workbook.worksheets) {
      const { headings, rows, subtitle } = extractTable(sheet);
      if (!headings.length) continue;
      const panels = panelColumns(headings, rows, printable);
      for (const [panelIndex, indexes] of panels.entries()) {
        const widths = sizedColumns(indexes, headings, rows, printable);
        let cursor = 0;
        do {
          doc.addPage();
          pages += 1;
          let y = drawReportHeader(doc, sheet.name, title, subtitle, rows.length, panelIndex + 1, panels.length);
          y = drawColumnHeader(doc, headings, indexes, widths, y);
          const bottom = doc.page.height - 53;
          if (!rows.length) {
            addText(doc, 'No matching records for the selected report filters.', PAGE_MARGIN + 8, y + 18,
              printable - 16, { size: 9, height: 24, color: MUTED });
            break;
          }
          while (cursor < rows.length) {
            const h = heightForRow(doc, rows[cursor], indexes, widths);
            if (y + h > bottom) break;
            drawDataRow(doc, rows[cursor], headings, indexes, widths, y, h, cursor);
            y += h;
            cursor += 1;
          }
        } while (cursor < rows.length);
      }
    }
    if (pages === 0) {
      doc.addPage();
      pages = 1;
      drawReportHeader(doc, 'Report', title, '', 0, 1, 1);
      addText(doc, 'No records available for the selected report filters.',
        PAGE_MARGIN, 216, printable, { size: 10 });
    }
    const count = doc.bufferedPageRange().count;
    for (let i = 0; i < count; i += 1) {
      doc.switchToPage(i);
      const y = doc.page.height - 31;
      doc.moveTo(PAGE_MARGIN, y - 11).lineTo(doc.page.width - PAGE_MARGIN, y - 11)
        .lineWidth(0.5).strokeColor(BORDER).stroke();
      addText(doc, 'SMaRT-PDM  |  Generated ' + new Date().toLocaleDateString('en-PH'),
        PAGE_MARGIN, y, 370, { size: 7.5, height: 11, color: MUTED });
      addText(doc, 'Page ' + (i + 1) + ' of ' + count,
        doc.page.width - 150, y, 115, { size: 7.5, height: 11, align: 'right', color: MUTED });
    }
    doc.end();
  });
}
module.exports = { workbookToPdf };
