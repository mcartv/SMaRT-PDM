const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GEMINI_API_KEY = 'test-only-key';
process.env.GEMINI_MODEL = 'gemini-test-model';

for (const relative of [
    '../config/db',
    '../config/supabase',
    '../services/iotOcrRequestService',
]) {
    const resolved = require.resolve(relative);
    require.cache[resolved] = {
        id: resolved,
        filename: resolved,
        loaded: true,
        exports: {},
    };
}

let handler = async () => ({ text: '' });
class GoogleGenAI {
    constructor() {
        this.models = {
            generateContent: (request) => handler(request),
        };
    }
}
const genaiPath = require.resolve('@google/genai');
require.cache[genaiPath] = {
    id: genaiPath,
    filename: genaiPath,
    loaded: true,
    exports: { GoogleGenAI },
};

const servicePath = require.resolve('../services/birthOcrV2Service');
delete require.cache[servicePath];
const service = require('../services/birthOcrV2Service');

const cells = service.CELL_KEYS.map((cellKey) => ({
    cell_key: cellKey,
    mime_type: 'image/png',
    bytes: Buffer.from(`image-${cellKey}`),
}));

function flatFields(overrides = {}) {
    return {
        child_first_name: 'VENICE EVE',
        child_middle_name: '',
        child_last_name: 'PELIMA',
        mothers_maiden_first: 'ROWENA',
        mothers_maiden_middle: 'FRANCISCO',
        mothers_maiden_last: 'PELIMA',
        father_first_name: '',
        father_middle_name: '',
        father_last_name: '',
        ...overrides,
    };
}

function fullPageResponse(rawText, fields = flatFields()) {
    return JSON.stringify({
        template_id: 'psa_birth_v1',
        raw_text: rawText,
        fields,
    });
}

function promptText(request) {
    return request.contents[0].parts
        .filter((part) => typeof part.text === 'string')
        .map((part) => part.text).join(' ');
}

test('incomplete nine-cell result recovers Child and Mother in parallel row calls', async () => {
    handler = async (request) => {
        const prompt = promptText(request);
        if (prompt.includes('Item 1, the Child name row')) {
            return { text: JSON.stringify({
                first_name: 'VENICE EVE', middle_name: '', last_name: 'PELIMA',
            }) };
        }
        if (prompt.includes("Item 6, the Mother's maiden name row")) {
            return { text: JSON.stringify({
                first_name: 'ROWENA', middle_name: 'FRANCISCO', last_name: 'PELIMA',
            }) };
        }
        return { text: JSON.stringify({
            template_id: 'psa_birth_v1',
            fields: Object.fromEntries(service.RESPONSE_KEYS.map((key) => [key, ''])),
        }) };
    };

    const result = await service.callGemini(cells);

    assert.equal(result.ok, true);
    assert.equal(result.recovered, true);
    assert.equal(result.value.child_first_name, 'VENICE EVE');
    assert.equal(result.value.child_last_name, 'PELIMA');
    assert.equal(result.value.mothers_maiden_first, 'ROWENA');
    assert.equal(result.value.mothers_maiden_last, 'PELIMA');
    assert.equal(result.value.father_first_name, '');
});

test('full-page extraction preserves literal transcription and recovery fields', async () => {
    const expected = '\nOFFICE OF THE CIVIL REGISTRAR\nCERTIFICATE OF LIVE BIRTH\n';
    handler = async (request) => {
        assert.equal(request.config.responseMimeType, 'application/json');
        assert.ok(request.config.responseJsonSchema);
        return { text: fullPageResponse(expected) };
    };

    const result = await service.callGeminiFullPage({
        mime_type: 'image/jpeg',
        bytes: Buffer.from('private-original'),
    });

    assert.equal(result.ok, true);
    assert.equal(result.value.raw_text, expected);
    assert.deepEqual(result.value.fields, flatFields());
});

test('diagnostic rate limits produce an actionable sanitized code', async () => {
    handler = async () => {
        const error = new Error('sensitive provider message');
        error.status = 429;
        throw error;
    };

    const result = await service.callGeminiFullPage({
        mime_type: 'image/jpeg',
        bytes: Buffer.from('private-original'),
    });

    assert.deepEqual(result, { ok: false, code: 'GEMINI_FULL_PAGE_RATE_LIMITED' });
});

test('unavailable configured model falls back to the current stable model', async () => {
    const requestedModels = [];
    handler = async (request) => {
        requestedModels.push(request.model);
        if (request.model === 'gemini-test-model') {
            const error = new Error('model unavailable');
            error.status = 404;
            throw error;
        }
        return { text: fullPageResponse('literal full-page transcription') };
    };

    const result = await service.callGeminiFullPage({
        mime_type: 'image/jpeg',
        bytes: Buffer.from('private-original'),
    });

    assert.equal(result.ok, true);
    assert.equal(result.value.raw_text, 'literal full-page transcription');
    assert.deepEqual(requestedModels.slice(0, 2), [
        'gemini-test-model',
        'gemini-3.6-flash',
    ]);
});

test('exact-cell fields win while full-page text remains the immutable raw value', () => {
    const selected = service.selectBirthV2Candidate({
        cellGemini: { ok: true, value: flatFields({ child_first_name: 'CELL CHILD' }) },
        fullPageGemini: {
            ok: true,
            value: {
                raw_text: 'literal full-page text',
                fields: flatFields({ child_first_name: 'FULL PAGE CHILD' }),
            },
        },
    });

    assert.equal(selected.raw_text, 'literal full-page text');
    assert.equal(selected.fields.child_name.components.first_name, 'CELL CHILD');
    assert.equal(selected.structured_value_source, 'birth_v2_exact_cells_gemini');
    assert.equal(selected.diagnostic_only, false);
    assert.ok(selected.validation_issues.some((issue) => (
        issue.code === 'BIRTH_V2_SOURCE_DISAGREEMENT' && issue.field === 'child_name'
    )));
});

test('full-page fields recover a confirmable candidate when exact cells are unavailable', () => {
    const selected = service.selectBirthV2Candidate({
        cellGemini: { ok: false, code: 'PSA_BIRTH_V2_TOPOLOGY_MISMATCH' },
        fullPageGemini: {
            ok: true,
            value: { raw_text: 'complete literal transcription', fields: flatFields() },
        },
        diagnosticResult: { message: 'Birth topology failed.' },
    });

    assert.equal(selected.diagnostic_only, false);
    assert.equal(selected.structured_value_source, 'birth_v2_full_page_gemini_recovery');
    assert.equal(selected.fields.mother_maiden_name.components.first_name, 'ROWENA');
    assert.ok(selected.validation_issues.some((issue) => issue.code === 'BIRTH_V2_FULL_PAGE_RECOVERY_USED'));
});

test('valid exact cells stay confirmable when full-page transcription is unavailable', () => {
    const selected = service.selectBirthV2Candidate({
        cellGemini: { ok: true, value: flatFields() },
        fullPageGemini: { ok: false, code: 'GEMINI_FULL_PAGE_TIMEOUT' },
    });

    assert.equal(selected.diagnostic_only, false);
    assert.equal(selected.raw_text, '');
    assert.equal(selected.structured_value_source, 'birth_v2_exact_cells_gemini');
    assert.ok(selected.validation_issues.some((issue) => issue.code === 'GEMINI_FULL_PAGE_TIMEOUT'));
});

test('both structured paths failing produces a diagnostic-only candidate', () => {
    const selected = service.selectBirthV2Candidate({
        cellGemini: { ok: false, code: 'GEMINI_REQUIRED_NAME_MISSING' },
        fullPageGemini: {
            ok: true,
            value: {
                raw_text: 'literal but incomplete transcription',
                fields: flatFields({ mothers_maiden_last: '' }),
            },
        },
    });

    assert.equal(selected.diagnostic_only, true);
    assert.deepEqual(selected.fields, {});
    assert.equal(selected.raw_text, 'literal but incomplete transcription');
});
