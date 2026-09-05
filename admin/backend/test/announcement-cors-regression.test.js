const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('announcement idempotency header is accepted by CORS preflight', () => {
  const server = read('admin/backend/server/server.js');
  const announcements = read('admin/frontend/src/pages/AnnouncementsManagement.jsx');

  assert.match(announcements, /'Idempotency-Key':\s*crypto\.randomUUID\(\)/);
  assert.match(server, /const allowedHeaders\s*=\s*\[[\s\S]*?'Idempotency-Key'/);
  assert.match(server, /allowedHeaders,\s*\n\s*optionsSuccessStatus:\s*204/);
  assert.match(server, /Access-Control-Allow-Headers',\s*allowedHeaders\.join/);
});
