import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  group('ApplicationData.applySavedForm', () {
    test('hydrates prefilled applicant form fields from backend payload', () {
      final data = ApplicationData()
        ..firstName = 'Cached'
        ..mobileNumber = '09999999999';

      data.applySavedForm({
        'opening': {
          'opening_id': 'opening-1',
          'opening_title': 'PDM Scholarship',
          'program_name': 'Municipal Scholarship',
        },
        'account': {'user_id': 'user-1', 'student_id': 'PDM-2026-0001'},
        'personal': {
          'first_name': 'Juan',
          'middle_name': 'Santos',
          'last_name': 'Dela Cruz',
          'date_of_birth': '2004-05-20',
          'place_of_birth': 'Marilao, Bulacan',
          'sex': 'Male',
          'citizenship': 'Filipino',
          'civil_status': 'Single',
          'religion': 'Roman Catholic',
        },
        'address': {
          'unit_bldg_no': 'Unit 2',
          'house_lot_block_no': 'Blk 1 Lot 3',
          'street': 'Rizal Street',
          'subdivision': 'Poblacion Homes',
          'barangay': 'Poblacion I',
          'city_municipality': 'Marilao',
          'province': 'Bulacan',
          'zip_code': '3019',
        },
        'contact': {
          'landline': '(044) 123-4567',
          'mobile_number': '09171234567',
          'email': 'juan@example.com',
        },
        'family': {
          'parent_guardian_address': 'Poblacion I, Marilao, Bulacan',
          'same_address_as_applicant': true,
          'father_present': true,
          'mother_present': false,
          'guardian_only': false,
          'father': {
            'last_name': 'Dela Cruz',
            'first_name': 'Pedro',
            'middle_name': 'Reyes',
            'mobile_number': '09180000001',
            'highest_educational_attainment': 'College',
            'occupation': 'Driver',
            'company_name_address': 'Marilao Transport',
          },
          'mother': {
            'last_name': 'Santos',
            'first_name': 'Maria',
            'middle_name': 'Lopez',
            'mobile': '09180000002',
            'educational_attainment': 'High School',
            'occupation': 'Vendor',
            'company_name_and_address': 'Public Market',
          },
          'guardian': {
            'last_name': 'Reyes',
            'first_name': 'Ana',
            'mobile_number': '09180000003',
          },
          'parent_native_status': 'Yes, both parents',
          'parent_marilao_residency_duration': '20',
        },
        'academic': {
          'current_course_code': 'BSIT',
          'current_year_level': '2',
          'current_section': 'B',
          'student_number': 'PDM-2026-0001',
          'gwa': '1.75',
          'college_school': 'PDM College',
        },
        'support': {
          'financial_support_type': 'Parents',
          'has_prior_scholarship': true,
          'scholarship_elementary': true,
          'scholarship_high_school': false,
          'scholarship_college': true,
          'scholarship_others': true,
          'financial_support_other': 'Aunt',
          'prior_scholarship_details': 'Barangay grant',
        },
        'discipline': {
          'has_disciplinary_record': true,
          'disciplinary_details': 'Minor case resolved',
        },
        'essays': {
          'self_description': 'Hardworking student',
          'aims_and_ambitions': 'Finish college',
        },
      });

      expect(data.openingId, 'opening-1');
      expect(data.userId, 'user-1');
      expect(data.accountStudentId, 'PDM-2026-0001');
      expect(data.firstName, 'Juan');
      expect(data.dateOfBirth, '05/20/2004');
      expect(
        data.age,
        ApplicationData.calculateAge(DateTime(2004, 5, 20)).toString(),
      );
      expect(data.placeOfBirth, 'Marilao, Bulacan');
      expect(data.unitBldgNo, 'Unit 2');
      expect(data.houseLotBlockNo, 'Blk 1 Lot 3');
      expect(data.mobileNumber, '09171234567');
      expect(data.sameAddressAsApplicant, isTrue);
      expect(data.fatherPresent, isTrue);
      expect(data.motherPresent, isFalse);
      expect(data.fatherFirstName, 'Pedro');
      expect(data.fatherEducationalAttainment, 'College');
      expect(data.fatherCompanyNameAndAddress, 'Marilao Transport');
      expect(data.motherMobile, '09180000002');
      expect(data.currentCourse, 'BSIT');
      expect(data.currentYearLevel, '2');
      expect(data.currentSection, 'B');
      expect(data.gwa, '1.75');
      expect(data.scholarshipHistory, isTrue);
      expect(data.scholarshipElementary, isTrue);
      expect(data.scholarshipCollege, isTrue);
      expect(data.scholarshipOthers, isTrue);
      expect(data.scholarshipOthersSpecify, 'Aunt');
      expect(data.disciplinaryAction, isTrue);
      expect(data.disciplinaryExplanation, 'Minor case resolved');
      expect(data.describeYourselfEssay, 'Hardworking student');
      expect(data.aimsAndAmbitionEssay, 'Finish college');
    });

    test('keeps existing editable values when backend fields are absent', () {
      final data = ApplicationData()
        ..email = 'cached@example.com'
        ..province = 'Bulacan'
        ..city = 'Marilao';

      data.applySavedForm({'contact': {}, 'address': {}});

      expect(data.email, 'cached@example.com');
      expect(data.province, 'Bulacan');
      expect(data.city, 'Marilao');
    });
  });
}
