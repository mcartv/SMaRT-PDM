const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function die(message) {
  console.error(`\n[PATCH FAILED] ${message}`);
  process.exit(1);
}

function updateFile(rel, transform) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) die(`Missing ${rel}`);
  const original = fs.readFileSync(file, 'utf8');
  const updated = transform(original);
  if (updated === original) {
    console.log(`[SKIP] ${rel} already patched or no change needed`);
    return;
  }
  const backup = `${file}.previous-period-fix.bak`;
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, 'utf8');
  fs.writeFileSync(file, updated, 'utf8');
  console.log(`[OK] ${rel}`);
}

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  const count = source.split(from).length - 1;
  if (count !== 1) die(`${label}: expected exactly one anchor, found ${count}`);
  return source.replace(from, to);
}

// 1) Admin registry: closed openings must not hide already-submitted applications.
// Historical rows remain in the general registry, but cannot enter current readiness.
updateFile('admin/backend/services/applicationRegistryService.js', (source) => {
  source = replaceOnce(
    source,
    `        semester: row.semester || null,\n        academic_year: row.academic_year || null,`,
    `        semester: row.semester || null,\n        academic_year: row.academic_year || null,\n        period_is_active: row.period_is_active === true,\n        is_historical: row.period_is_active !== true,`,
    'registry map period flags'
  );

  source = replaceOnce(
    source,
    `        ay.label AS academic_year,\n        ap.term AS semester,\n        sp.program_name,`,
    `        ay.label AS academic_year,\n        ap.term AS semester,\n        ap.is_active AS period_is_active,\n        sp.program_name,`,
    'registry select period flag'
  );

  const closedFilter =
    `        AND LOWER(COALESCE(po.posting_status, '')) <> 'closed'\n`;
  if (source.includes(closedFilter)) {
    source = source.replace(closedFilter, '');
  }

  source = replaceOnce(
    source,
    `const READINESS_PREDICATE = \`\n    LOWER(COALESCE(oa.verification_status, '')) = 'verified'`,
    `const READINESS_PREDICATE = \`\n    COALESCE(oa.period_is_active, false) = true\n    AND LOWER(COALESCE(oa.verification_status, '')) = 'verified'`,
    'readiness active-period guard'
  );

  source = replaceOnce(
    source,
    `    ${alias}.academic_year,\n    ${alias}.semester,\n    ${alias}.program_name,`,
    `    ${alias}.academic_year,\n    ${alias}.semester,\n    ${alias}.period_is_active,\n    ${alias}.program_name,`,
    'registry projected period flag'
  );

  return source;
});

// 2) Academic period activation: release stale incomplete applicant pointers and
// detach old scholarship context from drafts while preserving entered form data.
updateFile('admin/backend/services/academicYearService.js', (source) => {
  const marker = 'SMART_PDM_PREVIOUS_PERIOD_APPLICATION_RELEASE_V1';
  if (!source.includes(marker)) {
    const anchor = `async function getPeriodForUpdate(client, periodId) {`;
    if (!source.includes(anchor)) die('academicYearService helper insertion anchor missing');

    const helpers = `
// ${marker}
async function releasePreviousPeriodIncompleteApplications(client, activePeriodId) {
    const result = await client.query(
        \`
        UPDATE students AS student
        SET
            current_application_id = NULL,
            current_program_id = NULL,
            updated_at = NOW()
        FROM applications AS application
        LEFT JOIN program_openings AS opening
          ON opening.opening_id = application.opening_id
        WHERE student.current_application_id = application.application_id
          AND COALESCE(student.is_active_scholar, false) = false
          AND COALESCE(student.is_archived, false) = false
          AND COALESCE(application.is_archived, false) = false
          AND LOWER(COALESCE(application.application_status, ''))
              IN ('pending review', 'requires reupload')
          AND opening.period_id IS DISTINCT FROM $1
        RETURNING student.student_id
        \`,
        [activePeriodId]
    );

    return result.rowCount || 0;
}

async function detachPreviousPeriodApplicationDraftContext(client, activePeriodId) {
    const result = await client.query(
        \`
        UPDATE application_form_drafts AS draft
        SET
            opening_id = NULL,
            payload = (
                COALESCE(draft.payload, '{}'::jsonb)
                - 'opening'
                - 'certification'
            ),
            updated_at = NOW()
        FROM program_openings AS opening
        WHERE draft.opening_id = opening.opening_id
          AND opening.period_id IS DISTINCT FROM $1
        RETURNING draft.draft_id
        \`,
        [activePeriodId]
    );

    return result.rowCount || 0;
}

`;
    source = source.replace(anchor, helpers + anchor);
  }

  source = replaceOnce(
    source,
    `        const closedOpenings = await closeOpeningsOutsideActiveCycle(\n            client,\n            {\n                academicYearId: period.academic_year_id,\n                periodId: period.period_id,\n            }\n        );\n\n        const cycleSummary = await ensurePeriodCycles(`,
    `        const closedOpenings = await closeOpeningsOutsideActiveCycle(\n            client,\n            {\n                academicYearId: period.academic_year_id,\n                periodId: period.period_id,\n            }\n        );\n\n        const releasedHistoricalApplications =\n            await releasePreviousPeriodIncompleteApplications(\n                client,\n                period.period_id\n            );\n\n        const detachedHistoricalDrafts =\n            await detachPreviousPeriodApplicationDraftContext(\n                client,\n                period.period_id\n            );\n\n        const cycleSummary = await ensurePeriodCycles(`,
    'activate period cleanup calls'
  );

  source = replaceOnce(
    source,
    `            closed_openings: closedOpenings,\n        };`,
    `            closed_openings: closedOpenings,\n            released_historical_applications: releasedHistoricalApplications,\n            detached_historical_drafts: detachedHistoricalDrafts,\n        };`,
    'activation cleanup summary'
  );

  return source;
});

// 3) Mobile: non-scholar applicants should treat only the active-period application
// as current for status/documents. Scholar lifecycle continues to use historical
// approved scholarship application when appropriate.
updateFile('mobile/backend/src/services/applicationService.js', (source) => {
  const marker = 'SMART_PDM_CURRENT_PERIOD_APPLICATION_LOOKUP_V1';
  if (!source.includes(marker)) {
    const anchor = `async function fetchApplicationStatusRows(applicationId) {`;
    if (!source.includes(anchor)) die('mobile current-period helper insertion anchor missing');

    const helper = `
// ${marker}
async function fetchCurrentPeriodApplication(studentId) {
    if (!studentId) return null;

    const { data: activePeriod, error: periodError } = await supabase
        .from('academic_period')
        .select('period_id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

    if (periodError) throw periodError;
    if (!activePeriod?.period_id) return null;

    const { data: openings, error: openingsError } = await supabase
        .from('program_openings')
        .select('opening_id')
        .eq('period_id', activePeriod.period_id);

    if (openingsError) throw openingsError;

    const openingIds = (openings || [])
        .map((row) => row.opening_id)
        .filter(Boolean);

    if (!openingIds.length) return null;

    const { data, error } = await supabase
        .from('applications')
        .select(\`
            application_id,
            student_id,
            opening_id,
            program_id,
            application_status,
            document_status,
            verification_status,
            requirements_completed_at,
            requirements_verified_at,
            selection_status,
            queue_position,
            waitlist_position,
            selection_batch_id,
            selected_at,
            waitlisted_at,
            finalized_at,
            activation_status,
            activated_at,
            can_reapply,
            reapplication_reason,
            rejection_reason,
            remarks,
            is_disqualified,
            submission_date,
            created_at,
            updated_at,
            is_archived
        \`)
        .eq('student_id', studentId)
        .eq('is_archived', false)
        .in('opening_id', openingIds)
        .order('submission_date', {
            ascending: false,
            nullsFirst: false,
        })
        .order('created_at', {
            ascending: false,
            nullsFirst: false,
        })
        .limit(1);

    if (error) throw error;

    return Array.isArray(data) && data.length > 0
        ? data[0]
        : null;
}

function shouldUseHistoricalScholarApplication(student = {}) {
    return (
        student?.is_active_scholar === true ||
        normalizeWorkflowKey(student?.scholarship_status) === 'active' ||
        student?.scholar_is_archived === true
    );
}

`;
    source = source.replace(anchor, helper + anchor);
  }

  source = replaceOnce(
    source,
    `    const application = await fetchLatestApplication(student.student_id);\n\n    if (!application) {`,
    `    const application = shouldUseHistoricalScholarApplication(student)\n        ? await fetchLatestApplication(student.student_id)\n        : await fetchCurrentPeriodApplication(student.student_id);\n\n    if (!application) {`,
    'status summary current-period lookup'
  );

  const oldDocs = `    const { data: applications, error: appError } = await supabase
        .from('applications')
        .select(\`
            application_id,
            student_id,
            opening_id,
            program_id,
            application_status,
            document_status,
            verification_status,
            requirements_verified_at,
            rejection_reason,
            is_disqualified,
            selection_status,
            activation_status,
            activated_at,
            is_archived,
            submission_date,
            created_at
        \`)
        .eq('student_id', student.student_id)
        .eq('is_archived', false)
        .order('submission_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(1);

    if (appError) throw appError;

    const application = Array.isArray(applications) && applications.length > 0
        ? applications[0]
        : null;`;

  const newDocs = `    const application = shouldUseHistoricalScholarApplication(student)
        ? await fetchLatestApplication(student.student_id)
        : await fetchCurrentPeriodApplication(student.student_id);`;

  if (!source.includes(newDocs)) {
    const count = source.split(oldDocs).length - 1;
    if (count !== 1) die(`documents current-period lookup: expected one block, found ${count}`);
    source = source.replace(oldDocs, newDocs);
  }

  return source;
});

// 4) Regression tests.
const testPath = path.join(
  ROOT,
  'admin/backend/test/previous-period-incomplete-application-regression.test.js'
);
const testSource = `const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', '..', '..', rel), 'utf8');
}

test('closed openings do not hide submitted applications from Admin registry', () => {
  const source = read('admin/backend/services/applicationRegistryService.js');
  assert.doesNotMatch(
    source,
    /LOWER\\(COALESCE\\(po\\.posting_status, ''\\)\\) <> 'closed'/
  );
  assert.match(source, /ap\\.is_active AS period_is_active/);
});

test('historical applications cannot enter current readiness queue', () => {
  const source = read('admin/backend/services/applicationRegistryService.js');
  assert.match(
    source,
    /READINESS_PREDICATE[\\s\\S]*COALESCE\\(oa\\.period_is_active, false\\) = true/
  );
});

test('period activation releases stale incomplete applicant pointers', () => {
  const source = read('admin/backend/services/academicYearService.js');
  assert.match(source, /SMART_PDM_PREVIOUS_PERIOD_APPLICATION_RELEASE_V1/);
  assert.match(source, /current_application_id = NULL/);
  assert.match(source, /opening\\.period_id IS DISTINCT FROM \\$1/);
  assert.match(source, /detachPreviousPeriodApplicationDraftContext/);
});

test('mobile applicant current status is scoped to the active period', () => {
  const source = read('mobile/backend/src/services/applicationService.js');
  assert.match(source, /SMART_PDM_CURRENT_PERIOD_APPLICATION_LOOKUP_V1/);
  assert.match(source, /fetchCurrentPeriodApplication/);
  assert.match(source, /shouldUseHistoricalScholarApplication/);
});
`;
fs.mkdirSync(path.dirname(testPath), { recursive: true });
fs.writeFileSync(testPath, testSource, 'utf8');
console.log('[OK] admin/backend/test/previous-period-incomplete-application-regression.test.js');

// 5) One-time data repair migration for stale rows already present before this code fix.
const migrationPath = path.join(
  ROOT,
  'supabase/migrations/20260927075500_release_previous_period_incomplete_applications.sql'
);
if (!fs.existsSync(migrationPath)) {
  const sql = `-- Repair stale applicant lifecycle pointers left by earlier academic-period rollovers.
-- Application rows are intentionally preserved for history.

WITH active_period AS (
  SELECT period_id
  FROM public.academic_period
  WHERE is_active = true
  ORDER BY activated_at DESC NULLS LAST, updated_at DESC
  LIMIT 1
)
UPDATE public.students AS student
SET
  current_application_id = NULL,
  current_program_id = NULL,
  updated_at = NOW()
FROM public.applications AS application
LEFT JOIN public.program_openings AS opening
  ON opening.opening_id = application.opening_id
CROSS JOIN active_period
WHERE student.current_application_id = application.application_id
  AND COALESCE(student.is_active_scholar, false) = false
  AND COALESCE(student.is_archived, false) = false
  AND COALESCE(application.is_archived, false) = false
  AND LOWER(COALESCE(application.application_status, ''))
      IN ('pending review', 'requires reupload')
  AND opening.period_id IS DISTINCT FROM active_period.period_id;

WITH active_period AS (
  SELECT period_id
  FROM public.academic_period
  WHERE is_active = true
  ORDER BY activated_at DESC NULLS LAST, updated_at DESC
  LIMIT 1
)
UPDATE public.application_form_drafts AS draft
SET
  opening_id = NULL,
  payload = (
    COALESCE(draft.payload, '{}'::jsonb)
    - 'opening'
    - 'certification'
  ),
  updated_at = NOW()
FROM public.program_openings AS opening
CROSS JOIN active_period
WHERE draft.opening_id = opening.opening_id
  AND opening.period_id IS DISTINCT FROM active_period.period_id;
`;
  fs.mkdirSync(path.dirname(migrationPath), { recursive: true });
  fs.writeFileSync(migrationPath, sql, 'utf8');
  console.log('[OK] supabase/migrations/20260927075500_release_previous_period_incomplete_applications.sql');
}

console.log('\nPrevious-period incomplete application fix applied.');
console.log('\nValidate with:');
console.log('  node --check admin/backend/services/applicationRegistryService.js');
console.log('  node --check admin/backend/services/academicYearService.js');
console.log('  node --check mobile/backend/src/services/applicationService.js');
console.log('  node --test admin/backend/test/previous-period-incomplete-application-regression.test.js');
console.log('  git diff --check');
