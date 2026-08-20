#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(dir, 'admin', 'frontend', 'src')) &&
      fs.existsSync(path.join(dir, 'admin', 'backend'))
    ) return dir;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not find the SMaRT-PDM repository root.');
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function backup(file) {
  if (!fs.existsSync(file)) return null;
  const out = `${file}.bak-system-log-icons-v2-${stamp()}`;
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
const frontend = path.join(repo, 'admin', 'frontend');

const adminProfile = path.join(frontend, 'src', 'pages', 'AdminProfile.jsx');
const auditPanel = path.join(
  frontend,
  'src',
  'pages',
  'maintenance',
  'AuditPanel.jsx'
);
const componentDir = path.join(frontend, 'src', 'components', 'system');
const iconComponent = path.join(componentDir, 'SystemLogIcon.jsx');

for (const file of [adminProfile, auditPanel]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Required file not found: ${file}`);
  }
}

const componentContent = `import React from 'react';
import {
    Activity,
    Archive,
    BadgeCheck,
    Ban,
    Bell,
    ClipboardCheck,
    FileUp,
    KeyRound,
    LogIn,
    LogOut,
    Megaphone,
    Pencil,
    PlusCircle,
    RotateCcw,
    ScanLine,
    Settings,
    ShieldAlert,
    UserRoundCog,
    WalletCards,
    XCircle,
} from 'lucide-react';

const VISUAL_RULES = [
    {
        match: /(retry|rescan).*ocr|ocr.*(retry|rescan)/i,
        icon: RotateCcw,
        label: 'OCR retry or rescan',
        className: 'border-sky-100 bg-sky-50 text-sky-700',
    },
    {
        match: /(run|start).*ocr|ocr.*(run|start)/i,
        icon: ScanLine,
        label: 'OCR scan started',
        className: 'border-blue-100 bg-blue-50 text-blue-700',
    },
    {
        match: /cancel.*ocr|ocr.*cancel/i,
        icon: Ban,
        label: 'OCR scan cancelled',
        className: 'border-red-100 bg-red-50 text-red-700',
    },
    {
        match: /(confirm|verify|approve).*ocr|ocr.*(confirm|verify|approve)/i,
        icon: BadgeCheck,
        label: 'OCR result confirmed',
        className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    },
    {
        match: /reject.*ocr|ocr.*reject/i,
        icon: XCircle,
        label: 'OCR result rejected',
        className: 'border-red-100 bg-red-50 text-red-700',
    },
    {
        match: /import|registrar|student registry/i,
        icon: FileUp,
        label: 'Data import',
        className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    },
    {
        match: /archive/i,
        icon: Archive,
        label: 'Archived record',
        className: 'border-amber-100 bg-amber-50 text-amber-700',
    },
    {
        match: /login|signed in/i,
        icon: LogIn,
        label: 'Signed in',
        className: 'border-green-100 bg-green-50 text-green-700',
    },
    {
        match: /logout|signed out/i,
        icon: LogOut,
        label: 'Signed out',
        className: 'border-stone-200 bg-stone-50 text-stone-600',
    },
    {
        match: /password|credential|reset/i,
        icon: KeyRound,
        label: 'Account security',
        className: 'border-amber-100 bg-amber-50 text-amber-700',
    },
    {
        match: /announcement|publish/i,
        icon: Megaphone,
        label: 'Announcement',
        className: 'border-violet-100 bg-violet-50 text-violet-700',
    },
    {
        match: /notification/i,
        icon: Bell,
        label: 'Notification',
        className: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    },
    {
        match: /payout|disbursement|payment/i,
        icon: WalletCards,
        label: 'Payout activity',
        className: 'border-teal-100 bg-teal-50 text-teal-700',
    },
    {
        match: /return of obligation|ro coordinator|\\bro\\b|placement|assignment/i,
        icon: ClipboardCheck,
        label: 'Return of Obligation activity',
        className: 'border-cyan-100 bg-cyan-50 text-cyan-700',
    },
    {
        match: /account|profile|user/i,
        icon: UserRoundCog,
        label: 'Account activity',
        className: 'border-orange-100 bg-orange-50 text-orange-700',
    },
    {
        match: /reject|decline|disqualif|failed|error/i,
        icon: ShieldAlert,
        label: 'Rejected or failed action',
        className: 'border-red-100 bg-red-50 text-red-700',
    },
    {
        match: /approve|verify|confirm|qualif|complete/i,
        icon: BadgeCheck,
        label: 'Approved or completed action',
        className: 'border-green-100 bg-green-50 text-green-700',
    },
    {
        match: /create|add|new/i,
        icon: PlusCircle,
        label: 'Created record',
        className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    },
    {
        match: /update|edit|change|adjust/i,
        icon: Pencil,
        label: 'Updated record',
        className: 'border-blue-100 bg-blue-50 text-blue-700',
    },
    {
        match: /setting|maintenance|configure/i,
        icon: Settings,
        label: 'System setting',
        className: 'border-slate-200 bg-slate-50 text-slate-600',
    },
];

function buildSearchText(item = {}) {
    return [
        item.action_taken,
        item.description,
        item.module,
        item.entity_type,
    ]
        .filter(Boolean)
        .join(' ');
}

function resolveVisual(item = {}) {
    const text = buildSearchText(item);

    return (
        VISUAL_RULES.find((rule) => rule.match.test(text)) || {
            icon: Activity,
            label: 'System activity',
            className: 'border-stone-200 bg-stone-50 text-stone-600',
        }
    );
}

export default function SystemLogIcon({
    item,
    size = 'md',
    className = '',
}) {
    const visual = resolveVisual(item);
    const Icon = visual.icon;

    const dimensions =
        size === 'sm'
            ? 'h-7 w-7 rounded-lg'
            : 'h-9 w-9 rounded-xl';

    const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

    return (
        <div
            className={\`flex shrink-0 items-center justify-center border \${dimensions} \${visual.className} \${className}\`}
            title={visual.label}
            aria-label={visual.label}
        >
            <Icon className={iconSize} aria-hidden="true" />
        </div>
    );
}
`;

fs.mkdirSync(componentDir, { recursive: true });
const componentBackup = backup(iconComponent);
fs.writeFileSync(iconComponent, componentContent, 'utf8');

let profileText = fs.readFileSync(adminProfile, 'utf8');
const profileBackup = backup(adminProfile);

if (!profileText.includes("SystemLogIcon from '@/components/system/SystemLogIcon'")) {
  const anchor = "import { formatSystemLogDescription } from '@/utils/systemLogText';";
  if (!profileText.includes(anchor)) {
    throw new Error('AdminProfile import anchor was not found.');
  }
  profileText = profileText.replace(
    anchor,
    `${anchor}\nimport SystemLogIcon from '@/components/system/SystemLogIcon';`
  );
}

if (!profileText.includes('<SystemLogIcon item={item} />')) {
  const dotPattern = /<div\s+className="mt-1\.5 h-2 w-2 shrink-0 rounded-full bg-amber-500"\s*\/>/;
  if (!dotPattern.test(profileText)) {
    throw new Error('AdminProfile activity dot was not found.');
  }
  profileText = profileText.replace(dotPattern, '<SystemLogIcon item={item} />');
}

fs.writeFileSync(adminProfile, profileText, 'utf8');

let auditText = fs.readFileSync(auditPanel, 'utf8');
const auditBackup = backup(auditPanel);

if (!auditText.includes("SystemLogIcon from '@/components/system/SystemLogIcon'")) {
  const importBlock = /import\s*\{\s*formatSystemLogActionLabel,\s*formatSystemLogDescription,\s*\}\s*from\s*'@\/utils\/systemLogText';/m;
  if (!importBlock.test(auditText)) {
    throw new Error('AuditPanel systemLogText import block was not found.');
  }

  auditText = auditText.replace(
    importBlock,
    (match) =>
      `${match}\nimport SystemLogIcon from '@/components/system/SystemLogIcon';`
  );
}

if (!auditText.includes('<SystemLogIcon item={log} size="sm" />')) {
  const actionCellPattern =
    /<td\s+className="whitespace-nowrap px-4 py-3">\s*<span\s+className=\{`rounded-full border px-2 py-0\.5 text-\[10px\] font-semibold uppercase tracking-wide \$\{actionTone\(log\.action_taken\)\}`\}\s*>\s*\{formatActionLabel\(log\.action_taken\)\}\s*<\/span>\s*<\/td>/m;

  const replacement = `<td className="whitespace-nowrap px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <SystemLogIcon item={log} size="sm" />
                                                <span
                                                    className={\`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide \${actionTone(log.action_taken)}\`}
                                                >
                                                    {formatActionLabel(log.action_taken)}
                                                </span>
                                            </div>
                                        </td>`;

  if (!actionCellPattern.test(auditText)) {
    // Fallback: only wrap the existing action span itself, regardless of indentation.
    const spanPattern =
      /(<span\s+className=\{`rounded-full border px-2 py-0\.5 text-\[10px\] font-semibold uppercase tracking-wide \$\{actionTone\(log\.action_taken\)\}`\}\s*>\s*\{formatActionLabel\(log\.action_taken\)\}\s*<\/span>)/m;

    if (!spanPattern.test(auditText)) {
      throw new Error(
        'Could not find the AuditPanel action label span. Send the current AuditPanel.jsx if this happens.'
      );
    }

    auditText = auditText.replace(
      spanPattern,
      `<div className="flex items-center gap-2">
                                                <SystemLogIcon item={log} size="sm" />
                                                $1
                                            </div>`
    );
  } else {
    auditText = auditText.replace(actionCellPattern, replacement);
  }
}

fs.writeFileSync(auditPanel, auditText, 'utf8');

console.log('\nSMaRT-PDM distinct System Log icons v2 applied.\n');
console.log('Changed/verified:');
console.log('  admin/frontend/src/pages/AdminProfile.jsx');
console.log('  admin/frontend/src/pages/maintenance/AuditPanel.jsx');
console.log('  admin/frontend/src/components/system/SystemLogIcon.jsx');

console.log('\nBackups:');
if (profileBackup) console.log(`  ${profileBackup}`);
if (auditBackup) console.log(`  ${auditBackup}`);
if (componentBackup) console.log(`  ${componentBackup}`);

run('npm', ['run', 'build'], frontend);

console.log('\nPASS: Admin frontend build completed.');
