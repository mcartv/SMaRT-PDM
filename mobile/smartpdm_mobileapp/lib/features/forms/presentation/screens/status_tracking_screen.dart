import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
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
  String? _errorMessage;
  NotificationProvider? _notificationProvider;
  int _lastScholarAccessRevision = 0;

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
    _notificationProvider?.addListener(_handleNotificationProviderChange);
  }

  void _handleNotificationProviderChange() {
    final provider = _notificationProvider;
    if (provider == null) {
      return;
    }

    if (provider.scholarAccessRevision == _lastScholarAccessRevision) {
      return;
    }

    _lastScholarAccessRevision = provider.scholarAccessRevision;

    if (provider.hasScholarAccess && mounted) {
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

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Application Status')),
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
              _StatusSummaryView(summary: _summary!),
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
  const _StatusSummaryView({required this.summary});

  final ApplicationStatusSummary summary;

  Color _statusColor(String status) {
    switch (status.toLowerCase()) {
      case 'qualified':
      case 'approved':
        return Colors.green;
      case 'disqualified':
      case 'rejected':
      case 'requires_reupload':
      case 'requires reupload':
        return Colors.red;
      case 'interview':
        return Colors.blue;
      case 'waiting':
      case 'pending review':
      case 'review':
      default:
        return Colors.orange;
    }
  }

  IconData _statusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'qualified':
      case 'approved':
        return Icons.check_circle;
      case 'disqualified':
      case 'rejected':
      case 'requires_reupload':
      case 'requires reupload':
        return Icons.cancel;
      case 'interview':
        return Icons.groups_rounded;
      case 'waiting':
        return Icons.schedule;
      case 'pending review':
      case 'review':
      default:
        return Icons.access_time;
    }
  }

  String _formatSubmissionDate(DateTime? value) {
    if (value == null) return 'Not available';
    return DateFormat('MMM d, yyyy').format(value.toLocal());
  }

  String _statusDescription() {
    final applicationStatus = summary.applicationStatus ?? 'Pending Review';
    final documentStatus = summary.documentStatus ?? 'Missing Docs';

    if (applicationStatus == 'Qualified' || applicationStatus == 'Approved') {
      return 'Your application has been approved. Monitor announcements and scholar updates for the next steps.';
    }

    if (applicationStatus == 'Disqualified' ||
        applicationStatus == 'Rejected') {
      return 'Your application did not pass the current review. Check announcements or contact OSFA if you need clarification.';
    }

    if (applicationStatus == 'Requires_Reupload' ||
        applicationStatus == 'Requires Reupload') {
      return 'Your application needs updated documents before the review can continue.';
    }

    if (documentStatus == 'Missing Docs') {
      return 'Your application is on file. Upload the required scholarship documents so the review can proceed.';
    }

    if (documentStatus == 'Under Review') {
      return 'Your application and uploaded documents are currently under review.';
    }

    if (documentStatus == 'Documents Ready') {
      return 'Your documents are complete and ready for the next review step.';
    }

    return 'Your application is currently being processed.';
  }

  @override
  Widget build(BuildContext context) {
    final applicationStatus = summary.applicationStatus ?? 'Pending Review';
    final statusColor = _statusColor(applicationStatus);

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
                    Icon(_statusIcon(applicationStatus), color: statusColor),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        applicationStatus,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: statusColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  _statusDescription(),
                  style: const TextStyle(fontSize: 14, height: 1.45),
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
                  summary.openingTitle?.trim().isNotEmpty == true
                      ? summary.openingTitle!
                      : summary.programName?.trim().isNotEmpty == true
                      ? summary.programName!
                      : 'Scholarship Application',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 14),
                _StatusDetailRow(
                  label: 'Application ID',
                  value: summary.applicationId ?? 'Not available',
                ),
                _StatusDetailRow(
                  label: 'Application Status',
                  value: applicationStatus,
                ),
                _StatusDetailRow(
                  label: 'Document Status',
                  value: summary.documentStatus ?? 'Missing Docs',
                ),
                _StatusDetailRow(
                  label: 'Submitted',
                  value: _formatSubmissionDate(summary.submissionDate),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => Navigator.pushNamed(context, AppRoutes.documents),
            icon: const Icon(Icons.upload_file),
            label: const Text('Open Scholarship Requirements'),
          ),
        ),
      ],
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
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Text(message, style: const TextStyle(fontSize: 14, height: 1.45)),
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
