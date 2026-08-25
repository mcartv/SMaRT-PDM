const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((arg) => arg !== '--dry-run');
const repoRoot = path.resolve(positional[0] || '.');

const targetRel = path.join('admin', 'frontend', 'src', 'pages', 'ScholarMonitoring.jsx');
const targetPath = path.join(repoRoot, targetRel);
const frontendDir = path.join(repoRoot, 'admin', 'frontend');

function fail(message) {
  throw new Error(message);
}

function ensureFile(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`${label} not found: ${filePath}`);
}

function countOccurrences(text, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function runNpmBuild() {
  const isWin = process.platform === 'win32';
  const command = isWin ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const commandArgs = isWin
    ? ['/d', '/s', '/c', 'npm run build']
    : ['run', 'build'];

  console.log('\n> npm run build\n');
  const result = spawnSync(command, commandArgs, {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(`Admin frontend build failed with exit code ${result.status}.`);
  }
}

const responsiveTables = String.raw`function ScholarRegistryTable({ rows, onView, onRemove }) {
  const [photoPreview, setPhotoPreview] = useState(null);

  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="hidden grid-cols-12 gap-2 border-b border-stone-200 bg-stone-50 px-3 py-3 xl:grid">
        <div className="col-span-3 text-xs font-semibold uppercase tracking-wide text-stone-700">Scholar</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Program</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Current Semester</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Scholarship Status</div>
        <div className="col-span-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-700">Action</div>
      </div>

      <div className="divide-y divide-stone-100">
        {rows.map((scholar) => {
          const scholarshipMeta = getScholarshipStatusMeta(scholar.status);
          const cycle = [
            scholar.semester,
            scholar.academic_year ? §BT§AY \${scholar.academic_year}§BT§ : '',
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div
              key={scholar.scholar_id}
              className="grid min-w-0 grid-cols-1 gap-3 px-3 py-3 transition hover:bg-stone-50/70 sm:grid-cols-2 xl:grid-cols-12 xl:items-center xl:gap-2"
            >
              <div className="min-w-0 sm:col-span-2 xl:col-span-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (scholar.avatar_url) {
                        setPhotoPreview({
                          src: scholar.avatar_url,
                          name: scholar.student_name || 'Scholar',
                        });
                      }
                    }}
                    disabled={!scholar.avatar_url}
                    className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--portal-base)] focus:ring-offset-2 disabled:cursor-default"
                    aria-label={scholar.avatar_url ? §BT§Enlarge \${scholar.student_name || 'scholar'} profile photo§BT§ : 'No profile photo available'}
                  >
                    <Avatar className={§BT§h-10 w-10 rounded-full border border-stone-200 \${scholar.avatar_url ? 'cursor-zoom-in' : ''}§BT§}>
                      <AvatarImage
                        src={scholar.avatar_url || undefined}
                        alt={scholar.student_name}
                        className="rounded-full"
                      />
                      <AvatarFallback className="rounded-full text-xs font-bold">
                        {getInitials(scholar.student_name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold leading-5 text-stone-900">
                      {scholar.student_name}
                    </p>
                    <p className="mt-0.5 break-all font-mono text-xs text-stone-400">
                      {scholar.student_number}
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Program</p>
                <p className="break-words text-sm leading-5 text-stone-700">
                  {scholar.program_name || 'N/A'}
                </p>
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Current Semester</p>
                <p className="break-words text-sm font-semibold leading-5 text-stone-700">
                  {scholar.semester || 'Not set'}
                </p>
                <p className="mt-0.5 break-words text-[10px] leading-4 text-stone-400">
                  {scholar.academic_year
                    ? §BT§AY \${scholar.academic_year}§BT§
                    : cycle || 'No active period'}
                </p>
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Scholarship Status</p>
                <StatusPill meta={scholarshipMeta} compact />
              </div>

              <div className="min-w-0 sm:col-span-2 xl:col-span-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Action</p>
                <div className="flex min-w-0 flex-wrap gap-2 xl:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onView(scholar.scholar_id)}
                    className="min-w-0 flex-1 rounded-lg border-stone-200 px-3 text-xs sm:flex-none"
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    View Profile
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRemove(scholar)}
                    className="min-w-0 flex-1 rounded-lg border-red-200 px-3 text-xs text-red-700 hover:bg-red-50 sm:flex-none"
                  >
                    <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                    Remove Privilege
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ProfilePhotoPreviewDialog
        open={Boolean(photoPreview?.src)}
        onOpenChange={(open) => {
          if (!open) setPhotoPreview(null);
        }}
        src={photoPreview?.src || ''}
        name={photoPreview?.name || 'Scholar'}
      />
    </div>
  );
}

function RenewalTable({ rows, navigate }) {
  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="hidden grid-cols-12 gap-2 border-b border-stone-200 bg-stone-50 px-3 py-3 xl:grid">
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Scholar</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Program</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Cycle</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Document Status</div>
        <div className="col-span-1 text-xs font-semibold uppercase tracking-wide text-stone-700">Renewal Status</div>
        <div className="col-span-1 text-xs font-semibold uppercase tracking-wide text-stone-700">Submitted</div>
        <div className="col-span-2 text-right text-xs font-semibold uppercase tracking-wide text-stone-700">Action</div>
      </div>

      <div className="divide-y divide-stone-100">
        {rows.map((renewal) => {
          const renewalMeta = getRenewalStatusMeta(renewal.renewal_status);
          const documentMeta = getRenewalDocumentStatusMeta(renewal.document_status);
          const cycle = [
            renewal.semester_label,
            renewal.school_year_label ? §BT§AY \${renewal.school_year_label}§BT§ : '',
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div
              key={§BT§renewal-\${renewal.renewal_id || renewal.id}§BT§}
              className="grid min-w-0 grid-cols-1 gap-3 px-3 py-3 transition hover:bg-stone-50/70 sm:grid-cols-2 xl:grid-cols-12 xl:items-center xl:gap-2"
            >
              <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                <p className="break-words text-sm font-medium leading-5 text-stone-800">
                  {renewal.student_name}
                </p>
                <p className="mt-0.5 break-all text-xs text-stone-400">
                  {renewal.student_number}
                </p>
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Program</p>
                <p className="break-words text-sm leading-5 text-stone-700">
                  {renewal.program_name || 'N/A'}
                </p>
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Cycle</p>
                <p className="break-words text-xs leading-5 text-stone-600">
                  {cycle || 'Current Period'}
                </p>
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Document Status</p>
                <span
                  className="inline-flex max-w-full whitespace-normal break-words rounded-full px-2.5 py-1 text-xs font-medium leading-4"
                  style={{ background: documentMeta.bg, color: documentMeta.color }}
                >
                  {renewal.document_status || 'Missing Docs'}
                </span>
              </div>

              <div className="min-w-0 xl:col-span-1">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Renewal Status</p>
                <span
                  className="inline-flex max-w-full whitespace-normal break-words rounded-full px-2.5 py-1 text-xs font-medium leading-4"
                  style={{ background: renewalMeta.bg, color: renewalMeta.color }}
                >
                  {renewalMeta.label}
                </span>
              </div>

              <div className="min-w-0 xl:col-span-1">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Submitted</p>
                <p className="break-words text-xs leading-5 text-stone-500">
                  {formatDate(renewal.submitted_at, 'Not yet submitted')}
                </p>
              </div>

              <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Action</p>
                <div className="flex min-w-0 flex-wrap xl:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-w-0 max-w-full rounded-lg border-stone-200 px-3 text-xs"
                    onClick={() =>
                      navigate(
                        §BT§/admin/scholars/renewals/\${renewal.renewal_id || renewal.id}§BT§
                      )
                    }
                  >
                    <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
                    Review Renewal
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

`;

function normalizedResponsiveTables() {
  return responsiveTables.split('§BT§').join('`').replace(/\\\$\{/g, '${');
}

function buildPatchedSource(source) {
  const scholarMarker = 'function ScholarRegistryTable({ rows, onView, onRemove }) {';
  const itemYearMarker = 'function itemYear(item) {';

  const scholarCount = countOccurrences(source, scholarMarker);
  const itemYearCount = countOccurrences(source, itemYearMarker);
  if (scholarCount !== 1) fail(`Expected exactly one ScholarRegistryTable function, found ${scholarCount}.`);
  if (itemYearCount !== 1) fail(`Expected exactly one itemYear function, found ${itemYearCount}.`);

  const start = source.indexOf(scholarMarker);
  const end = source.indexOf(itemYearMarker, start);
  if (start < 0 || end <= start) fail('Could not isolate Scholar/Renewal table functions.');

  return source.slice(0, start) + normalizedResponsiveTables() + source.slice(end);
}

function validatePatchedSource(source) {
  const required = [
    'hidden grid-cols-12 gap-2 border-b border-stone-200 bg-stone-50 px-3 py-3 xl:grid',
    'sm:grid-cols-2 xl:grid-cols-12',
    'flex min-w-0 flex-wrap gap-2 xl:justify-end',
    '/admin/scholars/renewals/${renewal.renewal_id || renewal.id}',
  ];

  for (const needle of required) {
    if (!source.includes(needle)) fail(`Responsive validation missing: ${needle}`);
  }

  if (source.includes('min-w-[980px]')) fail('Old 980px Scholar minimum width is still present.');
  if (source.includes('min-w-[1120px]')) fail('Old 1120px Renewal minimum width is still present.');

  const blockStart = source.indexOf('function ScholarRegistryTable');
  const blockEnd = source.indexOf('function itemYear', blockStart);
  const block = source.slice(blockStart, blockEnd);
  if (block.includes('overflow-x-auto')) fail('Responsive Scholar/Renewal block still contains horizontal scrolling.');
  if (block.includes('<Table')) fail('Responsive Scholar/Renewal block still depends on the table layout.');
}

console.log('SMaRT-PDM Scholar + Renewals Responsive v2');
console.log(`Repository: ${repoRoot}`);
console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}`);

try {
  ensureFile(targetPath, 'ScholarMonitoring.jsx');
  ensureFile(path.join(frontendDir, 'package.json'), 'Admin frontend package.json');

  const original = fs.readFileSync(targetPath, 'utf8');

  console.log('\n[1/4] Replacing horizontally scrollable Scholar table with responsive grid/list...');
  const patched = buildPatchedSource(original);
  console.log('      PASS');

  console.log('[2/4] Replacing Renewal table with responsive grid/list...');
  if (!patched.includes('function RenewalTable({ rows, navigate })')) fail('RenewalTable replacement is missing.');
  console.log('      PASS');

  console.log('[3/4] Making actions/statuses wrap without forcing page width...');
  if (!patched.includes('whitespace-normal break-words rounded-full')) fail('Status wrapping contract is missing.');
  console.log('      PASS');

  console.log('[4/4] Validating no horizontal table contract remains...');
  validatePatchedSource(patched);
  console.log('      PASS');

  if (dryRun) {
    console.log('\nPASS: dry-run completed. No files were changed.');
    process.exit(0);
  }

  const backupDir = path.join(repoRoot, '.smart-pdm-patch-backup', `scholar-renewals-responsive-v2-${Date.now()}`);
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, 'ScholarMonitoring.jsx');
  fs.copyFileSync(targetPath, backupPath);

  try {
    fs.writeFileSync(targetPath, patched, 'utf8');
    runNpmBuild();
  } catch (error) {
    console.error('\nPatch verification failed. Restoring previous file...');
    fs.copyFileSync(backupPath, targetPath);
    console.error(`Rollback completed. Backup: ${backupDir}`);
    throw error;
  }

  console.log('\nPASS: Scholar Registry + Renewal Queue no longer use horizontal table overflow.');
  console.log('      Desktop uses a width-constrained 12-column grid; smaller/zoomed views switch to stacked responsive rows.');
  console.log('      Actions, statuses, names, programs, and cycle text wrap inside the available Admin content width.');
} catch (error) {
  console.error(`\nFAIL: ${error.message}`);
  process.exit(1);
}
