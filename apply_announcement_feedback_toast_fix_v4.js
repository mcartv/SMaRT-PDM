#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);

  while (true) {
    if (
      fs.existsSync(path.join(dir, 'admin', 'frontend', 'src', 'App.jsx')) &&
      fs.existsSync(
        path.join(
          dir,
          'admin',
          'frontend',
          'src',
          'pages',
          'AnnouncementsManagement.jsx'
        )
      )
    ) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not find the SMaRT-PDM repository root. Run this script from inside D:\\projects\\SMaRT-PDM.'
  );
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backup(file) {
  if (!fs.existsSync(file)) return null;
  const target = `${file}.bak-feedback-toast-v4-${stamp()}`;
  fs.copyFileSync(file, target);
  return target;
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

function removeRange(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) return text;

  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) {
    throw new Error(`Could not safely remove ${label}; end marker was not found.`);
  }

  return text.slice(0, start) + text.slice(end);
}

function patchFunction(text, startMarker, endMarker, patcher, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`Could not find ${label}.`);
  }

  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) {
    throw new Error(`Could not find the end of ${label}.`);
  }

  return (
    text.slice(0, start) +
    patcher(text.slice(start, end)) +
    text.slice(end)
  );
}

function insertBeforeCatch(section, code, label) {
  const positions = [
    section.lastIndexOf('\n    } catch (err) {'),
    section.lastIndexOf('\n    } catch (error) {'),
  ].filter((value) => value >= 0);

  if (!positions.length) {
    throw new Error(`Could not find ${label} catch block.`);
  }

  const position = Math.max(...positions);

  return (
    section.slice(0, position) +
    '\n' +
    code +
    section.slice(position)
  );
}

const repo = findRepoRoot(process.cwd());
const frontend = path.join(repo, 'admin', 'frontend');

const announcementPath = path.join(
  frontend,
  'src',
  'pages',
  'AnnouncementsManagement.jsx'
);

const utilDir = path.join(frontend, 'src', 'utils');
const appToastPath = path.join(utilDir, 'appToast.js');

const originalSource = fs.readFileSync(announcementPath, 'utf8');
const usesCrlf = originalSource.includes('\r\n');

let source = originalSource.replace(/\r\n/g, '\n');

const announcementBackup = backup(announcementPath);
const appToastBackup = backup(appToastPath);

const appToastSource = `import { toast } from 'sonner';

const DEFAULT_TITLES = Object.freeze({
  success: 'Completed',
  error: 'Something went wrong',
  warning: 'Please review',
  info: 'Notice',
});

export function showAppToast(
  tone = 'info',
  title = '',
  message = '',
  options = {}
) {
  const normalizedTone = String(tone || 'info').toLowerCase();

  const method = ['success', 'error', 'warning', 'info'].includes(normalizedTone)
    ? normalizedTone
    : 'info';

  const heading =
    String(title || '').trim() ||
    DEFAULT_TITLES[method];

  const description = String(message || '').trim();

  return toast[method](heading, {
    description: description || undefined,
    duration: method === 'error' ? 5000 : 3600,
    ...options,
  });
}

export const appToast = Object.freeze({
  success: (title, message, options) =>
    showAppToast('success', title, message, options),

  error: (title, message, options) =>
    showAppToast('error', title, message, options),

  warning: (title, message, options) =>
    showAppToast('warning', title, message, options),

  info: (title, message, options) =>
    showAppToast('info', title, message, options),
});
`;

fs.mkdirSync(utilDir, { recursive: true });
fs.writeFileSync(
  appToastPath,
  usesCrlf ? appToastSource.replace(/\n/g, '\r\n') : appToastSource,
  'utf8'
);

/* Add shared helper import. */
if (!source.includes("from '@/utils/appToast'")) {
  const anchor = "import { buildApiUrl } from '@/api';";

  if (!source.includes(anchor)) {
    throw new Error('Could not find Announcements buildApiUrl import.');
  }

  source = source.replace(
    anchor,
    `${anchor}\nimport { showAppToast } from '@/utils/appToast';`
  );
}

/* Remove the old blocking feedback modal component. */
source = removeRange(
  source,
  'function FeedbackModal({',
  'function EmptyList({ archived }) {',
  'FeedbackModal component'
);

/* Remove old feedback state/callback. */
if (source.includes('  const [feedbackModal, setFeedbackModal] = useState({')) {
  source = removeRange(
    source,
    '  const [feedbackModal, setFeedbackModal] = useState({',
    '  const loadPrograms = useCallback',
    'FeedbackModal state and callback'
  );
}

if (source.includes('  const showFeedback = useCallback(')) {
  source = removeRange(
    source,
    '  const showFeedback = useCallback(',
    '  const loadPrograms = useCallback',
    'showFeedback callback'
  );
}

/* Convert all calls. */
source = source.replace(/\bshowFeedback\s*\(/g, 'showAppToast(');

/*
 * IMPORTANT V4 FIX:
 * loadAnnouncements previously depended on [showFeedback].
 * showAppToast is an imported module function, so it does not belong in the
 * useCallback dependency array.
 */
source = source.replace(/\[\s*showFeedback\s*\]/g, '[]');

/* Remove any rendered old FeedbackModal JSX. */
const feedbackRenderStart = source.indexOf('      <FeedbackModal');

if (feedbackRenderStart >= 0) {
  const feedbackRenderEnd = source.indexOf('\n      />', feedbackRenderStart);

  if (feedbackRenderEnd < 0) {
    throw new Error('Could not safely remove rendered FeedbackModal JSX.');
  }

  source =
    source.slice(0, feedbackRenderStart) +
    source.slice(feedbackRenderEnd + '\n      />'.length);
}

/* Add missing success results. */
source = patchFunction(
  source,
  '  const handleArchive = async (id) => {',
  '  const handleRestore = async (id) => {',
  (section) => {
    if (section.includes("'Announcement archived'")) return section;

    return insertBeforeCatch(
      section,
      `      showAppToast(
        'success',
        'Announcement archived',
        'The announcement was moved to Archived.'
      );`,
      'handleArchive'
    );
  },
  'handleArchive'
);

source = patchFunction(
  source,
  '  const handleRestore = async (id) => {',
  '  const handlePublish = async (id) => {',
  (section) => {
    if (section.includes("'Announcement restored'")) return section;

    return insertBeforeCatch(
      section,
      `      showAppToast(
        'success',
        'Announcement restored',
        'The announcement was restored successfully.'
      );`,
      'handleRestore'
    );
  },
  'handleRestore'
);

source = patchFunction(
  source,
  '  const handlePublish = async (id) => {',
  '  if (loading) {',
  (section) => {
    if (section.includes("'Announcement published'")) return section;

    return insertBeforeCatch(
      section,
      `      showAppToast(
        'success',
        'Announcement published',
        'The announcement is now visible to its intended audience.'
      );`,
      'handlePublish'
    );
  },
  'handlePublish'
);

/* Final sanity checks. */
const checks = [
  ['shared toast import', source.includes("import { showAppToast } from '@/utils/appToast';")],
  ['old FeedbackModal component removed', !source.includes('function FeedbackModal({')],
  ['old FeedbackModal state removed', !source.includes('feedbackModal')],
  ['old showFeedback references removed', !/\bshowFeedback\b/.test(source)],
  ['toast calls exist', source.includes('showAppToast(')],
  ['success toast exists', /showAppToast\(\s*'success'/m.test(source)],
  ['error toast exists', /showAppToast\(\s*'error'/m.test(source)],
  ['discard modal retained', source.includes('function DiscardAnnouncementModal({')],
  ['template confirmation retained', source.includes('function ConfirmTemplateApplyModal({')],
];

const failed = checks.filter(([, ok]) => !ok);

if (failed.length) {
  throw new Error(
    `Validation failed before writing: ${failed.map(([name]) => name).join(', ')}`
  );
}

fs.writeFileSync(
  announcementPath,
  usesCrlf ? source.replace(/\n/g, '\r\n') : source,
  'utf8'
);

console.log('\nAnnouncement feedback toast v4 applied.\n');
console.log('Changed:');
console.log('  admin/frontend/src/pages/AnnouncementsManagement.jsx');
console.log('  admin/frontend/src/utils/appToast.js');

console.log('\nCompact top-right feedback:');
console.log('  - saved / updated');
console.log('  - draft saved');
console.log('  - published');
console.log('  - archived');
console.log('  - restored');
console.log('  - errors');

console.log('\nConfirmation dialogs retained:');
console.log('  - unsaved announcement');
console.log('  - template replacement / clear form');

console.log('\nBackups:');
console.log(`  ${announcementBackup}`);
if (appToastBackup) console.log(`  ${appToastBackup}`);

run('npm', ['run', 'build'], frontend);

console.log('\nPASS: Admin frontend build completed.');
