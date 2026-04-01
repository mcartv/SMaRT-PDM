# Screens Folder Structure

This file documents the organized structure of the screens folder for better maintainability and scalability.

## Folder Organization

```
lib/screens/
├── auth/                          # Authentication related screens
│   ├── login_screen.dart
│   ├── register_screen.dart
│   ├── otp_screen.dart
│   ├── forgot_password_screen.dart
│   └── splash_screen.dart
│
├── applicant/                     # Applicant-specific features
│   ├── new_applicant_screen.dart
│   ├── interview_schedule_screen.dart
│   ├── announcements_screen.dart
│   ├── notifications_screen.dart
│   └── renewal_requirements_screen.dart
│
├── scholar/                       # Scholar-specific features
│   ├── payout_schedule_screen.dart
│   ├── ro_assignment_screen.dart
│   ├── ro_completion_screen.dart
│   ├── report_ticket_screen.dart
│   └── obligations_screen.dart
│
├── forms/                         # Form-related screens and steps
│   ├── application_form_screen.dart
│   ├── scholarship_list_screen.dart
│   ├── personal_data_step.dart
│   ├── step_academic.dart
│   ├── step_essay.dart
│   ├── step_essay_submit.dart
│   ├── step_family.dart
│   ├── step_personal.dart
│   └── step_submit.dart
│
├── profile/                       # User profile management
│   ├── profile_screen.dart
│   └── existing_scholar_screen.dart
│
├── messaging/                     # Messaging features
│   └── messaging_screen.dart
│
├── providers/                     # State management providers
│   ├── messaging_provider.dart
│   └── new_scholar_provider.dart
│
├── common/                        # Screens used across the app
│   ├── dashboard_screen.dart
│   ├── success_screen.dart
│   ├── status_tracking_screen.dart
│   └── document_upload_screen.dart
│
└── STRUCTURE.md                   # This file
```

## Usage

### Importing from auth screens
```dart
import 'package:smartpdm_mobileapp/screens/auth/login_screen.dart';
import 'package:smartpdm_mobileapp/screens/auth/register_screen.dart';
```

### Importing from applicant screens
```dart
import 'package:smartpdm_mobileapp/screens/applicant/new_applicant_screen.dart';
import 'package:smartpdm_mobileapp/screens/applicant/interview_schedule_screen.dart';
```

### Importing from scholar screens
```dart
import 'package:smartpdm_mobileapp/screens/scholar/payout_schedule_screen.dart';
import 'package:smartpdm_mobileapp/screens/scholar/ro_assignment_screen.dart';
```

### Importing from form screens
```dart
import 'package:smartpdm_mobileapp/screens/forms/application_form_screen.dart';
import 'package:smartpdm_mobileapp/screens/forms/step_academic.dart';
```

### Importing from profile screens
```dart
import 'package:smartpdm_mobileapp/screens/profile/profile_screen.dart';
```

### Importing from messaging
```dart
import 'package:smartpdm_mobileapp/screens/messaging/messaging_screen.dart';
```

### Importing providers
```dart
import 'package:smartpdm_mobileapp/screens/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/screens/providers/new_scholar_provider.dart';
```

### Importing common screens
```dart
import 'package:smartpdm_mobileapp/screens/common/dashboard_screen.dart';
import 'package:smartpdm_mobileapp/screens/common/success_screen.dart';
```

## Guidelines

1. **Keep screens in their logical folders** - Don't add new screens to the root screens folder
2. **Related screens together** - Keep closely related screens in the same folder
3. **Providers with models** - Keep state management providers in the providers folder
4. **Common/Shared screens** - Screens accessed by multiple user types go in common folder
5. **Update Main.dart routes** - Always update import paths in main.dart when adding new routes

## When to add a new folder

Create a new folder when you have:
- A coherent group of 3+ related screens
- A distinct feature area (e.g., "admin", "settings", "reports")
- Better organization and clarity

## Migration notes

All screens have been reorganized as of [Date]. Previous imports like:
```dart
// OLD (no longer works)
import 'package:smartpdm_mobileapp/screens/login_screen.dart';
```

Should now be updated to:
```dart
// NEW (correct)
import 'package:smartpdm_mobileapp/screens/auth/login_screen.dart';
```
