class ApplicationData {
  String userId = '';
  String accountStudentId = '';
  String programId = '';

  // Step 1: Personal Data
  String firstName = '';
  String middleName = '';
  String lastName = '';
  String maidenName = '';
  String age = '';
  String dateOfBirth = '';
  String sex = 'Male';
  String placeOfBirth = '';
  String citizenship = 'Filipino';
  String civilStatus = 'Single';
  String religion = '';

  // Permanent Address
  String block = '';
  String lot = '';
  String phase = '';
  String street = '';
  String subdivision = '';
  String barangay = '';
  String province = 'Bulacan';
  String city = 'Marilao';
  String zipCode = '3019';

  // Contact Information
  String landline = '';
  String mobileNumber = '';
  String email = '';

  // Family Data
  String parentGuardianAddress = '';

  String fatherLastName = '';
  String fatherFirstName = '';
  String fatherMiddleName = '';
  String fatherMobile = '';
  String fatherEducationalAttainment = '';
  String fatherOccupation = '';
  String fatherCompanyNameAndAddress = '';

  String motherLastName = '';
  String motherFirstName = '';
  String motherMiddleName = '';
  String motherMobile = '';
  String motherEducationalAttainment = '';
  String motherOccupation = '';
  String motherCompanyNameAndAddress = '';

  String siblingLastName = '';
  String siblingFirstName = '';
  String siblingMiddleName = '';
  String siblingMobile = '';

  String guardianLastName = '';
  String guardianFirstName = '';
  String guardianMiddleName = '';
  String guardianMobile = '';
  String guardianEducationalAttainment = '';
  String guardianOccupation = '';
  String guardianCompanyNameAndAddress = '';

  String parentNativeStatus = 'Yes, father only';
  String parentMarilaoResidencyDuration = '';
  String parentPreviousTownProvince = '';

  // Academic Data
  String collegeSchool = '';
  String collegeAddress = '';
  String collegeHonors = '';
  String collegeClub = '';
  String collegeYearGraduated = '';

  String highSchoolSchool = '';
  String highSchoolAddress = '';
  String highSchoolHonors = '';
  String highSchoolClub = '';
  String highSchoolYearGraduated = '';

  String seniorHighSchool = '';
  String seniorHighAddress = '';
  String seniorHighHonors = '';
  String seniorHighClub = '';
  String seniorHighYearGraduated = '';

  String elementarySchool = '';
  String elementaryAddress = '';
  String elementaryHonors = '';
  String elementaryClub = '';
  String elementaryYearGraduated = '';

  String currentCourse = '';
  String currentYearLevel = '';
  String currentSection = '';
  String studentNumber = '';
  String lrn = '';

  String financialSupport = 'Parents';
  bool scholarshipHistory = false;
  bool scholarshipElementary = false;
  bool scholarshipHighSchool = false;
  bool scholarshipCollege = false;
  bool scholarshipOthers = false;
  String scholarshipOthersSpecify = '';
  String scholarshipDetails = '';

  bool disciplinaryAction = false;
  String disciplinaryExplanation = '';

  // Essay Data
  String describeYourselfEssay = '';
  String aimsAndAmbitionEssay = '';

  // Submission & Certification
  bool certificationRead = false;
  bool agree = false;

  int? _parseInt(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    return int.tryParse(trimmed);
  }

  String? _toIsoDate(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;

    final parts = trimmed.split('/');
    if (parts.length == 3) {
      final month = int.tryParse(parts[0]);
      final day = int.tryParse(parts[1]);
      final year = int.tryParse(parts[2]);
      if (month != null && day != null && year != null) {
        return '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
      }
    }

    final parsed = DateTime.tryParse(trimmed);
    return parsed?.toIso8601String().split('T').first;
  }

  Map<String, dynamic> toSubmissionPayload() {
    return {
      'account': {
        'user_id': userId,
        'student_id': accountStudentId,
        'email': email.trim(),
      },
      'application': {
        'program_id': programId,
        'application_status': 'Pending Review',
      },
      'personal': {
        'first_name': firstName.trim(),
        'middle_name': middleName.trim(),
        'last_name': lastName.trim(),
        'maiden_name': maidenName.trim(),
        'age': _parseInt(age),
        'date_of_birth': _toIsoDate(dateOfBirth),
        'sex': sex.trim(),
        'place_of_birth': placeOfBirth.trim(),
        'citizenship': citizenship.trim(),
        'civil_status': civilStatus.trim(),
        'religion': religion.trim(),
      },
      'address': {
        'block': block.trim(),
        'lot': lot.trim(),
        'phase': phase.trim(),
        'street': street.trim(),
        'subdivision': subdivision.trim(),
        'barangay': barangay.trim(),
        'city_municipality': city.trim(),
        'province': province.trim(),
        'zip_code': zipCode.trim(),
      },
      'contact': {
        'landline': landline.trim(),
        'mobile_number': mobileNumber.trim(),
        'email': email.trim(),
      },
      'family': {
        'parent_guardian_address': parentGuardianAddress.trim(),
        'father': {
          'last_name': fatherLastName.trim(),
          'first_name': fatherFirstName.trim(),
          'middle_name': fatherMiddleName.trim(),
          'mobile': fatherMobile.trim(),
          'educational_attainment': fatherEducationalAttainment.trim(),
          'occupation': fatherOccupation.trim(),
          'company_name_and_address': fatherCompanyNameAndAddress.trim(),
        },
        'mother': {
          'last_name': motherLastName.trim(),
          'first_name': motherFirstName.trim(),
          'middle_name': motherMiddleName.trim(),
          'mobile': motherMobile.trim(),
          'educational_attainment': motherEducationalAttainment.trim(),
          'occupation': motherOccupation.trim(),
          'company_name_and_address': motherCompanyNameAndAddress.trim(),
        },
        'sibling': {
          'last_name': siblingLastName.trim(),
          'first_name': siblingFirstName.trim(),
          'middle_name': siblingMiddleName.trim(),
          'mobile': siblingMobile.trim(),
        },
        'guardian': {
          'last_name': guardianLastName.trim(),
          'first_name': guardianFirstName.trim(),
          'middle_name': guardianMiddleName.trim(),
          'mobile': guardianMobile.trim(),
          'educational_attainment': guardianEducationalAttainment.trim(),
          'occupation': guardianOccupation.trim(),
          'company_name_and_address': guardianCompanyNameAndAddress.trim(),
        },
        'parent_native_status': parentNativeStatus.trim(),
        'parent_marilao_residency_duration': parentMarilaoResidencyDuration
            .trim(),
        'parent_previous_town_province': parentPreviousTownProvince.trim(),
      },
      'academic': {
        'college_school': collegeSchool.trim(),
        'college_address': collegeAddress.trim(),
        'college_honors': collegeHonors.trim(),
        'college_club': collegeClub.trim(),
        'college_year_graduated': collegeYearGraduated.trim(),
        'high_school_school': highSchoolSchool.trim(),
        'high_school_address': highSchoolAddress.trim(),
        'high_school_honors': highSchoolHonors.trim(),
        'high_school_club': highSchoolClub.trim(),
        'high_school_year_graduated': highSchoolYearGraduated.trim(),
        'senior_high_school': seniorHighSchool.trim(),
        'senior_high_address': seniorHighAddress.trim(),
        'senior_high_honors': seniorHighHonors.trim(),
        'senior_high_club': seniorHighClub.trim(),
        'senior_high_year_graduated': seniorHighYearGraduated.trim(),
        'elementary_school': elementarySchool.trim(),
        'elementary_address': elementaryAddress.trim(),
        'elementary_honors': elementaryHonors.trim(),
        'elementary_club': elementaryClub.trim(),
        'elementary_year_graduated': elementaryYearGraduated.trim(),
        'current_course_code': currentCourse.trim(),
        'current_year_level': _parseInt(currentYearLevel),
        'current_section': currentSection.trim(),
        'student_number': studentNumber.trim(),
        'lrn': lrn.trim(),
      },
      'support': {
        'financial_support': financialSupport.trim(),
        'scholarship_history': scholarshipHistory,
        'scholarship_elementary': scholarshipElementary,
        'scholarship_high_school': scholarshipHighSchool,
        'scholarship_college': scholarshipCollege,
        'scholarship_others': scholarshipOthers,
        'scholarship_others_specify': scholarshipOthersSpecify.trim(),
        'scholarship_details': scholarshipDetails.trim(),
      },
      'discipline': {
        'disciplinary_action': disciplinaryAction,
        'disciplinary_explanation': disciplinaryExplanation.trim(),
      },
      'essays': {
        'describe_yourself_essay': describeYourselfEssay.trim(),
        'aims_and_ambition_essay': aimsAndAmbitionEssay.trim(),
      },
      'certification': {
        'certification_read': certificationRead,
        'agree': agree,
      },
      'documents': {
        'letter_of_intent_url': null,
        'certificate_of_registration_url': null,
        'grade_form_url': null,
        'certificate_of_indigency_url': null,
        'valid_id_url': null,
      },
    };
  }
}
