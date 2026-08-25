#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Admin Notification + Readiness UI v2';
const TARGETS = {
  applicationReview: 'admin/frontend/src/pages/ApplicationReview.jsx',
  adminLayout: 'admin/frontend/src/components/layout/AdminLayout.jsx',
  notificationHook: 'admin/frontend/src/hooks/usePortalNotifications.js',
  notificationRoutes: 'admin/backend/routes/notificationRoutes.js',
  notificationController: 'admin/backend/controllers/notificationController.js',
  notificationService: 'admin/backend/services/notificationService.js',
  contractTest: 'admin/backend/test/admin-notification-readiness-ui-contract.test.js',
};

function fail(message) {
  const error = new Error(message);
  error.isPatchFailure = true;
  throw error;
}

function normalize(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function detectEol(text) {
  return String(text).includes('\r\n') ? '\r\n' : '\n';
}

function restoreEol(text, eol) {
  return eol === '\r\n' ? normalize(text).replace(/\n/g, '\r\n') : normalize(text);
}

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    fail(`${label}: expected source block exactly once, found ${count}.`);
  }
  return source.replace(before, after);
}

function insertBeforeOnce(source, anchor, insertion, label) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) {
    fail(`${label}: expected anchor exactly once, found ${count}.`);
  }
  return source.replace(anchor, `${insertion}${anchor}`);
}

function findRepoRoot(start) {
  let current = path.resolve(start || process.cwd());
  for (let i = 0; i < 8; i += 1) {
    const matches = Object.values(TARGETS)
      .filter((item) => item !== TARGETS.contractTest)
      .every((relative) => fs.existsSync(path.join(current, relative)));
    if (matches) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  fail(`Could not find the SMaRT-PDM repository from ${start || process.cwd()}.`);
}

function readTarget(repoRoot, relative) {
  const absolute = path.join(repoRoot, relative);
  if (!fs.existsSync(absolute)) fail(`Missing required file: ${relative}`);
  const raw = fs.readFileSync(absolute, 'utf8');
  return { absolute, relative, raw, eol: detectEol(raw), text: normalize(raw) };
}

function run(command, args, options = {}) {
  const cwd = options.cwd || process.cwd();
  const capture = options.capture === true;
  let executable = command;
  let commandArgs = args;

  if (process.platform === 'win32' && (command === 'npm' || command === 'npx')) {
    executable = process.env.ComSpec || 'cmd.exe';
    commandArgs = ['/d', '/s', '/c', [command, ...args].map((part) => {
      const value = String(part);
      return /[\s&()^|<>]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(' ')];
  }

  const result = spawnSync(executable, commandArgs, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    shell: false,
    windowsHide: true,
    env: process.env,
  });

  if (result.error) throw result.error;
  return result;
}

function parseFailingTests(output) {
  const failures = new Set();
  const text = String(output || '');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    let match = trimmed.match(/^(?:✖|×|not ok\s+\d+\s+-)\s*(.+)$/i);
    if (match) {
      failures.add(match[1].replace(/\s*\([^)]*\)\s*$/, '').trim());
      continue;
    }
    match = trimmed.match(/^#\s*Subtest:\s*(.+)$/i);
    if (match && /fail|error/i.test(text.slice(Math.max(0, text.indexOf(line) - 300), text.indexOf(line) + 500))) {
      failures.add(match[1].trim());
    }
  }
  return failures;
}

function captureBackendBaseline(repoRoot, label) {
  const backendDir = path.join(repoRoot, 'admin/backend');
  console.log(`\n> npm test (${label})`);
  const result = run('npm', ['test'], { cwd: backendDir, capture: true });
  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  const failures = parseFailingTests(combined);

  if (result.status === 0) {
    console.log('      Backend suite: PASS');
  } else {
    console.log(`      Backend suite: already failing (${failures.size || 'unknown'} failing tests)`);
    [...failures].slice(0, 12).forEach((name) => console.log(`        - ${name}`));
    if (failures.size > 12) console.log(`        - ... ${failures.size - 12} more`);
  }

  return { status: result.status, failures, output: combined };
}

function patchNotificationService(text) {
  if (!text.includes('async function markAsUnread(')) {
    const insertion = `async function markAsUnread(userId, notificationId) {\n    if (!userId || !notificationId) {\n        throw new Error('User ID and notification ID are required');\n    }\n\n    const { data, error } = await supabase\n        .from('notifications')\n        .update({ is_read: false, read_at: null })\n        .eq('notification_id', notificationId)\n        .eq('user_id', userId)\n        .select(\n            \`\n            notification_id,\n            user_id,\n            type,\n            title,\n            message,\n            reference_id,\n            reference_type,\n            is_read,\n            read_at,\n            push_sent,\n            created_at\n        \`\n        )\n        .maybeSingle();\n\n    if (error) {\n        console.error('SUPABASE MARK NOTIFICATION UNREAD ERROR:', error);\n        throw new Error(error.message);\n    }\n\n    if (!data) {\n        throw new Error('Notification not found.');\n    }\n\n    return {\n        message: 'Notification marked as unread.',\n        notification: data,\n    };\n}\n\n`;
    text = insertBeforeOnce(text, 'async function markAllAsRead(userId) {', insertion, 'Notification service unread function');
  }

  if (!text.includes('exports.markAsUnread = markAsUnread;')) {
    text = replaceOnce(
      text,
      'exports.markAsRead = markAsRead;\nexports.markAllAsRead = markAllAsRead;',
      'exports.markAsRead = markAsRead;\nexports.markAsUnread = markAsUnread;\nexports.markAllAsRead = markAllAsRead;',
      'Notification service unread export'
    );
  }
  return text;
}

function patchNotificationController(text) {
  if (text.includes('exports.markAsUnread = async')) return text;
  const insertion = `exports.markAsUnread = async (req, res) => {\n    try {\n        const userId = getRequestUserId(req);\n        if (!userId) {\n            return res.status(401).json({ error: 'Authentication required.' });\n        }\n\n        const result = await notificationService.markAsUnread(userId, req.params.notificationId);\n        socketEvents.notificationUpdated(req.app.get('io'), userId, result.notification);\n        await writeNotificationAudit(req, 'MARK_NOTIFICATION_UNREAD', 'Marked notification as unread.', { notification_id: req.params.notificationId, user_id: userId });\n        return res.status(200).json(result);\n    } catch (err) {\n        console.error('MARK NOTIFICATION UNREAD ERROR:', err.message || err);\n        return res.status(500).json({ error: err.message || 'Failed to mark notification as unread.' });\n    }\n};\n\n`;
  return insertBeforeOnce(text, 'exports.markAllAsRead = async (req, res) => {', insertion, 'Notification controller unread action');
}

function patchNotificationRoutes(text) {
  if (text.includes("'/:notificationId/unread'")) return text;
  const anchor = `router.patch(\n    '/:notificationId/read',\n    protect,\n    allStaff,\n    notificationController.markAsRead\n);\n\n`;
  const addition = `${anchor}router.patch(\n    '/:notificationId/unread',\n    protect,\n    allStaff,\n    notificationController.markAsUnread\n);\n\n`;
  return replaceOnce(text, anchor, addition, 'Notification unread route');
}

function patchNotificationHook(text) {
  if (!text.includes('const markAsUnread = useCallback(')) {
    const insertion = `  const markAsUnread = useCallback(\n    async (notificationId) => {\n      if (!notificationId) return;\n\n      const token = sessionStorage.getItem(tokenStorageKey);\n      if (!token) return;\n\n      const previous = items.find((item) => item.notification_id === notificationId) || null;\n      const wasRead = previous?.is_read === true;\n\n      syncItems((current) =>\n        current.map((item) =>\n          item.notification_id === notificationId\n            ? { ...item, is_read: false, read_at: null }\n            : item\n        )\n      );\n      if (wasRead) {\n        setUnreadCount((current) => current + 1);\n      }\n\n      try {\n        const response = await fetch(buildApiUrl(\`/api/notifications/\${notificationId}/unread\`), {\n          method: 'PATCH',\n          headers: {\n            Authorization: \`Bearer \${token}\`,\n            'Content-Type': 'application/json',\n          },\n        });\n        const payload = await response.json().catch(() => ({}));\n\n        if (!response.ok) {\n          throw new Error(payload?.error || payload?.message || 'Failed to mark notification as unread.');\n        }\n\n        const updated = normalizeNotification(payload?.notification || {});\n        syncItems((current) =>\n          current.map((item) =>\n            item.notification_id === updated.notification_id ? { ...item, ...updated } : item\n          )\n        );\n      } catch (error) {\n        console.error('MARK NOTIFICATION UNREAD ERROR:', error);\n        if (wasRead) {\n          syncItems((current) =>\n            current.map((item) =>\n              item.notification_id === notificationId\n                ? { ...item, is_read: true, read_at: previous?.read_at || null }\n                : item\n            )\n          );\n          setUnreadCount((current) => Math.max(0, current - 1));\n        }\n      }\n    },\n    [items, syncItems, tokenStorageKey]\n  );\n\n`;
    text = insertBeforeOnce(text, '  const markAllAsRead = useCallback(async () => {', insertion, 'Notification hook mark unread');
  }

  if (!text.includes('    markAsUnread,\n')) {
    text = replaceOnce(
      text,
      '    markAsRead,\n    markAllAsRead,',
      '    markAsRead,\n    markAsUnread,\n    markAllAsRead,',
      'Notification hook return mark unread'
    );
  }
  return text;
}

function patchAdminLayout(text) {
  if (!text.includes('    markAsUnread,\n')) {
    text = replaceOnce(
      text,
      '    markingAll,\n    markAllAsRead,\n    openNotification,',
      '    markingAll,\n    markAsRead,\n    markAsUnread,\n    markAllAsRead,\n    openNotification,',
      'Admin notification hook destructuring'
    );
  }

  const oldBadge = `                {unreadCount > 0 && (\n                  <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />\n                )}`;
  const newBadge = `                {unreadCount > 0 && (\n                  <span\n                    className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[9px] font-bold leading-none text-white"\n                    aria-label={\`\${unreadCount} unread notifications\`}\n                  >\n                    {unreadCount > 99 ? '99+' : unreadCount}\n                  </span>\n                )}`;
  if (text.includes(oldBadge)) {
    text = replaceOnce(text, oldBadge, newBadge, 'Admin notification numeric badge');
  } else if (!text.includes("{unreadCount > 99 ? '99+' : unreadCount}")) {
    fail('Admin notification numeric badge: expected source block was not found.');
  }

  if (!text.includes("n.is_read === true ? 'Mark as unread' : 'Mark as read'")) {
    const newOld = `                        {newNotifications.map((n) => (\n                          <button\n                            key={n.notification_id}\n                            type="button"\n                            onClick={() => {\n                              setNotifOpen(false);\n                              openNotification(n, navigate);\n                            }}\n                            className={\`w-full border-b border-stone-100 px-4 py-3 text-left transition hover:brightness-[0.98] \${n.is_read !== true ? 'border-l-4' : ''}\`}\n                            style={n.is_read !== true\n                              ? { borderLeftColor: theme.base, background: theme.accentSoft }\n                              : { background: '#fff' }}\n                          >\n                            <div className="flex items-start justify-between gap-3">\n                              <p className="text-[13px] font-semibold leading-[18px] text-stone-900">\n                                {n.title || 'Notification'}\n                              </p>\n                              {n.is_read !== true ? (\n                                <span\n                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"\n                                  style={{ background: theme.base }}\n                                >\n                                  New\n                                </span>\n                              ) : null}\n                            </div>\n                            <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-stone-600">\n                              {n.message || 'Open notification'}\n                            </p>\n                            <p className="mt-1.5 text-[11px] font-medium text-stone-400">\n                              {formatNotificationTime(n.created_at)}\n                            </p>\n                          </button>\n                        ))}`;

    const newNew = `                        {newNotifications.map((n) => (\n                          <div\n                            key={n.notification_id}\n                            onClick={() => {\n                              setNotifOpen(false);\n                              openNotification(n, navigate);\n                            }}\n                            className={\`w-full cursor-pointer border-b border-stone-100 px-4 py-3 text-left transition hover:brightness-[0.98] \${n.is_read !== true ? 'border-l-4' : ''}\`}\n                            style={n.is_read !== true\n                              ? { borderLeftColor: theme.base, background: theme.accentSoft }\n                              : { background: '#fff' }}\n                          >\n                            <div className="flex items-start justify-between gap-3">\n                              <p className="text-[13px] font-semibold leading-[18px] text-stone-900">\n                                {n.title || 'Notification'}\n                              </p>\n                              {n.is_read !== true ? (\n                                <span\n                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"\n                                  style={{ background: theme.base }}\n                                >\n                                  New\n                                </span>\n                              ) : null}\n                            </div>\n                            <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-stone-600">\n                              {n.message || 'Open notification'}\n                            </p>\n                            <div className="mt-1.5 flex items-center justify-between gap-3">\n                              <p className="text-[11px] font-medium text-stone-400">\n                                {formatNotificationTime(n.created_at)}\n                              </p>\n                              <button\n                                type="button"\n                                onClick={(event) => {\n                                  event.stopPropagation();\n                                  if (n.is_read === true) {\n                                    void markAsUnread(n.notification_id);\n                                  } else {\n                                    void markAsRead(n.notification_id);\n                                  }\n                                }}\n                                className="rounded-md px-2 py-1 text-[11px] font-semibold text-stone-500 transition hover:bg-white/70 hover:text-stone-900"\n                              >\n                                {n.is_read === true ? 'Mark as unread' : 'Mark as read'}\n                              </button>\n                            </div>\n                          </div>\n                        ))}`;

    text = replaceOnce(text, newOld, newNew, 'Admin New notification read/unread action');

    const earlierOld = `                        {earlierNotifications.map((n) => (\n                          <button\n                            key={n.notification_id}\n                            type="button"\n                            onClick={() => {\n                              setNotifOpen(false);\n                              openNotification(n, navigate);\n                            }}\n                            className={\`w-full border-b border-stone-50 px-4 py-3 text-left transition-colors hover:brightness-[0.98] \${n.is_read !== true ? 'border-l-4' : ''}\`}\n                            style={n.is_read !== true\n                              ? { borderLeftColor: theme.base, background: theme.accentSoft }\n                              : { background: '#fff' }}\n                          >\n                            <div className="flex items-start justify-between gap-3">\n                              <p className="text-[13px] font-medium leading-[18px] text-stone-800">\n                                {n.title || 'Notification'}\n                              </p>\n                            </div>\n                            <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-stone-600">\n                              {n.message || 'Open notification'}\n                            </p>\n                            <p className="mt-1.5 text-[11px] font-medium text-stone-400">\n                              {formatNotificationTime(n.created_at)}\n                            </p>\n                          </button>\n                        ))}`;

    const earlierNew = `                        {earlierNotifications.map((n) => (\n                          <div\n                            key={n.notification_id}\n                            onClick={() => {\n                              setNotifOpen(false);\n                              openNotification(n, navigate);\n                            }}\n                            className={\`w-full cursor-pointer border-b border-stone-50 px-4 py-3 text-left transition-colors hover:brightness-[0.98] \${n.is_read !== true ? 'border-l-4' : ''}\`}\n                            style={n.is_read !== true\n                              ? { borderLeftColor: theme.base, background: theme.accentSoft }\n                              : { background: '#fff' }}\n                          >\n                            <div className="flex items-start justify-between gap-3">\n                              <p className="text-[13px] font-medium leading-[18px] text-stone-800">\n                                {n.title || 'Notification'}\n                              </p>\n                              {n.is_read !== true ? (\n                                <span\n                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"\n                                  style={{ background: theme.base }}\n                                >\n                                  Unread\n                                </span>\n                              ) : null}\n                            </div>\n                            <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-stone-600">\n                              {n.message || 'Open notification'}\n                            </p>\n                            <div className="mt-1.5 flex items-center justify-between gap-3">\n                              <p className="text-[11px] font-medium text-stone-400">\n                                {formatNotificationTime(n.created_at)}\n                              </p>\n                              <button\n                                type="button"\n                                onClick={(event) => {\n                                  event.stopPropagation();\n                                  if (n.is_read === true) {\n                                    void markAsUnread(n.notification_id);\n                                  } else {\n                                    void markAsRead(n.notification_id);\n                                  }\n                                }}\n                                className="rounded-md px-2 py-1 text-[11px] font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"\n                              >\n                                {n.is_read === true ? 'Mark as unread' : 'Mark as read'}\n                              </button>\n                            </div>\n                          </div>\n                        ))}`;

    text = replaceOnce(text, earlierOld, earlierNew, 'Admin Earlier notification read/unread action');
  }

  return text;
}

function patchApplicationReview(text) {
  if (!text.includes("const READINESS_SEEN_STORAGE_PREFIX = 'smart-pdm:admin:readiness-seen:v1';")) {
    const helper = `const READINESS_SEEN_STORAGE_PREFIX = 'smart-pdm:admin:readiness-seen:v1';\n\nfunction getReadinessSeenStorageKey() {\n  try {\n    const profile = JSON.parse(sessionStorage.getItem('adminProfile') || '{}');\n    const userId = profile?.user_id || profile?.userId || profile?.id || 'admin';\n    return \`\${READINESS_SEEN_STORAGE_PREFIX}:\${userId}\`;\n  } catch {\n    return \`\${READINESS_SEEN_STORAGE_PREFIX}:admin\`;\n  }\n}\n\nfunction readReadinessSeenState() {\n  try {\n    const parsed = JSON.parse(localStorage.getItem(getReadinessSeenStorageKey()) || '{}');\n    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};\n  } catch {\n    return {};\n  }\n}\n\nfunction writeReadinessSeenState(value) {\n  try {\n    localStorage.setItem(getReadinessSeenStorageKey(), JSON.stringify(value || {}));\n  } catch {\n    // The readiness indicator remains session-functional even if browser storage is unavailable.\n  }\n}\n\nfunction buildReadinessOpeningSignature(rows = []) {\n  return rows\n    .map((row) =>\n      [\n        row.application_id || '',\n        normalizeStatus(row.selection_status),\n        Number(row.queue_position || 0),\n        Number(row.waitlist_position || 0),\n        row.fcfs_completed_at || '',\n      ].join(':')\n    )\n    .sort()\n    .join('|');\n}\n\n`;
    text = insertBeforeOnce(text, 'function normalizeStatus(value = \'\') {', helper, 'Readiness seen-state helpers');
  }

  text = replaceOnce(
    text,
    'function OpeningsGrid({ rows, countsMap, navigate }) {',
    `function OpeningsGrid({\n  rows,\n  countsMap,\n  navigate,\n  unseenOpeningIds = new Set(),\n  onOpeningViewed = () => {},\n}) {`,
    'Opening cards readiness props'
  );

  if (!text.includes('const hasUnseenReadiness = unseenOpeningIds.has(String(opening.opening_id));')) {
    text = replaceOnce(
      text,
      '        const nextFcfsApplicant = summary.nextFcfsApplicant || null;\n',
      '        const nextFcfsApplicant = summary.nextFcfsApplicant || null;\n        const hasUnseenReadiness = unseenOpeningIds.has(String(opening.opening_id));\n',
      'Opening card unseen state'
    );
  }

  const oldTitle = `                    <h2 className="text-lg font-semibold leading-tight text-stone-900">\n                      {opening.opening_title || opening.title || 'Untitled Opening'}\n                    </h2>`;
  const newTitle = `                    <div className="flex min-w-0 items-center gap-2">\n                      <h2 className="min-w-0 truncate text-lg font-semibold leading-tight text-stone-900">\n                        {opening.opening_title || opening.title || 'Untitled Opening'}\n                      </h2>\n                      {hasUnseenReadiness ? (\n                        <span\n                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"\n                          title="New readiness activity"\n                          aria-label="New readiness activity"\n                        />\n                      ) : null}\n                    </div>`;
  if (text.includes(oldTitle)) {
    text = replaceOnce(text, oldTitle, newTitle, 'Opening card readiness dot');
  } else if (!text.includes('title="New readiness activity"')) {
    fail('Opening card readiness dot: expected source block was not found.');
  }

  const openingNav = `                    onClick={() =>\n                      navigate(\`/admin/openings/\${opening.opening_id}/applications\`)\n                    }`;
  const openingNavReplacement = `                    onClick={() => {\n                      onOpeningViewed(opening.opening_id);\n                      navigate(\`/admin/openings/\${opening.opening_id}/applications\`);\n                    }}`;
  const navCount = text.split(openingNav).length - 1;
  if (navCount === 2) {
    text = text.split(openingNav).join(openingNavReplacement);
  } else if (!text.includes('onOpeningViewed(opening.opening_id);')) {
    fail(`Opening card view handlers: expected 2 navigation handlers, found ${navCount}.`);
  }

  text = replaceOnce(
    text,
    `function ReadinessOpeningCards({\n  openings,\n  rows,\n  navigate,\n  onApproveScholar,\n  approvalLoadingId = '',\n}) {`,
    `function ReadinessOpeningCards({\n  openings,\n  rows,\n  navigate,\n  onApproveScholar,\n  approvalLoadingId = '',\n  unseenOpeningIds = new Set(),\n  onOpeningViewed = () => {},\n}) {`,
    'Readiness opening card props'
  );

  const oldSelectorClick = `                onClick={() =>\n                  setSelectedOpeningId(itemId)\n                }`;
  const newSelectorClick = `                onClick={() => {\n                  setSelectedOpeningId(itemId);\n                  onOpeningViewed(itemId);\n                }}`;
  if (text.includes(oldSelectorClick)) {
    text = replaceOnce(text, oldSelectorClick, newSelectorClick, 'Readiness selector seen handler');
  } else if (!text.includes('onOpeningViewed(itemId);')) {
    fail('Readiness selector seen handler: expected source block was not found.');
  }

  if (!text.includes('const hasUnseenReadiness = unseenOpeningIds.has(itemId);')) {
    text = replaceOnce(
      text,
      `            const selected =\n              itemId ===\n              String(\n                selectedGroup.opening?.opening_id || ''\n              );\n`,
      `            const selected =\n              itemId ===\n              String(\n                selectedGroup.opening?.opening_id || ''\n              );\n            const hasUnseenReadiness = unseenOpeningIds.has(itemId);\n`,
      'Readiness selector unseen state'
    );
  }

  const selectorTitle = `                    <p\n                      className={\`truncate text-sm font-semibold \${\n                        selected\n                          ? 'text-white'\n                          : 'text-stone-900'\n                      }\`}\n                    >\n                      {itemOpening.opening_title ||\n                        'Scholarship Opening'}\n                    </p>`;
  const selectorTitleNew = `                    <div className="flex min-w-0 items-center gap-2">\n                      <p\n                        className={\`min-w-0 truncate text-sm font-semibold \${\n                          selected\n                            ? 'text-white'\n                            : 'text-stone-900'\n                        }\`}\n                      >\n                        {itemOpening.opening_title ||\n                          'Scholarship Opening'}\n                      </p>\n                      {hasUnseenReadiness ? (\n                        <span\n                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"\n                          title="New readiness activity"\n                          aria-label="New readiness activity"\n                        />\n                      ) : null}\n                    </div>`;
  if (text.includes(selectorTitle)) {
    text = replaceOnce(text, selectorTitle, selectorTitleNew, 'Readiness selector dot');
  }

  const queueNav = `              onClick={() =>\n                navigate(\n                  \`/admin/openings/\${opening.opening_id}/applications\`\n                )\n              }`;
  const queueNavNew = `              onClick={() => {\n                onOpeningViewed(opening.opening_id);\n                navigate(\n                  \`/admin/openings/\${opening.opening_id}/applications\`\n                );\n              }}`;
  if (text.includes(queueNav)) {
    text = replaceOnce(text, queueNav, queueNavNew, 'Readiness Open Queue seen handler');
  } else if (!text.includes('onOpeningViewed(opening.opening_id);')) {
    fail('Readiness Open Queue seen handler: expected source block was not found.');
  }

  if (!text.includes('const [readinessSeenSignatures, setReadinessSeenSignatures]')) {
    text = replaceOnce(
      text,
      `  const [activationCandidate, setActivationCandidate] = useState(null);\n  const [feedback, setFeedback] = useState(null);`,
      `  const [activationCandidate, setActivationCandidate] = useState(null);\n  const [feedback, setFeedback] = useState(null);\n  const [readinessSeenSignatures, setReadinessSeenSignatures] = useState(() =>\n    readReadinessSeenState()\n  );`,
      'Readiness seen state'
    );
  }

  const oldReadyBlock = `  const readinessRows = useMemo(\n    () =>\n      filteredRegistryRows\n        .filter(isReadyForScholarHandling)\n        .sort(compareFcfs),\n    [filteredRegistryRows]\n  );\n\n  const hasNeedsAttention = readinessRows.length > 0;`;

  const newReadyBlock = `  const allReadinessRows = useMemo(\n    () => registryRows.filter(isReadyForScholarHandling).sort(compareFcfs),\n    [registryRows]\n  );\n\n  const readinessRows = useMemo(\n    () =>\n      filteredRegistryRows\n        .filter(isReadyForScholarHandling)\n        .sort(compareFcfs),\n    [filteredRegistryRows]\n  );\n\n  const readinessAttentionSignatures = useMemo(() => {\n    const grouped = new Map();\n\n    allReadinessRows.forEach((row) => {\n      const openingId = String(row.opening_id || '');\n      if (!openingId) return;\n      if (!grouped.has(openingId)) grouped.set(openingId, []);\n      grouped.get(openingId).push(row);\n    });\n\n    return new Map(\n      [...grouped.entries()].map(([openingId, rows]) => [\n        openingId,\n        buildReadinessOpeningSignature(rows),\n      ])\n    );\n  }, [allReadinessRows]);\n\n  const unseenReadinessOpeningIds = useMemo(() => {\n    return new Set(\n      [...readinessAttentionSignatures.entries()]\n        .filter(([openingId, signature]) =>\n          readinessSeenSignatures[openingId] !== signature\n        )\n        .map(([openingId]) => openingId)\n    );\n  }, [readinessAttentionSignatures, readinessSeenSignatures]);\n\n  const markReadinessOpeningSeen = (openingId) => {\n    const key = String(openingId || '');\n    const signature = readinessAttentionSignatures.get(key);\n    if (!key || !signature) return;\n\n    setReadinessSeenSignatures((current) => {\n      if (current[key] === signature) return current;\n      const next = { ...current, [key]: signature };\n      writeReadinessSeenState(next);\n      return next;\n    });\n  };\n\n  const hasNeedsAttention = unseenReadinessOpeningIds.size > 0;`;

  if (text.includes(oldReadyBlock)) {
    text = replaceOnce(text, oldReadyBlock, newReadyBlock, 'Per-opening Readiness attention state');
  } else if (!text.includes('const unseenReadinessOpeningIds = useMemo')) {
    fail('Per-opening Readiness attention state: expected source block was not found.');
  }

  if (!text.includes('unseenOpeningIds={unseenReadinessOpeningIds}')) {
    text = replaceOnce(
      text,
      `            <OpeningsGrid\n              rows={cardsPageData}\n              countsMap={openingCountsMap}\n              navigate={navigate}\n            />`,
      `            <OpeningsGrid\n              rows={cardsPageData}\n              countsMap={openingCountsMap}\n              navigate={navigate}\n              unseenOpeningIds={unseenReadinessOpeningIds}\n              onOpeningViewed={markReadinessOpeningSeen}\n            />`,
      'Opening grid readiness wiring'
    );

    text = replaceOnce(
      text,
      `        <ReadinessOpeningCards\n          openings={openingCards}\n          rows={readinessRows}\n          navigate={navigate}\n          onApproveScholar={setActivationCandidate}\n          approvalLoadingId={approvalLoadingId}\n        />`,
      `        <ReadinessOpeningCards\n          openings={openingCards}\n          rows={readinessRows}\n          navigate={navigate}\n          onApproveScholar={setActivationCandidate}\n          approvalLoadingId={approvalLoadingId}\n          unseenOpeningIds={unseenReadinessOpeningIds}\n          onOpeningViewed={markReadinessOpeningSeen}\n        />`,
      'Readiness cards seen-state wiring'
    );
  }

  return text;
}

const CONTRACT_TEST = `const test = require('node:test');\nconst assert = require('node:assert/strict');\nconst fs = require('fs');\nconst path = require('path');\n\nconst root = path.resolve(__dirname, '..');\nconst read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');\n\ntest('Admin bell shows the exact unread count instead of a dot', () => {\n  const source = read('../frontend/src/components/layout/AdminLayout.jsx');\n  assert.equal(source.includes("{unreadCount > 99 ? '99+' : unreadCount}"), true);\n  assert.doesNotMatch(source, /right-0\\.5 top-0\\.5 h-3 w-3 rounded-full border-2 border-white bg-red-500/);\n});\n\ntest('Admin notifications support per-item mark as read and unread', () => {\n  const layout = read('../frontend/src/components/layout/AdminLayout.jsx');\n  const hook = read('../frontend/src/hooks/usePortalNotifications.js');\n  const routes = read('routes/notificationRoutes.js');\n  const controller = read('controllers/notificationController.js');\n  const service = read('services/notificationService.js');\n\n  assert.match(layout, /Mark as unread/);\n  assert.match(layout, /Mark as read/);\n  assert.match(hook, /const markAsUnread = useCallback/);\n  assert.match(hook, /notifications\\/\\$\\{notificationId\\}\\/unread/);\n  assert.match(routes, /\\/:notificationId\\/unread/);\n  assert.match(controller, /MARK_NOTIFICATION_UNREAD/);\n  assert.match(service, /update\\(\\{ is_read: false, read_at: null \\}\\)/);\n});\n\ntest('Readiness attention is tracked per opening and clears when that opening is viewed', () => {\n  const source = read('../frontend/src/pages/ApplicationReview.jsx');\n  assert.match(source, /READINESS_SEEN_STORAGE_PREFIX/);\n  assert.match(source, /readinessAttentionSignatures/);\n  assert.match(source, /unseenReadinessOpeningIds/);\n  assert.match(source, /onOpeningViewed\\(itemId\\)/);\n  assert.match(source, /onOpeningViewed\\(opening\\.opening_id\\)/);\n  assert.match(source, /hasNeedsAttention = unseenReadinessOpeningIds\\.size > 0/);\n  assert.doesNotMatch(source, /hasNeedsAttention = readinessRows\\.length > 0/);\n});\n\ntest('Readiness seen state is scoped to the signed-in Admin account', () => {\n  const source = read('../frontend/src/pages/ApplicationReview.jsx');\n  assert.match(source, /sessionStorage\\.getItem\\('adminProfile'\\)/);\n  assert.match(source, /smart-pdm:admin:readiness-seen:v1/);\n});\n`;

function main() {
  const requestedRoot = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : process.cwd();
  const repoRoot = findRepoRoot(requestedRoot);

  console.log(PATCH_NAME);
  console.log(`Repository: ${repoRoot}\n`);

  const files = {};
  for (const [key, relative] of Object.entries(TARGETS)) {
    if (key === 'contractTest') continue;
    files[key] = readTarget(repoRoot, relative);
  }

  console.log('[1/3] Fixing Admin notification count + read/unread controls...');
  files.notificationService.next = patchNotificationService(files.notificationService.text);
  files.notificationController.next = patchNotificationController(files.notificationController.text);
  files.notificationRoutes.next = patchNotificationRoutes(files.notificationRoutes.text);
  files.notificationHook.next = patchNotificationHook(files.notificationHook.text);
  files.adminLayout.next = patchAdminLayout(files.adminLayout.text);
  console.log('      PASS');

  console.log('[2/3] Connecting Readiness attention to individual opening cards...');
  files.applicationReview.next = patchApplicationReview(files.applicationReview.text);
  console.log('      PASS');

  console.log('[3/3] Validating staged source before writes...');
  const mustContain = [
    [files.adminLayout.next, "{unreadCount > 99 ? '99+' : unreadCount}", 'numeric unread badge'],
    [files.adminLayout.next, 'Mark as unread', 'Admin mark unread control'],
    [files.notificationHook.next, 'const markAsUnread = useCallback(', 'mark unread hook'],
    [files.notificationRoutes.next, "'/:notificationId/unread'", 'mark unread route'],
    [files.applicationReview.next, 'unseenReadinessOpeningIds', 'per-opening Readiness attention'],
    [files.applicationReview.next, 'onOpeningViewed={markReadinessOpeningSeen}', 'Readiness opening wiring'],
  ];
  for (const [source, needle, label] of mustContain) {
    if (!source.includes(needle)) fail(`Staged validation failed: ${label}`);
  }
  console.log('      PASS');

  const baseline = captureBackendBaseline(repoRoot, 'pre-write baseline');

  const originals = new Map();
  const written = [];
  const testAbsolute = path.join(repoRoot, TARGETS.contractTest);
  const testExisted = fs.existsSync(testAbsolute);
  if (testExisted) originals.set(testAbsolute, fs.readFileSync(testAbsolute));

  const backupDir = path.join(repoRoot, '.smart-pdm-patch-backup', `notification-readiness-v2-${Date.now()}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const rollback = () => {
    console.log('\nRolling back notification/readiness patch...');
    for (const absolute of written.reverse()) {
      if (originals.has(absolute)) {
        fs.writeFileSync(absolute, originals.get(absolute));
      } else if (fs.existsSync(absolute)) {
        fs.unlinkSync(absolute);
      }
    }
    console.log(`Rollback completed. Backup: ${backupDir}`);
  };

  try {
    for (const file of Object.values(files)) {
      originals.set(file.absolute, Buffer.from(file.raw, 'utf8'));
      const backupPath = path.join(backupDir, file.relative);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.writeFileSync(backupPath, file.raw, 'utf8');
      fs.writeFileSync(file.absolute, restoreEol(file.next, file.eol), 'utf8');
      written.push(file.absolute);
    }

    fs.mkdirSync(path.dirname(testAbsolute), { recursive: true });
    fs.writeFileSync(testAbsolute, CONTRACT_TEST, 'utf8');
    written.push(testAbsolute);

    console.log('\n> node --check services/notificationService.js');
    let result = run('node', ['--check', 'services/notificationService.js'], { cwd: path.join(repoRoot, 'admin/backend') });
    if (result.status !== 0) fail('notificationService.js syntax check failed.');

    console.log('\n> node --check controllers/notificationController.js');
    result = run('node', ['--check', 'controllers/notificationController.js'], { cwd: path.join(repoRoot, 'admin/backend') });
    if (result.status !== 0) fail('notificationController.js syntax check failed.');

    console.log('\n> node --check routes/notificationRoutes.js');
    result = run('node', ['--check', 'routes/notificationRoutes.js'], { cwd: path.join(repoRoot, 'admin/backend') });
    if (result.status !== 0) fail('notificationRoutes.js syntax check failed.');

    console.log('\n> node --test test/admin-notification-readiness-ui-contract.test.js');
    result = run('node', ['--test', 'test/admin-notification-readiness-ui-contract.test.js'], { cwd: path.join(repoRoot, 'admin/backend') });
    if (result.status !== 0) fail('Targeted notification/readiness regression tests failed.');

    console.log('\n> npm run build');
    result = run('npm', ['run', 'build'], { cwd: path.join(repoRoot, 'admin/frontend') });
    if (result.status !== 0) fail('Admin frontend production build failed.');

    const after = captureBackendBaseline(repoRoot, 'after notification/readiness patch');
    if (after.status !== 0) {
      if (baseline.status === 0) {
        fail('Backend tests were green before the patch but are failing afterward.');
      }
      const newFailures = [...after.failures].filter((name) => !baseline.failures.has(name));
      if (newFailures.length) {
        console.error('\nNew failing backend tests introduced:');
        newFailures.forEach((name) => console.error(`  - ${name}`));
        fail('The patch introduced new backend test failures.');
      }
    }

    if (baseline.status !== 0) {
      console.log('\nWARNING: The repository had backend test failures before this patch.');
      console.log('No new failing backend tests were introduced, so the changes are being kept.');
    }

    console.log('\nPASS: Admin notification unread count + mark read/unread + per-opening Readiness attention passed.');
    console.log('Changed:');
    console.log('  - Bell badge now displays the exact unread count (99+ cap)');
    console.log('  - Admin notification items can be marked read or unread');
    console.log('  - Readiness red dot now represents unseen opening-specific readiness activity');
    console.log('  - Opening cards show their own red dot until that opening is viewed');
    console.log('  - Seen state is stored per Admin account in the browser');
    console.log(`Backup: ${backupDir}`);
  } catch (error) {
    rollback();
    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(`\nFAIL: ${error.message || error}`);
  process.exitCode = 1;
}
