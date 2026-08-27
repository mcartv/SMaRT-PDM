const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Mobile Endorsement Timeline Polish v2';
const TIMELINE_MARKER = 'SMART_PDM_ENDORSEMENT_TIMELINE_POLISH_V2';

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
  if (!fs.existsSync(filePath)) throw new Error(`Required file not found: ${filePath}`);
  return normalize(fs.readFileSync(filePath, 'utf8'));
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker was not found.`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label}: end marker was not found.`);
  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
}

function ensureIncludes(source, needles, label) {
  for (const needle of needles) {
    if (!source.includes(needle)) throw new Error(`${label}: missing expected contract: ${needle}`);
  }
}

function ensureExcludes(source, needles, label) {
  for (const needle of needles) {
    if (source.includes(needle)) throw new Error(`${label}: obsolete contract remains: ${needle}`);
  }
}

function run(command, args, cwd, label) {
  console.log(`\n> ${[command, ...args].join(' ')}`);
  let executable = command;
  let executableArgs = args;
  if (process.platform === 'win32' && (command === 'dart' || command === 'flutter' || command === 'npm')) {
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

function makeBackup(root, originals) {
  const backupRoot = path.join(
    root,
    '.smart-pdm-patch-backup',
    `mobile-endorsement-timeline-polish-v2-${Date.now()}`
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
    const steps = <({String label, String semanticLabel})>[
      (label: 'Submitted', semanticLabel: 'Application submitted'),
      (label: 'SDO', semanticLabel: 'SDO review'),
      (label: 'Guidance', semanticLabel: 'Guidance review'),
      (label: 'Program Director', semanticLabel: 'Program Director review'),
      (label: 'Done', semanticLabel: 'Endorsement completed'),
    ];

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final mutedSurface = isDark
        ? AppColors.applicantDarkSurfaceMuted
        : AppColors.applicantLightSurfaceMuted;
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
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
      decoration: BoxDecoration(
        color: mutedSurface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          const nodeSize = 32.0;
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
                      top: (nodeSize / 2) - 1.5,
                      child: Container(
                        height: 3,
                        decoration: BoxDecoration(
                          color: outline.withValues(alpha: 0.65),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    Positioned(
                      left: nodeSize / 2,
                      top: (nodeSize / 2) - 1.5,
                      child: Container(
                        width: safeTrackWidth * progressFraction,
                        height: 3,
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
                                  ? activeColor
                                  : mutedSurface,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: nodeColor,
                                width: 2,
                              ),
                            ),
                            child: isDone
                                ? Icon(
                                    Icons.check_rounded,
                                    size: 18,
                                    color: isDark
                                        ? AppColors.darkBrown
                                        : Colors.white,
                                  )
                                : isActive
                                ? const Icon(
                                    Icons.circle,
                                    size: 8,
                                    color: AppColors.darkBrown,
                                  )
                                : null,
                          ),
                        );
                      }),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: List.generate(steps.length, (index) {
                  final isDone = allDone || index < activeIndex;
                  final isActive = !allDone && index == activeIndex;

                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: index == 0 || index == steps.length - 1
                            ? 0
                            : 3,
                      ),
                      child: Text(
                        steps[index].label,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: isDone || isActive
                              ? primaryText
                              : secondaryText,
                          fontWeight: isDone || isActive
                              ? FontWeight.w800
                              : FontWeight.w600,
                          fontSize: 10.5,
                          height: 1.15,
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

function patchContract(source) {
  const start = source.indexOf("test('Renders a clean five-node connected Endorsement timeline'");
  if (start < 0) throw new Error('Timeline regression test was not found.');
  const end = source.indexOf("test('Keeps Office Results'", start);
  if (end < 0) throw new Error('Next regression test was not found.');

  const replacement = `test('Renders a market-style five-node Endorsement timeline', () => {
  assert.match(screen, /${TIMELINE_MARKER}/);
  assert.match(screen, /label: 'Submitted'/);
  assert.match(screen, /label: 'SDO'/);
  assert.match(screen, /label: 'Guidance'/);
  assert.match(screen, /label: 'Program Director'/);
  assert.match(screen, /label: 'Done'/);
  assert.match(screen, /height: 3/);
  assert.match(screen, /nodeSize = 32\\.0/);
  assert.match(screen, /maxLines: 2/);
  assert.match(screen, /color: mutedSurface/);
  assert.doesNotMatch(screen, /shortLabel: 'PD'/);
});`;

  return source.slice(0, start) + replacement + '\n\n' + source.slice(end);
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

  console.log('[1/4] Verifying current polished timeline...');
  ensureIncludes(
    originalScreen,
    [
      'SMART_PDM_ENDORSEMENT_TIMELINE_POLISH_V1',
      'class _EndorsementRoadmap extends StatelessWidget',
      "shortLabel: 'PD'",
    ],
    'Current timeline'
  );
  console.log('      PASS');

  console.log('[2/4] Rebuilding timeline with larger nodes, cleaner track, and full labels...');
  const stagedScreen = replaceRange(
    originalScreen,
    'class _EndorsementRoadmap extends StatelessWidget {',
    'class _ReviewTile extends StatelessWidget {',
    buildRoadmap(),
    'Endorsement roadmap'
  );
  console.log('      PASS');

  console.log('[3/4] Updating Endorsement timeline regression tests...');
  const stagedContract = patchContract(originalContract);
  console.log('      PASS');

  console.log('[4/4] Validating mobile-theme and responsive timeline contracts...');
  ensureIncludes(
    stagedScreen,
    [
      TIMELINE_MARKER,
      "label: 'Program Director'",
      'nodeSize = 32.0',
      'height: 3',
      'maxLines: 2',
      'color: mutedSurface',
      'AppColors.applicantDarkSurfaceMuted',
      'AppColors.applicantLightSurfaceMuted',
    ],
    'New timeline'
  );

  ensureExcludes(
    stagedScreen,
    [
      "shortLabel: 'PD'",
      'boxShadow: isActive',
      'border: Border.all(color: outline)',
    ],
    'Old timeline styling'
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

    console.log('\nPASS: Endorsement timeline polish v2 completed.');
    console.log('\nVerified behavior:');
    console.log('  [x] Larger 32px nodes');
    console.log('  [x] Cleaner 3px continuous track');
    console.log('  [x] Full Program Director label restored');
    console.log('  [x] Two-line labels supported cleanly');
    console.log('  [x] No heavy bordered timeline card');
    console.log('  [x] Uses muted mobile theme surface');
    console.log('  [x] Dark mode remains supported');
    console.log('  [x] Office Results and Official Slip sections remain untouched');
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
