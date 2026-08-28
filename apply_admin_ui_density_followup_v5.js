#!/usr/bin/env node
'use strict';

/*
 * SMaRT-PDM — Admin UI Density Follow-up v5
 *
 * Audited against GitHub main:
 * 6bee04ac5ecd07e819eba6c20a9b6c8c1446bb02 ("ui polish")
 *
 * Frontend-only:
 * - payout proof cards become reliably columned earlier
 * - admin reports controls become much denser so preview/table appears sooner
 * - remove redundant Applications "Cards" toggle
 * - current/archived Openings use a two-column card grid on desktop
 * - remove Landing Page Theme description
 * - remove General Configuration description
 * - move General Edit mode toggle to the far right of section tabs
 *
 * No backend/database/mobile changes.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_ID = 'SMART_PDM_ADMIN_UI_DENSITY_FOLLOWUP_V5_CRLF_SAFE';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const skipBuild = args.includes('--skip-build');
const rootArg = args.find((arg) => !arg.startsWith('--')) || '.';
const root = path.resolve(process.cwd(), rootArg);

const FILES = {
  payoutProofs:
    'admin/frontend/src/components/payout/PayoutProofReviewPanel.jsx',
  reports:
    'admin/frontend/src/pages/ReportGeneration.jsx',
  applications:
    'admin/frontend/src/pages/ApplicationReview.jsx',
  openings:
    'admin/frontend/src/pages/ScholarshipOpenings.jsx',
  landingTheme:
    'admin/frontend/src/pages/maintenance/LandingThemePanel.jsx',
  general:
    'admin/frontend/src/pages/maintenance/GeneralPanel.jsx',
};

function fail(message) {
  console.error('\n[ADMIN DENSITY V5] ERROR: ' + message);
  process.exit(1);
}

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    fail('Required file not found: ' + rel);
  }
  return fs.readFileSync(abs, 'utf8');
}

function count(source, needle) {
  return needle ? source.split(needle).length - 1 : 0;
}

function detectEol(source) {
  return source.includes('\r\n') ? '\r\n' : '\n';
}

function adaptEol(value, eol) {
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, eol);
}

function replaceExact(source, oldValue, newValue, label, expected = 1) {
  const eol = detectEol(source);
  const oldNative = adaptEol(oldValue, eol);
  const newNative = adaptEol(newValue, eol);

  if (source.includes(newNative)) {
    console.log('[already] ' + label);
    return source;
  }

  const matches = count(source, oldNative);
  if (matches !== expected) {
    throw new Error(
      `${label}: expected ${expected} source match(es), found ${matches}.`
    );
  }

  console.log('[patch] ' + label);
  return source.split(oldNative).join(newNative);
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = openIndex; i < source.length; i += 1) {
    const c = source[i];
    const n = source[i + 1];

    if (lineComment) {
      if (c === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (c === '*' && n === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }

    if (c === '/' && n === '/') {
      lineComment = true;
      i += 1;
      continue;
    }

    if (c === '/' && n === '*') {
      blockComment = true;
      i += 1;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }

    if (c === '{') depth += 1;
    if (c === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function findMatchingParen(source, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = openIndex; i < source.length; i += 1) {
    const c = source[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }

    if (c === '(') depth += 1;
    if (c === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function locateFunction(source, signatureRegex, label) {
  const match = signatureRegex.exec(source);
  if (!match) throw new Error(label + ': function was not found.');

  const paramsOpen = source.indexOf('(', match.index);
  if (paramsOpen < 0) throw new Error(label + ': parameter list not found.');

  const paramsClose = findMatchingParen(source, paramsOpen);
  if (paramsClose < 0) throw new Error(label + ': parameter list could not be parsed.');

  const bodyOpen = source.indexOf('{', paramsClose + 1);
  if (bodyOpen < 0) throw new Error(label + ': opening brace not found.');

  const bodyClose = findMatchingBrace(source, bodyOpen);
  if (bodyClose < 0) throw new Error(label + ': closing brace not found.');

  return {
    start: match.index,
    end: bodyClose + 1,
    text: source.slice(match.index, bodyClose + 1),
  };
}

function locateJsxElement(source, startIndex, tagName, label) {
  const start = source.indexOf('<' + tagName, startIndex);
  if (start < 0) throw new Error(label + ': opening element not found.');

  const regex = new RegExp(
    `<${tagName}\\b[^>]*>|<\\/${tagName}\\s*>`,
    'g'
  );
  regex.lastIndex = start;

  let depth = 0;
  let openEnd = -1;
  let match;

  while ((match = regex.exec(source))) {
    const token = match[0];

    if (token.startsWith('</')) {
      depth -= 1;
      if (depth === 0) {
        return {
          start,
          openEnd,
          closingStart: match.index,
          end: regex.lastIndex,
          text: source.slice(start, regex.lastIndex),
          inner: source.slice(openEnd, match.index),
        };
      }
    } else if (!token.endsWith('/>')) {
      depth += 1;
      if (depth === 1) openEnd = regex.lastIndex;
    }
  }

  throw new Error(label + ': closing element not found.');
}

function patchPayoutProofs(source) {
  let out = source;

  out = replaceExact(
    out,
    'className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3"',
    'className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3"',
    'Payout proofs: use two columns at normal content widths'
  );

  out = replaceExact(
    out,
    'className="py-12 text-center text-sm text-stone-400"',
    'className="py-8 text-center text-sm text-stone-400"',
    'Payout proofs: reduce empty-state vertical space'
  );

  return out;
}

function patchApplications(source) {
  let out = source;

  const cardsButtonRegex =
    /<button\s+type="button"\s+onClick=\{\(\)\s*=>\s*setViewType\('cards'\)\}[\s\S]*?<\/button>\s*/;

  if (cardsButtonRegex.test(out)) {
    out = out.replace(cardsButtonRegex, '');
    console.log('[patch] Applications: remove redundant Cards toggle');
  } else if (!out.includes("setViewType('cards')")) {
    console.log('[already] Applications: Cards toggle removed');
  } else {
    throw new Error(
      'Applications: Cards toggle exists but its button block could not be isolated.'
    );
  }

  if (/^\s*LayoutGrid,\s*$/m.test(out)) {
    out = out.replace(/^\s*LayoutGrid,\s*\r?\n/m, '');
    console.log('[patch] Applications: remove unused Cards icon import');
  }

  const placeholderRegex =
    /placeholder=\{\s*viewType\s*===\s*'cards'\s*\?\s*'Search opening, scholarship, or academic year'\s*:\s*'Search applicant, PDM ID, scholarship, or opening'\s*\}/;

  if (placeholderRegex.test(out)) {
    out = out.replace(
      placeholderRegex,
      'placeholder="Search applicant, PDM ID, scholarship, or opening"'
    );
    console.log('[patch] Applications: simplify search copy after Cards removal');
  } else if (
    out.includes(
      'placeholder="Search applicant, PDM ID, scholarship, or opening"'
    )
  ) {
    console.log('[already] Applications: simplified search copy');
  } else {
    throw new Error(
      'Applications: expected Cards-aware search placeholder was not found.'
    );
  }

  return out;
}

function patchOpenings(source) {
  let out = source;

  const listRegex =
    /<div className="space-y-3">\s*\{filteredOpenings\.map\(\(opening\)\s*=>\s*\(/;

  if (listRegex.test(out)) {
    out = out.replace(
      listRegex,
      '<div className="grid gap-3 xl:grid-cols-2">\n                                {filteredOpenings.map((opening) => ('
    );
    console.log('[patch] Openings: use two-column registry grid on desktop');
  } else if (
    /<div className="grid gap-3 xl:grid-cols-2">\s*\{filteredOpenings\.map/.test(out)
  ) {
    console.log('[already] Openings: two-column registry grid');
  } else {
    throw new Error(
      'Openings: filtered opening list container was not found.'
    );
  }

  const openingCard = locateFunction(
    out,
    /function\s+OpeningCard\s*\(\s*\{/,
    'OpeningCard'
  );

  let card = openingCard.text;

  card = replaceExact(
    card,
    'className="overflow-hidden rounded-2xl border-stone-200 bg-white shadow-none transition hover:border-stone-300 hover:shadow-sm"',
    'className="h-full overflow-hidden rounded-2xl border-stone-200 bg-white shadow-none transition hover:border-stone-300 hover:shadow-sm"',
    'Openings: keep paired cards equal-height'
  );

  card = replaceExact(
    card,
    'className="flex flex-col gap-3 border-b border-stone-100 px-4 py-3.5 lg:flex-row lg:items-start lg:justify-between sm:px-5"',
    'className="flex flex-col gap-3 border-b border-stone-100 px-4 py-3.5 2xl:flex-row 2xl:items-start 2xl:justify-between sm:px-5"',
    'Openings: prevent half-width card actions from crowding'
  );

  card = replaceExact(
    card,
    'className="grid gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 sm:px-5"',
    'className="grid grid-cols-2 gap-2 px-4 py-3 2xl:grid-cols-4 sm:px-5"',
    'Openings: keep metrics readable inside half-width cards'
  );

  out =
    out.slice(0, openingCard.start) +
    card +
    out.slice(openingCard.end);

  return out;
}

function patchLandingTheme(source) {
  let out = source;

  const descriptionRegex =
    /\s*<p className=\{MAINTENANCE_CARD_SUBTITLE_CLASS\}>\s*Adjust the public landing page and unified login colors separately from each user's portal theme\.\s*<\/p>\s*<p className="mt-1 text-xs text-stone-500">\s*You can apply a preset quickly, or use manual color pickers and save a custom landing palette\.\s*<\/p>/;

  if (descriptionRegex.test(out)) {
    out = out.replace(descriptionRegex, '');
    console.log('[patch] Landing Theme: remove redundant description copy');
  } else if (
    !out.includes(
      "Adjust the public landing page and unified login colors separately"
    )
  ) {
    console.log('[already] Landing Theme: description removed');
  } else {
    throw new Error(
      'Landing Theme: description text exists but could not be isolated safely.'
    );
  }

  out = out.replace(
    'className="rounded-2xl border border-stone-200 bg-white px-4 py-4"',
    'className="rounded-2xl border border-stone-200 bg-white px-4 py-3"'
  );

  return out;
}

function patchGeneral(source) {
  let out = source;

  const descRegex =
    /<p className=\{MAINTENANCE_CARD_SUBTITLE_CLASS\}>\s*System preferences, public content, application settings, and system tools\s*<\/p>/;

  if (descRegex.test(out)) {
    out = out.replace(descRegex, '');
    console.log('[patch] General: remove General Configuration description');
  } else if (
    !out.includes(
      'System preferences, public content, application settings, and system tools'
    )
  ) {
    console.log('[already] General: configuration description removed');
  } else {
    throw new Error(
      'General: configuration description exists but could not be isolated.'
    );
  }

  if (out.includes('SMART-PDM_GENERAL_EDIT_TOGGLE_WITH_TABS')) {
    console.log('[already] General: Edit mode is already beside section tabs');
    return out;
  }

  const editTextIndex = out.indexOf('<span>Edit mode</span>');
  let editButton = '';

  if (editTextIndex >= 0) {
    const buttonStart = out.lastIndexOf('<button', editTextIndex);
    const buttonEnd = out.indexOf('</button>', editTextIndex);

    if (buttonStart < 0 || buttonEnd < 0) {
      throw new Error('General: Edit mode button boundaries not found.');
    }

    editButton = out.slice(buttonStart, buttonEnd + '</button>'.length);
    out =
      out.slice(0, buttonStart) +
      out.slice(buttonEnd + '</button>'.length);

    console.log('[patch] General: remove Edit mode from header position');
  } else {
    throw new Error('General: Edit mode toggle was not found.');
  }

  if (!out.includes('SMART-PDM_GENERAL_EDIT_TOGGLE_WITH_TABS')) {
    const tabsStartNeedle =
      '<div className="mt-4 inline-flex flex-wrap rounded-xl bg-stone-100 p-1">';
    const tabsStart = out.indexOf(tabsStartNeedle);

    if (tabsStart < 0) {
      throw new Error('General: section tabs container was not found.');
    }

    const tabs = locateJsxElement(
      out,
      tabsStart,
      'div',
      'General section tabs'
    );

    if (!editButton) {
      throw new Error(
        'General: Edit mode button was unavailable for relocation.'
      );
    }

    const movedButton = editButton.replace(
      'className={`inline-flex h-10 w-[150px] shrink-0 items-center justify-between self-start rounded-xl border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto',
      'className={`ml-auto inline-flex h-10 w-[150px] shrink-0 items-center justify-between rounded-xl border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'
    );

    const replacement = `<div className="mt-4 flex min-w-0 items-center gap-3">
                        {/* SMART-PDM_GENERAL_EDIT_TOGGLE_WITH_TABS */}
                        <div className="inline-flex min-w-0 flex-1 flex-wrap rounded-xl bg-stone-100 p-1">${tabs.inner}
                        </div>
                        ${movedButton}
                    </div>`;

    out =
      out.slice(0, tabs.start) +
      replacement +
      out.slice(tabs.end);

    console.log(
      '[patch] General: move Edit mode to far right of section toggles'
    );
  }

  return out;
}

function patchReports(source) {
  let out = source;

  // Keep compact report-template treatment ADMIN-ONLY because this component
  // is reused by other portals.
  {
    const block = locateFunction(
      out,
      /function\s+TemplateCard\s*\(\s*\{/,
      'Report TemplateCard'
    );

    let card = block.text;

    card = replaceExact(
      card,
      'function TemplateCard({ report, active, onClick, theme }) {',
      'function TemplateCard({ report, active, onClick, theme, compact = false }) {',
      'Reports: add admin-only compact template option'
    );

    card = replaceExact(
      card,
      'className={`report-template-card w-full rounded-2xl border p-4 text-left transition-all ${active',
      "className={`report-template-card w-full rounded-2xl border text-left transition-all ${compact ? 'p-2.5' : 'p-4'} ${active",
      'Reports: compact Admin report-template buttons'
    );

    card = replaceExact(
      card,
      'className="flex items-start gap-4"',
      "className={`flex ${compact ? 'items-center gap-3' : 'items-start gap-4'}`}",
      'Reports: tighten compact template alignment'
    );

    card = replaceExact(
      card,
      '<p className="mt-1 text-xs text-stone-500">{report.sub}</p>',
      "{compact ? null : <p className=\"mt-1 text-xs text-stone-500\">{report.sub}</p>}",
      'Reports: hide template descriptions only in Admin compact mode'
    );

    out =
      out.slice(0, block.start) +
      card +
      out.slice(block.end);
  }

  if (!out.includes("compact={portalKey === 'admin'}")) {
    const templateCallRegex =
      /(<TemplateCard[\s\S]*?\bonClick=\{setSelected\}[\s\S]*?\btheme=\{theme\})(\s*\/>)/;

    const match = templateCallRegex.exec(out);

    if (!match) {
      throw new Error(
        'Reports: TemplateCard invocation with onClick/setSelected and theme was not found.'
      );
    }

    const eol = detectEol(out);
    const indentMatch = /(?:^|\r?\n)([ \t]*)theme=\{theme\}/.exec(match[1]);
    const indent = indentMatch?.[1] || '                ';

    const replacement =
      match[1] +
      eol +
      indent +
      "compact={portalKey === 'admin'}" +
      match[2];

    out =
      out.slice(0, match.index) +
      replacement +
      out.slice(match.index + match[0].length);

    console.log('[patch] Reports: enable compact templates for Admin only');
  } else {
    console.log('[already] Reports: compact Admin template prop');
  }

  out = replaceExact(
    out,
    '<div className="grid grid-cols-1 gap-5 xl:grid-cols-12">',
    "<div className={`grid grid-cols-1 xl:grid-cols-12 ${portalKey === 'admin' ? 'gap-3' : 'gap-5'}`}>",
    'Reports: tighten Admin report workspace gap'
  );

  out = replaceExact(
    out,
    '<Card className="overflow-hidden border-stone-200 bg-white shadow-none xl:col-span-4">',
    "<Card className={`overflow-hidden border-stone-200 bg-white shadow-none ${portalKey === 'admin' ? 'xl:col-span-3' : 'xl:col-span-4'}`}>",
    'Reports: narrow compact Admin template rail'
  );

  out = replaceExact(
    out,
    '<CardContent className="space-y-3 p-4">',
    "<CardContent className={portalKey === 'admin' ? 'space-y-2 p-3' : 'space-y-3 p-4'}>",
    'Reports: reduce Admin template rail padding'
  );

  out = replaceExact(
    out,
    '<Card className="overflow-hidden border-stone-200 bg-white shadow-none xl:col-span-8">',
    "<Card className={`overflow-hidden border-stone-200 bg-white shadow-none ${portalKey === 'admin' ? 'xl:col-span-9' : 'xl:col-span-8'}`}>",
    'Reports: give Admin export settings more horizontal room'
  );

  out = replaceExact(
    out,
    '<CardContent className="space-y-6 p-5">',
    "<CardContent className={portalKey === 'admin' ? 'space-y-4 p-4' : 'space-y-6 p-5'}>",
    'Reports: reduce Admin export settings vertical padding'
  );

  out = replaceExact(
    out,
    '<div className="grid grid-cols-1 gap-5 md:grid-cols-2">',
    "<div className={portalKey === 'admin' ? 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4' : 'grid grid-cols-1 gap-5 md:grid-cols-2'}>",
    'Reports: place Admin report filters in one desktop row'
  );

  out = replaceExact(
    out,
    '<div className="max-h-[420px] overflow-auto">',
    "<div className={portalKey === 'admin' ? 'min-h-[360px] max-h-[calc(100vh-300px)] overflow-auto' : 'max-h-[420px] overflow-auto'}>",
    'Reports: enlarge Admin preview table viewport'
  );

  return out;
}

const patchers = new Map([
  [FILES.payoutProofs, patchPayoutProofs],
  [FILES.reports, patchReports],
  [FILES.applications, patchApplications],
  [FILES.openings, patchOpenings],
  [FILES.landingTheme, patchLandingTheme],
  [FILES.general, patchGeneral],
]);

const before = new Map();
const after = new Map();

try {
  for (const [rel, patcher] of patchers.entries()) {
    const original = read(rel);
    before.set(rel, original);
    after.set(rel, patcher(original));
  }
} catch (error) {
  fail(error.message || String(error));
}

if (dryRun) {
  console.log('\n[ADMIN DENSITY V5] Dry run passed.');
  console.log('All required structural anchors were found.');
  console.log('No files were written.');
  console.log('\nFiles checked:');
  for (const rel of patchers.keys()) {
    console.log('  - ' + rel);
  }
  process.exit(0);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backups = [];
const changed = [];

try {
  for (const rel of patchers.keys()) {
    const original = before.get(rel);
    const next = after.get(rel);

    if (original === next) continue;

    const abs = path.join(root, rel);
    const backup = abs + '.bak-admin-density-v4-' + timestamp;

    fs.copyFileSync(abs, backup);
    backups.push([abs, backup]);
    fs.writeFileSync(abs, next, 'utf8');
    changed.push(rel);
  }

  if (!skipBuild) {
    const frontend = path.join(root, 'admin/frontend');
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    console.log('\n[verify] Running admin frontend production build...');

    const result = spawnSync(
      npm,
      ['run', 'build'],
      {
        cwd: frontend,
        encoding: 'utf8',
        shell: process.platform === 'win32',
      }
    );

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    if (result.status !== 0) {
      throw new Error('Admin frontend production build failed.');
    }
  } else {
    console.log('[verify] Production build skipped by --skip-build.');
  }
} catch (error) {
  for (const [abs, backup] of backups.reverse()) {
    try {
      fs.copyFileSync(backup, abs);
    } catch (_) {}
  }

  fail(
    (error.message || String(error)) +
      '\nAll files changed by this run were rolled back.'
  );
}

console.log('\n[ADMIN DENSITY V5] Installed successfully.');
console.log('Patch ID: ' + PATCH_ID);

if (!changed.length) {
  console.log('No contents changed; this patch appears already installed.');
} else {
  console.log('Changed files:');
  for (const rel of changed) {
    console.log('  - ' + rel);
  }
}

console.log('\nRestart Vite if needed, then hard-refresh the browser.');
