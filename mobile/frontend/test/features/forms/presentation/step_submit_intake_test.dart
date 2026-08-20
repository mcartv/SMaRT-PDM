import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_submit_intake.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  testWidgets('StepSubmit shows specific repair actions when invalid', (
    tester,
  ) async {
    final data = _validApplicationData()
      ..firstName = '   '
      ..describeYourselfEssay = '   '
      ..certificationRead = false
      ..agree = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: StepSubmit(
              data: data,
              onChanged: () {},
              onEditStep: (_) {},
              showErrors: true,
            ),
          ),
        ),
      ),
    );

    expect(find.text('Ready to submit'), findsNothing);
    expect(find.text('Review required fields'), findsOneWidget);
    expect(find.text('- Enter your First name.'), findsOneWidget);
    expect(
      find.text('- Write your Describe yourself essay before continuing.'),
      findsOneWidget,
    );
    expect(find.text('- Check the certification statement.'), findsOneWidget);
    expect(
      find.text('- Accept the terms of service and privacy statement.'),
      findsOneWidget,
    );
  });

  testWidgets('StepSubmit accepts short non-blank essays', (tester) async {
    final data = _validApplicationData()
      ..describeYourselfEssay = 'I am a student.'
      ..aimsAndAmbitionEssay = 'I want to serve my community.';

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: StepSubmit(data: data, onChanged: () {}, onEditStep: (_) {}),
          ),
        ),
      ),
    );

    expect(find.text('Ready to submit'), findsOneWidget);
  });

  testWidgets('StepSubmit shows the ready state when the form is valid', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: StepSubmit(
              data: _validApplicationData(),
              onChanged: () {},
              onEditStep: (_) {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Ready to submit'), findsOneWidget);
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
    ..highSchoolSchool = 'Meycauayan National High School'
    ..highSchoolAddress = 'Meycauayan, Bulacan'
    ..highSchoolYearGraduated = '2022'
    ..seniorHighSchool = 'Meycauayan Senior High School'
    ..seniorHighAddress = 'Meycauayan, Bulacan'
    ..seniorHighYearGraduated = '2024'
    ..elementarySchool = 'Meycauayan Elementary School'
    ..elementaryAddress = 'Meycauayan, Bulacan'
    ..elementaryYearGraduated = '2018'
    ..currentCourse = 'BTLED'
    ..currentYearLevel = '1'
    ..studentNumber = 'PDM-2026-001001'
    ..financialSupport = 'Scholarship'
    ..scholarshipHistory = false
    ..scholarshipHistoryAnswered = true
    ..disciplinaryAction = false
    ..disciplinaryActionAnswered = true
    ..describeYourselfEssay = 'I am a student.'
    ..aimsAndAmbitionEssay = 'I want to serve my community.'
    ..certificationRead = true
    ..agree = true;
}
