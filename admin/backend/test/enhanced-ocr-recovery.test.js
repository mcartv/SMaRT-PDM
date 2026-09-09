const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const errors = require('../services/enhancedOcrErrors');
function load(name, mocks, env = {}) {
  const exports = {};
  const context = { exports, module: { exports }, Buffer, process: { env }, require: (key) => {
    if (!(key in mocks)) throw new Error(`Unexpected dependency ${key}`);
    return mocks[key];
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services', name + '.js'), 'utf8'), context);
  return context.module.exports;
}
function provider(response, failure, env = { GEMINI_API_KEY: 'fake-test-key' }) {
  let call;
  const service = load('enhancedOcrProvider', {
    './enhancedOcrErrors': errors,
    '@google/genai': { GoogleGenAI: class { models = { generateContent: async (input) => { call = input; if (failure) throw failure; return response; } }; } },
  }, env);
  return { run: () => service.extract({ documentType: 'student_grade_forms', instruction: 'Read literally', image: { mime_type: 'image/png', bytes: Buffer.from('fixture') }, schema: { properties: { fields: { required: ['gwa'] } } } }), call: () => call };
}
test('provider accepts complete structured results with a bounded timeout and larger output budget', async () => {
  const p = provider({ text: JSON.stringify({ raw_text: 'GWA 1.50', fields: { gwa: '1.50' } }) });
  assert.equal((await p.run()).fields.gwa, '1.50');
  assert.equal(p.call().config.httpOptions.timeout, 120000);
  assert.equal(p.call().config.maxOutputTokens, 16384);
});
test('provider rejects truncated, malformed, missing-field and empty responses', async () => {
  for (const [response, code] of [
    [{ candidates: [{ finishReason: 'MAX_TOKENS' }], text: '{' }, 'ENHANCED_OCR_TRUNCATED'],
    [{ text: '{' }, 'ENHANCED_OCR_INVALID_RESPONSE'],
    [{ text: '{}' }, 'ENHANCED_OCR_INVALID_RESPONSE'],
    [{ text: JSON.stringify({ raw_text: 'text', fields: {} }) }, 'ENHANCED_OCR_INVALID_RESPONSE'],
    [{ text: JSON.stringify({ raw_text: '', fields: { gwa: '' } }) }, 'ENHANCED_OCR_EMPTY_RESPONSE'],
    [{ text: '' }, 'ENHANCED_OCR_EMPTY_RESPONSE'],
  ]) await assert.rejects(provider(response).run(), { code });
});
test('provider errors retain safe actionable codes without raw credential or document text', async () => {
  for (const [status, code] of [[400, 'ENHANCED_OCR_INVALID_REQUEST'], [403, 'ENHANCED_OCR_AUTH_FAILED'], [404, 'ENHANCED_OCR_MODEL_UNAVAILABLE'], [429, 'ENHANCED_OCR_RATE_LIMITED'], [503, 'ENHANCED_OCR_PROVIDER_FAILED']]) {
    await assert.rejects(provider(null, Object.assign(new Error('secret applicant data and key'), { status })).run(), (error) => {
      assert.equal(error.code, code);
      assert.equal(errors.normalizeEnhancedOcrError(error).providerStatus, status);
      assert.doesNotMatch(error.message, /secret|applicant data/); return true;
    });
  }
  await assert.rejects(provider(null, null, {}).run(), { code: 'ENHANCED_OCR_NOT_CONFIGURED' });
});
for (const [name, key] of [['gradeOcrV2Service', 'student_grade_forms'], ['indigencyOcrV2Service', 'certificate_of_indigency']]) {
  function fixture(failure) {
    const events = [];
    const bytes = Buffer.from('capture');
    const row = { mime_type: 'image/png', byte_count: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    const service = load(name, {
      crypto, './enhancedOcrErrors': errors,
      '../config/db': { query: async (sql) => { events.push(sql.includes('UPDATE') ? 'available' : 'download'); return { rows: [row] }; } },
      '../config/supabase': { storage: { from: () => ({ download: async () => ({ data: { arrayBuffer: async () => bytes } }) }) } },
      './enhancedOcrProvider': { extract: async () => { events.push('extract'); if (failure) throw failure; return { raw_text: 'GWA 1.5', fields: { gwa: '1.5' }, model: 'test-model' }; } },
      './iotOcrRequestService': {
        getRequestById: async () => ({ document_key: key, ocr_version: 'v2', status: 'processing', claimed_by: 'device' }),
        completeRequest: async (input) => { events.push(input); return { request: { status: input.status }, candidate: input.status === 'review_required' ? input : null }; },
      },
    });
    return { service, events, run: () => service.completeUploads({ requestId: 'request', deviceId: 'device' }) };
  }
  test(`${name}: marks capture available and returns an actual review candidate`, async () => {
    const f = fixture(); const result = await f.run();
    assert.equal(result.request.status, 'review_required');
    assert.equal(result.candidate.processing.ocr_version, 'v2');
    assert.deepEqual(f.events.slice(0, 3), ['download', 'available', 'extract']);
    if (key === 'student_grade_forms') {
      assert.equal(result.candidate.fields.gwa.normalized_value, '1.5');
      assert.ok(Object.keys(f.service.GRADE_SCHEMA.properties.subjects.items.properties).length > 0);
    }
  });
  test(`${name}: preserves capture and saves sanitized provider failure without a fake candidate`, async () => {
    const f = fixture(Object.assign(new Error('private provider detail'), { status: 429 }));
    await assert.rejects(f.run(), { code: 'ENHANCED_OCR_RATE_LIMITED' });
    assert.equal(f.events[1], 'available');
    const result = f.events.at(-1);
    assert.equal(result.status, 'failed'); assert.equal(result.errorCode, 'ENHANCED_OCR_RATE_LIMITED');
    assert.doesNotMatch(result.errorMessage, /private provider detail/);
  });
}

test('grade completion failure emits failed status and uses grade diagnostics without leaking provider data', async () => {
  const emissions = []; const logs = [];
  const failure = Object.assign(new Error('private provider body'), {
    code: 'ENHANCED_OCR_RATE_LIMITED', statusCode: 502, providerStatus: 429,
    request: { request_id: 'request', application_id: 'application', status: 'failed' },
  });
  const mocks = {
    '../services/iotOcrRequestService': { getRequestById: async () => ({ document_key: 'student_grade_forms', ocr_version: 'v2' }) },
    '../services/iotOcrSchemaService': {}, '../services/auditLogService': {},
    '../utils/socketEvents': { applicationOcrStatus: (_io, data) => emissions.push(data) },
    '../services/iotOcrPresenceService': { checkIn: () => {} },
    '../services/gradeOcrV2Service': { completeUploads: async () => { throw failure; } },
    '../services/enhancedOcrErrors': errors,
  };
  const context = { exports: {}, require: (key) => { assert.ok(key in mocks, key); return mocks[key]; }, console: { error: (...args) => logs.push(args) } };
  context.module = { exports: context.exports };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../controllers/piIotOcrController.js'), 'utf8'), context);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await context.exports.completeBirthV2Uploads({ params: { requestId: 'request' }, piAuth: { deviceId: 'device' } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.code, 'ENHANCED_OCR_RATE_LIMITED');
  assert.equal(emissions[0].status, 'failed');
  assert.equal(emissions[0].document_key, 'student_grade_forms');
  assert.equal(logs[0][0], 'ENHANCED_OCR_UPLOAD_COMPLETION_ERROR');
  assert.equal(logs[0][1].provider_status, 429);
  assert.doesNotMatch(JSON.stringify({ body: res.body, logs }), /private provider body/);
});
