#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Maintenance Navigation Background v1';
const TARGET_REL = path.join('admin', 'frontend', 'src', 'pages', 'maintenance', 'Maintenance.jsx');

function fail(message) {
  const error = new Error(message);
  error.isPatchError = true;
  throw error;
}

function normalize(text) {
  return String(text).replace(/\r\n/g, '\n');
}

function detectEol(text) {
  return String(text).includes('\r\n') ? '\r\n' : '\n';
}

function restoreEol(text, eol) {
  return eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
}

function findRepoRoot(input) {
  const candidates = [];
  if (input) candidates.push(path.resolve(input));
  candidates.push(process.cwd());
  candidates.push(__dirname);

  for (const candidate of candidates) {
    let current = candidate;
    for (let depth = 0; depth < 8; depth += 1) {
      if (fs.existsSync(path.join(current, TARGET_REL))) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  fail(`Could not find the SMaRT-PDM repository. Expected: ${TARGET_REL}`);
}

function runNpmBuild(frontendDir) {
  console.log('\n> npm run build\n');

  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe';
    result = spawnSync(comspec, ['/d', '/s', '/c', 'npm run build'], {
      cwd: frontendDir,
      stdio: 'inherit',
      windowsHide: true,
    });
  } else {
    result = spawnSync('npm', ['run', 'build'], {
      cwd: frontendDir,
      stdio: 'inherit',
    });
  }

  if (result.error) throw result.error;
  if (result.status !== 0) fail(`Admin frontend build failed with exit code ${result.status}.`);
}

function stagePatch(originalSource) {
  const source = normalize(originalSource);

  const oldTopNav = '    <div className="sticky top-0 z-20 border-b border-stone-200 bg-white px-2 py-2">';
  const newTopNav = '    <div className="sticky top-0 z-20 bg-transparent px-2 py-2">';

  if (source.includes(newTopNav)) {
    return { source, alreadyApplied: true };
  }

  const matches = source.split(oldTopNav).length - 1;
  if (matches !== 1) {
    fail(`Maintenance top navigation wrapper: expected exactly 1 current source block, found ${matches}.`);
  }

  const staged = source.replace(oldTopNav, newTopNav);

  if (!staged.includes('mx-auto flex w-max min-w-max items-center gap-1 rounded-xl bg-stone-100 p-1')) {
    fail('Validation failed: the inner Maintenance navigation capsule could not be verified.');
  }

  if (!staged.includes("? 'bg-white text-stone-900 shadow-sm'")) {
    fail('Validation failed: active-tab styling could not be verified and was not changed.');
  }

  if (staged.includes('sticky top-0 z-20 border-b border-stone-200 bg-white px-2 py-2')) {
    fail('Validation failed: the old white navigation strip is still present.');
  }

  return { source: staged, alreadyApplied: false };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const repoArg = args.find((arg) => arg !== '--dry-run');

  const repoRoot = findRepoRoot(repoArg);
  const targetPath = path.join(repoRoot, TARGET_REL);
  const frontendDir = path.join(repoRoot, 'admin', 'frontend');
  const original = fs.readFileSync(targetPath, 'utf8');
  const eol = detectEol(original);

  console.log(PATCH_NAME);
  console.log(`Repository: ${repoRoot}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}\n`);

  console.log('[1/2] Removing the white Maintenance navigation strip...');
  const staged = stagePatch(original);
  console.log(staged.alreadyApplied ? '      ALREADY APPLIED' : '      PASS');

  console.log('[2/2] Preserving the existing toggle capsule and active-tab styling...');
  const normalized = normalize(staged.source);
  if (!normalized.includes('bg-transparent px-2 py-2')) {
    fail('Responsive UI validation failed: transparent Maintenance navigation wrapper is missing.');
  }
  if (!normalized.includes('rounded-xl bg-stone-100 p-1')) {
    fail('Responsive UI validation failed: existing Maintenance toggle capsule was unexpectedly changed.');
  }
  console.log('      PASS');

  if (dryRun) {
    console.log('\nPASS: dry-run completed. No files were changed.');
    return;
  }

  if (staged.alreadyApplied) {
    console.log('\nNo source changes were needed. Running the Admin frontend build to verify the current result.');
    runNpmBuild(frontendDir);
    console.log('\nPASS: Maintenance navigation background cleanup is already applied and the frontend build passed.');
    return;
  }

  const backupDir = path.join(
    repoRoot,
    '.smart-pdm-patch-backup',
    `maintenance-nav-background-v1-${Date.now()}`
  );
  const backupPath = path.join(backupDir, TARGET_REL);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, original, 'utf8');

  let wrote = false;
  try {
    fs.writeFileSync(targetPath, restoreEol(staged.source, eol), 'utf8');
    wrote = true;

    runNpmBuild(frontendDir);

    console.log('\nPASS: Maintenance top navigation now blends into the page background while preserving the existing toggle capsule + frontend build passed.');
    console.log(`Backup: ${backupDir}`);
  } catch (error) {
    if (wrote) {
      console.error('\nRolling back Maintenance navigation background cleanup...');
      fs.writeFileSync(targetPath, original, 'utf8');
      console.error(`Rollback completed. Backup: ${backupDir}`);
    } else {
      console.error('\nNo files were changed.');
    }
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(`\nFAIL: ${error.message || error}`);
  process.exitCode = 1;
}
