'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','..');
const service=fs.readFileSync(path.join(root,'backend/services/studentRegistryService.js'),'utf8');

test('registry exposes raw snapshot fields expected by the frontend',()=>{
  assert.match(service,/function hydrateRegistryRowFromSnapshot\(row\)/);
  assert.match(service,/height_m:\s*getSnapshotValue/);
  assert.match(service,/weight_kg:\s*getSnapshotValue/);
  assert.match(service,/nationality:\s*getSnapshotValue/);
  assert.match(service,/suffix:\s*getSnapshotValue/);
  assert.match(service,/items:\s*\(data \|\| \[\]\)\.map\(hydrateRegistryRowFromSnapshot\)/);
});

test('same student number still upserts corrected names instead of duplicating',()=>{
  assert.match(service,/onConflict:\s*'student_number'/);
  assert.match(service,/ignoreDuplicates:\s*false/);
  assert.match(service,/first_name:\s*row\.given_name/);
  assert.match(service,/last_name:\s*row\.last_name/);
});
