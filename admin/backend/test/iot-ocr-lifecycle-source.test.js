const fs = require('fs');
const path = require('path');

function read(relativePath) {
    return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

describe('IoT OCR durable lifecycle contract', () => {
    test('backend and Pi expose active lifecycle states', () => {
        const service = read('services/iotOcrRequestService.js');
        const routes = read('routes/piIotOcrRoutes.js');
        const migration = read('sql/20260804_fix_iot_ocr_request_and_snapshot_provenance.sql');
        for (const status of ['previewing', 'focusing', 'capturing', 'processing']) {
            expect(service).toContain(`'${status}'`);
            expect(migration).toContain(`'${status}'`);
        }
        expect(service).toContain('updateRequestStatus');
        expect(routes).toContain('/:requestId/status');
        expect(service).not.toContain('Superseded by a newer IoT OCR request');
    });
});
