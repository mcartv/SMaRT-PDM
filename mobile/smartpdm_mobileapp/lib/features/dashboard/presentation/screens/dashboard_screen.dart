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
  String _userName = 'Scholar';
  bool _isApproved =
      false; // Mocking approval status based on backend verification

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
    final studentId = prefs.getString('user_student_id') ?? 'Scholar';
    final isVerified = prefs.getBool('user_is_verified') ?? false;

    // Initialize the real-time chat connection and load history
    if (mounted) {
      context.read<MessagingProvider>().initializeChat();
    }

    if (mounted) {
      setState(() {
        _userName = studentId;
        _isApproved = isVerified;
      });
    }
  }

  Widget _buildAnnouncementCard({
    required String title,
    required String subtitle,
    required String timeAgo,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: _plainCardColor,
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [
          BoxShadow(
            color: Color(0x16000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: _isDarkMode
                    ? const Color(0xFF3A2718)
                    : const Color(0xFFF5F7FB),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                Icons.notifications_none_rounded,
                color: _isDarkMode
                    ? const Color(0xFFFFD54F)
                    : const Color(0xFF7C9AD8),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: _titleColor,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.35,
                      color: _bodyColor,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              timeAgo,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: _subtitleColor,
              ),
            ),
          ],
        ),
      ),
    );
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
            if (notification.isOpeningUpdate) ...[
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
          image: AssetImage('assets/images/school_logo.png'),
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

  Widget _buildFeatureCards() {
    final cards = [
      {
        'title': 'Find Your Program',
        'subtitle': 'Explore available courses',
        'icon': Icons.search,
      },
      {
        'title': 'Arts & Sciences',
        'subtitle': 'Humanities and research',
        'icon': Icons.palette,
      },
      {
        'title': 'Business',
        'subtitle': 'Management and finance',
        'icon': Icons.business_center,
      },
      {
        'title': 'Engineering',
        'subtitle': 'Technology and innovation',
        'icon': Icons.engineering,
      },
      {
        'title': 'Nursing',
        'subtitle': 'Health professions',
        'icon': Icons.local_hospital,
      },
      {
        'title': 'Graduate Studies',
        'subtitle': 'Master’s and PhD',
        'icon': Icons.school,
      },
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final crossAxisCount = constraints.maxWidth > 900
            ? 3
            : constraints.maxWidth > 600
            ? 2
            : 1;
        return GridView.count(
          shrinkWrap: true,
          crossAxisCount: crossAxisCount,
          childAspectRatio: 3.6,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          physics: const NeverScrollableScrollPhysics(),
          children: cards.map((cardData) {
            return Card(
              color: _plainCardColor,
              elevation: 2,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              child: InkWell(
                onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Selected ${cardData['title']}')),
                ),
                borderRadius: BorderRadius.circular(14),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        cardData['icon'] as IconData,
                        color: _isDarkMode
                            ? const Color(0xFFFFD54F)
                            : AppColors.darkBrown,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              cardData['title'] as String,
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: _titleColor,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              cardData['subtitle'] as String,
                              style: TextStyle(fontSize: 12, color: _bodyColor),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.arrow_forward,
                        color: _isDarkMode
                            ? const Color(0xFFFFD54F)
                            : AppColors.darkBrown,
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        );
      },
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
                              _isApproved
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
                              AppRoutes.roCompletion,
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 20),
                if (!_isApproved) ...[
                  // --- NOT VERIFIED YET SECTION ---
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
                            Navigator.pushNamed(
                              context,
                              AppRoutes.scholarshipOpenings,
                            );
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
                          onTap: () =>
                              Navigator.pushNamed(context, AppRoutes.faqs),
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
                            Icons.announcement,
                            color: _isDarkMode
                                ? const Color(0xFFFFD54F)
                                : primaryColor,
                          ),
                          title: const Text('View Announcements'),
                          subtitle: Text(
                            'Latest news and announcements',
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
                ] else ...[
                  // --- APPROVED SCHOLAR SECTION ---
                  Text(
                    'Return Obligations',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: _titleColor,
                    ),
                  ),
                  const SizedBox(height: 10),
                  // Quick RO Access Card
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
                                  onPressed: () => Navigator.pushNamed(
                                    context,
                                    AppRoutes.roAssignment,
                                  ),
                                  icon: const Icon(Icons.visibility),
                                  label: const Column(
                                    mainAxisSize: MainAxisSize.min,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [Text('View RO')],
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: primaryColor,
                                    foregroundColor: Colors.white,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () => Navigator.pushNamed(
                                    context,
                                    AppRoutes.roCompletion,
                                  ),
                                  icon: const Icon(Icons.done_all),
                                  label: const Text('Submit RO'),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: AppColors.darkBrown,
                                    side: BorderSide(
                                      color: AppColors.gold.withOpacity(0.8),
                                    ),
                                    backgroundColor: AppColors.gold.withOpacity(
                                      0.10,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  Card(
                    color: _plainCardColor,
                    elevation: 1,
                    shadowColor: const Color(0x14000000),
                    clipBehavior: Clip.antiAlias,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(borderRadius),
                    ),
                    child: Column(
                      children: [
                        ListTile(
                          leading: Icon(
                            Icons.message,
                            color: _isDarkMode
                                ? const Color(0xFFFFD54F)
                                : primaryColor,
                          ),
                          title: const Text('Messaging'),
                          subtitle: Text(
                            'Chat with OSFA & Agencies',
                            style: TextStyle(color: _subtitleColor),
                          ),
                          trailing: Icon(
                            Icons.chevron_right,
                            color: _isDarkMode ? Colors.white54 : Colors.grey,
                          ),
                          onTap: () =>
                              Navigator.pushNamed(context, AppRoutes.messaging),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: Icon(
                            Icons.payment,
                            color: _isDarkMode
                                ? const Color(0xFFFFD54F)
                                : primaryColor,
                          ),
                          title: const Text('Payout Schedule'),
                          subtitle: Text(
                            'View your personalized schedule',
                            style: TextStyle(color: _subtitleColor),
                          ),
                          trailing: Icon(
                            Icons.chevron_right,
                            color: _isDarkMode ? Colors.white54 : Colors.grey,
                          ),
                          onTap: () => AppNavigator.goToTopLevel(
                            context,
                            AppRoutes.payouts,
                          ),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: Icon(
                            Icons.assignment,
                            color: _isDarkMode
                                ? const Color(0xFFFFD54F)
                                : primaryColor,
                          ),
                          title: const Text('RO Assignment'),
                          subtitle: Text(
                            'View your research opportunity assignment',
                            style: TextStyle(color: _subtitleColor),
                          ),
                          trailing: Icon(
                            Icons.chevron_right,
                            color: _isDarkMode ? Colors.white54 : Colors.grey,
                          ),
                          onTap: () => Navigator.pushNamed(
                            context,
                            AppRoutes.roAssignment,
                          ),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: Icon(
                            Icons.done_all,
                            color: _isDarkMode
                                ? const Color(0xFFFFD54F)
                                : primaryColor,
                          ),
                          title: const Text('Submit RO Completion'),
                          subtitle: Text(
                            'Submit your completed research opportunity',
                            style: TextStyle(color: _subtitleColor),
                          ),
                          trailing: Icon(
                            Icons.chevron_right,
                            color: _isDarkMode ? Colors.white54 : Colors.grey,
                          ),
                          onTap: () => Navigator.pushNamed(
                            context,
                            AppRoutes.roCompletion,
                          ),
                        ),
                        const Divider(height: 1),
                        ListTile(
                          leading: Icon(
                            Icons.support_agent,
                            color: _isDarkMode
                                ? const Color(0xFFFFD54F)
                                : primaryColor,
                          ),
                          title: const Text('Submit Support Ticket'),
                          subtitle: Text(
                            'Get help regarding your scholarship',
                            style: TextStyle(color: _subtitleColor),
                          ),
                          trailing: Icon(
                            Icons.chevron_right,
                            color: _isDarkMode ? Colors.white54 : Colors.grey,
                          ),
                          onTap: () =>
                              Navigator.pushNamed(context, AppRoutes.tickets),
                        ),
                      ],
                    ),
                  ),
                ],
                // Developer option to test scholar features
                const SizedBox(height: 20),
                if (!_isApproved) ...[
                  Card(
                    color: Colors.yellow[100],
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Developer Testing',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.orange,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Click below to test scholar features (RO Assignment, Payouts, etc.)',
                            style: TextStyle(fontSize: 12),
                          ),
                          const SizedBox(height: 12),
                          ElevatedButton.icon(
                            onPressed: () async {
                              final prefs =
                                  await SharedPreferences.getInstance();
                              await prefs.setBool('user_is_verified', true);
                              await prefs.setString(
                                'user_student_id',
                                'TEST2025001',
                              );
                              setState(() {
                                _isApproved = true;
                                _userName = 'TEST2025001';
                              });
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    '✅ Set as verified scholar! Refresh the page to see scholar features.',
                                  ),
                                  backgroundColor: Colors.green,
                                ),
                              );
                            },
                            icon: const Icon(Icons.verified_user),
                            label: const Text('Enable Scholar Mode'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.green,
                              foregroundColor: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
