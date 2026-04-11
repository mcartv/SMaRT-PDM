import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/screens/auth/login_screen.dart';
import 'package:smartpdm_mobileapp/screens/auth/register_screen.dart';
import 'package:smartpdm_mobileapp/screens/auth/otp_screen.dart';
import 'package:smartpdm_mobileapp/screens/auth/forgot_password_screen.dart';
import 'package:smartpdm_mobileapp/screens/auth/change_email_screen.dart';
import 'package:smartpdm_mobileapp/screens/auth/splash_screen.dart';
import 'package:smartpdm_mobileapp/screens/common/faqs_screen.dart';
import 'package:smartpdm_mobileapp/screens/common/status_tracking_screen.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/screens/applicant/applicant_documents_screen.dart';
import 'package:smartpdm_mobileapp/screens/applicant/new_applicant_screen.dart';
import 'package:smartpdm_mobileapp/screens/common/success_screen.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/screens/providers/new_scholar_provider.dart';
import 'package:smartpdm_mobileapp/screens/messaging/messaging_screen.dart';
import 'package:smartpdm_mobileapp/screens/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/screens/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/screens/providers/theme_provider.dart';
import 'package:smartpdm_mobileapp/screens/applicant/announcements_screen.dart';
import 'package:smartpdm_mobileapp/screens/applicant/scholarship_openings_screen.dart';
import 'package:smartpdm_mobileapp/screens/applicant/scholar_renewal_requirements_screen.dart';
import 'package:smartpdm_mobileapp/screens/scholar/ro_assignment_screen.dart';
import 'package:smartpdm_mobileapp/screens/scholar/ro_completion_screen.dart';
import 'package:smartpdm_mobileapp/screens/scholar/report_ticket_screen.dart';
import 'package:smartpdm_mobileapp/navigation/app_routes.dart';
import 'package:smartpdm_mobileapp/screens/common/top_level_shell_screen.dart';
import 'package:smartpdm_mobileapp/widgets/scholar_access_gate.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => NewScholarProvider()),
        ChangeNotifierProvider(create: (_) => MessagingProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  ApplicantDocumentsScreen _buildApplicantDocumentsScreen(
    BuildContext context,
  ) {
    final args = ModalRoute.of(context)?.settings.arguments;
    final payload = args is Map<String, dynamic> ? args : const {};

    return ApplicantDocumentsScreen(
      initialTitle: payload['initialTitle']?.toString(),
      initialProgramName: payload['initialProgramName']?.toString(),
    );
  }

  Widget _buildScholarOnlyScreen(Widget child) {
    return ScholarAccessGate(child: child);
  }

  @override
  Widget build(BuildContext context) {
    final lightTheme = ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        primary: primaryColor,
        secondary: accentColor,
        brightness: Brightness.light,
      ),
      primarySwatch: MaterialColor(primaryColor.toARGB32(), <int, Color>{
        50: primaryColor.withValues(alpha: 0.1),
        100: primaryColor.withValues(alpha: 0.2),
        200: primaryColor.withValues(alpha: 0.3),
        300: primaryColor.withValues(alpha: 0.4),
        400: primaryColor.withValues(alpha: 0.5),
        500: primaryColor.withValues(alpha: 0.6),
        600: primaryColor.withValues(alpha: 0.7),
        700: primaryColor.withValues(alpha: 0.8),
        800: primaryColor.withValues(alpha: 0.9),
        900: primaryColor.withValues(alpha: 1.0),
      }),
      scaffoldBackgroundColor: backgroundColor,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: pdmDarkBrown,
        elevation: 0,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
      ),
      visualDensity: VisualDensity.adaptivePlatformDensity,
    );

    final darkTheme = ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: primaryColor,
        primary: accentColor,
        secondary: accentColor,
        brightness: Brightness.dark,
      ),
      scaffoldBackgroundColor: const Color(0xFF24180F),
      canvasColor: const Color(0xFF2D1E12),
      cardColor: const Color(0xFF332216),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xFF24180F),
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(0xFF2D1E12),
        selectedItemColor: accentColor,
        unselectedItemColor: Colors.white70,
      ),
      dividerColor: Colors.white12,
      visualDensity: VisualDensity.adaptivePlatformDensity,
    );

    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) {
        return MaterialApp(
          title: 'SMaRT-PDM',
          theme: lightTheme,
          darkTheme: darkTheme,
          themeMode: themeProvider.themeMode,
          initialRoute: AppRoutes.splash,
          routes: {
            AppRoutes.splash: (context) => const SplashScreen(),
            AppRoutes.login: (context) => const LoginScreen(),
            AppRoutes.register: (context) => const RegisterScreen(),
            AppRoutes.otp: (context) => const OtpScreen(),
            AppRoutes.forgotPassword: (context) => const ForgotPasswordScreen(),
            AppRoutes.changeEmail: (context) => const ChangeEmailScreen(),
            AppRoutes.home: (context) =>
                const TopLevelShellScreen(initialIndex: 0),
            AppRoutes.payouts: (context) => _buildScholarOnlyScreen(
              const TopLevelShellScreen(initialIndex: 1),
            ),
            AppRoutes.notifications: (context) =>
                const TopLevelShellScreen(initialIndex: 2),
            AppRoutes.profile: (context) =>
                const TopLevelShellScreen(initialIndex: 3),
            AppRoutes.newApplicant: (context) => const NewApplicantScreen(),
            AppRoutes.application: (context) =>
                const PlaceholderScreen(title: 'Application'),
            AppRoutes.documents: (context) =>
                _buildApplicantDocumentsScreen(context),
            AppRoutes.renewalDocuments: (context) =>
                const ScholarRenewalRequirementsScreen(),
            AppRoutes.status: (context) => const StatusTrackingScreen(),
            AppRoutes.announcements: (context) => const AnnouncementsScreen(),
            AppRoutes.about: (context) =>
                const PlaceholderScreen(title: 'About PDM/OSFA'),
            AppRoutes.faqs: (context) => const FaqsScreen(),
            AppRoutes.messaging: (context) => const MessagingScreen(),
            AppRoutes.roAssignment: (context) =>
                _buildScholarOnlyScreen(const ROAssignmentScreen()),
            AppRoutes.roCompletion: (context) =>
                _buildScholarOnlyScreen(ROCompletionScreen()),
            AppRoutes.tickets: (context) =>
                _buildScholarOnlyScreen(const ReportTicketScreen()),
            AppRoutes.success: (context) => const SuccessScreen(),
            AppRoutes.scholarshipOpenings: (context) =>
                const ScholarshipOpeningsScreen(),
          },
          debugShowCheckedModeBanner: false,
        );
      },
    );
  }
}

// A simple placeholder screen for undefined routes
class PlaceholderScreen extends StatelessWidget {
  final String title;
  const PlaceholderScreen({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Text('This is the $title screen. Content coming soon!'),
      ),
    );
  }
}
