// SMaRT-PDM: status tracking screen — status tracking screen (mobile screen); loads state, handles user actions, and renders the screen.
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

// SMART-PDM_STATUS_POLISH_PHASE_1_1
class StatusTrackingScreen extends StatefulWidget {
  const StatusTrackingScreen({super.key});

  @override
  // createState: creates create state for the status tracking screen flow.
  State<StatusTrackingScreen> createState() => _StatusTrackingScreenState();
}

class _StatusTrackingScreenState extends State<StatusTrackingScreen> {
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
  // initState: handles init state for the status tracking screen flow.
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
  // didChangeDependencies: handles did change dependencies for the status tracking screen flow.
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (_notificationProvider == provider) return;

    _notificationProvider?.removeListener(_handleNotificationProviderChange);
    _notificationProvider = provider;
    _lastScholarAccessRevision = provider.scholarAccessRevision;
    _lastApplicationRevision = provider.applicationRevision;
    provider.addListener(_handleNotificationProviderChange);
  }

  // _handleNotificationProviderChange: handles handle notification provider change for the status tracking screen flow.
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

  // _loadStatus: handles load status for the status tracking screen flow.
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

  // _requestLiveRefresh: handles request live refresh for the status tracking screen flow.
  void _requestLiveRefresh() {
    if (!mounted) return;
    if (_fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }
    _loadStatus(silent: true);
  }

  // _downloadEndorsementSlip: handles download endorsement slip for the status tracking screen flow.
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
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    final baseTheme = Theme.of(context);
    final contentTheme = baseTheme.copyWith(
      textTheme: baseTheme.textTheme.apply(
        bodyColor: baseTheme.colorScheme.onSurface,
        displayColor: baseTheme.colorScheme.onSurface,
      ),
      cardTheme: baseTheme.cardTheme.copyWith(
        color: baseTheme.colorScheme.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.card,
          side: BorderSide(color: baseTheme.colorScheme.outlineVariant),
        ),
      ),
    );

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Application Status'),
        backgroundColor: AppSurfacePalette.surface(context),
        foregroundColor: AppSurfacePalette.text(context),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      selectedIndex: 0,
      child: Theme(
        data: contentTheme,
        child: RefreshIndicator(
          onRefresh: () => _loadStatus(),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 112),
            children: [
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.only(top: 64),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_errorMessage != null)
                _StatusMessageCard(
                  icon: Icons.cloud_off_rounded,
                  title: 'Unable to load application status',
                  message: _errorMessage!,
                  primaryActionLabel: 'Try Again',
                  onPrimaryAction: () => _loadStatus(),
                )
              else if (_summary == null || _summary!.hasApplication == false)
                _StatusMessageCard(
                  icon: Icons.assignment_late_outlined,
                  title: 'No application status yet',
                  message:
                      'You have not submitted a scholarship application yet, so there is no application status to track.',
                  primaryActionLabel: 'View Scholarship Openings',
                  onPrimaryAction: () => Navigator.pushNamed(
                    context,
                    AppRoutes.scholarshipOpenings,
                  ),
                )
              else
                _StatusSummaryView(
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

  @override
  // dispose: handles dispose for the status tracking screen flow.
  void dispose() {
    _pollingTimer?.cancel();
    _notificationProvider?.removeListener(_handleNotificationProviderChange);
    super.dispose();
  }
}

class _StatusSummaryView extends StatelessWidget {
  const _StatusSummaryView({
    required this.summary,
    required this.isDownloadingSlip,
    required this.onDownloadSlip,
  });

  final ApplicationStatusSummary summary;
  final bool isDownloadingSlip;
  final VoidCallback onDownloadSlip;

  // _statusColor: handles status color for the status tracking screen flow.
  Color _statusColor(BuildContext context, String status) {
    final colors = AppStatusColors.of(context);
    final normalized = status.toLowerCase();

    if (normalized.contains('rejected') ||
        normalized.contains('major') ||
        normalized.contains('offense')) {
      return colors.dangerOutline;
    }
    if (normalized.contains('held') ||
        normalized.contains('reupload') ||
        normalized.contains('missing')) {
      return colors.actionRequiredOutline;
    }
    if (normalized.contains('verified') ||
        normalized.contains('completed') ||
        normalized.contains('activated') ||
        normalized.contains('approved')) {
      return colors.successOutline;
    }
    if (normalized.contains('ready') ||
        normalized.contains('review') ||
        normalized.contains('submitted') ||
        normalized.contains('processing')) {
      return colors.inProgressOutline;
    }
    return colors.neutralOutline;
  }

  // _statusIcon: handles status icon for the status tracking screen flow.
  IconData _statusIcon(String status) {
    final normalized = status.toLowerCase();
    if (normalized.contains('rejected') ||
        normalized.contains('major') ||
        normalized.contains('offense')) {
      return Icons.cancel_rounded;
    }
    if (normalized.contains('held')) return Icons.pause_circle_filled_rounded;
    if (normalized.contains('missing') || normalized.contains('reupload')) {
      return Icons.upload_file_rounded;
    }
    if (normalized.contains('verified') ||
        normalized.contains('completed') ||
        normalized.contains('activated') ||
        normalized.contains('approved')) {
      return Icons.check_circle_rounded;
    }
    if (normalized.contains('ready')) return Icons.verified_user_rounded;
    return Icons.access_time_rounded;
  }

  // _formatDate: handles format date for the status tracking screen flow.
  String _formatDate(DateTime? value) {
    if (value == null) return 'Not available';
    return DateFormat('MMM d, yyyy').format(value.toLocal());
  }

  // _programTitle: handles program title for the status tracking screen flow.
  String _programTitle() {
    if (summary.programName?.trim().isNotEmpty == true) {
      return summary.programName!.trim();
    }
    if (summary.openingTitle?.trim().isNotEmpty == true) {
      return summary.openingTitle!.trim();
    }
    return 'Scholarship Application';
  }

  // _statusDescription: handles status description for the status tracking screen flow.
  String _statusDescription() {
    final workflow = summary.workflow;
    if (workflow?.primaryBlocker != null) {
      return workflow!.primaryBlocker!.message;
    }
    if (workflow?.stage == 'scholar_activated') {
      return 'Your application flow is complete and scholar access is enabled.';
    }
    if (workflow?.stage == 'selected_for_activation' ||
        workflow?.stage == 'ready_for_activation') {
      return 'You were selected. Scholar activation is being completed by OSFA.';
    }
    if (workflow?.stage == 'ready_for_selection') {
      return 'Requirements and endorsement are complete. Your application is waiting for the final selection list.';
    }
    if (workflow?.endorsement.currentOffice?.trim().isNotEmpty == true) {
      return 'Your endorsement is currently being processed by ${workflow!.endorsement.currentOffice}.';
    }
    return 'Your scholarship application is currently being processed.';
  }

  // _nextStepTitle: handles next step title for the status tracking screen flow.
  String _nextStepTitle() {
    final workflow = summary.workflow;
    final blockerCode = workflow?.primaryBlocker?.code ?? '';

    if (blockerCode == 'requirements.missing') {
      return 'Upload the missing requirements';
    }
    if (blockerCode == 'requirements.reupload_required') {
      return 'Re-upload the flagged requirements';
    }
    if (blockerCode == 'endorsement.grade_document_missing') {
      return 'Upload your current grades PDF';
    }
    if (blockerCode == 'endorsement.held') {
      return 'Review the Guidance hold';
    }
    if (blockerCode == 'endorsement.major_offense' ||
        blockerCode == 'endorsement.rejected' ||
        blockerCode == 'requirements.rejected') {
      return 'Review the recorded issue';
    }
    if (workflow?.stage == 'ready_for_selection') {
      return 'Wait for final selection';
    }
    if (workflow?.stage == 'waitlisted') {
      return 'Wait for slot availability';
    }
    if (workflow?.stage == 'not_selected') {
      return 'Review your application result';
    }
    if (workflow?.stage == 'selected_for_activation' ||
        workflow?.stage == 'ready_for_activation') {
      return 'Wait for scholar activation';
    }
    if (workflow?.stage == 'scholar_activated') {
      return 'Scholar access is active';
    }
    if (workflow?.endorsement.currentOffice?.trim().isNotEmpty == true) {
      return 'Wait for ${workflow!.endorsement.currentOffice} review';
    }
    return 'Monitor your application';
  }

  // _nextStepMessage: handles next step message for the status tracking screen flow.
  String _nextStepMessage() {
    final workflow = summary.workflow;
    final blocker = workflow?.primaryBlocker;
    if (blocker != null) return blocker.message;

    if (workflow?.stage == 'ready_for_selection') {
      return 'No additional action is required from you right now. Your application is waiting for the final selection list.';
    }
    if (workflow?.stage == 'waitlisted') {
      return 'You are on the finalized waiting list. Keep monitoring for a scholarship slot or an OSFA update.';
    }
    if (workflow?.stage == 'not_selected') {
      return 'This application period is complete for your application. You may apply again in a future eligible period.';
    }
    if (workflow?.stage == 'selected_for_activation' ||
        workflow?.stage == 'ready_for_activation') {
      return 'No additional action is required from you right now. OSFA is completing scholar activation.';
    }
    if (workflow?.stage == 'scholar_activated') {
      return 'Your application flow is complete and your scholar access is already enabled.';
    }
    if (workflow?.endorsement.currentOffice?.trim().isNotEmpty == true) {
      return 'No action is required while your endorsement is waiting in ${workflow!.endorsement.currentOffice}. Keep checking this page for updates.';
    }
    return 'Keep your submitted information updated and monitor this page for the next movement in your application.';
  }

  _NextAction? _nextAction(BuildContext context) {
    final workflow = summary.workflow;
    if (workflow == null) return null;
    final blockerCode = workflow.primaryBlocker?.code ?? '';

    if (blockerCode == 'requirements.missing' ||
        blockerCode == 'requirements.reupload_required' ||
        blockerCode == 'endorsement.grade_document_missing') {
      return _NextAction(
        label: 'Open Documents',
        icon: Icons.upload_file_rounded,
        onTap: () => Navigator.pushNamed(context, AppRoutes.documents),
      );
    }

    if (blockerCode == 'endorsement.held' ||
        blockerCode == 'endorsement.major_offense' ||
        blockerCode == 'endorsement.rejected' ||
        blockerCode == 'requirements.rejected') {
      return _NextAction(
        label: 'Review Endorsement',
        icon: Icons.verified_user_outlined,
        onTap: () => Navigator.pushNamed(context, AppRoutes.endorsement),
      );
    }

    if (workflow.stage == 'scholar_activated') {
      return _NextAction(
        label: 'Go to Dashboard',
        icon: Icons.home_rounded,
        onTap: () => Navigator.pushNamed(context, AppRoutes.home),
      );
    }

    return null;
  }

  // _fallbackStage: handles fallback stage for the status tracking screen flow.
  String _fallbackStage() {
    final appStatus = (summary.applicationStatus ?? '').toLowerCase();
    final documentStatus = (summary.documentStatus ?? '').toLowerCase();

    if (appStatus == 'approved') return 'scholar_activated';
    if (documentStatus.contains('missing') ||
        documentStatus.contains('under review')) {
      return 'requirements_review';
    }
    if (documentStatus.contains('ready')) return 'endorsement_review';
    return 'application_submitted';
  }

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    final workflow = summary.workflow;
    final stageLabel =
        workflow?.stageLabel ?? summary.applicationStatus ?? 'Pending Review';
    final statusColor = _statusColor(context, stageLabel);
    final nextAction = _nextAction(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _CurrentStatusHero(
          stageLabel: stageLabel,
          program: _programTitle(),
          description: _statusDescription(),
          statusColor: statusColor,
          statusIcon: _statusIcon(stageLabel),
        ),
        const SizedBox(height: 18),
        _VerticalWorkflowTracker(
          activeStage: workflow?.stage ?? _fallbackStage(),
          blockerCode: workflow?.primaryBlocker?.code,
        ),
        const SizedBox(height: 18),
        _NextStepCard(
          title: _nextStepTitle(),
          message: _nextStepMessage(),
          color: statusColor,
          icon: _statusIcon(stageLabel),
          action: nextAction,
        ),
        const SizedBox(height: 22),
        const _SectionHeading(
          title: 'Application Details',
          subtitle: 'Your submitted scholarship information at a glance.',
        ),
        const SizedBox(height: 10),
        _ApplicationDetailsCard(
          program: _programTitle(),
          submitted: _formatDate(summary.submissionDate),
          applicationStatus: summary.applicationStatus ?? 'Pending Review',
          documentStatus: summary.documentStatus ?? 'Missing Docs',
          applicationId: summary.applicationId,
        ),
        if (workflow != null) ...[
          const SizedBox(height: 22),
          const _SectionHeading(
            title: 'Readiness Overview',
            subtitle:
                'These checks must be completed before scholar activation.',
          ),
          const SizedBox(height: 10),
          _ReadinessTimeline(
            requirements: workflow.requirements,
            endorsement: workflow.endorsement,
            activation: workflow.scholarActivation,
            statusColor: (status) => _statusColor(context, status),
            statusIcon: _statusIcon,
            formatDate: _formatDate,
          ),
          const SizedBox(height: 18),
          _EndorsementSlipCard(
            endorsement: workflow.endorsement,
            isDownloadingSlip: isDownloadingSlip,
            onDownloadSlip: onDownloadSlip,
            formatDate: _formatDate,
            statusColor: _statusColor(context, workflow.endorsement.status),
          ),
          const SizedBox(height: 22),
          const _SectionHeading(
            title: 'Office Reviews',
            subtitle:
                'Open an office only when you need its decision, remarks, or review details.',
          ),
          const SizedBox(height: 10),
          _OfficeReviewList(reviews: workflow.officeReviews),
        ],
      ],
    );
  }
}

class _CurrentStatusHero extends StatelessWidget {
  const _CurrentStatusHero({
    required this.stageLabel,
    required this.program,
    required this.description,
    required this.statusColor,
    required this.statusIcon,
  });

  final String stageLabel;
  final String program;
  final String description;
  final Color statusColor;
  final IconData statusIcon;

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final bodyColor = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.brown.withValues(alpha: .78);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? const [Color(0xFF3A291D), Color(0xFF21160F)]
              : const [Color(0xFFFFF2C8), Color(0xFFFFFBF4)],
        ),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: AppColors.gold.withValues(alpha: isDark ? .34 : .48),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: .12),
              borderRadius: BorderRadius.circular(15),
              border: Border.all(color: statusColor.withValues(alpha: .28)),
            ),
            child: Icon(statusIcon, color: statusColor, size: 25),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'CURRENT STATUS',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: bodyColor,
                    fontWeight: FontWeight.w900,
                    letterSpacing: .7,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  stageLabel,
                  softWrap: true,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: titleColor,
                    fontWeight: FontWeight.w900,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  program,
                  softWrap: true,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: titleColor.withValues(alpha: .88),
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  description,
                  softWrap: true,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: bodyColor,
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
}

class _VerticalWorkflowTracker extends StatelessWidget {
  const _VerticalWorkflowTracker({required this.activeStage, this.blockerCode});

  final String activeStage;
  final String? blockerCode;

  static const _steps = [
    _WorkflowStep(
      key: 'application_submitted',
      label: 'Application Submitted',
      subtitle: 'Your scholarship application has been submitted.',
      icon: Icons.assignment_turned_in_outlined,
    ),
    _WorkflowStep(
      key: 'requirements_review',
      label: 'Requirements Review',
      subtitle: 'OSFA checks your uploaded requirements.',
      icon: Icons.fact_check_outlined,
    ),
    _WorkflowStep(
      key: 'endorsement_review',
      label: 'Endorsement Review',
      subtitle: 'SDO, Guidance, and the Program Director complete review.',
      icon: Icons.groups_2_outlined,
    ),
    _WorkflowStep(
      key: 'ready_for_selection',
      label: 'Selection & Activation',
      subtitle:
          'Final selection is resolved before scholar access is activated.',
      icon: Icons.workspace_premium_outlined,
    ),
  ];

  bool get _isStopped =>
      blockerCode == 'requirements.rejected' ||
      blockerCode == 'endorsement.major_offense' ||
      blockerCode == 'endorsement.rejected';

  bool get _isHeld =>
      blockerCode == 'endorsement.held' ||
      blockerCode == 'requirements.reupload_required' ||
      blockerCode == 'requirements.missing';

  // _activeIndex: handles active index for the status tracking screen flow.
  int _activeIndex() {
    if (const {
      'ready_for_selection',
      'waitlisted',
      'not_selected',
      'selected_for_activation',
      'ready_for_activation',
      'scholar_activated',
    }.contains(activeStage)) {
      return 3;
    }
    final index = _steps.indexWhere((step) => step.key == activeStage);
    return index < 0 ? 0 : index;
  }

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    final colors = AppStatusColors.of(context);
    final activeColor = _isStopped
        ? colors.dangerOutline
        : _isHeld
        ? colors.actionRequiredOutline
        : colors.inProgressOutline;
    final activeIndex = _activeIndex();
    final activated = activeStage == 'scholar_activated';

    return AppSurfaceCard(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Application Progress',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 6),
          Text(
            'Follow the application from submission through scholar activation.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 18),
          for (var i = 0; i < _steps.length; i++)
            _VerticalWorkflowStep(
              step: _steps[i],
              isComplete: activated || i < activeIndex,
              isActive: !activated && i == activeIndex,
              isLast: i == _steps.length - 1,
              activeColor: activeColor,
            ),
        ],
      ),
    );
  }
}

class _WorkflowStep {
  const _WorkflowStep({
    required this.key,
    required this.label,
    required this.subtitle,
    required this.icon,
  });

  final String key;
  final String label;
  final String subtitle;
  final IconData icon;
}

class _VerticalWorkflowStep extends StatelessWidget {
  const _VerticalWorkflowStep({
    required this.step,
    required this.isComplete,
    required this.isActive,
    required this.isLast,
    required this.activeColor,
  });

  final _WorkflowStep step;
  final bool isComplete;
  final bool isActive;
  final bool isLast;
  final Color activeColor;

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    final colors = AppStatusColors.of(context);
    final scheme = Theme.of(context).colorScheme;
    final color = isComplete
        ? colors.successOutline
        : isActive
        ? activeColor
        : colors.neutralOutline;
    final background = isComplete
        ? colors.successContainer
        : isActive
        ? activeColor.withValues(alpha: .11)
        : colors.neutralContainer;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 40,
            child: Column(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: background,
                    shape: BoxShape.circle,
                    border: Border.all(color: color, width: isActive ? 2 : 1),
                  ),
                  child: Icon(
                    isComplete ? Icons.check_rounded : step.icon,
                    size: 18,
                    color: color,
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 5),
                      color: isComplete
                          ? colors.successOutline
                          : scheme.outlineVariant,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          step.label,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                color: isActive
                                    ? activeColor
                                    : scheme.onSurface,
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                      if (isActive)
                        _ShortStatusBadge(label: 'CURRENT', color: activeColor)
                      else if (isComplete)
                        _ShortStatusBadge(
                          label: 'DONE',
                          color: colors.successOutline,
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    step.subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: scheme.onSurfaceVariant,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _NextAction {
  const _NextAction({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
}

class _NextStepCard extends StatelessWidget {
  const _NextStepCard({
    required this.title,
    required this.message,
    required this.color,
    required this.icon,
    this.action,
  });

  final String title;
  final String message;
  final Color color;
  final IconData icon;
  final _NextAction? action;

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return AppSurfaceCard(
      borderColor: color.withValues(alpha: .34),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: .11),
                  borderRadius: AppRadii.control,
                ),
                child: Icon(icon, color: color, size: 21),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'WHAT HAPPENS NEXT',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: scheme.onSurfaceVariant,
                        fontWeight: FontWeight.w900,
                        letterSpacing: .55,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: scheme.onSurfaceVariant,
              height: 1.4,
            ),
          ),
          if (action != null) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: action!.onTap,
                icon: Icon(action!.icon),
                label: Text(
                  action!.label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  softWrap: true,
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(52),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ApplicationDetailsCard extends StatefulWidget {
  const _ApplicationDetailsCard({
    required this.program,
    required this.submitted,
    required this.applicationStatus,
    required this.documentStatus,
    this.applicationId,
  });

  final String program;
  final String submitted;
  final String applicationStatus;
  final String documentStatus;
  final String? applicationId;

  @override
  // createState: creates create state for the status tracking screen flow.
  State<_ApplicationDetailsCard> createState() =>
      _ApplicationDetailsCardState();
}

class _ApplicationDetailsCardState extends State<_ApplicationDetailsCard> {
  bool _showMore = false;

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    final hasApplicationId = widget.applicationId?.trim().isNotEmpty == true;

    return AppSurfaceCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _StatusDetailRow(label: 'Program', value: widget.program),
                _StatusDetailRow(label: 'Submitted', value: widget.submitted),
                _StatusDetailRow(
                  label: 'Application Status',
                  value: widget.applicationStatus,
                ),
                _StatusDetailRow(
                  label: 'Document Status',
                  value: widget.documentStatus,
                ),
              ],
            ),
          ),
          if (hasApplicationId) ...[
            InkWell(
              onTap: () => setState(() => _showMore = !_showMore),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 12, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        _showMore ? 'Show less' : 'Show more',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppSurfacePalette.mutedText(context),
                          letterSpacing: 0.15,
                        ),
                      ),
                    ),
                    AnimatedRotation(
                      turns: _showMore ? 0.5 : 0,
                      duration: const Duration(milliseconds: 160),
                      child: Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 18,
                        color: AppSurfacePalette.mutedText(context),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 160),
              curve: Curves.easeOut,
              child: _showMore
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                      child: _StatusDetailRow(
                        label: 'Application ID',
                        value: widget.applicationId!.trim(),
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ],
      ),
    );
  }
}

class _ReadinessTimeline extends StatelessWidget {
  const _ReadinessTimeline({
    required this.requirements,
    required this.endorsement,
    required this.activation,
    required this.statusColor,
    required this.statusIcon,
    required this.formatDate,
  });

  final WorkflowStateSummary requirements;
  final EndorsementStateSummary endorsement;
  final WorkflowStateSummary activation;
  final Color Function(String status) statusColor;
  final IconData Function(String status) statusIcon;
  final String Function(DateTime? value) formatDate;

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    return AppSurfaceCard(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
      child: Column(
        children: [
          _ReadinessStep(
            title: 'Requirements',
            status: requirements.statusLabel,
            remarks: requirements.remarks,
            color: statusColor(requirements.status),
            icon: statusIcon(requirements.status),
            isLast: false,
          ),
          _ReadinessStep(
            title: 'Endorsement',
            status: endorsement.statusLabel,
            subtitle: endorsement.currentOffice?.trim().isNotEmpty == true
                ? 'Current office: ${endorsement.currentOffice}'
                : null,
            remarks: endorsement.remarks,
            color: statusColor(endorsement.status),
            icon: statusIcon(endorsement.status),
            isLast: false,
          ),
          _ReadinessStep(
            title: 'Scholar Activation',
            status: activation.statusLabel,
            subtitle: activation.activatedAt == null
                ? null
                : 'Activated: ${formatDate(activation.activatedAt)}',
            remarks: activation.remarks,
            color: statusColor(activation.status),
            icon: statusIcon(activation.status),
            isLast: true,
          ),
        ],
      ),
    );
  }
}

class _ReadinessStep extends StatelessWidget {
  const _ReadinessStep({
    required this.title,
    required this.status,
    required this.color,
    required this.icon,
    required this.isLast,
    this.subtitle,
    this.remarks,
  });

  final String title;
  final String status;
  final String? subtitle;
  final String? remarks;
  final Color color;
  final IconData icon;
  final bool isLast;

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 40,
            child: Column(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: .11),
                    borderRadius: AppRadii.control,
                  ),
                  child: Icon(icon, color: color, size: 19),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 5),
                      color: color.withValues(alpha: .25),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  _AdaptiveStatusLabel(label: status, color: color),
                  if (subtitle?.trim().isNotEmpty == true) ...[
                    const SizedBox(height: 6),
                    Text(
                      subtitle!.trim(),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  if (remarks?.trim().isNotEmpty == true) ...[
                    const SizedBox(height: 6),
                    Text(
                      remarks!.trim(),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        height: 1.35,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EndorsementSlipCard extends StatelessWidget {
  const _EndorsementSlipCard({
    required this.endorsement,
    required this.isDownloadingSlip,
    required this.onDownloadSlip,
    required this.formatDate,
    required this.statusColor,
  });

  final EndorsementStateSummary endorsement;
  final bool isDownloadingSlip;
  final VoidCallback onDownloadSlip;
  final String Function(DateTime?) formatDate;
  final Color statusColor;

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    final slip = endorsement.slip;

    if (!slip.available) {
      return AppSurfaceCard(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppIconTile(icon: Icons.description_outlined, accent: statusColor),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Endorsement Slip',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Not available yet',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Your printable endorsement slip becomes available after all required endorsement offices finish their review.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      height: 1.35,
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
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppIconTile(
                icon: Icons.picture_as_pdf_rounded,
                accent: statusColor,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Endorsement Slip',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Ready to download',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (slip.slipCode?.trim().isNotEmpty == true)
            _StatusDetailRow(label: 'Slip Code', value: slip.slipCode!.trim()),
          _StatusDetailRow(
            label: 'Completed',
            value: formatDate(endorsement.completedAt ?? slip.completedAt),
          ),
          const SizedBox(height: 4),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: isDownloadingSlip ? null : onDownloadSlip,
              icon: isDownloadingSlip
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.download_rounded),
              label: Text(
                isDownloadingSlip
                    ? 'Downloading...'
                    : 'Download Endorsement Slip',
                textAlign: TextAlign.center,
                maxLines: 2,
                softWrap: true,
              ),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OfficeReviewList extends StatelessWidget {
  const _OfficeReviewList({required this.reviews});

  final Map<String, OfficeReviewSummary> reviews;

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    return AppSurfaceCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          _OfficeReviewTile(label: 'SDO', review: reviews['sdo']),
          const Divider(height: 1),
          _OfficeReviewTile(label: 'Guidance', review: reviews['guidance']),
          const Divider(height: 1),
          _OfficeReviewTile(label: 'Program Director', review: reviews['pd']),
        ],
      ),
    );
  }
}

class _OfficeReviewTile extends StatelessWidget {
  const _OfficeReviewTile({required this.label, required this.review});

  final String label;
  final OfficeReviewSummary? review;

  // _formatDecision: handles format decision for the status tracking screen flow.
  String _formatDecision() {
    final decision = review?.decision;
    if (decision == null || decision.trim().isEmpty) return 'Pending';
    final normalized = decision.trim().toLowerCase();
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
    if (normalized == 'approved') {
      return 'Legacy Approved — Standing Not Recorded';
    }
    if (normalized == 'held') return 'Legacy Guidance Hold';
    if (normalized == 'rejected') return 'Legacy Rejected';
    return decision
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  // _decisionColor: handles decision color for the status tracking screen flow.
  Color _decisionColor(BuildContext context) {
    final colors = AppStatusColors.of(context);
    final normalized = (review?.decision ?? '').toLowerCase();
    if (normalized.contains('reject') || normalized.contains('major')) {
      return colors.dangerOutline;
    }
    if (normalized.contains('hold') || normalized.contains('minor')) {
      return colors.actionRequiredOutline;
    }
    if (normalized == 'no_offense' ||
        normalized == 'cleared' ||
        normalized == 'good_moral_standing' ||
        normalized == 'good_scholastic_standing' ||
        normalized == 'average_scholastic_standing' ||
        normalized == 'approved') {
      return colors.successOutline;
    }
    return colors.neutralOutline;
  }

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    final decision = _formatDecision();
    final color = _decisionColor(context);
    final actedAt = review?.actedAt;
    final actedByName = review?.actedByName;
    final remarks = review?.remarks;
    final hasDetails =
        actedAt != null ||
        actedByName?.trim().isNotEmpty == true ||
        remarks?.trim().isNotEmpty == true;

    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        initiallyExpanded: false,
        maintainState: true,
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
        leading: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: color.withValues(alpha: .10),
            borderRadius: AppRadii.control,
          ),
          child: Icon(
            decision == 'Pending'
                ? Icons.access_time_rounded
                : Icons.check_rounded,
            color: color,
            size: 20,
          ),
        ),
        title: Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(
            decision,
            softWrap: true,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        children: [
          if (!hasDetails)
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                decision == 'Pending'
                    ? 'No office decision has been recorded yet.'
                    : 'No additional review details were provided.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          if (actedAt != null)
            _StatusDetailRow(
              label: 'Reviewed',
              value: DateFormat('MMM d, yyyy').format(actedAt.toLocal()),
            ),
          if (actedByName?.trim().isNotEmpty == true)
            _StatusDetailRow(label: 'Handled by', value: actedByName!.trim()),
          if (remarks?.trim().isNotEmpty == true) ...[
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Remarks',
                style: Theme.of(
                  context,
                ).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(height: 5),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                remarks!.trim(),
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(height: 1.4),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AdaptiveStatusLabel extends StatelessWidget {
  const _AdaptiveStatusLabel({required this.label, required this.color});

  final String label;
  final Color color;

  bool get _canUseCapsule {
    final text = label.trim();
    final wordCount = text.isEmpty ? 0 : text.split(RegExp(r'\s+')).length;
    return text.length <= 18 && wordCount <= 3;
  }

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    if (_canUseCapsule) {
      return Align(
        alignment: Alignment.centerLeft,
        child: _ShortStatusBadge(label: label, color: color),
      );
    }

    return Text(
      label,
      softWrap: true,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
        color: color,
        fontWeight: FontWeight.w800,
        height: 1.3,
      ),
    );
  }
}

class _ShortStatusBadge extends StatelessWidget {
  const _ShortStatusBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .10),
        borderRadius: AppRadii.status,
        border: Border.all(color: color.withValues(alpha: .28)),
      ),
      child: Text(
        label.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w900,
          letterSpacing: .3,
        ),
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurface,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            height: 1.35,
          ),
        ),
      ],
    );
  }
}

class _StatusDetailRow extends StatelessWidget {
  const _StatusDetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 350;
        if (compact) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(value, softWrap: true),
              ],
            ),
          );
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 128,
                child: Text(
                  label,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(value, softWrap: true)),
            ],
          ),
        );
      },
    );
  }
}

class _StatusMessageCard extends StatelessWidget {
  const _StatusMessageCard({
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
  // build: builds build for the status tracking screen flow.
  Widget build(BuildContext context) {
    return AppSurfaceCard(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppIconTile(icon: icon),
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          Text(
            message,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(height: 1.45),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onPrimaryAction,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
              ),
              child: Text(
                primaryActionLabel,
                textAlign: TextAlign.center,
                maxLines: 2,
                softWrap: true,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
