import 'dart:io';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/applicant_documents_screen.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/application_form_preview_screen.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/scholarship_openings_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/otp_screen.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_academic_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/step_family_intake.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/success_screen.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:smartpdm_mobileapp/shared/models/app_data.dart';

void main() {
  test('changed dark-mode screens compile', () {
    expect(const DashboardScreen(), isA<Widget>());
    expect(const OtpScreen(), isA<Widget>());
    expect(const ScholarshipOpeningsScreen(), isA<Widget>());
    expect(const ApplicantDocumentsScreen(), isA<Widget>());
    expect(const ApplicationFormPreviewScreen(), isA<Widget>());
    expect(const NotificationsScreen(), isA<Widget>());
    expect(const SuccessScreen(), isA<Widget>());

    final data = ApplicationData();
    expect(StepFamily(data: data, onChanged: () {}), isA<Widget>());
    expect(StepAcademic(data: data, onChanged: () {}), isA<Widget>());
  });

  test('residency dropdown uses four bucket options', () {
    final source = File(
      'lib/features/forms/presentation/screens/step_family_intake.dart',
    ).readAsStringSync();

    expect(source, contains("'Less than a year'"));
    expect(source, contains("'1-5 years'"));
    expect(source, contains("'6-10 years'"));
    expect(source, contains("'More than 10 years'"));
    expect(source, isNot(contains('List<String>.generate(120')));
  });

  test('success and notifications have explicit dark surfaces', () {
    final success = File(
      'lib/features/forms/presentation/screens/success_screen.dart',
    ).readAsStringSync();
    final notifications = File(
      'lib/features/notifications/presentation/screens/notifications_screen.dart',
    ).readAsStringSync();

    expect(success, contains('AppColors.applicantDarkBackground'));
    expect(success, contains('AppColors.applicantDarkSurface'));
    expect(notifications, contains('AppColors.applicantDarkBackground'));
    expect(notifications, contains('AppColors.applicantDarkSurface'));
  });
}
