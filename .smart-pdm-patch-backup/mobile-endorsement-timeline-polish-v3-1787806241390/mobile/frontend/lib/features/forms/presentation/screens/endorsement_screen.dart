import 'dart:async';

import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/core/files/downloaded_file_handler.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class EndorsementScreen extends StatefulWidget {
  const EndorsementScreen({super.key});

  @override
  State<EndorsementScreen> createState() => _EndorsementScreenState();
}

class _EndorsementScreenState extends State<EndorsementScreen> {
  final ApplicationService _applicationService = ApplicationService();

  ApplicationStatusSummary? _summary;
  bool _isLoading = true;
  bool _isRefreshingStatus = false;
  bool _isViewingSlip = false;
  bool _isDownloadingSlip = false;
  String? _errorMessage;
  NotificationProvider? _notificationProvider;
  int _lastScholarAccessRevision = 0;
  int _lastApplicationRevision = 0;
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _loadStatus(showLoading: true);

    // Realtime notifications are the primary refresh path. Keep a much slower
    // polling fallback without replacing the current page with a spinner.
    _pollingTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (mounted) {
        _loadStatus(silent: true);
      }
    });
  }

  @override
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

  void _handleNotificationProviderChange() {
    final provider = _notificationProvider;
    if (provider == null) return;

    if (provider.scholarAccessRevision == _lastScholarAccessRevision &&
        provider.applicationRevision == _lastApplicationRevision) {
      return;
    }

    _lastScholarAccessRevision = provider.scholarAccessRevision;
    _lastApplicationRevision = provider.applicationRevision;

    if (mounted) {
      _loadStatus(silent: true);
    }
  }

  // SMART_PDM_ENDORSEMENT_UI_CLEANUP_V1
  Future<void> _loadStatus({
    bool showLoading = false,
    bool silent = false,
  }) async {
    if (_isRefreshingStatus) return;

    _isRefreshingStatus = true;
    final shouldBlockPage = showLoading && _summary == null;

    if (mounted && shouldBlockPage) {
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

      // A background refresh must not erase a valid page that is already on
      // screen. Only surface the error when no usable status is available.
      if (!silent || _summary == null) {
        setState(() {
          _errorMessage = error
              .toString()
              .replaceFirst('Exception: ', '')
              .trim();
        });
      }
    } finally {
      _isRefreshingStatus = false;

      if (mounted && _isLoading) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _refreshStatus() => _loadStatus(silent: true);

  Future<void> _retryStatus() => _loadStatus(showLoading: true);

  // SMART_PDM_ENDORSEMENT_SLIP_VIEW_DOWNLOAD_V1
  String _endorsementSlipErrorMessage(Object error) {
    final message = error
        .toString()
        .replaceFirst('Exception: ', '')
        .trim();

    if (message.toLowerCase().contains('not available') ||
        message.toLowerCase().contains('only available after')) {
      return 'The official Endorsement Slip is not available yet. '
          'The page has been refreshed to check the latest endorsement status.';
    }

    return message.isEmpty
        ? 'Unable to load the official Endorsement Slip. Please try again.'
        : message;
  }

  Future<void> _viewEndorsementSlip() async {
    if (_isViewingSlip || _isDownloadingSlip) return;

    setState(() => _isViewingSlip = true);

    try {
      // Fetch fresh bytes from the protected backend route every time.
      // No expiring signed storage URL is cached in the mobile client.
      final download = await _applicationService.downloadMyEndorsementSlip();

      final message = await openDownloadedFilePreview(
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
        SnackBar(content: Text(_endorsementSlipErrorMessage(error))),
      );

      await _loadStatus();
    } finally {
      if (mounted) setState(() => _isViewingSlip = false);
    }
  }

  Future<void> _downloadEndorsementSlip() async {
    if (_isDownloadingSlip || _isViewingSlip) return;

    setState(() => _isDownloadingSlip = true);

    try {
      // This is the same official, finalized PDF used by Admin. Mobile does
      // not generate a second endorsement slip.
      final download = await _applicationService.downloadMyEndorsementSlip();

      final message = await saveDownloadedFile(
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
        SnackBar(content: Text(_endorsementSlipErrorMessage(error))),
      );

      await _loadStatus();
    } finally {
      if (mounted) setState(() => _isDownloadingSlip = false);
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _notificationProvider?.removeListener(_handleNotificationProviderChange);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Endorsement')),
      selectedIndex: 0,
      child: RefreshIndicator(
        onRefresh: _refreshStatus,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.only(top: 64),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_errorMessage != null)
              _EndorsementMessageCard(
                icon: Icons.cloud_off,
                title: 'Unable to load endorsement',
                message: _errorMessage!,
                primaryActionLabel: 'Try Again',
                onPrimaryAction: _retryStatus,
              )
            else if (_summary == null || _summary!.hasApplication == false)
              _EndorsementMessageCard(
                icon: Icons.assignment_late_outlined,
                title: 'No endorsement yet',
                message:
                    'Submit a scholarship application first before endorsement tracking becomes available.',
                primaryActionLabel: 'View Scholarship Openings',
                onPrimaryAction: () =>
                    Navigator.pushNamed(context, AppRoutes.scholarshipOpenings),
              )
            else
              _EndorsementView(
                summary: _summary!,
                isViewingSlip: _isViewingSlip,
                isDownloadingSlip: _isDownloadingSlip,
                onViewSlip: _viewEndorsementSlip,
                onDownloadSlip: _downloadEndorsementSlip,
              ),
          ],
        ),
      ),
    );
  }
}

class _EndorsementView extends StatelessWidget {
  const _EndorsementView({
    required this.summary,
    required this.isViewingSlip,
    required this.isDownloadingSlip,
    required this.onViewSlip,
    required this.onDownloadSlip,
  });

  final ApplicationStatusSummary summary;
  final bool isViewingSlip;
  final bool isDownloadingSlip;
  final VoidCallback onViewSlip;
  final VoidCallback onDownloadSlip;

  bool _isCompleted(EndorsementStateSummary endorsement) {
    return endorsement.status.trim().toLowerCase() == 'completed';
  }

  String _friendlyStatusLabel(String status) {
    final normalized = status.trim().toLowerCase();

    if (normalized.contains('pending sdo') || normalized == 'pending_sdo') {
      return 'Waiting for SDO';
    }
    if (normalized.contains('pending guidance') ||
        normalized == 'pending_guidance') {
      return 'Waiting for Guidance';
    }
    if (normalized.contains('pending program director') ||
        normalized == 'pending_pd') {
      return 'Waiting for Program Director';
    }
    if (normalized.contains('held')) return 'On Hold';
    if (normalized.contains('major')) return 'Endorsement Stopped';
    if (normalized.contains('rejected')) return 'Endorsement Stopped';
    if (normalized.contains('completed')) return 'Completed';

    return status;
  }

  String _currentStepLabel(EndorsementStateSummary endorsement) {
    if (_isCompleted(endorsement)) return 'Done';

    switch (endorsement.currentStage.trim().toLowerCase()) {
      case 'pending_sdo':
        return 'SDO';
      case 'pending_guidance':
        return 'Guidance';
      case 'pending_pd':
        return 'Program Director';
      case 'completed':
        return 'Done';
      default:
        final office = endorsement.currentOffice?.trim() ?? '';
        return office.isEmpty ? 'Processing' : office;
    }
  }

  Color _statusColor(BuildContext context, String status) {
    final normalized = status.trim().toLowerCase();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final success = isDark ? AppColors.lightBlue : AppColors.teal;

    if (normalized.contains('rejected') ||
        normalized.contains('major') ||
        normalized.contains('offense')) {
      return Theme.of(context).colorScheme.error;
    }

    if (normalized.contains('held') || normalized.contains('missing')) {
      return AppColors.orange;
    }

    if (normalized.contains('completed') ||
        normalized.contains('approved') ||
        normalized.contains('verified')) {
      return success;
    }

    if (normalized.contains('pending') ||
        normalized.contains('waiting') ||
        normalized.contains('review')) {
      return AppColors.gold;
    }

    return isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.applicantLightTextMuted;
  }

  IconData _statusIcon(String status) {
    final normalized = status.trim().toLowerCase();

    if (normalized.contains('rejected') ||
        normalized.contains('major') ||
        normalized.contains('offense')) {
      return Icons.cancel_rounded;
    }

    if (normalized.contains('held')) {
      return Icons.pause_circle_filled_rounded;
    }

    if (normalized.contains('completed') ||
        normalized.contains('approved')) {
      return Icons.check_circle_rounded;
    }

    return Icons.schedule_rounded;
  }

  String _formatDate(DateTime? value) {
    if (value == null) return '';
    return DateFormat('MMM d, yyyy').format(value.toLocal());
  }

  String _nextActionMessage(
    ApplicationWorkflowSummary workflow,
    EndorsementStateSummary endorsement,
  ) {
    final blocker = workflow.primaryBlocker;

    if (blocker?.source == 'endorsement') {
      return blocker!.message;
    }

    if (_isCompleted(endorsement)) {
      return endorsement.slip.available
          ? 'All three office reviews are complete. Your official Endorsement Slip is ready.'
          : 'All three office reviews are complete. The official PDF is being finalized.';
    }

    return 'Your Endorsement Slip is moving through the required office reviews.';
  }

  Widget? _buildBlocker(
    BuildContext context,
    ApplicationWorkflowSummary workflow,
  ) {
    final blockerCode = workflow.primaryBlocker?.code ?? '';

    if (blockerCode == 'endorsement.grade_document_missing') {
      return _EndorsementAlertCard(
        color: AppColors.orange,
        icon: Icons.warning_amber_rounded,
        title: 'Grade Report Required',
        message:
            'Upload your current grades PDF before the Program Director can complete the review.',
        primaryLabel: 'Open Documents',
        onPrimaryAction: () =>
            Navigator.pushNamed(context, AppRoutes.documents),
      );
    }

    if (blockerCode == 'endorsement.held') {
      return _EndorsementAlertCard(
        color: AppColors.orange,
        icon: Icons.pause_circle_filled_rounded,
        title: 'Endorsement On Hold',
        message:
            'Guidance placed this endorsement on hold. Check the office result below for details.',
        primaryLabel: 'View Application Status',
        onPrimaryAction: () => Navigator.pushNamed(context, AppRoutes.status),
      );
    }

    if (blockerCode == 'endorsement.major_offense' ||
        blockerCode == 'endorsement.rejected') {
      return _EndorsementAlertCard(
        color: Theme.of(context).colorScheme.error,
        icon: Icons.report_gmailerrorred_rounded,
        title: 'Endorsement Stopped',
        message:
            'An office review stopped this endorsement. Check the office result below for the recorded decision.',
        primaryLabel: 'View Application Status',
        onPrimaryAction: () => Navigator.pushNamed(context, AppRoutes.status),
      );
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final workflow = summary.workflow;
    final endorsement = workflow?.endorsement;

    if (workflow == null || endorsement == null) {
      return _EndorsementMessageCard(
        icon: Icons.assignment_outlined,
        title: 'Endorsement not available yet',
        message:
            'Your endorsement timeline will appear once your application enters office review.',
        primaryActionLabel: 'View Application Status',
        onPrimaryAction: () => Navigator.pushNamed(context, AppRoutes.status),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark
        ? AppColors.applicantDarkSurface
        : AppColors.applicantLightSurface;
    final mutedSurface = isDark
        ? AppColors.applicantDarkSurfaceMuted
        : AppColors.applicantLightSurfaceMuted;
    final outline = isDark
        ? AppColors.applicantDarkOutline
        : AppColors.applicantLightOutline;
    final primaryText = isDark
        ? AppColors.applicantDarkText
        : AppColors.applicantLightText;
    final secondaryText = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.applicantLightTextMuted;
    final accent = isDark ? AppColors.lightBlue : AppColors.teal;
    final statusColor = _statusColor(context, endorsement.statusLabel);
    final blocker = _buildBlocker(context, workflow);
    final slip = endorsement.slip;
    final completedDate = _formatDate(
      endorsement.completedAt ?? slip.completedAt,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: outline),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      _statusIcon(endorsement.statusLabel),
                      color: statusColor,
                      size: 23,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _friendlyStatusLabel(endorsement.statusLabel),
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: primaryText,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                _nextActionMessage(workflow, endorsement),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: secondaryText,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: mutedSurface,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Icon(
                      _isCompleted(endorsement)
                          ? Icons.done_all_rounded
                          : Icons.near_me_outlined,
                      color: _isCompleted(endorsement)
                          ? accent
                          : AppColors.gold,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Current Step',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: secondaryText,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    Flexible(
                      child: Text(
                        _currentStepLabel(endorsement),
                        textAlign: TextAlign.end,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: primaryText,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (blocker != null) ...[
          const SizedBox(height: 16),
          blocker,
        ],
        const SizedBox(height: 22),
        const _EndorsementSectionHeading(
          title: 'Endorsement Timeline',
          subtitle: 'Track your slip from submission through final review.',
        ),
        const SizedBox(height: 10),
        _EndorsementRoadmap(
          currentStage: endorsement.currentStage,
          overallStatus: endorsement.status,
        ),
        const SizedBox(height: 22),
        const _EndorsementSectionHeading(
          title: 'Official Endorsement Slip',
          subtitle: 'View or save the finalized PDF when it is ready.',
        ),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: surface,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: outline),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: (slip.available ? accent : AppColors.gold)
                          .withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      slip.available
                          ? Icons.picture_as_pdf_rounded
                          : Icons.hourglass_top_rounded,
                      color: slip.available ? accent : AppColors.gold,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          slip.available
                              ? 'PDF ready'
                              : 'PDF not ready yet',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(
                                color: primaryText,
                                fontWeight: FontWeight.w900,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          slip.available
                              ? 'This is the official finalized Endorsement Slip.'
                              : 'The PDF becomes available after the endorsement is completed and finalized.',
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: secondaryText,
                            height: 1.4,
                          ),
                        ),
                        if (completedDate.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Completed $completedDate',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: secondaryText,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              if (endorsement.remarks?.trim().isNotEmpty == true) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: mutedSurface,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Text(
                    endorsement.remarks!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: secondaryText,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
              if (slip.available) ...[
                const SizedBox(height: 16),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final stackActions = constraints.maxWidth < 390;
                    final actionsBusy =
                        isViewingSlip || isDownloadingSlip;

                    final viewButton = OutlinedButton.icon(
                      onPressed: actionsBusy ? null : onViewSlip,
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(50),
                        foregroundColor: accent,
                        side: BorderSide(
                          color: accent.withValues(alpha: 0.55),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      icon: isViewingSlip
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                              ),
                            )
                          : const Icon(Icons.visibility_outlined),
                      label: Text(
                        isViewingSlip
                            ? 'Opening...'
                            : 'View Slip',
                        textAlign: TextAlign.center,
                      ),
                    );

                    final downloadButton = FilledButton.icon(
                      onPressed: actionsBusy ? null : onDownloadSlip,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(50),
                        backgroundColor: AppColors.gold,
                        foregroundColor: AppColors.darkBrown,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      icon: isDownloadingSlip
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                              ),
                            )
                          : const Icon(Icons.download_rounded),
                      label: Text(
                        isDownloadingSlip
                            ? 'Downloading...'
                            : 'Download PDF',
                        textAlign: TextAlign.center,
                      ),
                    );

                    if (stackActions) {
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          viewButton,
                          const SizedBox(height: 10),
                          downloadButton,
                        ],
                      );
                    }

                    return Row(
                      children: [
                        Expanded(child: viewButton),
                        const SizedBox(width: 10),
                        Expanded(child: downloadButton),
                      ],
                    );
                  },
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 22),
        const _EndorsementSectionHeading(
          title: 'Office Results',
          subtitle: 'Decisions and remarks recorded by each reviewing office.',
        ),
        const SizedBox(height: 10),
        _ReviewTile(label: 'SDO', review: workflow.officeReviews['sdo']),
        _ReviewTile(
          label: 'Guidance',
          review: workflow.officeReviews['guidance'],
        ),
        _ReviewTile(
          label: 'Program Director',
          review: workflow.officeReviews['pd'],
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => Navigator.pushNamed(context, AppRoutes.status),
            icon: const Icon(Icons.fact_check_outlined),
            label: const Text('View Full Application Status'),
            style: OutlinedButton.styleFrom(
              foregroundColor: primaryText,
              side: BorderSide(color: outline),
              minimumSize: const Size.fromHeight(48),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _EndorsementRoadmap extends StatelessWidget {
  const _EndorsementRoadmap({
    required this.currentStage,
    required this.overallStatus,
  });

  final String currentStage;
  final String overallStatus;

  int _activeIndex() {
    if (overallStatus.trim().toLowerCase() == 'completed') return 4;

    switch (currentStage.trim().toLowerCase()) {
      case 'pending_sdo':
        return 1;
      case 'pending_guidance':
        return 2;
      case 'pending_pd':
        return 3;
      case 'completed':
        return 4;
      default:
        return 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    // SMART_PDM_ENDORSEMENT_TIMELINE_POLISH_V1
    const steps = <({String shortLabel, String semanticLabel})>[
      (shortLabel: 'Submitted', semanticLabel: 'Application submitted'),
      (shortLabel: 'SDO', semanticLabel: 'SDO review'),
      (shortLabel: 'Guidance', semanticLabel: 'Guidance review'),
      (shortLabel: 'PD', semanticLabel: 'Program Director review'),
      (shortLabel: 'Done', semanticLabel: 'Endorsement completed'),
    ];

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark
        ? AppColors.applicantDarkSurface
        : AppColors.applicantLightSurface;
    final outline = isDark
        ? AppColors.applicantDarkOutline
        : AppColors.applicantLightOutline;
    final primaryText = isDark
        ? AppColors.applicantDarkText
        : AppColors.applicantLightText;
    final secondaryText = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.applicantLightTextMuted;
    final completedColor = isDark ? AppColors.lightBlue : AppColors.teal;
    final activeColor = AppColors.gold;
    final activeIndex = _activeIndex();
    final allDone = overallStatus.trim().toLowerCase() == 'completed';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 16),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: outline),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          const nodeSize = 28.0;
          final trackWidth = constraints.maxWidth - nodeSize;
          final safeTrackWidth = trackWidth < 0 ? 0.0 : trackWidth;
          final progressFraction = allDone
              ? 1.0
              : (activeIndex / (steps.length - 1)).clamp(0.0, 1.0);

          return Column(
            children: [
              SizedBox(
                height: nodeSize,
                child: Stack(
                  alignment: Alignment.centerLeft,
                  children: [
                    Positioned(
                      left: nodeSize / 2,
                      right: nodeSize / 2,
                      top: (nodeSize / 2) - 1,
                      child: Container(
                        height: 2,
                        decoration: BoxDecoration(
                          color: outline,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    Positioned(
                      left: nodeSize / 2,
                      top: (nodeSize / 2) - 1,
                      child: Container(
                        width: safeTrackWidth * progressFraction,
                        height: 2,
                        decoration: BoxDecoration(
                          color: completedColor,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: List.generate(steps.length, (index) {
                        final isDone = allDone || index < activeIndex;
                        final isActive = !allDone && index == activeIndex;
                        final nodeColor = isDone
                            ? completedColor
                            : isActive
                            ? activeColor
                            : outline;

                        return Semantics(
                          label: steps[index].semanticLabel,
                          value: isDone
                              ? 'Completed'
                              : isActive
                              ? 'Current'
                              : 'Pending',
                          child: Container(
                            width: nodeSize,
                            height: nodeSize,
                            decoration: BoxDecoration(
                              color: isDone
                                  ? completedColor
                                  : isActive
                                  ? activeColor.withValues(alpha: 0.16)
                                  : surface,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: nodeColor,
                                width: 2,
                              ),
                              boxShadow: isActive
                                  ? [
                                      BoxShadow(
                                        color: activeColor.withValues(
                                          alpha: 0.18,
                                        ),
                                        blurRadius: 8,
                                        spreadRadius: 2,
                                      ),
                                    ]
                                  : null,
                            ),
                            child: isDone
                                ? Icon(
                                    Icons.check_rounded,
                                    size: 16,
                                    color: isDark
                                        ? AppColors.darkBrown
                                        : Colors.white,
                                  )
                                : isActive
                                ? Icon(
                                    Icons.circle,
                                    size: 8,
                                    color: activeColor,
                                  )
                                : null,
                          ),
                        );
                      }),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: List.generate(steps.length, (index) {
                  final isDone = allDone || index < activeIndex;
                  final isActive = !allDone && index == activeIndex;

                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        left: index == 0 ? 0 : 2,
                        right: index == steps.length - 1 ? 0 : 2,
                      ),
                      child: Text(
                        steps[index].shortLabel,
                        maxLines: 1,
                        overflow: TextOverflow.fade,
                        softWrap: false,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: isDone || isActive
                              ? primaryText
                              : secondaryText,
                          fontWeight: isDone || isActive
                              ? FontWeight.w800
                              : FontWeight.w600,
                          fontSize: 10.5,
                          height: 1.1,
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({
    required this.label,
    required this.review,
  });

  final String label;
  final OfficeReviewSummary? review;

  String _decisionLabel() {
    final decision = review?.decision?.trim() ?? '';
    if (decision.isEmpty) return 'Pending';

    final normalized = decision.toLowerCase();

    if (normalized == 'no_offense' || normalized == 'cleared') {
      return 'No Disciplinary Offense';
    }
    if (normalized == 'minor_offense' ||
        normalized == 'disqualified_minor') {
      return 'With Minor Offense/s';
    }
    if (normalized == 'major_offense' ||
        normalized == 'disqualified_major') {
      return 'With Major Offense/s';
    }
    if (normalized == 'good_moral_standing') {
      return 'Good Moral Standing';
    }
    if (normalized == 'good_scholastic_standing') {
      return 'Good Scholastic Standing';
    }
    if (normalized == 'average_scholastic_standing') {
      return 'Average Scholastic Standing';
    }
    if (normalized == 'approved') {
      return 'Approved';
    }
    if (normalized == 'held') return 'On Hold';
    if (normalized == 'rejected') return 'Rejected';

    return decision
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  Color _decisionColor(BuildContext context) {
    final normalized = (review?.decision ?? '').trim().toLowerCase();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (normalized.contains('reject') || normalized.contains('major')) {
      return Theme.of(context).colorScheme.error;
    }

    if (normalized.contains('hold') || normalized.contains('minor')) {
      return AppColors.orange;
    }

    if (normalized.isEmpty) {
      return AppColors.gold;
    }

    return isDark ? AppColors.lightBlue : AppColors.teal;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark
        ? AppColors.applicantDarkSurface
        : AppColors.applicantLightSurface;
    final mutedSurface = isDark
        ? AppColors.applicantDarkSurfaceMuted
        : AppColors.applicantLightSurfaceMuted;
    final outline = isDark
        ? AppColors.applicantDarkOutline
        : AppColors.applicantLightOutline;
    final primaryText = isDark
        ? AppColors.applicantDarkText
        : AppColors.applicantLightText;
    final secondaryText = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.applicantLightTextMuted;
    final actedAt = review?.actedAt;
    final actedByName = review?.actedByName?.trim() ?? '';
    final remarks = review?.remarks?.trim() ?? '';

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              _StatusBadge(
                label: _decisionLabel(),
                color: _decisionColor(context),
              ),
            ],
          ),
          if (actedAt != null || actedByName.isNotEmpty) ...[
            const SizedBox(height: 9),
            Wrap(
              spacing: 10,
              runSpacing: 4,
              children: [
                if (actedAt != null)
                  Text(
                    DateFormat(
                      'MMM d, yyyy',
                    ).format(actedAt.toLocal()),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                if (actedByName.isNotEmpty)
                  Text(
                    'Reviewed by $actedByName',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: secondaryText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ],
          if (remarks.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: mutedSurface,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Text(
                remarks,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: secondaryText,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ],
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
    required this.onPrimaryAction,
  });

  final Color color;
  final IconData icon;
  final String title;
  final String message;
  final String primaryLabel;
  final VoidCallback onPrimaryAction;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark
        ? AppColors.applicantDarkSurface
        : AppColors.applicantLightSurface;
    final outline = isDark
        ? AppColors.applicantDarkOutline
        : AppColors.applicantLightOutline;
    final primaryText = isDark
        ? AppColors.applicantDarkText
        : AppColors.applicantLightText;
    final secondaryText = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.applicantLightTextMuted;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: primaryText,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: secondaryText,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: onPrimaryAction,
            style: OutlinedButton.styleFrom(
              foregroundColor: color,
              side: BorderSide(color: color.withValues(alpha: 0.45)),
            ),
            child: Text(primaryLabel),
          ),
        ],
      ),
    );
  }
}

class _EndorsementSectionHeading extends StatelessWidget {
  const _EndorsementSectionHeading({
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryText = isDark
        ? AppColors.applicantDarkText
        : AppColors.applicantLightText;
    final secondaryText = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.applicantLightTextMuted;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: primaryText,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: secondaryText,
            height: 1.35,
          ),
        ),
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({
    required this.label,
    required this.color,
  });

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      constraints: const BoxConstraints(maxWidth: 180),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.18 : 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w800,
        ),
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
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark
        ? AppColors.applicantDarkSurface
        : AppColors.applicantLightSurface;
    final outline = isDark
        ? AppColors.applicantDarkOutline
        : AppColors.applicantLightOutline;
    final primaryText = isDark
        ? AppColors.applicantDarkText
        : AppColors.applicantLightText;
    final secondaryText = isDark
        ? AppColors.applicantDarkTextMuted
        : AppColors.applicantLightTextMuted;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 32, color: AppColors.gold),
          const SizedBox(height: 12),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: primaryText,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: secondaryText,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: onPrimaryAction,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: AppColors.darkBrown,
                minimumSize: const Size.fromHeight(48),
              ),
              child: Text(primaryActionLabel),
            ),
          ),
        ],
      ),
    );
  }
}
