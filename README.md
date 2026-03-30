# SMaRT-PDM System

The Scholarship Management and Recipient Tracking - Program Document Management (SMaRT-PDM) system. This repository contains both the web application (for administrators) and the mobile application (for scholars and applicants).

## 🚀 Features

### Web Application (Admin Portal)
- **Dashboard**: Overview of scholarship programs and metrics.
- **Application Management**: Review, approve, or reject new scholarship applications.
- **Scholar Tracking**: Monitor academic progress and document submissions.
- **Payout Management**: Manage and track financial disbursements.

### Mobile Application (Scholar Portal)
- **User Authentication**: Secure login and registration for applicants and scholars.
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

- **Mobile**: Flutter SDK (check your version with `flutter --version`), an Android emulator or a physical device.
- **Web**: Node.js and npm (or yarn).
- A code editor like VS Code or Android Studio.

### Installation

1.  **Clone the repo**
    ```sh
    git clone https://github.com/your_username/SMaRT-PDM.git
    ```

#### Mobile Application

2.  **Navigate to the mobile project directory**
    ```sh
    cd SMaRT-PDM/mobile/smartpdm_mobileapp
    ```
3.  **Install dependencies and run**
    ```sh
    flutter pub get
    flutter run
    ```

#### Web Application

2.  **Navigate to the web project directory**
    ```sh
    cd SMaRT-PDM/web
    ```
3.  **Install dependencies and run**
    ```sh
    npm install
    npm start
    ```

## 📂 Project Structure

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