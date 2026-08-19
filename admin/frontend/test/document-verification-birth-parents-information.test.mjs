import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

globalThis.window = { location: { origin: 'http://localhost' } };
globalThis.sessionStorage = { getItem: () => null };

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

const {
  buildBirthParentsInformation,
  compareBirthParentNames,
} = await vite.ssrLoadModule('/src/pages/DocumentVerification.jsx');

after(async () => {
  await vite.close();
});

test('Birth parent comparison normalizes formatting without hiding real name differences', () => {
  assert.equal(
    compareBirthParentNames(
      'Carolyn Veloso Domingo',
      'CAROLYN VELOSO, DOMINGO'
    ).status,
    'MATCHED'
  );

  assert.equal(
    compareBirthParentNames(
      'Carolyn Veloso Domingo',
      'Carolyn Reyes Domingo'
    ).status,
    'DIFFERENCE FOUND'
  );

  assert.equal(
    compareBirthParentNames(
      'Arnold Sarmiento',
      'N/A'
    ).status,
    'NOT COMPARABLE'
  );

  assert.equal(
    compareBirthParentNames(
      '',
      'NOT APPLICABLE'
    ).status,
    'MATCHED'
  );
});

test('Parents Information compares only Mother and Father and preserves admin status', () => {
  const result = buildBirthParentsInformation({
    application: {
      family_members: [
        {
          relation: 'Mother',
          first_name: 'Carolyn',
          middle_name: 'Veloso',
          last_name: 'Domingo',
        },
        {
          relation: 'Father',
          first_name: 'Arnold',
          middle_name: '',
          last_name: 'Sarmiento',
        },
      ],
    },
    birthFields: {
      mother_maiden_name: {
        first_name: 'CAROLYN',
        middle_name: 'VELOSO',
        last_name: 'DOMINGO',
      },
      father_name: {
        first_name: '',
        middle_name: '',
        last_name: '',
        section_status: 'not_applicable',
      },
    },
    hasBirthEvidence: true,
    adminStatus: 'PENDING VERIFICATION',
  });

  assert.equal(result.admin_status, 'PENDING VERIFICATION');
  assert.deepEqual(
    result.parents.map((parent) => [
      parent.relation,
      parent.comparison,
    ]),
    [
      ['Mother', 'MATCHED'],
      ['Father', 'NOT COMPARABLE'],
    ]
  );
});

test('no-parent markers are equivalent while a concrete applicant parent remains not comparable', () => {
  for (const emptyMarker of ['', 'N/A', 'NONE', 'NOT APPLICABLE', 'NOT LISTED']) {
    assert.equal(
      compareBirthParentNames('', emptyMarker).status,
      'MATCHED'
    );
  }

  assert.equal(
    compareBirthParentNames('Mark John Sarmiento', 'NOT LISTED').status,
    'NOT COMPARABLE'
  );
});
