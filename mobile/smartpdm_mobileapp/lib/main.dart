import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/screens/auth/login_screen.dart';
import 'package:smartpdm_mobileapp/screens/auth/register_screen.dart';
import 'package:smartpdm_mobileapp/screens/auth/otp_screen.dart';
import 'package:smartpdm_mobileapp/screens/auth/forgot_password_screen.dart';
import 'package:smartpdm_mobileapp/screens/auth/splash_screen.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/screens/applicant/new_applicant_screen.dart';
import 'package:smartpdm_mobileapp/screens/profile/existing_scholar_screen.dart';
import 'package:smartpdm_mobileapp/screens/common/success_screen.dart';
import 'package:smartpdm_mobileapp/screens/common/dashboard_screen.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/screens/providers/new_scholar_provider.dart';
import 'package:smartpdm_mobileapp/screens/messaging/messaging_screen.dart';
import 'package:smartpdm_mobileapp/screens/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/screens/applicant/interview_schedule_screen.dart';
import 'package:smartpdm_mobileapp/screens/applicant/announcements_screen.dart';
import 'package:smartpdm_mobileapp/screens/applicant/notifications_screen.dart';
import 'package:smartpdm_mobileapp/screens/applicant/renewal_requirements_screen.dart';
import 'package:smartpdm_mobileapp/screens/scholar/payout_schedule_screen.dart';
import 'package:smartpdm_mobileapp/screens/scholar/ro_assignment_screen.dart';
import 'package:smartpdm_mobileapp/screens/scholar/ro_completion_screen.dart';
import 'package:smartpdm_mobileapp/screens/scholar/report_ticket_screen.dart';
import 'package:smartpdm_mobileapp/screens/profile/profile_screen.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => NewScholarProvider()),
        ChangeNotifierProvider(create: (_) => MessagingProvider()),
        ChangeNotifierProvider(create: (_) => NewScholarProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SMaRT-PDM',
      theme: ThemeData(
        // Define a custom color scheme using your constants
        colorScheme: ColorScheme.fromSeed(
          seedColor: primaryColor, // Use your primary color as the seed
          primary: primaryColor,
          secondary: accentColor,
          // You can define other colors here as well, e.g., background, surface, etc.
        ),
        // The primarySwatch is a MaterialColor (a map of 10 shades).
        // If you want to use your single primaryColor as the primarySwatch,
        // you need to create a MaterialColor from it.
        // This ensures older widgets or those relying on primarySwatch still get your color.
        primarySwatch: MaterialColor(primaryColor.value, <int, Color>{
          50: primaryColor.withOpacity(0.1), 100: primaryColor.withOpacity(0.2), 200: primaryColor.withOpacity(0.3), 300: primaryColor.withOpacity(0.4), 400: primaryColor.withOpacity(0.5), 500: primaryColor.withOpacity(0.6), 600: primaryColor.withOpacity(0.7), 700: primaryColor.withOpacity(0.8), 800: primaryColor.withOpacity(0.9), 900: primaryColor.withOpacity(1.0),
        }),
        visualDensity: VisualDensity.adaptivePlatformDensity,
      ),
      initialRoute: '/splash', // Set your initial route
      routes: {
        // Splash & Authentication
        '/splash': (context) => const SplashScreen(),
        '/login': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/otp': (context) => const OtpScreen(),
        '/forgot-password': (context) => const ForgotPasswordScreen(),

        // Main Navigation
        '/home': (context) => const DashboardScreen(),

        // Applicant Routes
        '/new_applicant': (context) => const NewApplicantScreen(),
        '/application': (context) => const PlaceholderScreen(title: 'Application'),
        '/documents': (context) => const RenewalRequirementsScreen(),
        '/status': (context) => const PlaceholderScreen(title: 'Status'),
        '/interview-schedule': (context) => const InterviewScheduleScreen(),
        '/announcements': (context) => const AnnouncementsScreen(),
        '/notifications': (context) => const NotificationsScreen(),
        '/about': (context) => const PlaceholderScreen(title: 'About PDM/OSFA'),
        '/faqs': (context) => const PlaceholderScreen(title: 'FAQs'),
        '/messaging': (context) => const MessagingScreen(),

        // Scholar Routes
        '/payouts': (context) => const PayoutScheduleScreen(),
        '/ro-assignment': (context) => const ROAssignmentScreen(),
        '/ro-completion': (context) => ROCompletionScreen(),
        '/tickets': (context) => const ReportTicketScreen(),

        // Profile & Account
        '/profile': (context) => const ProfileScreen(),
        '/existing_scholar_update': (context) => const ExistingScholarScreen(),
        '/success': (context) => const SuccessScreen(),
      },
      debugShowCheckedModeBanner: false, // Set to true for debugging
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