const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Admin Messaging Two-Mode Icon Compact Animated v2';
const PATCH_MARKER = 'SMART_PDM_ADMIN_MESSAGES_TWO_MODE_ICON_COMPACT_ANIMATED_V2';
const PREVIOUS_MARKER = 'SMART_PDM_ADMIN_MESSAGES_TWO_MODE_ICON_COMPACT_V1';

function parseArgs(argv) {
  let dryRun = false;
  let skipBuild = false;
  let root = '.';

  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--skip-build') skipBuild = true;
    else root = arg;
  }

  return { dryRun, skipBuild, root: path.resolve(root) };
}

function normalize(value) {
  return String(value || '').replace(/\r\n/g, '\n');
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
  return normalize(fs.readFileSync(filePath, 'utf8'));
}

function countOccurrences(source, needle) {
  if (!needle) return 0;
  let count = 0;
  let cursor = 0;

  while (true) {
    const index = source.indexOf(needle, cursor);
    if (index < 0) return count;
    count += 1;
    cursor = index + needle.length;
  }
}

function replaceExactCount(source, before, after, expectedCount, label) {
  const count = countOccurrences(source, before);
  if (count !== expectedCount) {
    throw new Error(`${label}: expected ${expectedCount} occurrence(s), found ${count}.`);
  }
  return source.split(before).join(after);
}

function ensureIncludes(source, needles, label) {
  for (const needle of needles) {
    if (!source.includes(needle)) {
      throw new Error(`${label}: missing expected contract: ${needle}`);
    }
  }
}

function ensureExcludes(source, needles, label) {
  for (const needle of needles) {
    if (source.includes(needle)) {
      throw new Error(`${label}: obsolete behavior remains: ${needle}`);
    }
  }
}

function run(command, args, cwd, label) {
  console.log(`\n> ${[command, ...args].join(' ')}`);

  let executable = command;
  let executableArgs = args;

  if (process.platform === 'win32' && (command === 'npm' || command === 'npx')) {
    executable = process.env.ComSpec || 'cmd.exe';
    executableArgs = ['/d', '/s', '/c', [command, ...args].join(' ')];
  }

  const result = spawnSync(executable, executableArgs, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`);
}

function makeBackup(root, filePath, original) {
  const backupRoot = path.join(
    root,
    '.smart-pdm-patch-backup',
    `admin-messages-two-mode-animated-v2-${Date.now()}`
  );

  const destination = path.join(backupRoot, path.relative(root, filePath));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, original, 'utf8');

  return backupRoot;
}

function addMarker(source) {
  if (source.includes(PATCH_MARKER)) return source;

  if (source.includes(`// ${PREVIOUS_MARKER}`)) {
    return source.replace(
      `// ${PREVIOUS_MARKER}`,
      `// ${PREVIOUS_MARKER}\n// ${PATCH_MARKER}`
    );
  }

  const anchors = [
    '// SMART_PDM_ADMIN_MESSAGES_COMPACT_LAYOUT_V1',
    '// SMART-PDM_ADMIN_MESSAGES_EMBEDDED_GROUP_INFO_V2',
    '// SMART-PDM_ADMIN_MESSAGES_RESPONSIVE_V1',
  ];

  for (const anchor of anchors) {
    if (source.includes(anchor)) {
      return source.replace(anchor, `${anchor}\n// ${PATCH_MARKER}`);
    }
  }

  return `// ${PATCH_MARKER}\n${source}`;
}

function applyTwoModeFix(source) {
  // Support both the current GitHub regression and installations that already
  // received v1. Only modify the stale checks when they still exist.
  if (source.includes("const iconOnly = density === 'icons'")) {
    source = replaceExactCount(
      source,
      "const iconOnly = density === 'icons'",
      "const iconOnly = density === 'compact'",
      1,
      'ThreadRow compact icon-only mapping'
    );
  }

  const staleEqualsCount = countOccurrences(source, "conversationPaneMode === 'icons'");
  if (staleEqualsCount) {
    source = replaceExactCount(
      source,
      "conversationPaneMode === 'icons'",
      "conversationPaneMode === 'compact'",
      staleEqualsCount,
      'Compact chat-list equality checks'
    );
  }

  const staleNotEqualsCount = countOccurrences(source, "conversationPaneMode !== 'icons'");
  if (staleNotEqualsCount) {
    source = replaceExactCount(
      source,
      "conversationPaneMode !== 'icons'",
      "conversationPaneMode !== 'compact'",
      staleNotEqualsCount,
      'Compact chat-list inequality checks'
    );
  }

  return source;
}

function applySmoothAnimation(source) {
  const gridBefore =
    "className={`grid min-h-0 flex-1 gap-0 ${groupInfoOpen && selectedItem?.type === 'group' ? 'grid-cols-1' : conversationPaneGridClass}`}";
  const gridAfter =
    "className={`grid min-h-0 flex-1 gap-0 transition-[grid-template-columns] duration-300 ease-in-out motion-reduce:transition-none ${groupInfoOpen && selectedItem?.type === 'group' ? 'grid-cols-1' : conversationPaneGridClass}`}";

  // If the animation is not already there, add it to the desktop grid.
  if (!source.includes('transition-[grid-template-columns] duration-300 ease-in-out')) {
    source = replaceExactCount(
      source,
      gridBefore,
      gridAfter,
      1,
      'Conversation pane width animation'
    );
  }

  const headerBefore =
    "className={`${conversationPaneMode === 'compact' ? 'px-2 py-3' : 'space-y-3 px-4 py-4'} border-b border-stone-100`}";
  const headerAfter =
    "className={`${conversationPaneMode === 'compact' ? 'px-2 py-3' : 'space-y-3 px-4 py-4'} border-b border-stone-100 transition-[padding] duration-300 ease-in-out motion-reduce:transition-none`}";

  if (!source.includes('border-b border-stone-100 transition-[padding] duration-300 ease-in-out')) {
    source = replaceExactCount(
      source,
      headerBefore,
      headerAfter,
      1,
      'Conversation pane header padding animation'
    );
  }

  // Animate the compact/full toggle itself so the control does not feel abrupt.
  const toggleBefore =
    'className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition hover:bg-stone-50 hover:text-stone-800"';
  const toggleAfter =
    'className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition-all duration-300 ease-in-out hover:bg-stone-50 hover:text-stone-800 motion-reduce:transition-none"';

  if (!source.includes('transition-all duration-300 ease-in-out hover:bg-stone-50')) {
    source = replaceExactCount(
      source,
      toggleBefore,
      toggleAfter,
      1,
      'Compact/full toggle animation'
    );
  }

  return source;
}

function patchSource(original) {
  if (original.includes(PATCH_MARKER)) {
    return { staged: original, alreadyPatched: true };
  }

  ensureIncludes(
    original,
    [
      "const conversationPaneModes = ['full', 'compact']",
      "'lg:grid-cols-[76px_minmax(0,1fr)]'",
      "'lg:grid-cols-[340px_minmax(0,1fr)]'",
      "current === 'full' ? 'compact' : 'full'",
      "if (saved === 'icons') return 'compact'",
      'density={conversationPaneMode}',
      "groupInfoOpen && selectedItem?.type === 'group' ? 'grid-cols-1' : conversationPaneGridClass",
    ],
    'Current AdminMessages.jsx'
  );

  let source = addMarker(original);
  source = applyTwoModeFix(source);
  source = applySmoothAnimation(source);

  return { staged: source, alreadyPatched: false };
}

function verifyPatchedSource(source) {
  ensureIncludes(
    source,
    [
      PATCH_MARKER,
      "const conversationPaneModes = ['full', 'compact']",
      "const iconOnly = density === 'compact'",
      "const compact = density === 'compact'",
      "conversationPaneMode === 'compact' ? 'px-2 py-3' : 'space-y-3 px-4 py-4'",
      "conversationPaneMode === 'compact' ? 'justify-center' : 'justify-between'",
      "conversationPaneMode !== 'compact' ? (",
      "if (saved === 'icons') return 'compact'",
      "'lg:grid-cols-[76px_minmax(0,1fr)]'",
      "'lg:grid-cols-[340px_minmax(0,1fr)]'",
      "current === 'full' ? 'compact' : 'full'",
      'density={conversationPaneMode}',
      'transition-[grid-template-columns] duration-300 ease-in-out motion-reduce:transition-none',
      'transition-[padding] duration-300 ease-in-out motion-reduce:transition-none',
      'transition-all duration-300 ease-in-out hover:bg-stone-50 hover:text-stone-800 motion-reduce:transition-none',
    ],
    'Animated two-mode compact result'
  );

  ensureExcludes(
    source,
    [
      "const conversationPaneModes = ['full', 'compact', 'icons']",
      "const iconOnly = density === 'icons'",
      "conversationPaneMode === 'icons'",
      "conversationPaneMode !== 'icons'",
      "icons: 'lg:grid-cols-[76px_minmax(0,1fr)]'",
      'cycleConversationPaneMode',
    ],
    'Removed third-mode behavior'
  );

  // Keep the old saved-value migration exactly once. This string intentionally
  // remains because it maps old browser preferences into the new compact mode.
  if (countOccurrences(source, "saved === 'icons'") !== 1) {
    throw new Error('Legacy localStorage migration must remain exactly once.');
  }
}

function main() {
  const { dryRun, skipBuild, root } = parseArgs(process.argv.slice(2));
  const file = path.join(root, 'admin', 'frontend', 'src', 'pages', 'AdminMessages.jsx');
  const frontend = path.join(root, 'admin', 'frontend');

  console.log(PATCH_NAME);
  console.log(`Repository: ${root}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}\n`);

  const original = readRequired(file);

  console.log('[1/5] Verifying messaging layout...');
  if (original.includes(PATCH_MARKER)) {
    verifyPatchedSource(original);
    console.log('      PASS - animated v2 is already installed and valid.');
    console.log('\nNo files were changed.');
    return;
  }

  ensureIncludes(
    original,
    [
      "const conversationPaneModes = ['full', 'compact']",
      "'lg:grid-cols-[76px_minmax(0,1fr)]'",
      "'lg:grid-cols-[340px_minmax(0,1fr)]'",
      "current === 'full' ? 'compact' : 'full'",
    ],
    'Two-mode messaging state'
  );
  console.log('      PASS');

  console.log('[2/5] Enforcing Full + Compact icon-only behavior...');
  const { staged } = patchSource(original);
  verifyPatchedSource(staged);
  console.log('      PASS');

  console.log('[3/5] Adding smooth 300ms pane animation...');
  console.log('      grid-template-columns: 340px <-> 76px');
  console.log('      header padding + toggle transitions included');
  console.log('      prefers-reduced-motion respected');

  if (dryRun) {
    console.log('\n[DRY RUN] No files were changed and no build was executed.');
    return;
  }

  console.log('[4/5] Creating backup and writing patch...');
  const backupRoot = makeBackup(root, file, original);
  fs.writeFileSync(file, staged, 'utf8');
  console.log(`      Backup: ${backupRoot}`);

  try {
    if (!skipBuild) {
      console.log('[5/5] Running admin frontend production build...');
      run('npm', ['run', 'build'], frontend, 'Admin frontend build');
    } else {
      console.log('[5/5] Build skipped by --skip-build.');
    }
  } catch (error) {
    fs.writeFileSync(file, original, 'utf8');
    console.error('\nBuild failed. AdminMessages.jsx was restored automatically.');
    throw error;
  }

  console.log('\nPATCH APPLIED SUCCESSFULLY');
  console.log('Affected file:');
  console.log('  admin/frontend/src/pages/AdminMessages.jsx');
  console.log('\nResult:');
  console.log('  Full    = 340px conversation list');
  console.log('  Compact = 76px avatar/icon-only rail');
  console.log('  Switch  = smooth 300ms width/padding transition');
  console.log('\nAfterwards:');
  console.log('  1. Restart npm run dev if the frontend is already running.');
  console.log('  2. Hard refresh the browser (Ctrl+Shift+R).');
  console.log('  3. Open Messages and toggle Full <-> Compact.');
}

try {
  main();
} catch (error) {
  console.error(`\nERROR: ${error.message}`);
  process.exit(1);
}
