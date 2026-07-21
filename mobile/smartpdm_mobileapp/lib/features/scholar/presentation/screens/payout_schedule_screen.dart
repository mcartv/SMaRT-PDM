import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/constants/module_guidance_content.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/payout_service.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_nav_chips.dart';
import 'package:smartpdm_mobileapp/shared/widgets/module_guidance_card.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';
import 'package:smartpdm_mobileapp/shared/widgets/status_badge.dart';

class PayoutScheduleScreen extends StatefulWidget {
  const PayoutScheduleScreen({
    super.key,
    this.showBottomNav = true,
    this.showTopBar = true,
  });

  final bool showBottomNav;
  final bool showTopBar;

  @override
  State<PayoutScheduleScreen> createState() => _PayoutScheduleScreenState();
}

class _PayoutScheduleScreenState extends State<PayoutScheduleScreen> {
  final PayoutService _payoutService = PayoutService();

  String _selectedScholarView = 'Payout Schedule';
  bool _loading = true;
  String? _error;
  String? _uploadingEntryId;
  List<MobilePayoutItem> _payouts = [];
  NotificationProvider? _notificationProvider;
  int _lastPayoutRevision = 0;

  @override
  void initState() {
    super.initState();
    _loadPayouts();
    _markPayoutNotificationsAsRead();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final provider = context.read<NotificationProvider>();
    if (_notificationProvider == provider) return;
    _notificationProvider?.removeListener(_handleRealtimePayouts);
    _notificationProvider = provider;
    _lastPayoutRevision = provider.payoutRevision;
    _notificationProvider?.addListener(_handleRealtimePayouts);
  }

  void _handleRealtimePayouts() {
    final provider = _notificationProvider;
    if (provider == null || provider.payoutRevision == _lastPayoutRevision) {
      return;
    }
    _lastPayoutRevision = provider.payoutRevision;
    if (mounted) _loadPayouts();
  }

  Future<void> _markPayoutNotificationsAsRead() async {
    try {
      await context.read<NotificationProvider>().markPayoutNotificationsAsRead();
    } catch (_) {
      // Payout data remains available even when marking notifications fails.
    }
  }

  Future<void> _loadPayouts() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final items = await _payoutService.fetchMyPayouts();
      if (!mounted) return;
      setState(() => _payouts = items);
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _selectAndUploadProof(MobilePayoutItem payout) async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: false,
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
    );
    final file = result != null && result.files.isNotEmpty
        ? result.files.first
        : null;
    if (file == null || !mounted) return;

    if (file.size > 10 * 1024 * 1024) {
      _showMessage('The payout proof must not exceed 10 MB.');
      return;
    }

    setState(() => _uploadingEntryId = payout.payoutEntryId);
    try {
      await _payoutService.uploadProof(
        payoutEntryId: payout.payoutEntryId,
        fileName: file.name,
        filePath: file.path,
        fileBytes: file.bytes,
      );
      if (!mounted) return;
      _showMessage('Payout proof submitted for OSFA review.');
      await _loadPayouts();
    } catch (error) {
      if (!mounted) return;
      _showMessage(error.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _uploadingEntryId = null);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  String _amount(double value) => '₱${value.toStringAsFixed(0)}';

  String _date(String value) {
    if (value.trim().isEmpty) return 'To be announced';
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;
    return '${parsed.month}/${parsed.day}/${parsed.year}';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final secondaryColor = isDark ? Colors.white70 : AppColors.brown;

    return SmartPdmPageScaffold(
      appBar: widget.showTopBar
          ? AppBar(
              title: const Text('Payout Schedule'),
              backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
              foregroundColor: titleColor,
              elevation: 0,
              automaticallyImplyLeading: false,
            )
          : null,
      selectedIndex: 1,
      showBottomNav: widget.showBottomNav,
      showDrawer: false,
      child: RefreshIndicator(
        onRefresh: _loadPayouts,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            if (widget.showTopBar) ...[
              ScholarNavChips(
                selectedLabel: _selectedScholarView,
                hasNewPayouts: context.select<NotificationProvider, bool>(
                  (provider) => provider.unreadPayoutCount > 0,
                ),
                onTap: (label) {
                  setState(() => _selectedScholarView = label);
                  if (label == 'Payout Schedule') {
                    AppNavigator.goToTopLevel(context, AppRoutes.payouts);
                  } else if (label == 'Renewal Documents') {
                    Navigator.pushNamed(context, AppRoutes.renewalDocuments);
                  }
                },
              ),
              const SizedBox(height: 18),
            ],
            const ModuleGuidanceCard(
              title: ModuleGuidanceContent.payoutTitle,
              message: ModuleGuidanceContent.payoutBody,
            ),
            const SizedBox(height: 18),
            Text(
              'Your Payout Records',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: titleColor,
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 12),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              _MessageCard(
                icon: Icons.cloud_off_rounded,
                title: 'Unable to load payout records',
                message: _error!,
                onRetry: _loadPayouts,
              )
            else if (_payouts.isEmpty)
              const _MessageCard(
                icon: Icons.account_balance_wallet_outlined,
                title: 'No payout record yet',
                message: 'Your scheduled and released payouts will appear here.',
              )
            else
              ..._payouts.map(
                (payout) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: isDark ? const Color(0xFF332216) : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: isDark ? Colors.white10 : const Color(0xFFEDE4D9),
                      ),
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
                                color: AppColors.gold.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: const Icon(
                                Icons.account_balance_wallet_outlined,
                                color: AppColors.gold,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    payout.title,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleSmall
                                        ?.copyWith(
                                          color: titleColor,
                                          fontWeight: FontWeight.w900,
                                        ),
                                  ),
                                  const SizedBox(height: 3),
                                  Text(
                                    payout.programName,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodySmall
                                        ?.copyWith(color: secondaryColor),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  _amount(payout.amount),
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(
                                        color: titleColor,
                                        fontWeight: FontWeight.w900,
                                      ),
                                ),
                                const SizedBox(height: 5),
                                StatusBadge(label: payout.status),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        _InfoRow(label: 'Payout date', value: _date(payout.payoutDate)),
                        _InfoRow(label: 'Academic period', value: '${payout.semester} · ${payout.schoolYear}'),
                        _InfoRow(label: 'Payment mode', value: payout.paymentMode),
                        _InfoRow(label: 'Reference', value: payout.reference),
                        const Divider(height: 26),
                        _ProofSection(
                          payout: payout,
                          uploading: _uploadingEntryId == payout.payoutEntryId,
                          onUpload: payout.mayUploadProof
                              ? () => _selectAndUploadProof(payout)
                              : null,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _notificationProvider?.removeListener(_handleRealtimePayouts);
    super.dispose();
  }
}

class _ProofSection extends StatelessWidget {
  const _ProofSection({
    required this.payout,
    required this.uploading,
    required this.onUpload,
  });

  final MobilePayoutItem payout;
  final bool uploading;
  final VoidCallback? onUpload;

  @override
  Widget build(BuildContext context) {
    final proof = payout.proof;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : AppColors.darkBrown;

    if (proof == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payout Proof',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: textColor,
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 6),
          Text(
            payout.status.trim().toLowerCase() == 'released'
                ? 'No proof has been submitted for this released payout.'
                : 'Proof submission becomes available after OSFA marks the payout as released.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (onUpload != null) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: uploading ? null : onUpload,
                icon: uploading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.upload_file_rounded),
                label: Text(uploading ? 'Uploading...' : 'Upload Payout Proof'),
              ),
            ),
          ],
        ],
      );
    }

    final comment = (proof.adminComment ?? proof.rejectionReason ?? '').trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Payout Proof',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: textColor,
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ),
            StatusBadge(label: proof.status),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          proof.fileName?.isNotEmpty == true ? proof.fileName! : 'Submitted file',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
        ),
        if (comment.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: proof.mayReplace
                  ? Colors.red.withValues(alpha: 0.08)
                  : AppColors.gold.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'OSFA comment: $comment',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
        if (onUpload != null) ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: uploading ? null : onUpload,
              icon: uploading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh_rounded),
              label: Text(uploading ? 'Uploading...' : 'Replace Proof'),
            ),
          ),
        ],
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 112,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? Colors.white60
                        : AppColors.brown,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ),
          Expanded(
            child: Text(
              value.trim().isEmpty ? '—' : value,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({
    required this.icon,
    required this.title,
    required this.message,
    this.onRetry,
  });

  final IconData icon;
  final String title;
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: [
            Icon(icon, size: 34, color: AppColors.gold),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(message, textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: const Text('Try Again')),
            ],
          ],
        ),
      ),
    );
  }
}
