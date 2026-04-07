import 'package:intl/intl.dart';

class SavedApplicationPrintModel {
  const SavedApplicationPrintModel({
    required this.lastName,
    required this.firstName,
    required this.middleName,
    required this.maidenName,
    required this.age,
    required this.dateOfBirth,
    required this.placeOfBirth,
    required this.citizenship,
    required this.religion,
    required this.civilStatus,
    required this.sex,
    required this.houseLotBlockNo,
    required this.phase,
    required this.street,
    required this.subdivision,
    required this.barangay,
    required this.city,
    required this.province,
    required this.zipCode,
    required this.landlineNumber,
    required this.mobileNumber,
    required this.email,
    required this.parentGuardianAddress,
    required this.fatherLastName,
    required this.fatherFirstName,
    required this.fatherMiddleName,
    required this.fatherMobile,
    required this.fatherEducationalAttainment,
    required this.fatherOccupation,
    required this.fatherCompanyNameAddress,
    required this.motherLastName,
    required this.motherFirstName,
    required this.motherMiddleName,
    required this.motherMobile,
    required this.motherEducationalAttainment,
    required this.motherOccupation,
    required this.motherCompanyNameAddress,
    required this.siblingLastName,
    required this.siblingFirstName,
    required this.siblingMiddleName,
    required this.siblingMobile,
    required this.guardianLastName,
    required this.guardianFirstName,
    required this.guardianMiddleName,
    required this.guardianMobile,
    required this.guardianEducationalAttainment,
    required this.guardianOccupation,
    required this.guardianCompanyNameAddress,
    required this.isFatherOnlyNative,
    required this.isMotherOnlyNative,
    required this.isBothParentsNative,
    required this.isNotNative,
    required this.yearsResident,
    required this.originProvince,
    required this.collegeSchool,
    required this.collegeAddress,
    required this.collegeHonors,
    required this.collegeClub,
    required this.collegeYearGraduated,
    required this.highSchoolSchool,
    required this.highSchoolAddress,
    required this.highSchoolHonors,
    required this.highSchoolClub,
    required this.highSchoolYearGraduated,
    required this.seniorHighSchool,
    required this.seniorHighAddress,
    required this.seniorHighHonors,
    required this.seniorHighClub,
    required this.seniorHighYearGraduated,
    required this.elementarySchool,
    required this.elementaryAddress,
    required this.elementaryHonors,
    required this.elementaryClub,
    required this.elementaryYearGraduated,
    required this.currentYearSection,
    required this.studentNumber,
    required this.learnersReferenceNumber,
    required this.currentCourse,
    required this.financialSupport,
    required this.financialSupportOther,
    required this.supportParents,
    required this.supportScholarship,
    required this.supportLoan,
    required this.supportOther,
    required this.hadScholarship,
    required this.noScholarshipHistory,
    required this.scholarshipDetails,
    required this.hasDisciplinaryRecord,
    required this.noDisciplinaryRecord,
    required this.disciplinaryDetails,
    required this.selfDescription,
    required this.aimsAndAmbitions,
    required this.applicantPrintedName,
    required this.parentGuardianPrintedName,
    required this.printedDate,
  });

  final String lastName;
  final String firstName;
  final String middleName;
  final String maidenName;
  final String age;
  final String dateOfBirth;
  final String placeOfBirth;
  final String citizenship;
  final String religion;
  final String civilStatus;
  final String sex;
  final String houseLotBlockNo;
  final String phase;
  final String street;
  final String subdivision;
  final String barangay;
  final String city;
  final String province;
  final String zipCode;
  final String landlineNumber;
  final String mobileNumber;
  final String email;
  final String parentGuardianAddress;
  final String fatherLastName;
  final String fatherFirstName;
  final String fatherMiddleName;
  final String fatherMobile;
  final String fatherEducationalAttainment;
  final String fatherOccupation;
  final String fatherCompanyNameAddress;
  final String motherLastName;
  final String motherFirstName;
  final String motherMiddleName;
  final String motherMobile;
  final String motherEducationalAttainment;
  final String motherOccupation;
  final String motherCompanyNameAddress;
  final String siblingLastName;
  final String siblingFirstName;
  final String siblingMiddleName;
  final String siblingMobile;
  final String guardianLastName;
  final String guardianFirstName;
  final String guardianMiddleName;
  final String guardianMobile;
  final String guardianEducationalAttainment;
  final String guardianOccupation;
  final String guardianCompanyNameAddress;
  final bool isFatherOnlyNative;
  final bool isMotherOnlyNative;
  final bool isBothParentsNative;
  final bool isNotNative;
  final String yearsResident;
  final String originProvince;
  final String collegeSchool;
  final String collegeAddress;
  final String collegeHonors;
  final String collegeClub;
  final String collegeYearGraduated;
  final String highSchoolSchool;
  final String highSchoolAddress;
  final String highSchoolHonors;
  final String highSchoolClub;
  final String highSchoolYearGraduated;
  final String seniorHighSchool;
  final String seniorHighAddress;
  final String seniorHighHonors;
  final String seniorHighClub;
  final String seniorHighYearGraduated;
  final String elementarySchool;
  final String elementaryAddress;
  final String elementaryHonors;
  final String elementaryClub;
  final String elementaryYearGraduated;
  final String currentYearSection;
  final String studentNumber;
  final String learnersReferenceNumber;
  final String currentCourse;
  final String financialSupport;
  final String financialSupportOther;
  final bool supportParents;
  final bool supportScholarship;
  final bool supportLoan;
  final bool supportOther;
  final bool hadScholarship;
  final bool noScholarshipHistory;
  final String scholarshipDetails;
  final bool hasDisciplinaryRecord;
  final bool noDisciplinaryRecord;
  final String disciplinaryDetails;
  final String selfDescription;
  final String aimsAndAmbitions;
  final String applicantPrintedName;
  final String parentGuardianPrintedName;
  final String printedDate;

  factory SavedApplicationPrintModel.fromApi(Map<String, dynamic> payload) {
    final student = _map(payload['student']);
    final profile = _map(payload['student_profile']);
    final familyMembers = _mapList(payload['family_members']);
    final educationRecords = _mapList(payload['education_records']);

    final father = _findByRelation(familyMembers, 'Father');
    final mother = _findByRelation(familyMembers, 'Mother');
    final sibling = _findByRelation(familyMembers, 'Sibling');
    final guardian = _findByRelation(familyMembers, 'Guardian');

    final college = _findByEducationLevel(educationRecords, 'College');
    final highSchool = _findByEducationLevel(educationRecords, 'High School');
    final seniorHigh = _findByEducationLevel(
      educationRecords,
      'Senior High School',
    );
    final elementary = _findByEducationLevel(educationRecords, 'Elementary');

    final fatherNative = father['is_marilao_native'] == true;
    final motherNative = mother['is_marilao_native'] == true;
    final fatherNonNative = father['is_marilao_native'] == false;
    final motherNonNative = mother['is_marilao_native'] == false;
    final financialSupport = _string(profile['financial_support_type']);
    final currentYearLevel = _string(student['year_level']);
    final currentSection = _string(profile['current_section']);
    final dateOfBirthRaw = _string(profile['date_of_birth']);
    final parsedDob = DateTime.tryParse(dateOfBirthRaw);

    return SavedApplicationPrintModel(
      lastName: _string(student['last_name']),
      firstName: _string(student['first_name']),
      middleName: _string(student['middle_name']),
      maidenName: _string(profile['maiden_name']),
      age: _calculateAge(parsedDob),
      dateOfBirth: _formatDate(dateOfBirthRaw),
      placeOfBirth: _string(profile['place_of_birth']),
      citizenship: _string(profile['citizenship']),
      religion: _string(profile['religion']),
      civilStatus: _string(profile['civil_status']),
      sex: _string(profile['sex']),
      houseLotBlockNo: '',
      phase: '',
      street: _string(profile['street_address']),
      subdivision: _string(profile['subdivision']),
      barangay: _string(student['barangay']),
      city: _string(profile['city']),
      province: _string(profile['province']),
      zipCode: _string(profile['zip_code']),
      landlineNumber: _string(profile['landline_number']),
      mobileNumber: _string(student['phone_number']),
      email: _string(student['email']),
      parentGuardianAddress: _firstNonEmpty([
        _string(guardian['address']),
        _string(father['address']),
        _string(mother['address']),
      ]),
      fatherLastName: _string(father['last_name']),
      fatherFirstName: _string(father['first_name']),
      fatherMiddleName: _string(father['middle_name']),
      fatherMobile: _string(father['mobile_number']),
      fatherEducationalAttainment: _string(
        father['highest_educational_attainment'],
      ),
      fatherOccupation: _string(father['occupation']),
      fatherCompanyNameAddress: _string(father['company_name_address']),
      motherLastName: _string(mother['last_name']),
      motherFirstName: _string(mother['first_name']),
      motherMiddleName: _string(mother['middle_name']),
      motherMobile: _string(mother['mobile_number']),
      motherEducationalAttainment: _string(
        mother['highest_educational_attainment'],
      ),
      motherOccupation: _string(mother['occupation']),
      motherCompanyNameAddress: _string(mother['company_name_address']),
      siblingLastName: _string(sibling['last_name']),
      siblingFirstName: _string(sibling['first_name']),
      siblingMiddleName: _string(sibling['middle_name']),
      siblingMobile: _string(sibling['mobile_number']),
      guardianLastName: _string(guardian['last_name']),
      guardianFirstName: _string(guardian['first_name']),
      guardianMiddleName: _string(guardian['middle_name']),
      guardianMobile: _string(guardian['mobile_number']),
      guardianEducationalAttainment: _string(
        guardian['highest_educational_attainment'],
      ),
      guardianOccupation: _string(guardian['occupation']),
      guardianCompanyNameAddress: _string(guardian['company_name_address']),
      isFatherOnlyNative: fatherNative && !motherNative,
      isMotherOnlyNative: motherNative && !fatherNative,
      isBothParentsNative: fatherNative && motherNative,
      isNotNative: fatherNonNative && motherNonNative,
      yearsResident: _firstNonEmpty([
        _string(father['years_as_resident']),
        _string(mother['years_as_resident']),
      ]),
      originProvince: _firstNonEmpty([
        _string(father['origin_province']),
        _string(mother['origin_province']),
      ]),
      collegeSchool: _string(college['school_name']),
      collegeAddress: _string(college['school_address']),
      collegeHonors: _string(college['honors_awards']),
      collegeClub: _string(college['club_organization']),
      collegeYearGraduated: _string(college['year_graduated']),
      highSchoolSchool: _string(highSchool['school_name']),
      highSchoolAddress: _string(highSchool['school_address']),
      highSchoolHonors: _string(highSchool['honors_awards']),
      highSchoolClub: _string(highSchool['club_organization']),
      highSchoolYearGraduated: _string(highSchool['year_graduated']),
      seniorHighSchool: _string(seniorHigh['school_name']),
      seniorHighAddress: _string(seniorHigh['school_address']),
      seniorHighHonors: _string(seniorHigh['honors_awards']),
      seniorHighClub: _string(seniorHigh['club_organization']),
      seniorHighYearGraduated: _string(seniorHigh['year_graduated']),
      elementarySchool: _string(elementary['school_name']),
      elementaryAddress: _string(elementary['school_address']),
      elementaryHonors: _string(elementary['honors_awards']),
      elementaryClub: _string(elementary['club_organization']),
      elementaryYearGraduated: _string(elementary['year_graduated']),
      currentYearSection: _joinNonEmpty([
        currentYearLevel,
        currentSection,
      ], separator: ' / '),
      studentNumber: _string(student['pdm_id']),
      learnersReferenceNumber: _string(profile['learners_reference_number']),
      currentCourse: _string(student['course_code']),
      financialSupport: financialSupport,
      financialSupportOther: _string(profile['financial_support_other']),
      supportParents: financialSupport.toLowerCase() == 'parents',
      supportScholarship: financialSupport.toLowerCase() == 'scholarship',
      supportLoan: financialSupport.toLowerCase() == 'loan',
      supportOther: financialSupport.toLowerCase() == 'other',
      hadScholarship: profile['has_prior_scholarship'] == true,
      noScholarshipHistory: profile['has_prior_scholarship'] != true,
      scholarshipDetails: _string(profile['prior_scholarship_details']),
      hasDisciplinaryRecord: profile['has_disciplinary_record'] == true,
      noDisciplinaryRecord: profile['has_disciplinary_record'] != true,
      disciplinaryDetails: _string(profile['disciplinary_details']),
      selfDescription: _string(profile['self_description']),
      aimsAndAmbitions: _string(profile['aims_and_ambitions']),
      applicantPrintedName: _joinNonEmpty([
        _string(student['first_name']),
        _string(student['middle_name']),
        _string(student['last_name']),
      ]),
      parentGuardianPrintedName: _firstNonEmpty([
        _joinNonEmpty([
          _string(guardian['first_name']),
          _string(guardian['middle_name']),
          _string(guardian['last_name']),
        ]),
        _joinNonEmpty([
          _string(father['first_name']),
          _string(father['middle_name']),
          _string(father['last_name']),
        ]),
        _joinNonEmpty([
          _string(mother['first_name']),
          _string(mother['middle_name']),
          _string(mother['last_name']),
        ]),
      ]),
      printedDate: DateFormat('MM/dd/yyyy').format(DateTime.now()),
    );
  }

  static Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) {
      return value.map((key, mapValue) => MapEntry('$key', mapValue));
    }
    return <String, dynamic>{};
  }

  static List<Map<String, dynamic>> _mapList(dynamic value) {
    if (value is! List) return const <Map<String, dynamic>>[];
    return value.map(_map).toList();
  }

  static Map<String, dynamic> _findByRelation(
    List<Map<String, dynamic>> records,
    String relation,
  ) {
    return records.firstWhere(
      (record) => _string(record['relation']).toLowerCase() == relation.toLowerCase(),
      orElse: () => <String, dynamic>{},
    );
  }

  static Map<String, dynamic> _findByEducationLevel(
    List<Map<String, dynamic>> records,
    String level,
  ) {
    return records.firstWhere(
      (record) =>
          _string(record['education_level']).toLowerCase() == level.toLowerCase(),
      orElse: () => <String, dynamic>{},
    );
  }

  static String _string(dynamic value) {
    if (value == null) return '';
    return '$value'.trim();
  }

  static String _firstNonEmpty(List<String> values) {
    for (final value in values) {
      if (value.trim().isNotEmpty) return value.trim();
    }
    return '';
  }

  static String _joinNonEmpty(
    List<String> values, {
    String separator = ' ',
  }) {
    return values.where((value) => value.trim().isNotEmpty).join(separator);
  }

  static String _formatDate(String raw) {
    if (raw.trim().isEmpty) return '';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    return DateFormat('MM/dd/yyyy').format(parsed);
  }

  static String _calculateAge(DateTime? birthDate) {
    if (birthDate == null) return '';
    final now = DateTime.now();
    var age = now.year - birthDate.year;
    final birthdayPassed =
        now.month > birthDate.month ||
        (now.month == birthDate.month && now.day >= birthDate.day);
    if (!birthdayPassed) {
      age -= 1;
    }
    return '$age';
  }
}
