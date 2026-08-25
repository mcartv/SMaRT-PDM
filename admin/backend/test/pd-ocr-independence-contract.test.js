const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

test('PD backend has no Grade OCR validation prerequisite', () => {
    const service = read('services/endorsementSlipService.js');
    const actionSection = service.slice(service.indexOf('async function applyStageAction'));
    assert.doesNotMatch(actionSection, /grade_validation|ocr_missing|ocr_failed|gwa_missing|gwa_invalid|OCR grade validation/i);
    assert.match(actionSection, /gradeDocumentResult/);
});

test('PD database migration removes only the blocking trigger', () => {
    const migration = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'supabase', 'migrations', '20260825200000_remove_pd_grade_ocr_endorsement_gate.sql'), 'utf8');
    assert.match(migration, /drop trigger if exists trg_enforce_pd_grade_validation/i);
    assert.doesNotMatch(migration, /delete from|truncate|drop table/i);
});

test('PD does not receive a duplicate applicant-entered GWA field', () => {
    const service = read('services/endorsementSlipService.js');
    assert.doesNotMatch(service, /applicant_gwa:/);
});
