class ApplicationData {
  String userId = '';
  String accountStudentId = '';

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
  String unitBldgNo = '';
  String houseLotBlockNo = '';
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

  static String normalizeEmail(String value) {
    return value.trim().toLowerCase();
  }

  static String normalizeMobileNumber(String value) {
    final trimmed = value.trim().replaceAll(RegExp(r'\s+|-'), '');
    if (trimmed.startsWith('+63') && trimmed.length == 13) {
      return '0${trimmed.substring(3)}';
    }
    if (trimmed.startsWith('63') && trimmed.length == 12) {
      return '0${trimmed.substring(2)}';
    }
    return trimmed;
  }

  static bool isValidPhilippineMobile(String value) {
    final normalized = normalizeMobileNumber(value);
    return RegExp(r'^09\d{9}$').hasMatch(normalized);
  }

  static int? parseAgeValue(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;
    return int.tryParse(trimmed);
  }

  static DateTime? parseInputDate(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return null;

    final parts = trimmed.split('/');
    if (parts.length == 3) {
      final month = int.tryParse(parts[0]);
      final day = int.tryParse(parts[1]);
      final year = int.tryParse(parts[2]);
      if (month != null && day != null && year != null) {
        return DateTime.tryParse(
          '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}',
        );
      }
    }

    return DateTime.tryParse(trimmed);
  }

  static int? calculateAge(DateTime? birthDate) {
    if (birthDate == null) return null;

    final today = DateTime.now();
    var years = today.year - birthDate.year;
    final hasBirthdayPassed =
        today.month > birthDate.month ||
        (today.month == birthDate.month && today.day >= birthDate.day);
    if (!hasBirthdayPassed) {
      years -= 1;
    }
    return years;
  }

  static String toTitleCase(String value) {
    final collapsed = value.trim().replaceAll(RegExp(r'\s+'), ' ');
    if (collapsed.isEmpty) return '';

    return collapsed
        .split(' ')
        .map((word) {
          return word
              .split('-')
              .map((part) {
                if (part.isEmpty) return part;
                final lower = part.toLowerCase();
                return '${lower[0].toUpperCase()}${lower.substring(1)}';
              })
              .join('-');
        })
        .join(' ');
  }

  int? _parseInt(String value) => parseAgeValue(value);

  String? _toIsoDate(String value) {
    final parsed = parseInputDate(value);
    return parsed?.toIso8601String().split('T').first;
  }

  String _title(String value) => toTitleCase(value);

  Map<String, dynamic> toSubmissionPayload() {
    final normalizedMobile = normalizeMobileNumber(mobileNumber);
    return {
      'account': {
        'user_id': userId.trim(),
        'student_id': accountStudentId.trim(),
        'email': normalizeEmail(email),
      },
      'application': {'application_status': 'Pending Review'},
      'personal': {
        'first_name': _title(firstName),
        'middle_name': _title(middleName),
        'last_name': _title(lastName),
        'maiden_name': _title(maidenName),
        'age': _parseInt(age),
        'date_of_birth': _toIsoDate(dateOfBirth),
        'sex': _title(sex),
        'place_of_birth': _title(placeOfBirth),
        'citizenship': _title(citizenship),
        'civil_status': _title(civilStatus),
        'religion': _title(religion),
      },
      'address': {
        'unit_bldg_no': _title(unitBldgNo),
        'house_lot_block_no': _title(houseLotBlockNo),
        'street': _title(street),
        'subdivision': _title(subdivision),
        'barangay': _title(barangay),
        'city_municipality': _title(city),
        'province': _title(province),
        'zip_code': zipCode.trim(),
      },
      'contact': {
        'landline': landline.trim(),
        'mobile_number': normalizedMobile,
        'email': normalizeEmail(email),
      },
      'family': {
        'parent_guardian_address': _title(parentGuardianAddress),
        'father': {
          'last_name': _title(fatherLastName),
          'first_name': _title(fatherFirstName),
          'middle_name': _title(fatherMiddleName),
          'mobile': normalizeMobileNumber(fatherMobile),
          'educational_attainment': fatherEducationalAttainment.trim(),
          'occupation': _title(fatherOccupation),
          'company_name_and_address': _title(fatherCompanyNameAndAddress),
        },
        'mother': {
          'last_name': _title(motherLastName),
          'first_name': _title(motherFirstName),
          'middle_name': _title(motherMiddleName),
          'mobile': normalizeMobileNumber(motherMobile),
          'educational_attainment': motherEducationalAttainment.trim(),
          'occupation': _title(motherOccupation),
          'company_name_and_address': _title(motherCompanyNameAndAddress),
        },
        'sibling': {
          'last_name': _title(siblingLastName),
          'first_name': _title(siblingFirstName),
          'middle_name': _title(siblingMiddleName),
          'mobile': normalizeMobileNumber(siblingMobile),
        },
        'guardian': {
          'last_name': _title(guardianLastName),
          'first_name': _title(guardianFirstName),
          'middle_name': _title(guardianMiddleName),
          'mobile': normalizeMobileNumber(guardianMobile),
          'educational_attainment': guardianEducationalAttainment.trim(),
          'occupation': _title(guardianOccupation),
          'company_name_and_address': _title(guardianCompanyNameAndAddress),
        },
        'parent_native_status': parentNativeStatus.trim(),
        'parent_marilao_residency_duration': _title(
          parentMarilaoResidencyDuration,
        ),
        'parent_previous_town_province': _title(parentPreviousTownProvince),
      },
      'academic': {
        'college_school': _title(collegeSchool),
        'college_address': _title(collegeAddress),
        'college_honors': _title(collegeHonors),
        'college_club': _title(collegeClub),
        'college_year_graduated': collegeYearGraduated.trim(),
        'high_school_school': _title(highSchoolSchool),
        'high_school_address': _title(highSchoolAddress),
        'high_school_honors': _title(highSchoolHonors),
        'high_school_club': _title(highSchoolClub),
        'high_school_year_graduated': highSchoolYearGraduated.trim(),
        'senior_high_school': _title(seniorHighSchool),
        'senior_high_address': _title(seniorHighAddress),
        'senior_high_honors': _title(seniorHighHonors),
        'senior_high_club': _title(seniorHighClub),
        'senior_high_year_graduated': seniorHighYearGraduated.trim(),
        'elementary_school': _title(elementarySchool),
        'elementary_address': _title(elementaryAddress),
        'elementary_honors': _title(elementaryHonors),
        'elementary_club': _title(elementaryClub),
        'elementary_year_graduated': elementaryYearGraduated.trim(),
        'current_course_code': currentCourse.trim(),
        'current_year_level': _parseInt(currentYearLevel),
        'current_section': _title(currentSection),
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
        'scholarship_others_specify': _title(scholarshipOthersSpecify),
        'scholarship_details': _title(scholarshipDetails),
      },
      'discipline': {
        'disciplinary_action': disciplinaryAction,
        'disciplinary_explanation': _title(disciplinaryExplanation),
      },
      'essays': {
        'describe_yourself_essay': _title(describeYourselfEssay),
        'aims_and_ambition_essay': _title(aimsAndAmbitionEssay),
      },
      'certification': {
        'certification_read': certificationRead,
        'agree': agree,
      },
      'documents': {'records': <Map<String, dynamic>>[]},
    };
  }
}
