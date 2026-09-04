import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:smartpdm_mobileapp/app/motion/app_motion.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/applicant_documents_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/announcement_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/office_update_article_screen.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/controllers/applicant_home_controller.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/profile/data/services/profile_service.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';
import 'package:smartpdm_mobileapp/shared/widgets/notification_bell_button.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

Future<void> showSmartPdmGettingStartedGuide(
  BuildContext context, {
  bool barrierDismissible = true,
}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: barrierDismissible,
    builder: (dialogContext) => _FirstTimeGuideDialog(
      onFinish: () async {
        if (dialogContext.mounted) {
          Navigator.of(dialogContext).pop();
        }
      },
    ),
  );
}

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
      showBottomNav: showBottomNav,
      applyPadding: false,
      child: DashboardContent(),
    );
  }
}

typedef DashboardScholarAccessResolver =
    Future<bool> Function(
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
    return _UnifiedDashboardContent(
      sessionService: sessionService,
      scholarAccessResolver: scholarAccessResolver,
    );
  }
}

class _UnifiedDashboardContent extends StatefulWidget {
  const _UnifiedDashboardContent({
    required this.sessionService,
    this.scholarAccessResolver,
  });

  final SessionService sessionService;
  final DashboardScholarAccessResolver? scholarAccessResolver;

  @override
  State<_UnifiedDashboardContent> createState() =>
      _UnifiedDashboardContentState();
}

class _UnifiedDashboardContentState extends State<_UnifiedDashboardContent> {
  final ApplicantDocumentsService _documentsService =
      ApplicantDocumentsService();
  final AnnouncementService _announcementService = AnnouncementService();
  final ProgramOpeningService _openingService = ProgramOpeningService();
  final ApplicationService _applicationService = ApplicationService();
  final ProfileService _profileService = ProfileService();

  NotificationProvider? _notificationProvider;

  String _studentId = 'Student';
  String _userName = 'Student';
  bool _cachedScholarAccess = false;

  bool _isRefreshing = false;
  bool _pendingRealtimeDashboardRefresh = false;
  bool _isLoadingStatus = true;
  bool _isLoadingRequirements = true;
  bool _isLoadingAnnouncements = true;
  bool _isLoadingOpenings = true;

  ApplicationStatusSummary? _statusSummary;
  ApplicantDocumentsPackage? _requirementsPackage;
  List<AppNotification> _announcements = const [];
  List<ProgramOpening> _latestOpenings = const [];

  String? _identityError;
  String? _statusError;
  String? _requirementsError;
  String? _announcementsError;
  String? _openingsError;
  bool _needsBaseApplication = false;
  bool _guideChecked = false;

  int _lastApplicationRevision = 0;
  int _lastAnnouncementRevision = 0;
  int _lastOpeningRevision = 0;
  int _lastPayoutRevision = 0;
  int _lastRenewalRevision = 0;
  int _lastRoRevision = 0;
  int _lastScholarRevision = 0;
  int _lastScholarAccessRevision = 0;

  bool get _isDark => Theme.of(context).brightness == Brightness.dark;

  Color get _background =>
      _isDark ? AppColors.applicantDarkBackground : AppColors.applicantLightBackground;

  Color get _surface => _isDark ? AppColors.applicantDarkSurface : AppColors.applicantLightSurface;

  Color get _primaryText => _isDark ? AppColors.applicantDarkText : AppColors.applicantLightText;

  Color get _secondaryText =>
      _isDark ? AppColors.applicantDarkTextMuted : AppColors.applicantLightTextMuted;

  bool get _scholarPrivilegeRemoved =>
      _statusSummary?.scholarPrivilegeRemoved == true;

  bool get _hasScholarAccess {
    if (_scholarPrivilegeRemoved) return false;
    if (widget.scholarAccessResolver != null) return _cachedScholarAccess;

    final provider = _notificationProvider;
    if (provider == null) return _cachedScholarAccess;

    if (provider.scholarAccessRevision > 0) {
      return provider.hasScholarAccess;
    }

    return provider.hasScholarAccess || _cachedScholarAccess;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await _loadDashboardData(refreshNotifications: false);
      if (!mounted || _identityError != null) return;
      await _showFirstTimeGuideIfNeeded();
    });
  }

  Future<void> _showFirstTimeGuideIfNeeded() async {
    if (_guideChecked) return;
    _guideChecked = true;

    // The getting-started guide is only for applicants who can still follow
    // the normal application lifecycle. Active and removed scholars must not
    // receive applicant onboarding after login.
    if (_hasScholarAccess || _scholarPrivilegeRemoved) return;

    final prefs = await SharedPreferences.getInstance();
    SessionUser session;
    try {
      session = await widget.sessionService.getCurrentUser();
    } catch (error) {
      debugPrint('ONBOARDING SESSION READ ERROR: $error');
      return;
    }
    final accountKey = session.userId.trim().isNotEmpty
        ? session.userId.trim()
        : session.studentId.trim();
    final guideKey = accountKey.isEmpty
        ? 'mobile_dashboard_guide_seen_v2'
        : 'mobile_dashboard_guide_seen_v2_$accountKey';

    // Local state is authoritative for this device. A false/unavailable server
    // preference must never overwrite a guide that was already shown locally.
    var hasSeenGuide = prefs.getBool(guideKey) ?? false;
    if (!hasSeenGuide) {
      try {
        final seenOnServer = await _profileService.hasSeenOnboarding();
        hasSeenGuide = seenOnServer;
        if (seenOnServer) await prefs.setBool(guideKey, true);
      } catch (error) {
        debugPrint('ONBOARDING PREFERENCE FETCH ERROR: $error');
      }
    }
    if (hasSeenGuide || !mounted) return;

    // Mark it before opening so a login/app restart cannot repeatedly trigger
    // the automatic popup. The guide remains manually accessible on Dashboard.
    await prefs.setBool(guideKey, true);
    try {
      await _profileService.markOnboardingSeen();
    } catch (error) {
      debugPrint('ONBOARDING PREFERENCE UPDATE ERROR: $error');
    }
    if (!mounted) return;

    await showSmartPdmGettingStartedGuide(
      context,
      barrierDismissible: false,
    );
  }

  // Manual guide access now lives in Menu > Information.

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
    _lastScholarAccessRevision = provider.scholarAccessRevision;
  }

  void _handleProviderChange() {
    final provider = _notificationProvider;
    if (provider == null) return;

    final accessChanged =
        provider.scholarAccessRevision != _lastScholarAccessRevision;
    final statusChanged =
        provider.applicationRevision != _lastApplicationRevision ||
        provider.scholarRevision != _lastScholarRevision;
    final requirementsChanged =
        provider.applicationRevision != _lastApplicationRevision;
    final openingsChanged = provider.openingRevision != _lastOpeningRevision;
    final announcementsChanged =
        provider.announcementRevision != _lastAnnouncementRevision;

    final anythingChanged =
        accessChanged ||
        statusChanged ||
        requirementsChanged ||
        openingsChanged ||
        announcementsChanged ||
        provider.payoutRevision != _lastPayoutRevision ||
        provider.renewalRevision != _lastRenewalRevision ||
        provider.roRevision != _lastRoRevision;

    if (!anythingChanged) return;

    _captureProviderRevisions(provider);

    // Apply the provider's current announcement cache immediately so an
    // archived announcement disappears from the mounted Dashboard without
    // waiting for navigation or a network round-trip. The API refresh below
    // still remains the authoritative reconciliation step.
    if (announcementsChanged) {
      _syncAnnouncementsFromProvider(provider);
    }

    if (_isRefreshing) {
      _pendingRealtimeDashboardRefresh = true;
      return;
    }

    if (statusChanged || requirementsChanged || openingsChanged) {
      unawaited(_loadDashboardData(refreshNotifications: false));
    } else if (announcementsChanged) {
      unawaited(_loadAnnouncements());
    } else if (mounted) {
      setState(() {});
    }
  }

  void _syncAnnouncementsFromProvider(NotificationProvider provider) {
    if (!mounted) return;

    final currentAnnouncements = provider.officeUpdatesItems
        .where((item) => item.isAnnouncementNotification)
        .take(3)
        .toList(growable: false);

    setState(() {
      _announcements = currentAnnouncements;
      _announcementsError = null;
      _isLoadingAnnouncements = false;
    });
  }

  Future<void> _loadDashboardData({bool refreshNotifications = true}) async {
    if (_isRefreshing) {
      _pendingRealtimeDashboardRefresh = true;
      return;
    }

    _isRefreshing = true;

    if (mounted) {
      setState(() {
        _isLoadingStatus = true;
        _isLoadingRequirements = true;
        _isLoadingAnnouncements = true;
        _isLoadingOpenings = true;
      });
    }

    try {
      if (refreshNotifications) {
        await _notificationProvider?.refresh(silent: true);
      }

      await _loadIdentity();
      if (_identityError != null) {
        if (mounted) {
          setState(() {
            _isLoadingStatus = false;
            _isLoadingRequirements = false;
            _isLoadingAnnouncements = false;
            _isLoadingOpenings = false;
          });
        }
        return;
      }

      await Future.wait([
        _loadApplicationStatus(),
        _loadRequirements(),
        _loadAnnouncements(),
        _loadOpenings(),
      ]);
    } finally {
      _isRefreshing = false;
      if (_pendingRealtimeDashboardRefresh && mounted) {
        _pendingRealtimeDashboardRefresh = false;
        scheduleMicrotask(() => _loadDashboardData(refreshNotifications: false));
      }
    }
  }

  Future<void> _loadIdentity() async {
    try {
      final session = await widget.sessionService.getCurrentUser();
      final fullName = [
        session.firstName.trim(),
        session.lastName.trim(),
      ].where((part) => part.isNotEmpty).join(' ');

      var resolvedScholarAccess = session.hasScholarAccess;
      final resolver = widget.scholarAccessResolver;
      final provider = _notificationProvider;
      if (resolver != null && provider != null) {
        try {
          resolvedScholarAccess = await resolver(provider, widget.sessionService);
        } catch (error) {
          debugPrint('DASHBOARD SCHOLAR ACCESS RESOLUTION ERROR: $error');
        }
      }

      if (!mounted) return;

      setState(() {
        _userName = fullName.isEmpty ? 'Student' : fullName;
        _studentId = session.studentId.trim().isEmpty
            ? 'Student Account'
            : session.studentId.trim();
        _cachedScholarAccess = resolvedScholarAccess;
        _identityError = null;
      });
    } catch (error) {
      debugPrint('DASHBOARD SESSION READ ERROR: $error');
      if (!mounted) return;
      setState(() {
        _identityError =
            'Your account session could not be loaded. Please try again.';
      });
    }
  }

  Future<void> _loadApplicationStatus() async {
    try {
      final summary = await _applicationService
          .fetchMyApplicationStatusSummary();

      if (!mounted) return;
      setState(() {
        _statusSummary = summary;
        _statusError = null;
        _isLoadingStatus = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        // Keep the last known valid status during a transient refresh failure.
        // On first load, _statusSummary is already null and the UI shows the
        // explicit retry state instead of pretending there is no application.
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
        _needsBaseApplication =
            error.statusCode == 404 || error.statusCode == 409;
        if (_needsBaseApplication) {
          // A 404/409 is a real lifecycle state, not a transient transport
          // failure, so stale document data must not remain visible.
          _requirementsPackage = null;
        }
        _requirementsError = _needsBaseApplication ? null : error.message;
        _isLoadingRequirements = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _needsBaseApplication = false;
        _requirementsError = error
            .toString()
            .replaceFirst('Exception: ', '')
            .trim();
        _isLoadingRequirements = false;
      });
    }
  }

  Future<void> _loadAnnouncements() async {
    try {
      final items = await _announcementService.fetchAnnouncements();
      if (!mounted) return;

      setState(() {
        _announcements = items
            .map((item) => item.toNotification())
            .take(3)
            .toList(growable: false);
        _announcementsError = null;
        _isLoadingAnnouncements = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _announcementsError = error
            .toString()
            .replaceFirst('Exception: ', '')
            .trim();
        _isLoadingAnnouncements = false;
      });
    }
  }

  Future<void> _loadOpenings() async {
    try {
      final result = await _openingService.fetchDashboardOpenings();
      if (!mounted) return;
      setState(() {
        _latestOpenings = result.items.take(2).toList(growable: false);
        _openingsError = null;
        _isLoadingOpenings = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _openingsError = error
            .toString()
            .replaceFirst('Exception: ', '')
            .trim();
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

  List<AppNotification> _latestAnnouncements() {
    final announcements = List<AppNotification>.from(_announcements)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    return announcements.take(3).toList(growable: false);
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
                label: _scholarPrivilegeRemoved
                    ? 'REMOVED'
                    : _hasScholarAccess
                        ? 'SCHOLAR'
                        : 'APPLICANT',
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
                      _scholarPrivilegeRemoved
                          ? 'Your scholarship record is preserved'
                          : _hasScholarAccess
                              ? 'Stay on track with your scholarship'
                              : 'Track your scholarship journey',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            color: _primaryText,
                            fontSize: 23,
                            fontWeight: FontWeight.w900,
                            height: 1.14,
                          ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _scholarPrivilegeRemoved
                          ? 'Your previous scholarship history remains on file. Contact OSFA regarding eligibility or future applications.'
                          : _hasScholarAccess
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


  Widget _buildAnnouncements(List<AppNotification> announcements) {
    if (_isLoadingAnnouncements && announcements.isEmpty) {
      return _LoadingCard(isDark: _isDark);
    }

    if (_announcementsError != null && announcements.isEmpty) {
      return _StateCard(
        isDark: _isDark,
        icon: Icons.cloud_off_rounded,
        title: 'Unable to load announcements',
        message: _announcementsError!,
        buttonLabel: 'Try again',
        onPressed: _loadAnnouncements,
      );
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


  Widget _buildScholarResponsibilities(NotificationProvider provider) {
    final renewal = _latestMatching(
      provider,
      (item) =>
          item.type.toLowerCase().contains('renewal') ||
          item.title.toLowerCase().contains('renewal'),
    );
    final obligation = _latestMatching(
      provider,
      (item) => item.isRoNotification,
    );
    final payout = _latestMatching(
      provider,
      (item) => item.isPayoutNotification,
    );

    return _SurfaceCard(
      isDark: _isDark,
      child: Column(
        children: [
          _ResponsibilityRow(
            icon: Icons.description_rounded,
            title: 'Renewal',
            subtitle:
                renewal?.previewText ??
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
            subtitle:
                obligation?.previewText ??
                'No new obligation update has been posted.',
            isDark: _isDark,
            onTap: () => Navigator.pushNamed(context, AppRoutes.roAssignment),
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



  // SMART-PDM_MOBILE_BENTO_DASHBOARD_V1
  Widget _buildBentoDashboard() {
    final summary = _statusSummary;
    final workflow = summary?.workflow;
    final hasApplication = summary?.hasApplication == true;
    final package = _requirementsPackage;

    final totalDocuments = package?.documents.length ?? 0;
    final uploadedDocuments =
        package?.documents.where((item) => item.isSubmitted).length ?? 0;
    final remainingDocuments =
        (totalDocuments - uploadedDocuments).clamp(0, totalDocuments);

    final applicationValue = !hasApplication
        ? 'No active application'
        : _safeText(
            workflow?.stageLabel,
            fallback: _safeText(
              summary?.applicationStatus,
              fallback: 'Pending Review',
            ),
          );

    final applicationDetail = !hasApplication
        ? 'No application has been submitted yet.'
        : _safeText(
            summary?.programName,
            fallback: _safeText(
              summary?.openingTitle,
              fallback: 'Scholarship Application',
            ),
          );

    final requirementsValue = _isLoadingRequirements && package == null
        ? 'Loading...'
        : _requirementsError != null && package == null
            ? 'Unable to load'
            : package == null
                ? (_needsBaseApplication ? 'Not available yet' : 'Not started')
                : package.allRequiredUploaded
                    ? 'Complete'
                    : '$uploadedDocuments of $totalDocuments';

    final requirementsDetail = _requirementsError != null && package == null
        ? 'Requirements could not be loaded. Open Documents or pull to refresh and try again.'
        : package == null
            ? 'Requirements appear after you start a scholarship application.'
            : package.allRequiredUploaded
                ? 'All required documents are uploaded.'
                : '$remainingDocuments document${remainingDocuments == 1 ? '' : 's'} remaining.';

    final nextStep = workflow?.primaryBlocker?.message.trim();
    final nextStepValue = !hasApplication
        ? 'Choose a scholarship'
        : nextStep?.isNotEmpty == true
            ? 'Action needed'
            : 'Monitor your status';

    final nextStepDetail = !hasApplication
        ? 'Review eligibility and prepare your requirements.'
        : nextStep?.isNotEmpty == true
            ? nextStep!
            : 'Watch for OSFA review and endorsement updates.';

    final scholarProgram = _safeText(
      summary?.programName,
      fallback: _safeText(
        summary?.openingTitle,
        fallback: 'Active Scholarship',
      ),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final textScale =
            MediaQuery.textScalerOf(context).scale(16) / 16;
        final useTwoColumns =
            constraints.maxWidth >= 345 && textScale <= 1.12;
        const gap = 12.0;
        final halfWidth = useTwoColumns
            ? (constraints.maxWidth - gap) / 2
            : constraints.maxWidth;

        Widget tile({
          required double width,
          required int order,
          required IconData icon,
          required String label,
          required String value,
          required String detail,
          VoidCallback? onTap,
          String? badge,
          bool wide = false,
        }) {
          return SizedBox(
            width: width,
            child: AppMotionReveal(
              delay: Duration(milliseconds: 45 * order),
              child: _DashboardBentoTile(
                icon: icon,
                label: label,
                value: value,
                detail: detail,
                badge: badge,
                isDark: _isDark,
                onTap: onTap,
                wide: wide,
              ),
            ),
          );
        }

        final cards = <Widget>[];

        if (summary?.scholarPrivilegeRemoved == true) {
          cards.add(
            tile(
              width: constraints.maxWidth,
              order: 0,
              icon: Icons.info_outline_rounded,
              label: 'Scholarship Status',
              value: 'Privilege Removed',
              detail:
                  workflow?.primaryBlocker?.message ??
                  'Your previous scholarship record remains on file. Contact OSFA regarding eligibility or future applications.',
              badge: 'REMOVED',
              wide: true,
            ),
          );
        } else if (_hasScholarAccess) {
          // Payout, Obligation, and Renewal already have permanent bottom-nav
          // destinations. Keep Dashboard focused on information instead of
          // repeating those navigation cards.
          cards.add(
            tile(
              width: constraints.maxWidth,
              order: 0,
              icon: Icons.workspace_premium_rounded,
              label: 'Scholarship Overview',
              value: scholarProgram,
              detail:
                  'Scholar account active. Use the bottom navigation for payout, obligation, and renewal actions.',
              badge: 'ACTIVE',
              wide: true,
            ),
          );
        } else if (_isLoadingStatus && summary == null) {
          cards.add(
            tile(
              width: constraints.maxWidth,
              order: 0,
              icon: Icons.hourglass_top_rounded,
              label: 'Application',
              value: 'Loading status...',
              detail: 'Checking your current scholarship application status.',
              wide: true,
            ),
          );
        } else if (_statusError != null && summary == null) {
          cards.add(
            tile(
              width: constraints.maxWidth,
              order: 0,
              icon: Icons.cloud_off_rounded,
              label: 'Application',
              value: 'Unable to load status',
              detail: 'Tap to retry. Your application state has not been changed.',
              onTap: () => unawaited(_loadApplicationStatus()),
              wide: true,
            ),
          );
        } else if (!hasApplication) {
          // Before an application exists, avoid empty status/requirements
          // cards. Put the user's actionable path first.
          cards.addAll([
            tile(
              width: halfWidth,
              order: 0,
              icon: Icons.school_rounded,
              label: 'Available Scholarships',
              value: _isLoadingOpenings && _latestOpenings.isEmpty
                  ? 'Loading...'
                  : _openingsError != null && _latestOpenings.isEmpty
                      ? 'Unable to load'
                      : _latestOpenings.isEmpty
                          ? 'No openings yet'
                          : _cleanOpeningTitle(_latestOpenings.first),
              detail: _openingsError != null && _latestOpenings.isEmpty
                  ? 'Open the scholarship list or pull to refresh and try again.'
                  : _latestOpenings.isEmpty
                      ? 'New scholarship openings will appear here when published.'
                      : 'Review eligibility, slots, and application details.',
              onTap: () => Navigator.pushNamed(
                context,
                AppRoutes.scholarshipOpenings,
              ),
            ),
            tile(
              width: halfWidth,
              order: 1,
              icon: Icons.route_rounded,
              label: 'Next Step',
              value: nextStepValue,
              detail: nextStepDetail,
            ),
          ]);
        } else {
          // Once an application exists, its current state and required action
          // outrank unrelated openings.
          cards.addAll([
            tile(
              width: halfWidth,
              order: 0,
              icon: Icons.assignment_turned_in_rounded,
              label: 'Application',
              value: applicationValue,
              detail: applicationDetail,
              onTap: () => Navigator.pushNamed(context, AppRoutes.status),
            ),
            tile(
              width: halfWidth,
              order: 1,
              icon: Icons.route_rounded,
              label: 'Next Step',
              value: nextStepValue,
              detail: nextStepDetail,
            ),
            tile(
              width: constraints.maxWidth,
              order: 2,
              icon: Icons.fact_check_rounded,
              label: 'Requirements',
              value: requirementsValue,
              detail: requirementsDetail,
              badge: package?.allRequiredUploaded == true
                  ? 'COMPLETE'
                  : null,
              onTap: () => Navigator.pushNamed(context, AppRoutes.documents),
              wide: true,
            ),
          ]);
        }

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: cards,
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();
    final announcements = _latestAnnouncements();

    if (_identityError != null) {
      return ColoredBox(
        color: _background,
        child: SafeArea(
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(14, 24, 14, 104),
            child: _StateCard(
              isDark: _isDark,
              icon: Icons.account_circle_outlined,
              title: 'We could not load Home right now.',
              message: _identityError!,
              buttonLabel: 'Try again',
              onPressed: () => _loadDashboardData(refreshNotifications: false),
            ),
          ),
        ),
      );
    }

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
                // The existing Welcome card remains intentionally unchanged.
                _buildHero(),
                const SizedBox(height: 14),
                Text(
                  'Latest Announcements',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: _primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                _buildAnnouncements(announcements),
                const SizedBox(height: 14),
                _buildBentoDashboard(),
                if (_hasScholarAccess) ...[
                  const SizedBox(height: 14),
                  Text(
                    'Scholar Updates',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: _primaryText,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 8),
                  _buildScholarResponsibilities(provider),
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

class _DashboardBentoTile extends StatelessWidget {
  const _DashboardBentoTile({
    required this.icon,
    required this.label,
    required this.value,
    required this.detail,
    required this.isDark,
    this.badge,
    this.onTap,
    this.wide = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final String detail;
  final bool isDark;
  final String? badge;
  final VoidCallback? onTap;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final surface = isDark
        ? AppColors.applicantDarkSurface
        : Colors.white;
    final outline = isDark
        ? Colors.white.withValues(alpha: 0.08)
        : AppColors.brown.withValues(alpha: 0.09);
    final titleColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;
    final mutedColor = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.brown.withValues(alpha: 0.66);

    final content = Container(
      constraints: BoxConstraints(
        minHeight: wide ? 126 : 166,
      ),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: outline),
        boxShadow: isDark
            ? const []
            : const [
                BoxShadow(
                  color: Color(0x0B000000),
                  blurRadius: 16,
                  offset: Offset(0, 7),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(
                    alpha: isDark ? 0.18 : 0.14,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  icon,
                  color: AppColors.gold,
                  size: 21,
                ),
              ),
              const Spacer(),
              if (badge?.trim().isNotEmpty == true)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(
                      alpha: isDark ? 0.18 : 0.14,
                    ),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    badge!,
                    style: Theme.of(context)
                        .textTheme
                        .labelSmall
                        ?.copyWith(
                          color: isDark
                              ? AppColors.gold
                              : AppColors.darkBrown,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.4,
                        ),
                  ),
                )
              else if (onTap != null)
                Icon(
                  Icons.arrow_outward_rounded,
                  size: 18,
                  color: mutedColor,
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: mutedColor,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.65,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            value,
            maxLines: wide ? 1 : 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: titleColor,
              fontWeight: FontWeight.w900,
              height: 1.12,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            detail,
            maxLines: wide ? 2 : 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: mutedColor,
              height: 1.35,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );

    if (onTap == null) return content;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: content,
      ),
    );
  }
}

class _FirstTimeGuideDialog extends StatefulWidget {
  const _FirstTimeGuideDialog({required this.onFinish});

  final Future<void> Function() onFinish;

  @override
  State<_FirstTimeGuideDialog> createState() => _FirstTimeGuideDialogState();
}

class _FirstTimeGuideDialogState extends State<_FirstTimeGuideDialog> {
  int _index = 0;
  bool _isFinishing = false;

  static const _steps = [
    (
      Icons.school_rounded,
      'Choose a scholarship',
      'Open Available Scholarships and select the opening that matches your eligibility.',
    ),
    (
      Icons.edit_document,
      'Complete your application',
      'Fill in every required field. Your progress is saved so you can return before submission.',
    ),
    (
      Icons.upload_file_rounded,
      'Upload requirements',
      'Upload clear PDF or image files, then check the review remarks for anything that must be replaced.',
    ),
    (
      Icons.route_rounded,
      'Track endorsement',
      'Current Status shows whether your application is with SDO, Guidance, or the Program Director.',
    ),
    (
      Icons.notifications_active_rounded,
      'Watch for updates',
      'Use Notifications and Messages for official OSFA announcements, requests, and replies.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final step = _steps[_index];
    final isLast = _index == _steps.length - 1;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dialogSurface = isDark
        ? AppColors.applicantDarkSurface
        : Colors.white;
    final titleColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;
    final bodyColor = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.brown.withValues(alpha: 0.78);
    final stepIconColor = isDark ? AppColors.gold : AppColors.brown;

    return AlertDialog(
      backgroundColor: dialogSurface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      title: Text(
        'Getting started ${_index + 1}/${_steps.length}',
        style: Theme.of(context).textTheme.titleLarge?.copyWith(
          color: titleColor,
          fontWeight: FontWeight.w900,
        ),
      ),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: AppColors.gold.withValues(alpha: 0.16),
                shape: BoxShape.circle,
              ),
              child: Icon(step.$1, size: 34, color: stepIconColor),
            ),
            const SizedBox(height: 18),
            Text(
              step.$2,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: titleColor,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              step.$3,
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: bodyColor, height: 1.5),
            ),
          ],
        ),
      ),
      actions: [
        if (_index > 0)
          TextButton(
            onPressed: () => setState(() => _index -= 1),
            style: TextButton.styleFrom(
              foregroundColor: isDark
                  ? AppColors.applicantDarkText
                  : AppColors.brown,
            ),
            child: const Text('Back'),
          ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.gold,
            foregroundColor: AppColors.darkBrown,
          ),
          onPressed: _isFinishing
              ? null
              : isLast
              ? () async {
                  setState(() {
                    _isFinishing = true;
                  });
                  await widget.onFinish();
                }
              : () => setState(() => _index += 1),
          child: Text(
            _isFinishing ? 'Saving...' : (isLast ? 'Got it' : 'Next'),
          ),
        ),
      ],
    );
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
              border: Border.all(color: AppColors.gold.withValues(alpha: 0.45)),
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
    return Semantics(
      container: true,
      button: true,
      label: 'Open announcement: ${notification.title}',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Ink(
            padding: const EdgeInsets.all(15),
            decoration: BoxDecoration(
              color: isDark
                  ? const Color(0xFF241A12)
                  : const Color(0xFFFFFCF7),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.07)
                    : const Color(0xFFE9E1D7),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(
                      alpha: isDark ? 0.20 : 0.11,
                    ),
                    borderRadius: BorderRadius.circular(14),
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
                          color: isDark
                              ? Colors.white54
                              : const Color(0xFF958575),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
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


class _ResponsibilityRow extends StatelessWidget {
  const _ResponsibilityRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.isDark,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool isDark;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final content = Row(
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
        if (onTap != null) ...[
          const SizedBox(width: 8),
          Icon(
            Icons.chevron_right_rounded,
            size: 18,
            color: isDark ? Colors.white54 : AppColors.brown.withValues(alpha: 0.55),
          ),
        ],
      ],
    );

    if (onTap == null) return content;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: content,
      ),
    );
  }
}


