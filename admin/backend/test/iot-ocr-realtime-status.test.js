const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Pi lifecycle endpoints emit request-bound OCR status events', () => {
    const controller = fs.readFileSync(
        path.resolve(__dirname, '../controllers/piIotOcrController.js'),
        'utf8'
    );
    const events = fs.readFileSync(
        path.resolve(__dirname, '../utils/socketEvents.js'),
        'utf8'
    );
    assert.match(events, /applicationOcrStatus:.*application-ocr:status/);
    assert.match(controller, /applicationOcrStatus/);
    assert.match(controller, /application_id: result\.application_id/);
    assert.match(controller, /status: result\.status/);
});
