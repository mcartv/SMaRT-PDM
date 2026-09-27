import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

// SMART-PDM_MOBILE_ABOUT_BRANDING_PHASE7_V1

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
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          'Scholarship Monitoring and Return-of-Obligation System',
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(color: Colors.white70, height: 1.35),
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
            const _MissionVisionSection(
              icon: Icons.flag_outlined,
              title: 'PDM Mission',
              body:
                  'Cognizant of the importance of contributing to national development goals and every citizen\'s right to quality education, PDM commits itself to providing quality education and molding students into productive and responsible citizens who are imbued with virtues, aware of their national heritage, and proud of their local culture.',
            ),
            const SizedBox(height: 12),
            const _MissionVisionSection(
              icon: Icons.visibility_outlined,
              title: 'PDM Vision',
              body:
                  'Pambayang Dalubhasaan ng Marilao envisions becoming one of the premier higher educational institutions in the region, providing quality subsidized tertiary education and industry training programs committed to producing competent, competitive, capable, and skillful graduates who excel in their chosen fields.',
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

class _MissionVisionSection extends StatelessWidget {
  const _MissionVisionSection({
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

    return Material(
      color: isDark ? const Color(0xFF2B1D13) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : AppColors.brown.withValues(alpha: 0.09),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 5),
          childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
          leading: Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: AppColors.gold, size: 22),
          ),
          iconColor: AppColors.gold,
          collapsedIconColor: AppColors.gold,
          title: Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: isDark ? Colors.white : AppColors.darkBrown,
              fontWeight: FontWeight.w900,
            ),
          ),
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                body,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? Colors.white60
                      : AppColors.brown.withValues(alpha: 0.68),
                  height: 1.5,
                ),
              ),
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

class _ProductionInformationCard extends StatelessWidget {
  const _ProductionInformationCard();

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
                  Icons.code_rounded,
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
          const SizedBox(height: 12),
          Divider(
            color: isDark
                ? Colors.white.withValues(alpha: 0.08)
                : AppColors.brown.withValues(alpha: 0.10),
          ),
          const SizedBox(height: 8),
          Text(
            'Developed for Pambayang Dalubhasaan ng Marilao — Office for Scholarship and Financial Assistance.',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: secondaryText, height: 1.5),
          ),
          const SizedBox(height: 8),
          Text(
            '© 2026 SMaRT-PDM. All rights reserved.',
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
