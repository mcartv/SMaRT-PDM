import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/navigation/app_navigator.dart';
import 'package:smartpdm_mobileapp/navigation/app_routes.dart';
import 'package:smartpdm_mobileapp/screens/providers/theme_provider.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';

Future<void> showAppSettingsSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => const _AppSettingsSheet(),
  );
}

class _AppSettingsSheet extends StatefulWidget {
  const _AppSettingsSheet();

  @override
  State<_AppSettingsSheet> createState() => _AppSettingsSheetState();
}

class _AppSettingsSheetState extends State<_AppSettingsSheet> {
  bool _notificationsEnabled = true;

  void _showComingSoon(String label) {
    Navigator.pop(context);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text('$label coming soon.')));
  }

  void _openRoute(String route) {
    Navigator.pop(context);
    if (AppRoutes.isTopLevel(route)) {
      AppNavigator.goToTopLevel(context, route);
      return;
    }
    Navigator.pushNamed(context, route);
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 8),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: AppColors.darkBrown,
        ),
      ),
    );
  }

  Widget _buildToggleTile({
    required IconData icon,
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.lightGray),
      ),
      child: SwitchListTile(
        value: value,
        onChanged: onChanged,
        activeThumbColor: accentColor,
        title: Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w600,
            color: AppColors.darkBrown,
          ),
        ),
        secondary: Icon(icon, color: primaryColor),
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.lightGray),
      ),
      child: ListTile(
        onTap: onTap,
        leading: Icon(icon, color: primaryColor),
        title: Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w600,
            color: AppColors.darkBrown,
          ),
        ),
        trailing: const Icon(Icons.chevron_right, color: AppColors.brown),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();

    return DraggableScrollableSheet(
      initialChildSize: 0.78,
      minChildSize: 0.5,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 52,
                height: 5,
                decoration: BoxDecoration(
                  color: AppColors.lightGray,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 16),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'App Settings',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.darkBrown,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                  children: [
                    _buildSectionTitle('Preferences'),
                    _buildToggleTile(
                      icon: Icons.notifications_active_outlined,
                      title: 'Enable Notifications',
                      value: _notificationsEnabled,
                      onChanged: (value) {
                        setState(() => _notificationsEnabled = value);
                      },
                    ),
                    _buildToggleTile(
                      icon: Icons.dark_mode_outlined,
                      title: 'Enable Dark Mode',
                      value: themeProvider.isDarkMode,
                      onChanged: (value) => themeProvider.setDarkMode(value),
                    ),
                    _buildSectionTitle('Services'),
                    _buildActionTile(
                      icon: Icons.workspace_premium_outlined,
                      title: 'Scholar Services',
                      onTap: () => _showComingSoon('Scholar Services'),
                    ),
                    _buildSectionTitle('Account'),
                    _buildActionTile(
                      icon: Icons.person_outline,
                      title: 'Manage Account',
                      onTap: () => _openRoute(AppRoutes.profile),
                    ),
                    _buildActionTile(
                      icon: Icons.lock_outline,
                      title: 'Privacy & Security',
                      onTap: () => _openRoute(AppRoutes.forgotPassword),
                    ),
                    _buildSectionTitle('Info'),
                    _buildActionTile(
                      icon: Icons.info_outline,
                      title: 'About App',
                      onTap: () => _showComingSoon('About App'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
