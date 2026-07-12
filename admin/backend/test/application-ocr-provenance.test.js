const test = require('node:test');
const assert = require('node:assert/strict');

for (const dependency of [
  '../config/supabase',
  '../config/db',
  '../services/iotOcrRequestService',
]) {
  const dependencyPath = require.resolve(dependency);
  require.cache[dependencyPath] = {
    id: dependencyPath,
    filename: dependencyPath,
    loaded: true,
    exports: {},
  };
}

const {
  resolveIotExtractedName,
  resolveStoredExtractedName,
} = require('../services/applicationService');

test('IoT projection stores null when no extracted name exists', () => {
  const value = resolveStoredExtractedName({
    extractedFields: { fields: {} },
    scannedViaIot: true,
    existingExtractedName: 'Stale Profile Name',
    studentName: 'Application Student Name',
  });

  assert.equal(value, null);
});

test('IoT projection stores a real generic extracted name', () => {
  const value = resolveStoredExtractedName({
    extractedFields: { fields: { name: 'Venice Eve Pelima' } },
    scannedViaIot: true,
    existingExtractedName: 'Stale Profile Name',
    studentName: 'Application Student Name',
  });

  assert.equal(value, 'Venice Eve Pelima');
});

test('birth-certificate structured names are not flattened', () => {
  const value = resolveIotExtractedName({
    fields: {
      child_name: { first_name: 'Venice', middle_name: 'Eve', last_name: 'Pelima' },
      mother_maiden_name: { first_name: 'Maria' },
      father_name: { first_name: 'Pedro' },
    },
  });

  assert.equal(value, null);
});

test('non-IoT projection retains legacy fallback behavior', () => {
  assert.equal(
    resolveStoredExtractedName({
      extractedFields: {},
      scannedViaIot: false,
      existingExtractedName: 'Existing Manual Name',
      studentName: 'Application Student Name',
    }),
    'Existing Manual Name'
  );

  assert.equal(
    resolveStoredExtractedName({
      extractedFields: {},
      scannedViaIot: false,
      studentName: 'Application Student Name',
    }),
    'Application Student Name'
  );
});
