const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSection, validateSection } = require('../src/validation/applicationSection');

test('A-D are accepted, including lowercase, while E is rejected in drafts and submissions', () => {
  for (const value of ['A', 'B', 'C', 'D', ' a ']) {
    assert.doesNotThrow(() => validateSection({ current_section: value }, { required: true }));
  }
  for (const field of ['current_section', 'section']) {
    assert.throws(() => validateSection({ [field]: 'E' }), { statusCode: 400 });
    assert.throws(() => validateSection({ [field]: 'E' }, { required: true }), { statusCode: 400 });
  }
  assert.doesNotThrow(() => validateSection(null));
  assert.throws(() => validateSection({}, { required: true }), { statusCode: 400 });
  assert.equal(normalizeSection('E'), '');
  assert.equal(normalizeSection(' b '), 'B');
});
