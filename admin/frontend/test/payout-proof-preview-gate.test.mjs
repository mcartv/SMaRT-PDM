import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(here, '..', 'src', 'components', 'payout', 'PayoutProofReviewPanel.jsx'),
  'utf8'
);

test('verification is gated by the selected proof identifier', () => {
  assert.match(source, /openedProofId === selected\.payout_proof_id|openedProofId !== selected\.payout_proof_id/);
  assert.match(source, /setOpenedProofId\(selected\.payout_proof_id\)/);
  assert.match(source, /disabled=\{saving \|\| openedProofId !== selected\.payout_proof_id\}/);
});

test('preview state resets when selection closes, changes, or completes', () => {
  const resets = source.match(/setOpenedProofId\(null\)/g) || [];
  assert.ok(resets.length >= 3);
  assert.match(source, /This is a review reminder, not an audit record/);
});
