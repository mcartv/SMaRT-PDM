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

  @override
  void initState() {
    super.initState();
    _loadStatus();
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

  @override
  Widget build(BuildContext context) {
    final workflow = summary.workflow;
    final stageLabel =
        workflow?.stageLabel ?? summary.applicationStatus ?? 'Pending Review';
    final statusColor = _statusColor(stageLabel);
    final slip = workflow?.endorsement.slip;

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
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
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
          _OfficeReviewList(reviews: workflow.officeReviews),
        ],
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => Navigator.pushNamed(context, AppRoutes.documents),
            icon: const Icon(Icons.upload_file),
            label: const Text('Open Scholarship Requirements'),
          ),
        ),
        if (slip?.available == true) ...[
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: isDownloadingSlip ? null : onDownloadSlip,
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
                    : 'Download Endorsement Slip',
              ),
            ),
          ),
        ],
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
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    status,
                    style: TextStyle(color: color, fontWeight: FontWeight.w700),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Office Reviews',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            _OfficeReviewTile(label: 'SDO', review: reviews['sdo']),
            _OfficeReviewTile(label: 'Guidance', review: reviews['guidance']),
            _OfficeReviewTile(label: 'Program Director', review: reviews['pd']),
          ],
        ),
      ),
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
    final remarks = review?.remarks;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
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
              Text(_formatDecision()),
            ],
          ),
          if (actedAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                DateFormat('MMM d, yyyy').format(actedAt.toLocal()),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          if (remarks?.isNotEmpty == true)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                remarks!,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(height: 1.35),
              ),
            ),
        ],
      ),
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
