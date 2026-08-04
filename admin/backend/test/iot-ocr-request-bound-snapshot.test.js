const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const {
  isRequestBoundSnapshotFresh,
} = require('../utils/iotOcrSnapshotFreshness');

test('pending, failed, and cancelled requests never expose an old OCR row', () => {
  const ocrRow = {
    updated_at: '2026-08-03T12:00:00.000Z',
  };

  for (const status of ['pending', 'claimed', 'failed', 'cancelled']) {
    assert.equal(
      isRequestBoundSnapshotFresh({
        request: {
          status,
          created_at: '2026-08-03T11:59:00.000Z',
        },
        ocrRow,
      }),
      false
    );
  }
});

test('completed request rejects a snapshot older than the request', () => {
  assert.equal(
    isRequestBoundSnapshotFresh({
      request: {
        status: 'completed',
        created_at: '2026-08-03T12:10:00.000Z',
      },
      ocrRow: {
        updated_at: '2026-08-03T12:00:00.000Z',
      },
    }),
    false
  );
});

test('completed request accepts only a snapshot updated after request creation', () => {
  assert.equal(
    isRequestBoundSnapshotFresh({
      request: {
        status: 'completed',
        created_at: '2026-08-03T12:00:00.000Z',
      },
      ocrRow: {
        updated_at: '2026-08-03T12:05:00.000Z',
      },
    }),
    true
  );
});

test('controller and service bind snapshot reads to request_id', () => {
  const controllerSource = readFileSync(
    join(__dirname, '../controllers/applicationController.js'),
    'utf8'
  );
  const serviceSource = readFileSync(
    join(__dirname, '../services/applicationService.js'),
    'utf8'
  );
  const requestServiceSource = readFileSync(
    join(__dirname, '../services/iotOcrRequestService.js'),
    'utf8'
  );

  assert.match(
    controllerSource,
    /requestId:\s*req\.query\?\.request_id\s*\|\|\s*null/
  );
  assert.match(serviceSource, /requested_request_id:/);
  assert.match(serviceSource, /snapshot_fresh:/);
  assert.match(serviceSource, /getRequestById\(\{/);
  assert.match(
    requestServiceSource,
    /exports\.getRequestById\s*=\s*async/
  );
});
