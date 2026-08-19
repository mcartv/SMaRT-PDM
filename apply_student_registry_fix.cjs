'use strict';
const fs=require('node:fs');
const path=require('node:path');
const projectRoot=path.resolve(process.argv[2]||process.cwd());
const servicePath=path.join(projectRoot,'admin','backend','services','studentRegistryService.js');
const testPath=path.join(projectRoot,'admin','backend','test','student-registry-snapshot-display-regression.test.js');
if(!fs.existsSync(servicePath)) throw new Error(`Missing file: ${servicePath}`);
const backup=`${servicePath}.before-student-registry-snapshot-display-fix`;
if(!fs.existsSync(backup)){fs.copyFileSync(servicePath,backup);console.log(`Backup: ${backup}`);}
let source=fs.readFileSync(servicePath,'utf8');
const marker='async function listStudentRegistry({ limit = 50, offset = 0 } = {}) {';
const helper=`
function getSnapshotValue(snapshot, headers = []) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  for (const header of headers) {
    const value = snapshot[header];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  const entries = Object.entries(snapshot).map(([key, value]) => [normalizeLookupValue(key), value]);
  for (const header of headers) {
    const wanted = normalizeLookupValue(header);
    const found = entries.find(([key]) => key === wanted);
    if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') return found[1];
  }
  return null;
}

function hydrateRegistryRowFromSnapshot(row) {
  const snapshot = row?.raw_snapshot || {};
  return {
    ...row,
    given_name: row?.given_name || getSnapshotValue(snapshot, ['First Name']),
    middle_name: row?.middle_name || getSnapshotValue(snapshot, ['Middle Name']),
    last_name: row?.last_name || getSnapshotValue(snapshot, ['Surname', 'Last Name']),
    sex_at_birth: row?.sex_at_birth || getSnapshotValue(snapshot, ['Sex', 'Sex at Birth']),
    religion: row?.religion || getSnapshotValue(snapshot, ['Religion']),
    date_of_birth: row?.date_of_birth || getSnapshotValue(snapshot, ['Date of Birth','Birthday','Birthdate']),
    age: row?.age ?? getSnapshotValue(snapshot, ['Age']),
    place_of_birth: row?.place_of_birth || getSnapshotValue(snapshot, ['Place of Birth','Birthplace']),
    civil_status: row?.civil_status || getSnapshotValue(snapshot, ['Civil Status']),
    phone_number: row?.phone_number || getSnapshotValue(snapshot, ['Personal Number','Phone Number','Contact Number','Mobile Number']),
    email_address: row?.email_address || getSnapshotValue(snapshot, ['Email Address','Email']),
    suffix: getSnapshotValue(snapshot, ['Suffix']),
    height_m: getSnapshotValue(snapshot, ['Height (m)','Height']),
    weight_kg: getSnapshotValue(snapshot, ['Weight (kg)','Weight']),
    nationality: getSnapshotValue(snapshot, ['Nationality']),
    present_address: getSnapshotValue(snapshot, ['Present Address']),
    present_zip_code: getSnapshotValue(snapshot, ['Present ZIP Code','Present Zip Code','Present Postal Code']),
    permanent_address: getSnapshotValue(snapshot, ['Permanent Address']),
    permanent_zip_code: getSnapshotValue(snapshot, ['Permanent ZIP Code','Permanent Zip Code','Permanent Postal Code']),
    emergency_contact_person: getSnapshotValue(snapshot, ['Emergency Contact Person']),
    relationship: getSnapshotValue(snapshot, ['Relationship']),
    emergency_address: getSnapshotValue(snapshot, ['Emergency Address']),
    emergency_contact_no: getSnapshotValue(snapshot, ['Emergency Contact No.','Emergency Contact No','Emergency Contact Number']),
    father_name: getSnapshotValue(snapshot, ['Father Name']),
    father_address: getSnapshotValue(snapshot, ['Father Address']),
    father_birthday: getSnapshotValue(snapshot, ['Father Birthday']),
    father_age: getSnapshotValue(snapshot, ['Father Age']),
    father_contact: getSnapshotValue(snapshot, ['Father Contact']),
    father_educational_attainment: getSnapshotValue(snapshot, ['Father Educational Attainment']),
    father_occupation: getSnapshotValue(snapshot, ['Father Occupation']),
    father_living_vital_status: getSnapshotValue(snapshot, ['Father Living/Vital Status']),
    mother_name: getSnapshotValue(snapshot, ['Mother Name']),
    mother_address: getSnapshotValue(snapshot, ['Mother Address']),
    mother_birthday: getSnapshotValue(snapshot, ['Mother Birthday']),
    mother_age: getSnapshotValue(snapshot, ['Mother Age']),
    mother_contact: getSnapshotValue(snapshot, ['Mother Contact']),
    mother_educational_attainment: getSnapshotValue(snapshot, ['Mother Educational Attainment']),
    mother_occupation: getSnapshotValue(snapshot, ['Mother Occupation']),
    mother_living_vital_status: getSnapshotValue(snapshot, ['Mother Living/Vital Status']),
    elem_school: getSnapshotValue(snapshot, ['Elem School']),
    elem_inclusive_year: getSnapshotValue(snapshot, ['Elem Inclusive Year']),
    elem_address: getSnapshotValue(snapshot, ['Elem Address']),
    elem_lrn: getSnapshotValue(snapshot, ['Elem LRN']),
    hs_old_curriculum_school: getSnapshotValue(snapshot, ['HS Old Curriculum School']),
    hs_old_curriculum_year: getSnapshotValue(snapshot, ['HS Old Curriculum Year']),
    hs_old_curriculum_address: getSnapshotValue(snapshot, ['HS Old Curriculum Address']),
    hs_old_curriculum_lrn: getSnapshotValue(snapshot, ['HS Old Curriculum LRN']),
    grade_7_10_school: getSnapshotValue(snapshot, ['Grade 7-10 School']),
    grade_7_10_year: getSnapshotValue(snapshot, ['Grade 7-10 Year']),
    grade_7_10_address: getSnapshotValue(snapshot, ['Grade 7-10 Address']),
    grade_7_10_lrn: getSnapshotValue(snapshot, ['Grade 7-10 LRN']),
    grade_11_12_school: getSnapshotValue(snapshot, ['Grade 11-12 School']),
    grade_11_12_year: getSnapshotValue(snapshot, ['Grade 11-12 Year']),
    grade_11_12_address: getSnapshotValue(snapshot, ['Grade 11-12 Address']),
    grade_11_12_lrn: getSnapshotValue(snapshot, ['Grade 11-12 LRN']),
    als_graduate: getSnapshotValue(snapshot, ['ALS Graduate']),
    previous_college: getSnapshotValue(snapshot, ['Previous College']),
    previous_course: getSnapshotValue(snapshot, ['Previous Course']),
    previous_inclusive_year: getSnapshotValue(snapshot, ['Previous Inclusive Year']),
    previous_address: getSnapshotValue(snapshot, ['Previous Address']),
  };
}

`;
if(!source.includes('function hydrateRegistryRowFromSnapshot(row)')){
  const i=source.indexOf(marker); if(i<0) throw new Error('listStudentRegistry insertion point not found.');
  source=source.slice(0,i)+helper+source.slice(i);
}
if(!source.includes('items: (data || []).map(hydrateRegistryRowFromSnapshot),')){
  if(!source.includes('items: data || [],')) throw new Error('Registry return block not found.');
  source=source.replace('items: data || [],','items: (data || []).map(hydrateRegistryRowFromSnapshot),');
}
fs.writeFileSync(servicePath,source,'utf8');

fs.mkdirSync(path.dirname(testPath),{recursive:true});
fs.writeFileSync(testPath,`'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','..');
const service=fs.readFileSync(path.join(root,'backend/services/studentRegistryService.js'),'utf8');

test('registry exposes raw snapshot fields expected by the frontend',()=>{
  assert.match(service,/function hydrateRegistryRowFromSnapshot\\(row\\)/);
  assert.match(service,/height_m:\\s*getSnapshotValue/);
  assert.match(service,/weight_kg:\\s*getSnapshotValue/);
  assert.match(service,/nationality:\\s*getSnapshotValue/);
  assert.match(service,/suffix:\\s*getSnapshotValue/);
  assert.match(service,/items:\\s*\\(data \\|\\| \\[\\]\\)\\.map\\(hydrateRegistryRowFromSnapshot\\)/);
});

test('same student number still upserts corrected names instead of duplicating',()=>{
  assert.match(service,/onConflict:\\s*'student_number'/);
  assert.match(service,/ignoreDuplicates:\\s*false/);
  assert.match(service,/first_name:\\s*row\\.given_name/);
  assert.match(service,/last_name:\\s*row\\.last_name/);
});
`,'utf8');

console.log('Student Registry fix applied.');
console.log('No database migration required.');
