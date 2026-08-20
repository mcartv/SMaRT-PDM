#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, 'admin', 'frontend', 'src')) && fs.existsSync(path.join(dir, 'admin', 'backend'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not find the SMaRT-PDM repository root.');
}

function backup(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const b = `${file}.bak-friendly-system-log-${stamp}`;
  fs.copyFileSync(file, b);
  return b;
}

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Could not find expected block for ${label}.`);
  return text.replace(from, to);
}

const repo = findRepoRoot(process.cwd());
const adminProfile = path.join(repo, 'admin/frontend/src/pages/AdminProfile.jsx');
const auditPanel = path.join(repo, 'admin/frontend/src/pages/maintenance/AuditPanel.jsx');
const utilityDir = path.join(repo, 'admin/frontend/src/utils');
const utilityFile = path.join(utilityDir, 'systemLogText.js');

for (const file of [adminProfile, auditPanel]) if (!fs.existsSync(file)) throw new Error(`Required file not found: ${file}`);

const utilityContent = `const TECHNICAL_ACTION_LABELS = Object.freeze({
    RUNAPPLICATIONDOCUMENTIOTOCR: 'Start OCR Scan',
    RETRYAPPLICATIONDOCUMENTIOTOCR: 'Retry OCR Scan',
    CANCELAPPLICATIONDOCUMENTIOTOCR: 'Cancel OCR Scan',
    CONFIRMAPPLICATIONDOCUMENTIOTOCR: 'Confirm OCR Result',
    REJECTAPPLICATIONDOCUMENTIOTOCR: 'Reject OCR Result',
    RESCANAPPLICATIONDOCUMENTIOTOCR: 'Request OCR Rescan',
    SAVEAPPLICATIONDOCUMENTOCRSNAPSHOT: 'Save OCR Result',
});

const TECHNICAL_DESCRIPTION_RULES = [
    { pattern: /retryApplicationDocumentIotOcr/i, text: 'Requested another OCR scan for an application document.' },
    { pattern: /runApplicationDocumentIotOcr/i, text: 'Started OCR scanning for an application document.' },
    { pattern: /cancelApplicationDocumentIotOcr/i, text: 'Cancelled the OCR scan request for an application document.' },
    { pattern: /confirmApplicationDocumentIotOcr/i, text: 'Confirmed the OCR result for an application document.' },
    { pattern: /rejectApplicationDocumentIotOcr/i, text: 'Rejected the OCR result for an application document.' },
    { pattern: /rescanApplicationDocumentIotOcr/i, text: 'Requested a new OCR scan for an application document.' },
    { pattern: /saveApplicationDocumentOcrSnapshot/i, text: 'Saved the OCR result for an application document.' },
];

const ACRONYMS = Object.freeze({ api: 'API', id: 'ID', iot: 'IoT', ocr: 'OCR', otp: 'OTP', pdf: 'PDF', ro: 'RO', sdo: 'SDO' });

function compactActionKey(value = '') {
    return String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

function titleWord(word = '') {
    const normalized = String(word || '').toLowerCase();
    if (ACRONYMS[normalized]) return ACRONYMS[normalized];
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '';
}

function splitTechnicalWords(value = '') {
    return String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\\s+/g, ' ').trim();
}

export function formatSystemLogActionLabel(action = '') {
    const exact = TECHNICAL_ACTION_LABELS[compactActionKey(action)];
    if (exact) return exact;
    return splitTechnicalWords(action).split(' ').filter(Boolean).map(titleWord).join(' ') || 'System Action';
}

function isTechnicalDescription(value = '') {
    const text = String(value || '').trim();
    if (!text) return false;
    return /[a-z0-9][A-Z][A-Za-z0-9]*/.test(text) || /\\b(?:applicationDocument|iotOcr|requestId|documentKey|actionTaken)\\b/i.test(text) || /\\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\\b/.test(text);
}

function sentenceFromAction(item = {}) {
    const action = String(item.action_taken || '').trim();
    const key = compactActionKey(action);
    const moduleName = String(item.module || '').trim();
    if (key === 'LOGINSUCCESS') return 'Signed in successfully.';
    if (key === 'LOGOUT') return 'Signed out successfully.';
    if (key === 'PASSWORDRESET') return 'Reset the account password.';
    if (key === 'IMPORTSTUDENTREGISTRY') return 'Imported student registry records.';
    const label = formatSystemLogActionLabel(action);
    if (label === 'System Action') return moduleName ? moduleName + ' activity was completed successfully.' : 'System activity was completed successfully.';
    return label + ' was completed successfully.';
}

export function formatSystemLogDescription(item = {}) {
    const description = String(item.description || '').trim();
    const action = String(item.action_taken || '').trim();
    const combined = action + ' ' + description;
    for (const rule of TECHNICAL_DESCRIPTION_RULES) if (rule.pattern.test(combined)) return rule.text;
    if (description && !isTechnicalDescription(description)) return description;
    return sentenceFromAction(item);
}
`;

fs.mkdirSync(utilityDir, { recursive: true });
if (fs.existsSync(utilityFile)) backup(utilityFile);
fs.writeFileSync(utilityFile, utilityContent, 'utf8');

let profileText = fs.readFileSync(adminProfile, 'utf8');
const profileBackup = backup(adminProfile);
if (!profileText.includes("from '@/utils/systemLogText';")) {
  profileText = replaceOnce(profileText, "import { useSocketEvent } from '@/hooks/useSocket';", "import { useSocketEvent } from '@/hooks/useSocket';\nimport { formatSystemLogDescription } from '@/utils/systemLogText';", 'AdminProfile import');
}
const profileStart = profileText.indexOf('function formatAuditAction(item = {}) {');
const sectionStart = profileText.indexOf('function SectionCard', profileStart);
if (profileStart < 0 || sectionStart < 0) throw new Error('AdminProfile formatAuditAction block not found.');
profileText = profileText.slice(0, profileStart) + "function formatAuditAction(item = {}) {\n    return formatSystemLogDescription(item);\n}\n\n" + profileText.slice(sectionStart);
fs.writeFileSync(adminProfile, profileText, 'utf8');

let auditText = fs.readFileSync(auditPanel, 'utf8');
const auditBackup = backup(auditPanel);
if (!auditText.includes("from '@/utils/systemLogText';")) {
  auditText = replaceOnce(auditText, "import { useSocketEvent } from '@/hooks/useSocket';", "import { useSocketEvent } from '@/hooks/useSocket';\nimport {\n    formatSystemLogActionLabel,\n    formatSystemLogDescription,\n} from '@/utils/systemLogText';", 'AuditPanel import');
}
const actionStart = auditText.indexOf("function formatActionLabel(action = '') {");
const toneStart = auditText.indexOf('function actionTone', actionStart);
if (actionStart < 0 || toneStart < 0) throw new Error('AuditPanel formatActionLabel block not found.');
auditText = auditText.slice(0, actionStart) + "function formatActionLabel(action = '') {\n    return formatSystemLogActionLabel(action);\n}\n\n" + auditText.slice(toneStart);
auditText = replaceOnce(auditText, "{log.description || '-'}", '{formatSystemLogDescription(log)}', 'AuditPanel description');
fs.writeFileSync(auditPanel, auditText, 'utf8');

console.log('\nFriendly System Logs wording fix applied.');
console.log('Changed:');
console.log('  admin/frontend/src/pages/AdminProfile.jsx');
console.log('  admin/frontend/src/pages/maintenance/AuditPanel.jsx');
console.log('  admin/frontend/src/utils/systemLogText.js');
console.log('\nBackups:');
console.log('  ' + profileBackup);
console.log('  ' + auditBackup);
console.log('\nNext: cd admin\\frontend && npm run build');
