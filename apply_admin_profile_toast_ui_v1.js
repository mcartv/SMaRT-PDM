#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((arg) => arg !== '--dry-run');
const repoRoot = path.resolve(positional[0] || '.');

const APP_PATH = path.join(repoRoot, 'admin', 'frontend', 'src', 'App.jsx');
const ACCOUNT_PANEL_PATH = path.join(
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

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`Required file was not found: ${path.relative(repoRoot, filePath)}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function countOccurrences(source, needle) {
  if (!needle) return 0;
  return source.split(needle).length - 1;
}

function replaceOnce(source, before, after, label) {
  const count = countOccurrences(source, before);
  if (count !== 1) {
    fail(`${label}: expected exactly 1 matching source block, found ${count}.`);
  }
  return source.replace(before, after);
}

function ensureContains(source, needle, label) {
  if (!source.includes(needle)) {
    fail(`${label}: expected source marker was not found.`);
  }
}

function runFrontendBuild() {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const commandArgs = isWindows
    ? ['/d', '/s', '/c', 'npm run build']
    : ['run', 'build'];

  console.log('\n> npm run build');
  const result = spawnSync(command, commandArgs, {
    cwd: FRONTEND_DIR,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    fail(`Frontend build could not start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`Frontend build failed with exit code ${result.status}.`);
  }
}

function patchToaster(source) {
  ensureContains(source, 'position="top-right"', 'Global toast position');

  if (source.includes('offset={{ top: 72, right: 24 }}')) {
    return source;
  }

  const before = `      <Toaster\n        position="top-right"\n        closeButton`;
  const after = `      <Toaster\n        position="top-right"\n        offset={{ top: 72, right: 24 }}\n        closeButton`;

  return replaceOnce(
    source,
    before,
    after,
    'Move application feedback below the top navigation'
  );
}

function patchAccountDirtyState(source) {
  if (!source.includes('const accountHasChanges = useMemo(() => {')) {
    const before = `  const currentProfileImage = photoPreview || resolveProfileImage(profileData);\n  const displayName = \`${'${account.first_name} ${account.last_name}'}\`.trim() || config.shortName;\n  const feedbackIsError = /failed|please|expired|already|valid|required|unable/i.test(accountFeedback);`;

    const after = `  const currentProfileImage = photoPreview || resolveProfileImage(profileData);\n  const displayName = \`${'${account.first_name} ${account.last_name}'}\`.trim() || config.shortName;\n  const accountHasChanges = useMemo(() => {\n    if (!initialAccount) return false;\n\n    const editableFields = [\n      'first_name',\n      'last_name',\n      'email',\n      'phone_number',\n      'position',\n    ];\n\n    return editableFields.some(\n      (field) => String(account?.[field] ?? '') !== String(initialAccount?.[field] ?? '')\n    );\n  }, [account, initialAccount]);\n  const feedbackIsError = /failed|please|expired|already|valid|required|unable/i.test(accountFeedback);`;

    source = replaceOnce(
      source,
      before,
      after,
      'Admin account dirty-state calculation'
    );
  }

  if (!source.includes('if (!accountHasChanges) return;')) {
    const before = `  const handleSaveAccount = async () => {\n    try {`;
    const after = `  const handleSaveAccount = async () => {\n    if (!accountHasChanges) return;\n\n    try {`;
    source = replaceOnce(
      source,
      before,
      after,
      'Admin account no-op save guard'
    );
  }

  const hookReturnBefore = `  return {\n    loadingProfile,\n    savingAccount,\n    accountFeedback,\n    account,\n    currentProfileImage,`;
  const hookReturnAfter = `  return {\n    loadingProfile,\n    savingAccount,\n    accountFeedback,\n    account,\n    accountHasChanges,\n    currentProfileImage,`;
  if (!source.includes(hookReturnAfter)) {
    source = replaceOnce(
      source,
      hookReturnBefore,
      hookReturnAfter,
      'Expose Admin account dirty state from account manager'
    );
  }

  const panelDestructureBefore = `  const {\n    loadingProfile,\n    savingAccount,\n    accountFeedback,\n    account,\n    currentProfileImage,`;
  const panelDestructureAfter = `  const {\n    loadingProfile,\n    savingAccount,\n    accountFeedback,\n    account,\n    accountHasChanges,\n    currentProfileImage,`;
  if (!source.includes(panelDestructureAfter)) {
    source = replaceOnce(
      source,
      panelDestructureBefore,
      panelDestructureAfter,
      'Read Admin account dirty state in account panel'
    );
  }

  if (!source.includes("disabled={loadingProfile || savingAccount || !accountHasChanges}")) {
    const before = `            <Button\n              onClick={handleSaveAccount}\n              className="h-9 rounded-lg border-none text-xs text-white"\n              style={{ background: palette.base }}\n              disabled={loadingProfile || savingAccount}\n            >`;

    const after = `            <Button\n              onClick={handleSaveAccount}\n              className="h-9 rounded-lg border-none text-xs text-white disabled:cursor-not-allowed disabled:text-stone-500 disabled:opacity-100"\n              style={{\n                background:\n                  accountHasChanges && !loadingProfile && !savingAccount\n                    ? palette.base\n                    : '#e7e5e4',\n              }}\n              disabled={loadingProfile || savingAccount || !accountHasChanges}\n              title={accountHasChanges ? \`Save ${'${config.shortName}'} account changes\` : 'Edit an account field to enable Save'}\n            >`;

    source = replaceOnce(
      source,
      before,
      after,
      'Grey out Save Admin Account until a field changes'
    );
  }

  return source;
}

function validatePatched(appSource, accountSource) {
  ensureContains(
    appSource,
    'offset={{ top: 72, right: 24 }}',
    'Toast should sit below the portal header'
  );
  ensureContains(
    accountSource,
    'const accountHasChanges = useMemo(() => {',
    'Admin account dirty-state logic'
  );
  ensureContains(
    accountSource,
    'disabled={loadingProfile || savingAccount || !accountHasChanges}',
    'Save Admin Account disabled state'
  );
  ensureContains(
    accountSource,
    "? palette.base\n                    : '#e7e5e4'",
    'Save Admin Account grey disabled appearance'
  );
}

function main() {
  console.log('SMaRT-PDM Admin Profile + Feedback UI v1');
  console.log(`Repository: ${repoRoot}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`);
  console.log('');

  const originalApp = readRequired(APP_PATH);
  const originalAccountPanel = readRequired(ACCOUNT_PANEL_PATH);

  let nextApp = originalApp;
  let nextAccountPanel = originalAccountPanel;

  console.log('[1/3] Moving success/error feedback below the top navigation...');
  nextApp = patchToaster(nextApp);
  console.log('      PASS');

  console.log('[2/3] Building Admin Profile dirty-state save behavior...');
  nextAccountPanel = patchAccountDirtyState(nextAccountPanel);
  console.log('      PASS');

  console.log('[3/3] Validating staged UI changes...');
  validatePatched(nextApp, nextAccountPanel);
  console.log('      PASS');

  if (dryRun) {
    console.log('\nPASS: dry-run completed. No files were changed.');
    return;
  }

  const changedFiles = [];
  if (nextApp !== originalApp) changedFiles.push([APP_PATH, originalApp, nextApp]);
  if (nextAccountPanel !== originalAccountPanel) {
    changedFiles.push([ACCOUNT_PANEL_PATH, originalAccountPanel, nextAccountPanel]);
  }

  if (!changedFiles.length) {
    console.log('\nPASS: The requested Admin Profile + feedback UI changes are already present.');
    return;
  }

  const backupRoot = path.join(
    repoRoot,
    '.smart-pdm-patch-backup',
    `admin-profile-feedback-${Date.now()}`
  );

  try {
    for (const [filePath, originalSource, nextSource] of changedFiles) {
      const relativePath = path.relative(repoRoot, filePath);
      const backupPath = path.join(backupRoot, relativePath);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.writeFileSync(backupPath, originalSource, 'utf8');
      fs.writeFileSync(filePath, nextSource, 'utf8');
    }

    runFrontendBuild();

    console.log('\nPASS: Admin feedback placement + Admin Profile save dirty-state + frontend build passed.');
    console.log('Changed:');
    console.log('  - Global top-right feedback now starts below the portal top navigation');
    console.log('  - Save Admin Account stays grey/disabled until an editable field changes');
    console.log('  - Successful save resets the button back to grey/disabled');
    console.log(`Backup: ${path.relative(repoRoot, backupRoot)}`);
  } catch (error) {
    console.error(`\nFAIL: ${error.message}`);
    console.error('Rolling back changed files...');

    for (const [filePath, originalSource] of changedFiles) {
      try {
        fs.writeFileSync(filePath, originalSource, 'utf8');
      } catch (rollbackError) {
        console.error(
          `Rollback warning for ${path.relative(repoRoot, filePath)}: ${rollbackError.message}`
        );
      }
    }

    console.error('Rollback completed. Existing source files were restored.');
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(`\nFAIL: ${error.message}`);
  console.error('No files were changed.');
  process.exitCode = 1;
}
