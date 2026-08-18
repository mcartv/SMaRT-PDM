const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

test('landing theme uses a dedicated public realtime namespace', () => {
  const hook = read('frontend/src/hooks/useLandingTheme.js');
  const server = read('backend/server/server.js');
  const controller = read('backend/controllers/themeSettingController.js');
  const socketEvents = read('backend/utils/socketEvents.js');

  assert.match(hook, /io\(getPublicSocketUrl\(\)/);
  assert.match(hook, /landing-theme:updated/);
  assert.doesNotMatch(hook, /useSocketEvent\(/);

  assert.match(server, /io\.use\(createStaffSocketAuthMiddleware\(\)\)/);
  assert.match(server, /io\.of\('\/public'\)/);
  assert.match(controller, /result\.portal_key === 'landing'/);
  assert.match(controller, /socketEvents\.landingThemeUpdated/);
  assert.match(socketEvents, /io\.of\('\/public'\)\.emit\(eventName, payload\)/);
});
