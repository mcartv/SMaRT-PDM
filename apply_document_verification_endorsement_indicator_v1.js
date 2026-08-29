#!/usr/bin/env node
'use strict';

/*
 * SMaRT-PDM — Document Verification Endorsement Indicator v1
 *
 * Audited against latest GitHub main around commit:
 *   65d825d08a5c77cf62fb0df249e5ad317cd07ba2
 *
 * Fixes the stale/premature endorsement-slip button in Document Verification.
 * An endorsement slip row may already exist historically, but the backend now
 * blocks it until Admin verification is complete. Therefore the frontend must
 * not treat endorsement_slip_id alone as proof that endorsement is open.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rootArg = args.find((arg) => !arg.startsWith('--')) || '.';
const root = path.resolve(process.cwd(), rootArg);
const REL = 'admin/frontend/src/pages/DocumentVerification.jsx';

function fail(message) {
  console.error('\n[DOCUMENT VERIFICATION ENDORSEMENT INDICATOR] ERROR: ' + message);
  process.exit(1);
}

function adaptEol(value, source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return String(value).replace(/\r\n/g, '\n').replace(/\n/g, eol);
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
    throw new Error(`${label}: expected exactly 1 source match, found ${count}.`);
  }

  console.log('[patch] ' + label);
  return source.replace(oldNative, newNative);
}

function run(command, commandArgs, cwd, label) {
  console.log('\n[verify] ' + label);

  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(label + ' failed.');
}

const file = path.join(root, REL);
if (!fs.existsSync(file)) fail('Required file not found: ' + REL);

const original = fs.readFileSync(file, 'utf8');
if (/^<<<<<<<[^\r\n]*$/m.test(original)) {
  fail('Unresolved Git conflict markers remain in ' + REL + '.');
}

let patched = original;

try {
  patched = replaceOne(
    patched,
    `  const canCompleteVerification =
    allRequiredDocsUploaded &&
    allRequiredDocsReviewed &&
    !requirementsReviewAlreadySaved;

  const progress = docs.length ? Math.round((reviewedCount / docs.length) * 100) : 0;`,
    `  const canCompleteVerification =
    allRequiredDocsUploaded &&
    allRequiredDocsReviewed &&
    !requirementsReviewAlreadySaved;

  // SMART-PDM_DOCUMENT_VERIFICATION_ENDORSEMENT_GATE_V1
  // endorsement_slip_id alone is not enough. Old/premature slip rows can
  // exist for audit history while the endorsement backend correctly hides
  // them until Admin has verified the complete application requirements.
  const requirementsVerifiedForEndorsement =
    persistedVerificationStatus === 'verified' &&
    Boolean(application?.requirements_verified_at);

  const canOpenEndorsement =
    requirementsVerifiedForEndorsement && Boolean(endorsementSlipId);

  const endorsementHeaderStatus = (() => {
    if (persistedVerificationStatus === 'rejected') {
      return {
        label: 'Application Rejected',
        className:
          'border-red-200 bg-red-50 text-red-700',
      };
    }

    if (persistedVerificationStatus === 'requires_reupload') {
      return {
        label: 'Correction Required',
        className:
          'border-orange-200 bg-orange-50 text-orange-700',
      };
    }

    if (requirementsVerifiedForEndorsement) {
      return {
        label: endorsementSlipId
          ? 'Endorsement Active'
          : 'Ready for Endorsement',
        className:
          'border-green-200 bg-green-50 text-green-700',
      };
    }

    if (allRequiredDocsUploaded) {
      return {
        label: 'Ready for Verification',
        className:
          'border-amber-200 bg-amber-50 text-amber-700',
      };
    }

    return {
      label: 'Requirements Incomplete',
      className:
        'border-stone-200 bg-stone-50 text-stone-600',
    };
  })();

  const progress = docs.length ? Math.round((reviewedCount / docs.length) * 100) : 0;`,
    'Add endorsement eligibility/status state'
  );

  patched = replaceOne(
    patched,
    `            {endorsementSlipId ? (`,
    `            {canOpenEndorsement ? (`,
    'Only expose endorsement button after Admin verification'
  );

  patched = replaceOne(
    patched,
    `                  Open Endorsement Slip
                </Button>
              </>
            ) : null}
            <Button
              variant="outline"`,
    `                  Open Endorsement Slip
                </Button>
              </>
            ) : (
              <Badge
                variant="outline"
                className={\`h-9 rounded-full px-3 text-xs font-semibold \${endorsementHeaderStatus.className}\`}
                title={
                  endorsementHeaderStatus.label === 'Ready for Verification'
                    ? 'All required uploads are present. Save the Admin requirements review before endorsement becomes available.'
                    : undefined
                }
              >
                {endorsementHeaderStatus.label}
              </Badge>
            )}
            <Button
              variant="outline"`,
    'Show workflow capsule instead of broken endorsement link'
  );
} catch (error) {
  fail(error.message || String(error));
}

if (dryRun) {
  console.log('\n[DOCUMENT VERIFICATION ENDORSEMENT INDICATOR] Dry run passed.');
  console.log('Only ' + REL + ' would be changed.');
  console.log('No files were written.');
  process.exit(0);
}

try {
  fs.writeFileSync(file, patched, 'utf8');

  const frontend = path.join(root, 'admin/frontend');

  if (process.platform === 'win32') {
    run(
      process.env.ComSpec || 'cmd.exe',
      ['/d', '/c', 'npm run build'],
      frontend,
      'Admin frontend build'
    );
  } else {
    run('npm', ['run', 'build'], frontend, 'Admin frontend build');
  }
} catch (error) {
  fs.writeFileSync(file, original, 'utf8');
  fail((error.message || String(error)) + '\nDocumentVerification.jsx was restored.');
}

console.log('\n[DOCUMENT VERIFICATION ENDORSEMENT INDICATOR] Installed successfully.');
console.log('No backend/database mutation was required.');
