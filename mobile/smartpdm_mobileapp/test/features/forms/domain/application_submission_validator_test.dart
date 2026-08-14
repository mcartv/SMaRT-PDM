import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/domain/validation/application_submission_validator.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  group('ApplicationSubmissionValidator', () {
    test('enforces the 200 to 300 word essay range', () {
      const validator = ApplicationSubmissionValidator();

      final underLimit = _validApplicationData()
        ..describeYourselfEssay = _essayWords(199)
        ..aimsAndAmbitionEssay = _essayWords(200);
      final underLimitResult = validator.validateEssayProgression(underLimit);

      expect(underLimitResult.isValid, isFalse);
      expect(
        underLimitResult.issueForField('describeYourselfEssay')?.message,
        'Describe yourself essay must be 200-300 words. Current count: 199.',
      );

      final lowerBoundary = _validApplicationData()
        ..describeYourselfEssay = _essayWords(200)
        ..aimsAndAmbitionEssay = _essayWords(200);
      expect(validator.validateEssayProgression(lowerBoundary).isValid, isTrue);

      final upperBoundary = _validApplicationData()
        ..describeYourselfEssay = _essayWords(300)
        ..aimsAndAmbitionEssay = _essayWords(300);
      expect(validator.validateEssayProgression(upperBoundary).isValid, isTrue);

      final overLimit = _validApplicationData()
        ..describeYourselfEssay = _essayWords(301)
        ..aimsAndAmbitionEssay = _essayWords(200);
      final overLimitResult = validator.validateEssayProgression(overLimit);

      expect(overLimitResult.isValid, isFalse);
      expect(
        overLimitResult.issueForField('describeYourselfEssay')?.message,
        'Describe yourself essay must be 200-300 words. Current count: 301.',
      );
    });

    test('rejects whitespace-only required fields', () {
      const validator = ApplicationSubmissionValidator();
      final data = _validApplicationData()
        ..firstName = '   '
        ..describeYourselfEssay = _essayWords(200)
        ..aimsAndAmbitionEssay = _essayWords(200);

      final result = validator.validateReviewReadiness(data);

      expect(result.isValid, isFalse);
      expect(
        result.issueForField('firstName')?.message,
        'First name is required.',
      );
    });

    test('requires certification and consent before final submission', () {
      const validator = ApplicationSubmissionValidator();
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
      const validator = ApplicationSubmissionValidator();

      expect(validator.validateSubmissionPreflight(_validApplicationData()).isValid, isTrue);
    });

    test('requires every academic background section', () {
      const validator = ApplicationSubmissionValidator();
      final data = _validApplicationData()..seniorHighSchool = '';

      final result = validator.validateAcademicProgression(data);

      expect(result.isValid, isFalse);
      expect(
        result.issueForField('seniorHighSchool')?.message,
        'Senior high school is required.',
      );
    });

    test('college accepts On Going or a graduation year from 2026 onward', () {
      const validator = ApplicationSubmissionValidator();

      final ongoing = _validApplicationData()..collegeYearGraduated = 'On Going';
      expect(validator.validateAcademicProgression(ongoing).isValid, isTrue);

      final validYear = _validApplicationData()..collegeYearGraduated = '2026';
      expect(validator.validateAcademicProgression(validYear).isValid, isTrue);

      final oldYear = _validApplicationData()..collegeYearGraduated = '2025';
      final result = validator.validateAcademicProgression(oldYear);
      expect(result.isValid, isFalse);
      expect(
        result.issueForField('collegeYearGraduated')?.message,
        'Select On Going or a college graduation year of 2026 or later.',
      );
    });

    test('Marilao residency years are numeric and are not capped by applicant age', () {
      const validator = ApplicationSubmissionValidator();

      final longResidency = _validApplicationData()
        ..parentMarilaoResidencyDuration = '100';
      expect(validator.validateReviewReadiness(longResidency).isValid, isTrue);

      final invalidResidency = _validApplicationData()
        ..parentMarilaoResidencyDuration = '20 years';
      final result = validator.validateReviewReadiness(invalidResidency);
      expect(result.isValid, isFalse);
      expect(
        result.issueForField('parentMarilaoResidencyDuration')?.message,
        'Years as resident must contain digits only.',
      );
    });
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
    ..collegeYearGraduated = 'On Going'
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
    ..describeYourselfEssay = _essayWords(200)
    ..aimsAndAmbitionEssay = _essayWords(200)
    ..certificationRead = true
    ..agree = true;
}

String _essayWords(int count) {
  return List<String>.generate(count, (index) => 'word').join(' ');
}
