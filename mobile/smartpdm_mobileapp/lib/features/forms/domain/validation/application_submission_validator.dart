import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

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
      if (issue.field == field) {
        return issue;
      }
    }
    return null;
  }

  String? get firstMessage => issues.isEmpty ? null : issues.first.message;

  List<String> get repairActions =>
      issues.map((issue) => issue.repairAction).toList(growable: false);
}

class ApplicationSubmissionValidator {
  const ApplicationSubmissionValidator();

  static const int essayMinWords = 200;
  static const int essayMaxWords = 300;

  ApplicationSubmissionValidationResult validateEssayProgression(
    ApplicationData data,
  ) {
    final issues = <ApplicationSubmissionIssue>[
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
    ];

    return ApplicationSubmissionValidationResult(issues);
  }

  ApplicationSubmissionValidationResult validateReviewReadiness(
    ApplicationData data,
  ) {
    final issues = <ApplicationSubmissionIssue>[
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
    ];

    return ApplicationSubmissionValidationResult(issues);
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

  List<ApplicationSubmissionIssue> _validateAccountFields(ApplicationData data) {
    final issues = <ApplicationSubmissionIssue>[];

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

    void requireText({
      required String field,
      required String label,
    }) {
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
            repairAction: 'Update the age to reflect an applicant who is 16 or older.',
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

    final rawMobile = data.mobileNumber.trim();
    final normalizedMobile = ApplicationData.normalizeMobileNumber(rawMobile);
    if (normalizedMobile.isEmpty) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'contact.mobile.required',
          section: ApplicationSubmissionSection.personal,
          field: 'mobileNumber',
          message: 'Mobile number is required.',
          repairAction: 'Enter a mobile number.',
        ),
      );
    } else if (!RegExp(r'^\+?\d+$').hasMatch(
      rawMobile.replaceAll(RegExp(r'[\s-]+'), ''),
    )) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'contact.mobile.format',
          section: ApplicationSubmissionSection.personal,
          field: 'mobileNumber',
          message: 'Mobile number must contain digits only.',
          repairAction: 'Use digits only in the mobile number.',
        ),
      );
    } else if (!normalizedMobile.startsWith('09')) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'contact.mobile.prefix',
          section: ApplicationSubmissionSection.personal,
          field: 'mobileNumber',
          message: 'Mobile number must start with 09 or +639.',
          repairAction: 'Use a Philippine mobile number that starts with 09 or +639.',
        ),
      );
    } else if (normalizedMobile.length < 11) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'contact.mobile.short',
          section: ApplicationSubmissionSection.personal,
          field: 'mobileNumber',
          message: 'Mobile number is too short.',
          repairAction: 'Add the missing digits to the mobile number.',
        ),
      );
    } else if (normalizedMobile.length > 11) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'contact.mobile.long',
          section: ApplicationSubmissionSection.personal,
          field: 'mobileNumber',
          message: 'Mobile number is too long.',
          repairAction: 'Remove any extra digits from the mobile number.',
        ),
      );
    }

    final addressFields = <String>[
      data.unitBldgNo,
      data.houseLotBlockNo,
      data.street,
      data.subdivision,
      data.barangay,
      data.city,
      data.province,
      data.zipCode,
    ];
    if (!addressFields.any((value) => value.trim().isNotEmpty)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'personal.address.required',
          section: ApplicationSubmissionSection.personal,
          field: 'address',
          message: 'Permanent address is required.',
          repairAction: 'Fill in at least one permanent address field.',
        ),
      );
    }

    final email = data.email.trim();
    if (email.isEmpty) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'contact.email.required',
          section: ApplicationSubmissionSection.personal,
          field: 'email',
          message: 'Email address is required.',
          repairAction: 'Enter a valid email address.',
        ),
      );
    } else if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'contact.email.invalid',
          section: ApplicationSubmissionSection.personal,
          field: 'email',
          message: 'Please enter a valid email address.',
          repairAction: 'Correct the email address format.',
        ),
      );
    }

    return issues;
  }

  List<ApplicationSubmissionIssue> _validateFamilyFields(ApplicationData data) {
    final issues = <ApplicationSubmissionIssue>[];

    if (!data.sameAddressAsApplicant &&
        _isBlank(data.parentGuardianAddress)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'family.parent_address.required',
          section: ApplicationSubmissionSection.family,
          field: 'parentGuardianAddress',
          message: 'Parent or guardian address is required.',
          repairAction: 'Enter the parent or guardian address or mark it as the same as the applicant.',
        ),
      );
    }

    final hasNamedFather =
        data.fatherPresent &&
        (_hasText(data.fatherFirstName) || _hasText(data.fatherLastName));
    final hasNamedMother =
        data.motherPresent &&
        (_hasText(data.motherFirstName) || _hasText(data.motherLastName));
    final hasNamedGuardian =
        _hasText(data.guardianFirstName) || _hasText(data.guardianLastName);

    if (!hasNamedFather && !hasNamedMother && !hasNamedGuardian) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'family.primary_carer.required',
          section: ApplicationSubmissionSection.family,
          field: 'familyPrimaryCarer',
          message: 'Add at least one parent or guardian.',
          repairAction: 'Add the parent or guardian who should appear in the family section.',
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
            message: 'Residency duration is required when parents are native of Marilao.',
            repairAction: 'Enter how long the parent or parents have lived in Marilao.',
          ),
        );
      }
    } else if (parentNativeStatus == 'No' &&
        _isBlank(data.parentPreviousTownProvince)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'family.origin.required',
          section: ApplicationSubmissionSection.family,
          field: 'parentPreviousTownProvince',
          message: 'Previous town or province is required when parents are not native of Marilao.',
          repairAction: 'Enter the town or province the parent or parents came from.',
        ),
      );
    }

    return issues;
  }

  List<ApplicationSubmissionIssue> _validateAcademicFields(
    ApplicationData data,
  ) {
    final issues = <ApplicationSubmissionIssue>[];

    void requireText({
      required String field,
      required String label,
    }) {
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

    requireText(field: 'currentCourse', label: 'Course');
    requireText(field: 'currentYearLevel', label: 'Year level');
    requireText(field: 'studentNumber', label: 'Student number');
    requireText(field: 'financialSupport', label: 'Financial support');

    final yearLevel = int.tryParse(data.currentYearLevel.trim());
    if (!_isBlank(data.currentYearLevel) &&
        (yearLevel == null || yearLevel < 1 || yearLevel > 4)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'academic.year_level.range',
          section: ApplicationSubmissionSection.academic,
          field: 'currentYearLevel',
          message: 'Year level must be 1, 2, 3, or 4.',
          repairAction: 'Choose a year level between 1 and 4.',
        ),
      );
    }

    if (_hasText(data.studentNumber) &&
        _hasText(data.accountStudentId) &&
        data.studentNumber.trim() != data.accountStudentId.trim()) {
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

    if (data.financialSupport.trim() == 'Other' &&
        _isBlank(data.scholarshipOthersSpecify)) {
      issues.add(
        const ApplicationSubmissionIssue(
          code: 'academic.financial_support.other.required',
          section: ApplicationSubmissionSection.academic,
          field: 'scholarshipOthersSpecify',
          message: 'Please specify the other financial support.',
          repairAction: 'Describe the other source of financial support.',
        ),
      );
    }

    if (data.disciplinaryAction &&
        _isBlank(data.disciplinaryExplanation)) {
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
    final count = essayWordCount(value);
    if (count >= essayMinWords && count <= essayMaxWords) {
      return const <ApplicationSubmissionIssue>[];
    }

    final message = count == 0
        ? '$label must be $essayMinWords-$essayMaxWords words.'
        : '$label must be $essayMinWords-$essayMaxWords words. Current count: $count.';
    final repairAction = count < essayMinWords
        ? 'Add ${essayMinWords - count} more words to the $label.'
        : 'Shorten the $label to $essayMaxWords words or fewer.';

    return [
      ApplicationSubmissionIssue(
        code: 'essay.$field.word_count',
        section: ApplicationSubmissionSection.essay,
        field: field,
        message: message,
        repairAction: repairAction,
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
