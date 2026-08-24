#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);

  while (true) {
    const target = path.join(
      dir,
      'mobile',
      'frontend',
      'lib',
      'features',
      'applicant',
      'presentation',
      'screens',
      'applicant_documents_screen.dart'
    );

    if (fs.existsSync(target)) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new Error(
    'Could not find the SMaRT-PDM repository root. Run this script from inside D:\\projects\\SMaRT-PDM.'
  );
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

const repo = findRepoRoot(process.cwd());
const mobile = path.join(repo, 'mobile', 'frontend');

const file = path.join(
  mobile,
  'lib',
  'features',
  'applicant',
  'presentation',
  'screens',
  'applicant_documents_screen.dart'
);

const original = fs.readFileSync(file, 'utf8');
const usesCrlf = original.includes('\r\n');
let source = original.replace(/\r\n/g, '\n');

const startMarker = `            if (package != null) ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(`;

const endMarker = `            const SizedBox(height: 18),
            if (_isLoading && package == null)`;

const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error(
    'Could not locate the current View Application Form / Back to Dashboard action block. Apply the preview/edit feature first.'
  );
}

const replacement = `            const SizedBox(height: 12),
            if (package != null)
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => Navigator.pushNamed(
                        context,
                        AppRoutes.applicationFormPreview,
                      ),
                      icon: const Icon(
                        Icons.description_outlined,
                        size: 20,
                      ),
                      label: const Text(
                        'View Application Form',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size(0, 54),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 14,
                        ),
                        backgroundColor: accentColor,
                        foregroundColor: isDark
                            ? AppColors.darkBrown
                            : Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => AppNavigator.goToTopLevel(
                        context,
                        AppRoutes.home,
                      ),
                      icon: const Icon(
                        Icons.dashboard_outlined,
                        size: 20,
                      ),
                      label: const Text(
                        'Back to Dashboard',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 54),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 14,
                        ),
                        foregroundColor: accentColor,
                        side: BorderSide(
                          color: accentColor.withValues(alpha: 0.72),
                          width: 1.2,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ],
              )
            else
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () => AppNavigator.goToTopLevel(
                    context,
                    AppRoutes.home,
                  ),
                  icon: const Icon(
                    Icons.dashboard_outlined,
                    size: 20,
                  ),
                  label: const Text('Back to Dashboard'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 54),
                    foregroundColor: accentColor,
                    side: BorderSide(
                      color: accentColor.withValues(alpha: 0.72),
                      width: 1.2,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 18),
            if (_isLoading && package == null)`;

source =
  source.slice(0, start) +
  replacement +
  source.slice(end + endMarker.length);

const validations = [
  [
    'side-by-side Row',
    source.includes('if (package != null)\n              Row('),
  ],
  [
    'larger 54px buttons',
    source.includes('minimumSize: const Size(0, 54)'),
  ],
  [
    'squoval radius 14',
    source.includes('borderRadius: BorderRadius.circular(14)'),
  ],
  [
    'View Application Form retained',
    source.includes("'View Application Form'"),
  ],
  [
    'Back to Dashboard retained',
    source.includes("'Back to Dashboard'"),
  ],
  [
    'preview route retained',
    source.includes('AppRoutes.applicationFormPreview'),
  ],
];

const failed = validations.filter(([, ok]) => !ok);

if (failed.length) {
  throw new Error(
    `Validation failed before writing: ${failed
      .map(([name]) => name)
      .join(', ')}`
  );
}

const backup = `${file}.bak-action-buttons-${new Date()
  .toISOString()
  .replace(/[:.]/g, '-')}`;

fs.copyFileSync(file, backup);

fs.writeFileSync(
  file,
  usesCrlf ? source.replace(/\n/g, '\r\n') : source,
  'utf8'
);

console.log('\nRequired Documents action buttons cleaned up.\n');
console.log('Changed:');
console.log(
  '  mobile/frontend/lib/features/applicant/presentation/screens/applicant_documents_screen.dart'
);
console.log('\nNew layout:');
console.log('  [ View Application Form ] [ Back to Dashboard ]');
console.log('  - equal width');
console.log('  - 54px tall');
console.log('  - 14px squoval corners');
console.log('  - larger icons/text');
console.log('  - primary filled application button');
console.log('  - secondary outlined dashboard button');
console.log('\nBackup:');
console.log(`  ${backup}`);

run('dart', ['format', file], mobile);

run(
  'flutter',
  [
    'test',
    'test/application_form_preview_compile_test.dart',
  ],
  mobile
);

console.log('\nPASS: Required Documents button cleanup compiled successfully.');
