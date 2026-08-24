import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';

void main() {
  test('ApplicationData preserves LRN and textual Year Level', () {
    final data = ApplicationData()
      ..applySavedForm({
        'academic': {
          'current_course_code': 'BSIT',
          'current_year_level': '2nd Year',
          'current_section': 'A',
          'student_number': 'PDM-2026-000001',
          'lrn': '123456789012',
        },
      });

    expect(data.learnersReferenceNumber, '123456789012');

    final payload = data.toSubmissionPayload();
    final academic = Map<String, dynamic>.from(payload['academic'] as Map);

    expect(academic['lrn'], '123456789012');
    expect(academic['learners_reference_number'], '123456789012');
    expect(academic['current_year_level'], '2nd Year');
    expect(academic['year_level'], '2nd Year');
    expect(academic['student_number'], 'PDM-2026-000001');
  });

  test(
    'print model retrieves every requested PDF field from persisted form data',
    () {
      final model = SavedApplicationPrintModel.fromSavedFormData({
        'account': {
          'student_id': 'PDM-2026-000001',
          'email': 'student@example.com',
        },
        'application': {'submission_date': '2026-08-23T14:48:45.457861Z'},
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
          'financial_support_choices': ['Parents', 'Scholarship', 'Other'],
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

      expect(model.city, 'Marilao');
      expect(model.province, 'Bulacan');
      expect(model.zipCode, '3019');
      expect(model.mobileNumber, '09171234567');

      expect(model.fatherLastName, 'Dela Cruz');
      expect(model.fatherFirstName, 'Juan');
      expect(model.fatherMiddleName, 'Reyes');
      expect(model.fatherMobile, '09170000001');
      expect(model.fatherCompanyNameAddress, 'Company A, Marilao');

      expect(model.motherLastName, 'Dela Cruz');
      expect(model.motherFirstName, 'Maria');
      expect(model.motherMiddleName, 'Santos');
      expect(model.motherMobile, '09170000002');
      expect(model.motherCompanyNameAddress, 'Market, Marilao');

      expect(model.siblingLastName, 'Dela Cruz');
      expect(model.siblingFirstName, 'Paolo');
      expect(model.siblingMiddleName, 'Santos');
      expect(model.siblingMobile, '09170000003');
      expect(model.siblingCompanyNameAddress, 'PDM Library');

      expect(model.guardianLastName, 'Reyes');
      expect(model.guardianFirstName, 'Lorna');
      expect(model.guardianMiddleName, 'Cruz');
      expect(model.guardianMobile, '09170000004');
      expect(model.guardianCompanyNameAddress, 'PDM');

      expect(model.isNotNative, isTrue);
      expect(model.originProvince, 'Meycauayan, Bulacan');

      expect(model.collegeSchool, 'Pambayang Dalubhasaan ng Marilao');
      expect(model.highSchoolSchool, 'Marilao NHS');
      expect(model.seniorHighSchool, 'Marilao SHS');
      expect(model.elementarySchool, 'Marilao Central School');
      expect(model.currentCourse, 'BSIT');
      expect(model.currentYearSection, '2nd Year / A');
      expect(model.studentNumber, 'PDM-2026-000001');
      expect(model.learnersReferenceNumber, '123456789012');

      expect(model.supportParents, isTrue);
      expect(model.supportScholarship, isTrue);
      expect(model.supportLoan, isFalse);
      expect(model.supportOther, isTrue);
      expect(model.financialSupportOther, 'Part-time work');

      expect(model.hadScholarship, isTrue);
      expect(model.noScholarshipHistory, isFalse);
      expect(model.scholarshipElementary, isTrue);
      expect(model.scholarshipHighSchool, isTrue);
      expect(model.scholarshipCollege, isFalse);
      expect(model.scholarshipOthers, isTrue);
      expect(model.scholarshipOthersSpecify, 'Private foundation');
      expect(model.scholarshipDetails, 'Municipal scholarship');

      expect(model.hasDisciplinaryRecord, isTrue);
      expect(model.noDisciplinaryRecord, isFalse);
      expect(model.disciplinaryDetails, 'Late attendance warning');

      expect(model.applicantPrintedName, 'Ana Mae Santos Dela Cruz');
      expect(model.parentGuardianPrintedName, 'Lorna Cruz Reyes');
      expect(model.printedDate, '08/23/2026');
    },
  );

  test('Application Form Preview exports the persisted submitted payload', () {
    final source = File(
      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',
    ).readAsStringSync();

    expect(
      source,
      contains(
        'final payload = Map<String, dynamic>.from(_submittedFormPayload);',
      ),
    );
    expect(source, contains('generateBytesFromSubmissionPayload('));
    expect(source, contains('XFile.fromData('));
    expect(
      source,
      isNot(
        contains(
          'generateBytesFromSubmissionPayload(\\n        data.toSubmissionPayload()',
        ),
      ),
    );
  });
}
