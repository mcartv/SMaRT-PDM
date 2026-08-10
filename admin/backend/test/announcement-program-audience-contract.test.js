const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('announcement schema supports a program target without hardcoding each scholarship program', () => {
  const migration = read('supabase/migrations/20260810191600_add_program_targeted_announcements.sql');

  assert.match(migration, /ADD COLUMN IF NOT EXISTS target_program_id uuid/i);
  assert.match(migration, /REFERENCES public\.scholarship_program\(program_id\)/i);
  assert.match(migration, /'program'::varchar/i);
  assert.match(migration, /target_audience = 'program' AND target_program_id IS NOT NULL/i);
});

test('admin announcement composer loads active Maintenance programs and submits the selected program id', () => {
  const source = read('admin/frontend/src/pages/AnnouncementsManagement.jsx');

  assert.match(source, /\/api\/scholarship-program/);
  assert.match(source, /programAudienceValue\(program\.program_id\)/);
  assert.match(source, /label: `\$\{program\.program_name\} Recipients`/);
  assert.match(source, /audience: audienceTarget\.audience/);
  assert.match(source, /programId: audienceTarget\.programId/);
});

test('announcement notification routing targets only active current scholars for program recipients', () => {
  const source = read('admin/backend/services/notificationService.js');

  assert.match(source, /s\.current_program_id = \$\$\{params\.length\}/);
  assert.match(source, /coalesce\(s\.is_active_scholar, false\) = true/i);
  assert.match(source, /lower\(coalesce\(s\.scholarship_status, ''\)\) = 'active'/i);
  assert.match(source, /coalesce\(s\.scholar_is_archived, false\) = false/i);
  assert.match(source, /normalizedAudience === 'program'/);
});

test('All Students is limited to applicants plus active scholars instead of all user accounts', () => {
  const source = read('admin/backend/services/notificationService.js');

  assert.match(source, /getApplicantAudienceUsers\(\)/);
  assert.match(source, /getActiveScholarAudienceUsers\(\)/);
  assert.match(source, /dedupeAudienceUsers\(\[\.\.\.applicants, \.\.\.scholars\]\)/);
  assert.doesNotMatch(source, /all:\s*null/);
});

test('mobile announcement feed enforces the same program recipient boundary', () => {
  const source = read('backend/src/services/announcementService.js');

  assert.match(source, /target_program_id/);
  assert.match(source, /context\.isActiveScholar/);
  assert.match(source, /String\(context\.currentProgramId\) === String\(row\.target_program_id/);
  assert.match(source, /context\.isApplicant \|\| context\.isActiveScholar/);
});
