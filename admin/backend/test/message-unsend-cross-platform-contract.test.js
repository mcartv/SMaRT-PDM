const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('web and mobile expose sender-only message unsend', () => {
  const adminRoutes = read('admin', 'backend', 'routes', 'messageRoutes.js');
  const mobileRoutes = read('mobile', 'backend', 'src', 'routes', 'messageRoutes.js');
  const adminService = read('admin', 'backend', 'services', 'messageService.js');
  const mobileService = read('mobile', 'backend', 'src', 'services', 'messageService.js');

  assert.match(adminRoutes, /message\/:messageId\/unsend/);
  assert.match(mobileRoutes, /message\/:messageId\/unsend/);
  assert.match(adminService, /You can only unsend your own messages/);
  assert.match(mobileService, /You can only unsend your own messages/);
  assert.match(adminService, /This message was unsent/);
  assert.match(mobileService, /This message was unsent/);
});

test('clients render unsent state and mobile action notices have no dividers', () => {
  const adminUi = read('admin', 'frontend', 'src', 'pages', 'AdminMessages.jsx');
  const mobileUi = read(
    'mobile', 'frontend', 'lib', 'features', 'messaging', 'presentation', 'screens',
    'messaging_screen.dart'
  );
  const systemBranch = mobileUi.slice(
    mobileUi.indexOf("if (message.subject?.toLowerCase() == 'system')"),
    mobileUi.indexOf('final isDark', mobileUi.indexOf("if (message.subject?.toLowerCase() == 'system')"))
  );

  assert.match(adminUi, /Unsend message\?/);
  assert.match(mobileUi, /Unsend message\?/);
  assert.doesNotMatch(systemBranch, /Divider\(/);
  assert.match(mobileUi, /class _DateDivider/);
  assert.match(mobileUi, /child: Divider/);
});
