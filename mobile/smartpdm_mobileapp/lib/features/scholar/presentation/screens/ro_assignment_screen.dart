import 'dart:async';

import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ROAssignmentScreen extends StatefulWidget {
  const ROAssignmentScreen({super.key});

  @override
  State<ROAssignmentScreen> createState() => _ROAssignmentScreenState();
}

class ObligationsScreen extends StatelessWidget {
  const ObligationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ROAssignmentScreen();
  }
}

class _ROAssignmentScreenState extends State<ROAssignmentScreen>
    with SingleTickerProviderStateMixin {
  final ApiClient _apiClient = ApiClient();
  final TextEditingController _noteController = TextEditingController();

  late final TabController _tabController;

  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;

  List<RoAssignment> _items = [];
  bool _isApprovedScholar = false;
  bool _shouldShowModule = false;

  Timer? _activeTimer;

  @override
  void initState() {
    super.initState();

    _tabController = TabController(length: 2, vsync: this);
    _loadRo();

    _activeTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;

      if (_items.any((item) => item.activeLog != null)) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _activeTimer?.cancel();
    _tabController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  List<RoAssignment> get _activeItems {
    return _items.where((item) => !item.isCleared).toList();
  }

  List<RoAssignment> get _completedItems {
    return _items.where((item) => item.isCleared).toList();
  }

  bool get _hasAnyActiveSession {
    return _items.any((item) => item.activeLog != null);
  }

  Future<void> _loadRo() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiClient.getObject('/api/ro/me');
      final items = (response['items'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(RoAssignment.fromJson)
          .toList();

      if (!mounted) return;

      setState(() {
        _items = items;
        _isApprovedScholar = response['isApprovedScholar'] == true;
        _shouldShowModule = response['shouldShowModule'] == true;
        _errorMessage = null;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _errorMessage = _cleanError(error);
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _acknowledge(RoAssignment item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Acknowledge RO notice?'),
          content: Text(
            'You are acknowledging your Return of Obligation assignment at ${item.assignedArea}.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.darkBrown,
                foregroundColor: Colors.white,
              ),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Acknowledge'),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiClient.postJson(
        '/api/ro/${item.roId}/acknowledge',
        body: const {},
      );

      _applyResponse(response);
      _showSnack(response['message']?.toString() ?? 'RO notice acknowledged.');
    } catch (error) {
      setState(() => _errorMessage = _cleanError(error));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _reportConcern(RoAssignment item) async {
    final concern = await _showNoteSheet(
      title: 'Report Concern',
      hint: 'Explain your concern or conflict with this RO assignment',
      primaryLabel: 'Submit Concern',
      requiredInput: true,
    );

    if (concern == null) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiClient.postJson(
        '/api/ro/${item.roId}/conflict',
        body: {'reason': concern.trim()},
      );

      _applyResponse(response);
      _showSnack(response['message']?.toString() ?? 'Concern submitted.');
    } catch (error) {
      setState(() => _errorMessage = _cleanError(error));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _timeIn(RoAssignment item) async {
    final note = await _showNoteSheet(
      title: 'Time In',
      hint: 'Optional note before starting your RO session',
      primaryLabel: 'Start Session',
    );

    if (note == null) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiClient.postJson(
        '/api/ro/${item.roId}/time-in',
        body: {if (note.trim().isNotEmpty) 'studentNote': note.trim()},
      );

      _applyResponse(response);
      _showSnack(response['message']?.toString() ?? 'Timed in successfully.');
    } catch (error) {
      setState(() => _errorMessage = _cleanError(error));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _timeOut(RoAssignment item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Time out?'),
          content: const Text(
            'Your current RO session will be submitted for validation.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFB3261E),
                foregroundColor: Colors.white,
              ),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Time Out'),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiClient.patchJson(
        '/api/ro/${item.roId}/time-out',
      );

      _applyResponse(response);
      _showSnack(response['message']?.toString() ?? 'Timed out successfully.');
    } catch (error) {
      setState(() => _errorMessage = _cleanError(error));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  void _applyResponse(Map<String, dynamic> response) {
    final items = (response['items'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(RoAssignment.fromJson)
        .toList();

    setState(() {
      _items = items;
      _isApprovedScholar = response['isApprovedScholar'] == true;
      _shouldShowModule = response['shouldShowModule'] == true;
      _errorMessage = null;
    });
  }

  Future<String?> _showNoteSheet({
    required String title,
    required String hint,
    required String primaryLabel,
    bool requiredInput = false,
  }) async {
    _noteController.clear();

    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        final bottom = MediaQuery.of(context).viewInsets.bottom;

        return Padding(
          padding: EdgeInsets.fromLTRB(18, 18, 18, bottom + 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.black26,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _noteController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: hint,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.darkBrown,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  onPressed: () {
                    final text = _noteController.text.trim();

                    if (requiredInput && text.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Please enter your reason first.'),
                        ),
                      );
                      return;
                    }

                    Navigator.pop(context, text);
                  },
                  child: Text(primaryLabel),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showSnack(String message) {
    if (!mounted) return;

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String _cleanError(Object error) {
    return error.toString().replaceFirst('Exception: ', '').trim();
  }

  String _formatMinutes(int minutes) {
    final safe = minutes < 0 ? 0 : minutes;
    final hours = safe ~/ 60;
    final mins = safe % 60;

    if (hours <= 0) return '${mins}m';
    if (mins <= 0) return '${hours}h';
    return '${hours}h ${mins}m';
  }

  String _formatElapsed(int seconds) {
    final safe = seconds < 0 ? 0 : seconds;
    final hours = safe ~/ 3600;
    final minutes = (safe % 3600) ~/ 60;
    final secs = safe % 60;

    return [
      hours.toString().padLeft(2, '0'),
      minutes.toString().padLeft(2, '0'),
      secs.toString().padLeft(2, '0'),
    ].join(':');
  }

  String _formatDateTime(DateTime? value) {
    if (value == null) return '—';

    final local = value.toLocal();
    final date = '${local.month}/${local.day}/${local.year}';
    final time = TimeOfDay.fromDateTime(local).format(context);

    return '$date · $time';
  }

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      selectedIndex: 1,
      appBar: AppBar(
        backgroundColor: AppColors.darkBrown,
        foregroundColor: Colors.white,
        title: const Text(
          'Return of Obligation',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      child: _buildContent(),
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return RefreshIndicator(
        onRefresh: _loadRo,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            _StateCard(
              icon: Icons.warning_amber_rounded,
              title: 'Unable to load RO',
              message: _errorMessage!,
              actionLabel: 'Try Again',
              onAction: _loadRo,
            ),
          ],
        ),
      );
    }

    if (!_isApprovedScholar || !_shouldShowModule) {
      return RefreshIndicator(
        onRefresh: _loadRo,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            _StateCard(
              icon: Icons.lock_outline_rounded,
              title: 'For approved scholars only',
              message:
                  'Return of Obligation is shown only after your scholarship application has been approved.',
            ),
          ],
        ),
      );
    }

    if (_items.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadRo,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            _StateCard(
              icon: Icons.assignment_outlined,
              title: 'No RO notice yet',
              message:
                  'Your Return of Obligation notice will appear here once OSFA assigns it.',
            ),
          ],
        ),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tabSurfaceColor = isDark
        ? const Color(0xFF332216)
        : Colors.grey.withOpacity(0.12);
    final unselectedTabColor = isDark ? Colors.white70 : Colors.grey.shade700;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'My Return of Obligation',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: tabSurfaceColor,
            borderRadius: BorderRadius.circular(16),
          ),
          child: TabBar(
            controller: _tabController,
            indicator: BoxDecoration(
              color: AppColors.darkBrown,
              borderRadius: BorderRadius.circular(14),
            ),
            indicatorSize: TabBarIndicatorSize.tab,
            labelColor: Colors.white,
            unselectedLabelColor: unselectedTabColor,
            tabs: const [
              Tab(text: 'Active'),
              Tab(text: 'Completed'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadRo,
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildAssignmentList(_activeItems, completed: false),
                _buildAssignmentList(_completedItems, completed: true),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAssignmentList(
    List<RoAssignment> items, {
    required bool completed,
  }) {
    if (items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          _StateCard(
            icon: completed
                ? Icons.verified_rounded
                : Icons.assignment_outlined,
            title: completed ? 'No completed RO yet' : 'No active RO',
            message: completed
                ? 'Cleared Return of Obligation records will appear here.'
                : 'Active Return of Obligation records will appear here.',
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 14),
      itemBuilder: (context, index) {
        final item = items[index];

        return _AssignmentCard(
          item: item,
          isSubmitting: _isSubmitting,
          hasAnyActiveSession: _hasAnyActiveSession,
          formatMinutes: _formatMinutes,
          formatElapsed: _formatElapsed,
          formatDateTime: _formatDateTime,
          onAcknowledge: () => _acknowledge(item),
          onReportConcern: () => _reportConcern(item),
          onTimeIn: () => _timeIn(item),
          onTimeOut: () => _timeOut(item),
        );
      },
    );
  }
}

class RoAssignment {
  const RoAssignment({
    required this.roId,
    required this.title,
    required this.programName,
    required this.openingTitle,
    required this.assignedArea,
    required this.remarks,
    required this.requiredHours,
    required this.submittedMinutes,
    required this.validatedMinutes,
    required this.requiredMinutes,
    required this.submittedProgress,
    required this.validatedProgress,
    required this.roStatus,
    required this.progressStatus,
    required this.assignmentStatus,
    required this.conflictReason,
    required this.validationRemarks,
    required this.logs,
    this.activeLog,
  });

  final String roId;
  final String title;
  final String programName;
  final String openingTitle;
  final String assignedArea;
  final String remarks;

  final int requiredHours;
  final int submittedMinutes;
  final int validatedMinutes;
  final int requiredMinutes;
  final int submittedProgress;
  final int validatedProgress;

  final String roStatus;
  final String progressStatus;
  final String assignmentStatus;
  final String conflictReason;
  final String validationRemarks;

  final RoTimeLog? activeLog;
  final List<RoTimeLog> logs;

  bool get isCleared => roStatus.toLowerCase() == 'cleared';

  bool get isAssignedOnly {
    final normalized = assignmentStatus.toLowerCase();
    return normalized == 'assigned' || normalized == 'pending';
  }

  bool get isAcknowledged {
    final normalized = assignmentStatus.toLowerCase();
    return normalized == 'acknowledged' || normalized == 'in progress';
  }

  bool get hasConflict {
    return assignmentStatus.toLowerCase() == 'conflict reported';
  }

  bool get isForValidation {
    return progressStatus.toLowerCase() == 'for validation';
  }

  factory RoAssignment.fromJson(Map<String, dynamic> json) {
    return RoAssignment(
      roId: json['roId']?.toString() ?? json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Return of Obligation Notice',
      programName: json['programName']?.toString() ?? '',
      openingTitle: json['openingTitle']?.toString() ?? '',
      assignedArea:
          json['assignedArea']?.toString() ??
          json['assigned_area']?.toString() ??
          '',
      remarks: json['remarks']?.toString() ?? '',
      requiredHours: _toInt(json['requiredHours']),
      submittedMinutes: _toInt(json['submittedMinutes']),
      validatedMinutes: _toInt(json['validatedMinutes']),
      requiredMinutes: _toInt(json['requiredMinutes']),
      submittedProgress: _toInt(json['submittedProgress']),
      validatedProgress: _toInt(json['validatedProgress']),
      roStatus:
          json['roStatus']?.toString() ??
          json['status']?.toString() ??
          'Pending',
      progressStatus: json['progressStatus']?.toString() ?? 'Not Started',
      assignmentStatus:
          json['assignmentStatus']?.toString() ??
          json['assignment_status']?.toString() ??
          'Assigned',
      conflictReason:
          json['conflictReason']?.toString() ??
          json['conflict_reason']?.toString() ??
          '',
      validationRemarks: json['validationRemarks']?.toString() ?? '',
      activeLog: json['activeLog'] is Map<String, dynamic>
          ? RoTimeLog.fromJson(json['activeLog'] as Map<String, dynamic>)
          : null,
      logs: (json['logs'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .map(RoTimeLog.fromJson)
          .toList(),
    );
  }
}

class RoTimeLog {
  const RoTimeLog({
    required this.logId,
    required this.timeInAt,
    required this.timeOutAt,
    required this.durationMinutes,
    required this.logStatus,
    required this.validationStatus,
    required this.validatedMinutes,
    required this.validationRemarks,
    required this.studentNote,
  });

  final String logId;
  final DateTime? timeInAt;
  final DateTime? timeOutAt;
  final int durationMinutes;
  final String logStatus;
  final String validationStatus;
  final int validatedMinutes;
  final String validationRemarks;
  final String studentNote;

  bool get isActive => timeOutAt == null && logStatus == 'Timed In';

  int get elapsedSeconds {
    if (!isActive || timeInAt == null) return durationMinutes * 60;

    final diff = DateTime.now().difference(timeInAt!.toLocal()).inSeconds;
    return diff < 0 ? 0 : diff;
  }

  factory RoTimeLog.fromJson(Map<String, dynamic> json) {
    return RoTimeLog(
      logId: json['logId']?.toString() ?? '',
      timeInAt: _toDate(json['timeInAt']),
      timeOutAt: _toDate(json['timeOutAt']),
      durationMinutes: _toInt(json['durationMinutes']),
      logStatus: json['logStatus']?.toString() ?? '',
      validationStatus:
          json['validationStatus']?.toString() ?? 'Pending Validation',
      validatedMinutes: _toInt(json['validatedMinutes']),
      validationRemarks: json['validationRemarks']?.toString() ?? '',
      studentNote: json['studentNote']?.toString() ?? '',
    );
  }
}

class _AssignmentCard extends StatelessWidget {
  const _AssignmentCard({
    required this.item,
    required this.isSubmitting,
    required this.hasAnyActiveSession,
    required this.formatMinutes,
    required this.formatElapsed,
    required this.formatDateTime,
    required this.onAcknowledge,
    required this.onReportConcern,
    required this.onTimeIn,
    required this.onTimeOut,
  });

  final RoAssignment item;
  final bool isSubmitting;
  final bool hasAnyActiveSession;
  final String Function(int minutes) formatMinutes;
  final String Function(int seconds) formatElapsed;
  final String Function(DateTime? value) formatDateTime;
  final VoidCallback onAcknowledge;
  final VoidCallback onReportConcern;
  final VoidCallback onTimeIn;
  final VoidCallback onTimeOut;

  @override
  Widget build(BuildContext context) {
    final activeLog = item.activeLog;
    final isTimedIn = activeLog != null;
    final submittedProgress = item.submittedProgress.clamp(0, 100) / 100;
    final validatedProgress = item.validatedProgress.clamp(0, 100) / 100;

    final canAcknowledge =
        !item.isCleared && item.isAssignedOnly && !isSubmitting;

    final canReportConcern =
        !item.isCleared && !item.hasConflict && !isSubmitting;

    final canTimeIn =
        !item.isCleared &&
        item.isAcknowledged &&
        !item.hasConflict &&
        !isTimedIn &&
        !hasAnyActiveSession &&
        !isSubmitting;

    final canTimeOut = !item.isCleared && isTimedIn && !isSubmitting;

    return Card(
      elevation: 1,
      shadowColor: const Color(0x12000000),
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _NoticeHeader(item: item),
            const SizedBox(height: 16),
            _NoticeDetails(item: item, formatMinutes: formatMinutes),
            const SizedBox(height: 16),
            _ProgressLine(
              label: 'Submitted',
              value: submittedProgress.toDouble(),
              percent: item.submittedProgress,
              caption:
                  '${formatMinutes(item.submittedMinutes)} submitted of ${formatMinutes(item.requiredMinutes)}',
              color: AppColors.gold,
            ),
            const SizedBox(height: 14),
            _ProgressLine(
              label: 'Validated',
              value: validatedProgress.toDouble(),
              percent: item.validatedProgress,
              caption:
                  '${formatMinutes(item.validatedMinutes)} validated of ${formatMinutes(item.requiredMinutes)}',
              color: Colors.green,
            ),
            if (item.validationRemarks.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(
                item.validationRemarks,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.black54,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            if (item.hasConflict && item.conflictReason.isNotEmpty) ...[
              const SizedBox(height: 12),
              _InfoBox(
                icon: Icons.report_problem_rounded,
                title: 'Concern Reported',
                message: item.conflictReason,
                color: const Color(0xFFB3261E),
              ),
            ],
            const SizedBox(height: 16),
            if (isTimedIn)
              _ActiveSessionBox(
                log: activeLog,
                formatElapsed: formatElapsed,
                formatDateTime: formatDateTime,
              ),
            if (isTimedIn) const SizedBox(height: 14),
            if (!item.isCleared) ...[
              if (item.isAssignedOnly) ...[
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: canAcknowledge ? onAcknowledge : null,
                    icon: const Icon(Icons.check_circle_rounded),
                    label: const Text('Acknowledge Notice'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.darkBrown,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              if (!item.hasConflict && !item.isCleared) ...[
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: canReportConcern ? onReportConcern : null,
                    icon: const Icon(Icons.feedback_rounded),
                    label: const Text('Report Concern'),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
              ],
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: canTimeIn ? onTimeIn : null,
                      icon: const Icon(Icons.login_rounded),
                      label: const Text('Time In'),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.darkBrown,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: canTimeOut ? onTimeOut : null,
                      icon: const Icon(Icons.logout_rounded),
                      label: const Text('Time Out'),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFFB3261E),
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 16),
            _LogsSection(
              logs: item.logs,
              formatMinutes: formatMinutes,
              formatDateTime: formatDateTime,
            ),
          ],
        ),
      ),
    );
  }
}

class _NoticeHeader extends StatelessWidget {
  const _NoticeHeader({required this.item});

  final RoAssignment item;

  @override
  Widget build(BuildContext context) {
    final statusColor = item.isCleared
        ? Colors.green
        : item.hasConflict
        ? const Color(0xFFB3261E)
        : item.progressStatus == 'For Validation'
        ? Colors.blue
        : AppColors.gold;

    final statusLabel = item.isCleared
        ? 'Cleared'
        : item.hasConflict
        ? 'Concern Reported'
        : item.assignmentStatus;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: AppColors.gold.withOpacity(0.18),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const Icon(
            Icons.assignment_turned_in_rounded,
            color: AppColors.darkBrown,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.title,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
              if (item.programName.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  item.programName,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.black54,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(width: 8),
        _StatusPill(label: statusLabel, color: statusColor),
      ],
    );
  }
}

class _NoticeDetails extends StatelessWidget {
  const _NoticeDetails({required this.item, required this.formatMinutes});

  final RoAssignment item;
  final String Function(int minutes) formatMinutes;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.gold.withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withOpacity(0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _DetailRow(
            icon: Icons.apartment_rounded,
            label: 'Assigned Department',
            value: item.assignedArea.isEmpty ? '—' : item.assignedArea,
          ),
          const SizedBox(height: 10),
          _DetailRow(
            icon: Icons.timer_rounded,
            label: 'Required Hours',
            value:
                '${item.requiredHours} hour${item.requiredHours == 1 ? '' : 's'}',
          ),
          if (item.remarks.trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            _DetailRow(
              icon: Icons.notes_rounded,
              label: 'Remarks',
              value: item.remarks.trim(),
            ),
          ],
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 19, color: AppColors.darkBrown),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Colors.black54,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ProgressLine extends StatelessWidget {
  const _ProgressLine({
    required this.label,
    required this.value,
    required this.percent,
    required this.caption,
    required this.color,
  });

  final String label;
  final double value;
  final int percent;
  final String caption;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final trackColor = Theme.of(context).brightness == Brightness.dark
        ? Colors.white12
        : Colors.grey.shade300;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            Text(
              '$percent%',
              style: TextStyle(color: color, fontWeight: FontWeight.w900),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: value,
            minHeight: 11,
            backgroundColor: trackColor,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          caption,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Colors.black54,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _ActiveSessionBox extends StatelessWidget {
  const _ActiveSessionBox({
    required this.log,
    required this.formatElapsed,
    required this.formatDateTime,
  });

  final RoTimeLog log;
  final String Function(int seconds) formatElapsed;
  final String Function(DateTime? value) formatDateTime;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.gold.withOpacity(0.12),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withOpacity(0.45)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Currently Timed In',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(
            'Started: ${formatDateTime(log.timeInAt)}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.black54,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Elapsed: ${formatElapsed(log.elapsedSeconds)}',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
              color: AppColors.darkBrown,
            ),
          ),
          if (log.studentNote.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              log.studentNote,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.black54,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _LogsSection extends StatelessWidget {
  const _LogsSection({
    required this.logs,
    required this.formatMinutes,
    required this.formatDateTime,
  });

  final List<RoTimeLog> logs;
  final String Function(int minutes) formatMinutes;
  final String Function(DateTime? value) formatDateTime;

  @override
  Widget build(BuildContext context) {
    if (logs.isEmpty) {
      return const SizedBox.shrink();
    }

    return ExpansionTile(
      tilePadding: EdgeInsets.zero,
      childrenPadding: EdgeInsets.zero,
      title: const Text(
        'Recent Time Logs',
        style: TextStyle(fontWeight: FontWeight.w900),
      ),
      children: logs.take(5).map((log) {
        return Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.03),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${formatDateTime(log.timeInAt)} → ${formatDateTime(log.timeOutAt)}',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                '${formatMinutes(log.durationMinutes)} · ${log.validationStatus}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.black54,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (log.validationRemarks.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  log.validationRemarks,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.black54,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _InfoBox extends StatelessWidget {
  const _InfoBox({
    required this.icon,
    required this.title,
    required this.message,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String message;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(color: color, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 3),
                Text(
                  message,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.black54,
                    fontWeight: FontWeight.w600,
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

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 120),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w900,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _StateCard extends StatelessWidget {
  const _StateCard({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(22),
      child: Card(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            children: [
              Icon(icon, size: 44, color: AppColors.gold),
              const SizedBox(height: 16),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.black54,
                  fontWeight: FontWeight.w600,
                  height: 1.4,
                ),
              ),
              if (actionLabel != null && onAction != null) ...[
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: onAction,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.darkBrown,
                    foregroundColor: Colors.white,
                  ),
                  child: Text(actionLabel!),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

int _toInt(dynamic value) {
  if (value is int) return value;
  if (value is double) return value.round();
  if (value is num) return value.toInt();

  return int.tryParse(value?.toString() ?? '') ?? 0;
}

DateTime? _toDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}
