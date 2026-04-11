# SMaRT-PDM Use Case Compliance Report

This document tracks the mobile app screens that are currently implemented.

## Implementation Status

### Authentication

| Use Case | Implementation | Route |
| --- | --- | --- |
| Register Account | `register_screen.dart` | `/register` |
| Log In | `login_screen.dart` | `/login` |
| Verify Account (OTP) | `otp_screen.dart` | `/otp` |
| Forgot Password | `forgot_password_screen.dart` | `/forgot-password` |

### Shared Features

| Use Case | Implementation | Route |
| --- | --- | --- |
| View Dashboard | `dashboard_screen.dart` | `/home` |
| Send Message | `messaging_screen.dart` | `/messaging` |
| Update Profile | `profile_screen.dart` | `/profile` |

### Applicant Features

| Use Case | Implementation | Route |
| --- | --- | --- |
| Apply for Scholarship | `new_applicant_screen.dart` | `/new_applicant` |
| View Application Status | `status_tracking_screen.dart` | `/status` |
| View Scholarship Info | `scholarship_list_screen.dart` | `/about` |
| View Announcements | `announcements_screen.dart` | `/announcements` |
| View Notifications | `notifications_screen.dart` | `/notifications` |
| Upload Scholarship Requirements | `applicant_documents_screen.dart` | `/documents` |
| View Dashboard | `dashboard_screen.dart` | `/home` |

### Scholar Features

| Use Case | Implementation | Route |
| --- | --- | --- |
| View Dashboard | `dashboard_screen.dart` | `/home` |
| View RO Assignment | `ro_assignment_screen.dart` | `/ro-assignment` |
| Submit RO Completion | `ro_completion_screen.dart` | `/ro-completion` |
| Submit Report Ticket | `report_ticket_screen.dart` | `/tickets` |

## Registered Applicant Routes

```dart
AppRoutes.newApplicant
AppRoutes.documents
AppRoutes.renewalDocuments
AppRoutes.status
AppRoutes.announcements
AppRoutes.about
AppRoutes.faqs
AppRoutes.messaging
AppRoutes.scholarshipOpenings
```

## Dashboard Coverage

Applicant dashboard currently links to:

- Apply for New Scholarship
- App Settings
- FAQs
- View Notifications
- View Announcements
- Upload Scholarship Requirements

Scholar dashboard currently links to:

- RO Assignment
- RO Completion
- Report Ticket

## Notes

1. Legacy applicant-only scheduling UI has been removed from the mobile app.
2. Documentation in this file reflects the current route map in `lib/main.dart`.
