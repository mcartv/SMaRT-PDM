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
    ..parentMarilaoResidencyDuration = '12 years'
    ..currentCourse = 'BTLED'
    ..currentYearLevel = '1'
    ..studentNumber = 'PDM-2026-001001'
    ..financialSupport = 'Scholarship'
    ..describeYourselfEssay = _essayWords(200)
    ..aimsAndAmbitionEssay = _essayWords(200)
    ..certificationRead = true
    ..agree = true;
}

String _essayWords(int count) {
  return List<String>.generate(count, (index) => 'word').join(' ');
}
