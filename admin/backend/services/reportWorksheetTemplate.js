const path = require('path');

const EXCEL_HEADER_IMAGE_PATH = path.resolve(
    __dirname,
    '../assets/report-templates/pdm-excel-header.png'
);

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

function estimateWrappedLines(text, columnWidth) {
    const available = Math.max(4, Number(columnWidth || 10) - 1.5);
    const rawLines = String(text || '').split('\n');
    return Math.max(1, rawLines.reduce((total, line) => {
        const width = Math.max(1, visualTextWidth(line));
        return total + Math.max(1, Math.ceil(width / available));
    }, 0));
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

function styleInstitutionalTable(sheet, { headerRow, dataStartRow }) {
    const lastRow = sheet.lastRow?.number || headerRow;
    const lastColumn = Math.max(1, sheet.columnCount);
    const header = sheet.getRow(headerRow);
    header.font = { bold: true, color: { argb: 'FF111111' }, size: 10 };
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
                cell.font = { ...(cell.font || {}), size: 10 };
                cell.alignment = {
                    ...(cell.alignment || {}),
                    vertical: 'middle',
                    wrapText: true,
                };
            }
        }
    }
}

module.exports = { visualTextWidth, estimateWrappedLines, addInstitutionalWorksheetHeader, styleInstitutionalTable };
