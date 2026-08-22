#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);

  while (true) {
    const service = path.join(
      dir,
      'admin',
      'backend',
      'services',
      'applicationService.js'
    );

    if (
      fs.existsSync(service) &&
      fs.existsSync(path.join(dir, 'admin', 'backend', 'test'))
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
  const out = `${file}.bak-document-preview-fix-v2-${stamp()}`;
  fs.copyFileSync(file, out);
  return out;
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

const servicePath = path.join(
  repo,
  'admin',
  'backend',
  'services',
  'applicationService.js'
);

const testPath = path.join(
  repo,
  'admin',
  'backend',
  'test',
  'document-verification-upload-metadata-regression.test.js'
);

const original = fs.readFileSync(servicePath, 'utf8');
const usesCrlf = original.includes('\r\n');
let source = original.replace(/\r\n/g, '\n');

const loopStartMarker = '    for (const review of normalizedReviews) {';
const loopEndMarker = '    const majorReviews = requiredReviews.filter(';

const loopStart = source.indexOf(loopStartMarker);
const loopEnd = source.indexOf(loopEndMarker, loopStart);

if (loopStart < 0 || loopEnd < 0) {
  throw new Error(
    'Could not locate the document-verification review loop. No changes were written.'
  );
}

const before = source.slice(0, loopStart);
let reviewLoop = source.slice(loopStart, loopEnd);
const after = source.slice(loopEnd);

/*
 * Scope the fix ONLY to saveApplicationVerification's normalizedReviews loop.
 *
 * Other parts of applicationService.js may legitimately assign file_url from a
 * review/upload object. The v1 installer incorrectly validated the entire file,
 * which is why it stopped even after fixing the intended block in memory.
 */
reviewLoop = reviewLoop.replace(
  /^\s*is_submitted:\s*!!review\.url,\s*\n/m,
  ''
);

reviewLoop = reviewLoop.replace(
  /^\s*file_url:\s*review\.url,\s*\n/m,
  ''
);

if (!reviewLoop.includes('Document verification must never rewrite upload metadata.')) {
  const updateMarker = `.from('application_documents')
            .update({
`;

  if (!reviewLoop.includes(updateMarker)) {
    throw new Error(
      'Could not find the application_documents verification update block.'
    );
  }

  reviewLoop = reviewLoop.replace(
    updateMarker,
    `.from('application_documents')
            .update({
                // Verification changes review metadata only.
                // The permanent upload state comes from file_path/current_version_id,
                // not from a temporary signed preview URL.
`
  );
}

if (!reviewLoop.includes('documentViewMetadataCache.delete(')) {
  const errorBlock = `        if (submittedDocumentError) {
            console.error(
                'Supabase Submitted Document Update Error:',
                submittedDocumentError
            );
            throw new Error(submittedDocumentError.message);
        }
`;

  if (!reviewLoop.includes(errorBlock)) {
    throw new Error(
      'Could not find the verification update error block for cache invalidation.'
    );
  }

  reviewLoop = reviewLoop.replace(
    errorBlock,
    `${errorBlock}
        // Force the next Preview request to reread the document metadata.
        documentViewMetadataCache.delete(
            \`\${applicationId}:\${review.documentKey}\`
        );
`
  );
}

/* Validate ONLY the intended verification loop. */
const scopedChecks = [
  [
    'verification loop does not rewrite is_submitted',
    !/is_submitted:\s*!!review\.url/.test(reviewLoop),
  ],
  [
    'verification loop does not overwrite file_url',
    !/file_url:\s*review\.url/.test(reviewLoop),
  ],
  [
    'review_status update remains',
    /review_status:\s*review\.reviewStatus/.test(reviewLoop),
  ],
  [
    'cache invalidation added',
    /documentViewMetadataCache\.delete\([\s\S]*applicationId[\s\S]*review\.documentKey/.test(
      reviewLoop
    ),
  ],
];

const failed = scopedChecks.filter(([, ok]) => !ok);

if (failed.length) {
  throw new Error(
    `Scoped validation failed: ${failed.map(([name]) => name).join(', ')}`
  );
}

source = before + reviewLoop + after;

const backupPath = backup(servicePath);

fs.writeFileSync(
  servicePath,
  usesCrlf ? source.replace(/\n/g, '\r\n') : source,
  'utf8'
);

const testSource = `'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const source = read('backend/services/applicationService.js');

function getVerificationReviewLoop() {
  const startMarker = '    for (const review of normalizedReviews) {';
  const endMarker = '    const majorReviews = requiredReviews.filter(';

  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  assert.notEqual(start, -1, 'normalizedReviews loop should exist');
  assert.notEqual(end, -1, 'normalizedReviews loop end should exist');

  return source.slice(start, end);
}

test('verification does not destroy persistent upload metadata', () => {
  const loop = getVerificationReviewLoop();

  assert.doesNotMatch(
    loop,
    /is_submitted:\\s*!!review\\.url/
  );

  assert.doesNotMatch(
    loop,
    /file_url:\\s*review\\.url/
  );

  assert.match(
    loop,
    /review_status:\\s*review\\.reviewStatus/
  );
});

test('verification clears cached document metadata after review update', () => {
  const loop = getVerificationReviewLoop();

  assert.match(
    loop,
    /documentViewMetadataCache\\.delete\\([\\s\\S]*applicationId[\\s\\S]*review\\.documentKey/
  );
});

test('secure preview endpoint still requires persisted upload state', () => {
  assert.match(
    source,
    /document\\.is_submitted !== true \\|\\| !document\\.file_path/
  );
});
`;

fs.writeFileSync(testPath, testSource, 'utf8');

console.log('\nSMaRT-PDM document preview / FCFS fix v2 applied.\n');
console.log('Changed:');
console.log('  admin/backend/services/applicationService.js');
console.log('  admin/backend/test/document-verification-upload-metadata-regression.test.js');

console.log('\nBackup:');
console.log(`  ${backupPath}`);

console.log('\nImportant:');
console.log('  - only the saveApplicationVerification review loop was changed');
console.log('  - unrelated file_url assignments elsewhere were left untouched');
console.log('  - document verification no longer changes is_submitted');
console.log('  - document verification no longer overwrites file_url');
console.log('  - preview metadata cache is invalidated after review changes');

const backend = path.join(repo, 'admin', 'backend');

run('node', ['--check', servicePath], repo);
run(
  'node',
  [
    '--test',
    path.join(
      'test',
      'document-verification-upload-metadata-regression.test.js'
    ),
  ],
  backend
);

console.log('\nPASS: document preview regression test passed.');
console.log('\nRestart the Admin backend before retesting document previews.');
