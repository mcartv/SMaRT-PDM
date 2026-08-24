#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

function findRepo(start) {
  let dir = path.resolve(start);
  while (true) {
    const required = [
      path.join(dir, 'mobile', 'frontend', 'lib', 'shared', 'models', 'app_data.dart'),
      path.join(dir, 'mobile', 'frontend', 'lib', 'shared', 'models', 'saved_application_print_model.dart'),
      path.join(dir, 'mobile', 'frontend', 'lib', 'features', 'applicant', 'presentation', 'screens', 'application_form_preview_screen.dart'),
      path.join(dir, 'mobile', 'backend', 'src', 'services', 'applicationService.js'),
    ];
    if (required.every(fs.existsSync)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not find SMaRT-PDM repo root. Run from D:\\projects\\SMaRT-PDM.');
}

function normalize(s) { return s.replace(/\r\n/g, '\n'); }
function restoreEol(s, crlf) { return crlf ? s.replace(/\n/g, '\r\n') : s; }

function replaceOnce(text, oldText, newText, label) {
  if (text.includes(newText)) return text;
  const count = text.split(oldText).length - 1;
  if (count !== 1) {
    throw new Error(`Preflight failed for ${label}: expected 1 match, found ${count}. No project files were written.`);
  }
  return text.replace(oldText, newText);
}

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} failed with exit code ${r.status}.`);
}

const repo = findRepo(process.cwd());
const frontend = path.join(repo, 'mobile', 'frontend');
const backend = path.join(repo, 'mobile', 'backend');

const files = {
  appData: path.join(frontend, 'lib', 'shared', 'models', 'app_data.dart'),
  printModel: path.join(frontend, 'lib', 'shared', 'models', 'saved_application_print_model.dart'),
  preview: path.join(frontend, 'lib', 'features', 'applicant', 'presentation', 'screens', 'application_form_preview_screen.dart'),
  backend: path.join(backend, 'src', 'services', 'applicationService.js'),
  flutterTest: path.join(frontend, 'test', 'pdf_missing_data_retrieval_regression_test.dart'),
  backendTest: path.join(backend, 'test', 'submitted-form-pdf-backfill-contract.test.js'),
};

const originals = {};
const crlf = {};
for (const key of ['appData', 'printModel', 'preview', 'backend']) {
  originals[key] = fs.readFileSync(files[key], 'utf8');
  crlf[key] = originals[key].includes('\r\n');
}

let appData = normalize(originals.appData);
let printModel = normalize(originals.printModel);
let preview = normalize(originals.preview);
let backendSource = normalize(originals.backend);

/* ---------- PRECHECK ---------- */
const markers = [
  [appData, 'void applySavedForm(Map<String, dynamic> payload)', 'ApplicationData loader'],
  [appData, 'Map<String, dynamic> toSubmissionPayload()', 'ApplicationData serializer'],
  [printModel, 'factory SavedApplicationPrintModel.fromSavedFormData(', 'PDF print model'],
  [preview, 'fetchMySubmittedApplicationForm()', 'submitted-form preview'],
  [preview, 'generateBytesFromSubmissionPayload(', 'PDF byte export'],
  [backendSource, 'function mergeMissingSubmissionValues(primary, fallback)', 'backend deep merge'],
  [backendSource, 'async function getMySubmittedFormData(userId)', 'submitted-form backend'],
];

for (const [source, marker, label] of markers) {
  if (!source.includes(marker)) {
    throw new Error(`Preflight failed: ${label} marker missing. No project files were written.`);
  }
}

/* ---------- APP DATA: preserve LRN + textual Year Level ---------- */
if (!appData.includes("String learnersReferenceNumber = '';")) {
  appData = replaceOnce(
    appData,
    "  String studentNumber = '';\n  String gwa = '';",
    "  String studentNumber = '';\n  String learnersReferenceNumber = '';\n  String gwa = '';",
    'ApplicationData LRN state'
  );
}

if (!appData.includes("(value) => learnersReferenceNumber = value")) {
  appData = replaceOnce(
    appData,
    `    if (studentNumber.trim().isEmpty && accountStudentId.trim().isNotEmpty) {
      studentNumber = accountStudentId;
    }

    final savedOpeningId = _savedString(opening['opening_id']);`,
    `    if (studentNumber.trim().isEmpty && accountStudentId.trim().isNotEmpty) {
      studentNumber = accountStudentId;
    }
    _setIfPresent(
      (value) => learnersReferenceNumber = value,
      _firstSavedString(academic, [
        'lrn',
        'learners_reference_number',
      ]),
    );

    final savedOpeningId = _savedString(opening['opening_id']);`,
    'ApplicationData LRN hydration'
  );
}

if (!appData.includes("'lrn': learnersReferenceNumber.trim()")) {
  appData = replaceOnce(
    appData,
    `        'current_course_code': currentCourse.trim(),
        'current_year_level': _parseInt(currentYearLevel),
        'current_section': _title(currentSection),
        'student_number': studentNumber.trim(),
        'gwa': gwa.trim(),`,
    `        'current_course_code': currentCourse.trim(),
        'current_year_level': currentYearLevel.trim(),
        'year_level': currentYearLevel.trim(),
        'current_section': _title(currentSection),
        'student_number': studentNumber.trim(),
        'lrn': learnersReferenceNumber.trim(),
        'learners_reference_number': learnersReferenceNumber.trim(),
        'gwa': gwa.trim(),`,
    'ApplicationData LRN/year-level serialization'
  );
}

/* ---------- PREVIEW: export the persisted raw form, not a lossy rebuilt map ---------- */
if (!preview.includes('Map<String, dynamic> _submittedFormPayload = const {};')) {
  preview = replaceOnce(
    preview,
    `  ApplicationData? _data;
  Map<String, dynamic> _application = const {};
  bool _canEdit = false;`,
    `  ApplicationData? _data;
  Map<String, dynamic> _application = const {};
  Map<String, dynamic> _submittedFormPayload = const {};
  bool _canEdit = false;`,
    'raw submitted form state'
  );
}

if (
  !preview.includes(
    `_data = null;
          _application = const {};
          _submittedFormPayload = const {};
          _canEdit = false;`
  )
) {
  preview = replaceOnce(
    preview,
    `          _data = null;
          _application = const {};
          _canEdit = false;`,
    `          _data = null;
          _application = const {};
          _submittedFormPayload = const {};
          _canEdit = false;`,
    'clear raw submitted form'
  );
}

if (!preview.includes('_submittedFormPayload = rawForm;')) {
  preview = replaceOnce(
    preview,
    `        _data = data;
        _application = rawApplication;
        _canEdit = editability['can_edit'] == true;`,
    `        _data = data;
        _application = rawApplication;
        _submittedFormPayload = rawForm;
        _canEdit = editability['can_edit'] == true;`,
    'retain raw submitted form'
  );
}

if (!preview.includes('final payload = Map<String, dynamic>.from(_submittedFormPayload);')) {
  preview = replaceOnce(
    preview,
    `    try {
      final bytes = await _pdfService.generateBytesFromSubmissionPayload(
        data.toSubmissionPayload(),
      );`,
    `    try {
      final payload = Map<String, dynamic>.from(_submittedFormPayload);
      final existingApplication = Map<String, dynamic>.from(
        payload['application'] as Map? ?? const {},
      );
      payload['application'] = {
        ...existingApplication,
        ..._application,
      };

      final bytes = await _pdfService.generateBytesFromSubmissionPayload(
        payload,
      );`,
    'persisted payload PDF export'
  );
}

/* ---------- BACKEND: normalized fallback without drafts ---------- */
if (!backendSource.includes('async function getMyFormData(userId, options = {})')) {
  backendSource = replaceOnce(
    backendSource,
    `async function getMyFormData(userId) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const user = await getUser(userId);`,
    `async function getMyFormData(userId, options = {}) {
    if (!userId) {
        throw createHttpError(401, 'Authentication required.');
    }

    const includeDraft = options?.includeDraft !== false;
    const user = await getUser(userId);`,
    'getMyFormData options'
  );
}

if (!backendSource.includes('const draft = includeDraft')) {
  backendSource = replaceOnce(
    backendSource,
    `    const draft = await getDraft(userId);
    const draftPayload = draft?.payload && typeof draft.payload === 'object'`,
    `    const draft = includeDraft
        ? await getDraft(userId)
        : null;
    const draftPayload = draft?.payload && typeof draft.payload === 'object'`,
    'draft-free normalized fallback'
  );
}

if (!backendSource.includes('const normalizedFormData = await getMyFormData(')) {
  backendSource = replaceOnce(
    backendSource,
    `    let formData = application.application_payload;

    if (
        !formData ||
        typeof formData !== 'object' ||
        Array.isArray(formData)
    ) {
        formData = await getMyFormData(userId);
    }

    const opening = openingResult.data || {};
`,
    `    const normalizedFormData = await getMyFormData(
        userId,
        { includeDraft: false }
    );

    let formData = application.application_payload;

    if (
        !formData ||
        typeof formData !== 'object' ||
        Array.isArray(formData)
    ) {
        formData = normalizedFormData || {};
    } else {
        formData = mergeMissingSubmissionValues(
            formData,
            normalizedFormData || {}
        );
    }

    const formApplication =
        formData.application &&
        typeof formData.application === 'object' &&
        !Array.isArray(formData.application)
            ? formData.application
            : {};

    formData = {
        ...formData,
        application: {
            ...formApplication,
            application_id: application.application_id,
            application_status: application.application_status || null,
            document_status: application.document_status || null,
            verification_status: application.verification_status || null,
            submission_date: application.submission_date || null,
            selection_status: application.selection_status || null,
        },
    };

    const opening = openingResult.data || {};
`,
    'submitted-form normalized backfill'
  );
}

/* ---------- PRINT MODEL: tolerate layout patch applied OR not ---------- */
if (!printModel.includes('final bool scholarshipElementary;')) {
  printModel = replaceOnce(
    printModel,
    `    required this.hadScholarship,
    required this.noScholarshipHistory,
    required this.scholarshipDetails,`,
    `    required this.hadScholarship,
    required this.noScholarshipHistory,
    this.scholarshipElementary = false,
    this.scholarshipHighSchool = false,
    this.scholarshipCollege = false,
    this.scholarshipOthers = false,
    this.scholarshipOthersSpecify = '',
    required this.scholarshipDetails,`,
    'scholarship checkbox constructor fields'
  );

  printModel = replaceOnce(
    printModel,
    `  final bool hadScholarship;
  final bool noScholarshipHistory;
  final String scholarshipDetails;`,
    `  final bool hadScholarship;
  final bool noScholarshipHistory;
  final bool scholarshipElementary;
  final bool scholarshipHighSchool;
  final bool scholarshipCollege;
  final bool scholarshipOthers;
  final String scholarshipOthersSpecify;
  final String scholarshipDetails;`,
    'scholarship checkbox field declarations'
  );

  printModel = replaceOnce(
    printModel,
    `      hadScholarship: profile['has_prior_scholarship'] == true,
      noScholarshipHistory: profile['has_prior_scholarship'] != true,
      scholarshipDetails: _string(profile['prior_scholarship_details']),`,
    `      hadScholarship: profile['has_prior_scholarship'] == true,
      noScholarshipHistory: profile['has_prior_scholarship'] != true,
      scholarshipElementary: _boolValue(profile['scholarship_elementary']),
      scholarshipHighSchool: _boolValue(profile['scholarship_high_school']),
      scholarshipCollege: _boolValue(profile['scholarship_college']),
      scholarshipOthers: _boolValue(profile['scholarship_others']),
      scholarshipOthersSpecify: _string(profile['scholarship_others_specify']),
      scholarshipDetails: _string(profile['prior_scholarship_details']),`,
    'API scholarship checkbox mapping'
  );
}

if (!printModel.includes("final application = _map(payload['application']);")) {
  printModel = replaceOnce(
    printModel,
    `    final account = _map(payload['account']);`,
    `    final account = _map(payload['account']);
    final application = _map(payload['application']);`,
    'print application metadata'
  );
}

if (!printModel.includes('final selectedFinancialSupport = <String>{};')) {
  printModel = replaceOnce(
    printModel,
    `    final financialSupport = _firstNonEmpty([
      _string(support['financial_support']),
      _string(support['financial_support_type']),
    ]);
`,
    `    final financialSupport = _firstNonEmpty([
      _string(support['financial_support']),
      _string(support['financial_support_type']),
    ]);

    final selectedFinancialSupport = <String>{};
    final rawFinancialSupportChoices =
        support['financial_support_choices'];

    if (rawFinancialSupportChoices is List) {
      for (final value in rawFinancialSupportChoices) {
        final normalized = _string(value).toLowerCase();
        if (normalized.isNotEmpty) {
          selectedFinancialSupport.add(normalized);
        }
      }
    }

    if (selectedFinancialSupport.isEmpty) {
      for (final value in financialSupport.split(',')) {
        final normalized = value.trim().toLowerCase();
        if (normalized.isNotEmpty) {
          selectedFinancialSupport.add(normalized);
        }
      }
    }
`,
    'Financial Support multi-select parsing'
  );
}

/*
 * fromApi() has its own financialSupport local. The boolean mapping below
 * intentionally supports both factories, so define the same normalized set in
 * fromApi() as well. This is a separate Dart scope and does not conflict with
 * fromSavedFormData().
 */
const apiFinancialSupportBlock =
  `    final financialSupport = _string(profile['financial_support_type']);
    final currentYearLevel = _string(student['year_level']);`;

const apiFinancialSupportWithSelection =
  `    final financialSupport = _string(profile['financial_support_type']);
    final selectedFinancialSupport = financialSupport
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .where((value) => value.isNotEmpty)
        .toSet();
    final currentYearLevel = _string(student['year_level']);`;

if (!printModel.includes(apiFinancialSupportWithSelection)) {
  printModel = replaceOnce(
    printModel,
    apiFinancialSupportBlock,
    apiFinancialSupportWithSelection,
    'fromApi Financial Support normalization'
  );
}

printModel = printModel
  .replace(
    "        financialSupport.toLowerCase() == 'other'\n            ? _string(support['scholarship_others_specify'])\n            : '',",
    "        selectedFinancialSupport.contains('other')\n            ? _string(support['scholarship_others_specify'])\n            : '',"
  )
  .replace(
    "      supportParents: financialSupport.toLowerCase() == 'parents',",
    "      supportParents: selectedFinancialSupport.contains('parents'),"
  )
  .replace(
    "      supportScholarship: financialSupport.toLowerCase() == 'scholarship',",
    "      supportScholarship: selectedFinancialSupport.contains('scholarship'),"
  )
  .replace(
    "      supportLoan: financialSupport.toLowerCase() == 'loan',",
    "      supportLoan: selectedFinancialSupport.contains('loan'),"
  )
  .replace(
    "      supportOther: financialSupport.toLowerCase() == 'other',",
    "      supportOther: selectedFinancialSupport.contains('other'),"
  );

if (!printModel.includes("scholarshipElementary: _boolValue(support['scholarship_elementary'])")) {
  printModel = replaceOnce(
    printModel,
    `      hadScholarship: hasPriorScholarship,
      noScholarshipHistory: !hasPriorScholarship,
      scholarshipDetails: _firstNonEmpty([`,
    `      hadScholarship: hasPriorScholarship,
      noScholarshipHistory: !hasPriorScholarship,
      scholarshipElementary: _boolValue(
        support['scholarship_elementary'],
      ),
      scholarshipHighSchool: _boolValue(
        support['scholarship_high_school'],
      ),
      scholarshipCollege: _boolValue(
        support['scholarship_college'],
      ),
      scholarshipOthers: _boolValue(
        support['scholarship_others'],
      ),
      scholarshipOthersSpecify: _string(
        support['scholarship_others_specify'],
      ),
      scholarshipDetails: _firstNonEmpty([`,
    'saved-form scholarship checkbox mapping'
  );
}

if (!printModel.includes("family['parent_previous_town_municipality']")) {
  printModel = replaceOnce(
    printModel,
    `      originProvince: _string(family['parent_previous_town_province']),`,
    `      originProvince: _firstNonEmpty([
        _string(family['parent_previous_town_province']),
        _joinNonEmpty([
          _string(family['parent_previous_town_municipality']),
          _string(family['parent_previous_province']),
        ], separator: ', '),
      ]),`,
    'native origin town/province retrieval'
  );
}

if (!printModel.includes('final submittedApplicationDate = _firstNonEmpty([')) {
  printModel = replaceOnce(
    printModel,
    `    final dateOfBirthRaw = _string(personal['date_of_birth']);`,
    `    final dateOfBirthRaw = _string(personal['date_of_birth']);
    final submittedApplicationDate = _firstNonEmpty([
      _string(application['submission_date']),
      _string(application['submitted_at']),
      _string(application['created_at']),
    ]);`,
    'submission date retrieval'
  );
}

if (!printModel.includes('_formatDate(submittedApplicationDate)')) {
  const savedFactoryStart = printModel.indexOf(
    '  factory SavedApplicationPrintModel.fromSavedFormData('
  );
  const helperStart = printModel.indexOf(
    '  static Map<String, dynamic> _map(',
    savedFactoryStart
  );

  if (savedFactoryStart < 0 || helperStart <= savedFactoryStart) {
    throw new Error(
      'Preflight failed: could not isolate SavedApplicationPrintModel.fromSavedFormData(). No project files were written.'
    );
  }

  let savedFactory = printModel.slice(
    savedFactoryStart,
    helperStart
  );

  savedFactory = replaceOnce(
    savedFactory,
    `      printedDate: DateFormat('MM/dd/yyyy').format(DateTime.now()),`,
    `      printedDate: _firstNonEmpty([
        _formatDate(submittedApplicationDate),
        DateFormat('MM/dd/yyyy').format(DateTime.now()),
      ]),`,
    'saved-form printed application date'
  );

  printModel =
    printModel.slice(0, savedFactoryStart) +
    savedFactory +
    printModel.slice(helperStart);
}

/* ---------- VALIDATION BEFORE WRITE ---------- */
const validation = [
  [appData.includes("'lrn': learnersReferenceNumber.trim()"), 'LRN serialization'],
  [appData.includes("'current_year_level': currentYearLevel.trim()"), 'Year Level text preservation'],
  [preview.includes('final payload = Map<String, dynamic>.from(_submittedFormPayload);'), 'raw submitted payload export'],
  [backendSource.includes('{ includeDraft: false }'), 'draft-free fallback'],
  [backendSource.includes('mergeMissingSubmissionValues(\n            formData,\n            normalizedFormData'), 'submitted-form DB backfill'],
  [
    printModel.split('final selectedFinancialSupport').length - 1 === 2 &&
      printModel.includes("selectedFinancialSupport.contains('parents')") &&
      printModel.includes("selectedFinancialSupport.contains('scholarship')") &&
      printModel.includes("selectedFinancialSupport.contains('loan')") &&
      printModel.includes("selectedFinancialSupport.contains('other')"),
    'Financial Support normalization in both print-model factories'
  ],
  [printModel.includes("scholarshipElementary: _boolValue"), 'scholarship checkbox retrieval'],
  [printModel.includes("family['parent_previous_town_municipality']"), 'native origin retrieval'],
  [
    printModel.includes('final submittedApplicationDate = _firstNonEmpty([') &&
      printModel.includes('_formatDate(submittedApplicationDate)'),
    'submitted-form application date retrieval'
  ],
];

const failed = validation.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) {
  throw new Error(`Validation failed before writing: ${failed.join(', ')}. No project files were written.`);
}

/* ---------- TEST FILES ---------- */
const flutterTest = String.raw`import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';

void main() {
  test('PDF retrieval keeps the full submitted application data', () {
    final data = ApplicationData()
      ..applySavedForm({
        'account': {
          'student_id': 'PDM-2026-000001',
          'email': 'student@example.com',
        },
        'personal': {
          'first_name': 'Ana Mae',
          'middle_name': 'Santos',
          'last_name': 'Dela Cruz',
          'date_of_birth': '2007-02-19',
        },
        'address': {
          'city_municipality': 'Marilao',
          'province': 'Bulacan',
          'zip_code': '3019',
        },
        'contact': {
          'mobile_number': '09171234567',
          'email': 'student@example.com',
        },
        'family': {
          'parent_native_status': 'No',
          'parent_previous_town_municipality': 'Meycauayan',
          'parent_previous_province': 'Bulacan',
          'father': {
            'last_name': 'Dela Cruz',
            'first_name': 'Juan',
            'middle_name': 'Reyes',
            'mobile': '09170000001',
            'company_name_and_address': 'Company A, Marilao',
          },
          'mother': {
            'last_name': 'Dela Cruz',
            'first_name': 'Maria',
            'middle_name': 'Santos',
            'mobile': '09170000002',
            'company_name_and_address': 'Market, Marilao',
          },
          'sibling': {
            'last_name': 'Dela Cruz',
            'first_name': 'Paolo',
            'middle_name': 'Santos',
            'mobile': '09170000003',
            'company_name_and_address': 'PDM Library',
          },
          'guardian': {
            'last_name': 'Reyes',
            'first_name': 'Lorna',
            'middle_name': 'Cruz',
            'mobile': '09170000004',
            'company_name_and_address': 'PDM',
          },
        },
        'academic': {
          'college_school': 'Pambayang Dalubhasaan ng Marilao',
          'college_address': 'Abangan Norte, Marilao, Bulacan',
          'college_year_graduated': 'Ongoing',
          'high_school_school': 'Marilao NHS',
          'high_school_address': 'Marilao, Bulacan',
          'high_school_year_graduated': '2022',
          'senior_high_school': 'Marilao SHS',
          'senior_high_address': 'Marilao, Bulacan',
          'senior_high_year_graduated': '2024',
          'elementary_school': 'Marilao Central School',
          'elementary_address': 'Marilao, Bulacan',
          'elementary_year_graduated': '2018',
          'current_course_code': 'BSIT',
          'current_year_level': '2nd Year',
          'current_section': 'A',
          'student_number': 'PDM-2026-000001',
          'lrn': '123456789012',
        },
        'support': {
          'financial_support': 'Parents, Scholarship, Other',
          'financial_support_choices': [
            'Parents',
            'Scholarship',
            'Other',
          ],
          'financial_support_other': 'Part-time work',
          'scholarship_history': true,
          'scholarship_elementary': true,
          'scholarship_high_school': true,
          'scholarship_college': false,
          'scholarship_others': true,
          'scholarship_others_specify': 'Private foundation',
          'scholarship_details': 'Municipal scholarship',
        },
        'discipline': {
          'disciplinary_action': true,
          'disciplinary_explanation': 'Late attendance warning',
        },
      });

    expect(data.learnersReferenceNumber, '123456789012');

    final payload = data.toSubmissionPayload();
    final academic = Map<String, dynamic>.from(payload['academic'] as Map);
    expect(academic['lrn'], '123456789012');
    expect(academic['learners_reference_number'], '123456789012');
    expect(academic['current_year_level'], '2nd Year');

    payload['application'] = {
      'submission_date': '2026-08-23T14:48:45.457861Z',
    };

    final model = SavedApplicationPrintModel.fromSavedFormData(payload);

    expect(model.city, 'Marilao');
    expect(model.province, 'Bulacan');
    expect(model.zipCode, '3019');
    expect(model.mobileNumber, '09171234567');

    expect(model.fatherLastName, 'Dela Cruz');
    expect(model.fatherFirstName, 'Juan');
    expect(model.fatherMiddleName, 'Reyes');
    expect(model.fatherMobile, '09170000001');
    expect(model.fatherCompanyNameAddress.toLowerCase(), 'company a, marilao');

    expect(model.motherLastName, 'Dela Cruz');
    expect(model.motherFirstName, 'Maria');
    expect(model.motherMiddleName, 'Santos');
    expect(model.motherMobile, '09170000002');
    expect(model.motherCompanyNameAddress.toLowerCase(), 'market, marilao');

    expect(model.siblingLastName, 'Dela Cruz');
    expect(model.siblingFirstName, 'Paolo');
    expect(model.siblingMiddleName, 'Santos');
    expect(model.siblingMobile, '09170000003');
    expect(model.siblingCompanyNameAddress.toLowerCase(), 'pdm library');

    expect(model.guardianLastName, 'Reyes');
    expect(model.guardianFirstName, 'Lorna');
    expect(model.guardianMiddleName, 'Cruz');
    expect(model.guardianMobile, '09170000004');
    expect(model.guardianCompanyNameAddress.toLowerCase(), 'pdm');

    expect(model.isNotNative, true);
    expect(model.originProvince, 'Meycauayan, Bulacan');

    expect(model.collegeSchool.toLowerCase(), 'pambayang dalubhasaan ng marilao');
    expect(model.highSchoolSchool.toLowerCase(), 'marilao nhs');
    expect(model.seniorHighSchool.toLowerCase(), 'marilao shs');
    expect(model.elementarySchool.toLowerCase(), 'marilao central school');
    expect(model.currentCourse, 'BSIT');
    expect(model.currentYearSection, '2nd Year / A');
    expect(model.studentNumber, 'PDM-2026-000001');
    expect(model.learnersReferenceNumber, '123456789012');

    expect(model.supportParents, true);
    expect(model.supportScholarship, true);
    expect(model.supportLoan, false);
    expect(model.supportOther, true);
    expect(model.financialSupportOther, 'Part-time work');

    expect(model.hadScholarship, true);
    expect(model.scholarshipElementary, true);
    expect(model.scholarshipHighSchool, true);
    expect(model.scholarshipCollege, false);
    expect(model.scholarshipOthers, true);
    expect(model.scholarshipOthersSpecify, 'Private foundation');
    expect(model.scholarshipDetails.toLowerCase(), 'municipal scholarship');

    expect(model.hasDisciplinaryRecord, true);
    expect(model.disciplinaryDetails.toLowerCase(), 'late attendance warning');

    expect(model.applicantPrintedName, 'Ana Mae Santos Dela Cruz');
    expect(model.parentGuardianPrintedName, 'Lorna Cruz Reyes');
    expect(model.printedDate, '08/23/2026');
  });
}
`;

const backendTest = String.raw`'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'applicationService.js'),
  'utf8'
);

test('submitted form backfills persisted values without draft contamination', () => {
  assert.match(
    source,
    /async function getMyFormData\(userId,\s*options\s*=\s*\{\}\)/
  );
  assert.match(
    source,
    /const includeDraft\s*=\s*options\?\.includeDraft\s*!==\s*false/
  );
  assert.match(
    source,
    /getMyFormData\(\s*userId,\s*\{\s*includeDraft:\s*false\s*\}\s*\)/
  );
  assert.match(
    source,
    /mergeMissingSubmissionValues\(\s*formData,\s*normalizedFormData/
  );
  assert.match(
    source,
    /submission_date:\s*application\.submission_date\s*\|\|\s*null/
  );
});
`;

/* ---------- TRANSACTIONAL WRITE/ROLLBACK ---------- */
const rollbackRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'smartpdm-retrieval-'));
const staged = [];

function stage(file) {
  const relative = path.relative(repo, file);
  const copy = path.join(rollbackRoot, relative);
  fs.mkdirSync(path.dirname(copy), { recursive: true });
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, copy);
    staged.push({ file, copy, existed: true });
  } else {
    staged.push({ file, copy, existed: false });
  }
}

function restoreAll() {
  for (const x of staged) {
    if (x.existed) {
      fs.mkdirSync(path.dirname(x.file), { recursive: true });
      fs.copyFileSync(x.copy, x.file);
    } else if (fs.existsSync(x.file)) {
      fs.unlinkSync(x.file);
    }
  }
}

for (const file of Object.values(files)) stage(file);

try {
  fs.writeFileSync(files.appData, restoreEol(appData, crlf.appData), 'utf8');
  fs.writeFileSync(files.printModel, restoreEol(printModel, crlf.printModel), 'utf8');
  fs.writeFileSync(files.preview, restoreEol(preview, crlf.preview), 'utf8');
  fs.writeFileSync(files.backend, restoreEol(backendSource, crlf.backend), 'utf8');
  fs.writeFileSync(files.flutterTest, flutterTest, 'utf8');
  fs.writeFileSync(files.backendTest, backendTest, 'utf8');

  run(
    'dart',
    ['format', files.appData, files.printModel, files.preview, files.flutterTest],
    frontend
  );

  run('node', ['--check', files.backend], repo);

  run(
    'flutter',
    ['test', 'test/pdf_missing_data_retrieval_regression_test.dart'],
    frontend
  );

  run(
    'node',
    ['--test', 'test/submitted-form-pdf-backfill-contract.test.js'],
    backend
  );

  run('flutter', ['test'], frontend);
} catch (error) {
  console.error('\nRetrieval tests failed. Restoring every changed file...');
  restoreAll();
  console.error(`Rollback completed from: ${rollbackRoot}`);
  throw error;
}

try {
  fs.rmSync(rollbackRoot, { recursive: true, force: true });
} catch (_) {}

console.log('\nPASS: PDF missing-data retrieval v4 + full Flutter tests passed.');
console.log('\nNo DB migration. No repository backup files created or deleted.');
console.log('Restart mobile backend before manual testing.');
