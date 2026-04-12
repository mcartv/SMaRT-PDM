import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/office_update_article_screen.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_settings_sheet.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';

class DashboardScreen extends StatelessWidget {
  final bool showBottomNav;

  const DashboardScreen({super.key, this.showBottomNav = true});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('SMaRT-PDM'),
        automaticallyImplyLeading: false,
        actions: [
          Consumer<MessagingProvider>(
            builder: (context, messagingProvider, child) {
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Badge(
                  isLabelVisible: messagingProvider.unreadCount > 0,
                  label: Text('${messagingProvider.unreadCount}'),
                  backgroundColor: Colors.red,
                  child: IconButton(
                    onPressed: () {
                      Navigator.pushNamed(context, AppRoutes.messaging);
                    },
                    tooltip: 'Open Messaging',
                    icon: Icon(
                      Icons.chat_bubble_outline,
                      color: isDark ? Colors.white : AppColors.darkBrown,
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
      selectedIndex: 0,
      showDrawer: false,
      showBottomNav: showBottomNav,
      applyPadding: false,
      child: const DashboardContent(),
    );
  }
}

class DashboardContent extends StatefulWidget {
  const DashboardContent({super.key});

  @override
  State<DashboardContent> createState() => _DashboardContentState();
}

class _DashboardContentState extends State<DashboardContent> {
  String _userName = 'Student';
  bool _hasScholarAccess = false;

  bool get _isDarkMode => Theme.of(context).brightness == Brightness.dark;
  Color get _pageBackground =>
      _isDarkMode ? const Color(0xFF24180F) : Colors.white.withOpacity(0.96);
  Color get _surfaceColor =>
      _isDarkMode ? const Color(0xFF332216) : const Color(0xFFF8F3ED);
  Color get _plainCardColor =>
      _isDarkMode ? const Color(0xFF2D1E12) : Colors.white;
  Color get _titleColor => _isDarkMode ? Colors.white : AppColors.darkBrown;
  Color get _subtitleColor => _isDarkMode ? Colors.white70 : Colors.grey;
  Color get _bodyColor => _isDarkMode ? Colors.white70 : AppColors.brown;
  Color get _heroOverlay => _isDarkMode
      ? const Color(0xFF4A331B).withOpacity(0.66)
      : Colors.white.withOpacity(0.58);
  List<Color> get _heroGradient => _isDarkMode
      ? const [
          Color(0xFF4D2B0F),
          Color(0xFF6B4318),
          Color(0xFF8A6526),
          Color(0xFFD49C10),
        ]
      : const [Color(0xFFF8F3ED), Color(0xFFF4E1B8)];

  @override
  void initState() {
    super.initState();
    _loadAndDisplayUserData();
  }

  Future<void> _loadAndDisplayUserData() async {
    final prefs = await SharedPreferences.getInstance();
    final studentId = prefs.getString('user_student_id') ?? 'Student';
    final hasScholarAccess =
        prefs.getBool('user_has_scholar_access') ?? false;

    if (mounted) {
      context.read<MessagingProvider>().initializeChat();
    }

    if (mounted) {
      setState(() {
        _userName = studentId;
        _hasScholarAccess = hasScholarAccess;
      });
    }
  }

  Future<void> _openOfficeUpdate(
    BuildContext context,
    AppNotification notification,
  ) async {
    if (!notification.isRead && notification.notificationId.isNotEmpty) {
      await context.read<NotificationProvider>().markAsRead(
        notification.notificationId,
      );
    }

    if (!context.mounted) return;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => OfficeUpdateArticleScreen(
          notification: notification,
          showBottomNav: false,
        ),
      ),
    );
  }

  void _openScholarshipOpenings(BuildContext context) {
    Navigator.pushNamed(context, AppRoutes.scholarshipOpenings);
  }

  Widget _buildOfficeUpdateFeaturedCard(
    BuildContext context,
    AppNotification notification,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: _surfaceColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold, width: 1.2),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.gold.withOpacity(0.18),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    notification.officeUpdateLabel,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.darkBrown,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () => _openOfficeUpdate(context, notification),
                  child: const Text(
                    'READ MORE',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.orange,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              notification.title,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: _titleColor,
                height: 1.15,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              notification.previewText,
              style: TextStyle(fontSize: 14, color: _bodyColor, height: 1.45),
            ),
            if (notification.isOpeningUpdate && !_hasScholarAccess) ...[
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => _openScholarshipOpenings(context),
                  child: const Text('Apply Now'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildOfficeUpdatesSection() {
    return Consumer<NotificationProvider>(
      builder: (context, notificationProvider, child) {
        final officeUpdates = notificationProvider.homeOfficeUpdatesItems;

        if (officeUpdates.isEmpty) {
          return _buildOfficeUpdateFallbackCard(context);
        }

        return Column(
          children: officeUpdates
              .map(
                (notification) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: GestureDetector(
                    onTap: () => _openOfficeUpdate(context, notification),
                    child: _buildOfficeUpdateFeaturedCard(
                      context,
                      notification,
                    ),
                  ),
                ),
              )
              .toList(),
        );
      },
    );
  }

  Widget _buildOfficeUpdateFallbackCard(BuildContext context) {
    return _buildOfficeUpdateFeaturedCard(
      context,
      AppNotification(
        notificationId: 'fallback-office-update',
        userId: '',
        type: 'Announcement',
        title:
            'Scholarship opportunities from agencies and private benefactors',
        message:
            'Stay updated on CHED, UNIFAST, TES, TDP, and private grant support including BC Packaging, Food Crafters, Genmart, Kaizen, and Pusong Mapagkalinga.',
        referenceId: null,
        referenceType: 'announcement',
        isRead: true,
        pushSent: false,
        createdAt: DateTime.now(),
      ),
    );
  }

  Widget _buildCampusHero() {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        image: DecorationImage(
          image: const AssetImage('assets/images/school_logo.png'),
          fit: BoxFit.cover,
          opacity: _isDarkMode ? 0.18 : 0.1,
        ),
        gradient: LinearGradient(
          colors: _heroGradient,
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          color: _heroOverlay,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.all(6),
                    child: Image.asset(
                      'assets/images/school_logo.png',
                      width: 42,
                      height: 42,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Pambayang Dalubhasaan ng Marilao',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: _titleColor,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Hello, $_userName!',
                        style: TextStyle(color: _subtitleColor, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              '"WHERE QUALITY EDUCATION IS A RIGHT, NOT A PRIVILEGE"',
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w900,
                color: _titleColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionTile({
    required BuildContext context,
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    final isCompact = MediaQuery.of(context).size.width < 360;

    return Card(
      color: _surfaceColor,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: isCompact ? 10 : 12,
            vertical: isCompact ? 12 : 16,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                color: _isDarkMode ? const Color(0xFFFFD54F) : primaryColor,
                size: isCompact ? 18 : 20,
              ),
              SizedBox(width: isCompact ? 8 : 10),
              Flexible(
                child: Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: isCompact ? 11.5 : 12.5,
                    fontWeight: FontWeight.w600,
                    color: _titleColor,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildApplicantSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Scholarship Application',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: _titleColor,
          ),
        ),
        const SizedBox(height: 10),
        Card(
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
          child: Column(
            children: [
              ListTile(
                leading: Icon(
                  Icons.person_add,
                  color: _isDarkMode
                      ? const Color(0xFFFFD54F)
                      : primaryColor,
                ),
                title: const Text('Apply for New Scholarship'),
                subtitle: Text(
                  'Start your application as a new scholar',
                  style: TextStyle(color: _subtitleColor),
                ),
                trailing: Icon(
                  Icons.chevron_right,
                  color: _isDarkMode ? Colors.white54 : Colors.grey,
                ),
                onTap: () {
                  Navigator.pushNamed(context, AppRoutes.scholarshipOpenings);
                },
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(
                  Icons.settings_outlined,
                  color: _isDarkMode
                      ? const Color(0xFFFFD54F)
                      : primaryColor,
                ),
                title: const Text('App Settings'),
                subtitle: Text(
                  'Manage preferences, privacy, and account options',
                  style: TextStyle(color: _subtitleColor),
                ),
                trailing: Icon(
                  Icons.chevron_right,
                  color: _isDarkMode ? Colors.white54 : Colors.grey,
                ),
                onTap: () => showAppSettingsSheet(context),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Text(
          'General Information',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: _titleColor,
          ),
        ),
        const SizedBox(height: 10),
        Card(
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
          ),
          child: Column(
            children: [
              ListTile(
                leading: Icon(
                  Icons.question_answer,
                  color: _isDarkMode
                      ? const Color(0xFFFFD54F)
                      : primaryColor,
                ),
                title: const Text('FAQs'),
                subtitle: Text(
                  'Frequently asked questions',
                  style: TextStyle(color: _subtitleColor),
                ),
                trailing: Icon(
                  Icons.chevron_right,
                  color: _isDarkMode ? Colors.white54 : Colors.grey,
                ),
                onTap: () => Navigator.pushNamed(context, AppRoutes.faqs),
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(
                  Icons.notifications,
                  color: _isDarkMode
                      ? const Color(0xFFFFD54F)
                      : primaryColor,
                ),
                title: const Text('View Notifications'),
                subtitle: Text(
                  'Check your notifications and updates',
                  style: TextStyle(color: _subtitleColor),
                ),
                trailing: Icon(
                  Icons.chevron_right,
                  color: _isDarkMode ? Colors.white54 : Colors.grey,
                ),
                onTap: () => AppNavigator.goToTopLevel(
                  context,
                  AppRoutes.notifications,
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(
                  Icons.file_upload,
                  color: _isDarkMode
                      ? const Color(0xFFFFD54F)
                      : primaryColor,
                ),
                title: const Text('Upload Scholarship Requirements'),
                subtitle: Text(
                  'Upload your scholarship requirements after submitting an opening-specific application',
                  style: TextStyle(color: _subtitleColor),
                ),
                trailing: Icon(
                  Icons.chevron_right,
                  color: _isDarkMode ? Colors.white54 : Colors.grey,
                ),
                onTap: () =>
                    Navigator.pushNamed(context, AppRoutes.documents),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildScholarSection(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Return Obligations',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: _titleColor,
          ),
        ),
        const SizedBox(height: 10),
        Card(
          color: _surfaceColor,
          elevation: 4,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(borderRadius),
            side: BorderSide(color: AppColors.gold.withOpacity(0.35)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: AppColors.gold.withOpacity(0.14),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.assignment_turned_in,
                        color: AppColors.darkBrown,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Research Opportunity (RO) Management',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: _titleColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Access your RO assignments, submit completions, and track your progress.',
                  style: TextStyle(fontSize: 14, color: _bodyColor),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () =>
                            Navigator.pushNamed(context, AppRoutes.roAssignment),
                        icon: const Icon(Icons.visibility),
                        label: const Text('View RO'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primaryColor,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () =>
                            Navigator.pushNamed(context, AppRoutes.roCompletion),
                        icon: const Icon(Icons.done_all),
                        label: const Text('Submit RO'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.darkBrown,
                          side: BorderSide(
                            color: AppColors.gold.withOpacity(0.8),
                          ),
                          backgroundColor:
                              AppColors.gold.withOpacity(0.10),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox.expand(
      child: Container(
        decoration: BoxDecoration(color: _pageBackground),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildCampusHero(),
                const SizedBox(height: 12),
                Text(
                  'Office Updates',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: _titleColor,
                  ),
                ),
                const SizedBox(height: 10),
                _buildOfficeUpdatesSection(),
                const SizedBox(height: 20),
                Text(
                  'Quick Actions',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: _titleColor,
                  ),
                ),
                const SizedBox(height: 10),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final isCompact = constraints.maxWidth < 420;
                    final itemWidth = isCompact
                        ? constraints.maxWidth
                        : (constraints.maxWidth - 20) / 3;

                    return Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        SizedBox(
                          width: itemWidth,
                          child: _buildQuickActionTile(
                            context: context,
                            icon: Icons.upload_file,
                            label: 'Upload',
                            onTap: () => Navigator.pushNamed(
                              context,
                              _hasScholarAccess
                                  ? AppRoutes.renewalDocuments
                                  : AppRoutes.documents,
                            ),
                          ),
                        ),
                        SizedBox(
                          width: itemWidth,
                          child: _buildQuickActionTile(
                            context: context,
                            icon: Icons.campaign_outlined,
                            label: 'Announcements',
                            onTap: () => AppNavigator.goToTopLevel(
                              context,
                              AppRoutes.notifications,
                            ),
                          ),
                        ),
                        SizedBox(
                          width: itemWidth,
                          child: _buildQuickActionTile(
                            context: context,
                            icon: Icons.assignment_turned_in,
                            label: 'Obligs',
                            onTap: () => Navigator.pushNamed(
                              context,
                              _hasScholarAccess
                                  ? AppRoutes.roCompletion
                                  : AppRoutes.status,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 20),
                if (!_hasScholarAccess)
                  _buildApplicantSection(context)
                else
                  _buildScholarSection(context),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}