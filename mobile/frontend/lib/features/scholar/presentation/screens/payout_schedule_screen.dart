import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
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

enum _ProofUploadSource { camera, file }

// SMART-PDM_MOBILE_SCHOLAR_PAYOUT_RESPONSIVE_PHASE4_V1

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
  final Set<String> _expandedPayouts = <String>{};
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
        _expandedPayouts.removeWhere(
          (id) => !items.any((item) => item.payoutEntryId == id),
        );
      });
    } catch (e) {
      if (!mounted) return;
      if (!silent || _payouts.isEmpty) {
        debugPrint('PAYOUT LOAD ERROR: $e');
        setState(
          () => _error =
              'We could not load your payout details. Check your connection and try again.',
        );
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

  Future<_ProofUploadSource?> _chooseProofUploadSource() async {
    if (kIsWeb) return _ProofUploadSource.file;
    if (!mounted) return null;

    return showModalBottomSheet<_ProofUploadSource>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Choose upload source',
                style: Theme.of(
                  sheetContext,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 6),
              Text(
                'Take a photo of your payout proof or choose an existing file.',
                style: Theme.of(sheetContext).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Camera'),
                subtitle: const Text('Take a new photo of the proof'),
                onTap: () =>
                    Navigator.pop(sheetContext, _ProofUploadSource.camera),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.folder_open_outlined),
                title: const Text('Choose File'),
                subtitle: const Text('PDF, JPG, JPEG, PNG, or WEBP'),
                onTap: () =>
                    Navigator.pop(sheetContext, _ProofUploadSource.file),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickAndUploadProof(MobilePayoutItem payout) async {
    if (_uploadingProofs.contains(payout.payoutEntryId)) return;

    final source = await _chooseProofUploadSource();
    if (source == null || !mounted) return;

    String fileName;
    String? filePath;
    Uint8List? fileBytes;
    int fileSize;

    if (source == _ProofUploadSource.camera) {
      final photo = await ImagePicker().pickImage(
        source: ImageSource.camera,
        imageQuality: 92,
        maxWidth: 2400,
        maxHeight: 2400,
      );
      if (photo == null) return;

      fileName = photo.name.trim().isNotEmpty
          ? photo.name
          : 'payout_proof_${DateTime.now().millisecondsSinceEpoch}.jpg';
      filePath = photo.path;
      fileSize = await photo.length();
    } else {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
        allowMultiple: false,
        withData: kIsWeb,
      );
      if (result == null || result.files.isEmpty) return;

      final file = result.files.single;
      fileName = file.name;
      filePath = kIsWeb ? null : file.path;
      fileBytes = file.bytes;
      fileSize = file.size;
    }

    const maxBytes = 10 * 1024 * 1024;
    final extension = fileName.contains('.')
        ? fileName.split('.').last.toLowerCase()
        : '';
    const allowed = {'pdf', 'jpg', 'jpeg', 'png', 'webp'};

    if (fileSize <= 0) {
      _showMessage('The selected file is empty.');
      return;
    }
    if (fileSize > maxBytes) {
      _showMessage('Payout proof must be 10 MB or smaller.');
      return;
    }
    if (!allowed.contains(extension)) {
      _showMessage('Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.');
      return;
    }
    if (kIsWeb &&
        source == _ProofUploadSource.file &&
        (fileBytes == null || fileBytes.isEmpty)) {
      _showMessage('The selected file could not be read. Choose it again.');
      return;
    }
    if (!kIsWeb && (filePath == null || filePath.trim().isEmpty)) {
      _showMessage('The selected file could not be accessed. Choose it again.');
      return;
    }

    setState(() => _uploadingProofs.add(payout.payoutEntryId));
    try {
      await _payoutService.uploadProof(
        payoutEntryId: payout.payoutEntryId,
        fileName: fileName,
        filePath: filePath,
        fileBytes: fileBytes,
      );
      if (!mounted) return;
      _showMessage('Payout proof submitted for review.');
      await _loadPayouts(silent: true);
    } catch (error) {
      if (!mounted) return;
      debugPrint('PAYOUT PROOF UPLOAD ERROR: $error');
      _showMessage(
        'We could not upload your payout proof. Check the file and try again.',
      );
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

  Future<void> _previewProof(MobilePayoutItem payout) async {
    final proof = payout.proof;
    final fileUrl = proof?.fileUrl?.trim() ?? '';
    if (fileUrl.isEmpty) {
      _showMessage('No uploaded proof is available yet.');
      return;
    }

    final uri = Uri.tryParse(fileUrl);
    if (uri == null || !uri.hasScheme) {
      _showMessage('This proof cannot be opened right now. Try again later.');
      return;
    }

    final path = uri.path.toLowerCase();
    final isImage =
        path.endsWith('.jpg') ||
        path.endsWith('.jpeg') ||
        path.endsWith('.png') ||
        path.endsWith('.webp');

    if (!isImage) {
      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened && mounted) {
        _showMessage('Unable to open this proof on your device.');
      }
      return;
    }

    if (!mounted) return;
    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        final size = MediaQuery.sizeOf(dialogContext);
        return Dialog(
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 18,
            vertical: 28,
          ),
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.card),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: 520,
              maxHeight: size.height * 0.78,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          proof?.fileName?.trim().isNotEmpty == true
                              ? proof!.fileName!
                              : 'Proof of Payout',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(dialogContext).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Close preview',
                        onPressed: () => Navigator.of(dialogContext).pop(),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Flexible(
                  child: Container(
                    width: double.infinity,
                    color: AppSurfacePalette.surfaceMuted(dialogContext),
                    padding: const EdgeInsets.all(12),
                    child: InteractiveViewer(
                      minScale: 0.8,
                      maxScale: 4,
                      child: Center(
                        child: Image.network(
                          fileUrl,
                          fit: BoxFit.contain,
                          loadingBuilder: (context, child, progress) {
                            if (progress == null) return child;
                            return const Center(
                              child: Padding(
                                padding: EdgeInsets.all(30),
                                child: CircularProgressIndicator(),
                              ),
                            );
                          },
                          errorBuilder: (_, _, _) => const Padding(
                            padding: EdgeInsets.all(24),
                            child: Text(
                              'Unable to display this proof preview.',
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  String _proofStatusLabel(String status) {
    switch (status.trim().toLowerCase()) {
      case 'verified':
        return 'Verified';
      case 'rejected':
      case 'resubmission required':
        return 'New Proof Needed';
      case 'pending':
      case 'pending review':
        return 'Under Review';
      default:
        return status.trim().isEmpty ? 'Under Review' : status;
    }
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
          LayoutBuilder(
            builder: (context, constraints) {
              final textScale = MediaQuery.textScalerOf(context).scale(1);
              final stackHeader =
                  constraints.maxWidth < 300 || textScale > 1.25;
              final title = Text(
                proof == null ? 'Payout Proof Needed' : 'Payout Proof',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: titleColor,
                ),
              );
              final status = proof == null
                  ? null
                  : AppStatusCapsule(
                      label: _proofStatusLabel(proof.status),
                      tone: _proofStatusTone(proof.status),
                      compact: true,
                    );

              if (stackHeader) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    title,
                    if (status != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      status,
                    ],
                  ],
                );
              }

              return Row(
                children: [
                  Expanded(child: title),
                  if (status != null) ...[
                    const SizedBox(width: AppSpacing.sm),
                    status,
                  ],
                ],
              );
            },
          ),
          const SizedBox(height: 6),
          Text(
            proof == null
                ? 'Your payout has been released. Upload your proof so OSFA can review it.'
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
              'OSFA Feedback: $feedback',
              style: Theme.of(
                context,
              ).textTheme.labelMedium?.copyWith(color: subtitleColor),
            ),
          ],
          if (proof?.fileUrl?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: isUploading ? null : () => _previewProof(payout),
              icon: const Icon(Icons.visibility_outlined),
              label: const Text('Preview'),
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

  String _formatPayoutDate(String value) {
    final raw = value.trim();
    if (raw.isEmpty) return 'TBA';

    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;

    const months = <String>[
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    return '${months[parsed.month - 1]} ${parsed.day}, ${parsed.year}';
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
                    'View current and previous payout releases. Tap a payout to see its full details.',
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
                        'Unable to load payouts',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: titleColor,
                            ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: subtitleColor),
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
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: subtitleColor),
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
                    final isExpanded = _expandedPayouts.contains(
                      payout.payoutEntryId,
                    );
                    return AppSurfaceCard(
                      margin: const EdgeInsets.only(bottom: AppSpacing.md),
                      padding: EdgeInsets.zero,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: double.infinity,
                            child: InkWell(
                              onTap: () => setState(() {
                                if (isExpanded) {
                                  _expandedPayouts.remove(payout.payoutEntryId);
                                } else {
                                  _expandedPayouts
                                    ..clear()
                                    ..add(payout.payoutEntryId);
                                }
                              }),
                              borderRadius: AppRadii.card,
                              child: Padding(
                                padding: const EdgeInsets.all(AppSpacing.md),
                                child: _buildPayoutHeader(
                                  payout,
                                  titleColor,
                                  subtitleColor,
                                  isExpanded: isExpanded,
                                ),
                              ),
                            ),
                          ),
                          AnimatedSize(
                            duration: const Duration(milliseconds: 220),
                            curve: Curves.easeOutCubic,
                            child: isExpanded
                                ? Padding(
                                    padding: const EdgeInsets.fromLTRB(
                                      AppSpacing.md,
                                      0,
                                      AppSpacing.md,
                                      AppSpacing.md,
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const Divider(),
                                        const SizedBox(height: 10),
                                        _infoRow(
                                          'Payout Date',
                                          _formatPayoutDate(payout.payoutDate),
                                          subtitleColor,
                                        ),
                                        _infoRow(
                                          'Semester',
                                          payout.semester.isEmpty
                                              ? '-'
                                              : payout.semester,
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
                                          'Payment Method',
                                          payout.paymentMode.isEmpty
                                              ? '-'
                                              : payout.paymentMode,
                                          subtitleColor,
                                        ),
                                        if (payout.paymentMode
                                                    .trim()
                                                    .toLowerCase() ==
                                                'other' &&
                                            payout.payoutType.trim().isNotEmpty)
                                          _infoRow(
                                            'Payment Method Details',
                                            payout.payoutType,
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
                                          'Payout Code',
                                          payout.payoutCode.isEmpty
                                              ? '-'
                                              : payout.payoutCode,
                                          subtitleColor,
                                        ),
                                        _buildProofSection(
                                          payout,
                                          titleColor,
                                          subtitleColor,
                                        ),
                                      ],
                                    ),
                                  )
                                : const SizedBox.shrink(),
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
      child: LayoutBuilder(
        builder: (context, constraints) {
          final textScale = MediaQuery.textScalerOf(context).scale(1);
          final stackValues = constraints.maxWidth < 300 || textScale > 1.3;
          final labelText = Text(
            '$label:',
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: color,
            ),
          );
          final valueText = Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.labelMedium?.copyWith(color: color),
          );

          if (stackValues) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [labelText, const SizedBox(height: 2), valueText],
            );
          }

          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 110, child: labelText),
              Expanded(child: valueText),
            ],
          );
        },
      ),
    );
  }

  Widget _buildPayoutHeader(
    MobilePayoutItem payout,
    Color titleColor,
    Color subtitleColor, {
    required bool isExpanded,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final textScale = MediaQuery.textScalerOf(context).scale(1);
        final useCompactPhoneLayout =
            constraints.maxWidth < 420 || textScale > 1.15;

        if (useCompactPhoneLayout) {
          final period = <String>[
            if (payout.semester.trim().isNotEmpty) payout.semester.trim(),
            if (payout.schoolYear.trim().isNotEmpty) payout.schoolYear.trim(),
          ].join(' - ');
          final benefactor = (payout.benefactorName ?? '').trim();
          final statusAccent = _statusAccent(context, payout.status);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                payout.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: titleColor,
                ),
              ),
              if (period.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  period,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: titleColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              if (benefactor.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(
                      Icons.volunteer_activism_outlined,
                      size: 15,
                      color: subtitleColor,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        benefactor,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: subtitleColor),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 14),
              Divider(height: 1, color: subtitleColor.withValues(alpha: 0.18)),
              const SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Payout amount',
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: subtitleColor,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _formatAmount(payout.amount),
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: titleColor,
                              ),
                        ),
                      ],
                    ),
                  ),
                  AppStatusCapsule(
                    label: payout.status,
                    tone: _statusTone(payout.status),
                    compact: true,
                  ),
                  const SizedBox(width: 8),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: statusAccent.withValues(alpha: 0.10),
                      shape: BoxShape.circle,
                    ),
                    child: AnimatedRotation(
                      turns: isExpanded ? 0.5 : 0,
                      duration: const Duration(milliseconds: 180),
                      child: Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 22,
                        color: statusAccent,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          );
        }

        final stackSummary = constraints.maxWidth < 340 || textScale > 1.25;
        final identity = Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppIconTile(
              icon: _getStatusIcon(payout.status),
              accent: _statusAccent(context, payout.status),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    payout.title,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: titleColor,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (payout.semester.trim().isNotEmpty)
                        payout.semester.trim(),
                      if (payout.schoolYear.trim().isNotEmpty)
                        'AY ${payout.schoolYear.trim()}',
                    ].join(' - '),
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: titleColor,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    payout.programName,
                    style: Theme.of(
                      context,
                    ).textTheme.labelMedium?.copyWith(color: subtitleColor),
                  ),
                  if ((payout.benefactorName ?? '').isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      payout.benefactorName!,
                      style: Theme.of(
                        context,
                      ).textTheme.labelMedium?.copyWith(color: subtitleColor),
                    ),
                  ],
                ],
              ),
            ),
          ],
        );
        final summary = Column(
          crossAxisAlignment: stackSummary
              ? CrossAxisAlignment.start
              : CrossAxisAlignment.end,
          children: [
            Text(
              _formatAmount(payout.amount),
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: titleColor,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AppStatusCapsule(
                  label: payout.status,
                  tone: _statusTone(payout.status),
                  compact: true,
                ),
                const SizedBox(width: 8),
                AnimatedRotation(
                  turns: isExpanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 180),
                  child: Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: subtitleColor,
                  ),
                ),
              ],
            ),
          ],
        );

        if (stackSummary) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              identity,
              const SizedBox(height: AppSpacing.md),
              Padding(padding: const EdgeInsets.only(left: 52), child: summary),
            ],
          );
        }

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: identity),
            const SizedBox(width: AppSpacing.md),
            summary,
          ],
        );
      },
    );
  }

  @override
  void dispose() {
    _liveSyncTimer?.cancel();
    _notificationProvider?.removeListener(_handleRealtimePayouts);
    super.dispose();
  }
}
