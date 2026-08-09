const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

function read(relativePath) {
    return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

test('backend, Pi, and canonical migration expose the durable lifecycle', () => {
    const service = read('services/iotOcrRequestService.js');
    const routes = read('routes/piIotOcrRoutes.js');
    const migration = fs.readFileSync(
        path.resolve(__dirname, '../../../supabase/migrations/20260809000100_canonical_iot_ocr_candidates.sql'),
        'utf8'
    );
    for (const status of [
        'pending', 'claimed', 'previewing', 'focusing', 'capturing', 'processing',
        'review_required', 'completed', 'cancelled', 'failed', 'expired',
    ]) {
        assert.match(service, new RegExp(`'${status}'`));
        assert.match(migration, new RegExp(`'${status}'`));
    }
    assert.match(service, /ALLOWED_TRANSITIONS/);
    assert.match(routes, /\/:requestId\/status/);
});
