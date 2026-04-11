# Screens Folder Structure

This file documents the current organization of the mobile screens.

## Folder Organization

```text
lib/screens/
|-- auth/
|   |-- change_email_screen.dart
|   |-- forgot_password_screen.dart
|   |-- login_screen.dart
|   |-- otp_screen.dart
|   |-- register_screen.dart
|   `-- splash_screen.dart
|-- applicant/
|   |-- announcements_screen.dart
|   |-- applicant_documents_screen.dart
|   |-- new_applicant_screen.dart
|   |-- notifications_screen.dart
|   |-- office_update_article_screen.dart
|   |-- opening_indigency_apply_screen.dart
|   |-- renewal_requirements_screen.dart
|   |-- scholar_renewal_requirements_screen.dart
|   `-- scholarship_openings_screen.dart
|-- common/
|   |-- about_pdm_screen.dart
|   |-- dashboard_screen.dart
|   |-- document_upload_screen.dart
|   |-- faqs_screen.dart
|   |-- status_tracking_screen.dart
|   |-- success_screen.dart
|   `-- top_level_shell_screen.dart
|-- forms/
|   |-- application_form_screen.dart
|   |-- personal_data_step.dart
|   |-- scholarship_list_screen.dart
|   |-- step_academic.dart
|   |-- step_essay.dart
|   |-- step_family.dart
|   |-- step_personal.dart
|   `-- step_submit.dart
|-- messaging/
|   `-- messaging_screen.dart
|-- profile/
|   |-- existing_scholar_screen.dart
|   `-- profile_screen.dart
|-- providers/
|   |-- messaging_provider.dart
|   |-- new_scholar_provider.dart
|   |-- notification_provider.dart
|   `-- theme_provider.dart
`-- scholar/
    |-- ro_assignment_screen.dart
    |-- ro_completion_screen.dart
    `-- report_ticket_screen.dart
```

## Example Imports

```dart
import 'package:smartpdm_mobileapp/screens/auth/login_screen.dart';
import 'package:smartpdm_mobileapp/screens/applicant/new_applicant_screen.dart';
import 'package:smartpdm_mobileapp/screens/common/dashboard_screen.dart';
import 'package:smartpdm_mobileapp/screens/messaging/messaging_screen.dart';
import 'package:smartpdm_mobileapp/screens/profile/profile_screen.dart';
import 'package:smartpdm_mobileapp/screens/scholar/ro_assignment_screen.dart';
```

## Guidelines

1. Keep screens in the most specific folder that matches the feature.
2. Update `lib/main.dart` and `lib/navigation/app_routes.dart` when routes change.
3. Remove route registrations and imports when a screen is deleted.
