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
            raw_text: '',
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

test('full-page diagnostic requests and preserves plain transcription text', async () => {
    const expected = 'OFFICE OF THE CIVIL REGISTRAR\nCERTIFICATE OF LIVE BIRTH';
    handler = async (request) => {
        assert.equal(request.config.responseMimeType, undefined);
        assert.equal(request.config.responseJsonSchema, undefined);
        return { text: expected };
    };

    const result = await service.callGeminiFullPage({
        mime_type: 'image/jpeg',
        bytes: Buffer.from('private-original'),
    });

    assert.deepEqual(result, { ok: true, value: expected });
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

    assert.deepEqual(result, { ok: false, code: 'GEMINI_DIAGNOSTIC_RATE_LIMITED' });
});
