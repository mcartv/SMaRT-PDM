import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class AboutPdmScreen extends StatelessWidget {
  const AboutPdmScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final background = isDark
        ? const Color(0xFF17110B)
        : const Color(0xFFF6F1EA);

    return SmartPdmPageScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => AppNavigator.goBackOrHome(context),
        ),
        title: const Text('About SMaRT-PDM'),
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      selectedIndex: 4,
      showBottomNav: false,
      showDrawer: false,
      applyPadding: false,
      child: ColoredBox(
        color: background,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF2E1600), Color(0xFF4A2600)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Row(
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    padding: const EdgeInsets.all(5),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Image.asset(
                      'assets/images/school_logo.png',
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'SMaRT-PDM',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          'Scholarship Monitoring and Return-of-Obligation System',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Colors.white70,
                                height: 1.35,
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const _AboutSection(
              icon: Icons.info_outline_rounded,
              title: 'Overview',
              body:
                  'SMaRT-PDM supports scholarship applications, document submission, scholar monitoring, payout updates, renewal requirements, return-of-obligation tracking, and communication with OSFA.',
            ),
            const SizedBox(height: 12),
            const _AboutSection(
              icon: Icons.account_balance_rounded,
              title: 'Office of Student Financial Assistance',
              body:
                  'OSFA manages scholarship programs, evaluates applicants, monitors active scholars, coordinates payouts, and communicates important requirements and updates.',
            ),
            const SizedBox(height: 12),
            const _AboutSection(
              icon: Icons.verified_user_outlined,
              title: 'Account Privacy',
              body:
                  'Use only your registered account and keep your password private. Uploaded documents and profile details are used for scholarship-related processing within the system.',
            ),
          ],
        ),
      ),
    );
  }
}

class _AboutSection extends StatelessWidget {
  const _AboutSection({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2B1D13) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : AppColors.brown.withValues(alpha: 0.09),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: AppColors.gold, size: 22),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: isDark ? Colors.white : AppColors.darkBrown,
                        fontWeight: FontWeight.w900,
                      ),
                ),
                const SizedBox(height: 7),
                Text(
                  body,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? Colors.white60
                            : AppColors.brown.withValues(alpha: 0.68),
                        height: 1.5,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
