import 'dart:io';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
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
      _loadStatus();
    }
  }

  Future<void> _loadStatus() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final summary = await _applicationService.fetchMyApplicationStatusSummary();
      if (!mounted) return;
      setState(() => _summary = summary);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _summary = null;
        _errorMessage = error.toString().replaceFirst('Exception: ', '').trim();
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
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
      if (mounted) setState(() => _isDownloadingSlip = false);
    }
  }

  @override
  void dispose() {
    _notificationProvider?.removeListener(_handleNotificationProviderChange);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Endorsement')),
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
              _EndorsementMessageCard(
                icon: Icons.cloud_off,
                title: 'Unable to load endorsement',
                message: _errorMessage!,
                primaryActionLabel: 'Try Again',
                onPrimaryAction: _loadStatus,
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
    );
  }
}

class _EndorsementView extends StatelessWidget {
  const _EndorsementView({
    required this.summary,
    required this.isDownloadingSlip,
    required this.onDownloadSlip,
  });

  final ApplicationStatusSummary summary;
  final bool isDownloadingSlip;
  final VoidCallback onDownloadSlip;

  String _friendlyStatusLabel(String status) {
    final normalized = status.toLowerCase();

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
    if (normalized.contains('held')) {
      return 'On Hold';
    }
    if (normalized.contains('major')) {
      return 'Stopped by Major Offense';
    }
    if (normalized.contains('rejected')) {
      return 'Rejected';
    }
    if (normalized.contains('completed')) {
      return 'Completed';
    }

    return status;
  }

  String _friendlyDecisionLabel(String? decision) {
    final normalized = (decision ?? '').trim().toLowerCase();
    if (normalized.isEmpty) return 'Pending';
    if (normalized == 'clear' || normalized == 'cleared') return 'Cleared';
    if (normalized == 'approve' || normalized == 'approved') {
      return 'Approved';
    }
    if (normalized == 'hold') return 'On Hold';
    if (normalized == 'minor_offense') return 'Minor Offense';
    if (normalized == 'major_offense') return 'Major Offense';
    if (normalized == 'good_moral') return 'Good Moral Standing';
    if (normalized == 'average') return 'Average Standing';
    if (normalized == 'good_average' || normalized == 'good_scholastic') {
      return 'Good Standing';
    }

    return decision!
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  String _friendlyCurrentOffice(String? office) {
    final text = office?.trim() ?? '';
    return text.isEmpty ? 'Not assigned yet' : office!;
  }

  Color _statusColor(String status) {
    final normalized = status.toLowerCase();

    if (normalized.contains('rejected') ||
        normalized.contains('major') ||
        normalized.contains('offense')) {
      return Colors.red;
    }
    if (normalized.contains('held') || normalized.contains('missing')) {
      return Colors.orange;
    }
    if (normalized.contains('completed') || normalized.contains('approved')) {
      return Colors.green;
    }
    if (normalized.contains('pending')) {
      return Colors.blue;
    }

    return Colors.blueGrey;
  }

  IconData _statusIcon(String status) {
    final normalized = status.toLowerCase();

    if (normalized.contains('rejected') ||
        normalized.contains('major') ||
        normalized.contains('offense')) {
      return Icons.cancel;
    }
    if (normalized.contains('held')) return Icons.pause_circle_filled;
    if (normalized.contains('completed') || normalized.contains('approved')) {
      return Icons.check_circle;
    }
    return Icons.access_time;
  }

  String _formatDate(DateTime? value) {
    if (value == null) return 'Not available';
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

    if (endorsement.currentOffice?.trim().isNotEmpty == true) {
      return 'Your endorsement slip is currently waiting in ${endorsement.currentOffice}.';
    }

    if (endorsement.status == 'completed') {
      return 'Your endorsement slip is complete. Final scholar activation still depends on your requirements status.';
    }

    return 'Your endorsement slip is currently being processed.';
  }

  @override
  Widget build(BuildContext context) {
    final workflow = summary.workflow;
    final endorsement = workflow?.endorsement;

    if (workflow == null || endorsement == null) {
      return _EndorsementMessageCard(
        icon: Icons.info_outline,
        title: 'Endorsement not available yet',
        message:
            'The endorsement workflow will appear here once your application enters office review.',
        primaryActionLabel: 'Open Application Status',
        onPrimaryAction: () => Navigator.pushNamed(context, AppRoutes.status),
      );
    }

    final statusColor = _statusColor(endorsement.statusLabel);
    final statusIcon = _statusIcon(endorsement.statusLabel);
    final slip = endorsement.slip;
    final blockerCode = workflow.primaryBlocker?.code ?? '';
    final friendlyStatus = _friendlyStatusLabel(endorsement.statusLabel);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Card(
          color: statusColor.withOpacity(0.08),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(statusIcon, color: statusColor),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        friendlyStatus,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: statusColor,
                            ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  _nextActionMessage(workflow, endorsement),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        height: 1.45,
                      ),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _EndorsementTag(
                      label: 'Code: ${slip.slipCode ?? 'Pending'}',
                    ),
                    _EndorsementTag(
                      label:
                          'Now in: ${_friendlyCurrentOffice(endorsement.currentOffice)}',
                    ),
                    if (summary.openingTitle?.trim().isNotEmpty == true)
                      _EndorsementTag(label: summary.openingTitle!),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: _OverviewMiniItem(
                    label: 'Current Step',
                    value: _friendlyCurrentOffice(endorsement.currentOffice),
                    icon: Icons.location_on_outlined,
                    color: statusColor,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _OverviewMiniItem(
                    label: 'Slip Status',
                    value: friendlyStatus,
                    icon: statusIcon,
                    color: statusColor,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (blockerCode == 'endorsement.grade_document_missing') ...[
          const SizedBox(height: 16),
          _EndorsementAlertCard(
            color: const Color(0xFFC76917),
            icon: Icons.warning_amber_rounded,
            title: 'Grade Report Required',
            message:
                'Upload your current grades PDF in Documents before the Program Director can approve your endorsement slip.',
            primaryLabel: 'Open Documents',
            onPrimaryAction: () =>
                Navigator.pushNamed(context, AppRoutes.documents),
          ),
        ] else if (blockerCode == 'endorsement.held') ...[
          const SizedBox(height: 16),
          _EndorsementAlertCard(
            color: const Color(0xFFC76917),
            icon: Icons.pause_circle_filled_rounded,
            title: 'Guidance Hold',
            message:
                'Your endorsement is currently on hold with Guidance. Review the remarks trail and wait for the next office instruction.',
            primaryLabel: 'Open Application Status',
            onPrimaryAction: () =>
                Navigator.pushNamed(context, AppRoutes.status),
          ),
        ] else if (blockerCode == 'endorsement.major_offense' ||
            blockerCode == 'endorsement.rejected') ...[
          const SizedBox(height: 16),
          _EndorsementAlertCard(
            color: const Color(0xFFD14343),
            icon: Icons.report_gmailerrorred_rounded,
            title: 'Endorsement Stopped',
            message:
                'A rejection or major offense decision was recorded on your endorsement. Review the office results and remarks for the final outcome.',
            primaryLabel: 'Open Application Status',
            onPrimaryAction: () =>
                Navigator.pushNamed(context, AppRoutes.status),
          ),
        ] else if (workflow.stage == 'ready_for_activation') ...[
          const SizedBox(height: 16),
          _EndorsementAlertCard(
            color: const Color(0xFF2E8B57),
            icon: Icons.verified_rounded,
            title: 'Endorsement Complete',
            message:
                'Your endorsement is already complete. Final scholar activation now depends on the remaining admin activation step.',
            primaryLabel: 'Open Application Status',
            onPrimaryAction: () =>
                Navigator.pushNamed(context, AppRoutes.status),
          ),
        ] else if (workflow.stage == 'scholar_activated') ...[
          const SizedBox(height: 16),
          _EndorsementAlertCard(
            color: const Color(0xFF2E8B57),
            icon: Icons.celebration_rounded,
            title: 'Scholar Activated',
            message:
                'Your endorsement flow is complete and your scholar access is already active in the system.',
            primaryLabel: 'Open Application Status',
            onPrimaryAction: () =>
                Navigator.pushNamed(context, AppRoutes.status),
          ),
        ],
        const SizedBox(height: 16),
        _EndorsementSectionHeading(
          title: 'Where Your Slip Is Now',
          subtitle:
              'Follow the endorsement path from SDO to Guidance to Program Director',
        ),
        const SizedBox(height: 10),
        _EndorsementStageList(
          currentStage: endorsement.currentStage,
          overallStatus: endorsement.status,
        ),
        const SizedBox(height: 16),
        _EndorsementSectionHeading(
          title: 'Slip Information',
          subtitle: 'Basic endorsement details and PDF availability',
        ),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _DetailRow(label: 'Slip Code', value: slip.slipCode ?? 'Pending'),
                _DetailRow(
                  label: 'Current Step',
                  value: _friendlyStatusLabel(
                    endorsement.currentStage.replaceAll('_', ' '),
                  ),
                ),
                _DetailRow(
                  label: 'Now in Office',
                  value: _friendlyCurrentOffice(endorsement.currentOffice),
                ),
                _DetailRow(
                  label: 'Completed',
                  value: _formatDate(endorsement.completedAt ?? slip.completedAt),
                ),
                if (endorsement.remarks?.trim().isNotEmpty == true) ...[
                  const SizedBox(height: 10),
                  Text(
                    endorsement.remarks!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          height: 1.4,
                        ),
                  ),
                ],
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: slip.available && !isDownloadingSlip
                        ? onDownloadSlip
                        : null,
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
                              ? 'Download PDF Copy'
                              : 'PDF available after completion',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        _EndorsementSectionHeading(
          title: 'Office Results',
          subtitle: 'See what each office recorded for your slip',
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
        const SizedBox(height: 16),
        _EndorsementSectionHeading(
          title: 'What Still Needs To Happen',
          subtitle:
              'Endorsement is only one part. Your requirements and final activation still matter too.',
        ),
        const SizedBox(height: 10),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _RelatedStatusRow(
                  label: 'Requirements',
                  value: workflow.requirements.statusLabel,
                  color: _statusColor(workflow.requirements.statusLabel),
                ),
                const SizedBox(height: 10),
                _RelatedStatusRow(
                  label: 'Scholar Activation',
                  value: workflow.scholarActivation.statusLabel,
                  color: _statusColor(workflow.scholarActivation.statusLabel),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Quick Actions',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        Navigator.pushNamed(context, AppRoutes.documents),
                    icon: const Icon(Icons.upload_file),
                    label: const Text('Open My Documents'),
                  ),
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => Navigator.pushNamed(context, AppRoutes.status),
                    icon: const Icon(Icons.fact_check_rounded),
                    label: const Text('Open Full Application Status'),
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

class _EndorsementStageList extends StatelessWidget {
  const _EndorsementStageList({
    required this.currentStage,
    required this.overallStatus,
  });

  final String currentStage;
  final String overallStatus;

  @override
  Widget build(BuildContext context) {
    const steps = [
      ('pending_sdo', 'SDO'),
      ('pending_guidance', 'Guidance'),
      ('pending_pd', 'Program Director'),
      ('completed', 'Completed'),
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: steps.map((entry) {
            final key = entry.$1;
            final label = entry.$2;
            final isActive = currentStage == key || (key == 'completed' && overallStatus == 'completed');
            final isDone = key == 'pending_sdo'
                ? currentStage != 'pending_sdo'
                : key == 'pending_guidance'
                    ? ['pending_pd', 'completed'].contains(currentStage) || overallStatus == 'completed'
                    : key == 'pending_pd'
                        ? overallStatus == 'completed'
                        : overallStatus == 'completed';

            final color = isActive
                ? const Color(0xFF3366CC)
                : isDone
                    ? Colors.green
                    : Colors.grey.shade400;

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      isDone ? Icons.check : Icons.circle,
                      size: isDone ? 18 : 10,
                      color: color,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      label,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
                          ),
                    ),
                  ),
                  _StatusBadge(
                    label: isActive
                        ? 'You are here'
                        : isDone
                            ? 'Done'
                            : 'Pending',
                    color: color,
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _ReviewTile extends StatelessWidget {
  const _ReviewTile({required this.label, required this.review});

  final String label;
  final OfficeReviewSummary? review;

  String _decisionLabel() {
    final decision = review?.decision;
    if (decision == null || decision.trim().isEmpty) return 'Pending';
    final normalized = decision.trim().toLowerCase();
    if (normalized == 'clear' || normalized == 'cleared') return 'Cleared';
    if (normalized == 'approve' || normalized == 'approved') return 'Approved';
    if (normalized == 'hold') return 'On Hold';
    if (normalized == 'minor_offense') return 'Minor Offense';
    if (normalized == 'major_offense') return 'Major Offense';
    if (normalized == 'good_moral') return 'Good Moral Standing';
    return decision
        .split('_')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  Color _decisionColor() {
    final normalized = (review?.decision ?? '').toLowerCase();
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

  @override
  Widget build(BuildContext context) {
    final actedAt = review?.actedAt;
    final actedByName = review?.actedByName;
    final remarks = review?.remarks;
    final offenseType = review?.offenseDetail['offense_type']?.toString();
    final incidentDate = review?.offenseDetail['incident_date']?.toString();
    final caseReference = review?.offenseDetail['case_reference_number']?.toString();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
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
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
              _StatusBadge(label: _decisionLabel(), color: _decisionColor()),
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
              'Reviewed by: $actedByName',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey.shade700,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
          if (remarks?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 8),
            Text(
              remarks!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(height: 1.35),
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
                  _EndorsementTag(label: 'Offense: $offenseType'),
                if (incidentDate?.trim().isNotEmpty == true)
                  _EndorsementTag(label: 'Incident Date: $incidentDate'),
                if (caseReference?.trim().isNotEmpty == true)
                  _EndorsementTag(label: 'Reference No.: $caseReference'),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _RelatedStatusRow extends StatelessWidget {
  const _RelatedStatusRow({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
        _StatusBadge(label: value, color: color),
      ],
    );
  }
}

class _OverviewMiniItem extends StatelessWidget {
  const _OverviewMiniItem({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color),
          const SizedBox(height: 8),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.grey.shade700,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
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
                          fontWeight: FontWeight.w800,
                          color: color,
                        ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(message, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 14),
            ElevatedButton.icon(
              onPressed: onPrimaryAction,
              icon: const Icon(Icons.upload_file),
              label: Text(primaryLabel),
            ),
          ],
        ),
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
    return Column(
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

class _EndorsementTag extends StatelessWidget {
  const _EndorsementTag({required this.label});

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

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});

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

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

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
            width: 116,
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
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 10),
            Text(
              message,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    height: 1.45,
                  ),
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
