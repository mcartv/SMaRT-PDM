#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepo(start) {
  let dir = path.resolve(start);
  while (true) {
    const required = [
      path.join(dir, 'mobile', 'frontend', 'pubspec.yaml'),
      path.join(dir, 'mobile', 'frontend', 'lib', 'app', 'bootstrap.dart'),
      path.join(dir, 'mobile', 'frontend', 'lib', 'core', 'storage', 'session_service.dart'),
      path.join(dir, 'mobile', 'backend', 'package.json'),
      path.join(dir, 'mobile', 'backend', 'src', 'services', 'notificationService.js'),
      path.join(dir, 'mobile', 'backend', 'src', 'services', 'realtimeBridgeService.js'),
    ];
    if (required.every(fs.existsSync)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not find SMaRT-PDM repo root. Run from D:\\projects\\SMaRT-PDM.');
}

function n(text) {
  return String(text).replace(/\r\n/g, '\n');
}

function replaceOnce(text, oldText, newText, label) {
  if (text.includes(newText)) return text;
  const count = text.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`Preflight failed for ${label}: expected 1 match, found ${count}. No project files were written.`);
  }
  return text.replace(oldText, newText);
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}.`);
  }
}

function template(relative) {
  return fs.readFileSync(path.join(__dirname, 'templates', relative), 'utf8');
}

const repo = findRepo(process.cwd());
const mobileFrontend = path.join(repo, 'mobile', 'frontend');
const mobileBackend = path.join(repo, 'mobile', 'backend');

const files = {
  pubspec: path.join(mobileFrontend, 'pubspec.yaml'),
  pubspecLock: path.join(mobileFrontend, 'pubspec.lock'),
  settings: path.join(mobileFrontend, 'android', 'settings.gradle.kts'),
  appGradle: path.join(mobileFrontend, 'android', 'app', 'build.gradle.kts'),
  manifest: path.join(mobileFrontend, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
  main: path.join(mobileFrontend, 'lib', 'main.dart'),
  bootstrap: path.join(mobileFrontend, 'lib', 'app', 'bootstrap.dart'),
  app: path.join(mobileFrontend, 'lib', 'app', 'app.dart'),
  navigator: path.join(mobileFrontend, 'lib', 'app', 'routes', 'app_navigator.dart'),
  session: path.join(mobileFrontend, 'lib', 'core', 'storage', 'session_service.dart'),
  pushFrontend: path.join(mobileFrontend, 'lib', 'core', 'notifications', 'push_notification_service.dart'),
  notificationFrontend: path.join(mobileFrontend, 'lib', 'features', 'notifications', 'data', 'services', 'notification_service.dart'),
  provider: path.join(mobileFrontend, 'lib', 'features', 'notifications', 'presentation', 'providers', 'notification_provider.dart'),
  menu: path.join(mobileFrontend, 'lib', 'features', 'menu', 'presentation', 'screens', 'mobile_menu_screen.dart'),
  flutterTest: path.join(mobileFrontend, 'test', 'push_notifications_contract_test.dart'),

  packageJson: path.join(mobileBackend, 'package.json'),
  packageLock: path.join(mobileBackend, 'package-lock.json'),
  routes: path.join(mobileBackend, 'src', 'routes', 'notificationRoutes.js'),
  controller: path.join(mobileBackend, 'src', 'controllers', 'notificationController.js'),
  notificationBackend: path.join(mobileBackend, 'src', 'services', 'notificationService.js'),
  realtime: path.join(mobileBackend, 'src', 'services', 'realtimeBridgeService.js'),
  pushBackend: path.join(mobileBackend, 'src', 'services', 'pushNotificationService.js'),
  envPush: path.join(mobileBackend, '.env.push.example'),
  backendTest: path.join(mobileBackend, 'test', 'push-notifications-contract.test.js'),

  migration: path.join(repo, 'supabase', 'migrations', '20260824154500_add_mobile_push_device_tokens_and_delivery_claims.sql'),
};

const originals = new Map();
for (const file of Object.values(files)) {
  originals.set(file, fs.existsSync(file) ? fs.readFileSync(file) : null);
}

const sources = {};
for (const [key, file] of Object.entries(files)) {
  if (fs.existsSync(file) && !Buffer.isBuffer(originals.get(file))) continue;
  if (fs.existsSync(file)) sources[key] = n(fs.readFileSync(file, 'utf8'));
}

/* Precheck the real existing notification path. */
for (const [key, marker, label] of [
  ['session', '_pushDeviceTokenKey', 'SessionService push token cache'],
  ['notificationFrontend', 'registerStoredDeviceToken()', 'frontend device-token registration'],
  ['notificationBackend', "from('user_device_tokens')", 'backend device-token registration'],
  ['notificationBackend', 'push_sent', 'notifications.push_sent usage'],
  ['realtime', "table: 'notifications'", 'notification realtime bridge'],
  ['realtime', "table: 'messages'", 'message realtime bridge'],
]) {
  if (!sources[key]?.includes(marker)) {
    throw new Error(`Preflight failed: ${label} not found. No project files were written.`);
  }
}

/* ---------- Flutter ---------- */

if (!sources.main.includes('Future<void> main() async')) {
  sources.main = replaceOnce(
    sources.main,
    `void main() {
  bootstrapApp();
}`,
    `Future<void> main() async {
  await bootstrapApp();
}`,
    'async main'
  );
}

if (!sources.bootstrap.includes('push_notification_service.dart')) {
  sources.bootstrap = replaceOnce(
    sources.bootstrap,
    `import 'package:smartpdm_mobileapp/core/networking/connectivity_controller.dart';`,
    `import 'package:smartpdm_mobileapp/core/networking/connectivity_controller.dart';
import 'package:smartpdm_mobileapp/core/notifications/push_notification_service.dart';`,
    'push bootstrap import'
  );
}
sources.bootstrap = sources.bootstrap.replace(
  'void bootstrapApp() {',
  'Future<void> bootstrapApp() async {'
);
if (!sources.bootstrap.includes('await PushNotificationService.instance.initialize();')) {
  sources.bootstrap = replaceOnce(
    sources.bootstrap,
    `  WidgetsFlutterBinding.ensureInitialized();

  debugPrint('Startup API base URL: \${AppConfig.apiBaseUrl}');`,
    `  WidgetsFlutterBinding.ensureInitialized();

  await PushNotificationService.instance.initialize();

  debugPrint('Startup API base URL: \${AppConfig.apiBaseUrl}');`,
    'push initialization'
  );
}

if (!sources.navigator.includes('static final GlobalKey<NavigatorState> navigatorKey')) {
  sources.navigator = replaceOnce(
    sources.navigator,
    `class AppNavigator {
  const AppNavigator._();
`,
    `class AppNavigator {
  const AppNavigator._();

  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();
`,
    'navigator key'
  );
}

if (!sources.app.includes("app/routes/app_navigator.dart")) {
  sources.app = replaceOnce(
    sources.app,
    `import 'package:smartpdm_mobileapp/app/routes/app_router.dart';`,
    `import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_router.dart';`,
    'navigator import'
  );
}
if (!sources.app.includes('navigatorKey: AppNavigator.navigatorKey')) {
  sources.app = replaceOnce(
    sources.app,
    `        return MaterialApp(
          title: 'SMaRT-PDM',`,
    `        return MaterialApp(
          navigatorKey: AppNavigator.navigatorKey,
          title: 'SMaRT-PDM',`,
    'MaterialApp navigator key'
  );
}

/* Device token is installation state, so keep it after account-session clear. */
sources.session = sources.session.replace(
  `    await prefs.remove(_pushDeviceTokenKey);
    await prefs.remove(_pushDevicePlatformKey);

`,
  ''
);

if (!sources.notificationFrontend.includes('unregisterStoredDeviceToken()')) {
  sources.notificationFrontend = replaceOnce(
    sources.notificationFrontend,
    `  Future<void> registerStoredDeviceToken() async {`,
    `  Future<void> unregisterStoredDeviceToken() async {
    final stored = await _sessionService.getPushDeviceToken();
    final token = stored['token']?.trim() ?? '';
    if (token.isEmpty) return;

    await _apiClient.deleteJson(
      '/api/notifications/device-token?deviceToken=\${Uri.encodeQueryComponent(token)}',
    );
  }

  Future<void> registerStoredDeviceToken() async {`,
    'frontend token unregister'
  );
}

if (!sources.provider.includes('push_notification_service.dart')) {
  sources.provider = replaceOnce(
    sources.provider,
    `import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';`,
    `import 'package:smartpdm_mobileapp/core/notifications/push_notification_service.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';`,
    'provider push import'
  );
}
sources.provider = sources.provider.replace(
  `    await _notificationService.registerStoredDeviceToken();`,
  `    await PushNotificationService.instance.syncAuthenticatedDevice();`
);
if (!sources.provider.includes('openPendingNotificationIfPossible();')) {
  sources.provider = replaceOnce(
    sources.provider,
    `    await PushNotificationService.instance.syncAuthenticatedDevice();

    _ensureRealtimeListener();`,
    `    await PushNotificationService.instance.syncAuthenticatedDevice();
    await PushNotificationService.instance.openPendingNotificationIfPossible();

    _ensureRealtimeListener();`,
    'pending push navigation'
  );
}

if (!sources.menu.includes('push_notification_service.dart')) {
  sources.menu = replaceOnce(
    sources.menu,
    `import 'package:smartpdm_mobileapp/core/storage/session_service.dart';`,
    `import 'package:smartpdm_mobileapp/core/notifications/push_notification_service.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';`,
    'logout push import'
  );
}
if (!sources.menu.includes('unregisterCurrentDevice()')) {
  sources.menu = replaceOnce(
    sources.menu,
    `    if (shouldLogout != true) return;

    await _sessionService.clearSession();`,
    `    if (shouldLogout != true) return;

    await PushNotificationService.instance.unregisterCurrentDevice();
    await _sessionService.clearSession();`,
    'logout unregister'
  );
}

if (!sources.manifest.includes('android.permission.POST_NOTIFICATIONS')) {
  sources.manifest = replaceOnce(
    sources.manifest,
    `    <uses-permission android:name="android.permission.INTERNET" />`,
    `    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />`,
    'Android notification permission'
  );
}
if (!sources.manifest.includes('com.google.firebase.messaging.default_notification_icon')) {
  sources.manifest = replaceOnce(
    sources.manifest,
    `        android:icon="@mipmap/ic_launcher">`,
    `        android:icon="@mipmap/ic_launcher">
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@mipmap/ic_launcher" />`,
    'FCM icon metadata'
  );
}

if (!sources.settings.includes('com.google.gms.google-services')) {
  sources.settings = replaceOnce(
    sources.settings,
    `    id("org.jetbrains.kotlin.android") version "2.2.20" apply false`,
    `    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
    id("com.google.gms.google-services") version "4.5.0" apply false`,
    'Google services plugin'
  );
}
if (!sources.appGradle.includes('file("google-services.json").exists()')) {
  sources.appGradle = replaceOnce(
    sources.appGradle,
    `}

android {`,
    `}

if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

android {`,
    'conditional Google services apply'
  );
}

/* ---------- Backend device token register/unregister ---------- */

if (!sources.controller.includes('exports.unregisterDeviceToken')) {
  sources.controller = replaceOnce(
    sources.controller,
    `exports.createInternalUserNotification = async (req, res) => {`,
    `exports.unregisterDeviceToken = async (req, res) => {
    try {
        const userId = getUserId(req);
        if (!userId) {
            throw createHttpError(401, 'Authentication required.');
        }

        const data = await notificationService.unregisterDeviceToken(
            userId,
            {
                deviceToken:
                    req.query?.deviceToken ||
                    req.query?.device_token ||
                    req.body?.deviceToken ||
                    req.body?.device_token,
            }
        );

        return res.status(200).json(data);
    } catch (err) {
        console.error('UNREGISTER DEVICE TOKEN ERROR:', err);
        return res.status(getSafeStatusCode(err)).json({
            error: err.message || 'Failed to unregister device token.',
        });
    }
};

exports.createInternalUserNotification = async (req, res) => {`,
    'unregister controller'
  );
}

if (!sources.routes.includes("router.delete('/device-token'")) {
  sources.routes = replaceOnce(
    sources.routes,
    `router.delete('/:notificationId', protect, notificationController.deleteNotification);

router.post('/device-token', protect, notificationController.registerDeviceToken);`,
    `router.post('/device-token', protect, notificationController.registerDeviceToken);
router.delete('/device-token', protect, notificationController.unregisterDeviceToken);

router.delete('/:notificationId', protect, notificationController.deleteNotification);`,
    'device-token route ordering'
  );
}

const registerStart = sources.notificationBackend.indexOf(
  'async function registerDeviceToken(userId, body = {}) {'
);
const registerEnd = sources.notificationBackend.indexOf(
  'async function createInternalUserNotification(req) {',
  registerStart
);
if (registerStart < 0 || registerEnd <= registerStart) {
  throw new Error('Preflight failed: could not isolate registerDeviceToken(). No project files were written.');
}
sources.notificationBackend =
  sources.notificationBackend.slice(0, registerStart) +
`async function registerDeviceToken(userId, body = {}) {
  const deviceToken = safeText(body.deviceToken || body.device_token);
  const platform = safeText(body.platform) || 'android';
  const now = new Date().toISOString();

  if (!deviceToken) {
    throw createHttpError(400, 'deviceToken is required.');
  }

  const { data, error } = await supabase
    .from('user_device_tokens')
    .upsert(
      {
        user_id: userId,
        device_token: deviceToken,
        platform,
        is_active: true,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: 'device_token' }
    )
    .select('*')
    .single();

  if (error) throw error;

  return {
    message: 'Device token registered.',
    token: data,
  };
}

async function unregisterDeviceToken(userId, body = {}) {
  const deviceToken = safeText(body.deviceToken || body.device_token);

  if (!deviceToken) {
    throw createHttpError(400, 'deviceToken is required.');
  }

  const { data, error } = await supabase
    .from('user_device_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('device_token', deviceToken)
    .select('token_id')
    .maybeSingle();

  if (error) throw error;

  return {
    message: 'Device token unregistered.',
    removed: !!data?.token_id,
  };
}

` +
  sources.notificationBackend.slice(registerEnd);

if (!sources.notificationBackend.includes('  unregisterDeviceToken,')) {
  sources.notificationBackend = replaceOnce(
    sources.notificationBackend,
    `  registerDeviceToken,
  normalizeNotification,`,
    `  registerDeviceToken,
  unregisterDeviceToken,
  normalizeNotification,`,
    'unregister service export'
  );
}

/* ---------- Realtime -> FCM ---------- */

if (!sources.realtime.includes("require('./pushNotificationService')")) {
  sources.realtime =
    `const pushNotificationService = require('./pushNotificationService');\n\n` +
    sources.realtime.replace(/^\uFEFF/, '');
}

if (!sources.realtime.includes('sendNotificationPushIfPending')) {
  sources.realtime = replaceOnce(
    sources.realtime,
    `(payload) => handleNotificationChange(io, payload)`,
    `async (payload) => {
        try {
          handleNotificationChange(io, payload);

          if (
            String(payload?.eventType || '')
              .trim()
              .toUpperCase() === 'INSERT'
          ) {
            await pushNotificationService.sendNotificationPushIfPending(
              payload.new || {}
            );
          }
        } catch (error) {
          console.error(
            '[Realtime Bridge] notification push handler failed:',
            error.message
          );
        }
      }`,
    'notification push bridge'
  );
}

if (!sources.realtime.includes('sendMessagePushFromRealtime')) {
  sources.realtime = replaceOnce(
    sources.realtime,
    `          await handleMessageChange(io, supabase, payload);`,
    `          await handleMessageChange(io, supabase, payload);
          await pushNotificationService.sendMessagePushFromRealtime(payload);`,
    'message push bridge'
  );
}

/* Validate all existing-file transformations before write. */
for (const [ok, label] of [
  [sources.bootstrap.includes('PushNotificationService.instance.initialize'), 'push bootstrap'],
  [sources.app.includes('navigatorKey: AppNavigator.navigatorKey'), 'global navigation'],
  [sources.provider.includes('syncAuthenticatedDevice'), 'post-login token sync'],
  [sources.menu.includes('unregisterCurrentDevice'), 'logout token unregister'],
  [sources.routes.includes("router.delete('/device-token'"), 'backend unregister route'],
  [sources.notificationBackend.includes("onConflict: 'device_token'"), 'global token ownership'],
  [sources.realtime.includes('sendNotificationPushIfPending'), 'notification FCM bridge'],
  [sources.realtime.includes('sendMessagePushFromRealtime'), 'message FCM bridge'],
  [sources.manifest.includes('POST_NOTIFICATIONS'), 'Android notification permission'],
]) {
  if (!ok) {
    throw new Error(`Validation failed before writing: ${label}. No project files were written.`);
  }
}

/* Transactional backup outside the repo; no .bak files. */
const rollbackRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'smartpdm-push-v1-'));
const staged = [];

function stage(file) {
  const relative = path.relative(repo, file);
  const copy = path.join(rollbackRoot, relative);
  fs.mkdirSync(path.dirname(copy), { recursive: true });

  if (fs.existsSync(file)) {
    fs.copyFileSync(file, copy);
    staged.push({ file, copy, existed: true });
  } else {
    staged.push({ file, copy, existed: false });
  }
}

function restoreAll() {
  for (const item of staged) {
    if (item.existed) {
      fs.mkdirSync(path.dirname(item.file), { recursive: true });
      fs.copyFileSync(item.copy, item.file);
    } else if (fs.existsSync(item.file)) {
      fs.unlinkSync(item.file);
    }
  }
}

for (const file of Object.values(files)) stage(file);

try {
  for (const [key, text] of Object.entries(sources)) {
    if (!files[key]) continue;
    fs.writeFileSync(files[key], text, 'utf8');
  }

  for (const [target, source] of [
    [files.pushFrontend, template('mobile/frontend/lib/core/notifications/push_notification_service.dart')],
    [files.pushBackend, template('mobile/backend/src/services/pushNotificationService.js')],
    [files.envPush, template('mobile/backend/.env.push.example')],
    [files.migration, template('supabase/migrations/20260824154500_add_mobile_push_device_tokens_and_delivery_claims.sql')],
    [files.backendTest, template('tests/push-notifications-contract.test.js')],
    [files.flutterTest, template('tests/push_notifications_contract_test.dart')],
  ]) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source, 'utf8');
  }

  let packageJson = fs.readFileSync(files.packageJson, 'utf8');
  if (!packageJson.includes('"firebase-admin"')) {
    run('npm', ['install', 'firebase-admin', '--save'], mobileBackend);
  }

  let pubspec = fs.readFileSync(files.pubspec, 'utf8');
  const missing = [];
  if (!pubspec.includes('firebase_core:')) missing.push('firebase_core');
  if (!pubspec.includes('firebase_messaging:')) missing.push('firebase_messaging');

  if (missing.length) {
    run('flutter', ['pub', 'add', ...missing], mobileFrontend);
  } else {
    run('flutter', ['pub', 'get'], mobileFrontend);
  }

  run(
    'dart',
    [
      'format',
      files.main,
      files.bootstrap,
      files.app,
      files.navigator,
      files.session,
      files.pushFrontend,
      files.notificationFrontend,
      files.provider,
      files.menu,
      files.flutterTest,
    ],
    mobileFrontend
  );

  for (const file of [
    files.routes,
    files.controller,
    files.notificationBackend,
    files.realtime,
    files.pushBackend,
  ]) {
    run('node', ['--check', file], repo);
  }

  run(
    'node',
    ['--test', 'test/push-notifications-contract.test.js'],
    mobileBackend
  );

  run(
    'flutter',
    ['test', 'test/push_notifications_contract_test.dart'],
    mobileFrontend
  );

  run('flutter', ['test'], mobileFrontend);

  const googleServices = path.join(
    mobileFrontend,
    'android',
    'app',
    'google-services.json'
  );

  if (fs.existsSync(googleServices)) {
    run('flutter', ['build', 'apk', '--debug'], mobileFrontend);
  } else {
    console.log('\nSKIP APK BUILD: android/app/google-services.json is not configured yet.');
  }
} catch (error) {
  console.error('\nPush patch failed. Restoring tracked files...');
  restoreAll();
  console.error(`Rollback completed from: ${rollbackRoot}`);
  throw error;
}

try {
  fs.rmSync(rollbackRoot, { recursive: true, force: true });
} catch (_) {}

console.log('\nPASS: Android push code + backend contracts + full Flutter tests passed.');
console.log('Next required external step: configure Firebase Android + Firebase Admin credentials.');
console.log('See FIREBASE_SETUP.txt in this ZIP.');
