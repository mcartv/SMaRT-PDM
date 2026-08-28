#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipFlutter = args.includes('--skip-flutter');
const rootArg = args.find((arg) => !arg.startsWith('--')) || '.';
const root = path.resolve(process.cwd(), rootArg);

const REL = {
  adminService: 'admin/backend/services/renewalService.js',
  adminController: 'admin/backend/controllers/renewalController.js',
  test: 'admin/backend/test/renewal-availability-semester-contract.test.js',
  migration:
    'supabase/migrations/20260828_enforce_renewal_student_period_uniqueness.sql',
  mobileService: 'mobile/backend/src/services/renewalService.js',
  mobileModel: 'mobile/frontend/lib/shared/models/scholar_renewal.dart',
  mobileScreen:
    'mobile/frontend/lib/features/applicant/presentation/screens/scholar_renewal_requirements_screen.dart',
  notificationProvider:
    'mobile/frontend/lib/features/notifications/presentation/providers/notification_provider.dart',
  academicService: 'admin/backend/services/academicYearService.js',
  academicController: 'admin/backend/controllers/academicYearController.js',
};

function abs(rel) {
  return path.join(root, rel);
}

function fail(message) {
  console.error('\n[RENEWAL SEMESTER V3] ERROR: ' + message);
  process.exit(1);
}

function read(rel) {
  const file = abs(rel);
  if (!fs.existsSync(file)) {
    fail('Required file not found: ' + rel);
  }
  return fs.readFileSync(file, 'utf8');
}

function adaptEol(value, source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';

  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, eol);
}

function replaceOne(source, oldValue, newValue, label) {
  const oldNative = adaptEol(oldValue, source);
  const newNative = adaptEol(newValue, source);

  if (source.includes(newNative)) {
    console.log('[already] ' + label);
    return source;
  }

  const count = source.split(oldNative).length - 1;

  if (count !== 1) {
    throw new Error(
      `${label}: expected exactly 1 source match, found ${count}.`
    );
  }

  console.log('[patch] ' + label);
  return source.replace(oldNative, newNative);
}

function ensureCurrentImplementation() {
  const checks = [
    [REL.mobileService, 'async function getRenewalAvailability(student)', 'authoritative renewal availability service'],
    [REL.mobileService, 'CURRENT_SCHOLARSHIP_SEMESTER_STILL_ACTIVE', 'same-semester availability guard'],
    [REL.mobileService, 'await assertRenewalAvailable(student);', 'backend availability validation'],
    [REL.mobileService, 'This renewal package is already submitted or locked.', 'already-submitted renewal lock'],
    [REL.mobileModel, 'final bool isRenewalAvailable;', 'Flutter availability model'],
    [REL.mobileModel, 'final String availabilityReason;', 'Flutter availability reason model'],
    [REL.mobileScreen, '_renewalPackage?.isRenewalAvailable == false', 'Flutter availability binding'],
    [REL.mobileScreen, 'Renewal Not Yet Available', 'Flutter unavailable label'],
    [REL.notificationProvider, 'case MobileRealtimeEvents.renewalUpdated:', 'mobile renewal realtime refresh'],
    [REL.academicService, 'SMART-PDM_RENEWAL_SAME_PERIOD_GUARD_V1', 'Admin same-semester generation guard'],
    [REL.academicController, 'relayRenewalEvent', 'Admin-to-mobile renewal realtime relay'],
  ];

  for (const [rel, needle, description] of checks) {
    const source = read(rel);

    if (!source.includes(needle)) {
      throw new Error(
        `${description} is missing from ${rel}. ` +
          'Your local checkout differs from the audited repository; refusing to stack another partial patch.'
      );
    }
  }

  const mobileService = read(REL.mobileService);
  const guardCount =
    mobileService.split('await assertRenewalAvailable(student);').length - 1;

  if (guardCount < 2) {
    throw new Error(
      'Expected backend renewal availability validation on both upload and submit paths.'
    );
  }
}

function scanConflicts() {
  const roots = [path.join(root, 'admin'), path.join(root, 'mobile')];
  const found = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (
        ['node_modules', 'build', 'dist', '.dart_tool', '.git'].includes(
          entry.name
        )
      ) {
        continue;
      }

      const file = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(file);
        continue;
      }

      if (!/\.(?:js|jsx|ts|tsx|dart|css|json)$/i.test(entry.name)) {
        continue;
      }

      const source = fs.readFileSync(file, 'utf8');

      if (/^<<<<<<<[^\r\n]*$/m.test(source)) {
        found.push(path.relative(root, file).replace(/\\/g, '/'));
      }
    }
  }

  roots.forEach(walk);

  if (found.length) {
    throw new Error(
      'Unresolved Git merge markers remain:\n' +
        found.map((file) => '  - ' + file).join('\n')
    );
  }
}

function patchAdminService(source) {
  let out = source;

  out = replaceOne(
    out,
    `function mapBy(rows = [], key) {
    return new Map(rows.map((row) => [row[key], row]));
}

async function loadRenewalDocuments`,
    `function mapBy(rows = [], key) {
    return new Map(rows.map((row) => [row[key], row]));
}

// SMART-PDM_RENEWAL_PERIOD_ELIGIBILITY_V2
// Renewal is operational only for a later academic period than the scholar's
// approved scholarship opening. Old same-semester rows stay in the database,
// but they cannot enter the current Renewal Queue or be reviewed directly.
async function getRenewalSourcePeriodMap(renewalRows = []) {
    const applicationIds = [
        ...new Set(
            (renewalRows || [])
                .map((row) => row?.application_id)
                .filter(Boolean)
        ),
    ];

    if (!applicationIds.length) {
        return new Map();
    }

    const applications = await getRowsByIds(
        'applications',
        'application_id',
        applicationIds,
        'application_id, opening_id'
    );

    const applicationMap = mapBy(
        applications,
        'application_id'
    );

    const openingIds = [
        ...new Set(
            applications
                .map((application) => application?.opening_id)
                .filter(Boolean)
        ),
    ];

    const openings = openingIds.length
        ? await getRowsByIds(
            'program_openings',
            'opening_id',
            openingIds,
            'opening_id, period_id'
        )
        : [];

    const openingMap = mapBy(openings, 'opening_id');
    const result = new Map();

    for (const renewal of renewalRows || []) {
        const application =
            applicationMap.get(renewal?.application_id) || null;
        const opening =
            application?.opening_id
                ? openingMap.get(application.opening_id) || null
                : null;

        result.set(
            renewal?.renewal_id,
            opening?.period_id || null
        );
    }

    return result;
}

function isRenewalPeriodEligible(
    renewal = {},
    sourceOpeningPeriodId = null
) {
    if (!renewal?.period_id || !sourceOpeningPeriodId) {
        return true;
    }

    return (
        String(renewal.period_id) !==
        String(sourceOpeningPeriodId)
    );
}

async function assertRenewalPeriodEligible(renewal = {}) {
    const sourcePeriodMap =
        await getRenewalSourcePeriodMap([renewal]);

    const sourceOpeningPeriodId =
        sourcePeriodMap.get(renewal?.renewal_id) || null;

    if (
        !isRenewalPeriodEligible(
            renewal,
            sourceOpeningPeriodId
        )
    ) {
        throw createHttpError(
            409,
            'Renewal is not available for the same academic semester as the scholar\\'s current scholarship opening. Activate the next semester in Maintenance > Academic Years before reviewing a renewal.'
        );
    }

    return sourceOpeningPeriodId;
}

async function loadRenewalDocuments`,
    'Admin backend: add renewal-period eligibility helper'
  );

  out = replaceOne(
    out,
    `    const benefactorMap = mapBy(benefactors, 'benefactor_id');

    return renewalRows.map((renewal) => {`,
    `    const benefactorMap = mapBy(benefactors, 'benefactor_id');
    const sourcePeriodMap =
        await getRenewalSourcePeriodMap(renewalRows);

    return renewalRows.map((renewal) => {`,
    'Admin backend: load approved-opening source periods'
  );

  out = replaceOne(
    out,
    `        const period = periodMap.get(renewal.period_id) || {};
        const documents = ensureDocumentCoverage(
            documentsMap.get(renewal.renewal_id) || []
        );`,
    `        const period = periodMap.get(renewal.period_id) || {};
        const sourceOpeningPeriodId =
            sourcePeriodMap.get(renewal.renewal_id) || null;
        const isRenewalPeriod =
            isRenewalPeriodEligible(
                renewal,
                sourceOpeningPeriodId
            );
        const documents = ensureDocumentCoverage(
            documentsMap.get(renewal.renewal_id) || []
        );`,
    'Admin backend: classify same-semester renewal rows'
  );

  out = replaceOne(
    out,
    `            is_current_period: period.is_active === true,
            period_status: period.is_active === true ? 'Current' : 'Historical',

            renewal_status: renewal.status,`,
    `            is_current_period: period.is_active === true,
            period_status: period.is_active === true ? 'Current' : 'Historical',
            source_opening_period_id:
                sourceOpeningPeriodId,
            is_renewal_period:
                isRenewalPeriod,

            renewal_status: renewal.status,`,
    'Admin backend: expose renewal-period validity'
  );

  out = replaceOne(
    out,
    `    if (!renewal) {
        throw createHttpError(404, 'Renewal record not found.');
    }

    const { data: renewalPeriod, error: renewalPeriodError } = await supabase`,
    `    if (!renewal) {
        throw createHttpError(404, 'Renewal record not found.');
    }

    await assertRenewalPeriodEligible(renewal);

    const { data: renewalPeriod, error: renewalPeriodError } = await supabase`,
    'Admin backend: block direct review of same-semester renewals'
  );

  return out;
}

function patchAdminController(source) {
  return replaceOne(
    source,
    `        const currentPeriodRenewals = (Array.isArray(payload) ? payload : [])
            .filter((renewal) => renewal?.is_current_period === true);`,
    `        const currentPeriodRenewals = (Array.isArray(payload) ? payload : [])
            .filter(
                (renewal) =>
                    renewal?.is_current_period === true &&
                    renewal?.is_renewal_period !== false
            );`,
    'Admin renewal queue: exclude same-semester invalid records'
  );
}

const MIGRATION = `-- SMaRT-PDM Renewal Availability by Semester
-- Enforce one renewal row per scholar per academic period.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.renewals
    WHERE period_id IS NOT NULL
    GROUP BY student_id, period_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create uq_renewals_student_period: duplicate student_id/period_id renewal rows exist. Resolve duplicates first.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_renewals_student_period
  ON public.renewals (student_id, period_id);

COMMENT ON INDEX public.uq_renewals_student_period IS
  'Prevents duplicate scholarship renewal records for the same scholar and academic period.';
`;

const CONTRACT_TEST = `'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');

function source(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('Renewal Availability by Semester checklist remains enforced across the stack', () => {
  const mobileService = source(
    'mobile/backend/src/services/renewalService.js'
  );
  const mobileModel = source(
    'mobile/frontend/lib/shared/models/scholar_renewal.dart'
  );
  const mobileScreen = source(
    'mobile/frontend/lib/features/applicant/presentation/screens/scholar_renewal_requirements_screen.dart'
  );
  const notifications = source(
    'mobile/frontend/lib/features/notifications/presentation/providers/notification_provider.dart'
  );
  const academicService = source(
    'admin/backend/services/academicYearService.js'
  );
  const academicController = source(
    'admin/backend/controllers/academicYearController.js'
  );
  const adminService = source(
    'admin/backend/services/renewalService.js'
  );
  const adminController = source(
    'admin/backend/controllers/renewalController.js'
  );
  const migration = source(
    'supabase/migrations/20260828_enforce_renewal_student_period_uniqueness.sql'
  );

  assert.ok(mobileService.includes(".from('academic_period')"));
  assert.ok(mobileService.includes(".eq('is_active', true)"));
  assert.ok(
    mobileService.includes(
      'CURRENT_SCHOLARSHIP_SEMESTER_STILL_ACTIVE'
    )
  );

  const backendGuardCount =
    mobileService.split('await assertRenewalAvailable(student);').length - 1;
  assert.ok(
    backendGuardCount >= 2,
    'upload and submit must both validate renewal availability'
  );

  assert.ok(
    mobileService.includes(
      'This renewal package is already submitted or locked.'
    )
  );

  assert.ok(mobileModel.includes('final bool isRenewalAvailable;'));
  assert.ok(mobileModel.includes('final String availabilityReason;'));
  assert.ok(mobileScreen.includes('Renewal Not Yet Available'));
  assert.ok(mobileScreen.includes('availabilityReason'));

  assert.ok(
    academicService.includes(
      'SMART-PDM_RENEWAL_SAME_PERIOD_GUARD_V1'
    )
  );
  assert.ok(
    academicController.includes('relayRenewalEvent')
  );
  assert.ok(
    notifications.includes(
      'case MobileRealtimeEvents.renewalUpdated:'
    )
  );

  assert.ok(
    adminService.includes(
      'SMART-PDM_RENEWAL_PERIOD_ELIGIBILITY_V2'
    )
  );
  assert.ok(
    adminService.includes(
      'await assertRenewalPeriodEligible(renewal);'
    )
  );
  assert.ok(
    adminController.includes(
      'renewal?.is_renewal_period !== false'
    )
  );

  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS uq_renewals_student_period/
  );
  assert.match(
    migration,
    /ON public\\.renewals \\(student_id, period_id\\)/
  );
});
`;

function prepareWrites() {
  ensureCurrentImplementation();
  scanConflicts();

  const originals = new Map();
  const writes = new Map();

  for (const rel of [REL.adminService, REL.adminController]) {
    originals.set(rel, read(rel));
  }

  writes.set(
    REL.adminService,
    patchAdminService(originals.get(REL.adminService))
  );
  writes.set(
    REL.adminController,
    patchAdminController(originals.get(REL.adminController))
  );

  for (const [rel, content] of [
    [REL.migration, MIGRATION],
    [REL.test, CONTRACT_TEST],
  ]) {
    if (fs.existsSync(abs(rel))) {
      const current = fs.readFileSync(abs(rel), 'utf8');
      originals.set(rel, current);

      if (current !== content) {
        throw new Error(
          `${rel} already exists with different content. Refusing to overwrite it.`
        );
      }

      writes.set(rel, current);
      console.log('[already] ' + rel);
    } else {
      originals.set(rel, null);
      writes.set(rel, content);
      console.log('[patch] Add ' + rel);
    }
  }

  return { originals, writes };
}

function restore(originals) {
  for (const [rel, original] of originals.entries()) {
    const file = abs(rel);

    try {
      if (original === null) {
        fs.rmSync(file, { force: true });
      } else {
        fs.mkdirSync(path.dirname(file), {
          recursive: true,
        });
        fs.writeFileSync(file, original, 'utf8');
      }
    } catch (_) {}
  }
}

function run(command, commandArgs, cwd, label) {
  console.log('\n[verify] ' + label);

  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(label + ' failed.');
  }
}

let prepared;

try {
  prepared = prepareWrites();
} catch (error) {
  fail(error.message || String(error));
}

if (dryRun) {
  console.log('\n[RENEWAL SEMESTER V3] Dry run passed.');
  console.log(
    'Current mobile availability/realtime guards are present, and the remaining hardening patch is compatible.'
  );
  console.log('No files were written.');
  process.exit(0);
}

try {
  for (const [rel, content] of prepared.writes.entries()) {
    const file = abs(rel);
    fs.mkdirSync(path.dirname(file), {
      recursive: true,
    });
    fs.writeFileSync(file, content, 'utf8');
  }

  run(
    process.execPath,
    ['--check', abs(REL.adminService)],
    root,
    'Node syntax: admin renewal service'
  );

  run(
    process.execPath,
    ['--check', abs(REL.adminController)],
    root,
    'Node syntax: admin renewal controller'
  );

  run(
    process.execPath,
    ['--test', abs(REL.test)],
    root,
    'Renewal semester cross-stack contract test'
  );

  if (!skipFlutter) {
    const flutter =
      process.platform === 'win32'
        ? 'flutter.bat'
        : 'flutter';

    run(
      flutter,
      [
        'analyze',
        '--no-fatal-warnings',
        '--no-fatal-infos',
        'lib/shared/models/scholar_renewal.dart',
        'lib/features/applicant/presentation/screens/scholar_renewal_requirements_screen.dart',
      ],
      path.join(root, 'mobile/frontend'),
      'Focused Flutter analyze'
    );
  } else {
    console.log(
      '\n[verify] Focused Flutter analyze skipped by --skip-flutter.'
    );
  }
} catch (error) {
  restore(prepared.originals);
  fail(
    (error.message || String(error)) +
      '\nAll files changed by this run were restored.'
  );
}

console.log('\n[RENEWAL SEMESTER V3] Installed successfully.');
console.log('Changed/added files:');
for (const rel of prepared.writes.keys()) {
  console.log('  - ' + rel);
}
console.log('');
console.log(
  'IMPORTANT: the SQL migration file was created but NOT applied to Supabase.'
);
console.log(
  'Apply supabase/migrations/20260828_enforce_renewal_student_period_uniqueness.sql before marking duplicate prevention complete.'
);
