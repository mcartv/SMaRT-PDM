const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeOcrComparisonValue,
  compareOcrValues,
  evidenceState,
  overallEvidenceState,
} = require('../services/ocrComparison');
const fs = require('node:fs');

test('OCR comparison normalization preserves raw values and distinguishes exact matches', () => {
  assert.equal(normalizeOcrComparisonValue('MARIA  SANTOS'), 'MARIA SANTOS');
  assert.equal(compareOcrValues('MARIA  SANTOS', 'Maria Santos'), 'normalized_match');
  assert.equal(compareOcrValues('ANA-MARIE CRUZ', 'ANA - MARIE CRUZ'), 'normalized_match');
  assert.equal(compareOcrValues('JUAN CRUZ', 'JUAN DELA CRUZ'), 'different');
  assert.equal(compareOcrValues('PEÑA', 'PENA'), 'different');
  assert.equal(compareOcrValues('same', 'same'), 'exact');
});

test('OCR evidence states are deterministic and conservative', () => {
  assert.equal(evidenceState({ primary: 'MARIA  SANTOS', supporting: 'Maria Santos' }), 'confirmed');
  assert.equal(evidenceState({ primary: 'MARIA SANTOS', supporting: '', supportingAvailable: false }), 'partial');
  assert.equal(evidenceState({ primary: 'JUAN CRUZ', supporting: 'JUAN DELA CRUZ' }), 'conflict');
  assert.equal(evidenceState({ primary: '', supporting: '', supportingAvailable: true }), 'incomplete');
  assert.equal(evidenceState({ primary: '', supporting: '', supportingAvailable: false }), 'unavailable');
  assert.equal(overallEvidenceState({ child_name: { state: 'confirmed' }, father_name: { state: 'conflict' } }), 'conflict');
});

test('Birth candidate stores evidence metadata in processing without changing raw OCR fields', () => {
  const source = fs.readFileSync(require.resolve('../services/birthOcrV2Service'), 'utf8');
  assert.match(source, /evidence: birthEvidence/);
  assert.match(source, /evidence: selected\.evidence/);
  assert.match(source, /raw_text: rawText/);
  assert.match(source, /BIRTH_V2_SOURCE_DISAGREEMENT/);
});
