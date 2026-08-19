'use strict';

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(process.argv[2] || process.cwd());

const payoutManagementPath = path.join(
  projectRoot,
  'admin',
  'frontend',
  'src',
  'pages',
  'PayoutManagement.jsx'
);

const payoutServicePath = path.join(
  projectRoot,
  'admin',
  'backend',
  'services',
  'payoutService.js'
);

const regressionTestPath = path.join(
  projectRoot,
  'admin',
  'backend',
  'test',
  'readiness-applications-payout-fix-regression.test.js'
);

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function backup(filePath) {
  const backupPath = `${filePath}.before-readiness-payout-fix-v3`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`Backup: ${backupPath}`);
  }
}

function replaceOnce(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(
      `Could not find expected block for: ${label}\n` +
      `The recovery script stopped before writing this step.`
    );
  }

  pattern.lastIndex = 0;
  const updated = source.replace(pattern, replacement);

  if (updated === source) {
    throw new Error(`Replacement made no change for: ${label}`);
  }

  console.log(`Updated: ${label}`);
  return updated;
}

function ensureIncludes(source, needle, insert, marker, label) {
  if (source.includes(needle)) {
    console.log(`Already present: ${label}`);
    return source;
  }

  const index = source.indexOf(marker);
  if (index < 0) {
    throw new Error(`Could not find insertion marker for: ${label}`);
  }

  console.log(`Added: ${label}`);
  return source.slice(0, index) + insert + source.slice(index);
}

backup(payoutManagementPath);
backup(payoutServicePath);

let payout = read(payoutManagementPath);

// The v2 script already added archiveCandidate state + ArchiveBatchModal before it failed.
// Keep them if present; add them only when absent.
if (!payout.includes('const [archiveCandidate, setArchiveCandidate] = useState(null);')) {
  payout = replaceOnce(
    payout,
    /(\s*const \[restoringBatchId,\s*setRestoringBatchId\] = useState\(null\);\s*)/,
    `$1  const [archiveCandidate, setArchiveCandidate] = useState(null);\n`,
    'Payout archive modal state'
  );
} else {
  console.log('Already present: Payout archive modal state');
}

if (!payout.includes('function ArchiveBatchModal(')) {
  const modal = `
function ArchiveBatchModal({
  batch,
  open,
  working,
  onCancel,
  onConfirm,
}) {
  if (!open || !batch) return null;

  const counts = getPayoutCounts(batch);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!working) onCancel();
      }}
    >
      <Card
        className="w-full max-w-md overflow-hidden rounded-2xl border-stone-200 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-100 px-5 py-4">
          <h3 className="text-base font-semibold text-stone-900">
            Archive payout batch?
          </h3>
          <p className="mt-1 text-sm leading-5 text-stone-500">
            {batch.payout_title || 'This payout batch'} will move to Archived.
            Payout records and scholar history are preserved.
          </p>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-2">
            <SmallMetric label="Released" value={counts.released} />
            <SmallMetric label="Absent" value={counts.absent} />
            <SmallMetric label="Cancelled" value={counts.cancelled} />
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-xs leading-5 text-stone-600">
            Archive is available only when every scholar has a final payout
            status: Released, Absent, or Cancelled.
          </div>
        </CardContent>

        <div className="flex justify-end gap-2 border-t border-stone-100 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={working}
            onClick={onCancel}
            className="h-9 rounded-lg border-stone-200 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={working}
            onClick={onConfirm}
            className="h-9 rounded-lg border-none text-xs text-white"
            style={{ background: C.brownMid }}
          >
            {working ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="mr-1.5 h-3.5 w-3.5" />
            )}
            Archive Batch
          </Button>
        </div>
      </Card>
    </div>
  );
}

`;
  payout = payout.replace(
    /export default function PayoutManagement\(\) \{/,
    modal + 'export default function PayoutManagement() {'
  );
  console.log('Added: Payout archive confirmation modal');
} else {
  console.log('Already present: Payout archive confirmation modal');
}

// Replace the whole handler up to the restore handler. This is deliberately
// structure-based so local formatting differences do not break recovery.
const archiveHandler = `  const handleArchiveBatch = async (batch) => {
    try {
      if (!batch?.payout_batch_id) return;

      if (!isBatchFinished(batch)) {
        alert(
          'This payout batch is not ready to archive. Resolve every Pending or On Hold scholar first. Final statuses are Released, Absent, or Cancelled.'
        );
        return;
      }

      setArchivingBatchId(batch.payout_batch_id);

      const res = await fetch(\`\${API_BASE}/payouts/\${batch.payout_batch_id}/archive\`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Failed to archive payout batch');
      }

      setBatches((previous) =>
        previous.map((item) =>
          String(item?.payout_batch_id) === String(batch.payout_batch_id)
            ? { ...item, is_archived: true, batch_status: 'Archived' }
            : item
        )
      );

      setArchiveCandidate(null);
      setSelectedBatch(null);
      setActiveSection('archived');
      setPage(1);

      await loadAll();
    } catch (err) {
      console.error('ARCHIVE PAYOUT BATCH ERROR:', err);
      alert(err.message || 'Failed to archive payout batch');
    } finally {
      setArchivingBatchId(null);
    }
  };

`;

if (!payout.includes("Resolve every Pending or On Hold scholar first")) {
  payout = replaceOnce(
    payout,
    /  const handleArchiveBatch = async \(batch\) => \{[\s\S]*?(?=  const handleRestoreBatch = async \(batch\) => \{)/,
    archiveHandler,
    'Payout archive handler'
  );
} else {
  console.log('Already present: Payout archive handler');
}

// Add modal render before payout proof panel if it is not already rendered.
if (!payout.includes('<ArchiveBatchModal')) {
  const modalRender = `      <ArchiveBatchModal
        batch={archiveCandidate}
        open={Boolean(archiveCandidate)}
        working={
          Boolean(archiveCandidate?.payout_batch_id) &&
          archivingBatchId === archiveCandidate?.payout_batch_id
        }
        onCancel={() => {
          if (!archivingBatchId) setArchiveCandidate(null);
        }}
        onConfirm={() => handleArchiveBatch(archiveCandidate)}
      />

`;
  payout = ensureIncludes(
    payout,
    '<ArchiveBatchModal',
    modalRender,
    '      <PayoutProofReviewPanel />',
    'Payout archive modal render'
  );
} else {
  console.log('Already present: Payout archive modal render');
}

// Replace only the Archive Batch button's old disabled/onClick behavior.
if (!payout.includes('setArchiveCandidate(selectedBatch)')) {
  payout = replaceOnce(
    payout,
    /disabled=\{\s*!isBatchFinished\(selectedBatch\)\s*\|\|\s*archivingBatchId === selectedBatch\.payout_batch_id\s*\}\s*onClick=\{\(\) => handleArchiveBatch\(selectedBatch\)\}/,
    `disabled={archivingBatchId === selectedBatch.payout_batch_id}
                    onClick={() => {
                      if (!isBatchFinished(selectedBatch)) {
                        handleArchiveBatch(selectedBatch);
                        return;
                      }
                      setArchiveCandidate(selectedBatch);
                    }}`,
    'Payout archive button behavior'
  );
} else {
  console.log('Already present: Payout archive button behavior');
}

write(payoutManagementPath, payout);

// ---------------- Backend service ----------------
let service = read(payoutServicePath);

if (!service.includes("const terminalStatuses = new Set(['released', 'absent', 'cancelled']);")) {
  service = replaceOnce(
    service,
    /  const hasPending = entries\.some\([\s\S]*?throw err;\s*\}\s*/,
    `  const terminalStatuses = new Set(['released', 'absent', 'cancelled']);
  const unfinishedEntries = entries.filter(
    (entry) =>
      !terminalStatuses.has(
        String(entry.release_status || '').trim().toLowerCase()
      )
  );

  if (unfinishedEntries.length > 0) {
    const err = new Error(
      \`Cannot archive payout batch. \${unfinishedEntries.length} scholar payout entr\${unfinishedEntries.length === 1 ? 'y is' : 'ies are'} still Pending or On Hold.\`
    );
    err.statusCode = 400;
    throw err;
  }

`,
    'Payout archive terminal-state validation'
  );
} else {
  console.log('Already present: Payout archive terminal-state validation');
}

if (!service.includes('async function restorePayoutBatch(')) {
  const restoreFunction = `async function restorePayoutBatch({
  payout_batch_id,
  restored_by = null,
}) {
  if (!payout_batch_id) {
    throw payoutError(400, 'payout_batch_id is required');
  }

  const result = await pool.query(
    \`
      UPDATE payout_batches
      SET
        is_archived = FALSE,
        batch_status = CASE
          WHEN LOWER(COALESCE(batch_status, '')) = 'archived' THEN 'Completed'
          ELSE batch_status
        END,
        updated_at = NOW()
      WHERE payout_batch_id = $1
        AND COALESCE(is_archived, FALSE) = TRUE
      RETURNING *;
    \`,
    [payout_batch_id]
  );

  if (!result.rows.length) {
    const existing = await pool.query(
      \`SELECT payout_batch_id, is_archived
       FROM payout_batches
       WHERE payout_batch_id = $1
       LIMIT 1\`,
      [payout_batch_id]
    );

    if (!existing.rows.length) {
      throw payoutError(404, 'Payout batch not found');
    }

    throw payoutError(400, 'Payout batch is not archived');
  }

  return {
    success: true,
    message: 'Payout batch restored successfully',
    batch: result.rows[0],
    restored_by,
  };
}

`;

  const marker = 'async function fetchAcademicYears() {';
  if (!service.includes(marker)) {
    throw new Error('Could not find fetchAcademicYears marker for restore service');
  }

  service = service.replace(marker, restoreFunction + marker);
  console.log('Added: Payout restore service implementation');
} else {
  console.log('Already present: Payout restore service implementation');
}

if (!/archivePayoutBatch,\s*\n\s*restorePayoutBatch,/.test(service)) {
  service = replaceOnce(
    service,
    /(\s+archivePayoutBatch,\s*\n)(\s+fetchAcademicYears,)/,
    `$1  restorePayoutBatch,\n$2`,
    'Payout restore service export'
  );
} else {
  console.log('Already present: Payout restore service export');
}

write(payoutServicePath, service);

// ---------------- Regression test ----------------
const regressionTest = `'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) =>
  fs.readFileSync(path.join(root, relative), 'utf8');

test('Applications opening cards wrap metrics instead of forcing seven cramped columns', () => {
  const source = read('frontend/src/pages/ApplicationReview.jsx');

  assert.match(source, /2xl:grid-cols-2/);
  assert.match(source, /grid grid-cols-2 gap-2 sm:grid-cols-4/);
  assert.doesNotMatch(source, /xl:grid-cols-7/);
});

test('Readiness cards and activation approval use responsive compact padding', () => {
  const source = read('frontend/src/pages/ApplicationReview.jsx');

  assert.match(source, /items-start gap-4 xl:grid-cols-2/);
  assert.match(source, /space-y-4 p-4 sm:p-5/);
  assert.match(source, /sm:max-w-xl rounded-2xl/);
  assert.match(source, /space-y-2\\.5 px-5 py-4 sm:px-6/);
});

test('Payout archive uses an in-app modal and explanatory blocked-state handling', () => {
  const source = read('frontend/src/pages/PayoutManagement.jsx');

  assert.match(source, /function ArchiveBatchModal/);
  assert.match(source, /Archive payout batch\\?/);
  assert.match(source, /setArchiveCandidate\\(selectedBatch\\)/);
  assert.match(source, /Resolve every Pending or On Hold scholar first/);
});

test('Payout archive backend requires terminal scholar statuses', () => {
  const source = read('backend/services/payoutService.js');

  assert.match(
    source,
    /terminalStatuses = new Set\\(\\['released', 'absent', 'cancelled'\\]\\)/
  );
  assert.match(source, /unfinishedEntries/);
  assert.match(source, /is_archived = TRUE/);
});

test('Payout restore service is implemented and exported', () => {
  const source = read('backend/services/payoutService.js');

  assert.match(source, /async function restorePayoutBatch/);
  assert.match(source, /is_archived = FALSE/);
  assert.match(source, /restorePayoutBatch,/);
});
`;

fs.mkdirSync(path.dirname(regressionTestPath), { recursive: true });
write(regressionTestPath, regressionTest);
console.log('Updated: readiness-applications-payout-fix-regression.test.js');

console.log('');
console.log('Recovery fix completed.');
console.log('');
console.log('Next commands:');
console.log('  cd admin\\\\backend');
console.log('  node --test test\\\\readiness-applications-payout-fix-regression.test.js');
console.log('  npm test');
console.log('  cd ..\\\\frontend');
console.log('  npm run build');
