import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/applicant_documents_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/office_update_article_screen.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_settings_sheet.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

enum _DashboardSection { all, openings, updates, requirements }

class DashboardScreen extends StatelessWidget {
  final bool showBottomNav;

  const DashboardScreen({super.key, this.showBottomNav = true});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        toolbarHeight: 74,
        titleSpacing: 18,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              'assets/images/school_logo.png',
              height: 42,
              fit: BoxFit.contain,
            ),
            const SizedBox(width: 12),
            Text(
              'SMaRT PDM',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: isDark ? Colors.white : AppColors.black,
                fontSize: 24,
                fontWeight: FontWeight.w900,
                height: 1,
              ),
            ),
          ],
        ),
        centerTitle: false,
        automaticallyImplyLeading: false,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        backgroundColor: isDark ? const Color(0xFF17110B) : Colors.white,
        foregroundColor: isDark ? Colors.white : textColor,
        actions: [
          Consumer<NotificationProvider>(
            builder: (context, provider, _) {
              return Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Badge(
                  isLabelVisible: provider.unreadCount > 0,
                  alignment: const AlignmentDirectional(8, -8),
                  smallSize: 10,
                  backgroundColor: AppColors.gold,
                  child: IconButton(
                    tooltip: 'Notifications',
                    icon: const Icon(
                      Icons.notifications_none_rounded,
                      size: 28,
                    ),
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
  final TextEditingController _searchController = TextEditingController();
  final ApplicantDocumentsService _documentsService =
      ApplicantDocumentsService();
  final ProgramOpeningService _openingService = ProgramOpeningService();

  String _studentId = 'Student';
  String _userName = 'Scholar';
  bool _cachedScholarAccess = false;
  String _searchQuery = '';
  _DashboardSection _selectedSection = _DashboardSection.all;

  bool _isLoadingOpenings = true;
  bool _isLoadingRequirements = true;
  List<ProgramOpening> _latestOpenings = [];
  ApplicantDocumentsPackage? _requirementsPackage;
  bool _needsBaseApplication = false;
  String? _requirementsError;

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;

  bool get _hasScholarAccess {
    final provider = context.watch<NotificationProvider>();
    return provider.hasScholarAccess || _cachedScholarAccess;
  }

  Color get _background =>
      _isDark ? const Color(0xFF17110B) : const Color(0xFFFFFEFB);

  Color get _surface => _isDark ? const Color(0xFF241A11) : Colors.white;

  Color get _primaryText => _isDark ? Colors.white : textColor;

  Color get _secondaryText =>
      _isDark ? Colors.white70 : const Color(0xFF6F675C);

  String get _scholarGreetingName {
    final displayName = _userName.trim();
    return displayName.isEmpty ? 'Scholar' : displayName;
  }

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    if (mounted) {
      setState(() {
        _isLoadingOpenings = true;
        _isLoadingRequirements = true;
        _requirementsError = null;
        _needsBaseApplication = false;
      });
    }

    await Future.wait([
      _loadUserData(),
      _loadLatestOpenings(),
      _loadRequirements(),
    ]);
  }

  Future<void> _loadUserData() async {
    final prefs = await SharedPreferences.getInstance();
    final firstName = prefs.getString('user_first_name') ?? '';
    final lastName = prefs.getString('user_last_name') ?? '';
    final fullName = [
      firstName.trim(),
      lastName.trim(),
    ].where((value) => value.isNotEmpty).join(' ');

    if (!mounted) return;

    setState(() {
      _studentId = prefs.getString('user_student_id') ?? 'Student';
      _userName = fullName.isEmpty ? 'Scholar' : fullName;
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

  Future<void> _loadRequirements() async {
    try {
      final payload = await _documentsService.fetchMyDocuments();

      if (!mounted) return;

      setState(() {
        _requirementsPackage = payload;
        _needsBaseApplication = false;
        _requirementsError = null;
        _isLoadingRequirements = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _requirementsPackage = null;
        _needsBaseApplication =
            error.statusCode == 404 || error.statusCode == 409;
        _requirementsError = _needsBaseApplication
            ? null
            : error.message.trim();
        _isLoadingRequirements = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _requirementsPackage = null;
        _needsBaseApplication = false;
        _requirementsError = error
            .toString()
            .replaceFirst('Exception: ', '')
            .trim();
        _isLoadingRequirements = false;
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

  bool get _hasSearchQuery => _searchQuery.trim().isNotEmpty;

  bool _matchesSearch(String text) {
    if (!_hasSearchQuery) {
      return true;
    }

    return text.toLowerCase().contains(_searchQuery.trim().toLowerCase());
  }

  List<T> _filterItems<T>({
    required String sectionLabel,
    required Iterable<T> items,
    required String Function(T item) textForItem,
  }) {
    final source = items.toList(growable: false);
    if (!_hasSearchQuery) {
      return source;
    }

    if (_matchesSearch(sectionLabel)) {
      return source;
    }

    return source.where((item) => _matchesSearch(textForItem(item))).toList();
  }

  String _openingSearchText(ProgramOpening opening) {
    return [
      opening.openingTitle,
      opening.programName,
      opening.announcementText,
      opening.benefactorName ?? '',
    ].join(' ');
  }

  String _notificationSearchText(AppNotification notification) {
    return [
      notification.title,
      notification.message,
      _notificationLabel(notification),
      ..._officeUpdateTags(notification),
    ].join(' ');
  }

  String _requirementSearchText(ApplicantRequirementDocument document) {
    return [
      document.documentType,
      document.status,
      document.adminComment ?? '',
    ].join(' ');
  }

  String _quickActionSearchText(_QuickAction action) {
    return '${action.title} ${action.subtitle}';
  }

  String _menuActionSearchText(_MenuAction action) {
    return '${action.title} ${action.subtitle}';
  }

  List<ProgramOpening> _filteredOpenings() {
    return _filterItems(
      sectionLabel: 'Latest Openings scholarship openings',
      items: _latestOpenings,
      textForItem: _openingSearchText,
    );
  }

  List<AppNotification> _filteredOfficeUpdates(NotificationProvider provider) {
    final updates = provider.officeUpdatesItems.isNotEmpty
        ? provider.officeUpdatesItems
        : <AppNotification>[_fallbackUpdate()];

    return _filterItems(
      sectionLabel: 'Office Updates announcements news activity feed',
      items: updates,
      textForItem: _notificationSearchText,
    );
  }

  List<ApplicantRequirementDocument> _filteredRequirements() {
    final documents =
        _requirementsPackage?.documents ??
        const <ApplicantRequirementDocument>[];
    return _filterItems(
      sectionLabel:
          'Requirements prerequisites qualifications conditions documents uploads',
      items: documents,
      textForItem: _requirementSearchText,
    );
  }

  List<_QuickAction> _quickActions() {
    return _hasScholarAccess
        ? [
            _QuickAction(
              icon: Icons.upload_file_rounded,
              title: 'Renewal',
              subtitle: 'Upload documents',
              onTap: () =>
                  Navigator.pushNamed(context, AppRoutes.renewalDocuments),
              isLoading: false,
            ),
            _QuickAction(
              icon: Icons.assignment_turned_in_rounded,
              title: 'RO',
              subtitle: 'Submit progress',
              onTap: () => Navigator.pushNamed(context, AppRoutes.roCompletion),
              isLoading: false,
            ),
            _QuickAction(
              icon: Icons.school_rounded,
              title: 'Downloads',
              subtitle: 'View notices',
              onTap: () =>
                  Navigator.pushNamed(context, AppRoutes.notifications),
              isLoading: false,
            ),
          ]
        : [
            _QuickAction(
              icon: Icons.campaign_outlined,
              title: 'Updates',
              subtitle: 'Office updates',
              onTap: () =>
                  Navigator.pushNamed(context, AppRoutes.notifications),
              isLoading: false,
            ),
            _QuickAction(
              icon: Icons.school_rounded,
              title: 'Apply',
              subtitle: 'Open scholarships',
              onTap: () =>
                  Navigator.pushNamed(context, AppRoutes.scholarshipOpenings),
              isLoading: false,
            ),
            _QuickAction(
              icon: Icons.upload_file_rounded,
              title: 'Documents',
              subtitle: 'Requirements',
              onTap: () => Navigator.pushNamed(context, AppRoutes.documents),
              isLoading: false,
            ),
            _QuickAction(
              icon: Icons.fact_check_rounded,
              title: 'Status',
              subtitle: 'Track progress',
              onTap: () => Navigator.pushNamed(context, AppRoutes.status),
              isLoading: false,
            ),
          ];
  }

  List<_QuickAction> _filteredQuickActions() {
    return _filterItems(
      sectionLabel: 'Quick Actions tools shortcuts',
      items: _quickActions(),
      textForItem: _quickActionSearchText,
    );
  }

  List<_MenuAction> _toolActions() {
    return _hasScholarAccess
        ? [
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
              onTap: () =>
                  Navigator.pushNamed(context, AppRoutes.renewalDocuments),
            ),
            _MenuAction(
              icon: Icons.notifications_none_rounded,
              title: 'Scholarship Updates',
              subtitle: 'View announcements and office notices',
              onTap: () =>
                  Navigator.pushNamed(context, AppRoutes.notifications),
            ),
          ]
        : [
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
          ];
  }

  List<_MenuAction> _filteredToolActions() {
    return _filterItems(
      sectionLabel: _hasScholarAccess ? 'Scholar Tools' : 'Applicant Tools',
      items: _toolActions(),
      textForItem: _menuActionSearchText,
    );
  }

  bool _showsSection(_DashboardSection section) {
    return _selectedSection == _DashboardSection.all ||
        _selectedSection == section;
  }

  void _setSelectedSection(_DashboardSection section) {
    setState(() => _selectedSection = section);
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

    if (_isOpeningUpdate(notification)) {
      if (!tags.contains('Openings')) {
        tags.add('Openings');
      }
      if (!tags.contains('Scholarship')) {
        tags.add('Scholarship');
      }
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
      padding: const EdgeInsets.fromLTRB(2, 2, 2, 12),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: _primaryText,
                fontSize: 18,
                fontWeight: FontWeight.w900,
                height: 1.1,
              ),
            ),
          ),
          if (actionLabel != null && onTap != null)
            TextButton(
              onPressed: onTap,
              style: TextButton.styleFrom(
                foregroundColor: _isDark ? AppColors.gold : AppColors.gold,
                minimumSize: const Size(0, 34),
                padding: const EdgeInsets.symmetric(horizontal: 8),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                actionLabel,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSearchShortcut() {
    return Container(
      decoration: BoxDecoration(
        color: _isDark ? const Color(0xFF241A11) : Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: _isDark ? Colors.white10 : const Color(0xFFE8E4DB),
        ),
      ),
      child: TextField(
        controller: _searchController,
        onChanged: (value) => setState(() => _searchQuery = value),
        textInputAction: TextInputAction.search,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: _primaryText,
          fontSize: 13,
          fontWeight: FontWeight.w700,
        ),
        decoration: InputDecoration(
          hintText: 'Search scholarships, updates, or tools',
          hintStyle: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: _isDark ? Colors.white60 : const Color(0xFF756E64),
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
          prefixIcon: Icon(
            Icons.search_rounded,
            size: 20,
            color: _isDark ? Colors.white60 : const Color(0xFFAAA49B),
          ),
          suffixIcon: _hasSearchQuery
              ? IconButton(
                  tooltip: 'Clear search',
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _searchQuery = '');
                  },
                  icon: Icon(
                    Icons.close_rounded,
                    color: _isDark ? Colors.white60 : const Color(0xFFAAA49B),
                  ),
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 4,
            vertical: 13,
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChips() {
    final chips = [
      (label: 'All', section: _DashboardSection.all),
      (label: 'Updates', section: _DashboardSection.updates),
      (label: 'Requirements', section: _DashboardSection.requirements),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          for (int i = 0; i < chips.length; i++) ...[
            _DashboardChip(
              label: chips[i].label,
              isDark: _isDark,
              selected: _selectedSection == chips[i].section,
              onTap: () => _setSelectedSection(chips[i].section),
            ),
            if (i != chips.length - 1) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }

  Widget _buildHero() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: _isDark ? Colors.white10 : const Color(0xFFF0E8DA),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _hasScholarAccess
                          ? 'Welcome back, $_scholarGreetingName'
                          : 'Welcome, Applicant',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: _secondaryText,
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _studentId,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: _primaryText,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                        height: 1.1,
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
          const SizedBox(height: 26),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _hasScholarAccess
                          ? 'Stay on track with your scholarship'
                          : 'Find your next\nscholarship',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: _primaryText,
                        fontSize: 23,
                        height: 1.15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _hasScholarAccess
                          ? 'Track renewals, return obligations, payouts, and office updates in one place.'
                          : 'Apply, upload requirements, and follow office updates without losing your place.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: _secondaryText,
                        fontSize: 13,
                        height: 1.45,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Container(
                width: 150,
                height: 118,
                decoration: BoxDecoration(
                  color: _isDark
                      ? const Color(0xFF2A221B)
                      : const Color(0xFFFFFCF6),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: _isDark
                      ? const []
                      : const [
                          BoxShadow(
                            color: Color(0x12000000),
                            blurRadius: 18,
                            offset: Offset(0, 10),
                          ),
                        ],
                ),
                child: CustomPaint(
                  painter: _ScholarshipIllustrationPainter(isDark: _isDark),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: () => _hasScholarAccess
                  ? Navigator.pushNamed(context, AppRoutes.roAssignment)
                  : Navigator.pushNamed(context, AppRoutes.scholarshipOpenings),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: AppColors.black,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              child: Text(
                _hasScholarAccess ? 'View scholar tools' : 'View scholarships',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions(List<_QuickAction> actions) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isCompact = constraints.maxWidth < 390;
        final width = isCompact
            ? (constraints.maxWidth - 10) / 2
            : (constraints.maxWidth - 30) / 4;

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

  Widget _buildLatestOpenings(List<ProgramOpening> openings) {
    if (_hasScholarAccess) {
      return const SizedBox.shrink();
    }

    if (_isLoadingOpenings) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: _isDark ? Colors.white10 : const Color(0xFFF0E8DA),
          ),
        ),
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    if (openings.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: _isDark ? Colors.white10 : const Color(0xFFF0E8DA),
          ),
        ),
        child: Text(
          _hasSearchQuery
              ? 'No scholarship openings match your search.'
              : 'No scholarship openings are available right now.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: _secondaryText,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    return Column(
      children: openings.map((opening) {
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
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: _isDark ? Colors.white10 : const Color(0xFFF0E8DA),
            ),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 6,
            ),
            leading: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.gold.withValues(alpha: _isDark ? 0.22 : 0.10),
                borderRadius: BorderRadius.circular(14),
              ),
              child: const Icon(Icons.school_rounded, color: AppColors.gold),
            ),
            title: Text(
              openingTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: _primaryText,
                fontSize: 13,
                fontWeight: FontWeight.w900,
              ),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                programName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: _secondaryText,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: _isDark
                        ? AppColors.gold.withValues(alpha: 0.20)
                        : const Color(0xFFFFF4D5),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    'Open',
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: _isDark ? const Color(0xFFFFD54F) : AppColors.gold,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Icon(
                  Icons.chevron_right_rounded,
                  color: _isDark ? Colors.white38 : const Color(0xFF8A8378),
                ),
              ],
            ),
            onTap: () {
              Navigator.pushNamed(context, AppRoutes.scholarshipOpenings);
            },
          ),
        );
      }).toList(),
    );
  }

  Widget _buildOfficeUpdates(List<AppNotification> notifications) {
    return Column(
      children: [
        for (int i = 0; i < notifications.length; i++) ...[
          _OfficeUpdateCard(
            label: _notificationLabel(notifications[i]),
            title: _safeText(notifications[i].title, fallback: 'Office Update'),
            preview: _notificationPreview(notifications[i]),
            tags: _officeUpdateTags(notifications[i]),
            isDark: _isDark,
            onTap: () => _openOfficeUpdateArticle(context, notifications[i]),
            onOpeningsTap:
                _isOpeningUpdate(notifications[i]) && !_hasScholarAccess
                ? () => _openScholarshipOpenings(context)
                : null,
          ),
          if (i != notifications.length - 1) const SizedBox(height: 12),
        ],
      ],
    );
  }

  Widget _buildTools(List<_MenuAction> actions) {
    return _ActionGroupCard(isDark: _isDark, children: actions);
  }

  Widget _buildRequirementsSection(
    List<ApplicantRequirementDocument> documents,
  ) {
    if (_hasScholarAccess) {
      return _DashboardStateCard(
        isDark: _isDark,
        icon: Icons.assignment_rounded,
        title: 'Application requirements are for applicants',
        message:
            'Scholar accounts manage renewal uploads separately through scholar tools.',
        primaryLabel: 'Open Renewal Documents',
        onPrimaryTap: () =>
            Navigator.pushNamed(context, AppRoutes.renewalDocuments),
      );
    }

    if (_isLoadingRequirements) {
      return _DashboardLoadingCard(isDark: _isDark);
    }

    if (_requirementsError != null) {
      return _DashboardStateCard(
        isDark: _isDark,
        icon: Icons.error_outline_rounded,
        title: 'Unable to load requirements',
        message: _requirementsError!,
        primaryLabel: 'Try Again',
        onPrimaryTap: _loadRequirements,
      );
    }

    if (_needsBaseApplication || _requirementsPackage == null) {
      return _DashboardStateCard(
        isDark: _isDark,
        icon: Icons.upload_file_rounded,
        title: 'No application requirements yet',
        message:
            'Start or submit a scholarship application first before document upload becomes available.',
        primaryLabel: 'View Scholarship Openings',
        onPrimaryTap: () => _openScholarshipOpenings(context),
      );
    }

    if (documents.isEmpty) {
      return _DashboardStateCard(
        isDark: _isDark,
        icon: Icons.search_off_rounded,
        title: 'No requirements match your search',
        message:
            'Try a different document name or clear the search to see all required uploads.',
        primaryLabel: 'Clear Search',
        onPrimaryTap: () {
          _searchController.clear();
          setState(() => _searchQuery = '');
        },
      );
    }

    return _RequirementsCard(
      isDark: _isDark,
      package: _requirementsPackage!,
      documents: documents,
      onOpenDocuments: () => Navigator.pushNamed(context, AppRoutes.documents),
      onOpenOpenings: () => _openScholarshipOpenings(context),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();
    final openings = _filteredOpenings();
    final updates = _filteredOfficeUpdates(provider);
    final quickActions = _filteredQuickActions();
    final toolActions = _filteredToolActions();
    final requirements = _filteredRequirements();
    final showAll = _selectedSection == _DashboardSection.all;
    final showSearchResultsOnly = showAll && _hasSearchQuery;
    final hasSearchResults =
        quickActions.isNotEmpty ||
        (!_hasScholarAccess && openings.isNotEmpty) ||
        updates.isNotEmpty ||
        toolActions.isNotEmpty;

    return Container(
      color: _background,
      child: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadDashboardData,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSearchShortcut(),
                const SizedBox(height: 12),
                _buildFilterChips(),
                if (showAll && !_hasSearchQuery) ...[
                  const SizedBox(height: 18),
                  _buildHero(),
                ],
                if (showAll &&
                    (!_hasSearchQuery || quickActions.isNotEmpty)) ...[
                  const SizedBox(height: 20),
                  _sectionTitle(
                    'Quick Actions',
                    actionLabel: 'View all',
                    onTap: () => _hasScholarAccess
                        ? Navigator.pushNamed(context, AppRoutes.notifications)
                        : Navigator.pushNamed(
                            context,
                            AppRoutes.scholarshipOpenings,
                          ),
                  ),
                  _buildQuickActions(quickActions),
                ],
                if (_showsSection(_DashboardSection.openings) &&
                    !_hasScholarAccess &&
                    (!showSearchResultsOnly || openings.isNotEmpty)) ...[
                  const SizedBox(height: 20),
                  _sectionTitle(
                    'Latest Openings',
                    actionLabel: 'View all',
                    onTap: () => Navigator.pushNamed(
                      context,
                      AppRoutes.scholarshipOpenings,
                    ),
                  ),
                  _buildLatestOpenings(openings),
                ],
                if (_showsSection(_DashboardSection.updates) &&
                    (!showSearchResultsOnly || updates.isNotEmpty)) ...[
                  const SizedBox(height: 20),
                  _sectionTitle(
                    'Office Updates',
                    actionLabel: 'View all',
                    onTap: () =>
                        Navigator.pushNamed(context, AppRoutes.notifications),
                  ),
                  _buildOfficeUpdates(updates),
                ],
                if (_showsSection(_DashboardSection.requirements) &&
                    !showAll) ...[
                  const SizedBox(height: 20),
                  _sectionTitle(
                    'Requirements',
                    actionLabel: !_hasScholarAccess && !_needsBaseApplication
                        ? 'Open documents'
                        : null,
                    onTap: !_hasScholarAccess && !_needsBaseApplication
                        ? () =>
                              Navigator.pushNamed(context, AppRoutes.documents)
                        : null,
                  ),
                  _buildRequirementsSection(requirements),
                ],
                if (showAll &&
                    (!_hasSearchQuery || toolActions.isNotEmpty)) ...[
                  const SizedBox(height: 20),
                  _sectionTitle(
                    _hasScholarAccess ? 'Scholar Tools' : 'Applicant Tools',
                  ),
                  _buildTools(toolActions),
                ],
                if (showSearchResultsOnly && !hasSearchResults) ...[
                  const SizedBox(height: 20),
                  _DashboardStateCard(
                    isDark: _isDark,
                    icon: Icons.search_off_rounded,
                    title: 'No results found',
                    message:
                        'Try a different scholarship, update, requirement, or tool keyword.',
                    primaryLabel: 'Clear search',
                    onPrimaryTap: () {
                      _searchController.clear();
                      setState(() => _searchQuery = '');
                    },
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.isDark});

  final String label;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.gold.withValues(alpha: 0.18)
            : AppColors.gold.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: isDark ? Colors.white : AppColors.darkBrown,
          fontSize: 11,
          fontWeight: FontWeight.w900,
          height: 1,
        ),
      ),
    );
  }
}

class _DashboardChip extends StatelessWidget {
  const _DashboardChip({
    required this.label,
    required this.isDark,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final bool isDark;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final backgroundColor = selected
        ? AppColors.gold.withValues(alpha: isDark ? 0.28 : 0.22)
        : isDark
        ? const Color(0xFF241A11)
        : Colors.white;
    final borderColor = selected
        ? AppColors.gold.withValues(alpha: 0.55)
        : isDark
        ? Colors.white12
        : const Color(0xFFE7E0D5);

    return Material(
      color: backgroundColor,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: borderColor),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: isDark ? Colors.white : AppColors.darkBrown,
              fontSize: 11,
              fontWeight: selected ? FontWeight.w900 : FontWeight.w700,
              height: 1,
            ),
          ),
        ),
      ),
    );
  }
}

class _ScholarshipIllustrationPainter extends CustomPainter {
  const _ScholarshipIllustrationPainter({required this.isDark});

  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final scaleX = size.width / 150;
    final scaleY = size.height / 108;

    Offset point(double x, double y) => Offset(x * scaleX, y * scaleY);
    Rect rect(double left, double top, double right, double bottom) =>
        Rect.fromLTRB(
          left * scaleX,
          top * scaleY,
          right * scaleX,
          bottom * scaleY,
        );
    RRect rounded(
      double left,
      double top,
      double right,
      double bottom,
      double radius,
    ) => RRect.fromRectAndRadius(
      rect(left, top, right, bottom),
      Radius.circular(radius * scaleX),
    );

    final ink = Paint()
      ..color = isDark ? Colors.white : const Color(0xFF1E2A21)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final fill = Paint()
      ..color = isDark ? const Color(0xFF3B2A18) : const Color(0xFFFFF4CB)
      ..style = PaintingStyle.fill;
    final goldFill = Paint()
      ..color = AppColors.gold.withValues(alpha: isDark ? 0.75 : 0.85)
      ..style = PaintingStyle.fill;
    final paleFill = Paint()
      ..color = AppColors.gold.withValues(alpha: isDark ? 0.20 : 0.18)
      ..style = PaintingStyle.fill;

    canvas.drawRRect(rounded(26, 22, 134, 78, 13), paleFill);
    canvas.drawRRect(rounded(32, 27, 140, 84, 13), ink);
    canvas.drawRRect(rounded(20, 16, 128, 72, 13), fill);
    canvas.drawRRect(rounded(20, 16, 128, 72, 13), ink);

    canvas.drawCircle(point(46, 44), 17 * scaleX, goldFill);
    canvas.drawCircle(point(46, 44), 17 * scaleX, ink);
    canvas.drawCircle(point(39, 40), 4 * scaleX, ink);
    canvas.drawCircle(point(52, 40), 4 * scaleX, ink);
    canvas.drawArc(rect(35, 45, 45, 55), 3.35, 2.2, false, ink);
    canvas.drawArc(rect(47, 45, 57, 55), 3.35, 2.2, false, ink);

    canvas.drawLine(point(72, 41), point(112, 41), ink);
    canvas.drawLine(point(72, 52), point(104, 52), ink);

    final capPath = Path()
      ..moveTo(point(57, 29).dx, point(57, 29).dy)
      ..lineTo(point(76, 20).dx, point(76, 20).dy)
      ..lineTo(point(96, 29).dx, point(96, 29).dy)
      ..lineTo(point(76, 38).dx, point(76, 38).dy)
      ..close();
    canvas.drawPath(capPath, goldFill);
    canvas.drawPath(capPath, ink);
    canvas.drawLine(point(93, 31), point(105, 43), ink);
    canvas.drawCircle(point(106, 44), 3 * scaleX, goldFill);
    canvas.drawCircle(point(106, 44), 3 * scaleX, ink);

    canvas.drawLine(point(30, 88), point(119, 88), ink);
  }

  @override
  bool shouldRepaint(covariant _ScholarshipIllustrationPainter oldDelegate) {
    return oldDelegate.isDark != isDark;
  }
}

class _QuickAction {
  const _QuickAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.isLoading = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool isLoading;
}

class _QuickActionCard extends StatelessWidget {
  const _QuickActionCard({required this.action, required this.isDark});

  final _QuickAction action;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final surface = isDark ? const Color(0xFF2E2118) : Colors.white;
    final title = isDark ? Colors.white : textColor;
    final subtitle = isDark ? Colors.white60 : const Color(0xFF6F675C);

    return Material(
      color: surface,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: action.isLoading ? null : action.onTap,
        borderRadius: BorderRadius.circular(18),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isDark ? Colors.white10 : const Color(0xFFF0E8DA),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 16, 12, 14),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(
                      alpha: isDark ? 0.22 : 0.10,
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: action.isLoading
                      ? Padding(
                          padding: const EdgeInsets.all(10),
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: isDark
                                ? const Color(0xFFFFD54F)
                                : AppColors.gold,
                          ),
                        )
                      : Icon(
                          action.icon,
                          color: isDark
                              ? const Color(0xFFFFD54F)
                              : AppColors.gold,
                          size: 24,
                        ),
                ),
                const SizedBox(height: 14),
                Text(
                  action.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: title,
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    height: 1.05,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  action.subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: subtitle,
                    fontWeight: FontWeight.w700,
                    height: 1.15,
                  ),
                ),
              ],
            ),
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
    final surface = isDark ? const Color(0xFF241A11) : Colors.white;
    final titleColor = isDark ? Colors.white : textColor;
    final bodyColor = isDark ? Colors.white70 : const Color(0xFF4F4942);

    return Material(
      color: surface,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark ? Colors.white10 : const Color(0xFFF0E8DA),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label.toUpperCase(),
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(
                                color: AppColors.gold,
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 0.4,
                              ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyLarge
                              ?.copyWith(
                                color: titleColor,
                                fontSize: 16,
                                height: 1.15,
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          preview,
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: bodyColor,
                                fontSize: 13,
                                height: 1.35,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  Container(
                    width: 92,
                    height: 92,
                    decoration: BoxDecoration(
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.06)
                          : const Color(0xFFFFFCF4),
                      borderRadius: BorderRadius.circular(18),
                    ),
                    child: Icon(
                      onOpeningsTap != null
                          ? Icons.campaign_rounded
                          : Icons.notifications_active_outlined,
                      color: AppColors.gold.withValues(alpha: 0.9),
                      size: 46,
                    ),
                  ),
                ],
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
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                      child: Text(
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
                            color: AppColors.gold.withValues(alpha: 0.75),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                        child: Text(
                          'Apply now',
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

class _DashboardLoadingCard extends StatelessWidget {
  const _DashboardLoadingCard({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF241A11) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? Colors.white10 : const Color(0xFFF0E8DA),
        ),
      ),
      child: const Center(child: CircularProgressIndicator()),
    );
  }
}

class _DashboardStateCard extends StatelessWidget {
  const _DashboardStateCard({
    required this.isDark,
    required this.icon,
    required this.title,
    required this.message,
    required this.primaryLabel,
    required this.onPrimaryTap,
  });

  final bool isDark;
  final IconData icon;
  final String title;
  final String message;
  final String primaryLabel;
  final VoidCallback onPrimaryTap;

  @override
  Widget build(BuildContext context) {
    final surface = isDark ? const Color(0xFF241A11) : Colors.white;
    final titleColor = isDark ? Colors.white : textColor;
    final bodyColor = isDark ? Colors.white70 : const Color(0xFF4F4942);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark ? Colors.white10 : const Color(0xFFF0E8DA),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: isDark ? 0.22 : 0.18),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon,
              color: isDark ? const Color(0xFFFFD54F) : primaryColor,
              size: 20,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: titleColor,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: bodyColor,
              fontSize: 12.5,
              height: 1.3,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: onPrimaryTap,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.gold,
              foregroundColor: AppColors.darkBrown,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 11),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            child: Text(
              primaryLabel,
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    );
  }
}

class _RequirementsCard extends StatelessWidget {
  const _RequirementsCard({
    required this.isDark,
    required this.package,
    required this.documents,
    required this.onOpenDocuments,
    required this.onOpenOpenings,
  });

  final bool isDark;
  final ApplicantDocumentsPackage package;
  final List<ApplicantRequirementDocument> documents;
  final VoidCallback onOpenDocuments;
  final VoidCallback onOpenOpenings;

  @override
  Widget build(BuildContext context) {
    final surface = isDark ? const Color(0xFF241A11) : Colors.white;
    final titleColor = isDark ? Colors.white : textColor;
    final bodyColor = isDark ? Colors.white70 : const Color(0xFF4F4942);
    final uploadedCount = package.uploadedCount;
    final totalCount = package.documents.length;
    final progress = totalCount == 0 ? 0.0 : uploadedCount / totalCount;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? Colors.white10 : const Color(0xFFF0E8DA),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _ChipLabel(
                label: package.documentStatus,
                isDark: isDark,
                filled: true,
              ),
              _ChipLabel(label: package.applicationStatus, isDark: isDark),
              _ChipLabel(
                label: '$uploadedCount/$totalCount Uploaded',
                isDark: isDark,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            package.contextTitle,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: titleColor,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            package.programName,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: bodyColor,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              minHeight: 10,
              backgroundColor: isDark
                  ? Colors.white12
                  : const Color(0xFFE8E0D6),
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.gold),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            package.allRequiredUploaded
                ? 'All required documents are uploaded.'
                : 'Upload the remaining requirements to complete your application package.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: bodyColor,
              fontSize: 13,
              height: 1.35,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 16),
          for (int i = 0; i < documents.length; i++) ...[
            _RequirementRow(isDark: isDark, document: documents[i]),
            if (i != documents.length - 1)
              Divider(
                height: 18,
                color: isDark ? Colors.white10 : const Color(0xFFEFE5D8),
              ),
          ],
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: onOpenDocuments,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: AppColors.darkBrown,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  child: const Text(
                    'Open documents',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: onOpenOpenings,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: isDark ? Colors.white : AppColors.brown,
                    side: BorderSide(
                      color: AppColors.gold.withValues(alpha: 0.75),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  child: const Text(
                    'View openings',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RequirementRow extends StatelessWidget {
  const _RequirementRow({required this.isDark, required this.document});

  final bool isDark;
  final ApplicantRequirementDocument document;

  @override
  Widget build(BuildContext context) {
    final titleColor = isDark ? Colors.white : textColor;
    final bodyColor = isDark ? Colors.white70 : const Color(0xFF4F4942);
    final statusLabel = document.isSubmitted ? 'Uploaded' : 'Pending';

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: AppColors.gold.withValues(alpha: isDark ? 0.22 : 0.16),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(
            document.isSubmitted
                ? Icons.check_circle_outline_rounded
                : Icons.upload_file_rounded,
            color: isDark ? const Color(0xFFFFD54F) : primaryColor,
            size: 21,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                document.documentType,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: titleColor,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                document.adminComment?.trim().isNotEmpty == true
                    ? document.adminComment!.trim()
                    : 'Status: ${document.status}',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: bodyColor,
                  fontSize: 12,
                  height: 1.3,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        _ChipLabel(
          label: statusLabel,
          isDark: isDark,
          filled: document.isSubmitted,
        ),
      ],
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
            ? AppColors.gold.withValues(alpha: isDark ? 0.35 : 0.22)
            : isDark
            ? Colors.white.withValues(alpha: 0.08)
            : const Color(0xFFFFF6D8),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
          color: AppColors.gold.withValues(alpha: filled ? 0.55 : 0.25),
        ),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: isDark ? Colors.white : AppColors.darkBrown,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          height: 1,
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
        color: isDark ? const Color(0xFF241A11) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isDark ? Colors.white10 : const Color(0xFFF0E8DA),
        ),
        boxShadow: isDark
            ? const []
            : const [
                BoxShadow(
                  color: Color(0x0F000000),
                  blurRadius: 18,
                  offset: Offset(0, 8),
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
                endIndent: 14,
                color: isDark ? Colors.white10 : const Color(0xFFF1E9DC),
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
      minLeadingWidth: 42,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      leading: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: AppColors.gold.withValues(alpha: isDark ? 0.22 : 0.10),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Icon(
          icon,
          color: isDark ? const Color(0xFFFFD54F) : AppColors.gold,
          size: 22,
        ),
      ),
      title: Text(
        title,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: isDark ? Colors.white : textColor,
          fontSize: 13,
          fontWeight: FontWeight.w900,
          height: 1.1,
        ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Text(
          subtitle,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: isDark ? Colors.white60 : const Color(0xFF6F675C),
            fontWeight: FontWeight.w700,
            height: 1.15,
          ),
        ),
      ),
      trailing: Icon(
        Icons.chevron_right_rounded,
        color: isDark ? Colors.white38 : const Color(0xFF9A958C),
      ),
    );
  }
}
