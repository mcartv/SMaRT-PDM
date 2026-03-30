# SMaRT-PDM Mobile App

A Flutter-based mobile application for the Scholarship Management and Recipient Tracking - Program Document Management (SMaRT-PDM) system. This app allows new applicants to apply for scholarships and existing scholars to manage their profiles and documents.

## 🚀 Features

- **User Authentication**: Secure login and registration for scholars.
- **New Applicant Registration**: A guided, multi-step process for new scholarship applications.
- **Existing Scholar Portal**: A dashboard for current scholars to:
  - Update personal information.
  - View application status.
  - Check payout schedules.
  - Submit and manage documents.
  - Communicate via a messaging system.
  - Submit support tickets.
- **Cross-Platform**: Built with Flutter for a consistent experience on both Android and iOS.

## 🏁 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have the Flutter SDK installed on your machine. For more information, see the [Flutter documentation](https://flutter.dev/docs/get-started/install).

- Flutter SDK (check your version with `flutter --version`)
- A code editor like VS Code or Android Studio.
- An Android emulator or a physical device.

### Installation

1.  **Clone the repo**
    ```sh
    git clone https://github.com/your_username/SMaRT-PDM.git
    ```
2.  **Navigate to the project directory**
    ```sh
    cd SMaRT-PDM/mobile/smartpdm_mobileapp
    ```
3.  **Install dependencies**
    ```sh
    flutter pub get
    ```
4.  **Run the app**
    ```sh
    flutter run
    ```

### Configuration

Before building for release, make sure to update the Android application ID and set up signing keys.

1.  **Application ID**:
    Open `android/app/build.gradle.kts` and change `applicationId` from `com.example.smartpdm_mobileapp` to your unique ID.
    ```kotlin
    // android/app/build.gradle.kts
    defaultConfig {
        applicationId = "your.unique.application.id"
        // ...
    }
    ```

2.  **Release Signing**:
    Follow the Flutter documentation to create a keystore and configure release signing in `android/app/build.gradle.kts`.

## 📂 Project Structure

The project follows a standard Flutter application structure, with key files located in the `lib/` directory.

```
smartpdm_mobileapp/
├── android/          # Android specific files
├── lib/              # Main application source code
│   ├── constants.dart  # App-wide constants (colors, styles)
│   ├── main.dart       # App entry point, routes, and theme
│   └── screens/        # UI screens for the application
├── test/             # Widget and unit tests
└── pubspec.yaml      # Project dependencies and metadata
```

## 🛠️ Built With

- Flutter - The UI toolkit for building natively compiled applications for mobile, web, and desktop from a single codebase.
- Provider - A state management library.

## 📄 License

This project is unlicensed. You are free to add a license of your choice.