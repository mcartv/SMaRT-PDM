const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('mobile-facing guidance and privacy copy use personnel terminology', () => {
  const menu = read(
    'mobile/frontend/lib/features/menu/presentation/screens/mobile_menu_screen.dart',
  );
  const legal = read(
    'mobile/frontend/lib/core/constants/legal_documents.dart',
  );

  assert.doesNotMatch(menu, /\bstaff\b/i);
  assert.doesNotMatch(legal, /\bstaff\b/i);
  assert.match(menu, /faculty and school personnel/);
  assert.match(legal, /authorized OSFA personnel/);
});

test('support access errors use authorized personnel terminology', () => {
  const support = read('mobile/backend/src/controllers/supportController.js');

  assert.doesNotMatch(support, /Only staff accounts/i);
  assert.match(support, /Only authorized personnel accounts/);
});
