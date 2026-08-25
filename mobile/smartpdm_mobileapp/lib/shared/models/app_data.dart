class ApplicationData {
  String userId = '';
  String accountStudentId = '';
  String openingId = '';
  String openingTitle = '';
  String openingProgramName = '';

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
  bool sameAddressAsApplicant = false;
  bool fatherPresent = true;
  bool motherPresent = true;
  bool guardianOnly = false;

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
  String siblingEducationalAttainment = '';
  String siblingOccupation = '';
  String siblingCompanyNameAndAddress = '';

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
  String gwa = '';

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

  static double? parseGwaValue(String value) {
    final normalized = value.trim().replaceAll(',', '.');
    if (normalized.isEmpty) return null;
    return double.tryParse(normalized);
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

  static String? normalizeEducationalAttainment(String value) {
    final collapsed = value.trim().toLowerCase();
    if (collapsed.isEmpty) return null;

    final normalized = collapsed
        .replaceAll(RegExp(r'[_-]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    const lookup = {
      'none': 'None',
      'elementary': 'Elementary',
      'high school': 'High School',
      'senior high school': 'Senior High School',
      'vocational': 'Vocational',
      'college': 'College',
      'post graduate': 'Post-Graduate',
      'postgraduate': 'Post-Graduate',
    };

    return lookup[normalized];
  }

  int? _parseInt(String value) => parseAgeValue(value);

  String? _toIsoDate(String value) {
    final parsed = parseInputDate(value);
    return parsed?.toIso8601String().split('T').first;
  }

  String _title(String value) => toTitleCase(value);

  void applyOpeningSelection({
    required String openingId,
    required String openingTitle,
    required String programName,
  }) {
    this.openingId = openingId.trim();
    this.openingTitle = openingTitle.trim();
    openingProgramName = programName.trim();
  }

  static Map<String, dynamic> _mapValue(dynamic value) {
    return value is Map
        ? Map<String, dynamic>.from(value)
        : <String, dynamic>{};
  }

  static String _savedString(dynamic value) => value?.toString().trim() ?? '';

  static String _firstSavedString(
    Map<String, dynamic> source,
    List<String> keys,
  ) {
    for (final key in keys) {
      final value = _savedString(source[key]);
      if (value.isNotEmpty) return value;
    }
    return '';
  }

  static bool? _savedBool(dynamic value) {
    if (value is bool) return value;
    final text = _savedString(value).toLowerCase();
    if (text == 'true' || text == '1' || text == 'yes') return true;
    if (text == 'false' || text == '0' || text == 'no') return false;
    return null;
  }

  static String formatInputDate(dynamic value) {
    final raw = _savedString(value);
    if (raw.isEmpty) return '';

    final parsed = parseInputDate(raw) ?? DateTime.tryParse(raw);
    if (parsed == null) return raw;

    final month = parsed.month.toString().padLeft(2, '0');
    final day = parsed.day.toString().padLeft(2, '0');
    final year = parsed.year.toString().padLeft(4, '0');
    return '$month/$day/$year';
  }

  void _setIfPresent(void Function(String value) setter, String value) {
    if (value.trim().isNotEmpty) setter(value.trim());
  }

  void _setBoolIfPresent(void Function(bool value) setter, dynamic value) {
    final parsed = _savedBool(value);
    if (parsed != null) setter(parsed);
  }

  void _setEducationalAttainment(
    void Function(String value) setter,
    String value,
  ) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return;

    setter(normalizeEducationalAttainment(trimmed) ?? trimmed);
  }

  void applySavedForm(Map<String, dynamic> payload) {
    final opening = _mapValue(payload['opening']);
    final account = _mapValue(payload['account']);
    final personal = _mapValue(payload['personal']);
    final address = _mapValue(payload['address']);
    final contact = _mapValue(payload['contact']);
    final family = _mapValue(payload['family']);
    final academic = _mapValue(payload['academic']);
    final support = _mapValue(payload['support']);
    final discipline = _mapValue(payload['discipline']);
    final essays = _mapValue(payload['essays']);
    final certification = _mapValue(payload['certification']);

    final father = _mapValue(family['father']);
    final mother = _mapValue(family['mother']);
    final sibling = _mapValue(family['sibling']);
    final guardian = _mapValue(family['guardian']);

    _setIfPresent((value) => userId = value, _savedString(account['user_id']));
    _setIfPresent(
      (value) => accountStudentId = value,
      _firstSavedString(account, ['student_id', 'student_number']),
    );
    _setIfPresent(
      (value) => studentNumber = value,
      _firstSavedString(academic, ['student_number', 'student_id']),
    );
    if (studentNumber.trim().isEmpty && accountStudentId.trim().isNotEmpty) {
      studentNumber = accountStudentId;
    }

    final savedOpeningId = _savedString(opening['opening_id']);
    if (savedOpeningId.isNotEmpty) {
      applyOpeningSelection(
        openingId: savedOpeningId,
        openingTitle: _savedString(opening['opening_title']),
        programName: _firstSavedString(opening, ['program_name', 'program']),
      );
    }

    _setIfPresent(
      (value) => firstName = value,
      _savedString(personal['first_name']),
    );
    _setIfPresent(
      (value) => middleName = value,
      _savedString(personal['middle_name']),
    );
    _setIfPresent(
      (value) => lastName = value,
      _savedString(personal['last_name']),
    );
    _setIfPresent(
      (value) => maidenName = value,
      _savedString(personal['maiden_name']),
    );
    _setIfPresent(
      (value) => sex = value,
      _firstSavedString(personal, ['sex', 'sex_at_birth']),
    );
    _setIfPresent(
      (value) => placeOfBirth = value,
      _firstSavedString(personal, ['place_of_birth', 'placeOfBirth']),
    );
    _setIfPresent(
      (value) => citizenship = value,
      _savedString(personal['citizenship']),
    );
    _setIfPresent(
      (value) => civilStatus = value,
      _firstSavedString(personal, ['civil_status', 'civilStatus']),
    );
    _setIfPresent(
      (value) => religion = value,
      _savedString(personal['religion']),
    );

    final formattedDob = formatInputDate(
      _firstSavedString(personal, ['date_of_birth', 'dateOfBirth']),
    );
    _setIfPresent((value) => dateOfBirth = value, formattedDob);
    final computedAge = calculateAge(parseInputDate(dateOfBirth));
    if (computedAge != null) {
      age = computedAge.toString();
    } else {
      _setIfPresent((value) => age = value, _savedString(personal['age']));
    }

    _setIfPresent(
      (value) => unitBldgNo = value,
      _firstSavedString(address, ['unit_bldg_no', 'unitBldgNo']),
    );
    _setIfPresent(
      (value) => houseLotBlockNo = value,
      _firstSavedString(address, ['house_lot_block_no', 'houseLotBlockNo']),
    );
    _setIfPresent(
      (value) => street = value,
      _firstSavedString(address, ['street', 'street_address', 'streetAddress']),
    );
    _setIfPresent(
      (value) => subdivision = value,
      _savedString(address['subdivision']),
    );
    _setIfPresent(
      (value) => barangay = value,
      _savedString(address['barangay']),
    );
    _setIfPresent(
      (value) => city = value,
      _firstSavedString(address, ['city_municipality', 'city']),
    );
    _setIfPresent(
      (value) => province = value,
      _savedString(address['province']),
    );
    _setIfPresent(
      (value) => zipCode = value,
      _firstSavedString(address, ['zip_code', 'zipCode']),
    );

    _setIfPresent(
      (value) => landline = value,
      _firstSavedString(contact, ['landline', 'landline_number']),
    );
    _setIfPresent(
      (value) => mobileNumber = value,
      _firstSavedString(contact, [
        'mobile_number',
        'mobile',
        'phone_number',
        'phone',
      ]),
    );
    _setIfPresent(
      (value) => email = value,
      _firstSavedString(contact, ['email', 'email_address']),
    );

    _setIfPresent(
      (value) => parentGuardianAddress = value,
      _firstSavedString(family, [
        'parent_guardian_address',
        'parentGuardianAddress',
      ]),
    );
    _setBoolIfPresent(
      (value) => sameAddressAsApplicant = value,
      family['same_address_as_applicant'] ?? family['sameAddressAsApplicant'],
    );
    _setBoolIfPresent(
      (value) => fatherPresent = value,
      family['father_present'] ?? family['fatherPresent'],
    );
    _setBoolIfPresent(
      (value) => motherPresent = value,
      family['mother_present'] ?? family['motherPresent'],
    );
    _setBoolIfPresent(
      (value) => guardianOnly = value,
      family['guardian_only'] ?? family['guardianOnly'],
    );

    _applyFamilyMember(
      father,
      setLastName: (value) => fatherLastName = value,
      setFirstName: (value) => fatherFirstName = value,
      setMiddleName: (value) => fatherMiddleName = value,
      setMobile: (value) => fatherMobile = value,
      setEducation: (value) => fatherEducationalAttainment = value,
      setOccupation: (value) => fatherOccupation = value,
      setCompany: (value) => fatherCompanyNameAndAddress = value,
    );
    _applyFamilyMember(
      mother,
      setLastName: (value) => motherLastName = value,
      setFirstName: (value) => motherFirstName = value,
      setMiddleName: (value) => motherMiddleName = value,
      setMobile: (value) => motherMobile = value,
      setEducation: (value) => motherEducationalAttainment = value,
      setOccupation: (value) => motherOccupation = value,
      setCompany: (value) => motherCompanyNameAndAddress = value,
    );
    _applyFamilyMember(
      sibling,
      setLastName: (value) => siblingLastName = value,
      setFirstName: (value) => siblingFirstName = value,
      setMiddleName: (value) => siblingMiddleName = value,
      setMobile: (value) => siblingMobile = value,
    );
    _applyFamilyMember(
      guardian,
      setLastName: (value) => guardianLastName = value,
      setFirstName: (value) => guardianFirstName = value,
      setMiddleName: (value) => guardianMiddleName = value,
      setMobile: (value) => guardianMobile = value,
      setEducation: (value) => guardianEducationalAttainment = value,
      setOccupation: (value) => guardianOccupation = value,
      setCompany: (value) => guardianCompanyNameAndAddress = value,
    );

    _setIfPresent(
      (value) => parentNativeStatus = value,
      _firstSavedString(family, ['parent_native_status', 'parentNativeStatus']),
    );
    _setIfPresent(
      (value) => parentMarilaoResidencyDuration = value,
      _firstSavedString(family, [
        'parent_marilao_residency_duration',
        'parentMarilaoResidencyDuration',
      ]),
    );
    _setIfPresent(
      (value) => parentPreviousTownProvince = value,
      _firstSavedString(family, [
        'parent_previous_town_province',
        'parentPreviousTownProvince',
      ]),
    );

    _setIfPresent(
      (value) => collegeSchool = value,
      _savedString(academic['college_school']),
    );
    _setIfPresent(
      (value) => collegeAddress = value,
      _savedString(academic['college_address']),
    );
    _setIfPresent(
      (value) => collegeHonors = value,
      _savedString(academic['college_honors']),
    );
    _setIfPresent(
      (value) => collegeClub = value,
      _savedString(academic['college_club']),
    );
    _setIfPresent(
      (value) => collegeYearGraduated = value,
      _savedString(academic['college_year_graduated']),
    );
    _setIfPresent(
      (value) => highSchoolSchool = value,
      _savedString(academic['high_school_school']),
    );
    _setIfPresent(
      (value) => highSchoolAddress = value,
      _savedString(academic['high_school_address']),
    );
    _setIfPresent(
      (value) => highSchoolHonors = value,
      _savedString(academic['high_school_honors']),
    );
    _setIfPresent(
      (value) => highSchoolClub = value,
      _savedString(academic['high_school_club']),
    );
    _setIfPresent(
      (value) => highSchoolYearGraduated = value,
      _savedString(academic['high_school_year_graduated']),
    );
    _setIfPresent(
      (value) => seniorHighSchool = value,
      _savedString(academic['senior_high_school']),
    );
    _setIfPresent(
      (value) => seniorHighAddress = value,
      _savedString(academic['senior_high_address']),
    );
    _setIfPresent(
      (value) => seniorHighHonors = value,
      _savedString(academic['senior_high_honors']),
    );
    _setIfPresent(
      (value) => seniorHighClub = value,
      _savedString(academic['senior_high_club']),
    );
    _setIfPresent(
      (value) => seniorHighYearGraduated = value,
      _savedString(academic['senior_high_year_graduated']),
    );
    _setIfPresent(
      (value) => elementarySchool = value,
      _savedString(academic['elementary_school']),
    );
    _setIfPresent(
      (value) => elementaryAddress = value,
      _savedString(academic['elementary_address']),
    );
    _setIfPresent(
      (value) => elementaryHonors = value,
      _savedString(academic['elementary_honors']),
    );
    _setIfPresent(
      (value) => elementaryClub = value,
      _savedString(academic['elementary_club']),
    );
    _setIfPresent(
      (value) => elementaryYearGraduated = value,
      _savedString(academic['elementary_year_graduated']),
    );
    _setIfPresent(
      (value) => currentCourse = value,
      _firstSavedString(academic, [
        'current_course_code',
        'current_course',
        'course_code',
        'current_course_name',
        'course_name',
      ]),
    );
    _setIfPresent(
      (value) => currentYearLevel = value,
      _firstSavedString(academic, ['current_year_level', 'year_level']),
    );
    _setIfPresent(
      (value) => currentSection = value,
      _firstSavedString(academic, ['current_section', 'section']),
    );
    _setIfPresent((value) => gwa = value, _savedString(academic['gwa']));

    _setIfPresent(
      (value) => financialSupport = value,
      _firstSavedString(support, [
        'financial_support',
        'financial_support_type',
      ]),
    );
    _setBoolIfPresent(
      (value) => scholarshipHistory = value,
      support['scholarship_history'] ?? support['has_prior_scholarship'],
    );
    _setBoolIfPresent(
      (value) => scholarshipElementary = value,
      support['scholarship_elementary'],
    );
    _setBoolIfPresent(
      (value) => scholarshipHighSchool = value,
      support['scholarship_high_school'],
    );
    _setBoolIfPresent(
      (value) => scholarshipCollege = value,
      support['scholarship_college'],
    );
    _setBoolIfPresent(
      (value) => scholarshipOthers = value,
      support['scholarship_others'],
    );
    _setIfPresent(
      (value) => scholarshipOthersSpecify = value,
      _firstSavedString(support, [
        'scholarship_others_specify',
        'financial_support_other',
      ]),
    );
    _setIfPresent(
      (value) => scholarshipDetails = value,
      _firstSavedString(support, [
        'scholarship_details',
        'prior_scholarship_details',
      ]),
    );

    _setBoolIfPresent(
      (value) => disciplinaryAction = value,
      discipline['disciplinary_action'] ??
          discipline['has_disciplinary_record'],
    );
    _setIfPresent(
      (value) => disciplinaryExplanation = value,
      _firstSavedString(discipline, [
        'disciplinary_explanation',
        'disciplinary_details',
      ]),
    );

    _setIfPresent(
      (value) => describeYourselfEssay = value,
      _firstSavedString(essays, [
        'describe_yourself_essay',
        'self_description',
      ]),
    );
    _setIfPresent(
      (value) => aimsAndAmbitionEssay = value,
      _firstSavedString(essays, [
        'aims_and_ambition_essay',
        'aims_and_ambitions',
      ]),
    );

    _setBoolIfPresent(
      (value) => certificationRead = value,
      certification['certification_read'],
    );
    _setBoolIfPresent((value) => agree = value, certification['agree']);
  }

  void _applyFamilyMember(
    Map<String, dynamic> member, {
    required void Function(String value) setLastName,
    required void Function(String value) setFirstName,
    required void Function(String value) setMiddleName,
    required void Function(String value) setMobile,
    void Function(String value)? setEducation,
    void Function(String value)? setOccupation,
    void Function(String value)? setCompany,
  }) {
    _setIfPresent(setLastName, _savedString(member['last_name']));
    _setIfPresent(setFirstName, _savedString(member['first_name']));
    _setIfPresent(setMiddleName, _savedString(member['middle_name']));
    _setIfPresent(
      setMobile,
      _firstSavedString(member, ['mobile', 'mobile_number']),
    );
    if (setEducation != null) {
      _setEducationalAttainment(
        setEducation,
        _firstSavedString(member, [
          'educational_attainment',
          'highest_educational_attainment',
        ]),
      );
    }
    if (setOccupation != null) {
      _setIfPresent(setOccupation, _savedString(member['occupation']));
    }
    if (setCompany != null) {
      _setIfPresent(
        setCompany,
        _firstSavedString(member, [
          'company_name_and_address',
          'company_name_address',
        ]),
      );
    }
  }

  Map<String, dynamic> toSubmissionPayload() {
    final normalizedMobile = normalizeMobileNumber(mobileNumber);
    return {
      'opening_id': openingId.trim(),
      'opening': {
        'opening_id': openingId.trim(),
        'opening_title': openingTitle.trim(),
        'program_name': openingProgramName.trim(),
      },
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
        'same_address_as_applicant': sameAddressAsApplicant,
        'father_present': fatherPresent,
        'mother_present': motherPresent,
        'guardian_only': guardianOnly,
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
        'gwa': gwa.trim(),
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

  Map<String, dynamic> toDraftPayload() {
    final payload = toSubmissionPayload();
    payload['opening'] = {
      'opening_id': openingId.trim(),
      'opening_title': openingTitle.trim(),
      'program_name': openingProgramName.trim(),
    };
    return payload;
  }
}
