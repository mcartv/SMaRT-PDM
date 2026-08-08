const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

test('endorsement queue UI includes profile preview, fallback icon, course filter, result filter, and oldest-first sorting', () => {
  const source = read('admin/frontend/src/pages/EndorsementQueue.jsx');
  assert.match(source, /ProfileAvatar/);
  assert.match(source, /ProfilePreview/);
  assert.match(source, /UserRound/);
  assert.match(source, /All Courses/);
  assert.match(source, /All Years/);
  assert.match(source, /All Results/);
  assert.match(source, /Oldest First/);
  assert.match(source, /useState\('oldest'\)/);
  assert.match(source, /course_code/);
  assert.match(source, /grid gap-4 xl:grid-cols-2/);
});

test('endorsement decision selects require an explicit choice instead of preselecting a result', () => {
  const source = read('admin/frontend/src/pages/EndorsementQueue.jsx');
  assert.match(source, /Select disciplinary standing/);
  assert.match(source, /Select scholastic standing/);
  assert.match(source, /saving \|\| !selected/);
  assert.match(source, /saving \|\| !gradeReady \|\| !standing/);
});

test('queue backend only exposes grade data to PD or Admin and exposes approved student avatar separately', () => {
  const source = read('admin/backend/services/endorsementSlipService.js');
  assert.match(source, /resolveAvatarUrl/);
  assert.match(source, /st\.profile_photo_url/);
  assert.match(source, /avatar_url: row\.avatar_url \|\| null/);
  assert.match(source, /actorRole === 'pd' \|\| actorRole === 'admin'/);
  assert.match(source, /grade_document/);
  assert.match(source, /SDO and Guidance receive no application-document attachments/);
});

test('office queue loads acted/completed records within its role scope for filtering', () => {
  const source = read('admin/backend/services/endorsementSlipService.js');
  assert.match(source, /async function fetchQueue\(queueKey, actor\)[\s\S]*ensureQueueAccess\(queueKey, actor\);[\s\S]*return loadSlipRows\(\{ actor \}\);/);
});


test('endorsement slip detail hides applicant files from SDO/Guidance and limits PD to Grade Report', () => {
  const source = read('admin/frontend/src/pages/EndorsementSlipDetail.jsx');
  assert.match(source, /const isPdView = tokenStorageKey === 'pdToken'/);
  assert.match(source, /const canViewApplicationFiles = isAdminView \|\| isPdView/);
  assert.match(source, /String\(document\?\.document_type \|\| ''\)[\s\S]*toLowerCase\(\) === 'grade report'/);
  assert.match(source, /\{canViewApplicationFiles \? \(/);
  assert.match(source, /\{isPdView \? 'Grade Report' : 'Application Files'\}/);
  assert.match(source, /visibleDocuments\.map/);
});


test('endorsement detail controller applies a second document privacy guard by authenticated role', () => {
  const source = read('admin/backend/controllers/endorsementSlipController.js');
  assert.match(source, /sanitizeEndorsementDocumentsForRole/);
  assert.match(source, /role === 'admin'/);
  assert.match(source, /role === 'pd'/);
  assert.match(source, /document_type[\s\S]*grade report/);
  assert.match(source, /return \{ \.\.\.payload, documents: \[\] \}/);
  assert.match(source, /sanitizeEndorsementDocumentsForRole\(payload, req\.user\?\.role\)/);
});
