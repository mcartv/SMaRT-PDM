import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/office_update_article_screen.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_settings_sheet.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class DashboardScreen extends StatelessWidget {
  final bool showBottomNav;

  const DashboardScreen({super.key, this.showBottomNav = true});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text(
          'SMaRT-PDM',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        centerTitle: false,
        automaticallyImplyLeading: false,
        elevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: isDark ? Colors.white : textColor,
        actions: [
          Consumer<NotificationProvider>(
            builder: (context, provider, _) {
              return Padding(
                padding: const EdgeInsets.only(right: 10),
                child: Badge(
                  isLabelVisible: provider.unreadCount > 0,
                  label: Text('${provider.unreadCount}'),
                  backgroundColor: Colors.red,
                  child: IconButton(
                    tooltip: 'Notifications',
                    icon: const Icon(Icons.notifications_none_rounded),
                    onPressed: () {
                      Navigator.pushNamed(context, AppRoutes.notifications);
                    },
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
  final ProgramOpeningService _openingService = ProgramOpeningService();

  String _studentId = 'Student';
  bool _cachedScholarAccess = false;

  bool _isLoadingOpenings = true;
  List<ProgramOpening> _latestOpenings = [];

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;

  bool get _hasScholarAccess {
    final provider = context.watch<NotificationProvider>();
    return provider.hasScholarAccess || _cachedScholarAccess;
  }

  Color get _background =>
      _isDark ? const Color(0xFF1F150F) : const Color(0xFFFAF7F2);

  Color get _surface => _isDark ? const Color(0xFF2E2118) : Colors.white;

  Color get _primaryText => _isDark ? Colors.white : textColor;

  Color get _secondaryText => _isDark ? Colors.white70 : Colors.black54;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    await Future.wait([_loadUserData(), _loadLatestOpenings()]);
  }

  Future<void> _loadUserData() async {
    final prefs = await SharedPreferences.getInstance();

    if (!mounted) return;

    setState(() {
      _studentId = prefs.getString('user_student_id') ?? 'Student';
      _cachedScholarAccess = prefs.getBool('user_has_scholar_access') ?? false;
    });
  }

  Future<void> _loadLatestOpenings() async {
    try {
      final result = await _openingService.fetchAvailableOpenings();

      if (!mounted) return;

      setState(() {
        _latestOpenings = result.items.take(3).toList();
        _isLoadingOpenings = false;
      });
    } catch (error) {
      debugPrint('DASHBOARD OPENINGS ERROR: $error');

      if (!mounted) return;

      setState(() {
        _latestOpenings = [];
        _isLoadingOpenings = false;
      });
    }
  }

  String _safeText(dynamic value, {String fallback = ''}) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? fallback : text;
  }

  String _notificationLabel(AppNotification notification) {
    final type = _safeText(notification.type).toUpperCase();

    if (type.contains('ANNOUNCEMENT')) return 'ANNOUNCEMENT';
    if (type.contains('OPENING')) return 'OPENING';
    if (type.contains('APPLICATION')) return 'APPLICATION';
    if (type.contains('DOCUMENT')) return 'DOCUMENT';

    return 'OFFICE UPDATE';
  }

  String _notificationPreview(AppNotification notification) {
    final message = _safeText(notification.message);
    if (message.isNotEmpty) return message;

    return 'Check the latest scholarship and office updates from OSFA.';
  }

  bool _isOpeningUpdate(AppNotification notification) {
    final type = _safeText(notification.type).toLowerCase();
    final refType = _safeText(notification.referenceType).toLowerCase();
    final title = _safeText(notification.title).toLowerCase();

    return type.contains('opening') ||
        refType.contains('opening') ||
        title.contains('opening') ||
        title.contains('scholarship');
  }

  void _openOfficeUpdateArticle(
    BuildContext context,
    AppNotification notification,
  ) {
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

  List<String> _officeUpdateTags(AppNotification notification) {
    final text =
        '${_safeText(notification.title)} ${_safeText(notification.message)}'
            .toUpperCase();

    final tags = <String>[];

    void add(String keyword, String label) {
      if (text.contains(keyword) && !tags.contains(label)) {
        tags.add(label);
      }
    }

    add('CHED', 'CHED');
    add('UNIFAST', 'UNIFAST');
    add('TES', 'TES');
    add('TDP', 'TDP');

    if (text.contains('PRIVATE') ||
        text.contains('GRANT') ||
        text.contains('BENEFACTOR')) {
      tags.add('Private Grants');
    }

    if (tags.isEmpty && _isOpeningUpdate(notification)) {
      tags.addAll(const ['Openings', 'Scholarship']);
    }

    if (tags.isEmpty) {
      tags.add('Office Notice');
    }

    return tags.take(4).toList();
  }

  AppNotification _fallbackUpdate() {
    return AppNotification(
      notificationId: 'fallback-office-update',
      userId: '',
      type: 'Announcement',
      title: 'Scholarship opportunities are posted here',
      message:
          'Check office updates for CHED, UNIFAST, TES, TDP, and private grant announcements.',
      referenceId: null,
      referenceType: 'announcement',
      isRead: true,
      pushSent: false,
      createdAt: DateTime.now(),
    );
  }

  Widget _sectionTitle(
    String title, {
    String? actionLabel,
    VoidCallback? onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 4, 2, 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: TextStyle(
                color: _primaryText,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          if (actionLabel != null && onTap != null)
            TextButton(
              onPressed: onTap,
              child: Text(
                actionLabel,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildHero() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: _isDark
              ? const [Color(0xFF3B2415), Color(0xFF5D3717), Color(0xFF8A651E)]
              : const [Color(0xFFFFF9ED), Color(0xFFF8E7BE), Color(0xFFEEC96A)],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(_isDark ? 0.25 : 0.08),
            blurRadius: 22,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 54,
                height: 54,
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Image.asset('assets/images/school_logo.png'),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _hasScholarAccess
                          ? 'Welcome back, Scholar'
                          : 'Welcome, Applicant',
                      style: TextStyle(
                        color: _primaryText,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      _studentId,
                      style: TextStyle(
                        color: _primaryText,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              _StatusPill(
                label: _hasScholarAccess ? 'Scholar' : 'Applicant',
                isDark: _isDark,
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(
            'Scholarship Monitoring & Reporting Tool',
            style: TextStyle(
              color: _primaryText,
              fontSize: 25,
              height: 1.1,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _hasScholarAccess
                ? 'Track renewals, return obligations, payouts, and updates.'
                : 'Apply for scholarships, upload requirements, and monitor your application.',
            style: TextStyle(
              color: _secondaryText,
              fontSize: 13.5,
              height: 1.45,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions() {
    final actions = _hasScholarAccess
        ? [
            _QuickAction(
              icon: Icons.upload_file_rounded,
              title: 'Renewal',
              subtitle: 'Upload documents',
              onTap: () =>
                  Navigator.pushNamed(context, AppRoutes.renewalDocuments),
            ),
            _QuickAction(
              icon: Icons.assignment_turned_in_rounded,
              title: 'RO',
              subtitle: 'Submit progress',
              onTap: () => Navigator.pushNamed(context, AppRoutes.roCompletion),
            ),
            _QuickAction(
              icon: Icons.notifications_none_rounded,
              title: 'Updates',
              subtitle: 'View notices',
              onTap: () =>
                  Navigator.pushNamed(context, AppRoutes.notifications),
            ),
          ]
        : [
            _QuickAction(
              icon: Icons.school_rounded,
              title: 'Apply',
              subtitle: 'Open scholarships',
              onTap: () =>
                  Navigator.pushNamed(context, AppRoutes.scholarshipOpenings),
            ),
            _QuickAction(
              icon: Icons.upload_file_rounded,
              title: 'Documents',
              subtitle: 'Requirements',
              onTap: () => Navigator.pushNamed(context, AppRoutes.documents),
            ),
            _QuickAction(
              icon: Icons.fact_check_rounded,
              title: 'Status',
              subtitle: 'Track progress',
              onTap: () => Navigator.pushNamed(context, AppRoutes.status),
            ),
          ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final isCompact = constraints.maxWidth < 390;
        final width = isCompact
            ? constraints.maxWidth
            : (constraints.maxWidth - 20) / 3;

        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: actions
              .map(
                (action) => SizedBox(
                  width: width,
                  child: _QuickActionCard(action: action, isDark: _isDark),
                ),
              )
              .toList(),
        );
      },
    );
  }

  Widget _buildLatestOpenings() {
    if (_hasScholarAccess) {
      return const SizedBox.shrink();
    }

    if (_isLoadingOpenings) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(24),
        ),
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_latestOpenings.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Text(
          'No scholarship openings are available right now.',
          style: TextStyle(
            color: _secondaryText,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    return Column(
      children: _latestOpenings.map((opening) {
        final openingTitle = _safeText(
          opening.openingTitle,
          fallback: 'Scholarship Opening',
        );
        final programName = _safeText(
          opening.programName,
          fallback: 'Scholarship Program',
        );

        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: _surface,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [
              if (!_isDark)
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
            ],
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 10,
            ),
            leading: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.gold.withOpacity(0.14),
                borderRadius: BorderRadius.circular(15),
              ),
              child: const Icon(Icons.school_rounded, color: primaryColor),
            ),
            title: Text(
              openingTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: _primaryText,
                fontWeight: FontWeight.w900,
                fontSize: 14,
              ),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                programName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: _secondaryText, fontSize: 12),
              ),
            ),
            trailing: const Icon(Icons.chevron_right_rounded),
            onTap: () {
              Navigator.pushNamed(context, AppRoutes.scholarshipOpenings);
            },
          ),
        );
      }).toList(),
    );
  }

  Widget _buildOfficeUpdate() {
    return Consumer<NotificationProvider>(
      builder: (context, provider, _) {
        final notification = provider.homeOfficeUpdatesItems.isNotEmpty
            ? provider.homeOfficeUpdatesItems.first
            : _fallbackUpdate();

        return _OfficeUpdateCard(
          label: _notificationLabel(notification),
          title: _safeText(notification.title, fallback: 'Office Update'),
          preview: _notificationPreview(notification),
          tags: _officeUpdateTags(notification),
          isDark: _isDark,
          onTap: () => _openOfficeUpdateArticle(context, notification),
          onOpeningsTap: _isOpeningUpdate(notification) && !_hasScholarAccess
              ? () => _openScholarshipOpenings(context)
              : null,
        );
      },
    );
  }

  Widget _buildApplicantTools() {
    return _ActionGroupCard(
      isDark: _isDark,
      children: [
        _MenuAction(
          icon: Icons.person_add_alt_1_rounded,
          title: 'Apply for New Scholarship',
          subtitle: 'Start or continue an application',
          onTap: () =>
              Navigator.pushNamed(context, AppRoutes.scholarshipOpenings),
        ),
        _MenuAction(
          icon: Icons.upload_file_rounded,
          title: 'Upload Scholarship Requirements',
          subtitle: 'Submit documents for your application',
          onTap: () => Navigator.pushNamed(context, AppRoutes.documents),
        ),
        _MenuAction(
          icon: Icons.help_outline_rounded,
          title: 'FAQs',
          subtitle: 'Read common scholarship questions',
          onTap: () => Navigator.pushNamed(context, AppRoutes.faqs),
        ),
        _MenuAction(
          icon: Icons.settings_outlined,
          title: 'App Settings',
          subtitle: 'Manage preferences and account options',
          onTap: () => showAppSettingsSheet(context),
        ),
      ],
    );
  }

  Widget _buildScholarTools() {
    return _ActionGroupCard(
      isDark: _isDark,
      children: [
        _MenuAction(
          icon: Icons.assignment_rounded,
          title: 'View RO Assignment',
          subtitle: 'Check assigned tasks and required hours',
          onTap: () => Navigator.pushNamed(context, AppRoutes.roAssignment),
        ),
        _MenuAction(
          icon: Icons.done_all_rounded,
          title: 'Submit RO Completion',
          subtitle: 'Upload proof and track progress',
          onTap: () => Navigator.pushNamed(context, AppRoutes.roCompletion),
        ),
        _MenuAction(
          icon: Icons.upload_file_rounded,
          title: 'Renewal Documents',
          subtitle: 'Submit renewal requirements',
          onTap: () => Navigator.pushNamed(context, AppRoutes.renewalDocuments),
        ),
        _MenuAction(
          icon: Icons.notifications_none_rounded,
          title: 'Scholarship Updates',
          subtitle: 'View announcements and office notices',
          onTap: () => Navigator.pushNamed(context, AppRoutes.notifications),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: _background,
      child: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadDashboardData,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHero(),
                const SizedBox(height: 22),
                _sectionTitle('Quick Actions'),
                _buildQuickActions(),
                if (!_hasScholarAccess) ...[
                  const SizedBox(height: 22),
                  _sectionTitle(
                    'Latest Openings',
                    actionLabel: 'View all',
                    onTap: () => Navigator.pushNamed(
                      context,
                      AppRoutes.scholarshipOpenings,
                    ),
                  ),
                  _buildLatestOpenings(),
                ],
                const SizedBox(height: 22),
                _sectionTitle(
                  'Office Updates',
                  actionLabel: 'View all',
                  onTap: () =>
                      Navigator.pushNamed(context, AppRoutes.notifications),
                ),
                _buildOfficeUpdate(),
                const SizedBox(height: 22),
                _sectionTitle(
                  _hasScholarAccess ? 'Scholar Tools' : 'Applicant Tools',
                ),
                _hasScholarAccess
                    ? _buildScholarTools()
                    : _buildApplicantTools(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.isDark});

  final String label;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withOpacity(0.12)
            : Colors.white.withOpacity(0.65),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: isDark ? Colors.white24 : Colors.white),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: isDark ? Colors.white : textColor,
          fontSize: 11,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _QuickAction {
  const _QuickAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
}

class _QuickActionCard extends StatelessWidget {
  const _QuickActionCard({required this.action, required this.isDark});

  final _QuickAction action;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final surface = isDark ? const Color(0xFF2E2118) : Colors.white;
    final title = isDark ? Colors.white : textColor;
    final subtitle = isDark ? Colors.white60 : Colors.black54;

    return Material(
      color: surface,
      borderRadius: BorderRadius.circular(22),
      elevation: isDark ? 0 : 1.5,
      shadowColor: Colors.black.withOpacity(0.10),
      child: InkWell(
        onTap: action.onTap,
        borderRadius: BorderRadius.circular(22),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.gold.withOpacity(isDark ? 0.18 : 0.14),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(
                  action.icon,
                  color: isDark ? const Color(0xFFFFD54F) : primaryColor,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      action.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: title,
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      action.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: subtitle,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OfficeUpdateCard extends StatelessWidget {
  const _OfficeUpdateCard({
    required this.label,
    required this.title,
    required this.preview,
    required this.tags,
    required this.isDark,
    required this.onTap,
    this.onOpeningsTap,
  });

  final String label;
  final String title;
  final String preview;
  final List<String> tags;
  final bool isDark;
  final VoidCallback onTap;
  final VoidCallback? onOpeningsTap;

  @override
  Widget build(BuildContext context) {
    final surface = isDark ? const Color(0xFF2E2118) : Colors.white;
    final titleColor = isDark ? Colors.white : textColor;
    final bodyColor = isDark ? Colors.white70 : Colors.black87;

    return Material(
      color: surface,
      borderRadius: BorderRadius.circular(26),
      elevation: isDark ? 0 : 1.5,
      shadowColor: Colors.black.withOpacity(0.10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(26),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _ChipLabel(label: label, isDark: isDark, filled: true),
                  ...tags.map((tag) => _ChipLabel(label: tag, isDark: isDark)),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: titleColor,
                  fontSize: 18,
                  height: 1.2,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                preview,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: bodyColor,
                  fontSize: 13.5,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: onTap,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.gold,
                        foregroundColor: AppColors.darkBrown,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(15),
                        ),
                      ),
                      child: const Text(
                        'Read update',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                    ),
                  ),
                  if (onOpeningsTap != null) ...[
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onOpeningsTap,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: isDark
                              ? Colors.white
                              : AppColors.brown,
                          side: BorderSide(
                            color: AppColors.gold.withOpacity(0.75),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(15),
                          ),
                        ),
                        child: const Text(
                          'Apply',
                          style: TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChipLabel extends StatelessWidget {
  const _ChipLabel({
    required this.label,
    required this.isDark,
    this.filled = false,
  });

  final String label;
  final bool isDark;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: filled
            ? AppColors.gold.withOpacity(isDark ? 0.35 : 0.22)
            : isDark
            ? Colors.white.withOpacity(0.08)
            : const Color(0xFFF8EFD8),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: AppColors.gold.withOpacity(filled ? 0.55 : 0.25),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: isDark ? Colors.white : textColor,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _ActionGroupCard extends StatelessWidget {
  const _ActionGroupCard({required this.children, required this.isDark});

  final List<_MenuAction> children;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2E2118) : Colors.white,
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          if (!isDark)
            BoxShadow(
              color: Colors.black.withOpacity(0.06),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
        ],
      ),
      child: Column(
        children: [
          for (int i = 0; i < children.length; i++) ...[
            children[i].build(context, isDark),
            if (i != children.length - 1)
              Divider(
                height: 1,
                indent: 68,
                color: isDark ? Colors.white10 : const Color(0xFFEFE5D8),
              ),
          ],
        ],
      ),
    );
  }
}

class _MenuAction {
  const _MenuAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  Widget build(BuildContext context, bool isDark) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      leading: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: AppColors.gold.withOpacity(isDark ? 0.18 : 0.12),
          borderRadius: BorderRadius.circular(15),
        ),
        child: Icon(
          icon,
          color: isDark ? const Color(0xFFFFD54F) : primaryColor,
          size: 21,
        ),
      ),
      title: Text(
        title,
        style: TextStyle(
          color: isDark ? Colors.white : textColor,
          fontWeight: FontWeight.w900,
          fontSize: 14,
        ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Text(
          subtitle,
          style: TextStyle(
            color: isDark ? Colors.white60 : Colors.black54,
            fontSize: 12,
          ),
        ),
      ),
      trailing: Icon(
        Icons.chevron_right_rounded,
        color: isDark ? Colors.white38 : Colors.black38,
      ),
    );
  }
}
