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
    if (exists(path.join(dir, 'mobile', 'smartpdm_mobileapp'))) {
      return dir;
    }

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

function newlineOf(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function backupAndWrite(file, updated) {
  const current = fs.readFileSync(file, 'utf8');
  if (current === updated) {
    return { changed: false, backup: null };
  }

  const backup = `${file}.bak-mobile-compile-v3-${stamp()}`;
  fs.copyFileSync(file, backup);
  fs.writeFileSync(file, updated, 'utf8');
  return { changed: true, backup };
}

/**
 * Normalize the exact tail of:
 *
 *   ...parentNativeOptions.map(
 *     (option) => Padding(
 *       child: IntakeChoiceCard(
 *         ...
 *         onTap: () {
 *           ...
 *           widget.onChanged();
 *         },
 *       ),
 *     ),
 *   ),
 *   if (selectedParentNative != 'No')
 *
 * v1/v2 may have left either a missing close or an extra duplicate close.
 * This replaces only the closing tail, preserving all logic above it.
 */
function normalizeParentNativeMap(file) {
  const text = fs.readFileSync(file, 'utf8');
  const nl = newlineOf(text);

  const mapMarker = '...parentNativeOptions.map(';
  const ifMarker = "if (selectedParentNative != 'No')";

  const mapStart = text.indexOf(mapMarker);
  if (mapStart < 0) {
    throw new Error('Could not find parentNativeOptions.map(...) in step_family_intake.dart.');
  }

  const ifPos = text.indexOf(ifMarker, mapStart);
  if (ifPos < 0) {
    throw new Error("Could not find selectedParentNative != 'No' after parentNativeOptions.map(...).");
  }

  const beforeIf = text.slice(mapStart, ifPos);
  const callbackMarker = 'widget.onChanged();';
  const callbackPosWithin = beforeIf.lastIndexOf(callbackMarker);

  if (callbackPosWithin < 0) {
    throw new Error(
      'Could not find widget.onChanged(); inside the parentNativeOptions.map(...) block.'
    );
  }

  const callbackEnd = mapStart + callbackPosWithin + callbackMarker.length;

  // Preserve everything through widget.onChanged(); and normalize only the
  // closures between it and the following collection-if.
  const normalizedTail =
    nl +
    '                      },' + nl +
    '                    ),' + nl +
    '                  ),' + nl +
    '                ),' + nl +
    '              ';

  const updated =
    text.slice(0, callbackEnd) +
    normalizedTail +
    text.slice(ifPos);

  const result = backupAndWrite(file, updated);
  return result;
}

function ensureDartAsync(file) {
  let text = fs.readFileSync(file, 'utf8');

  if (/^\uFEFF?import 'dart:async';/m.test(text)) {
    return { changed: false, backup: null };
  }

  const nl = newlineOf(text);
  const hasBom = text.charCodeAt(0) === 0xFEFF;
  if (hasBom) text = text.slice(1);

  text = `import 'dart:async';${nl}${nl}${text}`;
  if (hasBom) text = '\uFEFF' + text;

  return backupAndWrite(file, text);
}

function removeShowDrawer(file) {
  const text = fs.readFileSync(file, 'utf8');

  if (!text.includes('showDrawer: false,')) {
    return { changed: false, backup: null };
  }

  const updated = text.replace(/^[ \t]*showDrawer:\s*false,\s*\r?\n/m, '');

  if (updated === text) {
    throw new Error('Could not safely remove showDrawer: false, from profile_screen.dart.');
  }

  return backupAndWrite(file, updated);
}

function status(label, result) {
  if (!result.changed) {
    console.log(`${label} -> ALREADY CORRECT`);
    return;
  }

  console.log(`${label} -> FIXED`);
  console.log(`  backup: ${result.backup}`);
}

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);

  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }

  return result.status === 0;
}

function main() {
  const repo = findRepoRoot(process.cwd());
  const app = path.join(repo, 'mobile', 'smartpdm_mobileapp');

  const family = path.join(
    app,
    'lib',
    'features',
    'forms',
    'presentation',
    'screens',
    'step_family_intake.dart'
  );

  const notifications = path.join(
    app,
    'lib',
    'features',
    'notifications',
    'presentation',
    'providers',
    'notification_provider.dart'
  );

  const profile = path.join(
    app,
    'lib',
    'features',
    'profile',
    'presentation',
    'screens',
    'profile_screen.dart'
  );

  for (const file of [family, notifications, profile]) {
    if (!exists(file)) {
      throw new Error(`Required file not found: ${file}`);
    }
  }

  console.log('\nSMaRT-PDM mobile compile fix v3');
  console.log('Normalizing the family-intake map closure after the earlier patches.\n');

  status('step_family_intake.dart', normalizeParentNativeMap(family));
  status('notification_provider.dart', ensureDartAsync(notifications));
  status('profile_screen.dart', removeShowDrawer(profile));

  const rel = [
    path.relative(app, family),
    path.relative(app, notifications),
    path.relative(app, profile),
  ];

  const formatted = run('dart', ['format', ...rel], app);

  if (!formatted) {
    console.error(
      '\nDart still found a syntax problem. The script has stopped before flutter analyze.'
    );
    process.exit(2);
  }

  console.log('\nPASS: dart format parsed all three files successfully.');

  const analyzed = run('flutter', ['analyze'], app);

  if (!analyzed) {
    console.error(
      '\nflutter analyze completed with findings. Send the full output so the remaining items can be fixed.'
    );
    process.exit(3);
  }

  console.log('\nPASS: flutter analyze completed successfully.');
  console.log('\nNext command:');
  console.log(`cd "${app}"`);
  console.log('flutter run -d edge');
}

try {
  main();
} catch (error) {
  console.error('\nFIX FAILED:');
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
