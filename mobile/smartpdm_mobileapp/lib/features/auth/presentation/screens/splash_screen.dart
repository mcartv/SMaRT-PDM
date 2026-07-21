import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/shared_widgets.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  final SessionService _sessionService = const SessionService();

  bool _isChecking = true;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final isValid = await _sessionService.isSessionValid();

    if (!mounted) return;

    if (!isValid) {
      await _sessionService.clearSession();
      setState(() => _isChecking = false);
      return;
    }

    Navigator.pushReplacementNamed(context, AppRoutes.home);
  }

  void _goToExistingAccount() {
    Navigator.pushNamed(
      context,
      AppRoutes.studentLookup,
      arguments: 'existing',
    );
  }

  void _goToNewApplicant() {
    Navigator.pushNamed(context, AppRoutes.studentLookup, arguments: 'new');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AppColors.gold, AppColors.white],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: _isChecking
                ? const CircularProgressIndicator()
                : SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 18,
                      vertical: 18,
                    ),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 560),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 22,
                          vertical: 26,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.95),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.08),
                              blurRadius: 26,
                              offset: const Offset(0, 12),
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            /// LOGO
                            Image.asset(
                              'assets/images/school_logo.png',
                              height: 140,
                              fit: BoxFit.contain,
                            ),

                            const SizedBox(height: 18),

                            /// TITLE
                            Text(
                              'SMaRT-PDM',
                              style: Theme.of(context).textTheme.headlineMedium
                                  ?.copyWith(
                                    color: AppColors.darkBrown,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 34,
                                    height: 1.05,
                                  ),
                              textAlign: TextAlign.center,
                            ),

                            const SizedBox(height: 10),

                            /// SUBTITLE
                            Text(
                              'Scholarship Monitoring & Reporting Tool',
                              style: Theme.of(context).textTheme.bodyLarge
                                  ?.copyWith(
                                    color: AppColors.brown,
                                    fontSize: 18,
                                    height: 1.35,
                                  ),
                              textAlign: TextAlign.center,
                            ),

                            const SizedBox(height: 12),

                            /// DESCRIPTION
                            Text(
                              'Select how you want to continue',
                              style: Theme.of(context).textTheme.bodyMedium
                                  ?.copyWith(
                                    color: Colors.grey.shade700,
                                    fontSize: 16,
                                    height: 1.35,
                                  ),
                              textAlign: TextAlign.center,
                            ),

                            const SizedBox(height: 26),

                            /// NEW APPLICANT
                            SizedBox(
                              width: double.infinity,
                              child: GoldButton(
                                label: 'New Account',
                                onTap: _goToNewApplicant,
                              ),
                            ),

                            const SizedBox(height: 14),

                            /// EXISTING SCHOLAR
                            SizedBox(
                              width: double.infinity,
                              child: GhostButton(
                                label: 'Existing Account',
                                onTap: _goToExistingAccount,
                              ),
                            ),

                            const SizedBox(height: 14),

                            /// FOOTNOTE
                            Text(
                              'Use your Student ID to continue',
                              style: Theme.of(context).textTheme.labelMedium
                                  ?.copyWith(
                                    color: Colors.grey.shade600,
                                    fontSize: 14,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}
