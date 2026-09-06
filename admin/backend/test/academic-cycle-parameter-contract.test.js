'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('closing openings compares UUID columns with bound UUID parameters', () => {
  const service = read('backend/services/academicYearService.js');

  assert.match(service, /period_id IS DISTINCT FROM \$\$\{params\.length\}/);
  assert.match(service, /academic_year_id IS DISTINCT FROM \$\$\{params\.length\}/);
  assert.doesNotMatch(service, /period_id IS DISTINCT FROM \$\{params\.length\}/);
  assert.doesNotMatch(service, /academic_year_id IS DISTINCT FROM \$\{params\.length\}/);
});
