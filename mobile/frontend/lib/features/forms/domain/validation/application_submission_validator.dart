import 'package:smartpdm_mobileapp/shared/formatters/student_id_input_formatter.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/shared/validation/app_field_validators.dart';

enum ApplicationSubmissionSection {
  account,
  personal,
  family,
  academic,
  essay,
  certification,
}

class ApplicationSubmissionIssue {
  const ApplicationSubmissionIssue({
    required this.code,
    required this.section,
    required this.field,
    required this.message,
    required this.repairAction,
  });

  final String code;
  final ApplicationSubmissionSection section;
  final String field;
  final String message;
  final String repairAction;
}

class ApplicationSubmissionValidationResult {
  const ApplicationSubmissionValidationResult(this.issues);

  final List<ApplicationSubmissionIssue> issues;

  bool get isValid => issues.isEmpty;

  ApplicationSubmissionIssue? issueForField(String field) {
    for (final issue in issues) {
      if (issue.field == field) return issue;
    }
    return null;
  }

  String? get firstMessage => issues.isEmpty ? null : issues.first.message;

  List<String> get repairActions =>
      issues.map((issue) => issue.repairAction).toList(growable: false);
}

class ApplicationSubmissionValidator {
  const ApplicationSubmissionValidator();

  ApplicationSubmissionValidationResult validatePersonalProgression(
    ApplicationData data,
  ) {
    return ApplicationSubmissionValidationResult(_validatePersonalFields(data));
  }

  ApplicationSubmissionValidationResult validateFamilyProgression(
    ApplicationData data,
  ) {
    return ApplicationSubmissionValidationResult(_validateFamilyFields(data));
  }

  ApplicationSubmissionValidationResult validateAcademicProgression(
    ApplicationData data,
  ) {
    return ApplicationSubmissionValidationResult(_validateAcademicFields(data));
  }

  ApplicationSubmissionValidationResult validateEssayProgression(
    ApplicationData data,
  ) {
    return ApplicationSubmissionValidationResult(<ApplicationSubmissionIssue>[
      ..._validateEssayField(
        field: 'describeYourselfEssay',
        label: 'Describe yourself essay',
        value: data.describeYourselfEssay,
      ),
      ..._validateEssayField(
        field: 'aimsAndAmbitionEssay',
        label: 'Aims and ambition essay',
        value: data.aimsAndAmbitionEssay,
      ),
    ]);
  }

  ApplicationSubmissionValidationResult validateReviewReadiness(
    ApplicationData data,
  ) {
    return ApplicationSubmissionValidationResult(<ApplicationSubmissionIssue>[
      ..._validateAccountFields(data),
      ..._validatePersonalFields(data),
      ..._validateFamilyFields(data),
      ..._validateAcademicFields(data),
      ..._validateEssayField(
        field: 'describeYourselfEssay',
        label: 'Describe yourself essay',
        value: data.describeYourselfEssay,
      ),
      ..._validateEssayField(
        field: 'aimsAndAmbitionEssay',
        label: 'Aims and ambition essay',
        value: data.aimsAndAmbitionEssay,
      ),
      ..._validateCertificationFields(data),
    ]);
  }

  ApplicationSubmissionValidationResult validateSubmissionPreflight(
    ApplicationData data,
  ) {
    return validateReviewReadiness(data);
  }

  static int essayWordCount(String value) {
    final text = value.trim();
    if (text.isEmpty) return 0;
    return text.split(RegExp(r'\s+')).length;
  }

  List<ApplicationSubmissionIssue> _validateAccountFields(
    ApplicationData data,
  ) {
    final issues = <ApplicationSubmissionIssue>[];

    if (_isBlank(data.openingId)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'application.scholarship.required',
          section: ApplicationSubmissionSection.account,
          field: 'openingId',
          message: 'Choose a scholarship before submitting.',
          repairAction:
              'Return to Available Scholarships and select a scholarship.',
        ),
      );
    }

    if (_isBlank(data.userId)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'account.user_id_missing',
          section: ApplicationSubmissionSection.account,
          field: 'userId',
          message: 'Your logged-in account is missing a user ID.',
          repairAction: 'Log in again so your account profile can load.',
        ),
      );
    }

    if (_isBlank(data.accountStudentId)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'account.student_id_missing',
          section: ApplicationSubmissionSection.account,
          field: 'accountStudentId',
          message: 'Your logged-in account is missing a student ID.',
          repairAction: 'Log in again so your student ID can load.',
        ),
      );
    }

    return issues;
  }

  List<ApplicationSubmissionIssue> _validatePersonalFields(
    ApplicationData data,
  ) {
    final issues = <ApplicationSubmissionIssue>[];

    void requireText({required String field, required String label}) {
      if (_isBlank(_valueForField(data, field))) {
        issues.add(
          ApplicationSubmissionIssue(
            code: 'personal.$field.required',
            section: ApplicationSubmissionSection.personal,
            field: field,
            message: '$label is required.',
            repairAction: 'Enter your $label.',
          ),
        );
      }
    }

    requireText(field: 'lastName', label: 'Last name');
    requireText(field: 'firstName', label: 'First name');

    for (final entry in <String, String>{
      'lastName': data.lastName,
      'firstName': data.firstName,
      'middleName': data.middleName,
      'maidenName': data.maidenName,
    }.entries) {
      if (_isBlank(entry.value)) continue;
      final label = switch (entry.key) {
        'lastName' => 'Last name',
        'firstName' => 'First name',
        'middleName' => 'Middle name',
        _ => 'Maiden name',
      };
      final error = AppFieldValidators.name(
        entry.value,
        label: label,
        required: false,
        minLength: entry.key == 'middleName' ? 1 : 2,
      );
      if (error != null) {
        issues.add(
          ApplicationSubmissionIssue(
            code: 'personal.${entry.key}.invalid',
            section: ApplicationSubmissionSection.personal,
            field: entry.key,
            message: error,
            repairAction: 'Use letters and standard name punctuation only.',
          ),
        );
      }
    }

    requireText(field: 'age', label: 'Age');
    requireText(field: 'dateOfBirth', label: 'Date of birth');
    requireText(field: 'sex', label: 'Sex');
    requireText(field: 'placeOfBirth', label: 'Place of birth');
    requireText(field: 'citizenship', label: 'Citizenship');
    requireText(field: 'civilStatus', label: 'Civil status');
    requireText(field: 'religion', label: 'Religion');

    DateTime? birthDate;
    if (!_isBlank(data.dateOfBirth)) {
      birthDate = ApplicationData.parseInputDate(data.dateOfBirth);
      if (birthDate == null || birthDate.isAfter(DateTime.now())) {
        issues.add(
          const ApplicationSubmissionIssue(
            code: 'personal.date_of_birth.invalid',
            section: ApplicationSubmissionSection.personal,
            field: 'dateOfBirth',
            message: 'Date of birth must be a valid past date.',
            repairAction: 'Choose a valid date of birth.',
          ),
        );
      }
    }

    if (!_isBlank(data.age)) {
      final inputAge = ApplicationData.parseAgeValue(data.age);
      if (inputAge == null) {
        issues.add(
          const ApplicationSubmissionIssue(
            code: 'personal.age.invalid',
            section: ApplicationSubmissionSection.personal,
            field: 'age',
            message: 'Age must be a valid number.',
            repairAction: 'Enter your age as a number.',
          ),
        );
      } else if (inputAge < 0) {
        issues.add(
          const ApplicationSubmissionIssue(
            code: 'personal.age.negative',
            section: ApplicationSubmissionSection.personal,
            field: 'age',
            message: 'Age cannot be negative.',
            repairAction: 'Enter a non-negative age.',
          ),
        );
      } else if (inputAge < 16) {
        issues.add(
          const ApplicationSubmissionIssue(
            code: 'personal.age.minimum',
            section: ApplicationSubmissionSection.personal,
            field: 'age',
            message: 'Age must be at least 16.',
            repairAction:
                'Update the age to reflect an applicant who is 16 or older.',
          ),
        );
      } else {
        final computedAge = ApplicationData.calculateAge(birthDate);
        if (computedAge == null || inputAge != computedAge) {
          issues.add(
            const ApplicationSubmissionIssue(
              code: 'personal.age.mismatch',
              section: ApplicationSubmissionSection.personal,
              field: 'age',
              message: 'Age must match the selected date of birth.',
              repairAction: 'Make the age and birth date match.',
            ),
          );
        }
      }
    }

    final mobileError = AppFieldValidators.philippineMobile(data.mobileNumber);
    if (mobileError != null) {
      issues.add(
        ApplicationSubmissionIssue(
          code: 'contact.mobile.invalid',
          section: ApplicationSubmissionSection.personal,
          field: 'mobileNumber',
          message: mobileError,
          repairAction:
              'Enter a Philippine mobile number in 09XXXXXXXXX format.',
        ),
      );
    }

    final requiredAddressFields = <String, String>{
      'barangay': data.barangay,
      'city': data.city,
      'province': data.province,
    };
    for (final entry in requiredAddressFields.entries) {
      if (_isBlank(entry.value)) {
        final label = '${entry.key[0].toUpperCase()}${entry.key.substring(1)}';
        issues.add(
          ApplicationSubmissionIssue(
            code: 'personal.address.${entry.key}.required',
            section: ApplicationSubmissionSection.personal,
            field: entry.key,
            message: '$label is required.',
            repairAction: 'Enter your $label.',
          ),
        );
      }
    }

    final zipError = AppFieldValidators.zipCode(data.zipCode);
    if (zipError != null) {
      issues.add(
        ApplicationSubmissionIssue(
          code: 'personal.address.zip_code.invalid',
          section: ApplicationSubmissionSection.personal,
          field: 'zipCode',
          message: zipError,
          repairAction: 'Enter the 4-digit Philippine ZIP code.',
        ),
      );
    }

    final hasStreetAddress =
        data.houseLotBlockNo.trim().isNotEmpty ||
        data.unitBldgNo.trim().isNotEmpty ||
        data.street.trim().isNotEmpty ||
        data.subdivision.trim().isNotEmpty;
    if (!hasStreetAddress) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'personal.address.street.required',
          section: ApplicationSubmissionSection.personal,
          field: 'streetAddress',
          message: 'House, building, street, or subdivision is required.',
          repairAction: 'Enter at least one detailed street address field.',
        ),
      );
    }

    final emailError = AppFieldValidators.email(data.email);
    if (emailError != null) {
      issues.add(
        ApplicationSubmissionIssue(
          code: 'contact.email.invalid',
          section: ApplicationSubmissionSection.personal,
          field: 'email',
          message: emailError,
          repairAction: 'Correct the email address format.',
        ),
      );
    }

    return issues;
  }

  List<ApplicationSubmissionIssue> _validateFamilyFields(ApplicationData data) {
    final issues = <ApplicationSubmissionIssue>[];

    final familyNames = <String, String>{
      'fatherLastName': data.fatherLastName,
      'fatherFirstName': data.fatherFirstName,
      'fatherMiddleName': data.fatherMiddleName,
      'motherLastName': data.motherLastName,
      'motherFirstName': data.motherFirstName,
      'motherMiddleName': data.motherMiddleName,
      'siblingLastName': data.siblingLastName,
      'siblingFirstName': data.siblingFirstName,
      'siblingMiddleName': data.siblingMiddleName,
      'guardianLastName': data.guardianLastName,
      'guardianFirstName': data.guardianFirstName,
      'guardianMiddleName': data.guardianMiddleName,
    };

    for (final entry in familyNames.entries) {
      if (_isBlank(entry.value)) continue;
      final error = AppFieldValidators.name(
        entry.value,
        label: 'Name',
        required: false,
        minLength: entry.key.endsWith('MiddleName') ? 1 : 2,
      );
      if (error != null) {
        issues.add(
          ApplicationSubmissionIssue(
            code: 'family.${entry.key}.invalid',
            section: ApplicationSubmissionSection.family,
            field: entry.key,
            message: error,
            repairAction: 'Use letters and standard name punctuation only.',
          ),
        );
      }
    }

    if (!data.sameAddressAsApplicant && _isBlank(data.parentGuardianAddress)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'family.parent_address.required',
          section: ApplicationSubmissionSection.family,
          field: 'parentGuardianAddress',
          message: 'Parent or guardian address is required.',
          repairAction:
              'Enter the parent or guardian address or mark it as the same as the applicant.',
        ),
      );
    }

    final hasNamedFather =
        data.fatherPresent &&
        _hasText(data.fatherFirstName) &&
        _hasText(data.fatherLastName);
    final hasNamedMother =
        data.motherPresent &&
        _hasText(data.motherFirstName) &&
        _hasText(data.motherLastName);
    final hasNamedGuardian =
        _hasText(data.guardianFirstName) && _hasText(data.guardianLastName);

    if (!hasNamedFather && !hasNamedMother && !hasNamedGuardian) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'family.primary_carer.required',
          section: ApplicationSubmissionSection.family,
          field: 'familyPrimaryCarer',
          message:
              'Enter the complete name of at least one parent or guardian.',
          repairAction:
              'Enter both the first and last name of at least one parent or guardian.',
        ),
      );
    }

    if (data.guardianOnly && !hasNamedGuardian) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'family.guardian.required',
          section: ApplicationSubmissionSection.family,
          field: 'guardianName',
          message: 'Guardian name is required.',
          repairAction: 'Enter the guardian name.',
        ),
      );
    }

    void validateFamilyMobile({
      required String field,
      required String label,
      required String value,
    }) {
      final error = AppFieldValidators.philippineMobile(
        value,
        label: label,
        required: false,
      );
      if (error != null) {
        issues.add(
          ApplicationSubmissionIssue(
            code: 'family.$field.format',
            section: ApplicationSubmissionSection.family,
            field: field,
            message: error,
            repairAction:
                'Enter a Philippine mobile number in 09XXXXXXXXX format.',
          ),
        );
      }
    }

    validateFamilyMobile(
      field: 'fatherMobile',
      label: 'Father mobile number',
      value: data.fatherMobile,
    );
    validateFamilyMobile(
      field: 'motherMobile',
      label: 'Mother mobile number',
      value: data.motherMobile,
    );
    validateFamilyMobile(
      field: 'siblingMobile',
      label: 'Sibling mobile number',
      value: data.siblingMobile,
    );
    validateFamilyMobile(
      field: 'guardianMobile',
      label: 'Guardian mobile number',
      value: data.guardianMobile,
    );

    if (!data.guardianOnly) {
      final parentNativeStatus = data.parentNativeStatus.trim();

      if (parentNativeStatus == 'Yes, father only' ||
          parentNativeStatus == 'Yes, mother only' ||
          parentNativeStatus == 'Yes, both parents') {
        if (_isBlank(data.parentMarilaoResidencyDuration)) {
          issues.add(
            const ApplicationSubmissionIssue(
              code: 'family.residency.required',
              section: ApplicationSubmissionSection.family,
              field: 'parentMarilaoResidencyDuration',
              message:
                  'Residency duration is required when parents are native of Marilao.',
              repairAction:
                  'Enter how long the parent or parents have lived in Marilao.',
            ),
          );
        } else if (!RegExp(
          r'^\d+$',
        ).hasMatch(data.parentMarilaoResidencyDuration.trim())) {
          issues.add(
            const ApplicationSubmissionIssue(
              code: 'family.residency.invalid',
              section: ApplicationSubmissionSection.family,
              field: 'parentMarilaoResidencyDuration',
              message: 'Years as resident must contain digits only.',
              repairAction: 'Enter the number of years as a whole number.',
            ),
          );
        }
      } else if (parentNativeStatus == 'No') {
        if (_isBlank(data.parentPreviousTownMunicipality)) {
          issues.add(
            const ApplicationSubmissionIssue(
              code: 'family.origin_town.required',
              section: ApplicationSubmissionSection.family,
              field: 'parentPreviousTownMunicipality',
              message:
                  'Town or municipality is required when parents are not native of Marilao.',
              repairAction:
                  'Enter the town or municipality the parent or parents came from.',
            ),
          );
        }
      }
    }

    return issues;
  }

  List<ApplicationSubmissionIssue> _validateAcademicFields(
    ApplicationData data,
  ) {
    final issues = <ApplicationSubmissionIssue>[];

    void requireText({required String field, required String label}) {
      if (_isBlank(_valueForField(data, field))) {
        issues.add(
          ApplicationSubmissionIssue(
            code: 'academic.$field.required',
            section: ApplicationSubmissionSection.academic,
            field: field,
            message: '$label is required.',
            repairAction: 'Enter your $label.',
          ),
        );
      }
    }

    requireText(field: 'collegeSchool', label: 'College school');
    requireText(field: 'collegeAddress', label: 'College address');
    requireText(
      field: 'collegeYearGraduated',
      label: 'College year graduated or status',
    );
    requireText(field: 'highSchoolSchool', label: 'Junior high school');
    requireText(
      field: 'highSchoolAddress',
      label: 'Junior high school address',
    );
    requireText(
      field: 'highSchoolYearGraduated',
      label: 'Junior high school year graduated',
    );
    requireText(field: 'seniorHighSchool', label: 'Senior high school');
    requireText(
      field: 'seniorHighAddress',
      label: 'Senior high school address',
    );
    requireText(
      field: 'seniorHighYearGraduated',
      label: 'Senior high school year graduated',
    );
    requireText(field: 'elementarySchool', label: 'Elementary school');
    requireText(field: 'elementaryAddress', label: 'Elementary school address');
    requireText(
      field: 'elementaryYearGraduated',
      label: 'Elementary year graduated',
    );

    final collegeYear = data.collegeYearGraduated.trim();
    final normalizedCollegeYear = collegeYear.toLowerCase().replaceAll(
      RegExp(r'\s+'),
      '',
    );

    // "Ongoing" is the canonical value used by the current UI. Accept the
    // legacy "On Going" spelling as well so previously saved drafts continue
    // to validate correctly.
    if (collegeYear.isNotEmpty && normalizedCollegeYear != 'ongoing') {
      final parsedCollegeYear = int.tryParse(collegeYear);
      if (parsedCollegeYear == null || parsedCollegeYear < 2026) {
        issues.add(
          const ApplicationSubmissionIssue(
            code: 'academic.college_year.invalid',
            section: ApplicationSubmissionSection.academic,
            field: 'collegeYearGraduated',
            message:
                'Select Ongoing or a college graduation year of 2026 or later.',
            repairAction:
                'Choose Ongoing or select a college graduation year from 2026 onward.',
          ),
        );
      }
    }

    requireText(field: 'currentCourse', label: 'Course');
    requireText(field: 'currentYearLevel', label: 'Year level');
    requireText(field: 'studentNumber', label: 'Student number');
    requireText(field: 'financialSupport', label: 'Financial support');

    final yearLevelError = AppFieldValidators.yearLevel(
      data.currentYearLevel,
      required: false,
    );
    if (yearLevelError != null) {
      issues.add(
        ApplicationSubmissionIssue(
          code: 'academic.year_level.range',
          section: ApplicationSubmissionSection.academic,
          field: 'currentYearLevel',
          message: yearLevelError,
          repairAction: 'Choose a year level between 1 and 4.',
        ),
      );
    }

    if (_hasText(data.studentNumber)) {
      final studentIdError = StudentIdInputFormatter.validationMessage(
        data.studentNumber,
      );
      if (studentIdError != null) {
        issues.add(
          ApplicationSubmissionIssue(
            code: 'academic.student_number.invalid',
            section: ApplicationSubmissionSection.academic,
            field: 'studentNumber',
            message: studentIdError,
            repairAction: 'Use the official PDM student ID format.',
          ),
        );
      }
    }

    final submittedStudentId = StudentIdInputFormatter.toFullStudentId(
      data.studentNumber,
    );
    final accountStudentId = StudentIdInputFormatter.toFullStudentId(
      data.accountStudentId,
    );
    if (submittedStudentId.isNotEmpty &&
        accountStudentId.isNotEmpty &&
        submittedStudentId != accountStudentId) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'academic.student_number.account_mismatch',
          section: ApplicationSubmissionSection.academic,
          field: 'studentNumber',
          message: 'Student number must match your logged-in account.',
          repairAction: 'Match the student number to the account student ID.',
        ),
      );
    }

    if (data.financialSupport
            .split(',')
            .map((value) => value.trim())
            .contains('Other') &&
        _isBlank(data.financialSupportOtherSpecify)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'academic.financial_support.other.required',
          section: ApplicationSubmissionSection.academic,
          field: 'financialSupportOtherSpecify',
          message: 'Please specify the other financial support.',
          repairAction: 'Describe the other source of financial support.',
        ),
      );
    }

    if (!data.scholarshipHistoryAnswered) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'academic.scholarship_history.answer.required',
          section: ApplicationSubmissionSection.academic,
          field: 'scholarshipHistory',
          message: 'Answer the scholarship history question.',
          repairAction: 'Select Yes or No before continuing.',
        ),
      );
    } else if (data.scholarshipHistory &&
        !(data.scholarshipElementary ||
            data.scholarshipHighSchool ||
            data.scholarshipCollege ||
            data.scholarshipOthers)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'academic.scholarship_history.level.required',
          section: ApplicationSubmissionSection.academic,
          field: 'scholarshipHistory',
          message: 'Select at least one scholarship history level.',
          repairAction:
              'Choose Elementary, Junior High School, College, or Others.',
        ),
      );
    }

    if (data.scholarshipHistory &&
        data.scholarshipOthers &&
        _isBlank(data.scholarshipOthersSpecify)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'academic.scholarship_history.other.required',
          section: ApplicationSubmissionSection.academic,
          field: 'scholarshipOthersSpecify',
          message: 'Please specify the other scholarship history.',
          repairAction: 'Describe the other scholarship history option.',
        ),
      );
    }

    if (!data.disciplinaryActionAnswered) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'academic.disciplinary.answer.required',
          section: ApplicationSubmissionSection.academic,
          field: 'disciplinaryAction',
          message: 'Answer the disciplinary action question.',
          repairAction: 'Select Yes or No before continuing.',
        ),
      );
    }

    if (data.disciplinaryAction && _isBlank(data.disciplinaryExplanation)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'academic.disciplinary_explanation.required',
          section: ApplicationSubmissionSection.academic,
          field: 'disciplinaryExplanation',
          message: 'Please explain the disciplinary action.',
          repairAction: 'Explain the disciplinary action before submitting.',
        ),
      );
    }

    return issues;
  }

  List<ApplicationSubmissionIssue> _validateEssayField({
    required String field,
    required String label,
    required String value,
  }) {
    if (_hasText(value)) {
      return const <ApplicationSubmissionIssue>[];
    }

    return <ApplicationSubmissionIssue>[
      ApplicationSubmissionIssue(
        code: 'essay.$field.required',
        section: ApplicationSubmissionSection.essay,
        field: field,
        message: '$label is required.',
        repairAction: 'Write your $label before continuing.',
      ),
    ];
  }

  List<ApplicationSubmissionIssue> _validateCertificationFields(
    ApplicationData data,
  ) {
    final issues = <ApplicationSubmissionIssue>[];

    if (!data.certificationRead) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'certification.read.required',
          section: ApplicationSubmissionSection.certification,
          field: 'certificationRead',
          message: 'You must confirm the certification statement.',
          repairAction: 'Check the certification statement.',
        ),
      );
    }

    if (!data.agree) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'certification.agree.required',
          section: ApplicationSubmissionSection.certification,
          field: 'agree',
          message: 'You must agree to the legal terms and privacy statement.',
          repairAction: 'Accept the terms of service and privacy statement.',
        ),
      );
    }

    return issues;
  }

  static bool _hasText(String value) => value.trim().isNotEmpty;

  static bool _isBlank(String value) => value.trim().isEmpty;

  static String _valueForField(ApplicationData data, String field) {
    switch (field) {
      case 'firstName':
        return data.firstName;
      case 'lastName':
        return data.lastName;
      case 'age':
        return data.age;
      case 'dateOfBirth':
        return data.dateOfBirth;
      case 'sex':
        return data.sex;
      case 'placeOfBirth':
        return data.placeOfBirth;
      case 'citizenship':
        return data.citizenship;
      case 'civilStatus':
        return data.civilStatus;
      case 'religion':
        return data.religion;
      case 'collegeSchool':
        return data.collegeSchool;
      case 'collegeAddress':
        return data.collegeAddress;
      case 'collegeYearGraduated':
        return data.collegeYearGraduated;
      case 'highSchoolSchool':
        return data.highSchoolSchool;
      case 'highSchoolAddress':
        return data.highSchoolAddress;
      case 'highSchoolYearGraduated':
        return data.highSchoolYearGraduated;
      case 'seniorHighSchool':
        return data.seniorHighSchool;
      case 'seniorHighAddress':
        return data.seniorHighAddress;
      case 'seniorHighYearGraduated':
        return data.seniorHighYearGraduated;
      case 'elementarySchool':
        return data.elementarySchool;
      case 'elementaryAddress':
        return data.elementaryAddress;
      case 'elementaryYearGraduated':
        return data.elementaryYearGraduated;
      case 'currentCourse':
        return data.currentCourse;
      case 'currentYearLevel':
        return data.currentYearLevel;
      case 'studentNumber':
        return data.studentNumber;
      case 'financialSupport':
        return data.financialSupport;
      case 'describeYourselfEssay':
        return data.describeYourselfEssay;
      case 'aimsAndAmbitionEssay':
        return data.aimsAndAmbitionEssay;
      case 'mobileNumber':
        return data.mobileNumber;
      case 'email':
        return data.email;
      default:
        return '';
    }
  }
}
