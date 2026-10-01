'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateRegistryIdentity,
} = require('../services/studentRegistryIdentity');

const existing = {
  student_number: 'PDM-2026-000125',
  learners_reference_number: '123456789012',
  first_name: 'Juan',
  middle_name: 'Santos',
  last_name: 'Dela Cruz',
  date_of_birth: '2008-05-20',
};

function incoming(overrides = {}) {
  return {
    student_number: 'PDM-2026-000125',
    learners_reference_number: '123456789012',
    given_name: 'Juan',
    middle_name: 'Santos',
    last_name: 'Dela Cruz',
    date_of_birth: '2008-05-20',
    ...overrides,
  };
}

test('same PDM ID and same LRN allows a normal update', () => {
  assert.equal(evaluateRegistryIdentity(existing, incoming()).conflict, false);
});

test('same LRN allows a legitimate first and middle name correction', () => {
  const result = evaluateRegistryIdentity(
    existing,
    incoming({ given_name: 'Juan Miguel', middle_name: 'Santos D.' })
  );
  assert.equal(result.conflict, false);
  assert.equal(result.basis, 'matching_lrn');
});

test('different nonblank LRN rejects a different identity', () => {
  const result = evaluateRegistryIdentity(
    existing,
    incoming({
      learners_reference_number: '987654321012',
      given_name: 'Maria Anne',
      middle_name: null,
      last_name: 'Reyes',
      date_of_birth: '2007-10-04',
    })
  );
  assert.equal(result.conflict, true);
  assert.equal(result.basis, 'different_lrn');
});

test('matching birthday never overrides a different LRN and identity', () => {
  const result = evaluateRegistryIdentity(
    existing,
    incoming({
      learners_reference_number: '987654321012',
      given_name: 'Maria Anne',
      last_name: 'Reyes',
    })
  );
  assert.equal(result.conflict, true);
  assert.match(result.reason, /matching birthday alone is not sufficient/i);
});

test('same name under a different PDM ID is not an identity conflict', () => {
  const result = evaluateRegistryIdentity(
    {},
    incoming({ student_number: 'PDM-2026-000842' })
  );
  assert.equal(result.conflict, false);
});

test('missing LRN with matching normalized name and DOB allows correction', () => {
  const result = evaluateRegistryIdentity(
    { ...existing, learners_reference_number: null },
    incoming({
      learners_reference_number: null,
      given_name: '  JUAN ',
      last_name: 'Dela-Cruz',
    })
  );
  assert.equal(result.conflict, false);
  assert.equal(result.basis, 'supporting_name_match');
});

test('missing LRN with a completely different name rejects even when DOB matches', () => {
  const result = evaluateRegistryIdentity(
    { ...existing, learners_reference_number: null },
    incoming({
      learners_reference_number: null,
      given_name: 'Maria Anne',
      last_name: 'Reyes',
    })
  );
  assert.equal(result.conflict, true);
  assert.equal(result.basis, 'different_name_without_lrn');
  assert.match(result.reason, /matching birthday alone is not sufficient/i);
});

test('single-part, spelling, middle-name, and formatting corrections are not over-blocked', () => {
  const cases = [
    incoming({ given_name: 'Jhon', learners_reference_number: null }),
    incoming({ last_name: 'de la Cruz', learners_reference_number: null }),
    incoming({ middle_name: 'Miguel', learners_reference_number: null }),
  ];
  const withoutLrn = { ...existing, learners_reference_number: null };
  for (const row of cases) {
    assert.equal(evaluateRegistryIdentity(withoutLrn, row).conflict, false);
  }
});

test('minor spelling corrections in both name parts are allowed when DOB also matches', () => {
  const result = evaluateRegistryIdentity(
    { ...existing, learners_reference_number: null },
    incoming({
      learners_reference_number: null,
      given_name: 'Juhn',
      last_name: 'Dela Crus',
    })
  );
  assert.equal(result.conflict, false);
  assert.equal(result.basis, 'supporting_name_match');
});


test('missing LRN does not let a matching first name hide a conflicting surname and DOB', () => {
  const result = evaluateRegistryIdentity(
    { ...existing, learners_reference_number: null },
    incoming({
      learners_reference_number: null,
      last_name: 'Reyes',
      date_of_birth: '2007-10-04',
    })
  );
  assert.equal(result.conflict, true);
  assert.equal(result.basis, 'different_name_without_lrn');
});

test('missing LRN does not let a matching surname hide a conflicting first name and DOB', () => {
  const result = evaluateRegistryIdentity(
    { ...existing, learners_reference_number: null },
    incoming({
      learners_reference_number: null,
      given_name: 'Maria Anne',
      date_of_birth: '2007-10-04',
    })
  );
  assert.equal(result.conflict, true);
  assert.equal(result.basis, 'different_name_without_lrn');
});

test('with only one comparable name part, matching DOB is also required', () => {
  const existingPartial = {
    ...existing,
    learners_reference_number: null,
    last_name: null,
  };

  const allowed = evaluateRegistryIdentity(
    existingPartial,
    incoming({ learners_reference_number: null, last_name: null })
  );
  assert.equal(allowed.conflict, false);

  const rejected = evaluateRegistryIdentity(
    existingPartial,
    incoming({
      learners_reference_number: null,
      last_name: null,
      date_of_birth: '2007-10-04',
    })
  );
  assert.equal(rejected.conflict, true);
});
