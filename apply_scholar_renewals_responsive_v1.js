#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Scholar/Renewals Responsive Table v1';
const TARGET = path.join('admin', 'frontend', 'src', 'pages', 'ScholarMonitoring.jsx');

function fail(message) {
  throw new Error(message);
}

function resolveRepoRoot() {
  const positional = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  const candidates = [positional, process.cwd()].filter(Boolean).map((value) => path.resolve(value));

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, TARGET))) return candidate;
  }

  fail(`Could not find ${TARGET}. Run this script from the SMaRT-PDM repository root or pass the repository path.`);
}

function detectEol(source) {
  return source.includes('\r\n') ? '\r\n' : '\n';
}

function normalizeLf(source) {
  return source.replace(/\r\n/g, '\n');
}

function restoreEol(source, eol) {
  return eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
}

function findFunctionRange(source, functionName) {
  const needle = `function ${functionName}(`;
  const start = source.indexOf(needle);
  if (start < 0) fail(`${functionName}: function was not found.`);

  const nextFunction = source.indexOf('\nfunction ', start + needle.length);
  const nextExport = source.indexOf('\nexport default function ', start + needle.length);
  const candidates = [nextFunction, nextExport].filter((index) => index > start);
  const end = candidates.length ? Math.min(...candidates) : source.length;

  return { start, end, block: source.slice(start, end) };
}

function replaceFunction(source, functionName, transform) {
  const range = findFunctionRange(source, functionName);
  const nextBlock = transform(range.block);
  if (nextBlock === range.block) return source;
  return source.slice(0, range.start) + nextBlock + source.slice(range.end);
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first < 0) fail(`${label}: expected source block was not found.`);
  if (source.indexOf(search, first + search.length) >= 0) {
    fail(`${label}: expected exactly one matching source block.`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function responsiveTableClass() {
  return 'w-full table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_th]:break-words [&_td]:break-words [&_button]:max-w-full [&_button]:whitespace-normal [&_button]:break-words [&_button]:h-auto [&_button]:min-h-8';
}

function transformMonitoringTable(block, { functionName, legacyMinWidth }) {
  if (block.includes('table-fixed [&_th]:whitespace-normal')) {
    return block;
  }

  if (!block.includes(`min-w-[${legacyMinWidth}px]`)) {
    fail(`${functionName}: expected legacy min-width ${legacyMinWidth}px was not found.`);
  }

  let next = block;

  next = next.replace(
    '<div className="overflow-x-auto">',
    '<div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">'
  );

  next = next.replace(
    `className="min-w-[${legacyMinWidth}px]"`,
    'className="w-full min-w-0"'
  );

  next = next.replace('<Table>', `<Table className="${responsiveTableClass()}">`);

  // Fixed pixel minimums on table columns are what force the right side out of
  // the available Admin content width. Let table-layout: fixed distribute the
  // available width and wrap content instead.
  next = next.replace(/\bmin-w-\[\d+px\]\s*/g, '');

  // A responsive table must be allowed to wrap names/programs instead of
  // preserving nowrap ellipsis contracts that can force a cell wider.
  next = next.replace(/\btruncate\b/g, 'break-words');

  if (!next.includes('table-fixed [&_th]:whitespace-normal')) {
    fail(`${functionName}: responsive table class was not staged.`);
  }
  if (next.includes(`min-w-[${legacyMinWidth}px]`)) {
    fail(`${functionName}: legacy hard minimum width is still present.`);
  }

  return next;
}

function patchStatusPill(source) {
  const oldText = "className={`inline-flex items-center rounded-full font-semibold ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'";
  const newText = "className={`inline-flex max-w-full items-center justify-center whitespace-normal break-words text-center leading-4 rounded-full font-semibold ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'";

  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) fail('StatusPill responsive wrapping anchor was not found.');
  return source.replace(oldText, newText);
}

function patchQueueContainer(source) {
  const oldText = '<section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">';
  const newText = '<section className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white">';

  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) fail('Scholar/Renewal queue container anchor was not found.');
  return source.replace(oldText, newText);
}

function validateStagedSource(source) {
  const registry = findFunctionRange(source, 'ScholarRegistryTable').block;
  const renewals = findFunctionRange(source, 'RenewalTable').block;

  for (const [name, block] of [
    ['ScholarRegistryTable', registry],
    ['RenewalTable', renewals],
  ]) {
    if (!block.includes('table-fixed')) fail(`${name}: table-fixed layout missing.`);
    if (!block.includes('[&_td]:whitespace-normal')) fail(`${name}: cell wrapping missing.`);
    if (!block.includes('[&_button]:whitespace-normal')) fail(`${name}: responsive action-button wrapping missing.`);
    if (/min-w-\[(980|1120)px\]/.test(block)) fail(`${name}: legacy table minimum width remains.`);
  }

  if (!source.includes('inline-flex max-w-full items-center justify-center whitespace-normal')) {
    fail('Responsive status pills were not staged.');
  }
}

function runFrontendBuild(repoRoot) {
  const frontendDir = path.join(repoRoot, 'admin', 'frontend');
  const isWin = process.platform === 'win32';
  const result = isWin
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run build'], {
        cwd: frontendDir,
        stdio: 'inherit',
        windowsHide: false,
      })
    : spawnSync('npm', ['run', 'build'], {
        cwd: frontendDir,
        stdio: 'inherit',
      });

  if (result.error) throw result.error;
  if (result.status !== 0) fail(`Admin frontend build failed with exit code ${result.status}.`);
}

function main() {
  const repoRoot = resolveRepoRoot();
  const dryRun = process.argv.includes('--dry-run');
  const targetPath = path.join(repoRoot, TARGET);
  const originalRaw = fs.readFileSync(targetPath, 'utf8');
  const eol = detectEol(originalRaw);
  const original = normalizeLf(originalRaw);

  console.log(PATCH_NAME);
  console.log(`Repository: ${repoRoot}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`);
  console.log('');

  let staged = original;

  console.log('[1/4] Removing fixed-width Scholar table overflow...');
  staged = replaceFunction(staged, 'ScholarRegistryTable', (block) =>
    transformMonitoringTable(block, {
      functionName: 'ScholarRegistryTable',
      legacyMinWidth: 980,
    })
  );
  console.log('      PASS');

  console.log('[2/4] Making Renewal Queue fit the available screen width...');
  staged = replaceFunction(staged, 'RenewalTable', (block) =>
    transformMonitoringTable(block, {
      functionName: 'RenewalTable',
      legacyMinWidth: 1120,
    })
  );
  console.log('      PASS');

  console.log('[3/4] Making status/action content wrap at larger font sizes...');
  staged = patchStatusPill(staged);
  staged = patchQueueContainer(staged);
  console.log('      PASS');

  console.log('[4/4] Validating staged responsive contracts...');
  validateStagedSource(staged);
  console.log('      PASS');
  console.log('');

  if (staged === original) {
    console.log('PASS: The Scholar/Renewals responsive table fix is already applied.');
    return;
  }

  if (dryRun) {
    console.log('PASS: dry-run completed. No files were changed.');
    return;
  }

  const backupRoot = path.join(repoRoot, '.smart-pdm-patch-backup');
  const backupDir = path.join(backupRoot, `scholar-renewals-responsive-v1-${Date.now()}`);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(path.join(backupDir, 'ScholarMonitoring.jsx'), originalRaw, 'utf8');

  try {
    fs.writeFileSync(targetPath, restoreEol(staged, eol), 'utf8');

    console.log('> npm run build');
    console.log('');
    runFrontendBuild(repoRoot);
    console.log('');
    console.log('PASS: Scholar Registry + Renewal Queue now fit the available Admin width and wrap safely at larger font sizes.');
    console.log('      The old 980px/1120px hard minimum table widths were removed.');
  } catch (error) {
    console.error('');
    console.error('Patch verification failed. Restoring previous file...');
    fs.writeFileSync(targetPath, originalRaw, 'utf8');
    console.error(`Rollback completed. Backup: ${backupDir}`);
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error('');
  console.error(`FAIL: ${error.message || error}`);
  process.exitCode = 1;
}
