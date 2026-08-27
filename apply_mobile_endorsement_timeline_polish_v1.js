const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Mobile Endorsement Timeline Polish v1';
const TIMELINE_MARKER = 'SMART_PDM_ENDORSEMENT_TIMELINE_POLISH_V1';

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

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`${label}: start marker was not found.`);
  }

  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) {
    throw new Error(`${label}: end marker was not found.`);
  }

  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

function replaceTestBlock(source, testName, nextTestName, replacement) {
  const startMarker = `test('${testName}'`;
  const endMarker = `test('${nextTestName}'`;

  const start = source.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`Regression test update: "${testName}" was not found.`);
  }

  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) {
    throw new Error(`Regression test update: next test "${nextTestName}" was not found.`);
  }

  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
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
      throw new Error(`${label}: obsolete timeline contract remains: ${needle}`);
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
    `mobile-endorsement-timeline-polish-v1-${Date.now()}`
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

function buildRoadmap() {
  return `class _EndorsementRoadmap extends StatelessWidget {
  const _EndorsementRoadmap({
    required this.currentStage,
    required this.overallStatus,
  });

  final String currentStage;
  final String overallStatus;

  int _activeIndex() {
    if (overallStatus.trim().toLowerCase() == 'completed') return 4;

    switch (currentStage.trim().toLowerCase()) {
      case 'pending_sdo':
        return 1;
      case 'pending_guidance':
        return 2;
      case 'pending_pd':
        return 3;
      case 'completed':
        return 4;
      default:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    // ${TIMELINE_MARKER}
    const steps = <({String shortLabel, String semanticLabel})>[
      (shortLabel: 'Submitted', semanticLabel: 'Application submitted'),
      (shortLabel: 'SDO', semanticLabel: 'SDO review'),
      (shortLabel: 'Guidance', semanticLabel: 'Guidance review'),
      (shortLabel: 'PD', semanticLabel: 'Program Director review'),
      (shortLabel: 'Done', semanticLabel: 'Endorsement completed'),
    ];

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark
        ? AppColors.applicantDarkSurface
        : AppColors.applicantLightSurface;
    final outline = isDark
        ? AppColors.applicantDarkOutline
        : AppColors.applicantLightOutline;
    final primaryText = isDark
        ? AppColors.applicantDarkText
        : AppColors.applicantLightText;
    final secondaryText = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.applicantLightTextMuted;
    final completedColor = isDark ? AppColors.lightBlue : AppColors.teal;
    final activeColor = AppColors.gold;
    final activeIndex = _activeIndex();
    final allDone = overallStatus.trim().toLowerCase() == 'completed';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: outline),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          const nodeSize = 28.0;
          final trackWidth = constraints.maxWidth - nodeSize;
          final safeTrackWidth = trackWidth < 0 ? 0.0 : trackWidth;
          final progressFraction = allDone
              ? 1.0
              : (activeIndex / (steps.length - 1)).clamp(0.0, 1.0);

          return Column(
            children: [
              SizedBox(
                height: nodeSize,
                child: Stack(
                  alignment: Alignment.centerLeft,
                  children: [
                    Positioned(
                      left: nodeSize / 2,
                      right: nodeSize / 2,
                      top: (nodeSize / 2) - 1,
                      child: Container(
                        height: 2,
                        decoration: BoxDecoration(
                          color: outline,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    Positioned(
                      left: nodeSize / 2,
                      top: (nodeSize / 2) - 1,
                      child: Container(
                        width: safeTrackWidth * progressFraction,
                        height: 2,
                        decoration: BoxDecoration(
                          color: completedColor,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: List.generate(steps.length, (index) {
                        final isDone = allDone || index < activeIndex;
                        final isActive = !allDone && index == activeIndex;
                        final nodeColor = isDone
                            ? completedColor
                            : isActive
                            ? activeColor
                            : outline;

                        return Semantics(
                          label: steps[index].semanticLabel,
                          value: isDone
                              ? 'Completed'
                              : isActive
                              ? 'Current'
                              : 'Pending',
                          child: Container(
                            width: nodeSize,
                            height: nodeSize,
                            decoration: BoxDecoration(
                              color: isDone
                                  ? completedColor
                                  : isActive
                                  ? activeColor.withValues(alpha: 0.16)
                                  : surface,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: nodeColor,
                                width: 2,
                              ),
                              boxShadow: isActive
                                  ? [
                                      BoxShadow(
                                        color: activeColor.withValues(
                                          alpha: 0.18,
                                        ),
                                        blurRadius: 8,
                                        spreadRadius: 2,
                                      ),
                                    ]
                                  : null,
                            ),
                            child: isDone
                                ? Icon(
                                    Icons.check_rounded,
                                    size: 16,
                                    color: isDark
                                        ? AppColors.darkBrown
                                        : Colors.white,
                                  )
                                : isActive
                                ? Icon(
                                    Icons.circle,
                                    size: 8,
                                    color: activeColor,
                                  )
                                : null,
                          ),
                        );
                      }),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: List.generate(steps.length, (index) {
                  final isDone = allDone || index < activeIndex;
                  final isActive = !allDone && index == activeIndex;

                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        left: index == 0 ? 0 : 2,
                        right: index == steps.length - 1 ? 0 : 2,
                      ),
                      child: Text(
                        steps[index].shortLabel,
                        maxLines: 1,
                        overflow: TextOverflow.fade,
                        softWrap: false,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: isDone || isActive
                              ? primaryText
                              : secondaryText,
                          fontWeight: isDone || isActive
                              ? FontWeight.w800
                              : FontWeight.w600,
                          fontSize: 10.5,
                          height: 1.1,
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ],
          );
        },
      ),
    );
  }
}`;
}

function main() {
  const { dryRun, root } = parseArgs(process.argv.slice(2));

  const files = {
    screen: path.join(
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
      'endorsement-ui-cleanup-contract.test.js'
    ),
  };

  console.log(PATCH_NAME);
  console.log(`Repository: ${root}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}\n`);

  const originalScreen = readRequired(files.screen);
  const originalContract = readRequired(files.contract);

  console.log('[1/4] Verifying the current cleaned Endorsement timeline...');
  ensureIncludes(
    originalScreen,
    [
      'class _EndorsementRoadmap extends StatelessWidget',
      "title: 'Endorsement Timeline'",
      "'Submitted'",
      "'Guidance'",
      "'Done'",
      'AppColors.applicantDarkSurface',
    ],
    'Current Endorsement timeline'
  );
  console.log('      PASS');

  console.log('[2/4] Rebuilding the roadmap with one clean track + evenly spaced nodes...');
  const stagedScreen = replaceRange(
    originalScreen,
    'class _EndorsementRoadmap extends StatelessWidget {',
    'class _ReviewTile extends StatelessWidget {',
    buildRoadmap(),
    'Endorsement roadmap'
  );
  console.log('      PASS');

  console.log('[3/4] Updating the timeline regression contract...');
  const updatedTimelineTest = `test('Renders a clean five-node connected Endorsement timeline', () => {
  assert.match(screen, /${TIMELINE_MARKER}/);
  assert.match(screen, /'Submitted'/);
  assert.match(screen, /'SDO'/);
  assert.match(screen, /'Guidance'/);
  assert.match(screen, /shortLabel: 'PD'/);
  assert.match(screen, /semanticLabel: 'Program Director review'/);
  assert.match(screen, /'Done'/);
  assert.match(screen, /Stack\\(/);
  assert.match(screen, /mainAxisAlignment: MainAxisAlignment\\.spaceBetween/);
  assert.match(screen, /safeTrackWidth \\* progressFraction/);
});`;

  let stagedContract = replaceTestBlock(
    originalContract,
    'Renders a five-node connected Endorsement timeline',
    'Keeps Office Results',
    updatedTimelineTest
  );

  ensureExcludes(
    stagedContract,
    [
      "/'Program\\\\nDirector'/",
      'List\\.generate\\(labels\\.length',
    ],
    'Timeline regression contract'
  );
  console.log('      PASS');

  console.log('[4/4] Validating compact labels, accessibility, and dark-mode contracts...');
  ensureIncludes(
    stagedScreen,
    [
      TIMELINE_MARKER,
      "shortLabel: 'PD'",
      "semanticLabel: 'Program Director review'",
      'mainAxisAlignment: MainAxisAlignment.spaceBetween',
      'safeTrackWidth * progressFraction',
      'AppColors.applicantDarkSurface',
      'AppColors.applicantLightSurface',
      'fontSize: 10.5',
    ],
    'Polished Endorsement roadmap'
  );

  ensureExcludes(
    stagedScreen,
    [
      "'Program\\nDirector'",
      'connectorLeftDone',
      'connectorRightDone',
    ],
    'Old Endorsement roadmap'
  );

  console.log('      PASS');

  console.log('\nFiles affected by this installer:');
  console.log('  1. mobile/frontend/lib/features/forms/presentation/screens/endorsement_screen.dart');
  console.log('  2. mobile/backend/test/endorsement-ui-cleanup-contract.test.js');
  console.log('\nNo backend workflow, API, database, or PDF-generation files are changed.');

  if (dryRun) {
    console.log('\nPASS: dry-run completed. No files were changed.');
    return;
  }

  const originals = new Map([
    [files.screen, originalScreen],
    [files.contract, originalContract],
  ]);

  const backupRoot = makeBackup(root, originals);
  let wroteFiles = false;

  try {
    fs.writeFileSync(files.screen, stagedScreen, 'utf8');
    fs.writeFileSync(files.contract, stagedContract, 'utf8');
    wroteFiles = true;

    run(
      process.execPath,
      ['--test', files.contract],
      path.join(root, 'mobile', 'backend'),
      'Endorsement UI regression tests'
    );

    run(
      'dart',
      ['format', '--output=none', files.screen],
      path.join(root, 'mobile', 'frontend'),
      'Endorsement Dart formatter/syntax validation'
    );

    console.log('\nPASS: Endorsement timeline polish completed.');
    console.log('\nVerified behavior:');
    console.log('  [x] One continuous timeline track instead of segmented mini-lines');
    console.log('  [x] Five evenly spaced nodes');
    console.log('  [x] Compact one-line labels: Submitted / SDO / Guidance / PD / Done');
    console.log('  [x] Program Director remains accessible through semantic label');
    console.log('  [x] Completed nodes use the mobile teal/light-blue scheme');
    console.log('  [x] Current node uses the mobile gold accent');
    console.log('  [x] Dark mode remains supported');
    console.log('  [x] Existing Office Results and Slip Information are untouched');
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
