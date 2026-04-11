# Navigation Guide

This document summarizes the current mobile navigation setup.

## Top-Level Routes

```text
[0] Home          -> /home
[1] Payouts       -> /payouts
[2] Notifications -> /notifications
[3] Profile       -> /profile
```

These routes are handled through `TopLevelShellScreen`.

## Dashboard Quick Actions

```text
Upload         -> /documents or /renewal-documents
Announcements  -> /notifications
Obligs         -> /ro-completion
```

## Dashboard Menu Items

Applicant-facing dashboard actions currently include:

- Apply for New Scholarship -> `/new_applicant`
- FAQs -> `/faqs`
- View Notifications -> `/notifications`
- View Announcements -> `/notifications`
- Upload Scholarship Requirements -> `/documents`

Approved scholar actions currently include:

- RO Assignment -> `/ro-assignment`
- RO Completion -> `/ro-completion`
- Report Ticket -> `/tickets`

## Registered Routes

```dart
routes: {
  AppRoutes.splash: (context) => const SplashScreen(),
  AppRoutes.login: (context) => const LoginScreen(),
  AppRoutes.register: (context) => const RegisterScreen(),
  AppRoutes.otp: (context) => const OtpScreen(),
  AppRoutes.forgotPassword: (context) => const ForgotPasswordScreen(),
  AppRoutes.changeEmail: (context) => const ChangeEmailScreen(),
  AppRoutes.home: (context) => const TopLevelShellScreen(initialIndex: 0),
  AppRoutes.payouts: (context) => const TopLevelShellScreen(initialIndex: 1),
  AppRoutes.notifications: (context) => const TopLevelShellScreen(initialIndex: 2),
  AppRoutes.profile: (context) => const TopLevelShellScreen(initialIndex: 3),
  AppRoutes.newApplicant: (context) => const NewApplicantScreen(),
  AppRoutes.application: (context) => const PlaceholderScreen(title: 'Application'),
  AppRoutes.documents: (context) => _buildApplicantDocumentsScreen(context),
  AppRoutes.renewalDocuments: (context) => const ScholarRenewalRequirementsScreen(),
  AppRoutes.status: (context) => const StatusTrackingScreen(),
  AppRoutes.announcements: (context) => const AnnouncementsScreen(),
  AppRoutes.about: (context) => const PlaceholderScreen(title: 'About PDM/OSFA'),
  AppRoutes.faqs: (context) => const FaqsScreen(),
  AppRoutes.messaging: (context) => const MessagingScreen(),
  AppRoutes.roAssignment: (context) => const ROAssignmentScreen(),
  AppRoutes.roCompletion: (context) => ROCompletionScreen(),
  AppRoutes.tickets: (context) => const ReportTicketScreen(),
  AppRoutes.success: (context) => const SuccessScreen(),
  AppRoutes.scholarshipOpenings: (context) => const ScholarshipOpeningsScreen(),
}
```

## Maintenance Notes

1. Remove route constants from `lib/navigation/app_routes.dart` when a screen is deleted.
2. Remove route registrations from `lib/main.dart` at the same time.
3. Remove dashboard entry points so users cannot navigate to deleted screens.
