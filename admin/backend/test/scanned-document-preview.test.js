const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

for (const [service, documentKey] of [['gradeOcrV2Service', 'student_grade_forms'], ['indigencyOcrV2Service', 'certificate_of_indigency']]) {
  function fixture(overrides = {}, corrupt = false) {
    let downloads = 0;
    const bytes = Buffer.from('test captured image');
    const request = { application_id: 'application', document_key: documentKey, ocr_version: 'v2', status: 'review_required', ...overrides };
    const mocks = {
      crypto,
      '../config/db': { query: async () => ({ rows: [{ mime_type: 'image/png', bucket_name: 'private', object_path: 'capture', byte_count: bytes.length, sha256: corrupt ? 'bad' : crypto.createHash('sha256').update(bytes).digest('hex') }] }) },
      '../config/supabase': { storage: { from: () => ({ download: async () => { downloads++; return { data: { arrayBuffer: async () => bytes } }; } }) } },
      './iotOcrRequestService': { getRequestById: async () => request },
    };
    const context = { exports: {}, module: { exports: {} }, require: (name) => { if (!(name in mocks)) throw new Error(name); return mocks[name]; }, process: { env: {} }, Buffer, console };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../services', `${service}.js`), 'utf8'), context);
    return { run: () => context.module.exports.streamOriginal({ requestId: 'request', applicationId: 'application' }), downloads: () => downloads };
  }
  test(`${service}: returns original for review and completed requests`, async () => {
    for (const status of ['review_required', 'completed']) {
      const f = fixture({ status }); const image = await f.run();
      assert.equal(image.mime_type, 'image/png'); assert.equal(image.bytes.toString(), 'test captured image');
    }
  });
  test(`${service}: rejects another application, document, version or pending request before storage access`, async () => {
    for (const overrides of [{ application_id: 'other' }, { document_key: 'birth_certificate' }, { ocr_version: 'v1' }, { status: 'processing' }]) {
      const f = fixture(overrides); await assert.rejects(f.run(), { statusCode: 404 }); assert.equal(f.downloads(), 0);
    }
  });
  test(`${service}: refuses corrupt captures`, async () => {
    await assert.rejects(fixture({}, true).run(), { statusCode: 409 });
  });
}
