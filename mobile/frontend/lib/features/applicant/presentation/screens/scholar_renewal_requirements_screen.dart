import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
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
    _liveSyncTimer = Timer.periodic(const Duration(seconds: 5), (_) {
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
          _errorMessage = error.toString().replaceFirst('Exception: ', '').trim();
        });
      }
    } finally {
      _fetchInProgress = false;
      if (mounted && !silent) {
        setState(() => _isLoading = false);
      }
      if (_pendingLiveRefresh && mounted && !_isSubmitting && _uploadingDocuments.isEmpty) {
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
      final reason =
          _renewalPackage?.availabilityReason.trim() ?? '';

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
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
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
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                          ),
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
                    color: const Color(0xFFF7F7F6),
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

  Color _statusColor(String status) {
    switch (status) {
      case 'verified':
        return Colors.green;
      case 'uploaded':
        return const Color(0xFFC76917);
      case 'rejected':
        return Colors.red;
      case 'pending':
      default:
        return primaryColor;
    }
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

    sorted.sort((a, b) {
      final submissionComparison = a.isSubmitted == b.isSubmitted
          ? 0
          : (a.isSubmitted ? 1 : -1);

      if (submissionComparison != 0) {
        return submissionComparison;
      }

      return 0;
    });

    return sorted;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.black54;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;
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
              backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
              foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
              elevation: 0,
            )
          : null,
      selectedIndex: 3,
      showBottomNav: widget.showBottomNav,
      child: RefreshIndicator(
        onRefresh: () => _loadRenewal(),
        child: ListView(
          padding: const EdgeInsets.all(16),
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
              _RenewalErrorCard(message: _errorMessage!, onRetry: () => _loadRenewal())
            else if (_renewalPackage == null)
              const _RenewalEmptyState()
            else ...[
              _buildHeaderCard(
                package: _renewalPackage!,
                isDark: isDark,
                titleColor: titleColor,
                subtitleColor: subtitleColor,
                accentColor: accentColor,
              ),
              const SizedBox(height: 20),
              Text(
                'Required Documents',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: titleColor,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Upload your Certificate of Registration and latest Grade Form / Transcript. Allowed files: PDF, JPG, and PNG.',
                style: Theme.of(
                  context,
                ).textTheme.labelMedium?.copyWith(color: subtitleColor),
              ),
              const SizedBox(height: 14),
              ...documents.map(
                (document) => _buildDocumentRow(
                  document: document,
                  package: _renewalPackage!,
                  isDark: isDark,
                  titleColor: titleColor,
                  subtitleColor: subtitleColor,
                  accentColor: accentColor,
                ),
              ),
              if ((_renewalPackage!.renewal.adminComment ?? '')
                  .trim()
                  .isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.orange.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: Colors.orange.withValues(alpha: 0.18),
                      ),
                    ),
                    child: Text(
                      _renewalPackage!.renewal.adminComment!,
                      style: TextStyle(
                        color: isDark
                            ? Colors.orange.shade200
                            : Colors.orange.shade900,
                        height: 1.35,
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: submitDisabled ? null : _submitRenewal,
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                  label: Text(submitLabel),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    disabledBackgroundColor: Colors.grey.shade300,
                    disabledForegroundColor: Colors.grey.shade600,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
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
    required bool isDark,
    required Color titleColor,
    required Color subtitleColor,
    required Color accentColor,
  }) {
    final progress = package.documents.isEmpty
        ? 0.0
        : package.documents.where((document) => document.hasFile).length /
              package.documents.length;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFF2D1E12)
            : primaryColor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: primaryColor.withValues(alpha: 0.12)),
      ),
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
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
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
    required bool isDark,
    required Color titleColor,
    required Color subtitleColor,
    required Color accentColor,
  }) {
    final statusColor = _statusColor(document.status);
    final isUploading = _uploadingDocuments[document.id] == true;
    final canUpload = !package.renewal.isLockedForReview;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF332216) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: primaryColor.withValues(alpha: 0.10)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: isDark
                  ? const Color(0xFF3A2718)
                  : primaryColor.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              document.documentType == 'Certificate of Registration'
                  ? Icons.assignment_outlined
                  : Icons.grade_outlined,
              color: accentColor,
            ),
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
                        color: isDark ? Colors.white60 : Colors.grey.shade700,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  if (document.submittedAt != null)
                    Text(
                      document.submittedAt!,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: isDark ? Colors.white54 : Colors.black45,
                      ),
                    ),
                  if (document.adminComment.trim().isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      document.adminComment,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        height: 1.35,
                        color: isDark
                            ? Colors.orange.shade200
                            : Colors.orange.shade900,
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
                        style: OutlinedButton.styleFrom(
                          foregroundColor: accentColor,
                          side: BorderSide(
                            color: isDark
                                ? const Color(0xFF665E57)
                                : const Color(0xFFD2D2D2),
                            width: 1,
                          ),
                          backgroundColor: isDark
                              ? const Color(0xFF3A2718)
                              : primaryColor.withValues(alpha: 0.04),
                        ),
                      ),
                      if (document.hasFile)
                        TextButton.icon(
                          onPressed: () => _openFilePreview(document),
                          icon: const Icon(Icons.visibility_outlined, size: 16),
                          label: const Text('View file'),
                          style: TextButton.styleFrom(
                            foregroundColor: isDark
                                ? accentColor
                                : AppColors.darkBrown,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              _statusLabel(document, package),
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: statusColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.75),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.darkBrown),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: AppColors.darkBrown,
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
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.red.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.red.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Unable to load renewal package',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(message),
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
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
      ),
      child: const Text(
        'No active renewal package is available for your scholar account yet.',
      ),
    );
  }
}
