import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/printable_application_service.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/success_screen.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';
import 'package:smartpdm_mobileapp/shared/models/saved_application_print_model.dart';

class _FakePrintableApplicationService extends PrintableApplicationService {
  Map<String, dynamic>? submissionPayload;
  String? applicationId;

  @override
  Future<void> generateOpenFromSubmissionPayload(
    Map<String, dynamic> payload,
  ) async {
    submissionPayload = payload;
  }

  @override
  Future<void> generateOpenFromApplicationId(String applicationId) async {
    this.applicationId = applicationId;
  }
}

void main() {
  test('maps local submission payload into printable application model', () {
    final data = ApplicationData()
      ..userId = 'user-1'
      ..accountStudentId = 'PDM-2024-000123'
      ..openingId = 'opening-1'
      ..openingTitle = 'Academic Scholarship'
      ..openingProgramName = 'OSFA Scholarship'
      ..firstName = 'juan'
      ..middleName = 'santos'
      ..lastName = 'dela cruz'
      ..age = '20'
      ..dateOfBirth = '01/15/2006'
      ..sex = 'Male'
      ..placeOfBirth = 'marilao'
      ..citizenship = 'filipino'
      ..civilStatus = 'single'
      ..religion = 'catholic'
      ..houseLotBlockNo = '12'
      ..street = 'rizal street'
      ..subdivision = 'sample homes'
      ..barangay = 'poblacion'
      ..city = 'marilao'
      ..province = 'bulacan'
      ..zipCode = '3019'
      ..landline = '0441234567'
      ..mobileNumber = '+639123456789'
      ..email = 'Juan@example.COM'
      ..parentGuardianAddress = 'Poblacion, Marilao, Bulacan'
      ..guardianOnly = true
      ..fatherPresent = false
      ..motherPresent = false
      ..guardianFirstName = 'maria'
      ..guardianMiddleName = 'reyes'
      ..guardianLastName = 'santos'
      ..guardianMobile = '09111111111'
      ..guardianEducationalAttainment = 'College'
      ..guardianOccupation = 'Teacher'
      ..guardianCompanyNameAndAddress = 'PDM'
      ..collegeSchool = 'PDM'
      ..collegeAddress = 'Marilao'
      ..currentCourse = 'BSIT'
      ..currentYearLevel = '2'
      ..currentSection = 'A'
      ..studentNumber = 'PDM-2024-000123'
      ..financialSupport = 'Other'
      ..scholarshipOthersSpecify = 'Relative'
      ..scholarshipHistory = true
      ..scholarshipDetails = 'Barangay scholarship'
      ..disciplinaryAction = true
      ..disciplinaryExplanation = 'Late clearance'
      ..describeYourselfEssay = 'Hardworking student'
      ..aimsAndAmbitionEssay = 'Finish college'
      ..certificationRead = true
      ..agree = true;

    final payload = data.toSubmissionPayload();
    final model = SavedApplicationPrintModel.fromSavedFormData(payload);

    expect(model.firstName, 'Juan');
    expect(model.middleName, 'Santos');
    expect(model.lastName, 'Dela Cruz');
    expect(model.mobileNumber, '09123456789');
    expect(model.email, 'juan@example.com');
    expect(model.guardianFirstName, 'Maria');
    expect(model.guardianLastName, 'Santos');
    expect(model.currentCourse, 'BSIT');
    expect(model.currentYearSection, '2 / A');
    expect(model.studentNumber, 'PDM-2024-000123');
    expect(model.financialSupport, 'Other');
    expect(model.financialSupportOther, 'Relative');
    expect(model.hadScholarship, isTrue);
    expect(model.scholarshipDetails, 'Barangay Scholarship');
    expect(model.hasDisciplinaryRecord, isTrue);
    expect(model.disciplinaryDetails, 'Late Clearance');
    expect(model.selfDescription, 'Hardworking Student');
    expect(model.aimsAndAmbitions, 'Finish College');
  });

  testWidgets('success screen generates PDF from local submission payload', (
    tester,
  ) async {
    final fakeService = _FakePrintableApplicationService();
    final payload = ApplicationData()
      ..openingId = 'opening-1'
      ..firstName = 'Juan'
      ..lastName = 'Dela Cruz'
      ..mobileNumber = '09123456789'
      ..currentCourse = 'BSIT'
      ..currentYearLevel = '2'
      ..currentSection = 'A'
      ..studentNumber = 'PDM-2024-000123';
    final submissionPayload = payload.toSubmissionPayload();

    await tester.pumpWidget(
      MaterialApp(
        initialRoute: AppRoutes.success,
        routes: {
          AppRoutes.documents: (_) => const Scaffold(body: Text('Documents')),
          AppRoutes.home: (_) => const Scaffold(body: Text('Home')),
        },
        onGenerateRoute: (settings) {
          if (settings.name == AppRoutes.success) {
            return MaterialPageRoute<void>(
              settings: RouteSettings(
                name: AppRoutes.success,
                arguments: {
                  'applicationId': 'application-1',
                  'openingId': 'opening-1',
                  'openingTitle': 'Academic Scholarship',
                  'programName': 'OSFA Scholarship',
                  'submissionPayload': submissionPayload,
                  'canUploadRequirements': true,
                },
              ),
              builder: (_) =>
                  SuccessScreen(printableApplicationService: fakeService),
            );
          }
          return null;
        },
      ),
    );

    await tester.tap(find.text('Download Printable PDF'));
    await tester.pump();

    expect(fakeService.submissionPayload, submissionPayload);
    expect(fakeService.applicationId, isNull);
  });
}
