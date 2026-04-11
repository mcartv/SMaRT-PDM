import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_settings_sheet.dart';

class SmartPdmDrawer extends StatelessWidget {
  final bool isScholar;
  final String userName;

  const SmartPdmDrawer({
    super.key,
    this.isScholar = false,
    this.userName = 'Scholar',
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final drawerBackground = isDark
        ? const Color(0xFF2D1E12)
        : const Color(0xFFFFFBF6);
    final headerBackground = isDark
        ? const Color(0xFF3A2718)
        : AppColors.gold.withOpacity(0.18);
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark
        ? Colors.white70
        : AppColors.brown.withOpacity(0.72);
    final sectionColor = isDark
        ? Colors.white70
        : AppColors.brown.withOpacity(0.6);
    final itemTextColor = isDark ? Colors.white : AppColors.darkBrown;
    final iconColor = isDark ? const Color(0xFFFFD54F) : AppColors.darkBrown;

    return Drawer(
      backgroundColor: drawerBackground,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          // Header
          GestureDetector(
            onTap: () {
              Navigator.pop(context);
              AppNavigator.goToTopLevel(context, AppRoutes.profile);
            },
            child: DrawerHeader(
              decoration: BoxDecoration(color: headerBackground),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: Colors.white,
                    child: Text(
                      userName.isNotEmpty ? userName[0].toUpperCase() : 'U',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: isDark
                            ? AppColors.darkBrown
                            : AppColors.darkBrown,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    userName,
                    style: TextStyle(
                      color: titleColor,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    isScholar ? 'Approved Scholar' : 'Applicant',
                    style: TextStyle(color: subtitleColor, fontSize: 12),
                  ),
                ],
              ),
            ),
          ),

          // Applicant Section
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
            child: Text(
              'APPLICANT',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: sectionColor,
                letterSpacing: 1,
              ),
            ),
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.assignment,
            label: 'Apply for Scholarship',
            route: AppRoutes.scholarshipOpenings,
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.check_circle,
            label: 'Application Status',
            route: AppRoutes.status,
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.help_outline,
            label: 'FAQs',
            route: AppRoutes.faqs,
          ),

          // Scholar Section
          if (isScholar) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
              child: Text(
                'SCHOLAR',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: sectionColor,
                  letterSpacing: 1,
                ),
              ),
            ),
            _buildDrawerItem(
              context: context,
              icon: Icons.payment,
              label: 'Payout Schedule',
              route: AppRoutes.payouts,
            ),
            _buildDrawerItem(
              context: context,
              icon: Icons.assignment_turned_in,
              label: 'RO Assignment',
              route: AppRoutes.roAssignment,
            ),
            _buildDrawerItem(
              context: context,
              icon: Icons.done_all,
              label: 'Submit RO Completion',
              route: AppRoutes.roCompletion,
            ),
            _buildDrawerItem(
              context: context,
              icon: Icons.support_agent,
              label: 'Support Ticket',
              route: AppRoutes.tickets,
            ),
          ],

          // Divider
          Divider(height: 24, color: isDark ? Colors.white12 : null),

          // Account Section
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              'ACCOUNT',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: sectionColor,
                letterSpacing: 1,
              ),
            ),
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.person,
            label: 'Profile',
            route: AppRoutes.profile,
          ),
          _buildDrawerActionItem(
            context: context,
            icon: Icons.settings_outlined,
            label: 'App Settings',
            onTap: () async {
              Navigator.pop(context);
              await showAppSettingsSheet(context);
            },
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.chat,
            label: 'Messages',
            route: AppRoutes.messaging,
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.alternate_email,
            label: 'Change Email',
            route: AppRoutes.changeEmail,
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.lock,
            label: 'Change Password',
            route: AppRoutes.forgotPassword,
          ),

          const SizedBox(height: 12),

          // Logout
          Padding(
            padding: const EdgeInsets.all(16),
            child: ElevatedButton.icon(
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Logout'),
                    content: const Text('Are you sure you want to logout?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Cancel'),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.pop(context);
                          AppNavigator.goToTopLevel(context, AppRoutes.login);
                        },
                        child: const Text('Logout'),
                      ),
                    ],
                  ),
                );
              },
              icon: const Icon(Icons.exit_to_app),
              label: const Text('Logout'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawerItem({
    required BuildContext context,
    required IconData icon,
    required String label,
    required String route,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final iconColor = isDark ? const Color(0xFFFFD54F) : AppColors.darkBrown;
    final textColor = isDark ? Colors.white : AppColors.darkBrown;

    return ListTile(
      leading: Icon(icon, color: iconColor),
      title: Text(label, style: TextStyle(color: textColor)),
      iconColor: iconColor,
      textColor: textColor,
      onTap: () {
        Navigator.pop(context);
        if (AppRoutes.isTopLevel(route)) {
          AppNavigator.goToTopLevel(context, route);
          return;
        }
        Navigator.pushNamed(context, route);
      },
    );
  }

  Widget _buildDrawerActionItem({
    required BuildContext context,
    required IconData icon,
    required String label,
    required Future<void> Function() onTap,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final iconColor = isDark ? const Color(0xFFFFD54F) : AppColors.darkBrown;
    final textColor = isDark ? Colors.white : AppColors.darkBrown;

    return ListTile(
      leading: Icon(icon, color: iconColor),
      title: Text(label, style: TextStyle(color: textColor)),
      iconColor: iconColor,
      textColor: textColor,
      onTap: onTap,
    );
  }
}
