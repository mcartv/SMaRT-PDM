const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('only OSFA/Admin can download an endorsement slip PDF', () => {
  const routes = read('backend/routes/endorsementSlipRoutes.js');

  assert.match(
    routes,
    /router\.get\('\/:slipId\/pdf', protect, authorizeRoles\('admin'\), endorsementSlipController\.downloadSlipPdf\)/,
  );
});

test('office endorsement views hide the download action', () => {
  const detail = read('frontend/src/pages/EndorsementSlipDetail.jsx');

  assert.match(
    detail,
    /\{isAdminView \? \([\s\S]*?onClick=\{handleDownloadSlip\}[\s\S]*?Download PDF[\s\S]*?\) : null\}/,
  );
});
