import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/domain/validation/application_submission_validator.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  group('ApplicationSubmissionValidator', () {
    const validator = ApplicationSubmissionValidator();

    test('essay fields are required but do not have a minimum word count', () {
      final shortEssay = _validApplicationData()
        ..describeYourselfEssay = 'I am a student.'
        ..aimsAndAmbitionEssay = 'I want to serve my community.';

      expect(validator.validateEssayProgression(shortEssay).isValid, isTrue);
    });

    test('rejects blank and whitespace-only essays', () {
      final blank = _validApplicationData()
        ..describeYourselfEssay = '   '
        ..aimsAndAmbitionEssay = '';

      final result = validator.validateEssayProgression(blank);

      expect(result.isValid, isFalse);
      expect(
        result.issueForField('describeYourselfEssay')?.message,
        'Describe yourself essay is required.',
      );
      expect(
        result.issueForField('aimsAndAmbitionEssay')?.message,
        'Aims and ambition essay is required.',
      );
    });

    test('rejects whitespace-only required personal fields', () {
      final data = _validApplicationData()..firstName = '   ';

      final result = validator.validatePersonalProgression(data);

      expect(result.isValid, isFalse);
      expect(
        result.issueForField('firstName')?.message,
        'First name is required.',
      );
    });

    test('family progression uses the same centralized rules as preflight', () {
      final data = _validApplicationData()
        ..fatherPresent = false
        ..motherPresent = false
        ..fatherFirstName = ''
        ..fatherLastName = ''
        ..motherFirstName = ''
        ..motherLastName = ''
        ..guardianFirstName = ''
        ..guardianLastName = '';

      final progression = validator.validateFamilyProgression(data);
      final preflight = validator.validateSubmissionPreflight(data);

      expect(progression.isValid, isFalse);
      expect(
        progression.issueForField('familyPrimaryCarer')?.message,
        'Enter the complete name of at least one parent or guardian.',
      );
      expect(
        preflight.issueForField('familyPrimaryCarer')?.message,
        progression.issueForField('familyPrimaryCarer')?.message,
      );
    });

    test('requires certification and consent before final submission', () {
      final data = _validApplicationData()
        ..certificationRead = false
        ..agree = false;

      final result = validator.validateSubmissionPreflight(data);

      expect(result.isValid, isFalse);
      expect(
        result.repairActions,
        containsAll(<String>[
          'Check the certification statement.',
          'Accept the terms of service and privacy statement.',
        ]),
      );
    });

    test('accepts a fully valid submission snapshot', () {
      final result = validator.validateSubmissionPreflight(
        _validApplicationData(),
      );

      expect(
        result.isValid,
        isTrue,
        reason: result.issues
            .map((issue) => '${issue.field}: ${issue.message}')
            .join(' | '),
      );
    });

    test('requires every academic background section', () {
      final data = _validApplicationData()..seniorHighSchool = '';

      final result = validator.validateAcademicProgression(data);

      expect(result.isValid, isFalse);
      expect(
        result.issueForField('seniorHighSchool')?.message,
        'Senior high school is required.',
      );
    });

    test('college accepts Ongoing or a graduation year from 2026 onward', () {
      final ongoing = _validApplicationData()..collegeYearGraduated = 'Ongoing';
      expect(validator.validateAcademicProgression(ongoing).isValid, isTrue);

      final legacyOngoing = _validApplicationData()
        ..collegeYearGraduated = 'On Going';
      expect(
        validator.validateAcademicProgression(legacyOngoing).isValid,
        isTrue,
      );

      final validYear = _validApplicationData()..collegeYearGraduated = '2026';
      expect(validator.validateAcademicProgression(validYear).isValid, isTrue);

      final oldYear = _validApplicationData()..collegeYearGraduated = '2025';
      final result = validator.validateAcademicProgression(oldYear);
      expect(result.isValid, isFalse);
      expect(
        result.issueForField('collegeYearGraduated')?.message,
        'Select Ongoing or a college graduation year of 2026 or later.',
      );
    });

    test('non-native parent origin only requires a city or municipality', () {
      final data = _validApplicationData()
        ..parentNativeStatus = 'No'
        ..parentPreviousTownMunicipality = 'Meycauayan City'
        ..parentPreviousProvince = '';

      final result = validator.validateFamilyProgression(data);

      expect(
        result.isValid,
        isTrue,
        reason: result.issues
            .map((issue) => '${issue.field}: ${issue.message}')
            .join(' | '),
      );
    });

    test(
      'Marilao residency years are numeric and are not capped by applicant age',
      () {
        final longResidency = _validApplicationData()
          ..parentMarilaoResidencyDuration = '100';
        final longResult = validator.validateReviewReadiness(longResidency);

        expect(
          longResult.isValid,
          isTrue,
          reason: longResult.issues
              .map((issue) => '${issue.field}: ${issue.message}')
              .join(' | '),
        );

        final invalidResidency = _validApplicationData()
          ..parentMarilaoResidencyDuration = '20 years';
        final result = validator.validateReviewReadiness(invalidResidency);
        expect(result.isValid, isFalse);
        expect(
          result.issueForField('parentMarilaoResidencyDuration')?.message,
          'Years as resident must contain digits only.',
        );
      },
    );
  });
}

ApplicationData _validApplicationData() {
  final birthDate = DateTime(2007, 5, 29);
  final age = ApplicationData.calculateAge(birthDate) ?? 19;

  return ApplicationData()
    ..userId = 'user-1'
    ..accountStudentId = 'PDM-2026-001001'
    ..openingId = 'opening-1'
    ..openingTitle = 'Genmart Opening'
    ..openingProgramName = 'Genmart'
    ..firstName = 'Teresa'
    ..lastName = 'Tolentino'
    ..middleName = 'Leigh'
    ..age = age.toString()
    ..dateOfBirth = '05/29/2007'
    ..sex = 'Female'
    ..placeOfBirth = 'Meycauayan'
    ..citizenship = 'Filipino'
    ..civilStatus = 'Single'
    ..religion = 'Other'
    ..mobileNumber = '09123456789'
    ..email = 'teresa.tolentino79@gmail.com'
    ..unitBldgNo = 'Unit 5'
    ..street = '295 Aguinaldo St.'
    ..barangay = 'Longos'
    ..city = 'Meycauayan'
    ..province = 'Bulacan'
    ..zipCode = '3020'
    ..sameAddressAsApplicant = true
    ..fatherPresent = true
    ..motherPresent = true
    ..fatherFirstName = 'Elena'
    ..fatherLastName = 'Tolentino'
    ..motherFirstName = 'Noel'
    ..motherLastName = 'Tolentino'
    ..parentNativeStatus = 'Yes, both parents'
    ..parentMarilaoResidencyDuration = '12'
    ..collegeSchool = 'Pambayang Dalubhasaan ng Marilao'
    ..collegeAddress = 'Abangan, Norte, Marilao, Bulacan'
    ..collegeYearGraduated = 'Ongoing'
    ..highSchoolSchool = 'Marilao National High School'
    ..highSchoolAddress = 'Marilao, Bulacan'
    ..highSchoolYearGraduated = '2022'
    ..seniorHighSchool = 'Marilao National High School'
    ..seniorHighAddress = 'Marilao, Bulacan'
    ..seniorHighYearGraduated = '2024'
    ..elementarySchool = 'Marilao Central School'
    ..elementaryAddress = 'Marilao, Bulacan'
    ..elementaryYearGraduated = '2018'
    ..currentCourse = 'BTLED'
    ..currentYearLevel = '1'
    ..studentNumber = 'PDM-2026-001001'
    ..financialSupport = 'Scholarship'
    ..scholarshipHistoryAnswered = true
    ..scholarshipHistory = false
    ..disciplinaryActionAnswered = true
    ..disciplinaryAction = false
    ..describeYourselfEssay = 'I am a student.'
    ..aimsAndAmbitionEssay = 'I want to serve my community.'
    ..certificationRead = true
    ..agree = true;
}
