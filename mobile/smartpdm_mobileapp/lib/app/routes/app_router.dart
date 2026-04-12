import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/shell/presentation/screens/top_level_shell_screen.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/announcements_screen.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/applicant_documents_screen.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/new_applicant_screen.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/scholar_renewal_requirements_screen.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/scholarship_openings_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/change_email_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/complete_profile_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/forgot_password_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/login_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/otp_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/register_screen.dart';
import 'package:smartpdm_mobileapp/features/auth/presentation/screens/splash_screen.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/screens/faqs_screen.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/status_tracking_screen.dart';
import 'package:smartpdm_mobileapp/features/forms/presentation/screens/success_screen.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/screens/messaging_screen.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/screens/report_ticket_screen.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/screens/ro_assignment_screen.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/screens/ro_completion_screen.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_access_gate.dart';

class AppRouter {
  static Route<dynamic>? onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case AppRoutes.splash:
        return _buildRoute(settings, (_) => const SplashScreen());

      case AppRoutes.login:
        return _buildRoute(settings, (_) => const LoginScreen());

      case AppRoutes.register:
        return _buildRoute(settings, (_) => const RegisterScreen());

      case AppRoutes.otp:
        return _buildRoute(settings, (_) => const OtpScreen());

      case AppRoutes.forgotPassword:
        return _buildRoute(settings, (_) => const ForgotPasswordScreen());

      case AppRoutes.changeEmail:
        return _buildRoute(settings, (_) => const ChangeEmailScreen());

      case AppRoutes.completeProfile:
        return _buildRoute(settings, (_) => const CompleteProfileScreen());

      case AppRoutes.home:
        return _buildRoute(
          settings,
          (_) => const TopLevelShellScreen(initialIndex: 0),
        );

      case AppRoutes.payouts:
        return _buildRoute(
          settings,
          (_) => const ScholarAccessGate(
            child: TopLevelShellScreen(initialIndex: 1),
          ),
        );

      case AppRoutes.notifications:
        return _buildRoute(
          settings,
          (_) => const TopLevelShellScreen(initialIndex: 2),
        );

      case AppRoutes.profile:
        return _buildRoute(
          settings,
          (_) => const TopLevelShellScreen(initialIndex: 3),
        );

      case AppRoutes.newApplicant:
        return _buildRoute(
          settings,
          (context) => _buildNewApplicantScreen(context, settings),
        );

      case AppRoutes.application:
        return _buildRoute(
          settings,
          (_) => const _PlaceholderScreen(title: 'Application'),
        );

      case AppRoutes.documents:
        return _buildRoute(
          settings,
          (context) => _buildApplicantDocumentsScreen(context, settings),
        );

      case AppRoutes.renewalDocuments:
        return _buildRoute(
          settings,
          (_) => const ScholarRenewalRequirementsScreen(),
        );

      case AppRoutes.status:
        return _buildRoute(settings, (_) => const StatusTrackingScreen());

      case AppRoutes.announcements:
        return _buildRoute(settings, (_) => const AnnouncementsScreen());

      case AppRoutes.about:
        return _buildRoute(
          settings,
          (_) => const _PlaceholderScreen(title: 'About PDM/OSFA'),
        );

      case AppRoutes.faqs:
        return _buildRoute(settings, (_) => const FaqsScreen());

      case AppRoutes.messaging:
        return _buildRoute(settings, (_) => const MessagingScreen());

      case AppRoutes.roAssignment:
        return _buildRoute(
          settings,
          (_) => const ScholarAccessGate(child: ROAssignmentScreen()),
        );

      case AppRoutes.roCompletion:
        return _buildRoute(
          settings,
          (_) => const ScholarAccessGate(child: ROCompletionScreen()),
        );

      case AppRoutes.tickets:
        return _buildRoute(
          settings,
          (_) => const ScholarAccessGate(child: ReportTicketScreen()),
        );

      case AppRoutes.success:
        return _buildRoute(settings, (_) => const SuccessScreen());

      case AppRoutes.scholarshipOpenings:
        return _buildRoute(
          settings,
          (_) => const ScholarshipOpeningsScreen(),
        );

      default:
        return null;
    }
  }

  static ApplicantDocumentsScreen _buildApplicantDocumentsScreen(
    BuildContext context,
    RouteSettings settings,
  ) {
    final args = settings.arguments;
    final payload = args is Map<String, dynamic> ? args : const {};

    return ApplicantDocumentsScreen(
      initialTitle: payload['initialTitle']?.toString(),
      initialProgramName: payload['initialProgramName']?.toString(),
    );
  }

  static NewApplicantScreen _buildNewApplicantScreen(
    BuildContext context,
    RouteSettings settings,
  ) {
    final args = settings.arguments;
    final payload = args is Map<String, dynamic> ? args : const {};

    return NewApplicantScreen(
      initialOpeningId: payload['openingId']?.toString(),
      initialOpeningTitle: payload['openingTitle']?.toString(),
      initialProgramName: payload['programName']?.toString(),
      replaceExistingDraft: payload['replaceExistingDraft'] == true,
    );
  }

  static MaterialPageRoute<void> _buildRoute(
    RouteSettings settings,
    WidgetBuilder builder,
  ) {
    return MaterialPageRoute<void>(
      builder: builder,
      settings: settings,
    );
  }
}

class _PlaceholderScreen extends StatelessWidget {
  const _PlaceholderScreen({required this.title});

  final String title;

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