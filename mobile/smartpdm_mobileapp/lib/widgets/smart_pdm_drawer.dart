import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';

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
              Navigator.pushNamed(context, '/profile');
            },
            child: DrawerHeader(
              decoration: const BoxDecoration(
                color: primaryColor,
              ),
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
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                    ),
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
            route: '/new_applicant',
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.check_circle,
            label: 'Application Status',
            route: '/status',
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.info_outline,
            label: 'About PDM/OSFA',
            route: '/about',
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.help_outline,
            label: 'FAQs',
            route: '/faqs',
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
              route: '/payouts',
            ),
            _buildDrawerItem(
              context: context,
              icon: Icons.assignment_turned_in,
              label: 'RO Assignment',
              route: '/ro-assignment',
            ),
            _buildDrawerItem(
              context: context,
              icon: Icons.done_all,
              label: 'Submit RO Completion',
              route: '/ro-completion',
            ),
            _buildDrawerItem(
              context: context,
              icon: Icons.support_agent,
              label: 'Support Ticket',
              route: '/tickets',
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
            route: '/existing_scholar_update',
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.chat,
            label: 'Messages',
            route: '/messaging',
          ),
          _buildDrawerItem(
            context: context,
            icon: Icons.lock,
            label: 'Change Password',
            route: '/forgot-password',
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
                          Navigator.pushReplacementNamed(context, '/login');
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
        Navigator.pushNamed(context, route);
      },
    );
  }
}
