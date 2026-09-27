import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

// SMART-PDM_MOBILE_ABOUT_BRANDING_PHASE7_V1

class AboutPdmScreen extends StatelessWidget {
  const AboutPdmScreen({super.key});

  static const _mission =
      'Cognizant of the importance of contributing to national development goals and every citizen\'s right to quality education, PDM commits itself to providing quality education and molding students into productive and responsible citizens who are imbued with virtues, aware of their national heritage, and proud of their local culture.';

  static const _vision =
      'Pambayang Dalubhasaan ng Marilao envisions becoming one of the premier higher educational institutions in the region, providing quality subsidized tertiary education and industry training programs committed to producing competent, competitive, capable, and skillful graduates who excel in their chosen fields.';

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
          children: const [
            _AboutHeroSection(),
            SizedBox(height: 12),
            _AboutExpandableSection(
              icon: Icons.grid_view_rounded,
              title: 'What you can do',
              child: _WhatYouCanDoRows(),
            ),
            SizedBox(height: 12),
            _MissionVisionSection(
              icon: Icons.flag_outlined,
              title: 'PDM Mission',
              body: _mission,
            ),
            SizedBox(height: 12),
            _MissionVisionSection(
              icon: Icons.visibility_outlined,
              title: 'PDM Vision',
              body: _vision,
            ),
            SizedBox(height: 12),
            _AboutExpandableSection(
              icon: Icons.account_balance_rounded,
              title: 'Office for Scholarship and Financial Assistance',
              body:
                  'OSFA manages scholarship applications, scholar records, payouts, renewal requirements, and important scholarship updates.',
            ),
            SizedBox(height: 12),
            _AboutExpandableSection(
              icon: Icons.verified_user_outlined,
              title: 'Your account & documents',
              body:
                  'Use your own registered account and keep your password private. Your submitted information is used for scholarship-related processing in SMaRT-PDM.',
            ),
            SizedBox(height: 12),
            _AboutThisAppCard(),
          ],
        ),
      ),
    );
  }
}

class _AboutHeroSection extends StatelessWidget {
  const _AboutHeroSection();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(24),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: true,
          tilePadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 8),
          childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
          backgroundColor: const Color(0xFF3A1D00),
          collapsedBackgroundColor: const Color(0xFF3A1D00),
          iconColor: AppColors.gold,
          collapsedIconColor: AppColors.gold,
          leading: Container(
            width: 50,
            height: 50,
            padding: const EdgeInsets.all(4),
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            child: Image.asset(
              'assets/images/school_logo.png',
              fit: BoxFit.contain,
            ),
          ),
          title: Text(
            'SMaRT-PDM',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
          subtitle: Text(
            'Tap to read',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: Colors.white70,
              fontWeight: FontWeight.w700,
            ),
          ),
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Your scholarship companion at Pambayang Dalubhasaan ng Marilao. Use SMaRT-PDM to follow scholarship requirements, updates, payouts, renewal, and Return of Obligation activities.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.white.withValues(alpha: isDark ? 0.78 : 0.86),
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

class _AboutExpandableSection extends StatelessWidget {
  const _AboutExpandableSection({
    required this.icon,
    required this.title,
    this.body,
    this.child,
  }) : assert(body != null || child != null);

  final IconData icon;
  final String title;
  final String? body;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: isDark ? const Color(0xFF2B1D13) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
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
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          leading: _AboutIconBox(icon: icon),
          iconColor: AppColors.gold,
          collapsedIconColor: AppColors.gold,
          title: Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: isDark ? Colors.white : AppColors.darkBrown,
              fontWeight: FontWeight.w900,
            ),
          ),
          subtitle: Text(
            'Tap to read',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: isDark
                  ? Colors.white54
                  : AppColors.brown.withValues(alpha: 0.58),
            ),
          ),
          children: [
            if (child != null)
              child!
            else
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  body!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? Colors.white70
                        : AppColors.brown.withValues(alpha: 0.76),
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
    return _AboutExpandableSection(
      icon: icon,
      title: title,
      body: body,
    );
  }
}

class _WhatYouCanDoRows extends StatelessWidget {
  const _WhatYouCanDoRows();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        _FeatureRow(
          icon: Icons.description_outlined,
          title: 'Application',
          body: 'Apply for scholarships and submit the required documents.',
        ),
        _FeatureDivider(),
        _FeatureRow(
          icon: Icons.notifications_none_rounded,
          title: 'Scholarship updates',
          body: 'Follow your application, endorsements, and important updates.',
        ),
        _FeatureDivider(),
        _FeatureRow(
          icon: Icons.payments_outlined,
          title: 'Payout & renewal',
          body: 'View payout releases and complete semester renewal requirements.',
        ),
        _FeatureDivider(),
        _FeatureRow(
          icon: Icons.schedule_outlined,
          title: 'Return of Obligation',
          body: 'View assignments, record attendance, and follow completed hours.',
        ),
      ],
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({
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

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: AppColors.gold),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isDark ? Colors.white : AppColors.darkBrown,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  body,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? Colors.white60
                        : AppColors.brown.withValues(alpha: 0.68),
                    height: 1.4,
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

class _FeatureDivider extends StatelessWidget {
  const _FeatureDivider();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Divider(
      height: 1,
      indent: 32,
      color: isDark
          ? Colors.white.withValues(alpha: 0.07)
          : AppColors.brown.withValues(alpha: 0.08),
    );
  }
}

class _AboutThisAppCard extends StatelessWidget {
  const _AboutThisAppCard();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryText = isDark ? Colors.white : AppColors.darkBrown;
    final secondaryText = isDark
        ? Colors.white60
        : AppColors.brown.withValues(alpha: 0.68);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2B1D13) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : AppColors.brown.withValues(alpha: 0.09),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _AboutIconBox(icon: Icons.info_outline_rounded),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'About this app',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  'Developed for Pambayang Dalubhasaan ng Marilao — Office for Scholarship and Financial Assistance.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: secondaryText,
                    height: 1.4,
                  ),
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
          ),
        ],
      ),
    );
  }
}

class _AboutIconBox extends StatelessWidget {
  const _AboutIconBox({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.14),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Icon(icon, color: AppColors.gold, size: 21),
    );
  }
}
