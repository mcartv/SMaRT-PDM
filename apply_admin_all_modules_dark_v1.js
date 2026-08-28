#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipBuild = args.includes('--skip-build');
const rootArg = args.find((arg) => !arg.startsWith('--')) || '.';
const root = path.resolve(process.cwd(), rootArg);

const CSS_REL = 'admin/frontend/src/index.css';
const LAYOUT_REL = 'admin/frontend/src/components/layout/AdminLayout.jsx';
const cssPath = path.join(root, CSS_REL);
const layoutPath = path.join(root, LAYOUT_REL);

function fail(message) {
  console.error('\n[ADMIN ALL-MODULE DARK] ERROR: ' + message);
  process.exit(1);
}

function detectEol(source) {
  return source.includes('\r\n') ? '\r\n' : '\n';
}

if (!fs.existsSync(cssPath)) fail('Required file not found: ' + CSS_REL);
if (!fs.existsSync(layoutPath)) fail('Required file not found: ' + LAYOUT_REL);

const cssOriginal = fs.readFileSync(cssPath, 'utf8');
const layoutSource = fs.readFileSync(layoutPath, 'utf8');

if (!layoutSource.includes('admin-industrial-shell')) {
  fail('admin-industrial-shell is missing. Apply the industrial Admin dark-mode patch first.');
}

if (
  !cssOriginal.includes('SMART-PDM_ADMIN_INDUSTRIAL_DARK_V1') &&
  !cssOriginal.includes('SMART-PDM_ADMIN_INDUSTRIAL_DARK_V2')
) {
  fail('Industrial Admin dark-mode CSS marker was not found.');
}

const frontendSrc = path.join(root, 'admin/frontend/src');
const conflictFiles = [];

function scanConflicts(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanConflicts(abs);
      continue;
    }
    if (!/\.(?:js|jsx|ts|tsx|css|scss|json)$/i.test(entry.name)) continue;
    const content = fs.readFileSync(abs, 'utf8');
    if (/^<<<<<<<[^\r\n]*$/m.test(content)) {
      conflictFiles.push(path.relative(root, abs).replace(/\\/g, '/'));
    }
  }
}

scanConflicts(frontendSrc);

if (conflictFiles.length) {
  fail(
    'Unresolved Git merge markers still exist:\n' +
      conflictFiles.map((file) => '  - ' + file).join('\n')
  );
}

const MARKER = 'SMART-PDM_ADMIN_ALL_MODULES_DARK_V1';

const MODULE_CSS = `
/* ${MARKER}
   Industrial dark compatibility for all Admin modules.
   Layout-safe: surface, text, border, state and focus treatment only. */

html.smartpdm-force-dark .admin-industrial-shell {
  --admin-dark-canvas: #141311;
  --admin-dark-section: #1a1816;
  --admin-dark-card: #1f1d1a;
  --admin-dark-card-raised: #26221f;
  --admin-dark-soft: #2b2723;
  --admin-dark-soft-strong: #342e29;
  --admin-dark-line: #484038;
  --admin-dark-line-soft: #332e29;
  --admin-dark-copper-soft: color-mix(in srgb, var(--industrial-copper) 18%, var(--admin-dark-card) 82%);
}

html.smartpdm-force-dark .admin-industrial-shell .dark-mode-route-canvas,
html.smartpdm-force-dark .admin-industrial-shell [data-maintenance-viewport-fit="true"] {
  background-color: var(--admin-dark-canvas) !important;
  color: var(--text-main);
}

html.smartpdm-force-dark .admin-industrial-shell [data-slot="card"],
html.smartpdm-force-dark .admin-industrial-shell section.bg-white,
html.smartpdm-force-dark .admin-industrial-shell div.bg-white {
  background-color: var(--admin-dark-card) !important;
  border-color: var(--admin-dark-line) !important;
}

html.smartpdm-force-dark .admin-industrial-shell .bg-stone-50 {
  background-color: var(--admin-dark-section) !important;
}

html.smartpdm-force-dark .admin-industrial-shell .bg-stone-100 {
  background-color: var(--admin-dark-soft) !important;
}

html.smartpdm-force-dark .admin-industrial-shell .bg-stone-200 {
  background-color: var(--admin-dark-soft-strong) !important;
}

html.smartpdm-force-dark .admin-industrial-shell .bg-stone-300 {
  background-color: #403830 !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  .bg-slate-50,
  .bg-gray-50,
  .bg-neutral-50,
  .bg-zinc-50
) {
  background-color: var(--admin-dark-section) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  .bg-slate-100,
  .bg-gray-100,
  .bg-neutral-100,
  .bg-zinc-100
) {
  background-color: var(--admin-dark-soft) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  .border-stone-50,
  .border-stone-100,
  .border-gray-100,
  .border-slate-100,
  .border-neutral-100
) {
  border-color: var(--admin-dark-line-soft) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  .border-stone-200,
  .border-gray-200,
  .border-slate-200,
  .border-neutral-200,
  .border-zinc-200
) {
  border-color: var(--admin-dark-line) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  .border-stone-300,
  .border-gray-300,
  .border-slate-300,
  .border-neutral-300
) {
  border-color: var(--border-strong) !important;
}

html.smartpdm-force-dark .admin-industrial-shell table {
  color: var(--text-main);
}

html.smartpdm-force-dark .admin-industrial-shell thead,
html.smartpdm-force-dark .admin-industrial-shell thead.bg-stone-50 {
  background-color: #1b1917 !important;
}

html.smartpdm-force-dark .admin-industrial-shell th {
  color: var(--text-secondary) !important;
  border-color: var(--admin-dark-line-soft) !important;
}

html.smartpdm-force-dark .admin-industrial-shell td {
  border-color: var(--admin-dark-line-soft) !important;
}

html.smartpdm-force-dark .admin-industrial-shell tbody tr:hover {
  background-color: #25211e !important;
}

html.smartpdm-force-dark .admin-industrial-shell input:not([type="color"]),
html.smartpdm-force-dark .admin-industrial-shell select,
html.smartpdm-force-dark .admin-industrial-shell textarea,
html.smartpdm-force-dark .admin-industrial-shell [role="combobox"] {
  background-color: #201e1b !important;
  border-color: var(--admin-dark-line) !important;
  color: var(--text-main) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(input, select, textarea):disabled {
  background-color: #191816 !important;
  border-color: var(--admin-dark-line-soft) !important;
  color: var(--text-disabled) !important;
  opacity: 0.82;
}

html.smartpdm-force-dark .admin-industrial-shell input::placeholder,
html.smartpdm-force-dark .admin-industrial-shell textarea::placeholder {
  color: #8f8378 !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  input,
  select,
  textarea,
  [role="combobox"]
):focus {
  border-color: var(--industrial-copper) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--industrial-copper) 20%, transparent) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  [aria-pressed="true"],
  [aria-selected="true"],
  [data-state="active"],
  [data-state="checked"]
) {
  background-color: var(--admin-dark-copper-soft) !important;
  border-color: color-mix(in srgb, var(--industrial-copper) 58%, var(--admin-dark-line) 42%) !important;
  color: var(--text-main) !important;
}

html.smartpdm-force-dark .admin-industrial-shell button.bg-white,
html.smartpdm-force-dark .admin-industrial-shell [data-slot="button"].bg-white {
  background-color: var(--admin-dark-card-raised) !important;
  border-color: var(--admin-dark-line) !important;
  color: var(--text-main) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  .hover\\:bg-stone-50,
  .hover\\:bg-stone-100,
  .hover\\:bg-white
):hover {
  background-color: #312b26 !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  .bg-stone-800,
  .bg-stone-900,
  .bg-stone-950
) {
  background-color: #3b3028 !important;
  color: #fff8f1 !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  [class~="bg-[#F8F6F2]"],
  [class~="bg-[#f8f6f2]"],
  [class~="bg-[#F8FAFC]"],
  [class~="bg-[#f8fafc]"],
  [class~="bg-[#FAF7F2]"],
  [class~="bg-[#faf7f2]"],
  [class~="bg-[#F7F7F7]"],
  [class~="bg-[#f7f7f7]"],
  [class~="bg-[#FFFDF9]"],
  [class~="bg-[#fffdf9]"],
  [class~="bg-[#FFFDFA]"],
  [class~="bg-[#fffdfa]"],
  [class~="bg-[#F6F1E9]"],
  [class~="bg-[#f6f1e9]"]
) {
  background-color: var(--admin-dark-card) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  [style*="#F8F6F2" i],
  [style*="#F8FAFC" i],
  [style*="#FAF7F2" i],
  [style*="rgb(248, 246, 242)" i],
  [style*="rgb(248, 250, 252)" i],
  [style*="rgb(250, 247, 242)" i]
) {
  background-color: var(--admin-dark-canvas) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  [class~="bg-[#F0FDF4]"],
  [class~="bg-[#f0fdf4]"],
  [style*="#F0FDF4" i],
  [style*="rgb(240, 253, 244)" i]
) {
  background-color: var(--status-success-bg) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  [class~="bg-[#EFF6FF]"],
  [class~="bg-[#eff6ff]"],
  [style*="#EFF6FF" i],
  [style*="rgb(239, 246, 255)" i]
) {
  background-color: var(--status-info-bg) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  [class~="bg-[#FFF7ED]"],
  [class~="bg-[#fff7ed]"],
  [style*="#FFF7ED" i],
  [style*="rgb(255, 247, 237)" i]
) {
  background-color: var(--status-warning-bg) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  [class~="bg-[#FEF2F2]"],
  [class~="bg-[#fef2f2]"],
  [style*="#FEF2F2" i],
  [style*="rgb(254, 242, 242)" i]
) {
  background-color: var(--status-danger-bg) !important;
}

html.smartpdm-force-dark .admin-industrial-shell :is(
  [role="dialog"],
  [role="menu"],
  [role="listbox"]
) {
  color: var(--text-main);
  border-color: var(--admin-dark-line) !important;
}

html.smartpdm-force-dark .admin-industrial-shell .ocr-validation-hub {
  background-color: var(--admin-dark-card) !important;
  border-color: var(--admin-dark-line) !important;
}

html.smartpdm-force-dark .admin-industrial-shell .message-thread-surface {
  background-color: #171614 !important;
}

html.smartpdm-force-dark
  .admin-industrial-shell
  [data-maintenance-viewport-fit="true"]
  [data-slot="card"] {
  background-color: var(--admin-dark-card) !important;
}

html.smartpdm-force-dark .admin-industrial-shell .report-template-card {
  background-color: var(--admin-dark-card) !important;
  border-color: var(--admin-dark-line) !important;
}

html.smartpdm-force-dark .admin-industrial-shell a:focus-visible,
html.smartpdm-force-dark .admin-industrial-shell button:focus-visible {
  outline-color: var(--industrial-copper) !important;
}

html.smartpdm-force-dark .admin-industrial-shell ::selection {
  background: color-mix(in srgb, var(--industrial-copper) 42%, transparent);
  color: #fffaf5;
}
`;

let cssNext = cssOriginal;

if (cssNext.includes(MARKER)) {
  console.log('[already] All-module dark compatibility CSS');
} else {
  const eol = detectEol(cssNext);
  cssNext =
    cssNext.replace(/\s*$/, '') +
    eol +
    eol +
    MODULE_CSS.trim().replace(/\n/g, eol) +
    eol;
  console.log('[patch] Add dark compatibility for all Admin modules');
}

if (dryRun) {
  console.log('\n[ADMIN ALL-MODULE DARK] Dry run passed.');
  console.log('Industrial dark mode is installed and no merge conflicts were found.');
  console.log('No files were written.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = cssPath + '.bak-admin-all-modules-dark-' + stamp;

try {
  if (cssNext !== cssOriginal) {
    fs.copyFileSync(cssPath, backup);
    fs.writeFileSync(cssPath, cssNext, 'utf8');
  }

  if (!skipBuild) {
    const frontend = path.join(root, 'admin/frontend');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    console.log('\n[verify] Running admin frontend production build...');

    const result = spawnSync(npm, ['run', 'build'], {
      cwd: frontend,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    if (result.status !== 0) {
      throw new Error('Admin frontend production build failed.');
    }
  }
} catch (error) {
  if (fs.existsSync(backup)) {
    try {
      fs.copyFileSync(backup, cssPath);
    } catch (_) {}
  }

  fail(
    (error.message || String(error)) +
      '\nindex.css was restored automatically.'
  );
}

console.log('\n[ADMIN ALL-MODULE DARK] Installed successfully.');
console.log('Changed file: ' + CSS_REL);
