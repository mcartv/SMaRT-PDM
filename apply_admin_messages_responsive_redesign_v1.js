#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Admin Messages Responsive Redesign v1';
const TARGET_REL = path.join('admin', 'frontend', 'src', 'pages', 'AdminMessages.jsx');
const MARKER = 'SMART-PDM_ADMIN_MESSAGES_RESPONSIVE_V1';

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
  const index = source.indexOf(before);
  if (index < 0) fail(`${label}: expected source block was not found.`);
  if (source.indexOf(before, index + before.length) >= 0) {
    fail(`${label}: expected source block matched more than once.`);
  }
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function replaceRegexOnce(source, pattern, replacement, label) {
  const matches = [...source.matchAll(pattern)];
  if (matches.length !== 1) {
    fail(`${label}: expected exactly one match, found ${matches.length}.`);
  }
  return source.replace(pattern, replacement);
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

  if (source.includes(MARKER)) {
    return { source, alreadyApplied: true };
  }

  source = replaceOnce(
    source,
    "const MESSAGING_API_BASE = API_BASE_URL\n",
    "const MESSAGING_API_BASE = API_BASE_URL\n// SMART-PDM_ADMIN_MESSAGES_RESPONSIVE_V1\n",
    'Patch marker'
  );

  source = replaceOnce(
    source,
    "function ThreadRow({ item, isActive, onClick, onToggleRead, onArchive }) {",
    "function ThreadRow({ item, isActive, onClick, onToggleRead, onArchive, inboxStyle = false }) {",
    'ThreadRow responsive style prop'
  );

  const oldThreadWrapper = `    <div\n      className={\`group relative mx-2 my-1 overflow-hidden rounded-2xl transition \${isActive\n        ? 'bg-white hover:bg-stone-50'\n        : hasUnread\n          ? 'bg-[var(--portal-accent-soft)]'\n          : 'bg-white hover:bg-stone-50'\n        } \${isActive ? 'before:absolute before:bottom-3 before:left-0 before:top-3 before:w-1 before:rounded-r-full before:bg-[var(--portal-base)]' : ''}\`}\n    >\n      <button\n        type=\"button\"\n        onClick={onClick}\n        className=\"flex w-full items-center gap-3 px-3 py-3 text-left\"\n      >`;

  const newThreadWrapper = `    <div\n      className={inboxStyle\n        ? \`group relative border-b border-stone-100 transition \${isActive\n          ? 'bg-[var(--portal-accent-soft)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-1 before:rounded-r-full before:bg-[var(--portal-base)]'\n          : hasUnread\n            ? 'bg-white hover:bg-stone-50'\n            : 'bg-white hover:bg-stone-50'\n          }\`\n        : \`group relative mx-2 my-1 overflow-hidden rounded-2xl transition \${isActive\n          ? 'bg-white hover:bg-stone-50'\n          : hasUnread\n            ? 'bg-[var(--portal-accent-soft)]'\n            : 'bg-white hover:bg-stone-50'\n          } \${isActive ? 'before:absolute before:bottom-3 before:left-0 before:top-3 before:w-1 before:rounded-r-full before:bg-[var(--portal-base)]' : ''}\`}\n    >\n      <button\n        type=\"button\"\n        onClick={onClick}\n        className={inboxStyle\n          ? 'flex w-full items-center gap-3 px-3.5 py-3.5 text-left'\n          : 'flex w-full items-center gap-3 px-3 py-3 text-left'}\n      >`;

  source = replaceOnce(source, oldThreadWrapper, newThreadWrapper, 'Inbox-style thread row');

  source = replaceOnce(
    source,
    `              <span className="text-xs text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">\n                {formatConversationTime(item.lastSentAt)}\n              </span>`,
    `              <span className={inboxStyle\n                ? 'text-[11px] font-medium text-stone-400'\n                : 'text-xs text-stone-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'}>\n                {formatConversationTime(item.lastSentAt)}\n              </span>`,
    'Always-visible admin inbox timestamp'
  );

  source = replaceOnce(
    source,
    `function GroupInfoModal({\n  open,\n  room,\n  members,\n  loading,\n  currentUserId,\n  onClose,\n  searchTerm,\n  matchCount,\n  onSearchChange,\n  onViewProfile,\n  onMessage,\n  onRemove,\n  onPromote,\n  onAddMember,\n  onLeave,\n}) {`,
    `function GroupInfoModal({\n  open,\n  room,\n  members,\n  loading,\n  currentUserId,\n  onClose,\n  searchTerm,\n  matchCount,\n  onSearchChange,\n  onViewProfile,\n  onMessage,\n  onRemove,\n  onPromote,\n  onAddMember,\n  onLeave,\n  overlay = false,\n}) {`,
    'Group info overlay prop'
  );

  source = replaceOnce(
    source,
    `    <aside className="flex min-h-0 flex-col border-l border-stone-200 bg-white">`,
    `    <aside\n      className={overlay\n        ? 'fixed inset-y-0 right-0 z-[90] flex min-h-0 w-[min(380px,100vw)] flex-col border-l border-stone-200 bg-white shadow-2xl'\n        : 'flex min-h-0 flex-col border-l border-stone-200 bg-white'}\n    >`,
    'Group info responsive drawer'
  );

  source = replaceOnce(
    source,
    `  const [mainView, setMainView] = useState('chats')\n  const [searchTerm, setSearchTerm] = useState('')\n  const [showUnreadOnly, setShowUnreadOnly] = useState(false)`,
    `  const [mainView, setMainView] = useState('chats')\n  const [searchTerm, setSearchTerm] = useState('')\n  const [showUnreadOnly, setShowUnreadOnly] = useState(false)\n  const isAdminMessaging = portalKey === 'admin'\n  const [compactPane, setCompactPane] = useState('list')`,
    'Admin responsive pane state'
  );

  source = replaceOnce(
    source,
    `    setGroupInfoOpen(false)\n    setChatSearchOpen(false)\n    setChatSearchTerm('')\n    setActiveType('private')`,
    `    setGroupInfoOpen(false)\n    setChatSearchOpen(false)\n    setChatSearchTerm('')\n    if (isAdminMessaging) setCompactPane('thread')\n    setActiveType('private')`,
    'Open member chat in compact thread pane'
  );

  source = replaceOnce(
    source,
    `      <button\n        type="button"\n        onClick={() => { setMainView('chats'); setArchivedOpen(false); setCreateGroupOpen(false); setAddMembersOpen(false); setGroupInfoOpen(false); setIsOpen(true) }}\n        className={\`fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--portal-base)] text-white shadow-xl transition hover:brightness-95 \${totalUnreadCount > 0 ? 'ring-4 ring-red-200' : ''\n          }\`}\n        title={totalUnreadCount > 0 ? \`\${totalUnreadCount} unread message(s)\` : 'Messages'}\n      >`,
    `      <button\n        type="button"\n        onClick={() => {\n          setMainView('chats')\n          setArchivedOpen(false)\n          setCreateGroupOpen(false)\n          setAddMembersOpen(false)\n          setGroupInfoOpen(false)\n          if (isAdminMessaging) setCompactPane('list')\n          setIsOpen(true)\n        }}\n        className={\`fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--portal-base)] text-white shadow-xl transition hover:brightness-95 \${totalUnreadCount > 0 ? 'ring-4 ring-red-200' : ''\n          }\`}\n        title={totalUnreadCount > 0 ? \`\${totalUnreadCount} unread message(s)\` : 'Messages'}\n      >`,
    'Open Admin Messages in inbox pane'
  );

  source = replaceOnce(
    source,
    `        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-4 sm:p-6">\n          <div className="flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-2xl">\n            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 sm:px-5">`,
    `        <div\n          className={isAdminMessaging\n            ? 'fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 p-0 sm:p-3 md:p-5 lg:items-center lg:p-6'\n            : 'fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-4 sm:p-6'}\n        >\n          <div\n            className={isAdminMessaging\n              ? 'flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[calc(100dvh-24px)] sm:rounded-[24px] sm:border sm:border-stone-200 md:h-[calc(100dvh-40px)] lg:h-[92dvh] lg:max-h-[860px] lg:max-w-6xl'\n              : 'flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-[26px] border border-stone-200 bg-white shadow-2xl'}\n          >\n            <div\n              className={isAdminMessaging\n                ? 'flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-3 py-3 sm:px-4 lg:px-5'\n                : 'flex items-center justify-between border-b border-stone-100 px-4 py-3 sm:px-5'}\n            >`,
    'Responsive Admin Messages shell'
  );

  source = replaceOnce(
    source,
    `              </div>\n\n              <div className="flex items-center gap-2">\n                <button\n                  type="button"\n                  onClick={openArchivedThreads}`,
    `              </div>\n\n              <div className={isAdminMessaging ? 'flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2' : 'flex items-center gap-2'}>\n                <button\n                  type="button"\n                  onClick={openArchivedThreads}`,
    'Responsive header actions'
  );

  source = replaceOnce(
    source,
    `                  <div className="text-xs text-stone-500">Private and group conversations</div>`,
    `                  <div className="text-xs text-stone-500">{isAdminMessaging ? 'Admin inbox' : 'Private and group conversations'}</div>`,
    'Admin inbox subtitle'
  );

  source = replaceOnce(
    source,
    `                  <Archive className="h-4 w-4" />\n                  Archived`,
    `                  <Archive className="h-4 w-4" />\n                  <span className={isAdminMessaging ? 'hidden sm:inline' : ''}>Archived</span>`,
    'Responsive Archived label'
  );

  source = replaceOnce(
    source,
    `                  <Users className="h-4 w-4" />\n                  Group`,
    `                  <Users className="h-4 w-4" />\n                  <span className={isAdminMessaging ? 'hidden sm:inline' : ''}>Group</span>`,
    'Responsive Group label'
  );

  source = replaceOnce(
    source,
    `                  onClick={() => { setIsOpen(false); setMainView('chats'); setArchivedOpen(false); setCreateGroupOpen(false); setAddMembersOpen(false); setGroupInfoOpen(false); setTransientPrivateContact(null) }}`,
    `                  onClick={() => { setIsOpen(false); setMainView('chats'); setArchivedOpen(false); setCreateGroupOpen(false); setAddMembersOpen(false); setGroupInfoOpen(false); setTransientPrivateContact(null); if (isAdminMessaging) setCompactPane('list') }}`,
    'Reset compact pane on close'
  );

  source = replaceOnce(
    source,
    `            <div className={\`grid min-h-0 flex-1 gap-0 \${groupInfoOpen && selectedItem?.type === 'group' ? 'xl:grid-cols-[320px_minmax(0,1fr)_320px]' : 'xl:grid-cols-[340px_minmax(0,1fr)]'}\`}>`,
    `            <div\n              className={isAdminMessaging\n                ? 'grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[300px_minmax(0,1fr)]'\n                : \`grid min-h-0 flex-1 gap-0 \${groupInfoOpen && selectedItem?.type === 'group' ? 'xl:grid-cols-[320px_minmax(0,1fr)_320px]' : 'xl:grid-cols-[340px_minmax(0,1fr)]'}\`}\n            >`,
    'Two-panel responsive admin inbox grid'
  );

  source = replaceOnce(
    source,
    `              <section className="flex min-h-0 flex-col border-b border-stone-200 xl:border-b-0 xl:border-r">\n                <div className="space-y-3 border-b border-stone-100 px-4 py-4">\n                  <div className="flex items-center justify-between">\n                    <p className="text-base font-semibold text-stone-900">Chats</p>`,
    `              <section\n                className={isAdminMessaging\n                  ? \`\${compactPane === 'thread' ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-r border-stone-200 bg-stone-50/40\`\n                  : 'flex min-h-0 flex-col border-b border-stone-200 xl:border-b-0 xl:border-r'}\n              >\n                <div className={isAdminMessaging ? 'space-y-3 border-b border-stone-100 bg-white px-3 py-3.5 sm:px-4' : 'space-y-3 border-b border-stone-100 px-4 py-4'}>\n                  <div className="flex items-center justify-between">\n                    <p className="text-base font-semibold text-stone-900">{isAdminMessaging ? 'Inbox' : 'Chats'}</p>`,
    'Responsive conversation list panel'
  );

  source = replaceOnce(
    source,
    `                      placeholder="Search conversations"`,
    `                      placeholder={isAdminMessaging ? 'Search people or conversations' : 'Search conversations'}`,
    'Admin inbox search placeholder'
  );

  source = replaceOnce(
    source,
    `                      className="h-10 w-full rounded-full border-0 bg-stone-100 pl-10 pr-4 text-sm text-stone-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-[var(--portal-accent-soft)]"`,
    `                      className={isAdminMessaging\n                        ? 'h-10 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-sm text-stone-800 outline-none transition focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]'\n                        : 'h-10 w-full rounded-full border-0 bg-stone-100 pl-10 pr-4 text-sm text-stone-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-[var(--portal-accent-soft)]'}`,
    'Admin inbox search field'
  );

  source = replaceOnce(
    source,
    `                          onToggleRead={toggleThreadReadState}\n                          onArchive={setPendingArchiveThread}\n                          onClick={() => {`,
    `                          onToggleRead={toggleThreadReadState}\n                          onArchive={setPendingArchiveThread}\n                          inboxStyle={isAdminMessaging}\n                          onClick={() => {`,
    'Enable admin inbox row style'
  );

  source = replaceOnce(
    source,
    `                            if (Number(item.unreadCount || 0) > 0) {`,
    `                            if (isAdminMessaging) setCompactPane('thread')\n\n                            if (Number(item.unreadCount || 0) > 0) {`,
    'Switch compact pane when selecting a thread'
  );

  source = replaceOnce(
    source,
    `              <section className="flex min-h-0 flex-col bg-white">`,
    `              <section\n                className={isAdminMessaging\n                  ? \`\${compactPane === 'thread' ? 'flex' : 'hidden md:flex'} min-h-0 flex-col bg-white\`\n                  : 'flex min-h-0 flex-col bg-white'}\n              >`,
    'Responsive chat panel'
  );

  source = replaceOnce(
    source,
    `                    <div className="border-b border-stone-100 bg-white px-5 py-3.5">\n                      <div className="flex items-center justify-between gap-3">\n                        <div className="flex min-w-0 items-center gap-3">\n                          <ThreadIcon item={selectedItem} />`,
    `                    <div className={isAdminMessaging ? 'border-b border-stone-100 bg-white px-3 py-3 sm:px-4 lg:px-5' : 'border-b border-stone-100 bg-white px-5 py-3.5'}>\n                      <div className="flex items-center justify-between gap-3">\n                        <div className="flex min-w-0 items-center gap-3">\n                          {isAdminMessaging ? (\n                            <button\n                              type="button"\n                              onClick={() => setCompactPane('list')}\n                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50 md:hidden"\n                              title="Back to inbox"\n                              aria-label="Back to inbox"\n                            >\n                              <ArrowLeft className="h-4 w-4" />\n                            </button>\n                          ) : null}\n                          <ThreadIcon item={selectedItem} />`,
    'Compact chat back button'
  );

  source = replaceOnce(
    source,
    `                      className="min-h-0 flex-1 overflow-y-auto bg-[#f7f7f7] px-5 py-5"`,
    `                      className={isAdminMessaging\n                        ? 'min-h-0 flex-1 overflow-y-auto bg-stone-50 px-3 py-4 sm:px-5 sm:py-5 lg:px-6'\n                        : 'min-h-0 flex-1 overflow-y-auto bg-[#f7f7f7] px-5 py-5'}`,
    'Responsive message history spacing'
  );

  source = replaceOnce(
    source,
    `                      className="border-t border-stone-100 bg-white px-4 py-3"`,
    `                      className={isAdminMessaging\n                        ? 'border-t border-stone-100 bg-white px-3 py-3 sm:px-4'\n                        : 'border-t border-stone-100 bg-white px-4 py-3'}`,
    'Responsive composer spacing'
  );

  source = replaceOnce(
    source,
    `                onLeave={() => setLeaveGroupOpen(true)}\n              />`,
    `                onLeave={() => setLeaveGroupOpen(true)}\n                overlay={isAdminMessaging}\n              />`,
    'Admin group info as overlay drawer'
  );

  const required = [
    MARKER,
    "const isAdminMessaging = portalKey === 'admin'",
    "const [compactPane, setCompactPane] = useState('list')",
    "md:grid-cols-[300px_minmax(0,1fr)]",
    "compactPane === 'thread' ? 'hidden md:flex' : 'flex'",
    "compactPane === 'thread' ? 'flex' : 'hidden md:flex'",
    "inboxStyle={isAdminMessaging}",
    "overlay={isAdminMessaging}",
    "Back to inbox",
    "fixed inset-y-0 right-0 z-[90]",
    "{isAdminMessaging ? 'Inbox' : 'Chats'}",
    "{isAdminMessaging ? 'Admin inbox' : 'Private and group conversations'}",
    "Search people or conversations",
  ];

  for (const needle of required) {
    if (!source.includes(needle)) fail(`Staged validation failed: missing ${needle}`);
  }

  return { source, alreadyApplied: false };
}

function main() {
  const repoRoot = findRepoRoot(process.argv[2]);
  const targetPath = path.join(repoRoot, TARGET_REL);
  const frontendDir = path.join(repoRoot, 'admin', 'frontend');
  const original = fs.readFileSync(targetPath, 'utf8');
  const originalEol = detectEol(original);

  console.log(PATCH_NAME);
  console.log(`Repository: ${repoRoot}\n`);

  let staged;
  console.log('[1/3] Building responsive two-panel Admin Messages layout...');
  staged = stagePatch(original);
  if (staged.alreadyApplied) {
    console.log('      ALREADY APPLIED');
  } else {
    console.log('      PASS');
  }

  console.log('[2/3] Validating small-screen master/detail behavior...');
  const stagedNormalized = normalize(staged.source);
  const validationChecks = [
    [stagedNormalized.includes("compactPane === 'thread' ? 'hidden md:flex' : 'flex'"), 'conversation list compact behavior'],
    [stagedNormalized.includes("compactPane === 'thread' ? 'flex' : 'hidden md:flex'"), 'chat compact behavior'],
    [stagedNormalized.includes('md:grid-cols-[300px_minmax(0,1fr)]'), 'desktop two-panel layout'],
    [stagedNormalized.includes('Back to inbox'), 'small-screen back navigation'],
    [stagedNormalized.includes('overlay={isAdminMessaging}'), 'non-persistent group info drawer'],
  ];
  for (const [passed, label] of validationChecks) {
    if (!passed) fail(`Responsive validation failed: ${label}`);
  }
  console.log('      PASS');

  console.log('[3/3] Validating scope: Admin-only redesign, existing messaging logic preserved...');
  if (!stagedNormalized.includes("isAdminMessaging = portalKey === 'admin'")) {
    fail('Admin-only scope guard is missing.');
  }
  if (!stagedNormalized.includes('toggleThreadReadState') || !stagedNormalized.includes('handleSendMessage')) {
    fail('Existing message read/send behavior could not be verified.');
  }
  console.log('      PASS');

  if (staged.alreadyApplied) {
    console.log('\nNo source changes were needed. Running the Admin frontend build to verify the current result.');
    runNpmBuild(frontendDir);
    console.log('\nPASS: Admin Messages responsive redesign is already applied and the Admin frontend build passed.');
    return;
  }

  const backupDir = path.join(
    repoRoot,
    '.smart-pdm-patch-backup',
    `admin-messages-responsive-v1-${Date.now()}`
  );
  const backupPath = path.join(backupDir, TARGET_REL);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, original, 'utf8');

  let wrote = false;
  try {
    fs.writeFileSync(targetPath, restoreEol(staged.source, originalEol), 'utf8');
    wrote = true;

    runNpmBuild(frontendDir);

    console.log('\nPASS: Admin Messages responsive inbox redesign + small-screen master/detail behavior + frontend build passed.');
    console.log(`Backup: ${backupDir}`);
  } catch (error) {
    if (wrote) {
      console.error('\nRolling back Admin Messages responsive redesign...');
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
