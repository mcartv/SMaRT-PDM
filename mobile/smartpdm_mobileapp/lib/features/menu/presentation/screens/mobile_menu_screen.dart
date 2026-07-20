import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_settings_sheet.dart';

class MobileMenuScreen extends StatefulWidget {
  const MobileMenuScreen({super.key});

  @override
  State<MobileMenuScreen> createState() => _MobileMenuScreenState();
}

class _MobileMenuScreenState extends State<MobileMenuScreen> {
  String _displayName = 'SMaRT-PDM User';
  String _studentId = '';
  bool _hasScholarAccess = false;

  @override
  void initState() {
    super.initState();
    _loadSessionSummary();
  }

  Future<void> _loadSessionSummary() async {
    final prefs = await SharedPreferences.getInstance();
    final firstName = prefs.getString('user_first_name')?.trim() ?? '';
    final lastName = prefs.getString('user_last_name')?.trim() ?? '';
    final fullName = <String>[firstName, lastName]
        .where((part) => part.isNotEmpty)
        .join(' ');

    if (!mounted) return;

    setState(() {
      _displayName = fullName.isEmpty ? 'SMaRT-PDM User' : fullName;
      _studentId = prefs.getString('user_student_id')?.trim() ?? '';
      _hasScholarAccess =
          prefs.getBool('user_has_scholar_access') ?? false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final background = isDark
        ? const Color(0xFF17110B)
        : const Color(0xFFF6F2EC);
    final surface = isDark ? const Color(0xFF2B1D13) : AppColors.white;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark
        ? Colors.white70
        : AppColors.brown.withValues(alpha: 0.70);

    return ColoredBox(
      color: background,
      child: RefreshIndicator(
        onRefresh: _loadSessionSummary,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 28),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.darkBrown,
                borderRadius: BorderRadius.circular(22),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.darkBrown.withValues(alpha: 0.18),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 58,
                    height: 58,
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: AppColors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Image.asset(
                      'assets/images/school_logo.png',
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _displayName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _studentId.isEmpty ? 'Student Account' : _studentId,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: Colors.white70),
                        ),
                        const SizedBox(height: 7),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.gold,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            _hasScholarAccess ? 'SCHOLAR' : 'APPLICANT',
                            style: Theme.of(context)
                                .textTheme
                                .labelSmall
                                ?.copyWith(
                                  color: AppColors.darkBrown,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.6,
                                ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Text(
              'Account and Services',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: titleColor,
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.08)
                      : AppColors.brown.withValues(alpha: 0.10),
                ),
              ),
              child: Column(
                children: [
                  _MenuTile(
                    icon: Icons.person_rounded,
                    title: 'Profile and Account',
                    subtitle: 'View and update your account information',
                    onTap: () =>
                        Navigator.pushNamed(context, AppRoutes.profile),
                  ),
                  const _MenuDivider(),
                  _MenuTile(
                    icon: Icons.forum_rounded,
                    title: 'Messages',
                    subtitle: 'Communicate with OSFA',
                    onTap: () =>
                        Navigator.pushNamed(context, AppRoutes.messaging),
                  ),
                  const _MenuDivider(),
                  _MenuTile(
                    icon: Icons.notifications_rounded,
                    title: 'Notifications',
                    subtitle: 'Review alerts and system updates',
                    onTap: () =>
                        Navigator.pushNamed(context, AppRoutes.notifications),
                  ),
                  const _MenuDivider(),
                  _MenuTile(
                    icon: Icons.campaign_rounded,
                    title: 'Announcements',
                    subtitle: 'Read scholarship and OSFA announcements',
                    onTap: () =>
                        Navigator.pushNamed(context, AppRoutes.announcements),
                  ),
                  const _MenuDivider(),
                  _MenuTile(
                    icon: Icons.help_outline_rounded,
                    title: 'Frequently Asked Questions',
                    subtitle: 'Find answers about the scholarship process',
                    onTap: () =>
                        Navigator.pushNamed(context, AppRoutes.faqs),
                  ),
                  const _MenuDivider(),
                  _MenuTile(
                    icon: Icons.settings_rounded,
                    title: 'Settings',
                    subtitle: 'Theme, account, and application preferences',
                    onTap: () => showAppSettingsSheet(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Scholar functions remain locked until the applicant is accepted '
              'and activated as a scholar.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: subtitleColor,
                    height: 1.45,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
      leading: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.15),
          borderRadius: BorderRadius.circular(13),
        ),
        child: Icon(icon, color: AppColors.gold, size: 23),
      ),
      title: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: isDark ? Colors.white : AppColors.darkBrown,
              fontWeight: FontWeight.w800,
            ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: isDark
                    ? Colors.white60
                    : AppColors.brown.withValues(alpha: 0.65),
              ),
        ),
      ),
      trailing: Icon(
        Icons.chevron_right_rounded,
        color: isDark
            ? Colors.white38
            : AppColors.brown.withValues(alpha: 0.45),
      ),
    );
  }
}

class _MenuDivider extends StatelessWidget {
  const _MenuDivider();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Divider(
      height: 1,
      indent: 70,
      color: isDark
          ? Colors.white.withValues(alpha: 0.07)
          : AppColors.brown.withValues(alpha: 0.08),
    );
  }
}
