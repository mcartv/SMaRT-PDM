import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';

void main() {
  test('print model retrieves the application data required by the PDF', () {
    final model = SavedApplicationPrintModel.fromSavedFormData({
      'account': {
        'email': 'student@example.com',
        'student_id': 'PDM-2026-000001',
      },
      'personal': {
        'last_name': 'Dela Cruz',
        'first_name': 'Ana Mae',
        'middle_name': 'Santos',
        'date_of_birth': '2007-02-19',
        'place_of_birth': 'Marilao',
        'citizenship': 'Filipino',
        'religion': 'Catholic',
        'civil_status': 'Single',
        'sex': 'Female',
      },
      'address': {
        'house_lot_block_no': '12',
        'street': 'Rizal Street',
        'barangay': 'Abangan Norte',
        'city_municipality': 'Marilao',
        'province': 'Bulacan',
        'zip_code': '3019',
      },
      'contact': {
        'mobile_number': '09171234567',
        'email': 'student@example.com',
      },
      'family': {
        'parent_guardian_address': 'Marilao, Bulacan',
        'parent_native_status': 'Both',
        'parent_marilao_residency_duration': '10',
        'father': {
          'last_name': 'Dela Cruz',
          'first_name': 'Juan',
          'middle_name': 'Reyes',
          'mobile_number': '09170000001',
          'highest_educational_attainment': 'College',
          'occupation': 'Driver',
          'company_name_address': 'Company A, Marilao',
        },
        'mother': {
          'last_name': 'Dela Cruz',
          'first_name': 'Maria',
          'middle_name': 'Santos',
          'mobile_number': '09170000002',
          'highest_educational_attainment': 'College',
          'occupation': 'Vendor',
          'company_name_address': 'Market, Marilao',
        },
        'sibling': {
          'last_name': 'Dela Cruz',
          'first_name': 'Paolo',
          'middle_name': 'Santos',
          'mobile_number': '09170000003',
          'highest_educational_attainment': 'Senior High School',
          'occupation': 'Student Assistant',
          'company_name_address': 'PDM Library',
        },
        'guardian': {
          'last_name': 'Reyes',
          'first_name': 'Lorna',
          'middle_name': 'Cruz',
          'mobile_number': '09170000004',
          'highest_educational_attainment': 'College',
          'occupation': 'Teacher',
          'company_name_address': 'PDM',
        },
      },
      'academic': {
        'college_school': 'Pambayang Dalubhasaan ng Marilao',
        'college_address': 'Abangan Norte, Marilao, Bulacan',
        'college_year_graduated': 'On Going',
        'high_school_school': 'Marilao NHS',
        'high_school_address': 'Marilao, Bulacan',
        'high_school_year_graduated': '2022',
        'senior_high_school': 'Marilao SHS',
        'senior_high_address': 'Marilao, Bulacan',
        'senior_high_year_graduated': '2024',
        'elementary_school': 'Marilao Central School',
        'elementary_address': 'Marilao, Bulacan',
        'elementary_year_graduated': '2018',
        'current_year_level': '2nd',
        'current_section': 'A',
        'student_number': 'PDM-2026-000001',
        'lrn': '123456789012',
        'current_course_code': 'BSIT',
        'gwa': '1.75',
      },
      'support': {
        'financial_support': 'Other',
        'financial_support_other': 'Part-time work',
        'scholarship_history': true,
        'scholarship_details': 'Municipal scholarship',
      },
      'discipline': {
        'disciplinary_action': true,
        'disciplinary_explanation': 'Late attendance warning',
      },
      'essays': {
        'describe_yourself_essay': 'Responsible and hardworking.',
        'aims_and_ambition_essay': 'Work in information technology.',
      },
    });

    expect(model.city, 'Marilao');
    expect(model.province, 'Bulacan');
    expect(model.zipCode, '3019');
    expect(model.mobileNumber, '09171234567');

    expect(model.fatherCompanyNameAddress, 'Company A, Marilao');
    expect(model.motherCompanyNameAddress, 'Market, Marilao');

    expect(model.siblingEducationalAttainment, 'Senior High School');
    expect(model.siblingOccupation, 'Student Assistant');
    expect(model.siblingCompanyNameAddress, 'PDM Library');

    expect(model.guardianCompanyNameAddress, 'PDM');

    expect(model.collegeSchool, 'Pambayang Dalubhasaan ng Marilao');
    expect(model.highSchoolSchool, 'Marilao NHS');
    expect(model.seniorHighSchool, 'Marilao SHS');
    expect(model.elementarySchool, 'Marilao Central School');

    expect(model.currentCourse, 'BSIT');
    expect(model.currentYearSection, '2nd / A');
    expect(model.studentNumber, 'PDM-2026-000001');
    expect(model.learnersReferenceNumber, '123456789012');

    expect(model.supportOther, isTrue);
    expect(model.financialSupportOther, 'Part-time work');
    expect(model.hadScholarship, isTrue);
    expect(model.scholarshipDetails, 'Municipal scholarship');

    expect(model.hasDisciplinaryRecord, isTrue);
    expect(model.disciplinaryDetails, 'Late attendance warning');

    expect(model.applicantPrintedName, 'Ana Mae Santos Dela Cruz');
    expect(model.parentGuardianPrintedName, 'Lorna Cruz Reyes');
    expect(model.printedDate, isNotEmpty);
  });

  test('PDF renderer contains the alignment and missing-data fixes', () {
    final source = File(
      'lib/features/forms/data/services/scholarship_form_pdf_service.dart',
    ).readAsStringSync();

    expect(source, contains('void drawDateDigits('));
    expect(source, contains('drawDateDigits(model.dateOfBirth'));
    expect(source, contains('model.siblingEducationalAttainment'));
    expect(source, contains('model.siblingOccupation'));
    expect(source, contains('model.siblingCompanyNameAddress'));

    expect(
      source,
      contains(
        'model.studentNumber,\n'
        '      r(420, 2230, 445, 55),\n'
        '      textFont: smallFont,\n'
        '      align: PdfTextAlignment.center,',
      ),
    );
  });

  test('application preview exposes adjacent Edit and Export actions', () {
    final source = File(
      'lib/features/applicant/presentation/screens/application_form_preview_screen.dart',
    ).readAsStringSync();

    expect(source, contains("'Edit Form'"));
    expect(source, contains("'Export PDF'"));
    expect(source, contains('Row('));
    expect(source, contains('generateBytesFromSubmissionPayload('));
    expect(source, contains('XFile.fromData('));
  });
}
