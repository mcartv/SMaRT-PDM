import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_settings_sheet.dart';

class SmartPdmDrawer extends StatelessWidget {
  final bool isScholar;
  final String userName;
  final String? avatarUrl;

  const SmartPdmDrawer({
    super.key,
    this.isScholar = false,
    this.userName = 'Scholar',
    this.avatarUrl,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final drawerBackground = isDark ? const Color(0xFF17110B) : Colors.white;
    final dividerColor = isDark ? Colors.white10 : const Color(0xFFEAE2D8);

    return Drawer(
      width: MediaQuery.sizeOf(context).width * 0.78,
      elevation: 18,
      backgroundColor: drawerBackground,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(right: Radius.circular(28)),
      ),
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          _DrawerProfileHeader(
            userName: userName,
            avatarUrl: avatarUrl,
            roleLabel: isScholar ? 'Approved Scholar' : 'Applicant',
            isDark: isDark,
            onTap: () {
              Navigator.pop(context);
              AppNavigator.goToTopLevel(context, AppRoutes.profile);
            },
          ),
          _DrawerSectionLabel(label: isScholar ? 'SCHOLAR' : 'APPLICANT'),
          if (!isScholar) ...[
            _DrawerMenuItem(
              icon: Icons.assignment,
              title: 'Apply for Scholarship',
              subtitle: 'Browse and apply for openings',
              isDark: isDark,
              onTap: () => _openRoute(context, AppRoutes.scholarshipOpenings),
            ),
            _DrawerMenuItem(
              icon: Icons.check_circle,
              title: 'Application Status',
              subtitle: 'Track your application progress',
              isDark: isDark,
              onTap: () => _openRoute(context, AppRoutes.status),
            ),
            _DrawerMenuItem(
              icon: Icons.help_outline,
              title: 'FAQs',
              subtitle: 'Get answers to common questions',
              isDark: isDark,
              onTap: () => _openRoute(context, AppRoutes.faqs),
            ),
          ] else ...[
            _DrawerMenuItem(
              icon: Icons.payment,
              title: 'Payout Schedule',
              subtitle: 'View release dates and notices',
              isDark: isDark,
              onTap: () => _openRoute(context, AppRoutes.payouts),
            ),
            _DrawerMenuItem(
              icon: Icons.done_all,
              title: 'Submit RO Completion',
              subtitle: 'Upload proof and track progress',
              isDark: isDark,
              onTap: () => _openRoute(context, AppRoutes.roCompletion),
            ),
          ],
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 18, 24, 4),
            child: Divider(height: 1, color: dividerColor),
          ),
          const _DrawerSectionLabel(label: 'ACCOUNT'),
          _DrawerMenuItem(
            icon: Icons.person,
            title: 'Profile',
            subtitle: 'View and edit your profile',
            isDark: isDark,
            onTap: () => _openRoute(context, AppRoutes.profile),
          ),
          _DrawerMenuItem(
            icon: Icons.settings_outlined,
            title: 'App Settings',
            subtitle: 'Customize your app experience',
            isDark: isDark,
            onTap: () async {
              Navigator.pop(context);
              await showAppSettingsSheet(context);
            },
          ),
          _DrawerMenuItem(
            icon: Icons.alternate_email,
            title: 'Change Email',
            subtitle: 'Update your registered email',
            isDark: isDark,
            onTap: () => _openRoute(context, AppRoutes.changeEmail),
          ),
          _DrawerMenuItem(
            icon: Icons.lock,
            title: 'Change Password',
            subtitle: 'Update your password',
            isDark: isDark,
            onTap: () => _openRoute(context, AppRoutes.forgotPassword),
          ),
          const SizedBox(height: 10),
          _DrawerLogoutItem(
            isDark: isDark,
            onTap: () => _confirmLogout(context),
          ),
          const SizedBox(height: 28),
        ],
      ),
    );
  }

  void _openRoute(BuildContext context, String route) {
    Navigator.pop(context);
    if (AppRoutes.isTopLevel(route)) {
      AppNavigator.goToTopLevel(context, route);
      return;
    }
    Navigator.pushNamed(context, route);
  }

  void _confirmLogout(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cancelColor = isDark ? Colors.white70 : AppColors.brown;
    final confirmColor = isDark ? const Color(0xFFFF8A80) : Colors.red;

    showDialog(
      context: context,
      builder: (dialogContext) {
        final dialogIsDark =
            Theme.of(dialogContext).brightness == Brightness.dark;
        final dialogTitleColor = dialogIsDark
            ? Colors.white
            : AppColors.darkBrown;
        final dialogBodyColor = dialogIsDark ? Colors.white70 : Colors.black87;

        return AlertDialog(
          title: Text('Logout', style: TextStyle(color: dialogTitleColor)),
          content: Text(
            'Are you sure you want to logout?',
            style: TextStyle(color: dialogBodyColor),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text('Cancel', style: TextStyle(color: cancelColor)),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(dialogContext);
                AppNavigator.goToTopLevel(context, AppRoutes.login);
              },
              child: Text('Logout', style: TextStyle(color: confirmColor)),
            ),
          ],
        );
      },
    );
  }
}

class _DrawerProfileHeader extends StatelessWidget {
  const _DrawerProfileHeader({
    required this.userName,
    required this.avatarUrl,
    required this.roleLabel,
    required this.isDark,
    required this.onTap,
  });

  final String userName;
  final String? avatarUrl;
  final String roleLabel;
  final bool isDark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final titleColor = isDark ? Colors.white : AppColors.black;
    final roleColor = isDark
        ? const Color(0xFFFFD54F)
        : const Color(0xFF9B7A47);

    return InkWell(
      onTap: onTap,
      child: Container(
        height: 240,
        padding: const EdgeInsets.fromLTRB(24, 26, 24, 24),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? const [
                    Color(0xFF1B1006),
                    Color(0xFF3A2408),
                    Color(0xFF17110B),
                  ]
                : const [
                    Color(0xFFFFFFFF),
                    Color(0xFFFFFCF5),
                    Color(0xFFFFF4D5),
                  ],
          ),
          border: Border(
            bottom: BorderSide(
              color: isDark ? Colors.white10 : const Color(0xFFECE2D4),
            ),
          ),
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: CustomPaint(
                painter: _DrawerHeaderLinesPainter(isDark: isDark),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                _DrawerAvatar(userName: userName, avatarUrl: avatarUrl),
                const SizedBox(height: 18),
                Text(
                  userName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: titleColor,
                    fontSize: 25,
                    fontWeight: FontWeight.w900,
                    height: 1,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  roleLabel,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: roleColor,
                    fontWeight: FontWeight.w700,
                    height: 1,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DrawerSectionLabel extends StatelessWidget {
  const _DrawerSectionLabel({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 26, 24, 10),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: isDark ? Colors.white60 : const Color(0xFF83766A),
          fontWeight: FontWeight.w900,
          letterSpacing: 1,
        ),
      ),
    );
  }
}

class _DrawerMenuItem extends StatelessWidget {
  const _DrawerMenuItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.isDark,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool isDark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final backgroundColor = isDark
        ? const Color(0xFF241A11).withValues(alpha: 0.86)
        : Colors.white;
    final iconBackground = isDark
        ? AppColors.gold.withValues(alpha: 0.13)
        : const Color(0xFFFFF7E3);
    final borderColor = isDark
        ? const Color(0xFF564635)
        : const Color(0xFFEDE6DB);
    final titleColor = isDark ? Colors.white : AppColors.black;
    final subtitleColor = isDark ? Colors.white60 : const Color(0xFF66605A);
    final chevronColor = isDark ? Colors.white54 : const Color(0xFF8D8780);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 5),
      child: Material(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Container(
            padding: const EdgeInsets.fromLTRB(14, 11, 12, 11),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: borderColor),
              boxShadow: isDark
                  ? const []
                  : const [
                      BoxShadow(
                        color: Color(0x0A000000),
                        blurRadius: 18,
                        offset: Offset(0, 8),
                      ),
                    ],
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: iconBackground,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(
                    icon,
                    color: isDark ? const Color(0xFFFFC20A) : AppColors.gold,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              color: titleColor,
                              fontWeight: FontWeight.w800,
                              height: 1.05,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: subtitleColor,
                          fontWeight: FontWeight.w500,
                          fontSize: 12.5,
                          height: 1.08,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  color: chevronColor,
                  size: 28,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DrawerLogoutItem extends StatelessWidget {
  const _DrawerLogoutItem({required this.isDark, required this.onTap});

  final bool isDark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    const red = Color(0xFFFF3B3B);
    final backgroundColor = isDark
        ? const Color(0xFF3A1E16).withValues(alpha: 0.78)
        : const Color(0xFFFFF0F0);
    final borderColor = isDark
        ? const Color(0xFF714033)
        : const Color(0xFFFFDDDD);
    final subtitleColor = isDark ? Colors.white60 : const Color(0xFF66605A);

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 0),
      child: Material(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Container(
            padding: const EdgeInsets.fromLTRB(14, 11, 12, 11),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: borderColor),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: isDark
                        ? red.withValues(alpha: 0.12)
                        : Colors.white.withValues(alpha: 0.68),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: const Icon(Icons.logout_rounded, color: red, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Logout',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              color: red,
                              fontWeight: FontWeight.w800,
                              height: 1.05,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Sign out from your account',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: subtitleColor,
                          fontWeight: FontWeight.w500,
                          fontSize: 12.5,
                          height: 1.08,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: red, size: 28),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DrawerAvatar extends StatelessWidget {
  const _DrawerAvatar({required this.userName, required this.avatarUrl});

  final String userName;
  final String? avatarUrl;

  @override
  Widget build(BuildContext context) {
    final trimmedAvatarUrl = avatarUrl?.trim() ?? '';
    final initial = userName.isNotEmpty ? userName[0].toUpperCase() : 'U';

    return Stack(
      clipBehavior: Clip.none,
      children: [
        CircleAvatar(
          radius: 44,
          backgroundColor: const Color(0xFFFFF4C7),
          backgroundImage: trimmedAvatarUrl.isEmpty
              ? null
              : NetworkImage(trimmedAvatarUrl),
          onBackgroundImageError: trimmedAvatarUrl.isEmpty ? null : (_, _) {},
          child: trimmedAvatarUrl.isNotEmpty
              ? null
              : Text(
                  initial,
                  style: Theme.of(context).textTheme.displaySmall?.copyWith(
                    color: AppColors.darkBrown,
                    fontWeight: FontWeight.w900,
                    height: 1,
                  ),
                ),
        ),
        Positioned(
          right: -2,
          bottom: 3,
          child: Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.gold,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
            ),
            child: const Icon(
              Icons.edit_rounded,
              color: Colors.white,
              size: 18,
            ),
          ),
        ),
      ],
    );
  }
}

class _DrawerHeaderLinesPainter extends CustomPainter {
  const _DrawerHeaderLinesPainter({required this.isDark});

  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = Paint()
      ..color = AppColors.gold.withValues(alpha: isDark ? 0.22 : 0.28)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final faintStroke = Paint()
      ..color = AppColors.gold.withValues(alpha: isDark ? 0.10 : 0.16)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    final path = Path()
      ..moveTo(size.width * 0.48, size.height * 0.90)
      ..cubicTo(
        size.width * 0.68,
        size.height * 0.62,
        size.width * 0.72,
        size.height * 0.30,
        size.width * 1.08,
        size.height * 0.28,
      );
    final pathTwo = Path()
      ..moveTo(size.width * 0.55, size.height * 1.03)
      ..cubicTo(
        size.width * 0.74,
        size.height * 0.70,
        size.width * 0.80,
        size.height * 0.42,
        size.width * 1.10,
        size.height * 0.50,
      );

    canvas.drawPath(path, stroke);
    canvas.drawPath(pathTwo, faintStroke);
  }

  @override
  bool shouldRepaint(covariant _DrawerHeaderLinesPainter oldDelegate) {
    return oldDelegate.isDark != isDark;
  }
}
