const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PATCH_NAME = 'SMaRT-PDM Mobile Endorsement UI Cleanup v1';
const PATCH_MARKER = 'SMART_PDM_ENDORSEMENT_UI_CLEANUP_V1';
const REQUIRED_SLIP_MARKER = 'SMART_PDM_ENDORSEMENT_SLIP_VIEW_DOWNLOAD_V1';

function parseArgs(argv) {
  let dryRun = false;
  let root = '.';

  for (const arg of argv) {
    if (arg === '--dry-run') dryRun = true;
    else root = arg;
  }

  return { dryRun, root: path.resolve(root) };
}

function normalize(value) {
  return String(value || '').replace(/\r\n/g, '\n');
}

function readRequired(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }

  return normalize(fs.readFileSync(filePath, 'utf8'));
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);

  if (first < 0) {
    throw new Error(`${label}: expected source block was not found.`);
  }

  const second = source.indexOf(before, first + before.length);

  if (second >= 0) {
    throw new Error(
      `${label}: expected exactly one source block, found more than one.`
    );
  }

  return source.slice(0, first) + after + source.slice(first + before.length);
}

function ensureIncludes(source, needles, label) {
  for (const needle of needles) {
    if (!source.includes(needle)) {
      throw new Error(`${label}: missing expected contract: ${needle}`);
    }
  }
}

function ensureExcludes(source, needles, label) {
  for (const needle of needles) {
    if (source.includes(needle)) {
      throw new Error(`${label}: obsolete UI/behavior remains: ${needle}`);
    }
  }
}

function run(command, args, cwd, label) {
  console.log(`\n> ${[command, ...args].join(' ')}`);

  let executable = command;
  let executableArgs = args;

  if (
    process.platform === 'win32' &&
    (command === 'npm' || command === 'flutter' || command === 'dart')
  ) {
    executable = process.env.ComSpec || 'cmd.exe';
    executableArgs = ['/d', '/s', '/c', [command, ...args].join(' ')];
  }

  const result = spawnSync(executable, executableArgs, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}.`);
  }
}

function makeBackup(root, originals) {
  const backupRoot = path.join(
    root,
    '.smart-pdm-patch-backup',
    `mobile-endorsement-ui-cleanup-v1-${Date.now()}`
  );

  for (const [filePath, original] of originals.entries()) {
    if (original == null) continue;

    const destination = path.join(backupRoot, path.relative(root, filePath));
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, original, 'utf8');
  }

  return backupRoot;
}

function rollback(originals) {
  for (const [filePath, original] of originals.entries()) {
    if (original == null) {
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
      continue;
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, original, 'utf8');
  }
}

function patchRefreshBehavior(source) {
  source = replaceOnce(
    source,
`import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';`,
`import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';`,
    'AppColors import'
  );

  source = replaceOnce(
    source,
`  bool _isLoading = true;
  bool _isViewingSlip = false;
  bool _isDownloadingSlip = false;
  String? _errorMessage;`,
`  bool _isLoading = true;
  bool _isRefreshingStatus = false;
  bool _isViewingSlip = false;
  bool _isDownloadingSlip = false;
  String? _errorMessage;`,
    'Endorsement refresh state'
  );

  source = replaceOnce(
    source,
`  @override
  void initState() {
    super.initState();
    _loadStatus();
    _pollingTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (mounted) {
        _loadStatus();
      }
    });
  }`,
`  @override
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
  }`,
    'Endorsement polling behavior'
  );

  source = replaceOnce(
    source,
`  void _handleNotificationProviderChange() {
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
  }`,
`  void _handleNotificationProviderChange() {
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
  }`,
    'Realtime silent refresh'
  );

  source = replaceOnce(
    source,
`  Future<void> _loadStatus() async {
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
      if (mounted) setState(() => _isLoading = false);
    }
  }`,
`  // ${PATCH_MARKER}
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

  Future<void> _retryStatus() => _loadStatus(showLoading: true);`,
    'Non-blocking Endorsement status loader'
  );

  source = replaceOnce(
    source,
`        onRefresh: _loadStatus,`,
`        onRefresh: _refreshStatus,`,
    'Pull-to-refresh'
  );

  source = replaceOnce(
    source,
`                onPrimaryAction: _loadStatus,`,
`                onPrimaryAction: _retryStatus,`,
    'Retry action'
  );

  return source;
}

function buildRedesignedView() {
  return `class _EndorsementView extends StatelessWidget {
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
        return 1;
    }
  }

  @override
  Widget build(BuildContext context) {
    const labels = [
      'Submitted',
      'SDO',
      'Guidance',
      'Program\nDirector',
      'Done',
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
      padding: const EdgeInsets.fromLTRB(10, 18, 10, 16),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: outline),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: List.generate(labels.length, (index) {
          final isDone = allDone || index < activeIndex;
          final isActive = !allDone && index == activeIndex;
          final nodeColor = isDone
              ? completedColor
              : isActive
              ? activeColor
              : outline;
          final connectorLeftDone = allDone || index <= activeIndex;
          final connectorRightDone = allDone || index < activeIndex;

          return Expanded(
            child: Column(
              children: [
                Row(
                  children: [
                    if (index > 0)
                      Expanded(
                        child: Container(
                          height: 2,
                          color: connectorLeftDone
                              ? completedColor
                              : outline,
                        ),
                      ),
                    Container(
                      width: 30,
                      height: 30,
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
                      ),
                      child: Icon(
                        isDone
                            ? Icons.check_rounded
                            : isActive
                            ? Icons.circle
                            : Icons.circle_outlined,
                        size: isDone ? 17 : 9,
                        color: isDone
                            ? (isDark
                                  ? AppColors.darkBrown
                                  : Colors.white)
                            : nodeColor,
                      ),
                    ),
                    if (index < labels.length - 1)
                      Expanded(
                        child: Container(
                          height: 2,
                          color: connectorRightDone
                              ? completedColor
                              : outline,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 9),
                Text(
                  labels[index],
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: isDone || isActive
                        ? primaryText
                        : secondaryText,
                    fontWeight: isDone || isActive
                        ? FontWeight.w800
                        : FontWeight.w600,
                    height: 1.15,
                  ),
                ),
              ],
            ),
          );
        }),
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
        .map((part) => '\${part[0].toUpperCase()}\${part.substring(1)}')
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
`;
}

function patchView(source) {
  const start = source.indexOf('class _EndorsementView extends StatelessWidget {');

  if (start < 0) {
    throw new Error(
      'Endorsement UI redesign: _EndorsementView class was not found.'
    );
  }

  return source.slice(0, start) + buildRedesignedView();
}

function buildContractTest() {
  return `const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const screen = fs.readFileSync(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'forms',
    'presentation',
    'screens',
    'endorsement_screen.dart'
  ),
  'utf8'
);

test('Uses the shared mobile light and dark color scheme', () => {
  assert.match(screen, /app\\/theme\\/app_colors\\.dart/);
  assert.match(screen, /AppColors\\.applicantLightSurface/);
  assert.match(screen, /AppColors\\.applicantDarkSurface/);
  assert.match(screen, /AppColors\\.applicantLightOutline/);
  assert.match(screen, /AppColors\\.applicantDarkOutline/);
});

test('Removes noisy metadata from the Endorsement header', () => {
  assert.doesNotMatch(screen, /Realtime tracking on/);
  assert.doesNotMatch(screen, /Code:/);
  assert.doesNotMatch(screen, /Now in:/);
  assert.doesNotMatch(screen, /_EndorsementTag/);
});

test('Current Step becomes Done after all endorsement reviews complete', () => {
  assert.match(screen, /String _currentStepLabel/);
  assert.match(screen, /if \\(_isCompleted\\(endorsement\\)\\) return 'Done'/);
  assert.match(screen, /'Current Step'/);
});

test('Removes the redundant Slip Status summary', () => {
  assert.doesNotMatch(screen, /'Slip Status'/);
  assert.doesNotMatch(screen, /_OverviewMiniItem/);
});

test('Renders a five-node connected Endorsement timeline', () => {
  assert.match(screen, /class _EndorsementRoadmap/);
  assert.match(screen, /'Submitted'/);
  assert.match(screen, /'SDO'/);
  assert.match(screen, /'Guidance'/);
  assert.match(screen, /'Program\\\\nDirector'/);
  assert.match(screen, /'Done'/);
  assert.match(screen, /height: 2/);
  assert.match(screen, /List\\.generate\\(labels\\.length/);
});

test('Keeps Office Results', () => {
  assert.match(screen, /title: 'Office Results'/);
  assert.match(screen, /_ReviewTile\\(label: 'SDO'/);
  assert.match(screen, /label: 'Guidance'/);
  assert.match(screen, /label: 'Program Director'/);
});

test('Office Results support dark mode', () => {
  assert.match(screen, /class _ReviewTile/);
  assert.match(screen, /AppColors\\.applicantDarkSurface/);
  assert.doesNotMatch(screen, /color: Colors\\.white,[\\s\\S]*class _ReviewTile/);
});

test('Redesigns official slip information without exposing internal slip code', () => {
  assert.match(screen, /title: 'Official Endorsement Slip'/);
  assert.match(screen, /'PDF ready'/);
  assert.match(screen, /'PDF not ready yet'/);
  assert.doesNotMatch(screen, /'Slip Code'/);
  assert.doesNotMatch(screen, /'Now in Office'/);
});

test('Keeps separate View and Download PDF actions', () => {
  assert.match(screen, /'View Slip'/);
  assert.match(screen, /'Download PDF'/);
  assert.match(screen, /onViewSlip/);
  assert.match(screen, /onDownloadSlip/);
  assert.match(screen, /constraints\\.maxWidth < 390/);
});

test('Status refresh no longer blocks the page every few seconds', () => {
  assert.match(screen, /bool _isRefreshingStatus = false/);
  assert.match(screen, /Duration\\(seconds: 60\\)/);
  assert.match(screen, /_loadStatus\\(silent: true\\)/);
  assert.match(screen, /if \\(_isRefreshingStatus\\) return/);
  assert.doesNotMatch(screen, /Duration\\(seconds: 8\\)/);
});

test('Background refresh preserves the currently visible status', () => {
  assert.match(
    screen,
    /A background refresh must not erase a valid page that is already on/
  );
  assert.doesNotMatch(
    screen,
    /catch \\(error\\)[\\s\\S]{0,300}_summary = null/
  );
});

test('Realtime updates remain enabled', () => {
  assert.match(screen, /provider\\.scholarAccessRevision/);
  assert.match(screen, /provider\\.applicationRevision/);
  assert.match(screen, /_handleNotificationProviderChange/);
});

test('Uses responsive controls and compact status components', () => {
  assert.match(screen, /LayoutBuilder\\(/);
  assert.match(screen, /constraints\\.maxWidth < 390/);
  assert.match(screen, /BoxConstraints\\(maxWidth: 180\\)/);
});

test('Removes the old vertical stage list and extra clutter sections', () => {
  assert.doesNotMatch(screen, /class _EndorsementStageList/);
  assert.doesNotMatch(screen, /'Where Your Slip Is Now'/);
  assert.doesNotMatch(screen, /'What Still Needs To Happen'/);
  assert.doesNotMatch(screen, /'Quick Actions'/);
});
`;
}

function validate(screen, contract) {
  ensureIncludes(
    screen,
    [
      PATCH_MARKER,
      "app/theme/app_colors.dart",
      'bool _isRefreshingStatus = false',
      'Duration(seconds: 60)',
      'class _EndorsementRoadmap extends StatelessWidget',
      "title: 'Endorsement Timeline'",
      "title: 'Official Endorsement Slip'",
      "title: 'Office Results'",
      "'Current Step'",
      "return 'Done'",
      "'Submitted'",
      "'Program\\nDirector'",
      "'View Slip'",
      "'Download PDF'",
      'AppColors.applicantDarkSurface',
      'AppColors.applicantLightSurface',
    ],
    'Redesigned Endorsement screen'
  );

  ensureExcludes(
    screen,
    [
      'Realtime tracking on',
      'Code:',
      'Now in:',
      "'Slip Status'",
      "'Slip Code'",
      "'Now in Office'",
      "'Where Your Slip Is Now'",
      "'What Still Needs To Happen'",
      "'Quick Actions'",
      'class _EndorsementStageList',
      'class _EndorsementTag',
      'class _OverviewMiniItem',
      'Duration(seconds: 8)',
    ],
    'Endorsement UI cleanup'
  );

  ensureIncludes(
    contract,
    [
      'Removes noisy metadata from the Endorsement header',
      'Current Step becomes Done after all endorsement reviews complete',
      'Renders a five-node connected Endorsement timeline',
      'Keeps Office Results',
      'Redesigns official slip information without exposing internal slip code',
      'Status refresh no longer blocks the page every few seconds',
    ],
    'Endorsement cleanup tests'
  );
}

function main() {
  const { dryRun, root } = parseArgs(process.argv.slice(2));

  const files = {
    screen: path.join(
      root,
      'mobile',
      'frontend',
      'lib',
      'features',
      'forms',
      'presentation',
      'screens',
      'endorsement_screen.dart'
    ),
    contract: path.join(
      root,
      'mobile',
      'backend',
      'test',
      'endorsement-ui-cleanup-contract.test.js'
    ),
  };

  console.log(PATCH_NAME);
  console.log(`Repository: ${root}`);
  console.log(`Mode: ${dryRun ? 'dry-run' : 'apply'}\n`);

  const originalScreen = readRequired(files.screen);
  const originalContract = fs.existsSync(files.contract)
    ? normalize(fs.readFileSync(files.contract, 'utf8'))
    : null;

  console.log('[1/6] Verifying current Endorsement View + Download workflow...');
  ensureIncludes(
    originalScreen,
    [
      REQUIRED_SLIP_MARKER,
      'bool _isViewingSlip = false',
      'openDownloadedFilePreview',
      'saveDownloadedFile',
      'onViewSlip',
      'onDownloadSlip',
    ],
    'Existing Endorsement Slip workflow'
  );
  console.log('      PASS');

  console.log('[2/6] Removing blocking 8-second refresh behavior...');
  let stagedScreen = patchRefreshBehavior(originalScreen);
  console.log('      PASS');

  console.log('[3/6] Rebuilding Endorsement UI with mobile theme colors + dark mode...');
  stagedScreen = patchView(stagedScreen);
  console.log('      PASS');

  console.log('[4/6] Building five-step horizontal Endorsement timeline...');
  ensureIncludes(
    stagedScreen,
    [
      'class _EndorsementRoadmap extends StatelessWidget',
      "'Submitted'",
      "'SDO'",
      "'Guidance'",
      "'Program\\nDirector'",
      "'Done'",
      'height: 2',
    ],
    'Horizontal Endorsement timeline'
  );
  console.log('      PASS');

  console.log('[5/6] Cleaning summary + redesigning slip information while preserving Office Results...');
  validate(stagedScreen, buildContractTest());
  console.log('      PASS');

  console.log('[6/6] Building targeted Endorsement UI regression tests...');
  const stagedContract = buildContractTest();
  validate(stagedScreen, stagedContract);
  console.log('      PASS');

  console.log('\nFiles affected by this installer:');
  console.log('  1. mobile/frontend/lib/features/forms/presentation/screens/endorsement_screen.dart');
  console.log('  2. mobile/backend/test/endorsement-ui-cleanup-contract.test.js (new)');
  console.log('\nNot modified:');
  console.log('  - mobile/backend/src/services/applicationService.js');
  console.log('  - mobile/backend/src/controllers/applicationController.js');
  console.log('  - mobile/backend/src/routes/applicationRoutes.js');
  console.log('  - mobile/frontend/lib/app/theme/app_colors.dart');
  console.log('  - Supabase schema/storage');

  if (dryRun) {
    console.log('\nPASS: dry-run completed. No files were changed.');
    return;
  }

  const originals = new Map([
    [files.screen, originalScreen],
    [files.contract, originalContract],
  ]);

  const backupRoot = makeBackup(root, originals);
  let wroteFiles = false;

  try {
    fs.writeFileSync(files.screen, stagedScreen, 'utf8');
    fs.mkdirSync(path.dirname(files.contract), { recursive: true });
    fs.writeFileSync(files.contract, stagedContract, 'utf8');
    wroteFiles = true;

    run(
      process.execPath,
      ['--test', files.contract],
      path.join(root, 'mobile', 'backend'),
      'Endorsement UI cleanup contract tests'
    );

    run(
      'dart',
      ['format', '--output=none', files.screen],
      path.join(root, 'mobile', 'frontend'),
      'Endorsement Dart formatter/syntax validation'
    );

    console.log('\nPASS: Endorsement UI cleanup completed.');
    console.log('\nVerified behavior:');
    console.log('  [x] Uses the mobile light/dark color scheme');
    console.log('  [x] Removes realtime/code/opening/current-office metadata chips');
    console.log('  [x] Current Step shows Done after SDO + Guidance + PD complete');
    console.log('  [x] Removes redundant Slip Status');
    console.log('  [x] Uses a 5-node horizontal connected timeline');
    console.log('  [x] Keeps Office Results');
    console.log('  [x] Redesigns official slip information');
    console.log('  [x] Keeps View Slip + Download PDF');
    console.log('  [x] Buttons stack on narrow screens');
    console.log('  [x] Realtime refresh stays enabled');
    console.log('  [x] Fallback polling reduced from 8s to 60s');
    console.log('  [x] Background refresh no longer replaces the page with a spinner');
    console.log(`\nBackup: ${backupRoot}`);
  } catch (error) {
    if (wroteFiles) {
      console.error('\nPatch verification failed. Restoring previous files...');
      rollback(originals);
      console.error(`Rollback completed. Backup: ${backupRoot}`);
    }

    throw error;
  }
}

try {
  main();
} catch (error) {
  console.error(`\nFAIL: ${error.message}`);
  process.exitCode = 1;
}
