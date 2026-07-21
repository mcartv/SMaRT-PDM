import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/applicant_documents_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/office_update_article_screen.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/controllers/applicant_home_controller.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';
import 'package:smartpdm_mobileapp/shared/widgets/notification_bell_button.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({
    super.key,
    this.showBottomNav = true,
    this.showTopBar = true,
  });

  final bool showBottomNav;
  final bool showTopBar;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SmartPdmPageScaffold(
      appBar: showTopBar
          ? AppBar(
              toolbarHeight: 74,
              titleSpacing: 18,
              automaticallyImplyLeading: false,
              elevation: 0,
              scrolledUnderElevation: 0,
              surfaceTintColor: Colors.transparent,
              backgroundColor: isDark
                  ? const Color(0xFF17110B)
                  : AppColors.white,
              foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
              title: Row(
                children: [
                  Image.asset(
                    'assets/images/school_logo.png',
                    height: 42,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'SMaRT-PDM',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: isDark ? Colors.white : AppColors.darkBrown,
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          height: 1,
                        ),
                  ),
                ],
              ),
              actions: const [NotificationBellButton()],
            )
          : null,
      selectedIndex: 0,
      showDrawer: false,
      showBottomNav: showBottomNav,
      applyPadding: false,
      child: DashboardContent(),
    );
  }
}

typedef DashboardScholarAccessResolver = Future<bool> Function(
  NotificationProvider provider,
  SessionService sessionService,
);

/// The optional constructor fields are retained so existing widget tests and
/// callers do not break. The redesigned dashboard uses the existing services
/// directly and presents one consistent experience for applicants and scholars.
class DashboardContent extends StatelessWidget {
  const DashboardContent({
    super.key,
    this.applicantHomeController,
    this.sessionService = const SessionService(),
    this.scholarAccessResolver,
  });

  final ApplicantHomeController? applicantHomeController;
  final SessionService sessionService;
  final DashboardScholarAccessResolver? scholarAccessResolver;

  @override
  Widget build(BuildContext context) {
    return _UnifiedDashboardContent(sessionService: sessionService);
  }
}

class _UnifiedDashboardContent extends StatefulWidget {
  const _UnifiedDashboardContent({required this.sessionService});

  final SessionService sessionService;

  @override
  State<_UnifiedDashboardContent> createState() =>
      _UnifiedDashboardContentState();
}

class _UnifiedDashboardContentState extends State<_UnifiedDashboardContent> {
  final ApplicantDocumentsService _documentsService =
      ApplicantDocumentsService();
  final ProgramOpeningService _openingService = ProgramOpeningService();
  final ApplicationService _applicationService = ApplicationService();

  NotificationProvider? _notificationProvider;

  String _studentId = 'Student';
  String _userName = 'Student';
  bool _cachedScholarAccess = false;

  bool _isRefreshing = false;
  bool _isLoadingStatus = true;
  bool _isLoadingRequirements = true;
  bool _isLoadingOpenings = true;

  ApplicationStatusSummary? _statusSummary;
  ApplicantDocumentsPackage? _requirementsPackage;
  List<ProgramOpening> _latestOpenings = const [];

  String? _statusError;
  String? _requirementsError;
  bool _needsBaseApplication = false;

  int _lastApplicationRevision = 0;
  int _lastAnnouncementRevision = 0;
  int _lastOpeningRevision = 0;
  int _lastPayoutRevision = 0;
  int _lastRenewalRevision = 0;
  int _lastRoRevision = 0;
  int _lastScholarRevision = 0;

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;

  Color get _background =>
      _isDark ? const Color(0xFF17110B) : const Color(0xFFF7F4EF);

  Color get _surface =>
      _isDark ? const Color(0xFF2A1D13) : AppColors.white;

  Color get _primaryText =>
      _isDark ? Colors.white : AppColors.darkBrown;

  Color get _secondaryText =>
      _isDark ? Colors.white70 : AppColors.brown.withValues(alpha: 0.72);

  bool get _hasScholarAccess {
    final liveAccess = _notificationProvider?.hasScholarAccess ?? false;
    return liveAccess || _cachedScholarAccess;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _loadDashboardData(refreshNotifications: false);
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (identical(provider, _notificationProvider)) return;

    _notificationProvider?.removeListener(_handleProviderChange);
    _notificationProvider = provider;
    _captureProviderRevisions(provider);
    provider.addListener(_handleProviderChange);
  }

  void _captureProviderRevisions(NotificationProvider provider) {
    _lastApplicationRevision = provider.applicationRevision;
    _lastAnnouncementRevision = provider.announcementRevision;
    _lastOpeningRevision = provider.openingRevision;
    _lastPayoutRevision = provider.payoutRevision;
    _lastRenewalRevision = provider.renewalRevision;
    _lastRoRevision = provider.roRevision;
    _lastScholarRevision = provider.scholarRevision;
  }

  void _handleProviderChange() {
    final provider = _notificationProvider;
    if (provider == null || _isRefreshing) return;

    final statusChanged =
        provider.applicationRevision != _lastApplicationRevision ||
        provider.scholarRevision != _lastScholarRevision;
    final requirementsChanged =
        provider.applicationRevision != _lastApplicationRevision;
    final openingsChanged = provider.openingRevision != _lastOpeningRevision;

    final anythingChanged =
        statusChanged ||
        requirementsChanged ||
        openingsChanged ||
        provider.announcementRevision != _lastAnnouncementRevision ||
        provider.payoutRevision != _lastPayoutRevision ||
        provider.renewalRevision != _lastRenewalRevision ||
        provider.roRevision != _lastRoRevision;

    if (!anythingChanged) return;

    _captureProviderRevisions(provider);

    if (statusChanged || requirementsChanged || openingsChanged) {
      _loadDashboardData(refreshNotifications: false);
    } else if (mounted) {
      setState(() {});
    }
  }

  Future<void> _loadDashboardData({bool refreshNotifications = true}) async {
    if (_isRefreshing) return;

    _isRefreshing = true;

    if (mounted) {
      setState(() {
        _isLoadingStatus = true;
        _isLoadingRequirements = true;
        _isLoadingOpenings = true;
      });
    }

    try {
      if (refreshNotifications) {
        await _notificationProvider?.refresh(silent: true);
      }

      await Future.wait([
        _loadIdentity(),
        _loadApplicationStatus(),
        _loadRequirements(),
        _loadOpenings(),
      ]);
    } finally {
      _isRefreshing = false;
    }
  }

  Future<void> _loadIdentity() async {
    final session = await widget.sessionService.getCurrentUser();
    final fullName = [session.firstName.trim(), session.lastName.trim()]
        .where((part) => part.isNotEmpty)
        .join(' ');

    if (!mounted) return;

    setState(() {
      _userName = fullName.isEmpty ? 'Student' : fullName;
      _studentId = session.studentId.trim().isEmpty
          ? 'Student Account'
          : session.studentId.trim();
      _cachedScholarAccess = session.hasScholarAccess;
    });
  }

  Future<void> _loadApplicationStatus() async {
    try {
      final summary =
          await _applicationService.fetchMyApplicationStatusSummary();

      if (!mounted) return;
      setState(() {
        _statusSummary = summary;
        _statusError = null;
        _isLoadingStatus = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _statusSummary = null;
        _statusError = error.toString().replaceFirst('Exception: ', '').trim();
        _isLoadingStatus = false;
      });
    }
  }

  Future<void> _loadRequirements() async {
    try {
      final package = await _documentsService.fetchMyDocuments();

      if (!mounted) return;
      setState(() {
        _requirementsPackage = package;
        _requirementsError = null;
        _needsBaseApplication = false;
        _isLoadingRequirements = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _requirementsPackage = null;
        _needsBaseApplication =
            error.statusCode == 404 || error.statusCode == 409;
        _requirementsError = _needsBaseApplication ? null : error.message;
        _isLoadingRequirements = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _requirementsPackage = null;
        _needsBaseApplication = false;
        _requirementsError =
            error.toString().replaceFirst('Exception: ', '').trim();
        _isLoadingRequirements = false;
      });
    }
  }

  Future<void> _loadOpenings() async {
    try {
      final result = await _openingService.fetchAvailableOpenings();
      if (!mounted) return;
      setState(() {
        _latestOpenings = result.items.take(2).toList(growable: false);
        _isLoadingOpenings = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _latestOpenings = const [];
        _isLoadingOpenings = false;
      });
    }
  }

  String _safeText(dynamic value, {String fallback = ''}) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? fallback : text;
  }

  String _displayFirstName() {
    final pieces = _userName.trim().split(RegExp(r'\s+'));
    return pieces.isEmpty || pieces.first.isEmpty ? 'Student' : pieces.first;
  }

  String _formatDate(DateTime value) {
    final local = value.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final date = DateTime(local.year, local.month, local.day);
    final difference = today.difference(date).inDays;

    if (difference == 0) return 'Today';
    if (difference == 1) return 'Yesterday';
    if (difference > 1 && difference < 7) return '$difference days ago';

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return '${months[local.month - 1]} ${local.day}, ${local.year}';
  }

  String _cleanOpeningTitle(ProgramOpening opening) {
    final programName = _safeText(
      opening.programName,
      fallback: 'Scholarship Program',
    );

    var title = _safeText(opening.openingTitle, fallback: programName);
    title = title
        .replaceAll(
          RegExp(r'\bscholarship\s+opening\b', caseSensitive: false),
          '',
        )
        .replaceAll(RegExp(r'\bopening\b', caseSensitive: false), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    return title.isEmpty ? programName : title;
  }

  void _openOfficeUpdate(AppNotification notification) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => OfficeUpdateArticleScreen(
          notification: notification,
          showBottomNav: false,
        ),
      ),
    );
  }

  List<AppNotification> _latestAnnouncements(NotificationProvider provider) {
    final announcements = provider.officeUpdatesItems
        .where((item) => item.isAnnouncementNotification)
        .take(3)
        .toList(growable: false);

    if (announcements.isNotEmpty) return announcements;

    return provider.officeUpdatesItems.take(3).toList(growable: false);
  }

  List<AppNotification> _recentUpdates(NotificationProvider provider) {
    return provider.notifications
        .where((item) => !item.isAnnouncementNotification)
        .take(4)
        .toList(growable: false);
  }

  AppNotification? _latestMatching(
    NotificationProvider provider,
    bool Function(AppNotification item) test,
  ) {
    for (final item in provider.notifications) {
      if (test(item)) return item;
    }
    return null;
  }

  Widget _buildHero() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(18, 18, 16, 18),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(
          color: _isDark ? Colors.white10 : const Color(0xFFEDE3D5),
        ),
        boxShadow: _isDark
            ? const []
            : const [
                BoxShadow(
                  color: Color(0x10000000),
                  blurRadius: 22,
                  offset: Offset(0, 10),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome, ${_displayFirstName()}',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: _primaryText,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            height: 1.1,
                          ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      _studentId,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: _secondaryText,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ],
                ),
              ),
              _StatusPill(
                label: _hasScholarAccess ? 'SCHOLAR' : 'APPLICANT',
                isDark: _isDark,
              ),
            ],
          ),
          const SizedBox(height: 22),
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
                          : 'Track your scholarship journey',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            color: _primaryText,
                            fontSize: 23,
                            fontWeight: FontWeight.w900,
                            height: 1.14,
                          ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _hasScholarAccess
                          ? 'Monitor your status, requirements, payouts, obligations, and important OSFA notices in one place.'
                          : 'Follow your application, complete requirements, and stay informed about important OSFA announcements.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: _secondaryText,
                            fontSize: 13,
                            height: 1.45,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              const _DashboardIllustration(),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentStatus() {
    if (_isLoadingStatus) {
      return _LoadingCard(isDark: _isDark);
    }

    if (_hasScholarAccess) {
      final program = _safeText(
        _statusSummary?.programName,
        fallback: _safeText(
          _statusSummary?.openingTitle,
          fallback: 'Active Scholarship',
        ),
      );

      return _SurfaceCard(
        isDark: _isDark,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const _AccentIcon(icon: Icons.workspace_premium_rounded),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        program,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              color: _primaryText,
                              fontWeight: FontWeight.w900,
                            ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Your scholar account is active.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: _secondaryText,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ],
                  ),
                ),
                const _StateBadge(
                  label: 'ACTIVE',
                  color: Color(0xFF2E8B57),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              'Use the dashboard as your overview. Detailed payout, obligation, and renewal records remain available through the bottom navigation.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: _secondaryText,
                    height: 1.45,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      );
    }

    if (_statusError != null && _statusSummary == null) {
      return _StateCard(
        isDark: _isDark,
        icon: Icons.cloud_off_rounded,
        title: 'Unable to load application status',
        message: _statusError!,
        buttonLabel: 'Try again',
        onPressed: _loadApplicationStatus,
      );
    }

    final summary = _statusSummary;
    if (summary == null || summary.hasApplication == false) {
      return _StateCard(
        isDark: _isDark,
        icon: Icons.assignment_outlined,
        title: 'No active application yet',
        message:
            'Available scholarships appear below. Open the scholarship list when you are ready to apply.',
        buttonLabel: 'View scholarships',
        onPressed: () =>
            Navigator.pushNamed(context, AppRoutes.scholarshipOpenings),
      );
    }

    final workflow = summary.workflow;
    final status = _safeText(
      workflow?.stageLabel,
      fallback: _safeText(summary.applicationStatus, fallback: 'Pending Review'),
    );
    final title = _safeText(
      summary.programName,
      fallback: _safeText(summary.openingTitle, fallback: 'Scholarship Application'),
    );

    return _SurfaceCard(
      isDark: _isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const _AccentIcon(icon: Icons.assignment_turned_in_rounded),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: _primaryText,
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      status,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.gold,
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (workflow != null)
            Row(
              children: [
                Expanded(
                  child: _StatusMetric(
                    label: 'Requirements',
                    value: workflow.requirements.statusLabel,
                    isDark: _isDark,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _StatusMetric(
                    label: 'Endorsement',
                    value: workflow.endorsement.statusLabel,
                    isDark: _isDark,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _StatusMetric(
                    label: 'Activation',
                    value: workflow.scholarActivation.statusLabel,
                    isDark: _isDark,
                  ),
                ),
              ],
            ),
          if (workflow?.primaryBlocker?.message.trim().isNotEmpty == true) ...[
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.orange.withValues(alpha: _isDark ? 0.18 : 0.09),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                workflow!.primaryBlocker!.message,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: _isDark ? const Color(0xFFFFD6A8) : AppColors.brown,
                      height: 1.4,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAnnouncements(List<AppNotification> announcements) {
    if (_notificationProvider?.isLoading == true && announcements.isEmpty) {
      return _LoadingCard(isDark: _isDark);
    }

    if (announcements.isEmpty) {
      return _StateCard(
        isDark: _isDark,
        icon: Icons.campaign_outlined,
        title: 'No announcements yet',
        message: 'New OSFA announcements will appear here once published.',
      );
    }

    return Column(
      children: [
        for (int index = 0; index < announcements.length; index++) ...[
          _AnnouncementCard(
            notification: announcements[index],
            isDark: _isDark,
            dateLabel: _formatDate(announcements[index].createdAt),
            onTap: () => _openOfficeUpdate(announcements[index]),
          ),
          if (index != announcements.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }

  Widget _buildApplicantRequirements() {
    if (_isLoadingRequirements) {
      return _LoadingCard(isDark: _isDark);
    }

    if (_requirementsError != null) {
      return _StateCard(
        isDark: _isDark,
        icon: Icons.error_outline_rounded,
        title: 'Unable to load requirements',
        message: _requirementsError!,
        buttonLabel: 'Try again',
        onPressed: _loadRequirements,
      );
    }

    if (_needsBaseApplication || _requirementsPackage == null) {
      return _StateCard(
        isDark: _isDark,
        icon: Icons.fact_check_outlined,
        title: 'No requirements are due yet',
        message:
            'Your application requirements will appear here after you start a scholarship application.',
      );
    }

    final package = _requirementsPackage!;
    final documents = package.documents;
    final uploaded = documents.where((item) => item.isSubmitted).length;
    final total = documents.length;
    final pending = documents.where((item) => !item.isSubmitted).take(3).toList();
    final progress = total == 0 ? 0.0 : uploaded / total;

    return _SurfaceCard(
      isDark: _isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const _AccentIcon(icon: Icons.fact_check_rounded),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      package.programName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: _primaryText,
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '$uploaded of $total documents uploaded',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: _secondaryText,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ],
                ),
              ),
              _StateBadge(
                label: package.allRequiredUploaded ? 'COMPLETE' : 'IN PROGRESS',
                color: package.allRequiredUploaded
                    ? const Color(0xFF2E8B57)
                    : AppColors.orange,
              ),
            ],
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress.clamp(0.0, 1.0),
              minHeight: 9,
              backgroundColor: _isDark ? Colors.white12 : const Color(0xFFEAE1D6),
              valueColor: const AlwaysStoppedAnimation<Color>(AppColors.gold),
            ),
          ),
          if (pending.isNotEmpty) ...[
            const SizedBox(height: 16),
            for (int index = 0; index < pending.length; index++) ...[
              _RequirementRow(
                title: pending[index].documentType,
                subtitle: pending[index].adminComment?.trim().isNotEmpty == true
                    ? pending[index].adminComment!.trim()
                    : 'Pending upload',
                isDark: _isDark,
              ),
              if (index != pending.length - 1)
                Divider(
                  height: 18,
                  color: _isDark ? Colors.white10 : const Color(0xFFEDE4D9),
                ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildScholarResponsibilities(NotificationProvider provider) {
    final renewal = _latestMatching(
      provider,
      (item) =>
          item.type.toLowerCase().contains('renewal') ||
          item.title.toLowerCase().contains('renewal'),
    );
    final obligation = _latestMatching(provider, (item) => item.isRoNotification);
    final payout = _latestMatching(provider, (item) => item.isPayoutNotification);

    return _SurfaceCard(
      isDark: _isDark,
      child: Column(
        children: [
          _ResponsibilityRow(
            icon: Icons.description_rounded,
            title: 'Renewal',
            subtitle: renewal?.previewText ??
                'No renewal requirement has been posted for your account.',
            isDark: _isDark,
          ),
          Divider(
            height: 22,
            color: _isDark ? Colors.white10 : const Color(0xFFEDE4D9),
          ),
          _ResponsibilityRow(
            icon: Icons.work_history_rounded,
            title: 'Return of Obligation',
            subtitle: obligation?.previewText ??
                'No new obligation update has been posted.',
            isDark: _isDark,
          ),
          Divider(
            height: 22,
            color: _isDark ? Colors.white10 : const Color(0xFFEDE4D9),
          ),
          _ResponsibilityRow(
            icon: Icons.payments_rounded,
            title: 'Payout',
            subtitle:
                payout?.previewText ?? 'No new payout update has been posted.',
            isDark: _isDark,
          ),
        ],
      ),
    );
  }

  Widget _buildRecentUpdates(List<AppNotification> updates) {
    if (updates.isEmpty) {
      return _StateCard(
        isDark: _isDark,
        icon: Icons.history_rounded,
        title: 'No recent account updates',
        message:
            'Application, document, payout, renewal, and obligation activity will appear here.',
      );
    }

    return _SurfaceCard(
      isDark: _isDark,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Column(
        children: [
          for (int index = 0; index < updates.length; index++) ...[
            _RecentUpdateRow(
              notification: updates[index],
              dateLabel: _formatDate(updates[index].createdAt),
              isDark: _isDark,
              onTap: () =>
                  Navigator.pushNamed(context, AppRoutes.notifications),
            ),
            if (index != updates.length - 1)
              Divider(
                height: 1,
                indent: 46,
                color: _isDark ? Colors.white10 : const Color(0xFFEDE4D9),
              ),
          ],
        ],
      ),
    );
  }

  Widget _buildAvailableScholarships() {
    if (_isLoadingOpenings) {
      return _LoadingCard(isDark: _isDark);
    }

    if (_latestOpenings.isEmpty) {
      return _StateCard(
        isDark: _isDark,
        icon: Icons.school_outlined,
        title: 'No scholarships are available right now',
        message: 'New scholarship programs will appear here when published.',
      );
    }

    return Column(
      children: [
        for (int index = 0; index < _latestOpenings.length; index++) ...[
          _OpeningCard(
            title: _cleanOpeningTitle(_latestOpenings[index]),
            programName: _safeText(
              _latestOpenings[index].programName,
              fallback: 'Scholarship Program',
            ),
            preview: _safeText(
              _latestOpenings[index].announcementText,
              fallback: 'Applications are currently being accepted.',
            ),
            isDark: _isDark,
            onTap: () =>
                Navigator.pushNamed(context, AppRoutes.scholarshipOpenings),
          ),
          if (index != _latestOpenings.length - 1) const SizedBox(height: 10),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();
    final announcements = _latestAnnouncements(provider);
    final recentUpdates = _recentUpdates(provider);

    return ColoredBox(
      color: _background,
      child: SafeArea(
        child: RefreshIndicator(
          color: AppColors.gold,
          onRefresh: () => _loadDashboardData(refreshNotifications: true),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 104),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHero(),
                const SizedBox(height: 24),
                const _SectionHeader(
                  title: 'Current Status',
                  subtitle: 'Your latest scholarship or application standing',
                ),
                const SizedBox(height: 12),
                _buildCurrentStatus(),
                const SizedBox(height: 24),
                _SectionHeader(
                  title: 'Latest Announcements',
                  subtitle: 'Important notices published by OSFA',
                  actionLabel: 'View all',
                  onAction: () =>
                      Navigator.pushNamed(context, AppRoutes.announcements),
                ),
                const SizedBox(height: 12),
                _buildAnnouncements(announcements),
                const SizedBox(height: 24),
                _SectionHeader(
                  title: _hasScholarAccess
                      ? 'Scholar Responsibilities'
                      : 'Upcoming Requirements',
                  subtitle: _hasScholarAccess
                      ? 'Renewal, obligation, and payout items to monitor'
                      : 'Documents and tasks that may still need attention',
                ),
                const SizedBox(height: 12),
                _hasScholarAccess
                    ? _buildScholarResponsibilities(provider)
                    : _buildApplicantRequirements(),
                const SizedBox(height: 24),
                _SectionHeader(
                  title: 'Recent Updates',
                  subtitle: 'Changes related to your account and scholarship',
                  actionLabel: 'View all',
                  onAction: () =>
                      Navigator.pushNamed(context, AppRoutes.notifications),
                ),
                const SizedBox(height: 12),
                _buildRecentUpdates(recentUpdates),
                if (!_hasScholarAccess) ...[
                  const SizedBox(height: 24),
                  _SectionHeader(
                    title: 'Available Scholarships',
                    subtitle: 'Programs currently accepting applications',
                    actionLabel: 'View all',
                    onAction: () => Navigator.pushNamed(
                      context,
                      AppRoutes.scholarshipOpenings,
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildAvailableScholarships(),
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
    _notificationProvider?.removeListener(_handleProviderChange);
    super.dispose();
  }
}

class _DashboardIllustration extends StatelessWidget {
  const _DashboardIllustration();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SizedBox(
      width: 124,
      height: 112,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned(
            top: 7,
            right: 5,
            child: Container(
              width: 86,
              height: 86,
              decoration: BoxDecoration(
                color: AppColors.gold.withValues(alpha: isDark ? 0.16 : 0.13),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            left: 4,
            bottom: 4,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.brown.withValues(alpha: isDark ? 0.35 : 0.08),
                borderRadius: BorderRadius.circular(14),
              ),
            ),
          ),
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF3A291D) : const Color(0xFFFFF8E5),
              borderRadius: BorderRadius.circular(25),
              border: Border.all(
                color: AppColors.gold.withValues(alpha: 0.45),
              ),
              boxShadow: isDark
                  ? const []
                  : const [
                      BoxShadow(
                        color: Color(0x14000000),
                        blurRadius: 16,
                        offset: Offset(0, 8),
                      ),
                    ],
            ),
            child: const Icon(
              Icons.school_rounded,
              color: AppColors.gold,
              size: 46,
            ),
          ),
          Positioned(
            right: 2,
            bottom: 10,
            child: Container(
              width: 30,
              height: 30,
              decoration: const BoxDecoration(
                color: AppColors.darkBrown,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_rounded,
                color: AppColors.gold,
                size: 18,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: isDark ? Colors.white : AppColors.darkBrown,
                      fontSize: 19,
                      fontWeight: FontWeight.w900,
                      height: 1.1,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isDark
                          ? Colors.white60
                          : AppColors.brown.withValues(alpha: 0.67),
                      height: 1.3,
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ],
          ),
        ),
        if (actionLabel != null && onAction != null)
          TextButton(
            onPressed: onAction,
            style: TextButton.styleFrom(foregroundColor: AppColors.gold),
            child: Text(
              actionLabel!,
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
      ],
    );
  }
}

class _SurfaceCard extends StatelessWidget {
  const _SurfaceCard({
    required this.isDark,
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  final bool isDark;
  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2A1D13) : AppColors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark ? Colors.white10 : const Color(0xFFEDE3D5),
        ),
        boxShadow: isDark
            ? const []
            : const [
                BoxShadow(
                  color: Color(0x0D000000),
                  blurRadius: 18,
                  offset: Offset(0, 8),
                ),
              ],
      ),
      child: child,
    );
  }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      isDark: isDark,
      child: const SizedBox(
        height: 74,
        child: Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

class _StateCard extends StatelessWidget {
  const _StateCard({
    required this.isDark,
    required this.icon,
    required this.title,
    required this.message,
    this.buttonLabel,
    this.onPressed,
  });

  final bool isDark;
  final IconData icon;
  final String title;
  final String message;
  final String? buttonLabel;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _AccentIcon(icon: icon),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: isDark ? Colors.white : AppColors.darkBrown,
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      message,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: isDark
                                ? Colors.white70
                                : AppColors.brown.withValues(alpha: 0.72),
                            height: 1.4,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (buttonLabel != null && onPressed != null) ...[
            const SizedBox(height: 14),
            FilledButton(
              onPressed: onPressed,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: AppColors.darkBrown,
                elevation: 0,
              ),
              child: Text(
                buttonLabel!,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AccentIcon extends StatelessWidget {
  const _AccentIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: isDark ? 0.20 : 0.13),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Icon(icon, color: AppColors.gold, size: 23),
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: isDark ? 0.24 : 0.17),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.42)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: isDark ? Colors.white : AppColors.darkBrown,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.5,
            ),
      ),
    );
  }
}

class _StateBadge extends StatelessWidget {
  const _StateBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.30)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.3,
            ),
      ),
    );
  }
}

class _StatusMetric extends StatelessWidget {
  const _StatusMetric({
    required this.label,
    required this.value,
    required this.isDark,
  });

  final String label;
  final String value;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 11),
      decoration: BoxDecoration(
        color: isDark
            ? Colors.white.withValues(alpha: 0.05)
            : const Color(0xFFFAF6EF),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: isDark ? Colors.white54 : const Color(0xFF8B7968),
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 5),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: isDark ? Colors.white : AppColors.darkBrown,
                  fontWeight: FontWeight.w900,
                  height: 1.15,
                ),
          ),
        ],
      ),
    );
  }
}

class _AnnouncementCard extends StatelessWidget {
  const _AnnouncementCard({
    required this.notification,
    required this.isDark,
    required this.dateLabel,
    required this.onTap,
  });

  final AppNotification notification;
  final bool isDark;
  final String dateLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isDark ? const Color(0xFF2A1D13) : AppColors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark ? Colors.white10 : const Color(0xFFEDE3D5),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: isDark ? 0.22 : 0.13),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Icon(
                  notification.icon,
                  color: AppColors.gold,
                  size: 23,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            notification.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(
                                  color: isDark
                                      ? Colors.white
                                      : AppColors.darkBrown,
                                  fontWeight: FontWeight.w900,
                                  height: 1.2,
                                ),
                          ),
                        ),
                        if (!notification.isRead)
                          Container(
                            width: 8,
                            height: 8,
                            margin: const EdgeInsets.only(left: 8, top: 3),
                            decoration: const BoxDecoration(
                              color: Color(0xFFE53935),
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      notification.previewText,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: isDark
                                ? Colors.white70
                                : AppColors.brown.withValues(alpha: 0.70),
                            height: 1.4,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      dateLabel,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: isDark ? Colors.white54 : const Color(0xFF958575),
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 4),
              Icon(
                Icons.chevron_right_rounded,
                color: isDark ? Colors.white38 : const Color(0xFF9A8B7B),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RequirementRow extends StatelessWidget {
  const _RequirementRow({
    required this.title,
    required this.subtitle,
    required this.isDark,
  });

  final String title;
  final String subtitle;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(Icons.circle_outlined, color: AppColors.gold, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: isDark ? Colors.white : AppColors.darkBrown,
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isDark
                          ? Colors.white60
                          : AppColors.brown.withValues(alpha: 0.67),
                      height: 1.3,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ResponsibilityRow extends StatelessWidget {
  const _ResponsibilityRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.isDark,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _AccentIcon(icon: icon),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: isDark ? Colors.white : AppColors.darkBrown,
                      fontWeight: FontWeight.w900,
                    ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isDark
                          ? Colors.white70
                          : AppColors.brown.withValues(alpha: 0.70),
                      height: 1.35,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RecentUpdateRow extends StatelessWidget {
  const _RecentUpdateRow({
    required this.notification,
    required this.dateLabel,
    required this.isDark,
    required this.onTap,
  });

  final AppNotification notification;
  final String dateLabel;
  final bool isDark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 0, vertical: 4),
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: notification.accentColor.withValues(alpha: isDark ? 0.18 : 0.10),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(
          notification.icon,
          color: notification.accentColor,
          size: 19,
        ),
      ),
      title: Text(
        notification.title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: isDark ? Colors.white : AppColors.darkBrown,
              fontWeight: FontWeight.w800,
            ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 3),
        child: Text(
          dateLabel,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: isDark ? Colors.white54 : const Color(0xFF958575),
                fontWeight: FontWeight.w700,
              ),
        ),
      ),
      trailing: !notification.isRead
          ? Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: Color(0xFFE53935),
                shape: BoxShape.circle,
              ),
            )
          : Icon(
              Icons.chevron_right_rounded,
              color: isDark ? Colors.white38 : const Color(0xFF9A8B7B),
            ),
    );
  }
}

class _OpeningCard extends StatelessWidget {
  const _OpeningCard({
    required this.title,
    required this.programName,
    required this.preview,
    required this.isDark,
    required this.onTap,
  });

  final String title;
  final String programName;
  final String preview;
  final bool isDark;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isDark ? const Color(0xFF2A1D13) : AppColors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark ? Colors.white10 : const Color(0xFFEDE3D5),
            ),
          ),
          child: Row(
            children: [
              const _AccentIcon(icon: Icons.school_rounded),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            color: isDark ? Colors.white : AppColors.darkBrown,
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      programName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: AppColors.gold,
                            fontWeight: FontWeight.w800,
                          ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      preview,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: isDark
                                ? Colors.white60
                                : AppColors.brown.withValues(alpha: 0.66),
                            height: 1.3,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right_rounded,
                color: isDark ? Colors.white38 : const Color(0xFF9A8B7B),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
