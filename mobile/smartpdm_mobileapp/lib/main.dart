import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:device_preview/device_preview.dart';
import 'constants.dart';
import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/otp_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/scholarship_list_screen.dart';
import 'screens/application_form_screen.dart';
import 'screens/document_upload_screen.dart';
import 'screens/status_tracking_screen.dart';
import 'screens/obligations_screen.dart';
import 'screens/profile_screen.dart';

void main() {
  runApp(DevicePreview(
    enabled: !const bool.fromEnvironment('dart.vm.product'),
    builder: (context) => const MyApp(),
  ));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SMART-PDM Scholarship System',
      theme: ThemeData(
        primaryColor: primaryColor,
        colorScheme: ColorScheme.fromSeed(
          seedColor: primaryColor,
          secondary: accentColor,
        ),
        scaffoldBackgroundColor: backgroundColor,
        fontFamily: GoogleFonts.inter().fontFamily,
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: primaryColor,
            foregroundColor: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(borderRadius),
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
          filled: true,
          fillColor: Colors.white,
        ),
        cardTheme: CardThemeData(
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
        ),
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const SplashScreen(),
        '/login': (context) => const LoginScreen(),
        '/otp': (context) => const OtpScreen(),
        '/dashboard': (context) => const DashboardScreen(),
        '/scholarships': (context) => const ScholarshipListScreen(),
        '/application': (context) => const ApplicationFormScreen(),
        '/documents': (context) => const DocumentUploadScreen(),
        '/status': (context) => const StatusTrackingScreen(),
        '/obligations': (context) => const ObligationsScreen(),
        '/profile': (context) => const ProfileScreen(),
      },
    );
  }
}
