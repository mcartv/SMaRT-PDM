'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const status = read('mobile/frontend/lib/features/forms/presentation/screens/status_tracking_screen.dart');
const family = read('mobile/frontend/lib/features/forms/presentation/screens/step_family_intake.dart');
const review = read('mobile/frontend/lib/features/forms/presentation/screens/step_submit_intake.dart');
const openings = read('mobile/frontend/lib/features/applicant/presentation/screens/scholarship_openings_screen.dart');

test('Application Details rows use the full card width instead of centering', () => {
  const start = status.indexOf('class _ApplicationDetailsCardState');
  const end = status.indexOf('class _SectionHeading', start);
  assert.ok(start >= 0 && end > start);
  const block = status.slice(start, end);
  assert.match(block, /crossAxisAlignment: CrossAxisAlignment\.stretch/);
  assert.match(block, /_StatusDetailRow\(label: 'Program'/);
  assert.match(block, /_showMore \? 'Show less' : 'Show more'/);
});

test('guardian copy shortcuts live inside the Guardian Details card', () => {
  assert.match(family, /Widget\? helperActions/);
  assert.match(family, /title: 'Guardian\\'s Details',[\s\S]*helperActions: Wrap\(/);
  assert.match(family, /child: Text\('Use \$relation'\)/);
  assert.match(family, /minimumSize: const Size\(0, 52\)/);
});

test('Review & Submit exposes every application field group in collapsible cards', () => {
  const requiredFields = [
    'firstName', 'middleName', 'lastName', 'maidenName', 'dateOfBirth', 'age',
    'sex', 'placeOfBirth', 'citizenship', 'civilStatus', 'religion', 'unitBldgNo',
    'houseLotBlockNo', 'phase', 'street', 'subdivision', 'barangay', 'city',
    'province', 'zipCode', 'landline', 'mobileNumber', 'email',
    'parentGuardianAddress', 'fatherFirstName', 'fatherMiddleName', 'fatherLastName',
    'fatherMobile', 'fatherEducationalAttainment', 'fatherOccupation',
    'fatherCompanyNameAndAddress', 'motherFirstName', 'motherMiddleName',
    'motherLastName', 'motherMobile', 'motherEducationalAttainment',
    'motherOccupation', 'motherCompanyNameAndAddress', 'siblingFirstName',
    'siblingMiddleName', 'siblingLastName', 'siblingMobile',
    'siblingEducationalAttainment', 'siblingOccupation',
    'siblingCompanyNameAndAddress', 'guardianFirstName', 'guardianMiddleName',
    'guardianLastName', 'guardianMobile', 'guardianEducationalAttainment',
    'guardianOccupation', 'guardianCompanyNameAndAddress', 'parentNativeStatus',
    'parentMarilaoResidencyDuration', 'parentPreviousTownMunicipality',
    'parentPreviousProvince', 'collegeSchool', 'collegeAddress', 'collegeHonors',
    'collegeClub', 'collegeYearGraduated', 'highSchoolSchool', 'highSchoolAddress',
    'highSchoolHonors', 'highSchoolClub', 'highSchoolYearGraduated',
    'seniorHighSchool', 'seniorHighAddress', 'seniorHighHonors', 'seniorHighClub',
    'seniorHighYearGraduated', 'elementarySchool', 'elementaryAddress',
    'elementaryHonors', 'elementaryClub', 'elementaryYearGraduated',
    'currentCourse', 'currentYearLevel', 'currentSection', 'studentNumber',
    'learnersReferenceNumber', 'gwa', 'financialSupport',
    'financialSupportOtherSpecify', 'scholarshipHistory', 'scholarshipDetails',
    'disciplinaryAction', 'disciplinaryExplanation', 'describeYourselfEssay',
    'aimsAndAmbitionEssay',
  ];

  for (const field of requiredFields) {
    assert.match(review, new RegExp(`data\\.${field}\\b`), `missing review field: ${field}`);
  }

  assert.match(review, /_expandedSections = <String>\{'personal'\}/);
  assert.match(review, /sectionKey: 'personal'/);
  assert.match(review, /sectionKey: 'family'/);
  assert.match(review, /sectionKey: 'academic'/);
  assert.match(review, /sectionKey: 'statement'/);
});

test('Applicant opening cards no longer show Supported by benefactor copy', () => {
  assert.doesNotMatch(openings, /Supported by/);
});
