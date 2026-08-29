#!/usr/bin/env node
'use strict';

const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const supabase = require('../src/config/supabase');

const apply = process.argv.includes('--apply');
const AVATAR_BUCKET = 'avatars';

function normalizeStoragePath(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  if (!/^https?:\/\//i.test(raw)) {
    return raw.replace(/^avatars\//, '').replace(/^\/+/, '');
  }

  for (const marker of [
    '/storage/v1/object/public/avatars/',
    '/storage/v1/object/sign/avatars/',
    '/storage/v1/object/authenticated/avatars/',
  ]) {
    const index = raw.indexOf(marker);
    if (index >= 0) {
      return raw.slice(index + marker.length).split('?')[0];
    }
  }

  return null;
}

async function listAll(prefix = '') {
  const rows = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .list(prefix, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) throw error;

    const batch = data || [];
    rows.push(...batch);

    if (batch.length < limit) break;
    offset += limit;
  }

  return rows;
}

async function collectAvatarObjects() {
  const roots = await listAll('');
  const paths = [];

  for (const root of roots) {
    const rootName = String(root?.name || '').trim();
    if (!rootName) continue;

    // Current SMaRT-PDM avatar layout:
    //   <userId>/avatar/<timestamp>-<file>
    const avatarPrefix = `${rootName}/avatar`;

    let children;
    try {
      children = await listAll(avatarPrefix);
    } catch (_) {
      continue;
    }

    for (const child of children) {
      if (!child?.id || !child?.name) continue;

      paths.push({
        path: `${avatarPrefix}/${child.name}`,
        size: Number(child?.metadata?.size || 0),
      });
    }
  }

  return paths;
}

async function collectReferencedAvatarPaths() {
  const [studentsResult, reviewsResult] = await Promise.all([
    supabase
      .from('students')
      .select('profile_photo_url')
      .not('profile_photo_url', 'is', null),
    supabase
      .from('profile_photo_reviews')
      .select('storage_path')
      .not('storage_path', 'is', null),
  ]);

  if (studentsResult.error) throw studentsResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  return new Set(
    [
      ...(studentsResult.data || []).map((row) => row.profile_photo_url),
      ...(reviewsResult.data || []).map((row) => row.storage_path),
    ]
      .map(normalizeStoragePath)
      .filter(Boolean)
  );
}

async function main() {
  const [objects, referenced] = await Promise.all([
    collectAvatarObjects(),
    collectReferencedAvatarPaths(),
  ]);

  const orphans = objects.filter((item) => !referenced.has(item.path));
  const orphanBytes = orphans.reduce((sum, item) => sum + item.size, 0);

  console.log('Avatar storage audit');
  console.log('  objects:', objects.length);
  console.log('  referenced paths:', referenced.size);
  console.log('  orphan objects:', orphans.length);
  console.log('  orphan bytes:', orphanBytes);

  for (const orphan of orphans) {
    console.log(
      `  - ${orphan.path} (${orphan.size || 0} bytes)`
    );
  }

  if (!apply) {
    console.log('');
    console.log('Dry run only. Nothing was deleted.');
    console.log(
      'Run with --apply only after reviewing the orphan list.'
    );
    return;
  }

  for (let index = 0; index < orphans.length; index += 100) {
    const paths = orphans
      .slice(index, index + 100)
      .map((item) => item.path);

    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .remove(paths);

    if (error) throw error;
  }

  console.log('');
  console.log(`Deleted ${orphans.length} orphan avatar object(s).`);
}

main().catch((error) => {
  console.error('AVATAR STORAGE CLEANUP ERROR:', error);
  process.exitCode = 1;
});
