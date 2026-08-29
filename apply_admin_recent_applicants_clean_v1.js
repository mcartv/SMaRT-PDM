#!/usr/bin/env node
'use strict';

/*
 * SMaRT-PDM — Admin Dashboard Recent Applicants Cleanup v1
 *
 * Audited against latest GitHub main:
 *   4020a1d8ab521b03ae697e48724a73c578094bc4
 *
 * Scope: AdminDashboard.jsx only.
 *
 * Cleans the Recent Applicants table by consolidating the three competing
 * status columns into one Current Stage column while preserving the underlying
 * application/requirements/workflow information as lightweight supporting text.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rootArg = args.find((arg) => !arg.startsWith('--')) || '.';
const root = path.resolve(process.cwd(), rootArg);
const REL = 'admin/frontend/src/pages/AdminDashboard.jsx';

function fail(message) {
  console.error('\n[RECENT APPLICANTS CLEANUP] ERROR: ' + message);
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
    throw new Error(
      `${label}: expected exactly 1 source match, found ${count}.`
    );
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

  if (result.error) {
    throw new Error(`${label} could not start: ${result.error.message}`);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(label + ' failed.');
  }
}

const file = path.join(root, REL);
if (!fs.existsSync(file)) fail('Required file not found: ' + REL);

const original = fs.readFileSync(file, 'utf8');
if (/^<<<<<<<[^\r\n]*$/m.test(original)) {
  fail('Unresolved Git conflict markers remain in ' + REL + '.');
}

const oldBlock = `      <Card
        className="min-w-0 rounded-[24px] shadow-none"
        style={{ borderColor: C.border, background: C.surface }}
      >
        <CardHeader className="border-b border-stone-100">
          <CardTitle className="text-base font-semibold">
            Recent Applicants
          </CardTitle>
          <p className="text-sm text-stone-500">
            Latest active application records across scholarship openings.
          </p>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[170px]">Student</TableHead>
                <TableHead className="min-w-[200px]">
                  Program / Opening
                </TableHead>
                <TableHead className="min-w-[140px]">
                  Application Status
                </TableHead>
                <TableHead className="min-w-[140px]">
                  Requirements Status
                </TableHead>
                <TableHead className="min-w-[130px]">
                  FCFS / Activation
                </TableHead>
                <TableHead className="min-w-[110px]">Submitted</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {dashboard.recentApplications.length ? (
                dashboard.recentApplications.map((row) => {
                  const appMeta = getStatusMeta(row.application_status);
                  const documentMeta = getStatusMeta(row.document_status);
                  const workflowMeta = getStatusMeta(row.workflow_status);

                  return (
                    <TableRow key={row.application_id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-stone-800">
                            {row.student_name || 'Unknown Student'}
                          </p>
                          <p className="text-xs text-stone-400">
                            {row.student_number || 'No Student ID'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          <p className="text-sm text-stone-700">
                            {row.program_name || 'No Program'}
                          </p>
                          <p className="text-xs text-stone-400">
                            {row.opening_title || 'No Opening'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            background: appMeta.bg,
                            color: appMeta.color,
                          }}
                        >
                          {row.application_status || 'Unknown'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            background: documentMeta.bg,
                            color: documentMeta.color,
                          }}
                        >
                          {row.document_status || 'Unknown'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            background: workflowMeta.bg,
                            color: workflowMeta.color,
                          }}
                        >
                          {row.workflow_status || 'Processing'}
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-stone-500">
                        {formatDate(row.submission_date)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-center">
                      <AlertCircle className="h-5 w-5 text-stone-300" />
                      <p className="text-sm font-medium text-stone-500">
                        No application records found.
                      </p>
                      <p className="text-xs text-stone-400">
                        New applications will appear here.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>`;

const newBlock = `      <Card
        className="min-w-0 rounded-[24px] shadow-none"
        style={{ borderColor: C.border, background: C.surface }}
      >
        <CardHeader className="border-b border-stone-100 px-5 py-4">
          <CardTitle className="text-base font-semibold">
            Recent Applicants
          </CardTitle>
          <p className="mt-1 text-sm text-stone-500">
            Latest application activity and current processing stage.
          </p>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-[210px] pl-5">Student</TableHead>
                <TableHead className="min-w-[230px]">Scholarship</TableHead>
                <TableHead className="min-w-[210px]">Current Stage</TableHead>
                <TableHead className="min-w-[110px] pr-5 text-right">
                  Submitted
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {dashboard.recentApplications.length ? (
                dashboard.recentApplications.map((row) => {
                  const workflowLabel = row.workflow_status || 'Processing';
                  const workflowMeta = getStatusMeta(workflowLabel);
                  const requirementsLabel = row.document_status || 'Unknown';
                  const applicationLabel = row.application_status || 'Unknown';

                  return (
                    <TableRow
                      key={row.application_id}
                      className="transition-colors hover:bg-stone-50/70"
                    >
                      <TableCell className="py-3 pl-5 align-middle">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-stone-800">
                            {row.student_name || 'Unknown Student'}
                          </p>
                          <p className="mt-0.5 text-[11px] text-stone-400">
                            {row.student_number || 'No Student ID'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 align-middle">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-stone-700">
                            {row.program_name || 'No Program'}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-stone-400">
                            {row.opening_title || 'No Opening'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 align-middle">
                        <div className="min-w-0">
                          <span
                            className="inline-flex max-w-full rounded-full px-2.5 py-1 text-xs font-semibold"
                            style={{
                              background: workflowMeta.bg,
                              color: workflowMeta.color,
                            }}
                          >
                            <span className="truncate">{workflowLabel}</span>
                          </span>

                          <p className="mt-1.5 truncate text-[11px] text-stone-400">
                            {requirementsLabel}
                            {applicationLabel !== 'Pending Review'
                              ? \` · \${applicationLabel}\`
                              : ''}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 pr-5 text-right align-middle text-xs text-stone-500">
                        {formatDate(row.submission_date)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-center">
                      <AlertCircle className="h-5 w-5 text-stone-300" />
                      <p className="text-sm font-medium text-stone-500">
                        No application records found.
                      </p>
                      <p className="text-xs text-stone-400">
                        New applications will appear here.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>`;

let patched;

try {
  patched = replaceOne(
    original,
    oldBlock,
    newBlock,
    'Admin Dashboard: simplify Recent Applicants table'
  );
} catch (error) {
  fail(error.message || String(error));
}

if (dryRun) {
  console.log('\n[RECENT APPLICANTS CLEANUP] Dry run passed.');
  console.log('Only ' + REL + ' would change.');
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
  fail((error.message || String(error)) + '\nAdminDashboard.jsx was restored.');
}

console.log('\n[RECENT APPLICANTS CLEANUP] Installed successfully.');
console.log('Changed only:');
console.log('  - ' + REL);
console.log('');
console.log('No backend/database changes.');
