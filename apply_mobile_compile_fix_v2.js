#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function exists(p) {
  return fs.existsSync(p);
}

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);

  while (true) {
    const app = path.join(dir, 'mobile', 'smartpdm_mobileapp');
    if (exists(app)) return dir;

    // Also support running from the mobile app directory itself.
    if (
      path.basename(dir) === 'smartpdm_mobileapp' &&
      path.basename(path.dirname(dir)) === 'mobile'
    ) {
      return path.dirname(path.dirname(dir));
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'SMaRT-PDM repository root was not found. Run this from inside D:\\projects\\SMaRT-PDM.'
  );
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeBackup(file, text) {
  const current = read(file);
  if (current === text) return { changed: false };

  const backup = `${file}.bak-${stamp()}`;
  fs.copyFileSync(file, backup);
  fs.writeFileSync(file, text, 'utf8');
  return { changed: true, backup };
}

function normalizeNewline(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function fixFamilyIntake(file) {
  let text = read(file);
  const nl = normalizeNewline(text);

  const startMarker = '...parentNativeOptions.map(';
  const ifMarker = "if (selectedParentNative != 'No')";

  const start = text.indexOf(startMarker);
  if (start < 0) {
    throw new Error('parentNativeOptions.map(...) was not found in step_family_intake.dart');
  }

  const ifPos = text.indexOf(ifMarker, start);
  if (ifPos < 0) {
    throw new Error("selectedParentNative != 'No' block was not found after parentNativeOptions.map(...)");
  }

  let segment = text.slice(start, ifPos);

  // Correct ending should be:
  //                     ),
  //                   ),
  //                 ),
  //               if (...)
  //
  // The current broken source is missing the third `),` that closes .map(...).
  const correctTail = new RegExp(
    String.raw`\n[ \t]{20}\),\r?\n[ \t]{18}\),\r?\n[ \t]{16}\),\r?\n[ \t]{14}$`
  );

  if (!correctTail.test(segment)) {
    const brokenTail = new RegExp(
      String.raw`(\r?\n[ \t]{20}\),\r?\n[ \t]{18}\),)(\r?\n[ \t]{14}$)`
    );

    if (!brokenTail.test(segment)) {
      // More tolerant fallback based on the exact IntakeChoiceCard/Padding ending.
      const nearEnd = /(\r?\n[ \t]*\),\r?\n[ \t]*\),)(\r?\n[ \t]*)$/;
      const match = segment.match(nearEnd);

      if (!match) {
        throw new Error(
          'The parentNativeOptions.map block has an unexpected shape. No unsafe edit was made.'
        );
      }

      segment = segment.replace(
        nearEnd,
        `$1${nl}                ),$2`
      );
    } else {
      segment = segment.replace(
        brokenTail,
        `$1${nl}                ),$2`
      );
    }

    text = text.slice(0, start) + segment + text.slice(ifPos);
  }

  // Verify the close now exists directly before the collection-if.
  const verifyChunk = text.slice(start, text.indexOf(ifMarker, start));
  const closeCount = (verifyChunk.match(/\),/g) || []).length;
  if (closeCount < 3) {
    throw new Error('Family intake map closure verification failed.');
  }

  const result = writeBackup(file, text);
  return result.changed ? `FIXED (backup: ${result.backup})` : 'ALREADY FIXED';
}

function fixNotificationProvider(file) {
  let text = read(file);
  if (/^\uFEFF?import 'dart:async';/m.test(text)) {
    return 'ALREADY FIXED';
  }

  const hasBom = text.charCodeAt(0) === 0xFEFF;
  if (hasBom) text = text.slice(1);

  const nl = normalizeNewline(text);
  text = `import 'dart:async';${nl}${nl}${text}`;

  if (hasBom) text = '\uFEFF' + text;

  const result = writeBackup(file, text);
  return result.changed ? `FIXED (backup: ${result.backup})` : 'ALREADY FIXED';
}

function fixProfileScreen(file) {
  let text = read(file);

  if (!text.includes('showDrawer: false,')) {
    return 'ALREADY FIXED';
  }

  const updated = text.replace(
    /^[ \t]*showDrawer:\s*false,\s*\r?\n/m,
    ''
  );

  if (updated === text) {
    throw new Error('Could not safely remove showDrawer: false,');
  }

  const result = writeBackup(file, updated);
  return result.changed ? `FIXED (backup: ${result.backup})` : 'ALREADY FIXED';
}

function runCommand(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    console.warn(`Could not run ${command}: ${result.error.message}`);
    return false;
  }

  return result.status === 0;
}

function main() {
  const repo = findRepoRoot(process.cwd());
  const app = path.join(repo, 'mobile', 'smartpdm_mobileapp');

  const family = path.join(
    app, 'lib', 'features', 'forms', 'presentation', 'screens',
    'step_family_intake.dart'
  );
  const notifications = path.join(
    app, 'lib', 'features', 'notifications', 'presentation', 'providers',
    'notification_provider.dart'
  );
  const profile = path.join(
    app, 'lib', 'features', 'profile', 'presentation', 'screens',
    'profile_screen.dart'
  );

  for (const file of [family, notifications, profile]) {
    if (!exists(file)) throw new Error(`Required file not found: ${file}`);
  }

  console.log('\nSMaRT-PDM mobile compile fix v2\n');
  console.log(`Repository: ${repo}\n`);

  console.log('step_family_intake.dart     -> ' + fixFamilyIntake(family));
  console.log('notification_provider.dart -> ' + fixNotificationProvider(notifications));
  console.log('profile_screen.dart        -> ' + fixProfileScreen(profile));

  const relativeFiles = [
    path.relative(app, family),
    path.relative(app, notifications),
    path.relative(app, profile),
  ];

  const formatOk = runCommand('dart', ['format', ...relativeFiles], app);

  if (!formatOk) {
    console.error(
      '\nThe patch was applied, but Dart still reports a parse problem. Send the terminal output.'
    );
    process.exit(2);
  }

  console.log('\nDart formatting passed for all three files.');
  console.log('\nNext command:');
  console.log(`cd "${app}"`);
  console.log('flutter analyze');
  console.log('flutter run -d edge');
}

try {
  main();
} catch (error) {
  console.error('\nFIX FAILED:');
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
