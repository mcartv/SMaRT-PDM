import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class StatusTrackingScreen extends StatefulWidget {
  const StatusTrackingScreen({super.key});

  @override
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

  @override
  void initState() {
    super.initState();
    _loadStatus();
    _pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (mounted) {
        _loadStatus();
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (_notificationProvider == provider) {
      return;
    }

    _notificationProvider?.removeListener(_handleNotificationProviderChange);
    _notificationProvider = provider;
    _lastScholarAccessRevision = provider.scholarAccessRevision;
    _lastApplicationRevision = provider.applicationRevision;
    _notificationProvider?.addListener(_handleNotificationProviderChange);
  }

  void _handleNotificationProviderChange() {
    final provider = _notificationProvider;
    if (provider == null) {
      return;
    }

    if (provider.scholarAccessRevision == _lastScholarAccessRevision &&
        provider.applicationRevision == _lastApplicationRevision) {
      return;
    }

    _lastScholarAccessRevision = provider.scholarAccessRevision;
    _lastApplicationRevision = provider.applicationRevision;

    if (mounted) {
      _loadStatus();
    }
  }

  Future<void> _loadStatus() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final summary = await _applicationService
          .fetchMyApplicationStatusSummary();
      if (!mounted) return;
      setState(() => _summary = summary);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _summary = null;
        _errorMessage = error.toString().replaceFirst('Exception: ', '').trim();
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _downloadEndorsementSlip() async {
    setState(() => _isDownloadingSlip = true);

    try {
      final download = await _applicationService.downloadMyEndorsementSlip();
      final directory = await getApplicationDocumentsDirectory();
      final safeFileName = download.fileName
          .replaceAll(RegExp(r'[^a-zA-Z0-9._-]+'), '_')
          .replaceAll(RegExp(r'_+'), '_');
      final file = File('${directory.path}/$safeFileName');

      await file.writeAsBytes(download.bytes, flush: true);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Endorsement slip saved as $safeFileName.')),
      );
      await OpenFilex.open(file.path);
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
      if (mounted) {
        setState(() => _isDownloadingSlip = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      appBar: AppBar(title: Text('Application Status')),
      selectedIndex: 0,
      child: RefreshIndicator(
        onRefresh: _loadStatus,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.only(top: 64),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_errorMessage != null)
              _StatusMessageCard(
                icon: Icons.cloud_off,
                title: 'Unable to load application status',
                message: _errorMessage!,
                primaryActionLabel: 'Try Again',
                onPrimaryAction: _loadStatus,
              )
            else if (_summary == null || _summary!.hasApplication == false)
              _StatusMessageCard(
                icon: Icons.assignment_late_outlined,
                title: 'No application status yet',
                message:
                    'You have not submitted a scholarship application yet, so there is no application status to track.',
                primaryActionLabel: 'View Scholarship Openings',
                onPrimaryAction: () =>
                    Navigator.pushNamed(context, AppRoutes.scholarshipOpenings),
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
    );
  }

  @override
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

  Color _statusColor(String status) {
    final normalized = status.toLowerCase();

    if (normalized.contains('rejected') ||
        normalized.contains('major') ||
        normalized.contains('offense')) {
      return Colors.red;
    }
    if (normalized.contains('held') ||
        normalized.contains('reupload') ||
        normalized.contains('missing')) {
      return Colors.orange;
    }
    if (normalized.contains('verified') ||
        normalized.contains('completed') ||
        normalized.contains('activated') ||
        normalized.contains('approved')) {
      return Colors.green;
    }
    if (normalized.contains('ready')) {
      return Colors.blue;
    }

    return Colors.orange;
  }

  IconData _statusIcon(String status) {
    final normalized = status.toLowerCase();

    if (normalized.contains('rejected') ||
        normalized.contains('major') ||
        normalized.contains('offense')) {
      return Icons.cancel;
    }
    if (normalized.contains('held')) return Icons.pause_circle_filled;
    if (normalized.contains('missing') || normalized.contains('reupload')) {
      return Icons.upload_file;
    }
    if (normalized.contains('verified') ||
        normalized.contains('completed') ||
        normalized.contains('activated') ||
        normalized.contains('approved')) {
      return Icons.check_circle;
    }
    if (normalized.contains('ready')) return Icons.verified_user;

    return Icons.access_time;
  }

  String _formatDate(DateTime? value) {
    if (value == null) return 'Not available';
    return DateFormat('MMM d, yyyy').format(value.toLocal());
  }

  String _title() {
    if (summary.openingTitle?.trim().isNotEmpty == true) {
      return summary.openingTitle!;
    }
    if (summary.programName?.trim().isNotEmpty == true) {
      return summary.programName!;
    }
    return 'Scholarship Application';
  }

  String _description() {
    final workflow = summary.workflow;
    if (workflow?.primaryBlocker != null) {
      return workflow!.primaryBlocker!.message;
    }
    if (workflow?.stage == 'scholar_activated') {
      return 'Your application is the active scholar application and scholar access is enabled.';
    }
    if (workflow?.stage == 'ready_for_activation') {
      return 'Your requirements and endorsement are complete. OSFA still needs to run explicit scholar activation.';
    }
    return 'Your application is currently being processed.';
  }

  String _nextStepTitle() {
    final workflow = summary.workflow;
    final blockerCode = workflow?.primaryBlocker?.code ?? '';

    if (blockerCode == 'requirements.missing') {
      return 'Upload the missing requirements';
    }
    if (blockerCode == 'requirements.reupload_required') {
      return 'Re-upload the flagged requirements';
    }
    if (blockerCode == 'endorsement.held') {
      return 'Guidance needs follow-up';
    }
    if (blockerCode == 'endorsement.grade_document_missing') {
      return 'Upload your current grades PDF';
    }
    if (blockerCode == 'endorsement.major_offense' ||
        blockerCode == 'endorsement.rejected' ||
        blockerCode == 'requirements.rejected') {
      return 'Review the rejection details';
    }
    if (workflow?.stage == 'ready_for_activation') {
      return 'Wait for final scholar activation';
    }
    if (workflow?.stage == 'scholar_activated') {
      return 'Scholar access is already active';
    }
    if (workflow?.endorsement.currentOffice?.trim().isNotEmpty == true) {
      return 'Wait for ${workflow!.endorsement.currentOffice} review';
    }

    return 'Your application is under review';
  }

  String _nextStepMessage() {
    final workflow = summary.workflow;
    final blocker = workflow?.primaryBlocker;

    if (blocker != null) {
      return blocker.message;
    }

    if (workflow?.stage == 'ready_for_activation') {
      return 'Your requirements and endorsement are complete. OSFA still needs to perform the final scholar activation step.';
    }
    if (workflow?.stage == 'scholar_activated') {
      return 'You already completed the application flow and your scholar access is now active in the system.';
    }
    if (workflow?.endorsement.currentOffice?.trim().isNotEmpty == true) {
      return 'Your endorsement slip is currently waiting in ${workflow!.endorsement.currentOffice}. You can keep checking this page for updates.';
    }

    return 'Keep your submitted details updated and monitor this page for the next movement in your application.';
  }

  Widget? _buildPriorityActionCard(
    BuildContext context,
    ApplicationWorkflowSummary? workflow,
  ) {
    if (workflow == null) return null;

    final blockerCode = workflow.primaryBlocker?.code ?? '';

    if (blockerCode == 'endorsement.grade_document_missing') {
      return _PriorityActionCard(
        color: const Color(0xFFC76917),
        icon: Icons.upload_file_rounded,
        title: 'Program Director is waiting for your grades',
        message:
            'Upload your current grades PDF now so Program Director can continue the endorsement approval.',
        primaryLabel: 'Open Documents',
        onPrimaryAction: () =>
            Navigator.pushNamed(context, AppRoutes.documents),
      );
    }

    if (blockerCode == 'endorsement.held') {
      return _PriorityActionCard(
        color: const Color(0xFFC76917),
        icon: Icons.pause_circle_filled_rounded,
        title: 'Guidance placed your endorsement on hold',
        message:
            'Open your endorsement page, read the remarks, and follow the next instruction from Guidance.',
        primaryLabel: 'Open Endorsement',
        onPrimaryAction: () =>
            Navigator.pushNamed(context, AppRoutes.endorsement),
      );
    }

    if (blockerCode == 'endorsement.major_offense' ||
        blockerCode == 'endorsement.rejected' ||
        blockerCode == 'requirements.rejected') {
      return _PriorityActionCard(
        color: const Color(0xFFD14343),
        icon: Icons.report_gmailerrorred_rounded,
        title: 'Your application has a recorded issue',
        message:
            'A rejection or major offense was recorded. Open the endorsement page to review the office decision and remarks.',
        primaryLabel: 'Review Endorsement',
        onPrimaryAction: () =>
            Navigator.pushNamed(context, AppRoutes.endorsement),
      );
    }

    if (workflow.stage == 'ready_for_activation') {
      return _PriorityActionCard(
        color: const Color(0xFF2E8B57),
        icon: Icons.verified_rounded,
        title: 'Requirements and endorsement are complete',
        message:
            'Everything needed from you is done. OSFA only needs to perform the final scholar activation step.',
        primaryLabel: 'Open Endorsement',
        onPrimaryAction: () =>
            Navigator.pushNamed(context, AppRoutes.endorsement),
      );
    }

    if (workflow.stage == 'scholar_activated') {
      return _PriorityActionCard(
        color: const Color(0xFF2E8B57),
        icon: Icons.celebration_rounded,
        title: 'You are now an active scholar',
        message:
            'Your application flow is complete and scholar access is already enabled in the system.',
        primaryLabel: 'Go to Dashboard',
        onPrimaryAction: () => Navigator.pushNamed(context, AppRoutes.home),
      );
    }

    return null;
  }

  @override
  Widget build(BuildContext context) {
    final workflow = summary.workflow;
    final stageLabel =
        workflow?.stageLabel ?? summary.applicationStatus ?? 'Pending Review';
    final statusColor = _statusColor(stageLabel);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Card(
          color: statusColor.withValues(alpha: 0.08),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(_statusIcon(stageLabel), color: statusColor),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        stageLabel,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  _description(),
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(height: 1.45),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    const _MiniTag(label: 'Live updates enabled'),
                    _MiniTag(
                      label:
                          'Opening: ${summary.openingTitle?.trim().isNotEmpty == true ? summary.openingTitle! : _title()}',
                    ),
                    if (summary.programName?.trim().isNotEmpty == true)
                      _MiniTag(label: 'Program: ${summary.programName!}'),
                    if (summary.applicationId?.trim().isNotEmpty == true)
                      _MiniTag(label: 'ID: ${summary.applicationId!}'),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _WorkflowStageTracker(
          activeStage: workflow?.stage ?? _fallbackStage(),
          blockerCode: workflow?.primaryBlocker?.code,
        ),
        const SizedBox(height: 16),
        _NextStepCard(
          title: _nextStepTitle(),
          message: _nextStepMessage(),
          color: statusColor,
          icon: _statusIcon(stageLabel),
        ),
        if (_buildPriorityActionCard(context, workflow) != null) ...[
          const SizedBox(height: 16),
          _buildPriorityActionCard(context, workflow)!,
        ],
        const SizedBox(height: 16),
        const _SectionHeading(
          title: 'Application Overview',
          subtitle: 'Core application details and current document standing',
        ),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _title(),
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 14),
                _StatusDetailRow(
                  label: 'Application ID',
                  value: summary.applicationId ?? 'Not available',
                ),
                _StatusDetailRow(
                  label: 'Application Status',
                  value: summary.applicationStatus ?? 'Pending Review',
                ),
                _StatusDetailRow(
                  label: 'Document Status',
                  value: summary.documentStatus ?? 'Missing Docs',
                ),
                _StatusDetailRow(
                  label: 'Submitted',
                  value: _formatDate(summary.submissionDate),
                ),
              ],
            ),
          ),
        ),
        if (workflow != null) ...[
          const SizedBox(height: 16),
          const _SectionHeading(
            title: 'Readiness Overview',
            subtitle:
                'Separate tracking for requirements, endorsement, and scholar activation',
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Text(
                'Use these three checks first: finish requirements, finish endorsement, then wait for final scholar activation.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  height: 1.4,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          _QuickStatusRow(
            items: [
              _QuickStatusItem(
                label: 'Requirements',
                value: workflow.requirements.statusLabel,
                color: _statusColor(workflow.requirements.status),
                icon: _statusIcon(workflow.requirements.status),
              ),
              _QuickStatusItem(
                label: 'Endorsement',
                value: workflow.endorsement.statusLabel,
                color: _statusColor(workflow.endorsement.status),
                icon: _statusIcon(workflow.endorsement.status),
              ),
              _QuickStatusItem(
                label: 'Activation',
                value: workflow.scholarActivation.statusLabel,
                color: _statusColor(workflow.scholarActivation.status),
                icon: _statusIcon(workflow.scholarActivation.status),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _WorkflowGateCard(
            title: 'Requirements',
            status: workflow.requirements.statusLabel,
            remarks: workflow.requirements.remarks,
            color: _statusColor(workflow.requirements.status),
            icon: _statusIcon(workflow.requirements.status),
          ),
          const SizedBox(height: 12),
          _WorkflowGateCard(
            title: 'Endorsement',
            status: workflow.endorsement.statusLabel,
            remarks: workflow.endorsement.remarks,
            subtitle: workflow.endorsement.currentOffice == null
                ? null
                : 'Current office: ${workflow.endorsement.currentOffice}',
            color: _statusColor(workflow.endorsement.status),
            icon: _statusIcon(workflow.endorsement.status),
          ),
          const SizedBox(height: 12),
          _WorkflowGateCard(
            title: 'Scholar Activation',
            status: workflow.scholarActivation.statusLabel,
            subtitle: workflow.scholarActivation.activatedAt == null
                ? null
                : 'Activated: ${_formatDate(workflow.scholarActivation.activatedAt)}',
            color: _statusColor(workflow.scholarActivation.status),
            icon: _statusIcon(workflow.scholarActivation.status),
          ),
          const SizedBox(height: 16),
          _EndorsementSlipCard(
            endorsement: workflow.endorsement,
            isDownloadingSlip: isDownloadingSlip,
            onDownloadSlip: onDownloadSlip,
            formatDate: _formatDate,
            statusColor: _statusColor(workflow.endorsement.status),
            statusIcon: _statusIcon(workflow.endorsement.status),
          ),
          const SizedBox(height: 16),
          const _SectionHeading(
            title: 'Office Reviews',
            subtitle:
                'Per-office decisions, remarks, and offense details when available',
          ),
          const SizedBox(height: 10),
          _OfficeReviewList(reviews: workflow.officeReviews),
        ],
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Quick Actions',
                  style: Theme.of(
                    context,
                  ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        Navigator.pushNamed(context, AppRoutes.endorsement),
                    icon: const Icon(Icons.verified_user_outlined),
                    label: const Text('Open Endorsement Tracker'),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        Navigator.pushNamed(context, AppRoutes.documents),
                    icon: const Icon(Icons.upload_file),
                    label: const Text('Open Scholarship Requirements'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _fallbackStage() {
    final appStatus = (summary.applicationStatus ?? '').toLowerCase();
    final documentStatus = (summary.documentStatus ?? '').toLowerCase();

    if (appStatus == 'approved') return 'scholar_activated';
    if (documentStatus.contains('missing')) return 'requirements_review';
    if (documentStatus.contains('under review')) return 'requirements_review';
    if (documentStatus.contains('ready')) return 'endorsement_review';

    return 'application_submitted';
  }
}

class _WorkflowStageTracker extends StatelessWidget {
  const _WorkflowStageTracker({required this.activeStage, this.blockerCode});

  final String activeStage;
  final String? blockerCode;

  static const _steps = [
    _WorkflowStep(
      key: 'application_submitted',
      label: 'Submitted',
      icon: Icons.assignment_turned_in_outlined,
    ),
    _WorkflowStep(
      key: 'requirements_review',
      label: 'Requirements',
      icon: Icons.fact_check_outlined,
    ),
    _WorkflowStep(
      key: 'endorsement_review',
      label: 'Endorsement',
      icon: Icons.groups_2_outlined,
    ),
    _WorkflowStep(
      key: 'ready_for_activation',
      label: 'Ready',
      icon: Icons.verified_user_outlined,
    ),
    _WorkflowStep(
      key: 'scholar_activated',
      label: 'Activated',
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

  @override
  Widget build(BuildContext context) {
    final activeIndex = _steps.indexWhere((step) => step.key == activeStage);
    final resolvedIndex = activeIndex < 0 ? 0 : activeIndex;
    final activeColor = _isStopped
        ? Colors.red
        : _isHeld
        ? Colors.orange
        : Colors.green;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Application Tracker',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 16),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < _steps.length; i++) ...[
                    SizedBox(
                      width: 88,
                      child: _WorkflowStepMarker(
                        step: _steps[i],
                        isComplete: i < resolvedIndex,
                        isActive: i == resolvedIndex,
                        activeColor: activeColor,
                      ),
                    ),
                    if (i < _steps.length - 1)
                      Container(
                        width: 44,
                        margin: const EdgeInsets.only(top: 18),
                        height: 3,
                        decoration: BoxDecoration(
                          color: i < resolvedIndex
                              ? activeColor
                              : Colors.grey.shade300,
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _WorkflowStep {
  const _WorkflowStep({
    required this.key,
    required this.label,
    required this.icon,
  });

  final String key;
  final String label;
  final IconData icon;
}

class _WorkflowStepMarker extends StatelessWidget {
  const _WorkflowStepMarker({
    required this.step,
    required this.isComplete,
    required this.isActive,
    required this.activeColor,
  });

  final _WorkflowStep step;
  final bool isComplete;
  final bool isActive;
  final Color activeColor;

  @override
  Widget build(BuildContext context) {
    final color = isComplete || isActive ? activeColor : Colors.grey.shade400;
    final background = isComplete || isActive
        ? activeColor.withValues(alpha: 0.12)
        : Colors.grey.shade100;

    return Column(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: background,
            shape: BoxShape.circle,
            border: Border.all(color: color, width: isActive ? 2 : 1),
          ),
          child: Icon(
            isComplete ? Icons.check : step.icon,
            size: 19,
            color: color,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          step.label,
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: isActive ? activeColor : Colors.grey.shade700,
            fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
            height: 1.15,
          ),
        ),
      ],
    );
  }
}

class _WorkflowGateCard extends StatelessWidget {
  const _WorkflowGateCard({
    required this.title,
    required this.status,
    required this.color,
    required this.icon,
    this.subtitle,
    this.remarks,
  });

  final String title;
  final String status;
  final String? subtitle;
  final String? remarks;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      _StatusPill(label: status, color: color),
                    ],
                  ),
                  if (subtitle?.isNotEmpty == true) ...[
                    const SizedBox(height: 6),
                    Text(subtitle!),
                  ],
                  if (remarks?.isNotEmpty == true) ...[
                    const SizedBox(height: 8),
                    Text(
                      remarks!,
                      style: Theme.of(
                        context,
                      ).textTheme.bodySmall?.copyWith(height: 1.35),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OfficeReviewList extends StatelessWidget {
  const _OfficeReviewList({required this.reviews});

  final Map<String, OfficeReviewSummary> reviews;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _OfficeReviewTile(label: 'SDO', review: reviews['sdo']),
        _OfficeReviewTile(label: 'Guidance', review: reviews['guidance']),
        _OfficeReviewTile(label: 'Program Director', review: reviews['pd']),
      ],
    );
  }
}

class _OfficeReviewTile extends StatelessWidget {
  const _OfficeReviewTile({required this.label, required this.review});

  final String label;
  final OfficeReviewSummary? review;

  String _formatDecision() {
    final decision = review?.decision;
    if (decision == null || decision.trim().isEmpty) return 'Pending';

    return decision
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  @override
  Widget build(BuildContext context) {
    final actedAt = review?.actedAt;
    final actedByName = review?.actedByName;
    final remarks = review?.remarks;
    final offenseType = review?.offenseDetail['offense_type']?.toString();
    final incidentDate = review?.offenseDetail['incident_date']?.toString();
    final caseReference = review?.offenseDetail['case_reference_number']
        ?.toString();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        label,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    _StatusPill(
                      label: _formatDecision(),
                      color: _decisionColor(review?.decision),
                    ),
                  ],
                ),
                if (actedAt != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    DateFormat('MMM d, yyyy').format(actedAt.toLocal()),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
                if (actedByName?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Handled by: $actedByName',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.grey.shade700,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
                if (remarks?.isNotEmpty == true) ...[
                  const SizedBox(height: 8),
                  Text(
                    remarks!,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(height: 1.35),
                  ),
                ],
                if ((offenseType?.trim().isNotEmpty ?? false) ||
                    (incidentDate?.trim().isNotEmpty ?? false) ||
                    (caseReference?.trim().isNotEmpty ?? false)) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (offenseType?.trim().isNotEmpty == true)
                        _MiniTag(label: 'Offense: $offenseType'),
                      if (incidentDate?.trim().isNotEmpty == true)
                        _MiniTag(label: 'Incident: $incidentDate'),
                      if (caseReference?.trim().isNotEmpty == true)
                        _MiniTag(label: 'Case Ref: $caseReference'),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _decisionColor(String? decision) {
    final normalized = (decision ?? '').toLowerCase();
    if (normalized.contains('reject') || normalized.contains('major')) {
      return Colors.red;
    }
    if (normalized.contains('hold') || normalized.contains('minor')) {
      return Colors.orange;
    }
    if (normalized.contains('clear') || normalized.contains('approve')) {
      return Colors.green;
    }
    return Colors.blueGrey;
  }
}

class _EndorsementSlipCard extends StatelessWidget {
  const _EndorsementSlipCard({
    required this.endorsement,
    required this.isDownloadingSlip,
    required this.onDownloadSlip,
    required this.formatDate,
    required this.statusColor,
    required this.statusIcon,
  });

  final EndorsementStateSummary endorsement;
  final bool isDownloadingSlip;
  final VoidCallback onDownloadSlip;
  final String Function(DateTime?) formatDate;
  final Color statusColor;
  final IconData statusIcon;

  @override
  Widget build(BuildContext context) {
    final slip = endorsement.slip;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(statusIcon, color: statusColor),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Endorsement Slip',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                _StatusPill(
                  label: endorsement.statusLabel,
                  color: statusColor,
                ),
              ],
            ),
            const SizedBox(height: 14),
            _StatusDetailRow(
              label: 'Slip Code',
              value: slip.slipCode ?? 'Will be assigned once available',
            ),
            if (slip.fileName?.trim().isNotEmpty == true)
              _StatusDetailRow(
                label: 'PDF File',
                value: slip.fileName!,
              ),
            _StatusDetailRow(
              label: 'Current Office',
              value: endorsement.currentOffice ?? 'No active office',
            ),
            _StatusDetailRow(
              label: 'Current Stage',
              value: endorsement.currentStage.replaceAll('_', ' '),
            ),
            _StatusDetailRow(
              label: 'Completed',
              value: formatDate(endorsement.completedAt ?? slip.completedAt),
            ),
            if (endorsement.remarks?.trim().isNotEmpty == true) ...[
              const SizedBox(height: 8),
              Text(
                endorsement.remarks!,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(height: 1.35),
              ),
            ],
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: slip.available
                    ? const Color(0xFFE8F1FF)
                    : const Color(0xFFF6F6F4),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: slip.available
                      ? const Color(0xFFB8D4FF)
                      : const Color(0xFFE7E5E4),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Endorsement Slip PDF',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    slip.available
                        ? 'Your printable slip is ready to download.'
                        : 'This becomes downloadable after all endorsement offices finish the slip.',
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(height: 1.35),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: slip.available && !isDownloadingSlip
                    ? onDownloadSlip
                    : null,
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(54),
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFFE7E5E4),
                  disabledForegroundColor: const Color(0xFF78716C),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                icon: isDownloadingSlip
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.picture_as_pdf),
                label: Text(
                  isDownloadingSlip
                      ? 'Downloading Endorsement Slip...'
                      : slip.available
                          ? 'Download My Endorsement Slip'
                          : 'PDF Available After Completion',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NextStepCard extends StatelessWidget {
  const _NextStepCard({
    required this.title,
    required this.message,
    required this.color,
    required this.icon,
  });

  final String title;
  final String message;
  final Color color;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: color.withOpacity(0.08),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    message,
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(height: 1.35),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PriorityActionCard extends StatelessWidget {
  const _PriorityActionCard({
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
    return Card(
      color: color.withOpacity(0.08),
      child: Padding(
        padding: const EdgeInsets.all(18),
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
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                height: 1.4,
              ),
            ),
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: onPrimaryAction,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: Text(primaryLabel),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
    );
  }
}

class _MiniTag extends StatelessWidget {
  const _MiniTag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          fontWeight: FontWeight.w600,
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
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Colors.grey.shade700,
            height: 1.35,
          ),
        ),
      ],
    );
  }
}

class _QuickStatusItem {
  const _QuickStatusItem({
    required this.label,
    required this.value,
    required this.color,
    required this.icon,
  });

  final String label;
  final String value;
  final Color color;
  final IconData icon;
}

class _QuickStatusRow extends StatelessWidget {
  const _QuickStatusRow({required this.items});

  final List<_QuickStatusItem> items;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableWidth = constraints.maxWidth.isFinite
            ? constraints.maxWidth
            : MediaQuery.of(context).size.width - 32;
        final itemWidth = availableWidth > 560
            ? (availableWidth - 20) / 3
            : (availableWidth - 10) / 2;

        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: items.map((item) {
            return SizedBox(
              width: itemWidth.clamp(150.0, 240.0),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: item.color.withOpacity(0.18)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: item.color.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(item.icon, color: item.color, size: 18),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: Colors.grey.shade700,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            item.value,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
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
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 34),
            const SizedBox(height: 14),
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
              child: ElevatedButton(
                onPressed: onPrimaryAction,
                child: Text(primaryActionLabel),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusDetailRow extends StatelessWidget {
  const _StatusDetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 132,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
