import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/ro_service.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_nav_chips.dart';
import 'package:smartpdm_mobileapp/shared/models/ro_assignment.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';
import 'package:url_launcher/url_launcher.dart';

class ROAssignmentScreen extends StatefulWidget {
  const ROAssignmentScreen({super.key});

  @override
  State<ROAssignmentScreen> createState() => _ROAssignmentScreenState();
}

class _ROAssignmentScreenState extends State<ROAssignmentScreen> {
  final RoService _roService = RoService();
  NotificationProvider? _notificationProvider;
  int _lastRoRevision = 0;

  RoAssignmentsPackage? _package;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadAssignments();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final provider = context.read<NotificationProvider>();
    if (_notificationProvider == provider) {
      return;
    }

    _notificationProvider?.removeListener(_handleRealtimeRo);
    _notificationProvider = provider;
    _lastRoRevision = provider.roRevision;
    _notificationProvider?.addListener(_handleRealtimeRo);
  }

  void _handleRealtimeRo() {
    final provider = _notificationProvider;
    if (provider == null) return;
    if (provider.roRevision == _lastRoRevision) return;

    _lastRoRevision = provider.roRevision;
    if (mounted) {
      _loadAssignments();
    }
  }

  Future<void> _loadAssignments() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final result = await _roService.fetchMyAssignments();
      if (!mounted) return;
      setState(() => _package = result);
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = error.toString().replaceFirst('Exception: ', '').trim();
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _handleScholarChipTap(String label) {
    switch (label) {
      case 'Payout Schedule':
        AppNavigator.goToTopLevel(context, AppRoutes.payouts);
        break;
      case 'Renewal Documents':
        Navigator.pushNamed(context, AppRoutes.renewalDocuments);
        break;
      case 'RO Assignment':
        break;
      case 'RO Completion':
        Navigator.pushNamed(context, AppRoutes.roCompletion);
        break;
    }
  }

  Future<void> _openProof(String proofUrl) async {
    final uri = Uri.tryParse(proofUrl);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  void dispose() {
    _notificationProvider?.removeListener(_handleRealtimeRo);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.grey;
    final items = _package?.items ?? const <RoAssignment>[];
    final setting = _package?.setting;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('RO Assignment'),
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
      ),
      selectedIndex: 1,
      showDrawer: false,
      onRefresh: _loadAssignments,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ScholarNavChips(
            selectedLabel: 'RO Assignment',
            onTap: _handleScholarChipTap,
          ),
          const SizedBox(height: 20),
          Text(
            'Research Opportunity Assignments',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.bold,
              color: titleColor,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            setting?.termLabel ??
                'Track your current RO assignments and submit completion when done.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: subtitleColor,
            ),
          ),
          if (setting != null) ...[
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                title: Text('Required Hours: ${setting.requiredHours}'),
                subtitle: Text(
                  setting.allowCarryOver
                      ? 'Carry-over is allowed for this term.'
                      : 'Carry-over is not allowed for this term.',
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.only(top: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_errorMessage != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Unable to load RO assignments',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(_errorMessage!),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _loadAssignments,
                      child: const Text('Try Again'),
                    ),
                  ],
                ),
              ),
            )
          else if (items.isEmpty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(20),
                child: Text(
                  'No RO assignments yet. OSFA will post your assignment here once available.',
                ),
              ),
            )
          else
            ...items.map((assignment) {
              final status = assignment.status.toLowerCase();
              final statusColor =
                  status == 'verified'
                      ? Colors.green
                      : status == 'rejected'
                      ? Colors.red
                      : status == 'overdue'
                      ? Colors.orange
                      : Colors.blue;

              return Card(
                margin: const EdgeInsets.only(bottom: 14),
                child: Padding(
                  padding: const EdgeInsets.all(16),
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
                                  assignment.title,
                                  style: Theme.of(context).textTheme.titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  assignment.department,
                                  style: TextStyle(color: subtitleColor),
                                ),
                              ],
                            ),
                          ),
                          Chip(
                            label: Text(assignment.status),
                            backgroundColor: statusColor.withOpacity(0.12),
                            labelStyle: TextStyle(color: statusColor),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(assignment.description),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 12,
                        runSpacing: 8,
                        children: [
                          _MetaPill(
                            label: 'Hours',
                            value:
                                '${assignment.hoursLogged}/${assignment.requiredHours}',
                          ),
                          _MetaPill(
                            label: 'Due',
                            value: _formatDate(assignment.endDate),
                          ),
                          _MetaPill(
                            label: 'Supervisor',
                            value: assignment.supervisor,
                          ),
                        ],
                      ),
                      if (assignment.rejectionReason.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Text(
                          'Rejection reason: ${assignment.rejectionReason}',
                          style: const TextStyle(color: Colors.red),
                        ),
                      ],
                      if (assignment.hasProof) ...[
                        const SizedBox(height: 12),
                        TextButton.icon(
                          onPressed: () => _openProof(assignment.proofUrl),
                          icon: const Icon(Icons.open_in_new),
                          label: const Text('View Submitted Proof'),
                        ),
                      ],
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed:
                              assignment.isVerified
                                  ? null
                                  : () => Navigator.pushNamed(
                                    context,
                                    AppRoutes.roCompletion,
                                    arguments: assignment.toRouteArgs(),
                                  ),
                          icon: const Icon(Icons.done_all),
                          label: Text(
                            assignment.hasProof
                                ? 'Update Completion Submission'
                                : 'Submit Completion',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  String _formatDate(String value) {
    if (value.trim().isEmpty) return 'Not set';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    return DateFormat.yMMMd().format(parsed);
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text('$label: $value'),
    );
  }
}
