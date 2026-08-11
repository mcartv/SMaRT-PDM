'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('scholars-by-benefactor report returns stable benefactor/program labels and distinct scholar totals', () => {
  const service = read('admin/backend/services/reportService.js');

  assert.match(service, /COALESCE\(b\.benefactor_name, 'Unassigned Benefactor'\) AS benefactor_name/);
  assert.match(service, /COALESCE\(sp\.program_name, 'Unassigned Program'\) AS program_name/);
  assert.match(service, /COUNT\(DISTINCT st\.student_id\)::int AS scholar_count/);
  assert.match(service, /\['b\.benefactor_id', 'b\.benefactor_name', 'sp\.program_id', 'sp\.program_name'\]/);
});

test('scholars-by-benefactor chart uses readable horizontal bars and whole-number scholar axis', () => {
  const page = read('admin/frontend/src/pages/ReportGeneration.jsx');

  assert.match(page, /layout="vertical"/);
  assert.match(page, /<XAxis type="number" allowDecimals=\{false\}/);
  assert.match(page, /type="category"\s+dataKey="name"/);
  assert.match(page, /scholarCountChartHeight/);
  assert.match(page, /active scholar\(s\) across/);
});
