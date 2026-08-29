import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
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

  static const List<String> _scholarResponsibilities = [
    'Must carry the required academic load per semester as required by the course;',
    'Must not shift to any other course nor transfer to another school;',
    'Must pass all subjects and maintain a general weighted average of at least 2.00 (preferably 1.00-1.99);',
    'Must submit copy of registration form for recording and monitoring purposes;',
    'Must submit copy of grades or any valid proof of grades obtained in the previous semester for renewal of grant;',
    'Must agree to render not less than ten (10) hours per semester of “return obligation” (RO) to PDM as student assistant;',
    'Must render the RO within the semester. If not, inform the coordinator as soon as possible;',
    'Must possess Good Moral Character and Right Conduct. Be honest, courteous and polite especially to the faculty and staff;',
    'Must finish the course within the prescribed curriculum period;',
    'Must submit a copy of diploma or certificate of graduation upon completion of the degree;',
    'Must inform the Scholarship Coordinator of other scholarship grant/s from any other institution or agency and must furnish proof of such grant;',
    'Must not engage in illegal or immoral activities detrimental to the good name and reputation of PDM, the municipality of Marilao and the benefactor;',
    'Must not be cited for commission of any major academic or school offense throughout the duration of the grant;',
    'Must update the Scholarship Coordinator of any change in contact information (such as mobile number, landline number, address, email address, parent/s’ contact number, facebook/messenger account, etc.); and',
    'Must agree to abide by the policies set by the Scholarship Committee and other reasonable conditions as requested/required by the benefactor.',
  ];

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

    Navigator.of(
      context,
    ).pushNamedAndRemoveUntil(AppRoutes.login, (route) => false);
  }

  void _openRoute(String route) {
    Navigator.of(context).pushNamed(route);
  }

  void _openScholarResponsibilities() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const _ScholarResponsibilitiesScreen(
          responsibilities: _scholarResponsibilities,
        ),
      ),
    );
  }

  Widget _buildAvatar() {
    final avatar = _avatarUrl;

    Widget image;
    if (avatar == null || avatar.isEmpty) {
      image = Image.asset('assets/images/school_logo.png', fit: BoxFit.contain);
    } else if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
      image = Image.network(
        avatar,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) =>
            Image.asset('assets/images/school_logo.png', fit: BoxFit.contain),
      );
    } else if (!kIsWeb) {
      image = Image.file(
        File(avatar),
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) =>
            Image.asset('assets/images/school_logo.png', fit: BoxFit.contain),
      );
    } else {
      image = Image.asset('assets/images/school_logo.png', fit: BoxFit.contain);
    }

    return ClipOval(child: image);
  }

  @override
  Widget build(BuildContext context) {
    final notificationProvider = context.watch<NotificationProvider>();
    final hasScholarAccess = notificationProvider.scholarAccessRevision > 0
        ? notificationProvider.hasScholarAccess
        : notificationProvider.hasScholarAccess || _hasScholarAccess;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final background = isDark
        ? AppColors.applicantDarkBackground
        : const Color(0xFFF6F1EA);
    final surface = isDark ? AppColors.applicantDarkSurface : Colors.white;
    final titleColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;
    final mutedColor = isDark
        ? AppColors.applicantDarkTextMuted
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
            Semantics(
              button: true,
              label: 'Open Profile and Account',
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => _openRoute(AppRoutes.profile),
                child: _ProfileSummaryCard(
                  displayName: _displayName,
                  studentId: _studentId,
                  hasScholarAccess: hasScholarAccess,
                  isRefreshing: _isRefreshing,
                  avatar: _buildAvatar(),
                ),
              ),
            ),
            const SizedBox(height: 22),
            Text(
              'Account Settings',
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
                    icon: Icons.lock_reset_rounded,
                    title: 'Change Password',
                    subtitle: 'Update account security',
                    onTap: () => _openRoute(AppRoutes.forgotPassword),
                  ),
                  Divider(
                    height: 1,
                    indent: 72,
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.07)
                        : AppColors.brown.withValues(alpha: 0.08),
                  ),
                  _MenuListTile(
                    icon: Icons.alternate_email_rounded,
                    title: 'Registered Email',
                    subtitle: 'Update your account email',
                    onTap: () => _openRoute(AppRoutes.changeEmail),
                  ),
                  Divider(
                    height: 1,
                    indent: 72,
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.07)
                        : AppColors.brown.withValues(alpha: 0.08),
                  ),
                  _MenuListTile(
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
                  if (hasScholarAccess) ...[
                    Divider(
                      height: 1,
                      indent: 72,
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.07)
                          : AppColors.brown.withValues(alpha: 0.08),
                    ),
                    _MenuListTile(
                      icon: Icons.rule_rounded,
                      title: 'Scholar Responsibilities',
                      subtitle: 'Scholar obligations and conduct requirements',
                      onTap: _openScholarResponsibilities,
                    ),
                  ],
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
              hasScholarAccess
                  ? 'Scholar services are available from the navigation bar.'
                  : 'Scholar-only services remain locked until your application is accepted and activated.',
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: mutedColor, height: 1.45),
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
  });

  final String displayName;
  final String studentId;
  final bool hasScholarAccess;
  final bool isRefreshing;
  final Widget avatar;

  @override
  Widget build(BuildContext context) {
    return Container(
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
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
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
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: Colors.white70),
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
            size: 28,
          ),
        ],
      ),
    );
  }
}

class _ScholarResponsibilitiesScreen extends StatelessWidget {
  const _ScholarResponsibilitiesScreen({required this.responsibilities});

  final List<String> responsibilities;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final background = isDark
        ? const Color(0xFF17110B)
        : const Color(0xFFF6F1EA);
    final surface = isDark ? const Color(0xFF2B1D13) : Colors.white;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final bodyColor = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.brown;

    return Scaffold(
      backgroundColor: background,
      appBar: AppBar(
        title: const Text('Scholar Responsibilities'),
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: titleColor,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: isDark ? 0.14 : 0.12),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.rule_rounded, color: AppColors.gold),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Scholar's Obligations",
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              color: titleColor,
                              fontWeight: FontWeight.w900,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Office for Scholarship and Financial Assistance',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: bodyColor),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
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
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: responsibilities.length,
              separatorBuilder: (_, _) => Divider(
                height: 1,
                indent: 54,
                color: isDark
                    ? Colors.white.withValues(alpha: 0.07)
                    : AppColors.brown.withValues(alpha: 0.08),
              ),
              itemBuilder: (context, index) {
                return Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: AppColors.gold.withValues(
                            alpha: isDark ? 0.18 : 0.14,
                          ),
                          borderRadius: BorderRadius.circular(9),
                        ),
                        child: Text(
                          '${index + 1}',
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(
                                color: isDark
                                    ? AppColors.gold
                                    : AppColors.darkBrown,
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          responsibilities[index],
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: bodyColor, height: 1.5),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
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
          color: isDark ? AppColors.applicantDarkText : AppColors.darkBrown,
          fontWeight: FontWeight.w900,
        ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: isDark
                ? AppColors.applicantDarkTextMuted
                : AppColors.brown.withValues(alpha: 0.63),
          ),
        ),
      ),
      trailing: Icon(
        Icons.chevron_right_rounded,
        color: isDark
            ? AppColors.applicantDarkTextMuted.withValues(alpha: 0.58)
            : AppColors.brown.withValues(alpha: 0.42),
      ),
    );
  }
}
