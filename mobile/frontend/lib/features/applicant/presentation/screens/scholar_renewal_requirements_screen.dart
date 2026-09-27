import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
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

enum _RenewalUploadSource { camera, file }

// SMART-PDM_MOBILE_SCHOLAR_RENEWAL_RESPONSIVE_PHASE4_V1

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
        debugPrint('RENEWAL LOAD ERROR: $error');
        setState(() {
          _errorMessage =
              'We could not load your renewal details. Check your connection and try again.';
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

  Future<_RenewalUploadSource?> _chooseUploadSource() async {
    if (kIsWeb) return _RenewalUploadSource.file;
    if (!mounted) return null;

    return showModalBottomSheet<_RenewalUploadSource>(
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
                'Take a clear photo or choose an existing document from your device.',
                style: Theme.of(sheetContext).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.photo_camera_outlined),
                title: const Text('Camera'),
                subtitle: const Text('Take a new photo of the document'),
                onTap: () =>
                    Navigator.pop(sheetContext, _RenewalUploadSource.camera),
              ),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.folder_open_outlined),
                title: const Text('Choose File'),
                subtitle: const Text('PDF, JPG, JPEG, PNG, or WEBP'),
                onTap: () =>
                    Navigator.pop(sheetContext, _RenewalUploadSource.file),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickAndUploadDocument(ScholarRenewalDocument document) async {
    final source = await _chooseUploadSource();
    if (source == null || !mounted) return;

    String fileName;
    String? filePath;
    Uint8List? fileBytes;
    int fileSize;

    if (source == _RenewalUploadSource.camera) {
      final photo = await ImagePicker().pickImage(
        source: ImageSource.camera,
        imageQuality: 92,
        maxWidth: 2400,
        maxHeight: 2400,
      );
      if (photo == null) return;

      fileName = photo.name.trim().isNotEmpty
          ? photo.name
          : 'renewal_${DateTime.now().millisecondsSinceEpoch}.jpg';
      filePath = photo.path;
      fileSize = await photo.length();
    } else {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
        allowMultiple: false,
        withData: kIsWeb,
      );

      if (result == null || result.files.isEmpty) return;

      final pickedFile = result.files.single;
      fileName = pickedFile.name;
      filePath = kIsWeb ? null : pickedFile.path;
      fileBytes = pickedFile.bytes;
      fileSize = pickedFile.size;
    }

    final extension = fileName.split('.').last.toLowerCase();
    const maxFileSizeBytes = 8 * 1024 * 1024;

    if (fileSize <= 0) {
      _showSnackBar('The selected file is empty. Choose another file.');
      return;
    }

    if (fileSize > maxFileSizeBytes) {
      _showSnackBar('File is too large. Maximum size is 8 MB.');
      return;
    }

    const allowedExtensions = {'pdf', 'jpg', 'jpeg', 'png', 'webp'};
    if (!allowedExtensions.contains(extension)) {
      _showSnackBar('Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.');
      return;
    }

    if (kIsWeb &&
        source == _RenewalUploadSource.file &&
        (fileBytes == null || fileBytes.isEmpty)) {
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
      debugPrint('RENEWAL DOCUMENT UPLOAD ERROR: $error');
      _showSnackBar(
        'We could not upload this document. Check the file and try again.',
      );
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
        'Replace every document marked "New File Needed" before submitting again.',
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
            'Your renewal requirements have been submitted to OSFA for review.',
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
      debugPrint('RENEWAL SUBMIT ERROR: $error');
      _showSnackBar(
        'We could not submit your renewal. Check your connection and try again.',
      );
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
        url.contains('.webp') ||
        type.contains('image');
  }

  Future<void> _openFilePreview(ScholarRenewalDocument document) async {
    final fileUrl = document.fileUrl;

    if (fileUrl == null || fileUrl.trim().isEmpty) {
      _showSnackBar('No uploaded file is available yet.');
      return;
    }

    if (!_isImageDocument(document)) {
      final uri = Uri.tryParse(fileUrl.trim());
      if (uri == null || !uri.hasScheme) {
        _showSnackBar('This file cannot be opened right now. Try again later.');
        return;
      }

      final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!opened) {
        _showSnackBar('Unable to open this file on your device.');
      }
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
          shape: const RoundedRectangleBorder(borderRadius: AppRadii.card),
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
        return package.renewal.isRejected ? 'Rejected' : 'New File Needed';
      case 'pending':
      default:
        return 'Required';
    }
  }

  String _formatSubmittedDate(String? value) {
    final raw = value?.trim() ?? '';
    if (raw.isEmpty) return '';

    final parsed = DateTime.tryParse(raw)?.toLocal();
    if (parsed == null) return 'Uploaded';

    const months = <String>[
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final hour = parsed.hour == 0
        ? 12
        : parsed.hour > 12
        ? parsed.hour - 12
        : parsed.hour;
    final minute = parsed.minute.toString().padLeft(2, '0');
    final period = parsed.hour >= 12 ? 'PM' : 'AM';

    return 'Uploaded ${months[parsed.month - 1]} ${parsed.day}, ${parsed.year} at $hour:$minute $period';
  }

  String _renewalStatusLabel(ScholarRenewal renewal) {
    switch (renewal.normalizedStatus) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'flagged':
        return 'Needs Attention';
      case 'submitted':
      case 'under review':
        return 'Under Review';
      case 'needs reupload':
        return 'File Update Needed';
      default:
        return 'Not Submitted';
    }
  }

  String _renewalDocumentStatusLabel(String status) {
    switch (status.trim().toLowerCase()) {
      case 'verified':
      case 'complete':
      case 'completed':
        return 'Documents Verified';
      case 'documents ready':
      case 'ready':
        return 'Documents Ready';
      case 'under review':
      case 'submitted':
        return 'Documents Under Review';
      case 'requires reupload':
      case 'needs reupload':
      case 'reupload required':
        return 'File Update Needed';
      case 'missing docs':
      case 'missing':
        return 'Documents Needed';
      default:
        return status.trim().isEmpty ? 'Documents Needed' : status;
    }
  }

  String _renewalPeriodLabel(ScholarRenewalPackage package) {
    final parts = <String>[
      if (package.semesterLabel.trim().isNotEmpty) package.semesterLabel.trim(),
      if (package.schoolYearLabel.trim().isNotEmpty)
        'AY ${package.schoolYearLabel.trim()}',
    ];
    return parts.join(' ');
  }

  String _renewalSummary(ScholarRenewalPackage package) {
    if (!package.isRenewalAvailable) {
      final reasonCode = package.availabilityReasonCode.trim().toUpperCase();
      if (reasonCode == 'CURRENT_SCHOLARSHIP_SEMESTER_STILL_ACTIVE') {
        return 'Renewal is not required for this semester because your scholarship is already active. Renewal is only needed for the next semester.';
      }

      final reason = package.availabilityReason.trim();
      return reason.isNotEmpty
          ? reason
          : 'Renewal is not available for this semester.';
    }

    switch (package.renewal.normalizedStatus) {
      case 'approved':
        return 'Your renewal for this semester has been approved.';
      case 'rejected':
        return 'Your renewal was not approved. Review the document statuses below.';
      case 'flagged':
        return 'Your renewal needs attention. Review the document statuses below.';
      case 'submitted':
      case 'under review':
        return 'Your renewal has been submitted and is being reviewed.';
      case 'needs reupload':
        return 'A document needs to be updated before you can continue.';
      default:
        return 'Upload the required documents, review them, then submit your renewal.';
    }
  }

  String _lockedSubmitLabel(ScholarRenewal renewal) {
    if (renewal.isApproved) return 'Renewal Approved';
    if (renewal.isRejected) return 'Renewal Rejected';
    if (renewal.isFlagged) return 'Renewal Needs Attention';
    return 'Waiting for OSFA Review';
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
        ? 'Renewal Not Available'
        : _renewalPackage?.renewal.isLockedForReview == true
        ? _lockedSubmitLabel(_renewalPackage!.renewal)
        : _hasPendingReupload
        ? 'Replace Requested File First'
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
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
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
              if (_renewalPackage!.isRenewalAvailable) ...[
                const SizedBox(height: AppSpacing.xl),
                AppSectionHeading(
                  title: 'Required Documents',
                  subtitle:
                      'Upload your current Certificate of Registration and latest grades. You can use PDF, JPG/JPEG, PNG, or WEBP files.',
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
    final showProgress = package.isRenewalAvailable;
    final uploadedCount = package.documents
        .where((document) => document.hasFile)
        .length;
    final totalCount = package.documents.length;
    final progress = totalCount == 0 ? 0.0 : uploadedCount / totalCount;
    final statusLabel = package.isRenewalAvailable
        ? _renewalStatusLabel(package.renewal)
        : 'Not Open';

    return LayoutBuilder(
      builder: (context, constraints) {
        final textScale = MediaQuery.textScalerOf(context).scale(1);
        final stackHeader = constraints.maxWidth < 300 || textScale > 1.3;
        final headerDetails = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              package.isRenewalAvailable
                  ? 'Renewal Progress'
                  : 'Renewal Status',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: titleColor,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _renewalSummary(package),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: subtitleColor,
                height: 1.5,
              ),
            ),
          ],
        );

        final headerIcon = AppIconTile(
          icon: package.isRenewalAvailable
              ? Icons.autorenew_rounded
              : Icons.event_busy_outlined,
          accent: accentColor,
        );

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppSurfaceCard(
              backgroundColor: AppSurfacePalette.surface(context),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (stackHeader) ...[
                    headerIcon,
                    const SizedBox(height: AppSpacing.md),
                    headerDetails,
                  ] else
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        headerIcon,
                        const SizedBox(width: AppSpacing.md),
                        Expanded(child: headerDetails),
                      ],
                    ),
                  const SizedBox(height: AppSpacing.md),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _InfoChip(
                        icon: package.isRenewalAvailable
                            ? Icons.verified_outlined
                            : Icons.pause_circle_outline_rounded,
                        label: statusLabel,
                        semanticStatus: true,
                      ),
                      if (showProgress)
                        _InfoChip(
                          icon: Icons.description_outlined,
                          label: '$uploadedCount of $totalCount uploaded',
                        ),
                    ],
                  ),
                  if (showProgress) ...[
                    const SizedBox(height: AppSpacing.md),
                    ClipRRect(
                      borderRadius: AppRadii.status,
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 9,
                        backgroundColor: AppSurfacePalette.surfaceMuted(
                          context,
                        ),
                        valueColor: AlwaysStoppedAnimation<Color>(accentColor),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            _buildPeriodCard(
              package: package,
              titleColor: titleColor,
              subtitleColor: subtitleColor,
              accentColor: accentColor,
            ),
          ],
        );
      },
    );
  }

  Widget _buildPeriodCard({
    required ScholarRenewalPackage package,
    required Color titleColor,
    required Color subtitleColor,
    required Color accentColor,
  }) {
    final period = _renewalPeriodLabel(package);

    return AppSurfaceCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      backgroundColor: AppSurfacePalette.surface(context),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          AppIconTile(icon: Icons.calendar_month_outlined, accent: accentColor),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Academic Period',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: subtitleColor,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  period.isEmpty ? 'Current semester' : period,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: titleColor,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (package.programName.trim().isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(
                    package.programName.trim(),
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: subtitleColor),
                  ),
                ],
              ],
            ),
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
                      : 'Latest semester grades or transcript for renewal review.',
                  style: Theme.of(
                    context,
                  ).textTheme.labelMedium?.copyWith(color: subtitleColor),
                ),
                const SizedBox(height: AppSpacing.sm),
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
                if (document.hasFile || document.submittedAt != null) ...[
                  const SizedBox(height: 6),
                  if (document.hasFile)
                    Text(
                      'File uploaded',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: AppSurfacePalette.mutedText(context),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  if (document.submittedAt != null)
                    Text(
                      _formatSubmittedDate(document.submittedAt),
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
                        color: AppStatusColors.of(
                          context,
                        ).actionRequiredContainer,
                        borderRadius: AppRadii.control,
                        border: Border.all(
                          color: AppStatusColors.of(
                            context,
                          ).actionRequiredOutline,
                        ),
                      ),
                      child: Text(
                        document.adminComment,
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(
                              height: 1.35,
                              color: AppStatusColors.of(
                                context,
                              ).onActionRequiredContainer,
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
                          label: const Text('Preview'),
                        ),
                    ],
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
            'Unable to load renewal',
            style: TextStyle(
              color: colors.onDangerContainer,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Text(message, style: TextStyle(color: colors.onDangerContainer)),
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
              'No renewal is available yet. When OSFA opens renewal for your account, your requirements will appear here.',
            ),
          ),
        ],
      ),
    );
  }
}
