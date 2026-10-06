// SMaRT-PDM: Endorsement — endorsement screen (mobile screen); loads state, handles user actions, and renders the screen.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/core/files/downloaded_file_handler.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

// SMART_PDM_ENDORSEMENT_POLISH_PHASE_1_4
class EndorsementScreen extends StatefulWidget {
  const EndorsementScreen({super.key});

  @override
  // createState: creates create state for the Endorsement flow.
  State<EndorsementScreen> createState() => _EndorsementScreenState();
}

class _EndorsementScreenState extends State<EndorsementScreen> {
  final ApplicationService _applicationService = ApplicationService();

  ApplicationStatusSummary? _summary;
  bool _isLoading = true;
  bool _isDownloadingSlip = false;
  String? _errorMessage;
  NotificationProvider? _notificationProvider;
  int _lastScholarAccessRevision = 0;
  int _lastApplicationRevision = 0;
  Timer? _pollingTimer;
  bool _fetchInProgress = false;
  bool _pendingLiveRefresh = false;

  @override
  // initState: handles init state for the Endorsement flow.
  void initState() {
    super.initState();
    _loadStatus();
    _pollingTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
      if (MobileRealtimeService.instance.isRealtimeHealthy) return;
      _requestLiveRefresh();
    });
  }

  @override
  // didChangeDependencies: handles did change dependencies for the Endorsement flow.
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (_notificationProvider == provider) return;

    _notificationProvider?.removeListener(_handleNotificationProviderChange);
    _notificationProvider = provider;
    _lastScholarAccessRevision = provider.scholarAccessRevision;
    _lastApplicationRevision = provider.applicationRevision;
    _notificationProvider?.addListener(_handleNotificationProviderChange);
  }

  // _handleNotificationProviderChange: handles handle notification provider change for the Endorsement flow.
  void _handleNotificationProviderChange() {
    final provider = _notificationProvider;
    if (provider == null) return;

    if (provider.scholarAccessRevision == _lastScholarAccessRevision &&
        provider.applicationRevision == _lastApplicationRevision) {
      return;
    }

    _lastScholarAccessRevision = provider.scholarAccessRevision;
    _lastApplicationRevision = provider.applicationRevision;
    _requestLiveRefresh();
  }

  // _loadStatus: handles load status for the Endorsement flow.
  Future<void> _loadStatus({bool silent = false}) async {
    if (_fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }

    _fetchInProgress = true;
    if (!silent && mounted) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final summary = await _applicationService
          .fetchMyApplicationStatusSummary();
      if (!mounted) return;
      setState(() {
        _summary = summary;
        _errorMessage = null;
      });
    } catch (error) {
      if (!mounted) return;
      if (!silent || _summary == null) {
        setState(() {
          _errorMessage = error
              .toString()
              .replaceFirst('Exception: ', '')
              .trim();
        });
      }
    } finally {
      _fetchInProgress = false;
      if (mounted && !silent) {
        setState(() => _isLoading = false);
      }
      if (_pendingLiveRefresh && mounted) {
        _pendingLiveRefresh = false;
        scheduleMicrotask(() => _loadStatus(silent: true));
      }
    }
  }

  // _requestLiveRefresh: handles request live refresh for the Endorsement flow.
  void _requestLiveRefresh() {
    if (!mounted) return;
    if (_fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }
    _loadStatus(silent: true);
  }

  // _downloadEndorsementSlip: handles download endorsement slip for the Endorsement flow.
  Future<void> _downloadEndorsementSlip() async {
    setState(() => _isDownloadingSlip = true);

    try {
      final download = await _applicationService.downloadMyEndorsementSlip();
      final message = await saveAndOpenDownloadedFile(
        bytes: download.bytes,
        fileName: download.fileName,
        contentType: download.contentType,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error.toString().replaceFirst('Exception: ', '').trim(),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _isDownloadingSlip = false);
    }
  }

  @override
  // dispose: handles dispose for the Endorsement flow.
  void dispose() {
    _pollingTimer?.cancel();
    _notificationProvider?.removeListener(_handleNotificationProviderChange);
    super.dispose();
  }

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Endorsement')),
      selectedIndex: 0,
      child: ColoredBox(
        color: AppSurfacePalette.background(context),
        child: RefreshIndicator(
          onRefresh: () => _loadStatus(),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.lg),
            children: [
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.only(top: 64),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_errorMessage != null)
                _EndorsementMessageCard(
                  icon: Icons.cloud_off_rounded,
                  title: 'Unable to load endorsement',
                  message: _errorMessage!,
                  primaryActionLabel: 'Try Again',
                  onPrimaryAction: () => _loadStatus(),
                )
              else if (_summary == null || _summary!.hasApplication == false)
                _EndorsementMessageCard(
                  icon: Icons.assignment_late_outlined,
                  title: 'No endorsement yet',
                  message:
                      'Submit a scholarship application first before endorsement tracking becomes available.',
                  primaryActionLabel: 'View Scholarship Openings',
                  onPrimaryAction: () => Navigator.pushNamed(
                    context,
                    AppRoutes.scholarshipOpenings,
                  ),
                )
              else
                _EndorsementView(
                  summary: _summary!,
                  isDownloadingSlip: _isDownloadingSlip,
                  onDownloadSlip: _downloadEndorsementSlip,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EndorsementView extends StatefulWidget {
  const _EndorsementView({
    required this.summary,
    required this.isDownloadingSlip,
    required this.onDownloadSlip,
  });

  final ApplicationStatusSummary summary;
  final bool isDownloadingSlip;
  final VoidCallback onDownloadSlip;

  @override
  // createState: creates create state for the Endorsement flow.
  State<_EndorsementView> createState() => _EndorsementViewState();
}

class _EndorsementViewState extends State<_EndorsementView> {
  final Set<String> _expandedOffices = <String>{};

  @override
  // initState: handles init state for the Endorsement flow.
  void initState() {
    super.initState();
    _expandCurrentOffice();
  }

  @override
  // didUpdateWidget: handles did update widget for the Endorsement flow.
  void didUpdateWidget(covariant _EndorsementView oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldStage = oldWidget.summary.workflow?.endorsement.currentStage;
    final newStage = widget.summary.workflow?.endorsement.currentStage;
    if (oldStage != newStage) {
      _expandCurrentOffice();
    }
  }

  // _expandCurrentOffice: handles expand current office for the Endorsement flow.
  void _expandCurrentOffice() {
    final stage = widget.summary.workflow?.endorsement.currentStage;
    final officeKey = _officeKeyForStage(stage);
    if (officeKey != null) {
      _expandedOffices.add(officeKey);
    }
  }

  // _officeKeyForStage: handles office key for stage for the Endorsement flow.
  String? _officeKeyForStage(String? stage) {
    return switch (stage) {
      'pending_sdo' => 'sdo',
      'pending_guidance' => 'guidance',
      'pending_pd' => 'pd',
      _ => null,
    };
  }

  // _friendlyStatusLabel: handles friendly status label for the Endorsement flow.
  String _friendlyStatusLabel(String status) {
    final normalized = status.toLowerCase();

    if (normalized.contains('pending sdo') || normalized == 'pending_sdo') {
      return 'Waiting for Student Discipline Office';
    }
    if (normalized.contains('pending guidance') ||
        normalized == 'pending_guidance') {
      return 'Waiting for Guidance and Counseling Office';
    }
    if (normalized.contains('pending program director') ||
        normalized == 'pending_pd') {
      return 'Waiting for Program Director';
    }
    if (normalized.contains('held')) return 'Guidance Review on Hold';
    if (normalized.contains('major')) return 'Stopped by Major Offense';
    if (normalized.contains('rejected')) return 'Endorsement Not Approved';
    if (normalized.contains('completed')) return 'Completed';

    return status;
  }

  // _friendlyDecisionLabel: handles friendly decision label for the Endorsement flow.
  String _friendlyDecisionLabel(String? decision) {
    final normalized = (decision ?? '').trim().toLowerCase();
    if (normalized.isEmpty) return 'Pending';
    if (normalized == 'no_offense' || normalized == 'cleared') {
      return 'No Disciplinary Offense';
    }
    if (normalized == 'minor_offense' || normalized == 'disqualified_minor') {
      return 'With Minor Offense/s';
    }
    if (normalized == 'major_offense' || normalized == 'disqualified_major') {
      return 'With Major Offense/s';
    }
    if (normalized == 'good_moral_standing') return 'Good Moral Standing';
    if (normalized == 'good_scholastic_standing') {
      return 'Good Scholastic Standing';
    }
    if (normalized == 'average_scholastic_standing') {
      return 'Average Scholastic Standing';
    }
    if (normalized == 'approved') return 'Approved';
    if (normalized == 'held') return 'Guidance Review on Hold';
    if (normalized == 'rejected') return 'Not Approved';

    return decision!
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  // _officeDisplayName: handles office display name for the Endorsement flow.
  String _officeDisplayName(String? office) {
    final text = office?.trim() ?? '';
    if (text.isEmpty) return 'Not assigned yet';
    final normalized = text.toLowerCase();
    if (normalized == 'sdo' || normalized.contains('discipline')) {
      return 'Student Discipline Office';
    }
    if (normalized == 'gco' || normalized.contains('guidance')) {
      return 'Guidance and Counseling Office';
    }
    if (normalized == 'pd' || normalized.contains('program director')) {
      return 'Program Director';
    }
    return text;
  }

  // _statusColor: handles status color for the Endorsement flow.
  Color _statusColor(BuildContext context, String status) {
    final scheme = Theme.of(context).colorScheme;
    final normalized = status.toLowerCase();

    if (normalized.contains('rejected') ||
        normalized.contains('major') ||
        normalized.contains('offense')) {
      return scheme.error;
    }
    if (normalized.contains('held') || normalized.contains('missing')) {
      return scheme.tertiary;
    }
    if (normalized.contains('completed') || normalized.contains('approved')) {
      return scheme.primary;
    }
    if (normalized.contains('pending') || normalized.contains('waiting')) {
      return AppColors.gold;
    }
    return scheme.onSurfaceVariant;
  }

  // _statusIcon: handles status icon for the Endorsement flow.
  IconData _statusIcon(String status) {
    final normalized = status.toLowerCase();
    if (normalized.contains('rejected') ||
        normalized.contains('major') ||
        normalized.contains('offense')) {
      return Icons.cancel_rounded;
    }
    if (normalized.contains('held')) return Icons.pause_circle_filled_rounded;
    if (normalized.contains('completed') || normalized.contains('approved')) {
      return Icons.check_circle_rounded;
    }
    return Icons.schedule_rounded;
  }

  // _formatDate: handles format date for the Endorsement flow.
  String _formatDate(DateTime? value) {
    if (value == null) return 'Not available';
    return DateFormat('MMM d, yyyy').format(value.toLocal());
  }

  // _nextActionMessage: handles next action message for the Endorsement flow.
  String _nextActionMessage(
    ApplicationWorkflowSummary workflow,
    EndorsementStateSummary endorsement,
  ) {
    final blocker = workflow.primaryBlocker;
    if (blocker?.source == 'endorsement') {
      return blocker!.message;
    }

    if (endorsement.currentOffice?.trim().isNotEmpty == true) {
      return 'Your endorsement is currently being reviewed by ${_officeDisplayName(endorsement.currentOffice)}.';
    }

    if (endorsement.status == 'completed') {
      return 'Your endorsement is complete. Check your full application status for the remaining scholarship steps.';
    }

    return 'Your endorsement is currently being processed.';
  }

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    final statusColors = AppStatusColors.of(context);
    final workflow = widget.summary.workflow;
    final endorsement = workflow?.endorsement;

    if (workflow == null || endorsement == null) {
      return _EndorsementMessageCard(
        icon: Icons.info_outline_rounded,
        title: 'Endorsement not available yet',
        message:
            'The endorsement workflow will appear here once your application enters office review.',
        primaryActionLabel: 'Open Application Status',
        onPrimaryAction: () => Navigator.pushNamed(context, AppRoutes.status),
      );
    }

    final statusColor = _statusColor(context, endorsement.statusLabel);
    final statusIcon = _statusIcon(endorsement.statusLabel);
    final slip = endorsement.slip;
    final blockerCode = workflow.primaryBlocker?.code ?? '';
    final friendlyStatus = _friendlyStatusLabel(endorsement.statusLabel);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _EndorsementHero(
          statusColor: statusColor,
          statusIcon: statusIcon,
          status: friendlyStatus,
          message: _nextActionMessage(workflow, endorsement),
          openingTitle: widget.summary.openingTitle,
        ),
        if (blockerCode == 'endorsement.grade_document_missing') ...[
          const SizedBox(height: AppSpacing.md),
          _EndorsementAlertCard(
            color: statusColors.actionRequiredOutline,
            icon: Icons.warning_amber_rounded,
            title: 'Grade Report Required',
            message:
                'Upload your current grades PDF in Documents before the Program Director can record your scholastic standing.',
            primaryLabel: 'Open Documents',
            actionIcon: Icons.upload_file_rounded,
            onPrimaryAction: () =>
                Navigator.pushNamed(context, AppRoutes.documents),
          ),
        ] else if (blockerCode == 'endorsement.held') ...[
          const SizedBox(height: AppSpacing.md),
          _EndorsementAlertCard(
            color: statusColors.actionRequiredOutline,
            icon: Icons.pause_circle_filled_rounded,
            title: 'Guidance Review on Hold',
            message:
                'Your endorsement is currently on hold in Guidance. Open your full application status to review the recorded remarks.',
            primaryLabel: 'View Application Status',
            actionIcon: Icons.fact_check_rounded,
            onPrimaryAction: () =>
                Navigator.pushNamed(context, AppRoutes.status),
          ),
        ] else if (blockerCode == 'endorsement.major_offense' ||
            blockerCode == 'endorsement.rejected') ...[
          const SizedBox(height: AppSpacing.md),
          _EndorsementAlertCard(
            color: statusColors.dangerOutline,
            icon: Icons.report_gmailerrorred_rounded,
            title: 'Endorsement Stopped',
            message:
                'The endorsement process cannot continue. Open your full application status to review the recorded outcome and remarks.',
            primaryLabel: 'View Application Status',
            actionIcon: Icons.fact_check_rounded,
            onPrimaryAction: () =>
                Navigator.pushNamed(context, AppRoutes.status),
          ),
        ] else if (workflow.stage == 'ready_for_activation') ...[
          const SizedBox(height: AppSpacing.md),
          _EndorsementAlertCard(
            color: statusColors.successOutline,
            icon: Icons.verified_rounded,
            title: 'Endorsement Complete',
            message:
                'All endorsement offices have completed their review. Check your full application status for the next scholarship step.',
            primaryLabel: 'View Application Status',
            actionIcon: Icons.fact_check_rounded,
            onPrimaryAction: () =>
                Navigator.pushNamed(context, AppRoutes.status),
          ),
        ] else if (workflow.stage == 'scholar_activated') ...[
          const SizedBox(height: AppSpacing.md),
          _EndorsementAlertCard(
            color: statusColors.successOutline,
            icon: Icons.celebration_rounded,
            title: 'Scholar Activated',
            message:
                'Your endorsement is complete and your scholar access is active.',
            primaryLabel: 'View Application Status',
            actionIcon: Icons.fact_check_rounded,
            onPrimaryAction: () =>
                Navigator.pushNamed(context, AppRoutes.status),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        const AppSectionHeading(
          title: 'Endorsement Progress',
          subtitle:
              'Follow your review from the Student Discipline Office to Guidance and Counseling, then the Program Director.',
        ),
        const SizedBox(height: AppSpacing.sm),
        _EndorsementProgressCard(
          currentStage: endorsement.currentStage,
          overallStatus: endorsement.status,
          officeReviews: workflow.officeReviews,
          expandedOffices: _expandedOffices,
          onToggleOffice: (officeKey) {
            setState(() {
              if (_expandedOffices.contains(officeKey)) {
                _expandedOffices.remove(officeKey);
              } else {
                _expandedOffices.add(officeKey);
              }
            });
          },
          decisionLabel: _friendlyDecisionLabel,
        ),
        const SizedBox(height: AppSpacing.lg),
        const AppSectionHeading(title: 'Endorsement Slip'),
        const SizedBox(height: AppSpacing.sm),
        _EndorsementSlipCard(
          slip: slip,
          completedAt: endorsement.completedAt ?? slip.completedAt,
          isDownloading: widget.isDownloadingSlip,
          onDownload: widget.onDownloadSlip,
          formatDate: _formatDate,
        ),
        const SizedBox(height: AppSpacing.md),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => Navigator.pushNamed(context, AppRoutes.status),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.xs,
                vertical: AppSpacing.sm,
              ),
              textStyle: const TextStyle(fontWeight: FontWeight.w800),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('View Full Application Status'),
                SizedBox(width: 5),
                Icon(Icons.arrow_forward_rounded, size: 18),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    );
  }
}

class _EndorsementHero extends StatelessWidget {
  const _EndorsementHero({
    required this.statusColor,
    required this.statusIcon,
    required this.status,
    required this.message,
    this.openingTitle,
  });

  final Color statusColor;
  final IconData statusIcon;
  final String status;
  final String message;
  final String? openingTitle;

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    final isDark = AppSurfacePalette.isDark(context);
    final titleColor = AppSurfacePalette.text(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.gold.withValues(alpha: isDark ? 0.20 : 0.17),
            AppSurfacePalette.surface(context),
          ],
        ),
        borderRadius: AppRadii.card,
        border: Border.all(
          color: AppColors.gold.withValues(alpha: isDark ? 0.42 : 0.30),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ENDORSEMENT STATUS',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: AppSurfacePalette.mutedText(context),
              fontWeight: FontWeight.w800,
              letterSpacing: 0.7,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(statusIcon, color: statusColor, size: 22),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  status,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: titleColor,
                    fontWeight: FontWeight.w900,
                    height: 1.18,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              height: 1.45,
              color: titleColor,
            ),
          ),
          if (openingTitle?.trim().isNotEmpty == true) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              openingTitle!.trim(),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppSurfacePalette.mutedText(context),
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EndorsementProgressCard extends StatelessWidget {
  const _EndorsementProgressCard({
    required this.currentStage,
    required this.overallStatus,
    required this.officeReviews,
    required this.expandedOffices,
    required this.onToggleOffice,
    required this.decisionLabel,
  });

  final String currentStage;
  final String overallStatus;
  final Map<String, OfficeReviewSummary> officeReviews;
  final Set<String> expandedOffices;
  final ValueChanged<String> onToggleOffice;
  final String Function(String? decision) decisionLabel;

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    const steps = <_EndorsementStepDefinition>[
      _EndorsementStepDefinition(
        officeKey: 'sdo',
        stageKey: 'pending_sdo',
        title: 'Student Discipline Office',
        icon: Icons.gavel_rounded,
      ),
      _EndorsementStepDefinition(
        officeKey: 'guidance',
        stageKey: 'pending_guidance',
        title: 'Guidance and Counseling Office',
        icon: Icons.psychology_outlined,
      ),
      _EndorsementStepDefinition(
        officeKey: 'pd',
        stageKey: 'pending_pd',
        title: 'Program Director',
        icon: Icons.school_outlined,
      ),
    ];

    return AppSurfaceCard(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.md,
      ),
      child: Column(
        children: [
          for (var index = 0; index < steps.length; index++)
            _EndorsementProgressStep(
              definition: steps[index],
              isLast: false,
              currentStage: currentStage,
              overallStatus: overallStatus,
              review: officeReviews[steps[index].officeKey],
              expanded: expandedOffices.contains(steps[index].officeKey),
              onToggle: () => onToggleOffice(steps[index].officeKey),
              decisionLabel: decisionLabel,
            ),
          const SizedBox(height: AppSpacing.xs),
          _CompletionStep(completed: overallStatus == 'completed'),
        ],
      ),
    );
  }
}

class _EndorsementStepDefinition {
  const _EndorsementStepDefinition({
    required this.officeKey,
    required this.stageKey,
    required this.title,
    required this.icon,
  });

  final String officeKey;
  final String stageKey;
  final String title;
  final IconData icon;
}

class _EndorsementProgressStep extends StatelessWidget {
  const _EndorsementProgressStep({
    required this.definition,
    required this.isLast,
    required this.currentStage,
    required this.overallStatus,
    required this.review,
    required this.expanded,
    required this.onToggle,
    required this.decisionLabel,
  });

  final _EndorsementStepDefinition definition;
  final bool isLast;
  final String currentStage;
  final String overallStatus;
  final OfficeReviewSummary? review;
  final bool expanded;
  final VoidCallback onToggle;
  final String Function(String? decision) decisionLabel;

  bool get _isCurrent =>
      currentStage == definition.stageKey && overallStatus != 'completed';

  bool get _isDone {
    if (overallStatus == 'completed') return true;
    return switch (definition.stageKey) {
      'pending_sdo' => currentStage != 'pending_sdo',
      'pending_guidance' =>
        currentStage == 'pending_pd' || currentStage == 'completed',
      'pending_pd' => currentStage == 'completed',
      _ => false,
    };
  }

  bool get _hasDetails =>
      review?.actedAt != null ||
      review?.actedByName?.trim().isNotEmpty == true ||
      review?.remarks?.trim().isNotEmpty == true;

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    final statusColors = AppStatusColors.of(context);
    final muted = AppSurfacePalette.mutedText(context);
    final activeColor = AppColors.gold;
    final doneColor = statusColors.successOutline;
    final nodeColor = _isDone
        ? doneColor
        : _isCurrent
        ? activeColor
        : AppSurfacePalette.outline(context);
    final decision = decisionLabel(review?.decision);

    final summaryText = _isDone
        ? (decision == 'Pending' ? 'Reviewed' : decision)
        : _isCurrent
        ? 'Currently under review'
        : 'Waiting';

    return Stack(
      children: [
        if (!isLast)
          Positioned(
            left: 17,
            top: 34,
            bottom: 0,
            child: Container(
              width: 2,
              decoration: BoxDecoration(
                color: (_isDone
                        ? doneColor
                        : AppSurfacePalette.outline(context))
                    .withValues(alpha: _isDone ? 0.75 : 0.55),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 36,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: nodeColor.withValues(
                    alpha: _isCurrent ? 0.18 : 0.11,
                  ),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: nodeColor,
                    width: _isCurrent ? 2 : 1.2,
                  ),
                ),
                child: Icon(
                  _isDone ? Icons.check_rounded : definition.icon,
                  size: 18,
                  color: nodeColor,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(
                  bottom: isLast ? AppSpacing.sm : AppSpacing.lg,
                ),
                child: Material(
                  color: _isCurrent
                      ? AppColors.gold.withValues(
                          alpha: AppSurfacePalette.isDark(context)
                              ? 0.12
                              : 0.08,
                        )
                      : Colors.transparent,
                  borderRadius: AppRadii.control,
                  child: InkWell(
                    borderRadius: AppRadii.control,
                    onTap: _hasDetails ? onToggle : null,
                    child: Padding(
                      padding: EdgeInsets.all(
                        _isCurrent ? AppSpacing.md : AppSpacing.sm,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  definition.title,
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(fontWeight: FontWeight.w900),
                                ),
                              ),
                              if (_isCurrent)
                                const _CompactStatusLabel(
                                  label: 'Current',
                                  color: AppColors.gold,
                                )
                              else if (_isDone)
                                _CompactStatusLabel(
                                  label: 'Done',
                                  color: doneColor,
                                )
                              else
                                _CompactStatusLabel(
                                  label: 'Waiting',
                                  color: muted,
                                ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            summaryText,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(
                                  color: _isCurrent
                                      ? AppSurfacePalette.text(context)
                                      : muted,
                                  fontWeight: _isDone || _isCurrent
                                      ? FontWeight.w700
                                      : FontWeight.w600,
                                  height: 1.35,
                                ),
                          ),
                          if (_hasDetails) ...[
                            const SizedBox(height: 5),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  expanded ? 'Hide details' : 'View details',
                                  style: Theme.of(context)
                                      .textTheme
                                      .labelSmall
                                      ?.copyWith(
                                        color: muted,
                                        fontWeight: FontWeight.w700,
                                      ),
                                ),
                                const SizedBox(width: 2),
                                AnimatedRotation(
                                  turns: expanded ? 0.5 : 0,
                                  duration: const Duration(milliseconds: 160),
                                  child: Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    size: 17,
                                    color: muted,
                                  ),
                                ),
                              ],
                            ),
                            AnimatedSize(
                              duration: const Duration(milliseconds: 170),
                              curve: Curves.easeOut,
                              child: expanded
                                  ? _OfficeReviewDetails(review: review!)
                                  : const SizedBox.shrink(),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _OfficeReviewDetails extends StatelessWidget {
  const _OfficeReviewDetails({required this.review});

  final OfficeReviewSummary review;

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    final muted = AppSurfacePalette.mutedText(context);

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppSurfacePalette.surfaceMuted(context),
        borderRadius: AppRadii.control,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (review.actedAt != null)
            _ReviewMetaRow(
              icon: Icons.calendar_today_outlined,
              text: DateFormat('MMM d, yyyy').format(review.actedAt!.toLocal()),
            ),
          if (review.actedByName?.trim().isNotEmpty == true)
            _ReviewMetaRow(
              icon: Icons.person_outline_rounded,
              text: 'Reviewed by ${review.actedByName!.trim()}',
            ),
          if (review.remarks?.trim().isNotEmpty == true) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Remarks',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: muted,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              review.remarks!.trim(),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ReviewMetaRow extends StatelessWidget {
  const _ReviewMetaRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 15,
            color: AppSurfacePalette.mutedText(context),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppSurfacePalette.mutedText(context),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CompletionStep extends StatelessWidget {
  const _CompletionStep({required this.completed});

  final bool completed;

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    final color = completed
        ? AppStatusColors.of(context).successOutline
        : AppSurfacePalette.outline(context);

    return Row(
      children: [
        SizedBox(
          width: 44,
          child: Center(
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.11),
                shape: BoxShape.circle,
                border: Border.all(color: color),
              ),
              child: Icon(
                completed ? Icons.verified_rounded : Icons.flag_outlined,
                size: 18,
                color: color,
              ),
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Endorsement Complete',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  completed
                      ? 'All required office reviews are complete.'
                      : 'This will be completed after the Program Director review.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppSurfacePalette.mutedText(context),
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CompactStatusLabel extends StatelessWidget {
  const _CompactStatusLabel({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: AppRadii.status,
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 10.5,
        ),
      ),
    );
  }
}

class _EndorsementSlipCard extends StatelessWidget {
  const _EndorsementSlipCard({
    required this.slip,
    required this.completedAt,
    required this.isDownloading,
    required this.onDownload,
    required this.formatDate,
  });

  final EndorsementSlipSummary slip;
  final DateTime? completedAt;
  final bool isDownloading;
  final VoidCallback onDownload;
  final String Function(DateTime? value) formatDate;

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    if (!slip.available) {
      return AppSurfaceCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const AppIconTile(icon: Icons.description_outlined),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Not available yet',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Your downloadable endorsement slip will become available after all office reviews are completed.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppSurfacePalette.mutedText(context),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return AppSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const AppIconTile(icon: Icons.description_rounded),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  'Ready to download',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _CompactStatusLabel(
                label: 'Complete',
                color: AppStatusColors.of(context).successOutline,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          _SlipDetailRow(label: 'Completed', value: formatDate(completedAt)),
          if (slip.slipCode?.trim().isNotEmpty == true)
            _SlipDetailRow(
              label: 'Reference No.',
              value: slip.slipCode!.trim(),
            ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: isDownloading ? null : onDownload,
              icon: isDownloading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.download_rounded),
              label: Text(
                isDownloading ? 'Downloading...' : 'Download Endorsement Slip',
              ),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                shape: RoundedRectangleBorder(borderRadius: AppRadii.control),
                elevation: 0,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SlipDetailRow extends StatelessWidget {
  const _SlipDetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 330;
          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: AppSurfacePalette.mutedText(context),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                SelectableText(
                  value,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 108,
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppSurfacePalette.mutedText(context),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: SelectableText(
                  value,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _EndorsementAlertCard extends StatelessWidget {
  const _EndorsementAlertCard({
    required this.color,
    required this.icon,
    required this.title,
    required this.message,
    required this.primaryLabel,
    required this.actionIcon,
    required this.onPrimaryAction,
  });

  final Color color;
  final IconData icon;
  final String title;
  final String message;
  final String primaryLabel;
  final IconData actionIcon;
  final VoidCallback onPrimaryAction;

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    return AppSurfaceCard(
      backgroundColor: color.withValues(alpha: 0.07),
      borderColor: color.withValues(alpha: 0.28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: color),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.4),
          ),
          const SizedBox(height: AppSpacing.md),
          OutlinedButton.icon(
            onPressed: onPrimaryAction,
            icon: Icon(actionIcon, size: 18),
            label: Text(primaryLabel),
          ),
        ],
      ),
    );
  }
}

class _EndorsementMessageCard extends StatelessWidget {
  const _EndorsementMessageCard({
    required this.icon,
    required this.title,
    required this.message,
    required this.primaryActionLabel,
    required this.onPrimaryAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String primaryActionLabel;
  final VoidCallback onPrimaryAction;

  @override
  // build: builds build for the Endorsement flow.
  Widget build(BuildContext context) {
    return AppSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppIconTile(icon: icon),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.45),
          ),
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onPrimaryAction,
              child: Text(primaryActionLabel),
            ),
          ),
        ],
      ),
    );
  }
}
