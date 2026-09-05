import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/payout_service.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_nav_chips.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class PayoutScheduleScreen extends StatefulWidget {
  final bool showBottomNav;
  final bool showTopBar;

  const PayoutScheduleScreen({
    super.key,
    this.showBottomNav = true,
    this.showTopBar = true,
  });

  @override
  State<PayoutScheduleScreen> createState() => _PayoutScheduleScreenState();
}

class _PayoutScheduleScreenState extends State<PayoutScheduleScreen> {
  final PayoutService _payoutService = PayoutService();

  String _selectedScholarView = 'Payout Schedule';
  bool _loading = true;
  String? _error;
  List<MobilePayoutItem> _payouts = [];
  NotificationProvider? _notificationProvider;
  int _lastPayoutRevision = 0;
  final Set<String> _uploadingProofs = <String>{};
  Timer? _liveSyncTimer;
  bool _fetchInProgress = false;
  bool _pendingLiveRefresh = false;

  @override
  void initState() {
    super.initState();
    _loadPayouts();
    _markPayoutNotificationsAsRead();
    _liveSyncTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
      if (MobileRealtimeService.instance.isRealtimeHealthy) return;
      _requestLiveRefresh();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (_notificationProvider == provider) {
      return;
    }

    _notificationProvider?.removeListener(_handleRealtimePayouts);
    _notificationProvider = provider;
    _lastPayoutRevision = provider.payoutRevision;
    _notificationProvider?.addListener(_handleRealtimePayouts);
  }

  void _handleRealtimePayouts() {
    final provider = _notificationProvider;
    if (provider == null) {
      return;
    }

    if (provider.payoutRevision == _lastPayoutRevision) {
      return;
    }

    _lastPayoutRevision = provider.payoutRevision;

    _requestLiveRefresh();
  }

  Future<void> _markPayoutNotificationsAsRead() async {
    try {
      final notificationProvider = context.read<NotificationProvider>();
      await notificationProvider.markPayoutNotificationsAsRead();
    } catch (_) {
      // Silently handle errors - don't block the UI
    }
  }

  Future<void> _loadPayouts({bool silent = false}) async {
    if (_fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }

    _fetchInProgress = true;
    if (!silent && mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final items = await _payoutService.fetchMyPayouts();
      if (!mounted) return;
      setState(() {
        _payouts = items;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      if (!silent || _payouts.isEmpty) {
        setState(() => _error = e.toString());
      }
    } finally {
      _fetchInProgress = false;
      if (mounted && !silent) {
        setState(() => _loading = false);
      }
      if (_pendingLiveRefresh && mounted && _uploadingProofs.isEmpty) {
        _pendingLiveRefresh = false;
        scheduleMicrotask(() => _loadPayouts(silent: true));
      }
    }
  }

  void _requestLiveRefresh() {
    if (!mounted) return;
    if (_uploadingProofs.isNotEmpty || _fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }
    _loadPayouts(silent: true);
  }

  Future<void> _pickAndUploadProof(MobilePayoutItem payout) async {
    if (_uploadingProofs.contains(payout.payoutEntryId)) return;

    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
      allowMultiple: false,
      withData: kIsWeb,
    );

    if (result == null || result.files.isEmpty) return;

    final file = result.files.single;
    const maxBytes = 10 * 1024 * 1024;
    final extension = file.name.contains('.')
        ? file.name.split('.').last.toLowerCase()
        : '';
    const allowed = {'pdf', 'jpg', 'jpeg', 'png', 'webp'};

    if (file.size <= 0) {
      _showMessage('The selected file is empty.');
      return;
    }
    if (file.size > maxBytes) {
      _showMessage('Payout proof must be 10 MB or smaller.');
      return;
    }
    if (!allowed.contains(extension)) {
      _showMessage('Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.');
      return;
    }
    if (kIsWeb && (file.bytes == null || file.bytes!.isEmpty)) {
      _showMessage('The selected file could not be read. Choose it again.');
      return;
    }
    if (!kIsWeb && (file.path == null || file.path!.trim().isEmpty)) {
      _showMessage('The selected file could not be accessed. Choose it again.');
      return;
    }

    setState(() => _uploadingProofs.add(payout.payoutEntryId));
    try {
      await _payoutService.uploadProof(
        payoutEntryId: payout.payoutEntryId,
        fileName: file.name,
        filePath: kIsWeb ? null : file.path,
        fileBytes: file.bytes,
      );
      if (!mounted) return;
      _showMessage('Payout proof submitted for review.');
      await _loadPayouts(silent: true);
    } catch (error) {
      if (!mounted) return;
      _showMessage(error.toString());
    } finally {
      if (mounted) {
        setState(() => _uploadingProofs.remove(payout.payoutEntryId));
        if (_pendingLiveRefresh && _uploadingProofs.isEmpty) {
          _pendingLiveRefresh = false;
          scheduleMicrotask(() => _loadPayouts(silent: true));
        }
      }
    }
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  AppStatusTone _proofStatusTone(String status) {
    switch (status.trim().toLowerCase()) {
      case 'verified':
        return AppStatusTone.success;
      case 'resubmission required':
        return AppStatusTone.actionRequired;
      case 'rejected':
        return AppStatusTone.danger;
      default:
        return AppStatusTone.inProgress;
    }
  }

  Widget _buildProofSection(
    MobilePayoutItem payout,
    Color titleColor,
    Color subtitleColor,
  ) {
    if (payout.status.trim().toLowerCase() != 'released') {
      return const SizedBox.shrink();
    }

    final proof = payout.proof;
    final isUploading = _uploadingProofs.contains(payout.payoutEntryId);
    final canUpload = proof == null || proof.mayReplace;
    final adminComment = proof?.adminComment?.trim() ?? '';
    final feedback = adminComment.isNotEmpty
        ? adminComment
        : (proof?.rejectionReason?.trim() ?? '');

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Proof of Receipt',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: titleColor,
                  ),
                ),
              ),
              if (proof != null)
                AppStatusCapsule(
                  label: proof.status,
                  tone: _proofStatusTone(proof.status),
                  compact: true,
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            proof == null
                ? 'Upload proof after receiving this payout.'
                : (proof.fileName?.trim().isNotEmpty == true
                      ? proof.fileName!
                      : 'Proof submitted'),
            style: Theme.of(
              context,
            ).textTheme.labelMedium?.copyWith(color: subtitleColor),
          ),
          if (feedback.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(
              'Admin feedback: $feedback',
              style: Theme.of(
                context,
              ).textTheme.labelMedium?.copyWith(color: subtitleColor),
            ),
          ],
          if (canUpload) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: isUploading ? null : () => _pickAndUploadProof(payout),
              icon: isUploading
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.upload_file_outlined),
              label: Text(
                isUploading
                    ? 'Uploading...'
                    : proof == null
                    ? 'Upload Proof'
                    : 'Replace Proof',
              ),
            ),
          ],
        ],
      ),
    );
  }

  AppStatusTone _statusTone(String status) {
    switch (status.trim().toLowerCase()) {
      case 'released':
      case 'paid':
      case 'completed':
        return AppStatusTone.success;
      case 'approved':
        return AppStatusTone.inProgress;
      case 'processing':
      case 'on hold':
        return AppStatusTone.actionRequired;
      case 'absent':
        return AppStatusTone.danger;
      case 'pending':
      default:
        return AppStatusTone.neutral;
    }
  }

  Color _statusAccent(BuildContext context, String status) {
    final colors = AppStatusColors.of(context);
    return switch (_statusTone(status)) {
      AppStatusTone.success => colors.onSuccessContainer,
      AppStatusTone.inProgress => colors.onInProgressContainer,
      AppStatusTone.actionRequired => colors.onActionRequiredContainer,
      AppStatusTone.danger => colors.onDangerContainer,
      AppStatusTone.neutral => colors.onNeutralContainer,
      AppStatusTone.brand => AppColors.gold,
    };
  }

  IconData _getStatusIcon(String status) {
    switch (status.toLowerCase()) {
      case 'released':
      case 'paid':
      case 'completed':
        return Icons.check_circle;
      case 'approved':
        return Icons.verified;
      case 'processing':
      case 'on hold':
        return Icons.schedule;
      case 'absent':
        return Icons.cancel;
      case 'pending':
      default:
        return Icons.schedule;
    }
  }

  String _formatAmount(double value) {
    return 'PHP ${value.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    final titleColor = AppSurfacePalette.text(context);
    final subtitleColor = AppSurfacePalette.mutedText(context);

    return SmartPdmPageScaffold(
      appBar: widget.showTopBar
          ? AppBar(
              title: const Text('Payout Schedule'),
              automaticallyImplyLeading: false,
            )
          : null,
      selectedIndex: 1,
      showBottomNav: widget.showBottomNav,
      child: RefreshIndicator(
        onRefresh: () => _loadPayouts(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (widget.showTopBar)
                ScholarNavChips(
                  selectedLabel: _selectedScholarView,
                  hasNewPayouts: context.select<NotificationProvider, bool>(
                    (provider) => provider.unreadPayoutCount > 0,
                  ),
                  onTap: (label) {
                    setState(() {
                      _selectedScholarView = label;
                    });

                    switch (label) {
                      case 'Payout Schedule':
                        AppNavigator.goToTopLevel(context, AppRoutes.payouts);
                        break;
                      case 'Renewal Documents':
                        Navigator.pushNamed(
                          context,
                          AppRoutes.renewalDocuments,
                        );
                        break;
                    }
                  },
                ),
              if (widget.showTopBar) const SizedBox(height: 20),
              AppSectionHeading(
                title: 'Payout Schedule',
                subtitle:
                    'Track payout dates, release status, and proof-of-receipt review.',
              ),
              const SizedBox(height: AppSpacing.md),

              if (_loading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_error != null)
                AppSurfaceCard(
                  child: Column(
                    children: [
                      AppIconTile(
                        icon: Icons.cloud_off_rounded,
                        accent: Theme.of(context).colorScheme.error,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        'Failed to load payout schedule.',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: titleColor,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: subtitleColor,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      FilledButton(
                        onPressed: () => _loadPayouts(),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              else if (_payouts.isEmpty)
                AppSurfaceCard(
                  child: Row(
                    children: [
                      const AppIconTile(icon: Icons.payments_outlined),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Text(
                          'No payout schedule is available yet. New payout records will appear here when OSFA publishes them.',
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: subtitleColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _payouts.length,
                  itemBuilder: (context, index) {
                    final payout = _payouts[index];
                    return AppSurfaceCard(
                      margin: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                AppIconTile(
                                  icon: _getStatusIcon(payout.status),
                                  accent: _statusAccent(
                                    context,
                                    payout.status,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        payout.title,
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodyLarge
                                            ?.copyWith(
                                              fontWeight: FontWeight.bold,
                                              color: titleColor,
                                            ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        payout.programName,
                                        style: Theme.of(context)
                                            .textTheme
                                            .labelMedium
                                            ?.copyWith(color: subtitleColor),
                                      ),
                                      if ((payout.benefactorName ?? '')
                                          .isNotEmpty) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          payout.benefactorName!,
                                          style: Theme.of(context)
                                              .textTheme
                                              .labelMedium
                                              ?.copyWith(color: subtitleColor),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      _formatAmount(payout.amount),
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodyLarge
                                          ?.copyWith(
                                            fontWeight: FontWeight.bold,
                                            color: titleColor,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    AppStatusCapsule(
                                      label: payout.status,
                                      tone: _statusTone(payout.status),
                                      compact: true,
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            const Divider(),
                            const SizedBox(height: 10),
                            _infoRow(
                              'Payout Date',
                              payout.payoutDate.isEmpty
                                  ? 'TBA'
                                  : payout.payoutDate,
                              subtitleColor,
                            ),
                            _infoRow(
                              'Semester',
                              payout.semester.isEmpty ? '-' : payout.semester,
                              subtitleColor,
                            ),
                            _infoRow(
                              'School Year',
                              payout.schoolYear.isEmpty
                                  ? '-'
                                  : payout.schoolYear,
                              subtitleColor,
                            ),
                            _infoRow(
                              'Payment Mode',
                              payout.paymentMode.isEmpty
                                  ? '-'
                                  : payout.paymentMode,
                              subtitleColor,
                            ),
                            _infoRow(
                              'Batch Status',
                              payout.batchStatus.isEmpty
                                  ? '-'
                                  : payout.batchStatus,
                              subtitleColor,
                            ),
                            _infoRow(
                              'Reference',
                              payout.reference.isEmpty ? '-' : payout.reference,
                              subtitleColor,
                            ),
                            _buildProofSection(
                              payout,
                              titleColor,
                              subtitleColor,
                            ),
                          ],
                        ),
                      );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              '$label:',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(
                context,
              ).textTheme.labelMedium?.copyWith(color: color),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _liveSyncTimer?.cancel();
    _notificationProvider?.removeListener(_handleRealtimePayouts);
    super.dispose();
  }
}
