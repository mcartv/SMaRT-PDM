import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/navigation/app_navigator.dart';
import 'package:smartpdm_mobileapp/navigation/app_routes.dart';
import 'package:smartpdm_mobileapp/widgets/app_settings_sheet.dart';

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
    return Drawer(
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
              decoration: const BoxDecoration(color: primaryColor),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  CircleAvatar(
                    radius: 32,
                    backgroundColor: Colors.white,
                    child: Text(
                      userName.isNotEmpty ? userName[0].toUpperCase() : 'U',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: primaryColor,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    userName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    isScholar ? 'Approved Scholar' : 'Applicant',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
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
                color: Colors.grey[600],
                letterSpacing: 1,
              ),
            ),
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.assignment,
            label: 'Apply for Scholarship',
            route: AppRoutes.newApplicant,
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.check_circle,
            label: 'Application Status',
            route: AppRoutes.status,
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.info_outline,
            label: 'About PDM/OSFA',
            route: AppRoutes.about,
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
                  color: Colors.grey[600],
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
          const Divider(height: 24),

          // Account Section
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Text(
              'ACCOUNT',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Colors.grey[600],
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

          // Spacer
          Expanded(child: Container()),

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
    return ListTile(
      leading: Icon(icon, color: primaryColor),
      title: Text(label),
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
    return ListTile(
      leading: Icon(icon, color: primaryColor),
      title: Text(label),
      onTap: onTap,
    );
  }
}
