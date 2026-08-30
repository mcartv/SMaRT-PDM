import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/payout_service.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_nav_chips.dart';
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
    _liveSyncTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
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

  Color _proofStatusColor(String status) {
    switch (status.trim().toLowerCase()) {
      case 'verified':
        return Colors.green;
      case 'resubmission required':
        return Colors.orange;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.blueGrey;
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
          Divider(color: Colors.grey.withOpacity(0.2)),
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
                Text(
                  proof.status,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: _proofStatusColor(proof.status),
                    fontWeight: FontWeight.w700,
                  ),
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
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: subtitleColor,
            ),
          ),
          if (feedback.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(
              'Admin feedback: $feedback',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: subtitleColor,
              ),
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

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'released':
      case 'paid':
      case 'completed':
        return Colors.green;
      case 'approved':
        return Colors.blue;
      case 'processing':
      case 'on hold':
        return Colors.orange;
      case 'absent':
        return Colors.red;
      case 'pending':
      default:
        return Colors.grey;
    }
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF332216) : Colors.white;
    final titleColor = isDark ? Colors.white : textColor;
    final subtitleColor = isDark ? Colors.white70 : Colors.black54;

    return SmartPdmPageScaffold(
      appBar: widget.showTopBar
          ? AppBar(
              title: const Text('Payout Schedule'),
              backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
              foregroundColor: isDark ? Colors.white : textColor,
              elevation: 0,
              automaticallyImplyLeading: false,
            )
          : null,
      selectedIndex: 1,
      showBottomNav: widget.showBottomNav,
      child: RefreshIndicator(
        onRefresh: () => _loadPayouts(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
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
              Text(
                'Payout Schedule',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: titleColor,
                ),
              ),
              const SizedBox(height: 12),

              if (_loading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_error != null)
                Card(
                  color: cardColor,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        Text(
                          'Failed to load payout schedule.',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: titleColor,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _error!,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(color: subtitleColor),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: () => _loadPayouts(),
                          child: Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              else if (_payouts.isEmpty)
                Card(
                  color: cardColor,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(
                      'No payout schedule available yet.',
                      style: TextStyle(color: subtitleColor),
                    ),
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _payouts.length,
                  itemBuilder: (context, index) {
                    final payout = _payouts[index];
                    return Card(
                      color: cardColor,
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    color: _getStatusColor(
                                      payout.status,
                                    ).withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Icon(
                                    _getStatusIcon(payout.status),
                                    color: _getStatusColor(payout.status),
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
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _getStatusColor(
                                          payout.status,
                                        ).withOpacity(0.2),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        payout.status,
                                        style: Theme.of(context)
                                            .textTheme
                                            .labelMedium
                                            ?.copyWith(
                                              color: _getStatusColor(
                                                payout.status,
                                              ),
                                              fontWeight: FontWeight.w600,
                                            ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            Divider(color: Colors.grey.withOpacity(0.2)),
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
