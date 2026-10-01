const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('endorsement slip prints at quarter size on a standard short bond paper page', () => {
  const service = read('backend/services/endorsementSlipService.js');

  assert.match(service, /const quarterBondSlipSize = \[4\.25 \* 72, 5\.5 \* 72\]/);
  assert.match(service, /new PDFDocument\(\{ size: 'LETTER', margin: 0 \}\)/);
  assert.match(service, /const slipOffsetX = \(printPageWidth - pageWidth\) \/ 2/);
  assert.match(service, /doc\.save\(\)\.translate\(slipOffsetX, slipOffsetY\)/);
  assert.doesNotMatch(service, /new PDFDocument\(\{ size: 'A4'/);
});

test('selected endorsement boxes use a vector check mark instead of an X', () => {
  const service = read('backend/services/endorsementSlipService.js');
  const checkboxImplementation = service.match(
    /const drawCheckboxLine = \(x, y, label, checked\) => \{[\s\S]*?\n        \};/,
  )?.[0] || '';

  assert.match(checkboxImplementation, /\.moveTo\(/);
  assert.match(checkboxImplementation, /\.lineTo\(/);
  assert.doesNotMatch(checkboxImplementation, /\.text\(['"]X['"]/);
});
