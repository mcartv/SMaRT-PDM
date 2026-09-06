import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';
import 'package:smartpdm_mobileapp/shared/models/scholar_renewal.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/renewal_service.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_nav_chips.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ScholarRenewalRequirementsScreen extends StatefulWidget {
  final bool showBottomNav;
  final bool showTopBar;

  const ScholarRenewalRequirementsScreen({
    super.key,
    this.showBottomNav = true,
    this.showTopBar = true,
  });

  @override
  State<ScholarRenewalRequirementsScreen> createState() =>
      _ScholarRenewalRequirementsScreenState();
}

class _ScholarRenewalRequirementsScreenState
    extends State<ScholarRenewalRequirementsScreen> {
  final RenewalService _renewalService = RenewalService();
  NotificationProvider? _notificationProvider;
  int _lastRenewalRevision = 0;

  ScholarRenewalPackage? _renewalPackage;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;
  final Map<String, bool> _uploadingDocuments = <String, bool>{};
  Timer? _liveSyncTimer;
  bool _fetchInProgress = false;
  bool _pendingLiveRefresh = false;

  @override
  void initState() {
    super.initState();
    _loadRenewal();
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

    _notificationProvider?.removeListener(_handleRealtimeRenewals);
    _notificationProvider = provider;
    _lastRenewalRevision = provider.renewalRevision;
    _notificationProvider?.addListener(_handleRealtimeRenewals);
  }

  Future<void> _loadRenewal({bool silent = false}) async {
    if (_fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }

    _fetchInProgress = true;
    if (!silent && mounted) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final payload = await _renewalService.fetchCurrentRenewal();
      if (!mounted) return;
      setState(() {
        _renewalPackage = payload;
        _errorMessage = null;
      });
    } catch (error) {
      if (!mounted) return;
      if (!silent || _renewalPackage == null) {
        setState(() {
          _errorMessage = error
              .toString()
              .replaceFirst('Exception: ', '')
              .trim();
        });
      }
    } finally {
      _fetchInProgress = false;
      if (mounted && !silent) {
        setState(() => _isLoading = false);
      }
      if (_pendingLiveRefresh &&
          mounted &&
          !_isSubmitting &&
          _uploadingDocuments.isEmpty) {
        _pendingLiveRefresh = false;
        scheduleMicrotask(() => _loadRenewal(silent: true));
      }
    }
  }

  void _requestLiveRefresh() {
    if (!mounted) return;
    if (_isSubmitting || _uploadingDocuments.isNotEmpty || _fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }
    _loadRenewal(silent: true);
  }

  void _handleRealtimeRenewals() {
    final provider = _notificationProvider;
    if (provider == null) {
      return;
    }

    if (provider.renewalRevision == _lastRenewalRevision) {
      return;
    }

    _lastRenewalRevision = provider.renewalRevision;

    _requestLiveRefresh();
  }

  @override
  void dispose() {
    _liveSyncTimer?.cancel();
    _notificationProvider?.removeListener(_handleRealtimeRenewals);
    super.dispose();
  }

  void _handleScholarChipTap(String label) {
    switch (label) {
      case 'Payout Schedule':
        Navigator.pop(context);
        break;
      case 'Renewal Documents':
        break;
    }
  }

  bool get _hasPendingReupload {
    final package = _renewalPackage;
    if (package == null) return false;

    final renewalStatus = package.renewal.renewalStatus.toLowerCase().trim();

    return renewalStatus == 'needs reupload' ||
        package.documents.any(
          (document) => document.status.toLowerCase().trim() == 'rejected',
        );
  }

  Future<void> _pickAndUploadDocument(ScholarRenewalDocument document) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
      allowMultiple: false,
      withData: kIsWeb,
    );

    if (result == null || result.files.isEmpty) {
      return;
    }

    final pickedFile = result.files.single;
    final fileName = pickedFile.name;
    final filePath = kIsWeb ? null : pickedFile.path;
    final fileBytes = pickedFile.bytes;
    final extension = fileName.split('.').last.toLowerCase();
    const maxFileSizeBytes = 8 * 1024 * 1024;

    if (pickedFile.size <= 0) {
      _showSnackBar('The selected file is empty. Choose another file.');
      return;
    }

    if (pickedFile.size > maxFileSizeBytes) {
      _showSnackBar('File is too large. Maximum size is 8 MB.');
      return;
    }

    const allowedExtensions = {'pdf', 'jpg', 'jpeg', 'png', 'webp'};

    if (!allowedExtensions.contains(extension)) {
      _showSnackBar('Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.');
      return;
    }

    if (kIsWeb && (fileBytes == null || fileBytes.isEmpty)) {
      _showSnackBar(
        'The selected file could not be read in the browser. Please try another file.',
      );
      return;
    }

    if (!kIsWeb && (filePath == null || filePath.trim().isEmpty)) {
      _showSnackBar(
        'The selected file could not be accessed. Choose the file again.',
      );
      return;
    }

    setState(() => _uploadingDocuments[document.id] = true);

    try {
      final payload = await _renewalService.uploadDocument(
        routeParam: document.routeParam,
        fileName: fileName,
        filePath: filePath,
        fileBytes: fileBytes,
      );

      if (!mounted) return;

      setState(() => _renewalPackage = payload);

      _showSnackBar('${document.documentType} uploaded successfully.');
    } catch (error) {
      if (!mounted) return;
      _showSnackBar(error.toString().replaceFirst('Exception: ', '').trim());
    } finally {
      if (mounted) {
        setState(() => _uploadingDocuments.remove(document.id));
        if (_pendingLiveRefresh && _uploadingDocuments.isEmpty) {
          _pendingLiveRefresh = false;
          scheduleMicrotask(() => _loadRenewal(silent: true));
        }
      }
    }
  }

  Future<void> _submitRenewal() async {
    if (_renewalPackage?.isRenewalAvailable == false) {
      final reason = _renewalPackage?.availabilityReason.trim() ?? '';

      _showSnackBar(
        reason.isNotEmpty
            ? reason
            : 'Renewal is not currently available for this academic semester.',
      );
      return;
    }
    if (_renewalPackage == null || !_renewalPackage!.allRequiredUploaded) {
      _showSnackBar('Please upload both required renewal documents first.');
      return;
    }

    if (_hasPendingReupload) {
      _showSnackBar(
        'Replace every document marked for re-upload before submitting again.',
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final payload = await _renewalService.submitRenewal();

      if (!mounted) return;

      setState(() => _renewalPackage = payload);

      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Renewal Submitted'),
          content: const Text(
            'Your renewal requirements have been submitted for admin review.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
    } catch (error) {
      if (!mounted) return;
      _showSnackBar(error.toString().replaceFirst('Exception: ', '').trim());
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
        if (_pendingLiveRefresh && _uploadingDocuments.isEmpty) {
          _pendingLiveRefresh = false;
          scheduleMicrotask(() => _loadRenewal(silent: true));
        }
      }
    }
  }

  bool _isImageDocument(ScholarRenewalDocument document) {
    final url = (document.fileUrl ?? '').toLowerCase();
    final type = document.documentType.toLowerCase();

    return url.contains('.jpg') ||
        url.contains('.jpeg') ||
        url.contains('.png') ||
        type.contains('image');
  }

  Future<void> _openFilePreview(ScholarRenewalDocument document) async {
    final fileUrl = document.fileUrl;

    if (fileUrl == null || fileUrl.trim().isEmpty) {
      _showSnackBar('No uploaded file is available yet.');
      return;
    }

    if (!_isImageDocument(document)) {
      _showSnackBar(
        'Inline preview is currently available for image files. PDF files can still be replaced from this screen.',
      );
      return;
    }

    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        final screenSize = MediaQuery.of(dialogContext).size;

        return Dialog(
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 18,
            vertical: 28,
          ),
          shape: const RoundedRectangleBorder(
            borderRadius: AppRadii.card,
          ),
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: 520,
              maxHeight: screenSize.height * 0.78,
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
                          document.documentType,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(dialogContext)
                              .textTheme
                              .titleSmall
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
                          errorBuilder: (_, _, _) {
                            return const Padding(
                              padding: EdgeInsets.all(24),
                              child: Text(
                                'Unable to display this image preview.',
                                textAlign: TextAlign.center,
                              ),
                            );
                          },
                          loadingBuilder: (context, child, progress) {
                            if (progress == null) return child;

                            return const Center(
                              child: Padding(
                                padding: EdgeInsets.all(30),
                                child: CircularProgressIndicator(),
                              ),
                            );
                          },
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

  void _showSnackBar(String message) {
    if (!mounted) return;

    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  String _statusLabel(
    ScholarRenewalDocument document,
    ScholarRenewalPackage package,
  ) {
    switch (document.status.trim().toLowerCase()) {
      case 'verified':
        return 'Verified';
      case 'uploaded':
        return 'Uploaded';
      case 'rejected':
        return package.renewal.isRejected ? 'Rejected' : 'Needs Re-upload';
      case 'pending':
      default:
        return 'Required';
    }
  }

  String _renewalSummary(ScholarRenewalPackage package) {
    if (!package.isRenewalAvailable) {
      return package.availabilityReason.trim().isNotEmpty
          ? package.availabilityReason
          : 'Renewal is not currently available for this academic semester.';
    }
    final renewal = package.renewal;
    final status = renewal.normalizedStatus;
    final adminComment = renewal.adminComment?.trim() ?? '';

    if (status == 'approved') {
      return 'Your renewal package has been approved for this cycle.';
    }

    if (status == 'rejected') {
      return adminComment.isNotEmpty
          ? 'Your renewal was rejected. Admin feedback: $adminComment'
          : 'Your renewal was rejected by the administrator.';
    }

    if (status == 'flagged') {
      return adminComment.isNotEmpty
          ? 'Your renewal needs administrator attention. Feedback: $adminComment'
          : 'Your renewal needs administrator attention.';
    }

    if (status == 'submitted' || status == 'under review') {
      return 'Your renewal package is now pending admin review.';
    }

    if (status == 'needs reupload') {
      return adminComment.isNotEmpty
          ? 'Admin requested a re-upload. Feedback: $adminComment'
          : 'Admin requested a re-upload. Replace the flagged file and submit again.';
    }

    return 'Upload both required documents to maintain your scholarship for the current release cycle.';
  }

  String _lockedSubmitLabel(ScholarRenewal renewal) {
    if (renewal.isApproved) return 'Renewal Approved';
    if (renewal.isRejected) return 'Renewal Rejected';
    if (renewal.isFlagged) return 'Renewal Flagged';
    return 'Awaiting Admin Review';
  }

  List<ScholarRenewalDocument> _sortedDocuments(
    List<ScholarRenewalDocument> documents,
  ) {
    final sorted = List<ScholarRenewalDocument>.from(documents);

    int priority(ScholarRenewalDocument document) {
      final status = document.status.trim().toLowerCase();
      if (status == 'rejected' || status.contains('reupload')) return 0;
      if (!document.isSubmitted) return 1;
      if (status.contains('pending') || status.contains('review')) return 2;
      if (status.contains('verified') || status.contains('approved')) return 3;
      return 4;
    }

    sorted.sort((a, b) => priority(a).compareTo(priority(b)));

    return sorted;
  }

  @override
  Widget build(BuildContext context) {
    final titleColor = AppSurfacePalette.text(context);
    final subtitleColor = AppSurfacePalette.mutedText(context);
    final accentColor = AppColors.gold;
    final documents = _renewalPackage == null
        ? const <ScholarRenewalDocument>[]
        : _sortedDocuments(_renewalPackage!.documents);

    final submitDisabled =
        _isSubmitting ||
        _renewalPackage?.isRenewalAvailable == false ||
        _renewalPackage?.renewal.isLockedForReview == true ||
        _renewalPackage?.allRequiredUploaded != true ||
        _hasPendingReupload;

    final submitLabel = _isSubmitting
        ? 'Submitting...'
        : _renewalPackage?.isRenewalAvailable == false
        ? 'Renewal Not Yet Available'
        : _renewalPackage?.renewal.isLockedForReview == true
        ? _lockedSubmitLabel(_renewalPackage!.renewal)
        : _hasPendingReupload
        ? 'Replace Re-upload Documents First'
        : 'Submit Renewal Requirements';

    return SmartPdmPageScaffold(
      appBar: widget.showTopBar
          ? AppBar(
              title: const Text('Renewal Documents'),
              backgroundColor: AppSurfacePalette.surface(context),
              foregroundColor: AppSurfacePalette.text(context),
              elevation: 0,
            )
          : null,
      selectedIndex: 3,
      showBottomNav: widget.showBottomNav,
      child: RefreshIndicator(
        onRefresh: () => _loadRenewal(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xxl),
          children: [
            if (widget.showTopBar) ...[
              ScholarNavChips(
                selectedLabel: 'Renewal Documents',
                onTap: _handleScholarChipTap,
              ),
              const SizedBox(height: 20),
            ],
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_errorMessage != null)
              _RenewalErrorCard(
                message: _errorMessage!,
                onRetry: () => _loadRenewal(),
              )
            else if (_renewalPackage == null)
              const _RenewalEmptyState()
            else ...[
              _buildHeaderCard(
                package: _renewalPackage!,
                titleColor: titleColor,
                subtitleColor: subtitleColor,
                accentColor: accentColor,
              ),
              if ((_renewalPackage!.renewal.adminComment ?? '')
                  .trim()
                  .isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                AppSurfaceCard(
                  backgroundColor:
                      AppStatusColors.of(context).actionRequiredContainer,
                  borderColor: AppStatusColors.of(context).actionRequiredOutline,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppIconTile(
                        icon: Icons.feedback_outlined,
                        accent: AppStatusColors.of(context).actionRequiredOutline,
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Administrator feedback',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(
                                    color: AppStatusColors.of(context)
                                        .onActionRequiredContainer,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              _renewalPackage!.renewal.adminComment!,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: AppStatusColors.of(context)
                                        .onActionRequiredContainer,
                                    height: 1.4,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              AppSectionHeading(
                title: 'Required Documents',
                subtitle:
                    'Upload your Certificate of Registration and latest Grade Form / Transcript. Allowed files: PDF, JPG, and PNG.',
              ),
              const SizedBox(height: AppSpacing.md),
              ...documents.map(
                (document) => _buildDocumentRow(
                  document: document,
                  package: _renewalPackage!,
                  titleColor: titleColor,
                  subtitleColor: subtitleColor,
                  accentColor: accentColor,
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: submitDisabled ? null : _submitRenewal,
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                  label: Text(submitLabel),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeaderCard({
    required ScholarRenewalPackage package,
    required Color titleColor,
    required Color subtitleColor,
    required Color accentColor,
  }) {
    final progress = package.documents.isEmpty
        ? 0.0
        : package.documents.where((document) => document.hasFile).length /
              package.documents.length;

    return AppSurfaceCard(
      backgroundColor: AppSurfacePalette.surface(context),
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
                      'Renewal Progress',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _renewalSummary(package),
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: subtitleColor,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '${package.documents.where((doc) => doc.hasFile).length}/${package.documents.length}',
                style: Theme.of(context).textTheme.displayLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: accentColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: AppRadii.status,
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: AppSurfacePalette.surfaceMuted(context),
              valueColor: AlwaysStoppedAnimation<Color>(accentColor),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoChip(
                icon: Icons.badge_outlined,
                label: package.studentNumber.isEmpty
                    ? package.studentName
                    : '${package.studentName} • ${package.studentNumber}',
              ),
              _InfoChip(
                icon: Icons.school_outlined,
                label:
                    '${package.programName} • ${package.semesterLabel} AY ${package.schoolYearLabel}',
              ),
              _InfoChip(
                icon: Icons.verified_outlined,
                label:
                    '${package.renewal.renewalStatus} • ${package.renewal.documentStatus}',
                semanticStatus: true,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentRow({
    required ScholarRenewalDocument document,
    required ScholarRenewalPackage package,
    required Color titleColor,
    required Color subtitleColor,
    required Color accentColor,
  }) {
    final isUploading = _uploadingDocuments[document.id] == true;
    final canUpload = !package.renewal.isLockedForReview;

    return AppSurfaceCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppIconTile(
            icon: document.documentType == 'Certificate of Registration'
                ? Icons.assignment_outlined
                : Icons.grade_outlined,
            accent: accentColor,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  document.documentType,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: titleColor,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  document.documentType == 'Certificate of Registration'
                      ? 'Official COR from the registrar for the current term.'
                      : 'Latest semester grades or transcript for renewal validation.',
                  style: Theme.of(
                    context,
                  ).textTheme.labelMedium?.copyWith(color: subtitleColor),
                ),
                if (document.hasFile || document.submittedAt != null) ...[
                  const SizedBox(height: 6),
                  if (document.hasFile)
                    Text(
                      'Submitted file available',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: AppSurfacePalette.mutedText(context),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  if (document.submittedAt != null)
                    Text(
                      document.submittedAt!,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: AppSurfacePalette.mutedText(context),
                      ),
                    ),
                  if (document.adminComment.trim().isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: AppStatusColors.of(context)
                            .actionRequiredContainer,
                        borderRadius: AppRadii.control,
                        border: Border.all(
                          color: AppStatusColors.of(context)
                              .actionRequiredOutline,
                        ),
                      ),
                      child: Text(
                        document.adminComment,
                        style: Theme.of(context)
                            .textTheme
                            .labelMedium
                            ?.copyWith(
                              height: 1.35,
                              color: AppStatusColors.of(context)
                                  .onActionRequiredContainer,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ),
                  ],
                ],
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      OutlinedButton.icon(
                        onPressed: isUploading || !canUpload
                            ? null
                            : () => _pickAndUploadDocument(document),
                        icon: isUploading
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Icon(
                                document.hasFile
                                    ? Icons.sync
                                    : Icons.upload_file,
                                size: 16,
                              ),
                        label: Text(
                          isUploading
                              ? 'Uploading...'
                              : document.hasFile
                              ? 'Replace file'
                              : 'Upload file',
                        ),
                      ),
                      if (document.hasFile)
                        TextButton.icon(
                          onPressed: () => _openFilePreview(document),
                          icon: const Icon(Icons.visibility_outlined, size: 16),
                          label: const Text('View file'),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          AppStatusCapsule(
            label: _statusLabel(document, package),
            tone: document.status.toLowerCase().contains('rejected')
                ? AppStatusTone.danger
                : document.status.toLowerCase().contains('reupload')
                ? AppStatusTone.actionRequired
                : document.status.toLowerCase().contains('verified')
                ? AppStatusTone.success
                : document.hasFile
                ? AppStatusTone.inProgress
                : AppStatusTone.neutral,
            compact: true,
          ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon,
    required this.label,
    this.semanticStatus = false,
  });

  final IconData icon;
  final String label;
  final bool semanticStatus;

  AppStatusTone _tone() {
    final normalized = label.toLowerCase();
    if (!semanticStatus) return AppStatusTone.neutral;
    if (normalized.contains('approved') ||
        normalized.contains('complete') ||
        normalized.contains('verified')) {
      return AppStatusTone.success;
    }
    if (normalized.contains('rejected')) return AppStatusTone.danger;
    if (normalized.contains('reupload') || normalized.contains('flagged')) {
      return AppStatusTone.actionRequired;
    }
    return AppStatusTone.inProgress;
  }

  @override
  Widget build(BuildContext context) {
    final tone = _tone();
    final colors = AppStatusColors.of(context);
    final (background, foreground, outline) = switch (tone) {
      AppStatusTone.success => (
          colors.successContainer,
          colors.onSuccessContainer,
          colors.successOutline,
        ),
      AppStatusTone.danger => (
          colors.dangerContainer,
          colors.onDangerContainer,
          colors.dangerOutline,
        ),
      AppStatusTone.actionRequired => (
          colors.actionRequiredContainer,
          colors.onActionRequiredContainer,
          colors.actionRequiredOutline,
        ),
      AppStatusTone.inProgress => (
          colors.inProgressContainer,
          colors.onInProgressContainer,
          colors.inProgressOutline,
        ),
      _ => (
          colors.neutralContainer,
          colors.onNeutralContainer,
          colors.neutralOutline,
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: AppRadii.status,
        border: Border.all(color: outline),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: foreground),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: foreground,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RenewalErrorCard extends StatelessWidget {
  const _RenewalErrorCard({required this.message, required this.onRetry});

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = AppStatusColors.of(context);

    return AppSurfaceCard(
      backgroundColor: colors.dangerContainer,
      borderColor: colors.dangerOutline,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Unable to load renewal package',
            style: TextStyle(
              color: colors.onDangerContainer,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: TextStyle(
              color: colors.onDangerContainer,
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _RenewalEmptyState extends StatelessWidget {
  const _RenewalEmptyState();

  @override
  Widget build(BuildContext context) {
    return const AppSurfaceCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppIconTile(icon: Icons.autorenew_rounded),
          SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              'No active renewal package is available for your scholar account yet.',
            ),
          ),
        ],
      ),
    );
  }
}
