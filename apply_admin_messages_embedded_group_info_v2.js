#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Admin Messages Embedded Group Info v2';
const TARGET_REL = path.join('admin', 'frontend', 'src', 'pages', 'AdminMessages.jsx');
const V1_MARKER = 'SMART-PDM_ADMIN_MESSAGES_RESPONSIVE_V1';
const V2_MARKER = 'SMART-PDM_ADMIN_MESSAGES_EMBEDDED_GROUP_INFO_V2';

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

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) fail(`${label}: expected source block was not found.`);
  const second = source.indexOf(before, first + before.length);
  if (second >= 0) fail(`${label}: expected source block matched more than once.`);
  return source.slice(0, first) + after + source.slice(first + before.length);
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
  let source = normalize(originalSource);

  if (!source.includes(V1_MARKER)) {
    fail('The responsive Admin Messages v1 baseline was not found. Update/pull the current repo before running this patch.');
  }

  if (source.includes(V2_MARKER)) {
    return { source, alreadyApplied: true };
  }

  source = replaceOnce(
    source,
    `// ${V1_MARKER}\n`,
    `// ${V1_MARKER}\n// ${V2_MARKER}\n`,
    'Add v2 patch marker'
  );

  source = replaceOnce(
    source,
    `  onAddMember,\n  onLeave,\n  overlay = false,\n}) {`,
    `  onAddMember,\n  onLeave,\n  overlay = false,\n  embedded = false,\n}) {`,
    'Add embedded Group Information mode'
  );

  source = replaceOnce(
    source,
    `    <aside\n      className={overlay\n        ? 'fixed inset-y-0 right-0 z-[90] flex min-h-0 w-[min(380px,100vw)] flex-col border-l border-stone-200 bg-white shadow-2xl'\n        : 'flex min-h-0 flex-col border-l border-stone-200 bg-white'}\n    >`,
    `    <aside\n      className={embedded\n        ? 'flex h-full min-h-0 w-full flex-col bg-white'\n        : overlay\n          ? 'fixed inset-y-0 right-0 z-[90] flex min-h-0 w-[min(380px,100vw)] flex-col border-l border-stone-200 bg-white shadow-2xl'\n          : 'flex min-h-0 flex-col border-l border-stone-200 bg-white'}\n    >`,
    'Make Group Information relative to the Messages module'
  );

  source = replaceOnce(
    source,
    `          <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100" title="Close group info">\n            <X className="h-4 w-4" />\n          </button>`,
    `          <button\n            type="button"\n            onClick={onClose}\n            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100"\n            title={embedded ? 'Back to conversation' : 'Close group info'}\n            aria-label={embedded ? 'Back to conversation' : 'Close group info'}\n          >\n            {embedded ? <ArrowLeft className="h-4 w-4" /> : <X className="h-4 w-4" />}\n          </button>`,
    'Use in-module back navigation for Group Information'
  );

  const renderAnchor = `\n  return (\n    <>\n      <button\n        type="button"\n        onClick={() => {`;

  const renderHelper = `\n  const renderGroupInfo = ({ embedded = false } = {}) => (\n    <GroupInfoModal\n      open={groupInfoOpen}\n      room={selectedItem?.type === 'group' ? selectedItem : null}\n      members={groupMembers}\n      loading={loadingGroupMembers}\n      currentUserId={currentUserId}\n      onClose={() => setGroupInfoOpen(false)}\n      searchTerm={chatSearchTerm}\n      matchCount={chatMatchCount}\n      onSearchChange={(value) => {\n        setChatSearchTerm(value)\n        setChatSearchOpen(Boolean(value.trim()))\n      }}\n      onViewProfile={setSelectedMemberProfile}\n      onMessage={handleMessageMember}\n      onRemove={setPendingRemoveMember}\n      onPromote={setPendingPromoteMember}\n      onAddMember={() => {\n        setAddMembersOpen(true)\n        setGroupInfoOpen(false)\n        setMainView('add-members')\n      }}\n      onLeave={() => setLeaveGroupOpen(true)}\n      embedded={embedded}\n    />\n  )\n`;

  const anchorIndex = source.lastIndexOf(renderAnchor);
  if (anchorIndex < 0) fail('Insert Group Information renderer: Admin Messages return anchor was not found.');
  source = source.slice(0, anchorIndex) + renderHelper + source.slice(anchorIndex);

  source = replaceOnce(
    source,
    `              >\n                {selectedItem ? (`,
    `              >\n                {isAdminMessaging && groupInfoOpen && selectedItem?.type === 'group' ? (\n                  renderGroupInfo({ embedded: true })\n                ) : selectedItem ? (`,
    'Show Group Information inside the active conversation pane'
  );

  const oldBottomGroupInfo = `              <GroupInfoModal\n                open={groupInfoOpen}\n                room={selectedItem?.type === 'group' ? selectedItem : null}\n                members={groupMembers}\n                loading={loadingGroupMembers}\n                currentUserId={currentUserId}\n                onClose={() => setGroupInfoOpen(false)}\n                searchTerm={chatSearchTerm}\n                matchCount={chatMatchCount}\n                onSearchChange={(value) => {\n                  setChatSearchTerm(value)\n                  setChatSearchOpen(Boolean(value.trim()))\n                }}\n                onViewProfile={setSelectedMemberProfile}\n                onMessage={handleMessageMember}\n                onRemove={setPendingRemoveMember}\n                onPromote={setPendingPromoteMember}\n                onAddMember={() => {\n                  setAddMembersOpen(true)\n                  setGroupInfoOpen(false)\n                  setMainView('add-members')\n                }}\n                onLeave={() => setLeaveGroupOpen(true)}\n                overlay={isAdminMessaging}\n              />`;

  source = replaceOnce(
    source,
    oldBottomGroupInfo,
    `              {!isAdminMessaging ? renderGroupInfo() : null}`,
    'Remove detached Admin Group Information drawer'
  );

  const required = [
    V2_MARKER,
    "renderGroupInfo({ embedded: true })",
    "!isAdminMessaging ? renderGroupInfo() : null",
    "embedded={embedded}",
    "? 'flex h-full min-h-0 w-full flex-col bg-white'",
    "title={embedded ? 'Back to conversation' : 'Close group info'}",
    "md:grid-cols-[300px_minmax(0,1fr)]",
    "compactPane === 'thread' ? 'flex' : 'hidden md:flex'",
  ];

  for (const needle of required) {
    if (!source.includes(needle)) fail(`Staged validation failed: missing ${needle}`);
  }

  if (source.includes('overlay={isAdminMessaging}')) {
    fail('Staged validation failed: the detached Admin Group Information drawer is still enabled.');
  }

  return { source, alreadyApplied: false };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const repoArg = args.find((arg) => arg !== '--dry-run');
  const repoRoot = findRepoRoot(repoArg);
  const targetPath = path.join(repoRoot, TARGET_REL);
  const frontendDir = path.join(repoRoot, 'admin', 'frontend');
  const original = fs.readFileSync(targetPath, 'utf8');
  const originalEol = detectEol(original);

  console.log(PATCH_NAME);
  console.log(`Repository: ${repoRoot}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}\n`);

  console.log('[1/3] Embedding Group Information inside Admin Messages...');
  const staged = stagePatch(original);
  console.log(staged.alreadyApplied ? '      ALREADY APPLIED' : '      PASS');

  const stagedNormalized = normalize(staged.source);

  console.log('[2/3] Validating responsive inbox/chat/info behavior...');
  const checks = [
    [stagedNormalized.includes("md:grid-cols-[300px_minmax(0,1fr)]"), 'desktop inbox + active pane layout'],
    [stagedNormalized.includes("renderGroupInfo({ embedded: true })"), 'embedded group information pane'],
    [stagedNormalized.includes("compactPane === 'thread' ? 'flex' : 'hidden md:flex'"), 'small-screen master/detail behavior'],
    [!stagedNormalized.includes('overlay={isAdminMessaging}'), 'detached Admin drawer removed'],
  ];
  for (const [passed, label] of checks) {
    if (!passed) fail(`Responsive validation failed: ${label}`);
  }
  console.log('      PASS');

  console.log('[3/3] Validating existing messaging functionality is preserved...');
  const behaviorNeedles = [
    'handleSendMessage',
    'toggleThreadReadState',
    'handleAddMembers',
    'handleRemoveMember',
    'handlePromoteMember',
    'handleLeaveGroup',
    'fetchRoomMembers',
    'useSocketEvent(',
  ];
  for (const needle of behaviorNeedles) {
    if (!stagedNormalized.includes(needle)) fail(`Messaging behavior validation failed: ${needle}`);
  }
  console.log('      PASS');

  if (dryRun) {
    console.log('\nPASS: dry-run completed. No files were changed.');
    return;
  }

  if (staged.alreadyApplied) {
    console.log('\nNo source changes were needed. Running the Admin frontend build to verify the current result.');
    runNpmBuild(frontendDir);
    console.log('\nPASS: Embedded Admin Group Information is already applied and the frontend build passed.');
    return;
  }

  const backupDir = path.join(
    repoRoot,
    '.smart-pdm-patch-backup',
    `admin-messages-embedded-group-info-v2-${Date.now()}`
  );
  const backupPath = path.join(backupDir, TARGET_REL);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, original, 'utf8');

  let wrote = false;
  try {
    fs.writeFileSync(targetPath, restoreEol(staged.source, originalEol), 'utf8');
    wrote = true;

    runNpmBuild(frontendDir);

    console.log('\nPASS: Admin Group Information now stays inside the Messages module and the frontend build passed.');
    console.log(`Backup: ${backupDir}`);
  } catch (error) {
    if (wrote) {
      console.error('\nRolling back Admin Messages embedded Group Information patch...');
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
