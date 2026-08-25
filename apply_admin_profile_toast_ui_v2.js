#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rootArg = args.find((arg) => arg !== '--dry-run') || '.';
const repoRoot = path.resolve(rootArg);

const APP_PATH = path.join(repoRoot, 'admin', 'frontend', 'src', 'App.jsx');
const ACCOUNT_PATH = path.join(
  repoRoot,
  'admin',
  'frontend',
  'src',
  'components',
  'department',
  'DepartmentMaintenancePage.jsx'
);
const FRONTEND_DIR = path.join(repoRoot, 'admin', 'frontend');

function fail(message) {
  throw new Error(message);
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`Required file not found: ${path.relative(repoRoot, filePath)}`);
  }
}

function readSource(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return {
    raw,
    eol: raw.includes('\r\n') ? '\r\n' : '\n',
    text: raw.replace(/\r\n/g, '\n'),
  };
}

function restoreEol(text, eol) {
  const normalized = text.replace(/\r\n/g, '\n');
  return eol === '\r\n' ? normalized.replace(/\n/g, '\r\n') : normalized;
}

function lineIndentAt(source, index) {
  const lineStart = source.lastIndexOf('\n', index) + 1;
  const line = source.slice(lineStart, index);
  const match = line.match(/^\s*/);
  return match ? match[0] : '';
}

function transformApp(source) {
  const desiredOffset = `offset={{ top: '72px', right: '16px' }}`;
  if (source.includes(desiredOffset)) {
    return source;
  }

  const toasterStart = source.indexOf('<Toaster');
  if (toasterStart < 0) {
    fail('Feedback placement: <Toaster> was not found in admin/frontend/src/App.jsx.');
  }

  const toasterEnd = source.indexOf('/>', toasterStart);
  if (toasterEnd < 0) {
    fail('Feedback placement: the <Toaster> block could not be resolved.');
  }

  const positionIndex = source.indexOf('position="top-right"', toasterStart);
  if (positionIndex < 0 || positionIndex > toasterEnd) {
    fail('Feedback placement: the top-right Toaster position was not found inside the active <Toaster> block.');
  }

  const lineEnd = source.indexOf('\n', positionIndex);
  if (lineEnd < 0 || lineEnd > toasterEnd) {
    fail('Feedback placement: could not resolve the Toaster position line.');
  }

  const indent = lineIndentAt(source, positionIndex);
  return `${source.slice(0, lineEnd + 1)}${indent}${desiredOffset}\n${source.slice(lineEnd + 1)}`;
}

function insertAfterLineContaining(source, needle, insertion, label) {
  const index = source.indexOf(needle);
  if (index < 0) fail(`${label}: anchor was not found.`);
  const lineEnd = source.indexOf('\n', index);
  if (lineEnd < 0) fail(`${label}: anchor line could not be resolved.`);
  return `${source.slice(0, lineEnd + 1)}${insertion}${source.slice(lineEnd + 1)}`;
}

function transformDepartmentAccount(source) {
  let next = source;

  if (!next.includes('const hasAccountChanges = useMemo(() => {')) {
    const dirtyStateBlock = [
      '  const hasAccountChanges = useMemo(() => {',
      '    if (!initialAccount) return false;',
      '',
      "    const editableFields = ['first_name', 'last_name', 'email', 'phone_number', 'position'];",
      '    return editableFields.some((field) =>',
      "      String(account?.[field] ?? '').trim() !== String(initialAccount?.[field] ?? '').trim()",
      '    );',
      '  }, [account, initialAccount]);',
      '',
    ].join('\n');

    next = insertAfterLineContaining(
      next,
      'const feedbackIsError =',
      dirtyStateBlock,
      'Admin account dirty-state'
    );
  }

  const saveHandlerAnchor = '  const handleSaveAccount = async () => {';
  const saveHandlerIndex = next.indexOf(saveHandlerAnchor);
  if (saveHandlerIndex < 0) {
    fail('Admin account save guard: handleSaveAccount was not found.');
  }

  const saveHandlerWindow = next.slice(saveHandlerIndex, saveHandlerIndex + 500);
  if (!saveHandlerWindow.includes("config.shortName === 'Admin' && !hasAccountChanges")) {
    const lineEnd = next.indexOf('\n', saveHandlerIndex);
    const guard = [
      "    if (config.shortName === 'Admin' && !hasAccountChanges) {",
      '      return;',
      '    }',
      '',
    ].join('\n');
    next = `${next.slice(0, lineEnd + 1)}${guard}${next.slice(lineEnd + 1)}`;
  }

  const hookReturnStart = next.indexOf('  return {', saveHandlerIndex);
  if (hookReturnStart < 0) {
    fail('Admin account dirty-state: account manager return object was not found.');
  }
  const hookReturnEnd = next.indexOf('  };\n}', hookReturnStart);
  if (hookReturnEnd < 0) {
    fail('Admin account dirty-state: account manager return object end was not found.');
  }
  let returnBlock = next.slice(hookReturnStart, hookReturnEnd);
  if (!returnBlock.includes('hasAccountChanges,')) {
    if (!returnBlock.includes('    handleSaveAccount,')) {
      fail('Admin account dirty-state: handleSaveAccount return entry was not found.');
    }
    returnBlock = returnBlock.replace(
      '    handleSaveAccount,',
      '    handleSaveAccount,\n    hasAccountChanges,'
    );
    next = `${next.slice(0, hookReturnStart)}${returnBlock}${next.slice(hookReturnEnd)}`;
  }

  const panelStart = next.indexOf('export function DepartmentAccountPanel');
  if (panelStart < 0) {
    fail('Admin account dirty-state: DepartmentAccountPanel was not found.');
  }
  const managerCallEnd = next.indexOf('  } = useDepartmentAccountManager({', panelStart);
  if (managerCallEnd < 0) {
    fail('Admin account dirty-state: DepartmentAccountPanel account-manager destructuring was not found.');
  }
  let destructureBlock = next.slice(panelStart, managerCallEnd);
  if (!destructureBlock.includes('hasAccountChanges,')) {
    if (!destructureBlock.includes('    handleSaveAccount,')) {
      fail('Admin account dirty-state: handleSaveAccount destructuring entry was not found.');
    }
    destructureBlock = destructureBlock.replace(
      '    handleSaveAccount,',
      '    handleSaveAccount,\n    hasAccountChanges,'
    );
    next = `${next.slice(0, panelStart)}${destructureBlock}${next.slice(managerCallEnd)}`;
  }

  const buttonClickIndex = next.indexOf('onClick={handleSaveAccount}', panelStart);
  if (buttonClickIndex < 0) {
    fail('Admin account save button: onClick={handleSaveAccount} was not found.');
  }
  const buttonStart = next.lastIndexOf('<Button', buttonClickIndex);
  const buttonEnd = next.indexOf('</Button>', buttonClickIndex);
  if (buttonStart < 0 || buttonEnd < 0) {
    fail('Admin account save button: button boundaries could not be resolved.');
  }

  let buttonBlock = next.slice(buttonStart, buttonEnd + '</Button>'.length);

  if (!buttonBlock.includes("config.shortName === 'Admin' && !hasAccountChanges")) {
    const styleRegex = /style=\{\{\s*background:\s*palette\.base\s*\}\}/;
    if (!styleRegex.test(buttonBlock)) {
      fail('Admin account save button: palette background style was not found in the Save Account button.');
    }
    buttonBlock = buttonBlock.replace(
      styleRegex,
      "style={{ background: config.shortName === 'Admin' && !hasAccountChanges ? '#e7e5e4' : palette.base }}"
    );

    const disabledRegex = /disabled=\{\s*loadingProfile\s*\|\|\s*savingAccount\s*\}/;
    if (!disabledRegex.test(buttonBlock)) {
      fail('Admin account save button: current disabled condition was not found.');
    }
    buttonBlock = buttonBlock.replace(
      disabledRegex,
      "disabled={loadingProfile || savingAccount || (config.shortName === 'Admin' && !hasAccountChanges)}"
    );

    buttonBlock = buttonBlock.replace(
      'className="h-9 rounded-lg border-none text-xs text-white"',
      'className="h-9 rounded-lg border-none text-xs text-white disabled:cursor-not-allowed disabled:text-stone-500 disabled:opacity-100"'
    );

    next = `${next.slice(0, buttonStart)}${buttonBlock}${next.slice(buttonEnd + '</Button>'.length)}`;
  }

  return next;
}

function validate(appSource, accountSource) {
  const checks = [
    [
      appSource.includes("offset={{ top: '72px', right: '16px' }}"),
      'Toaster offset was not staged.',
    ],
    [
      accountSource.includes('const hasAccountChanges = useMemo(() => {'),
      'Admin account dirty-state calculation was not staged.',
    ],
    [
      accountSource.includes("config.shortName === 'Admin' && !hasAccountChanges"),
      'Admin-only unchanged-save guard was not staged.',
    ],
    [
      accountSource.includes("'#e7e5e4' : palette.base"),
      'Grey disabled Save Admin Account styling was not staged.',
    ],
    [
      accountSource.includes("disabled={loadingProfile || savingAccount || (config.shortName === 'Admin' && !hasAccountChanges)}"),
      'Save Admin Account disabled condition was not staged.',
    ],
  ];

  for (const [ok, message] of checks) {
    if (!ok) fail(message);
  }
}

function runFrontendBuild() {
  console.log('\n> npm run build');

  let result;
  if (process.platform === 'win32') {
    result = spawnSync(
      'cmd.exe',
      ['/d', '/s', '/c', 'npm run build'],
      { cwd: FRONTEND_DIR, stdio: 'inherit' }
    );
  } else {
    result = spawnSync('npm', ['run', 'build'], {
      cwd: FRONTEND_DIR,
      stdio: 'inherit',
    });
  }

  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(`Admin frontend build failed with exit code ${result.status}.`);
  }
}

console.log('SMaRT-PDM Admin Profile + Feedback UI v2');
console.log(`Repository: ${repoRoot}`);
console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`);

let originals = null;
let backupDir = '';

try {
  assertFile(APP_PATH);
  assertFile(ACCOUNT_PATH);
  assertFile(path.join(FRONTEND_DIR, 'package.json'));

  const appFile = readSource(APP_PATH);
  const accountFile = readSource(ACCOUNT_PATH);
  originals = { appFile, accountFile };

  console.log('\n[1/3] Moving application feedback below the top navigation...');
  const stagedApp = transformApp(appFile.text);
  console.log('      PASS');

  console.log('[2/3] Building Admin Profile dirty-state save behavior...');
  const stagedAccount = transformDepartmentAccount(accountFile.text);
  console.log('      PASS');

  console.log('[3/3] Validating staged UI changes...');
  validate(stagedApp, stagedAccount);
  console.log('      PASS');

  if (dryRun) {
    console.log('\nPASS: dry-run completed. No files were changed.');
    process.exit(0);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  backupDir = path.join(repoRoot, '.smart-pdm-patch-backup', `admin-profile-toast-ui-v2-${stamp}`);
  fs.mkdirSync(path.dirname(path.join(backupDir, 'admin/frontend/src/App.jsx')), { recursive: true });
  fs.mkdirSync(
    path.dirname(path.join(backupDir, 'admin/frontend/src/components/department/DepartmentMaintenancePage.jsx')),
    { recursive: true }
  );

  fs.writeFileSync(path.join(backupDir, 'admin/frontend/src/App.jsx'), appFile.raw, 'utf8');
  fs.writeFileSync(
    path.join(backupDir, 'admin/frontend/src/components/department/DepartmentMaintenancePage.jsx'),
    accountFile.raw,
    'utf8'
  );

  fs.writeFileSync(APP_PATH, restoreEol(stagedApp, appFile.eol), 'utf8');
  fs.writeFileSync(ACCOUNT_PATH, restoreEol(stagedAccount, accountFile.eol), 'utf8');

  runFrontendBuild();

  console.log('\nPASS: Admin feedback now sits below the top navigation, and Save Admin Account stays grey/disabled until an editable account field changes.');
  console.log(`Backup: ${path.relative(repoRoot, backupDir)}`);
} catch (error) {
  console.error(`\nFAIL: ${error.message}`);

  if (!dryRun && originals) {
    try {
      fs.writeFileSync(APP_PATH, originals.appFile.raw, 'utf8');
      fs.writeFileSync(ACCOUNT_PATH, originals.accountFile.raw, 'utf8');
      console.error('Rollback completed. Existing source files were restored.');
    } catch (rollbackError) {
      console.error(`Rollback failed: ${rollbackError.message}`);
      if (backupDir) console.error(`Backup location: ${backupDir}`);
    }
  } else {
    console.error('No files were changed.');
  }

  process.exit(1);
}
