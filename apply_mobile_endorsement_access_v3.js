const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Mobile Endorsement Access v3';
const DASHBOARD_MARKER = 'SMART_PDM_DASHBOARD_ENDORSEMENT_ACCESS_V1';
const MENU_MARKER = 'SMART_PDM_MENU_ENDORSEMENT_ACCESS_V1';

function parseArgs(argv) {
  let dryRun = false;
  let root = '.';

  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else root = arg;
  }

  return { dryRun, root: path.resolve(root) };
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

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);

  if (first < 0) {
    throw new Error(`${label}: expected source block was not found.`);
  }

  const second = source.indexOf(before, first + before.length);

  if (second >= 0) {
    throw new Error(
      `${label}: expected exactly one source block, found more than one.`
    );
  }

  return source.slice(0, first) + after + source.slice(first + before.length);
}

function ensureIncludes(source, needles, label) {
  for (const needle of needles) {
    if (!source.includes(needle)) {
      throw new Error(`${label}: missing expected contract: ${needle}`);
    }
  }
}

function run(command, args, cwd, label) {
  console.log(`\n> ${[command, ...args].join(' ')}`);

  let executable = command;
  let executableArgs = args;

  if (
    process.platform === 'win32' &&
    (command === 'npm' || command === 'flutter' || command === 'dart')
  ) {
    executable = process.env.ComSpec || 'cmd.exe';
    executableArgs = ['/d', '/s', '/c', [command, ...args].join(' ')];
  }

  const result = spawnSync(executable, executableArgs, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}.`);
  }
}

function makeBackup(root, originals) {
  const backupRoot = path.join(
    root,
    '.smart-pdm-patch-backup',
    `mobile-endorsement-access-v3-${Date.now()}`
  );

  for (const [filePath, original] of originals.entries()) {
    if (original == null) continue;

    const destination = path.join(backupRoot, path.relative(root, filePath));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, original, 'utf8');
  }

  return backupRoot;
}

function rollback(originals) {
  for (const [filePath, original] of originals.entries()) {
    if (original == null) {
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
      continue;
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, original, 'utf8');
  }
}

function patchDashboard(source) {
  if (source.includes(DASHBOARD_MARKER)) return source;

  const oldBlock =
`          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => Navigator.pushNamed(
                context,
                AppRoutes.documents,
                arguments: <String, dynamic>{
                  'initialTitle': _safeText(
                    summary.openingTitle,
                    fallback: title,
                  ),
                  'initialProgramName': _safeText(
                    summary.programName,
                    fallback: title,
                  ),
                },
              ),
              icon: const Icon(Icons.folder_copy_rounded, size: 18),
              label: const Text('Manage Documents'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: AppColors.darkBrown,
                elevation: 0,
                minimumSize: const Size.fromHeight(44),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),`;

  const newBlock =
`          // ${DASHBOARD_MARKER}
          LayoutBuilder(
            builder: (context, constraints) {
              final stackActions = constraints.maxWidth < 360;

              final manageDocumentsButton = FilledButton.icon(
                onPressed: () => Navigator.pushNamed(
                  context,
                  AppRoutes.documents,
                  arguments: <String, dynamic>{
                    'initialTitle': _safeText(
                      summary.openingTitle,
                      fallback: title,
                    ),
                    'initialProgramName': _safeText(
                      summary.programName,
                      fallback: title,
                    ),
                  },
                ),
                icon: const Icon(Icons.folder_copy_rounded, size: 18),
                label: const Text(
                  'Manage Documents',
                  textAlign: TextAlign.center,
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: AppColors.darkBrown,
                  elevation: 0,
                  minimumSize: const Size.fromHeight(44),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              );

              final endorsementButton = OutlinedButton.icon(
                onPressed: () =>
                    Navigator.pushNamed(context, AppRoutes.endorsement),
                icon: const Icon(
                  Icons.assignment_turned_in_outlined,
                  size: 18,
                ),
                label: const Text(
                  'View Endorsement',
                  textAlign: TextAlign.center,
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: _primaryText,
                  side: BorderSide(
                    color: _isDark
                        ? Colors.white.withValues(alpha: 0.18)
                        : AppColors.brown.withValues(alpha: 0.22),
                  ),
                  minimumSize: const Size.fromHeight(44),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              );

              if (stackActions) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    manageDocumentsButton,
                    const SizedBox(height: 8),
                    endorsementButton,
                  ],
                );
              }

              return Row(
                children: [
                  Expanded(child: manageDocumentsButton),
                  const SizedBox(width: 10),
                  Expanded(child: endorsementButton),
                ],
              );
            },
          ),`;

  return replaceOnce(
    source,
    oldBlock,
    newBlock,
    'Dashboard Manage Documents / Endorsement actions'
  );
}

function patchMenu(source) {
  if (source.includes(MENU_MARKER)) return source;

  const anchor =
`            const SizedBox(height: 22),
            Text(
              'Information',`;

  const replacement =
`            // ${MENU_MARKER}
            const SizedBox(height: 22),
            Text(
              'Application',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: titleColor,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.08)
                      : AppColors.brown.withValues(alpha: 0.09),
                ),
              ),
              child: _MenuListTile(
                icon: Icons.assignment_turned_in_outlined,
                title: 'Endorsement',
                subtitle: 'Track office review and access your official slip',
                onTap: () => _openRoute(AppRoutes.endorsement),
              ),
            ),
            const SizedBox(height: 22),
            Text(
              'Information',`;

  return replaceOnce(
    source,
    anchor,
    replacement,
    'Mobile Menu Endorsement entry'
  );
}

function buildContractTest() {
  return `const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const dashboard = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'dashboard',
    'presentation',
    'screens',
    'dashboard_screen.dart'
  )
);

const menu = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'menu',
    'presentation',
    'screens',
    'mobile_menu_screen.dart'
  )
);

const router = read(
  path.join(frontendRoot, 'lib', 'app', 'routes', 'app_router.dart')
);

const endorsement = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'forms',
    'presentation',
    'screens',
    'endorsement_screen.dart'
  )
);

test('Endorsement has a dedicated protected mobile route', () => {
  assert.match(router, /case AppRoutes\\.endorsement:/);
  assert.match(router, /child: EndorsementScreen\\(\\)/);
});

test('Mobile Menu exposes a permanent Endorsement entry', () => {
  assert.match(menu, /'Application'/);
  assert.match(menu, /title: 'Endorsement'/);
  assert.match(
    menu,
    /subtitle: 'Track office review and access your official slip'/
  );
  assert.match(menu, /_openRoute\\(AppRoutes\\.endorsement\\)/);
});

test('Dashboard current-status card keeps Manage Documents', () => {
  assert.match(dashboard, /'Manage Documents'/);
  assert.match(dashboard, /AppRoutes\\.documents/);
});

test('Dashboard current-status card adds View Endorsement beside Manage Documents', () => {
  assert.match(dashboard, /'View Endorsement'/);
  assert.match(
    dashboard,
    /Navigator\\.pushNamed\\(context, AppRoutes\\.endorsement\\)/
  );
});

test('Dashboard actions remain responsive on narrow screens', () => {
  assert.match(dashboard, /LayoutBuilder\\(/);
  assert.match(dashboard, /constraints\\.maxWidth < 360/);
  assert.match(dashboard, /Expanded\\(child: manageDocumentsButton\\)/);
  assert.match(dashboard, /Expanded\\(child: endorsementButton\\)/);
  assert.match(dashboard, /manageDocumentsButton,[\\s\\S]*endorsementButton/);
});

test('Endorsement screen remains the source of endorsement state', () => {
  assert.match(endorsement, /final workflow = summary\\.workflow/);
  assert.match(endorsement, /final endorsement = workflow\\?\\.endorsement/);
  assert.match(endorsement, /final slip = endorsement\\.slip/);
  assert.match(endorsement, /Current Step/);
  assert.match(endorsement, /Slip Status/);
  assert.match(
    endorsement,
    /Your endorsement moves in this order: SDO, Guidance, then Program Director\\./
  );
});

test('Endorsement screen remains the place for official slip access', () => {
  assert.match(
    endorsement,
    /View Endorsement Slip|Download My Endorsement Slip|Download PDF/
  );
  assert.match(endorsement, /slip\\.available/);
});

test('Dashboard does not duplicate endorsement state UI', () => {
  assert.doesNotMatch(
    dashboard,
    /class _DashboardEndorsementScreen|class EndorsementScreen/
  );
});
`;
}

function validate(dashboard, menu, router, endorsement, contract) {
  ensureIncludes(
    dashboard,
    [
      DASHBOARD_MARKER,
      "'Manage Documents'",
      "'View Endorsement'",
      'AppRoutes.endorsement',
      'constraints.maxWidth < 360',
    ],
    'Dashboard Endorsement access'
  );

  ensureIncludes(
    menu,
    [
      MENU_MARKER,
      "'Application'",
      "title: 'Endorsement'",
      "subtitle: 'Track office review and access your official slip'",
      '_openRoute(AppRoutes.endorsement)',
    ],
    'Menu Endorsement access'
  );

  ensureIncludes(
    router,
    [
      'case AppRoutes.endorsement:',
      'child: EndorsementScreen()',
    ],
    'Existing Endorsement route'
  );

  ensureIncludes(
    endorsement,
    [
      'final workflow = summary.workflow',
      'final endorsement = workflow?.endorsement',
      'final slip = endorsement.slip',
      'slip.available',
      'Current Step',
      'Slip Status',
      'Your endorsement moves in this order: SDO, Guidance, then Program Director.',
    ],
    'Existing Endorsement state screen'
  );

  ensureIncludes(
    contract,
    [
      'Mobile Menu exposes a permanent Endorsement entry',
      'Dashboard current-status card adds View Endorsement beside Manage Documents',
      'Dashboard actions remain responsive on narrow screens',
      'Endorsement screen remains the source of endorsement state',
    ],
    'Endorsement access regression tests'
  );
}

function main() {
  const { dryRun, root } = parseArgs(process.argv.slice(2));

  const files = {
    dashboard: path.join(
      root,
      'mobile',
      'frontend',
      'lib',
      'features',
      'dashboard',
      'presentation',
      'screens',
      'dashboard_screen.dart'
    ),
    menu: path.join(
      root,
      'mobile',
      'frontend',
      'lib',
      'features',
      'menu',
      'presentation',
      'screens',
      'mobile_menu_screen.dart'
    ),
    router: path.join(
      root,
      'mobile',
      'frontend',
      'lib',
      'app',
      'routes',
      'app_router.dart'
    ),
    endorsement: path.join(
      root,
      'mobile',
      'frontend',
      'lib',
      'features',
      'forms',
      'presentation',
      'screens',
      'endorsement_screen.dart'
    ),
    contract: path.join(
      root,
      'mobile',
      'backend',
      'test',
      'mobile-endorsement-access-contract.test.js'
    ),
  };

  console.log(PATCH_NAME);
  console.log(`Repository: ${root}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}\n`);

  const originalDashboard = readRequired(files.dashboard);
  const originalMenu = readRequired(files.menu);
  const router = readRequired(files.router);
  const endorsement = readRequired(files.endorsement);
  const originalContract = fs.existsSync(files.contract)
    ? normalize(fs.readFileSync(files.contract, 'utf8'))
    : null;

  console.log('[1/5] Verifying the current Endorsement route + workflow-state screen...');
  ensureIncludes(
    router,
    ['case AppRoutes.endorsement:', 'child: EndorsementScreen()'],
    'Existing Endorsement route'
  );
  ensureIncludes(
    endorsement,
    [
      'final workflow = summary.workflow',
      'final endorsement = workflow?.endorsement',
      'final slip = endorsement.slip',
      'slip.available',
      'Current Step',
      'Slip Status',
    ],
    'Existing Endorsement screen'
  );
  console.log('      PASS');

  console.log('[2/5] Adding Endorsement to the mobile Menu...');
  const stagedMenu = patchMenu(originalMenu);
  console.log('      PASS');

  console.log('[3/5] Adding View Endorsement beside Manage Documents on Dashboard...');
  const stagedDashboard = patchDashboard(originalDashboard);
  console.log('      PASS');

  console.log('[4/5] Verifying responsive Dashboard action layout...');
  ensureIncludes(
    stagedDashboard,
    [
      'constraints.maxWidth < 360',
      'manageDocumentsButton',
      'endorsementButton',
      'Expanded(child: manageDocumentsButton)',
      'Expanded(child: endorsementButton)',
    ],
    'Responsive Dashboard action row'
  );
  console.log('      PASS');

  console.log('[5/5] Building targeted navigation regression tests against current Endorsement state labels...');
  const stagedContract = buildContractTest();

  validate(
    stagedDashboard,
    stagedMenu,
    router,
    endorsement,
    stagedContract
  );
  console.log('      PASS');

  console.log('\nFiles affected by this installer:');
  console.log('  1. mobile/frontend/lib/features/dashboard/presentation/screens/dashboard_screen.dart');
  console.log('  2. mobile/frontend/lib/features/menu/presentation/screens/mobile_menu_screen.dart');
  console.log('  3. mobile/backend/test/mobile-endorsement-access-contract.test.js (new)');
  console.log('\nAudited but not modified:');
  console.log('  - mobile/frontend/lib/app/routes/app_router.dart');
  console.log('  - mobile/frontend/lib/features/forms/presentation/screens/endorsement_screen.dart');

  if (dryRun) {
    console.log('\nPASS: dry-run completed. No files were changed.');
    return;
  }

  const originals = new Map([
    [files.dashboard, originalDashboard],
    [files.menu, originalMenu],
    [files.contract, originalContract],
  ]);

  const backupRoot = makeBackup(root, originals);
  let wroteFiles = false;

  try {
    fs.writeFileSync(files.dashboard, stagedDashboard, 'utf8');
    fs.writeFileSync(files.menu, stagedMenu, 'utf8');
    fs.mkdirSync(path.dirname(files.contract), { recursive: true });
    fs.writeFileSync(files.contract, stagedContract, 'utf8');
    wroteFiles = true;

    run(
      process.execPath,
      ['--test', files.contract],
      path.join(root, 'mobile', 'backend'),
      'Mobile Endorsement access contract tests'
    );

    run(
      'dart',
      [
        'format',
        '--output=none',
        files.dashboard,
        files.menu,
      ],
      path.join(root, 'mobile', 'frontend'),
      'Dashboard/Menu Dart syntax and formatter validation'
    );

    console.log('\nPASS: Mobile Endorsement screen is now directly accessible from Menu and Dashboard.');
    console.log('\nVerified behavior:');
    console.log('  [x] Existing dedicated Endorsement state screen is preserved');
    console.log('  [x] Mobile Menu includes Endorsement');
    console.log('  [x] Dashboard Current Status keeps Manage Documents');
    console.log('  [x] Dashboard Current Status adds View Endorsement');
    console.log('  [x] Both buttons sit side-by-side when space allows');
    console.log('  [x] Buttons stack cleanly on narrow screens');
    console.log('  [x] Both navigation paths open AppRoutes.endorsement');
    console.log('  [x] Endorsement screen remains responsible for state + slip access');
    console.log(`\nBackup: ${backupRoot}`);
  } catch (error) {
    if (wroteFiles) {
      console.error('\nPatch verification failed. Restoring previous files...');
      rollback(originals);
      console.error(`Rollback completed. Backup: ${backupRoot}`);
    }

    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(`\nFAIL: ${error.message}`);
  process.exitCode = 1;
}
