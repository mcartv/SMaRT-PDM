import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_settings_sheet.dart';
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
          Consumer<NotificationProvider>(
            builder: (context, notificationProvider, child) {
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Badge(
                  isLabelVisible: notificationProvider.unreadCount > 0,
                  label: Text('${notificationProvider.unreadCount}'),
                  backgroundColor: Colors.red,
                  child: IconButton(
                    onPressed: () {
                      Navigator.pushNamed(context, AppRoutes.notifications);
                    },
                    tooltip: 'Open Notifications',
                    icon: Icon(
                      Icons.notifications_none,
                      color: isDark ? Colors.white : textColor,
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
  bool get _effectiveScholarAccess =>
      context.watch<NotificationProvider>().hasScholarAccess ||
      _hasScholarAccess;

  bool get _isDarkMode => Theme.of(context).brightness == Brightness.dark;
  Color get _pageBackground =>
      _isDarkMode ? const Color(0xFF24180F) : Colors.white.withOpacity(0.96);
  Color get _surfaceColor =>
      _isDarkMode ? const Color(0xFF332216) : const Color(0xFFF8F3ED);
  Color get _titleColor => _isDarkMode ? Colors.white : textColor;
  Color get _subtitleColor => _isDarkMode ? Colors.white70 : Colors.black54;
  Color get _bodyColor => _isDarkMode ? Colors.white70 : Colors.black87;
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
    final hasScholarAccess = prefs.getBool('user_has_scholar_access') ?? false;

    if (mounted) {
      setState(() {
        _userName = studentId;
        _hasScholarAccess = hasScholarAccess;
      });
    }
  }

  void _openOfficeUpdatesHub(BuildContext context) {
    Navigator.pushNamed(context, AppRoutes.notifications);
  }

  void _openScholarshipOpenings(BuildContext context) {
    Navigator.pushNamed(context, AppRoutes.scholarshipOpenings);
  }

  List<String> _officeUpdateTags(AppNotification notification) {
    final haystack = '${notification.title} ${notification.message}'
        .toUpperCase();
    final tags = <String>[];

    void addIfPresent(String keyword, String label) {
      if (haystack.contains(keyword) && !tags.contains(label)) {
        tags.add(label);
      }
    }

    addIfPresent('CHED', 'CHED');
    addIfPresent('UNIFAST', 'UNIFAST');
    addIfPresent('TES', 'TES');
    addIfPresent('TDP', 'TDP');

    if ((haystack.contains('PRIVATE') ||
            haystack.contains('GRANT') ||
            haystack.contains('BENEFACTOR')) &&
        !tags.contains('Private Grants')) {
      tags.add('Private Grants');
    }

    if (tags.isEmpty && notification.isOpeningUpdate) {
      tags.addAll(const ['Openings', 'Scholarship', 'Applicants']);
    }

    if (tags.isEmpty) {
      tags.add(
        notification.officeUpdateLabel == 'ANNOUNCEMENT'
            ? 'Office Notice'
            : 'Scholarship Update',
      );
    }

    return tags.take(5).toList();
  }

  Widget _buildOfficeUpdateFeaturedCard(
    BuildContext context,
    AppNotification notification,
  ) {
    return _InteractiveOfficeUpdatesCard(
      notification: notification,
      tags: _officeUpdateTags(notification),
      onTap: () => _openOfficeUpdatesHub(context),
      onOpeningsTap: notification.isOpeningUpdate && !_effectiveScholarAccess
          ? () => _openScholarshipOpenings(context)
          : null,
    );
  }

  Widget _buildOfficeUpdatesSection() {
    return Consumer<NotificationProvider>(
      builder: (context, notificationProvider, child) {
        final officeUpdates = notificationProvider.homeOfficeUpdatesItems;

        if (officeUpdates.isEmpty) {
          return _buildOfficeUpdateFallbackCard(context);
        }

        return _buildOfficeUpdateFeaturedCard(context, officeUpdates.first);
      },
    );
  }

  Widget _buildOfficeUpdatesHeading(int totalUpdates) {
    return Text(
      'Office Updates',
      style: TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.bold,
        color: _titleColor,
      ),
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
    final outerRadius = BorderRadius.circular(26);
    final innerRadius = BorderRadius.circular(24);

    return Material(
      color: _isDarkMode ? const Color(0xFF342417) : Colors.white,
      elevation: _isDarkMode ? 0 : 2,
      borderRadius: outerRadius,
      shadowColor: const Color(0xFF2E1607).withOpacity(0.12),
      child: InkWell(
        onTap: onTap,
        borderRadius: outerRadius,
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: _isDarkMode ? 0 : (isCompact ? 3 : 4),
            vertical: _isDarkMode ? 0 : (isCompact ? 3 : 4),
          ),
          child: Container(
            decoration: BoxDecoration(
              color: _isDarkMode ? const Color(0xFF342417) : Colors.white,
              borderRadius: innerRadius,
            ),
            child: Container(
              decoration: BoxDecoration(
                color: _isDarkMode ? const Color(0xFF342417) : null,
                borderRadius: innerRadius,
                border: _isDarkMode
                    ? null
                    : Border.all(
                        color: AppColors.gold.withOpacity(0.75),
                        width: 1.2,
                      ),
              ),
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: isCompact ? 10 : 12,
                  vertical: isCompact ? 10 : 12,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: isCompact ? 34 : 38,
                      height: isCompact ? 34 : 38,
                      decoration: BoxDecoration(
                        color: _isDarkMode ? Colors.transparent : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        icon,
                        color: AppColors.gold,
                        size: isCompact ? 18 : 20,
                      ),
                    ),
                    SizedBox(width: isCompact ? 8 : 10),
                    Flexible(
                      child: Text(
                        label,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: isCompact ? 14 : 15,
                          fontWeight: FontWeight.w800,
                          color: _isDarkMode ? Colors.white : textColor,
                          letterSpacing: 0.1,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
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
                  color: _isDarkMode ? const Color(0xFFFFD54F) : primaryColor,
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
                  color: _isDarkMode ? const Color(0xFFFFD54F) : primaryColor,
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
                  color: _isDarkMode ? const Color(0xFFFFD54F) : primaryColor,
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
                  color: _isDarkMode ? const Color(0xFFFFD54F) : primaryColor,
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
                onTap: () =>
                    Navigator.pushNamed(context, AppRoutes.notifications),
              ),
              const Divider(height: 1),
              ListTile(
                leading: Icon(
                  Icons.file_upload,
                  color: _isDarkMode ? const Color(0xFFFFD54F) : primaryColor,
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
                onTap: () => Navigator.pushNamed(context, AppRoutes.documents),
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
                        onPressed: () => Navigator.pushNamed(
                          context,
                          AppRoutes.roAssignment,
                        ),
                        icon: const Icon(Icons.visibility),
                        label: const Text('View RO'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.gold,
                          foregroundColor: _isDarkMode
                              ? Colors.white
                              : AppColors.darkBrown,
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
                          foregroundColor: _isDarkMode
                              ? Colors.white
                              : AppColors.darkBrown,
                          side: BorderSide(
                            color: AppColors.gold.withOpacity(0.8),
                          ),
                          backgroundColor: AppColors.gold.withOpacity(0.10),
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
    final officeUpdateCount = context
        .watch<NotificationProvider>()
        .homeOfficeUpdatesItems
        .length;

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
                _buildOfficeUpdatesHeading(
                  officeUpdateCount > 0 ? officeUpdateCount : 1,
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
                            onTap: () {
                              final isScholar =
                                  context
                                      .read<NotificationProvider>()
                                      .hasScholarAccess ||
                                  _hasScholarAccess;
                              Navigator.pushNamed(
                                context,
                                isScholar
                                    ? AppRoutes.renewalDocuments
                                    : AppRoutes.documents,
                              );
                            },
                          ),
                        ),
                        SizedBox(
                          width: itemWidth,
                          child: _buildQuickActionTile(
                            context: context,
                            icon: Icons.campaign_outlined,
                            label: 'Announcements',
                            onTap: () => Navigator.pushNamed(
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
                            onTap: () {
                              final isScholar =
                                  context
                                      .read<NotificationProvider>()
                                      .hasScholarAccess ||
                                  _hasScholarAccess;
                              Navigator.pushNamed(
                                context,
                                isScholar
                                    ? AppRoutes.roCompletion
                                    : AppRoutes.status,
                              );
                            },
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 20),
                if (!_effectiveScholarAccess)
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

class _InteractiveOfficeUpdatesCard extends StatefulWidget {
  const _InteractiveOfficeUpdatesCard({
    required this.notification,
    required this.tags,
    required this.onTap,
    this.onOpeningsTap,
  });

  final AppNotification notification;
  final List<String> tags;
  final VoidCallback onTap;
  final VoidCallback? onOpeningsTap;

  @override
  State<_InteractiveOfficeUpdatesCard> createState() =>
      _InteractiveOfficeUpdatesCardState();
}

class _InteractiveOfficeUpdatesCardState
    extends State<_InteractiveOfficeUpdatesCard> {
  bool _isHovered = false;
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = isDark ? const Color(0xFF3A2418) : Colors.white;
    final titleColor = isDark ? Colors.white : textColor;
    final bodyColor = isDark ? const Color(0xFFD5C1AE) : Colors.black87;
    final borderColor = isDark ? const Color(0xFFD9A327) : AppColors.gold;
    final chipBackground = isDark
        ? const Color(0xFF7D5B1A).withOpacity(0.38)
        : const Color(0xFFF2E5D1);
    final chipTextColor = isDark ? const Color(0xFF2A180B) : textColor;

    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() {
        _isHovered = false;
        _isPressed = false;
      }),
      child: GestureDetector(
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapCancel: () => setState(() => _isPressed = false),
        onTapUp: (_) => setState(() => _isPressed = false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _isPressed ? 0.97 : 1,
          duration: const Duration(milliseconds: 140),
          curve: Curves.easeOutCubic,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOutCubic,
            decoration: BoxDecoration(
              color: surfaceColor,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: borderColor,
                width: _isHovered ? 2.0 : 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(
                    0xFF2E1607,
                  ).withOpacity(_isHovered ? 0.18 : 0.10),
                  blurRadius: _isHovered ? 24 : 16,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 7,
                          ),
                          decoration: BoxDecoration(
                            color: chipBackground,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            widget.notification.officeUpdateLabel,
                            style: TextStyle(
                              color: chipTextColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          widget.notification.title,
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: titleColor,
                            height: 1.12,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          widget.notification.previewText,
                          style: TextStyle(
                            fontSize: 14,
                            color: bodyColor,
                            height: 1.45,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: widget.tags
                              .map((tag) => _OfficeUpdateTag(label: tag))
                              .toList(),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: widget.onTap,
                            style: ElevatedButton.styleFrom(
                              elevation: 0,
                              backgroundColor: AppColors.gold,
                              foregroundColor: AppColors.darkBrown,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'View all updates',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15,
                                  ),
                                ),
                                SizedBox(width: 8),
                                Icon(Icons.chevron_right_rounded, size: 20),
                              ],
                            ),
                          ),
                        ),
                        if (widget.onOpeningsTap != null) ...[
                          const SizedBox(height: 10),
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton(
                              onPressed: widget.onOpeningsTap,
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.brown,
                                side: const BorderSide(
                                  color: Color(0xFFD8B16A),
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 13,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16),
                                ),
                              ),
                              child: const Text(
                                'Apply to openings',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OfficeUpdateTag extends StatelessWidget {
  const _OfficeUpdateTag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF4A2F20) : const Color(0xFFF8EFD8),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: isDark ? const Color(0xFFD8A425) : const Color(0xFFE4C789),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: isDark ? const Color(0xFFF0D7A0) : textColor,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
