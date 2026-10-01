const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const preview = read('mobile/frontend/lib/features/applicant/presentation/screens/application_form_preview_screen.dart');
const review = read('mobile/frontend/lib/features/forms/presentation/screens/step_submit_intake.dart');
const status = read('mobile/frontend/lib/features/forms/presentation/screens/status_tracking_screen.dart');

test('Application Details uses user-facing Show more / Show less wording', () => {
  assert.match(status, /_showMore \? 'Show less' : 'Show more'/);
  assert.match(status, /label: 'Application ID'/);
  assert.doesNotMatch(status, /Technical details/);
  assert.doesNotMatch(status, /Application identifiers/);
  assert.doesNotMatch(status, /label: 'Opening ID'/);
});

test('Preview Form keeps the existing edit, realtime, and PDF workflows', () => {
  assert.match(preview, /fetchMySubmittedApplicationForm\(\)/);
  assert.match(preview, /AppRoutes\.newApplicant/);
  assert.match(preview, /'editExistingApplication': true/);
  assert.match(preview, /generateBytesFromMySubmittedApplicationForm\(\)/);
  assert.match(preview, /saveAndOpenDownloadedFile\(/);
  assert.match(preview, /applicationRevision/);
  assert.match(preview, /Timer\.periodic\(const Duration\(seconds: 6\)/);
});

test('Preview Form is a complete student-facing application viewer', () => {
  const requiredRefs = [
    'firstName', 'middleName', 'lastName', 'maidenName', 'dateOfBirth', 'age',
    'sex', 'placeOfBirth', 'citizenship', 'civilStatus', 'religion',
    'unitBldgNo', 'houseLotBlockNo', 'phase', 'street', 'subdivision',
    'barangay', 'city', 'province', 'zipCode', 'landline', 'mobileNumber', 'email',
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
    'aimsAndAmbitionEssay', 'certificationRead', 'agree',
  ];

  for (const field of requiredRefs) {
    assert.match(preview, new RegExp(`data\\.${field}\\b`), `missing Preview field: ${field}`);
  }

  assert.doesNotMatch(preview, /TextFormField\(/);
  assert.doesNotMatch(preview, /TextField\(/);
});

test('Preview sections are collapsible and Personal Information starts expanded', () => {
  assert.match(preview, /_expandedSections = <String>\{'personal'\}/);
  assert.match(preview, /Icons\.keyboard_arrow_down_rounded/);
  assert.match(preview, /AnimatedRotation\(/);
  assert.match(preview, /AnimatedSize\(/);
  assert.match(preview, /sectionKey: 'personal'/);
  assert.match(preview, /sectionKey: 'family'/);
  assert.match(preview, /sectionKey: 'academic'/);
  assert.match(preview, /sectionKey: 'statement'/);
  assert.match(preview, /sectionKey: 'certification'/);
});

test('Preview bottom actions stay compact and responsive', () => {
  assert.match(preview, /final stack = constraints\.maxWidth < 350/);
  assert.match(preview, /'Edit Form'/);
  assert.match(preview, /'Export PDF'/);
  assert.doesNotMatch(preview, /TextOverflow\.ellipsis/);
  assert.doesNotMatch(preview, /AppStatusColors\.of\(context\)\.inProgressContainer/);
});

test('Review and submission are presented as one final user step', () => {
  assert.match(review, /V\. REVIEW & SUBMIT/);
  assert.match(review, /Before you submit/);
  assert.match(review, /Final check/);
  assert.doesNotMatch(review, /VI\. CONFIRM & SUBMIT/);
  assert.match(review, /certificationRead/);
  assert.match(review, /Terms of Service/);
  assert.match(review, /Privacy Statement/);
  assert.match(review, /final consentAccepted = certRead && agreeTerms/);
  assert.match(review, /widget\.data\.certificationRead = accepted;[\s\S]*widget\.data\.agree = accepted;/);
  assert.equal((review.match(/CheckboxListTile\(/g) || []).length, 1);
});

test('Application submission tolerates a slow backend without hiding progress', () => {
  const applicationService = read(
    'mobile/frontend/lib/features/forms/data/services/application_service.dart',
  );
  const applicantScreen = read(
    'mobile/frontend/lib/features/applicant/presentation/screens/new_applicant_screen.dart',
  );

  assert.equal(
    (applicationService.match(/Duration\(seconds: 90\)/g) || []).length,
    2,
  );
  assert.match(applicantScreen, /'Submitting\.\.\.'/);
});
