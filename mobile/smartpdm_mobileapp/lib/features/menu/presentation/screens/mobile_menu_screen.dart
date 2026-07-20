import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/profile/data/services/profile_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_settings_sheet.dart';

class MobileMenuScreen extends StatefulWidget {
  const MobileMenuScreen({super.key});

  @override
  State<MobileMenuScreen> createState() => _MobileMenuScreenState();
}

class _MobileMenuScreenState extends State<MobileMenuScreen> {
  final SessionService _sessionService = const SessionService();
  final ProfileService _profileService = ProfileService();

  String _displayName = 'SMaRT-PDM User';
  String _studentId = '';
  String? _avatarUrl;
  bool _hasScholarAccess = false;
  bool _isRefreshing = false;

  @override
  void initState() {
    super.initState();
    _loadSessionSummary(refreshRemote: true);
  }

  Future<void> _loadSessionSummary({bool refreshRemote = false}) async {
    if (mounted) {
      setState(() => _isRefreshing = true);
    }

    if (refreshRemote) {
      try {
        await _profileService.fetchMyProfile();
      } catch (_) {
        // Keep the cached session values when the profile endpoint is unavailable.
      }
    }

    final session = await _sessionService.getCurrentUser();
    if (!mounted) return;

    final fullName = <String>[
      session.firstName.trim(),
      session.lastName.trim(),
    ].where((part) => part.isNotEmpty).join(' ');

    setState(() {
      _displayName = fullName.isEmpty ? 'SMaRT-PDM User' : fullName;
      _studentId = session.studentId.trim();
      _avatarUrl = session.avatarUrl?.trim().isNotEmpty == true
          ? session.avatarUrl!.trim()
          : null;
      _hasScholarAccess = session.hasScholarAccess;
      _isRefreshing = false;
    });
  }

  Future<void> _confirmLogout() async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        final isDark = Theme.of(dialogContext).brightness == Brightness.dark;

        return AlertDialog(
          icon: const Icon(Icons.logout_rounded, color: Colors.redAccent),
          title: const Text('Log out?'),
          content: const Text(
            'You will need to sign in again to access your SMaRT-PDM account.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.redAccent,
                foregroundColor: Colors.white,
              ),
              child: Text(isDark ? 'Log out' : 'Log out'),
            ),
          ],
        );
      },
    );

    if (shouldLogout != true) return;

    await _sessionService.clearSession();
    if (!mounted) return;

    Navigator.of(context).pushNamedAndRemoveUntil(
      AppRoutes.login,
      (route) => false,
    );
  }

  void _openRoute(String route) {
    Navigator.of(context).pushNamed(route);
  }

  Widget _buildAvatar() {
    final avatar = _avatarUrl;

    Widget image;
    if (avatar == null || avatar.isEmpty) {
      image = Image.asset(
        'assets/images/school_logo.png',
        fit: BoxFit.contain,
      );
    } else if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      image = Image.network(
        avatar,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => Image.asset(
          'assets/images/school_logo.png',
          fit: BoxFit.contain,
        ),
      );
    } else if (!kIsWeb) {
      image = Image.file(
        File(avatar),
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => Image.asset(
          'assets/images/school_logo.png',
          fit: BoxFit.contain,
        ),
      );
    } else {
      image = Image.asset(
        'assets/images/school_logo.png',
        fit: BoxFit.contain,
      );
    }

    return ClipOval(child: image);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final background = isDark
        ? const Color(0xFF17110B)
        : const Color(0xFFF6F1EA);
    final surface = isDark ? const Color(0xFF2B1D13) : Colors.white;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final mutedColor = isDark
        ? Colors.white60
        : AppColors.brown.withValues(alpha: 0.66);

    return ColoredBox(
      color: background,
      child: RefreshIndicator(
        color: AppColors.gold,
        onRefresh: () => _loadSessionSummary(refreshRemote: true),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(14, 16, 14, 118),
          children: [
            _ProfileSummaryCard(
              displayName: _displayName,
              studentId: _studentId,
              hasScholarAccess: _hasScholarAccess,
              isRefreshing: _isRefreshing,
              avatar: _buildAvatar(),
              onTap: () => _openRoute(AppRoutes.profile),
            ),
            const SizedBox(height: 22),
            Text(
              'Account',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: titleColor,
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.08)
                      : AppColors.brown.withValues(alpha: 0.09),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 0.96,
                children: [
                  _MenuActionCard(
                    icon: Icons.person_rounded,
                    title: 'Profile and Account',
                    subtitle: 'Personal and academic details',
                    onTap: () => _openRoute(AppRoutes.profile),
                  ),
                  _MenuActionCard(
                    icon: Icons.lock_reset_rounded,
                    title: 'Change Password',
                    subtitle: 'Update account security',
                    onTap: () => _openRoute(AppRoutes.forgotPassword),
                  ),
                  _MenuActionCard(
                    icon: Icons.alternate_email_rounded,
                    title: 'Registered Email',
                    subtitle: 'Update your account email',
                    onTap: () => _openRoute(AppRoutes.changeEmail),
                  ),
                  _MenuActionCard(
                    icon: Icons.palette_rounded,
                    title: 'Theme',
                    subtitle: 'Light and dark appearance',
                    onTap: () => showAppSettingsSheet(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Text(
              'Information',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: titleColor,
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.08)
                      : AppColors.brown.withValues(alpha: 0.09),
                ),
              ),
              child: Column(
                children: [
                  _MenuListTile(
                    icon: Icons.help_outline_rounded,
                    title: 'Frequently Asked Questions',
                    subtitle: 'Answers about applications and scholarships',
                    onTap: () => _openRoute(AppRoutes.faqs),
                  ),
                  Divider(
                    height: 1,
                    indent: 72,
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.07)
                        : AppColors.brown.withValues(alpha: 0.08),
                  ),
                  _MenuListTile(
                    icon: Icons.info_outline_rounded,
                    title: 'About SMaRT-PDM',
                    subtitle: 'System purpose and OSFA information',
                    onTap: () => _openRoute(AppRoutes.about),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            OutlinedButton.icon(
              onPressed: _confirmLogout,
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Log Out'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.redAccent,
                side: BorderSide(
                  color: Colors.redAccent.withValues(alpha: 0.45),
                ),
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
                textStyle: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              _hasScholarAccess
                  ? 'Scholar services are available from the navigation bar.'
                  : 'Scholar-only services remain locked until your application is accepted and activated.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: mutedColor,
                    height: 1.45,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileSummaryCard extends StatelessWidget {
  const _ProfileSummaryCard({
    required this.displayName,
    required this.studentId,
    required this.hasScholarAccess,
    required this.isRefreshing,
    required this.avatar,
    required this.onTap,
  });

  final String displayName;
  final String studentId;
  final bool hasScholarAccess;
  final bool isRefreshing;
  final Widget avatar;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.darkBrown,
      borderRadius: BorderRadius.circular(26),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(26),
        child: Container(
          padding: const EdgeInsets.fromLTRB(18, 18, 14, 18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(26),
            gradient: const LinearGradient(
              colors: [Color(0xFF2E1600), Color(0xFF4A2600)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.darkBrown.withValues(alpha: 0.22),
                blurRadius: 22,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 68,
                height: 68,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.gold, width: 2),
                ),
                child: avatar,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                        ),
                        if (isRefreshing)
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.gold,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      studentId.isEmpty ? 'Student Account' : studentId,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.white70,
                          ),
                    ),
                    const SizedBox(height: 9),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.gold,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        hasScholarAccess ? 'SCHOLAR' : 'APPLICANT',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.darkBrown,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.7,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(
                Icons.chevron_right_rounded,
                color: Colors.white70,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuActionCard extends StatelessWidget {
  const _MenuActionCard({
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

    return Material(
      color: isDark
          ? AppColors.gold.withValues(alpha: 0.10)
          : const Color(0xFFFFFAEC),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: isDark ? 0.20 : 0.16),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: AppColors.gold, size: 23),
              ),
              const SizedBox(height: 11),
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: isDark ? Colors.white : AppColors.darkBrown,
                      fontWeight: FontWeight.w900,
                      height: 1.12,
                    ),
              ),
              const Spacer(),
              Text(
                subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isDark
                          ? Colors.white60
                          : AppColors.brown.withValues(alpha: 0.62),
                      height: 1.25,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MenuListTile extends StatelessWidget {
  const _MenuListTile({
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
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.14),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Icon(icon, color: AppColors.gold, size: 23),
      ),
      title: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: isDark ? Colors.white : AppColors.darkBrown,
              fontWeight: FontWeight.w900,
            ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: isDark
                    ? Colors.white60
                    : AppColors.brown.withValues(alpha: 0.63),
              ),
        ),
      ),
      trailing: Icon(
        Icons.chevron_right_rounded,
        color: isDark
            ? Colors.white38
            : AppColors.brown.withValues(alpha: 0.42),
      ),
    );
  }
}
