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
            const SizedBox(height: 12),
            const _ProductionInformationCard(),
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

class _ProductionInformationCard extends StatelessWidget {
  const _ProductionInformationCard();

  static const _developers = <String>[
    'Jerry Geoff Bho',
    'Carl Arthur Buenavidez',
    'Leo Lawrence Galve',
    'Venice Eve Pelima',
  ];

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryText = isDark ? Colors.white : AppColors.darkBrown;
    final secondaryText = isDark
        ? Colors.white60
        : AppColors.brown.withValues(alpha: 0.68);

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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.14),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.deployed_code_outlined,
                  color: AppColors.gold,
                  size: 22,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Text(
                  'Production Information',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: primaryText,
                        fontWeight: FontWeight.w900,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _InformationRow(
            label: 'Production Version',
            value: 'Version 1.0.0 • Build 2',
            primaryText: primaryText,
            secondaryText: secondaryText,
          ),
          const SizedBox(height: 14),
          _InformationRow(
            label: 'Developed by',
            value: 'GALE (SMaRT-PDM Developers)',
            primaryText: primaryText,
            secondaryText: secondaryText,
          ),
          const SizedBox(height: 10),
          ..._developers.map(
            (developer) => Padding(
              padding: const EdgeInsets.only(left: 2, bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 5,
                    height: 5,
                    margin: const EdgeInsets.only(top: 7),
                    decoration: const BoxDecoration(
                      color: AppColors.gold,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      developer,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: secondaryText,
                            height: 1.45,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Divider(
            color: isDark
                ? Colors.white.withValues(alpha: 0.08)
                : AppColors.brown.withValues(alpha: 0.10),
          ),
          const SizedBox(height: 8),
          Text(
            'Developed for Pambayang Dalubhasaan ng Marilao — Office for Scholarship and Financial Assistance.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: secondaryText,
                  height: 1.5,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            '© 2026 GALE. All rights reserved.',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: secondaryText,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _InformationRow extends StatelessWidget {
  const _InformationRow({
    required this.label,
    required this.value,
    required this.primaryText,
    required this.secondaryText,
  });

  final String label;
  final String value;
  final Color primaryText;
  final Color secondaryText;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: secondaryText,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.25,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: primaryText,
                fontWeight: FontWeight.w800,
                height: 1.35,
              ),
        ),
      ],
    );
  }
}

