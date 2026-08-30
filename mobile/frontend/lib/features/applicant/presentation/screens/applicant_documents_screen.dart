import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/applicant_documents_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ApplicantDocumentsScreen extends StatefulWidget {
  const ApplicantDocumentsScreen({
    super.key,
    this.initialTitle,
    this.initialProgramName,
  });

  final String? initialTitle;
  final String? initialProgramName;

  @override
  State<ApplicantDocumentsScreen> createState() =>
      _ApplicantDocumentsScreenState();
}

class _ApplicantDocumentsScreenState extends State<ApplicantDocumentsScreen> {
  final ApplicantDocumentsService _service = ApplicantDocumentsService();
  NotificationProvider? _notificationProvider;
  int _lastApplicationRevision = 0;
  Timer? _pollingTimer;

  ApplicantDocumentsPackage? _package;

  bool _isLoading = true;
  bool _isRefreshing = false;
  bool _needsBaseApplication = false;
  String? _errorMessage;

  final Map<String, bool> _uploadingDocuments = <String, bool>{};

  @override
  void initState() {
    super.initState();
    _loadPackage(showFullLoader: true);

    _pollingTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted &&
          !_isLoading &&
          !_isRefreshing &&
          _uploadingDocuments.isEmpty) {
        _loadPackage(silent: true);
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final provider = context.read<NotificationProvider>();
    if (_notificationProvider == provider) return;

    _notificationProvider?.removeListener(_handleRealtimeUpdates);
    _notificationProvider = provider;
    _lastApplicationRevision = provider.applicationRevision;
    _notificationProvider?.addListener(_handleRealtimeUpdates);
  }

  Future<void> _loadPackage({
    bool showFullLoader = false,
    bool silent = false,
  }) async {
    if (!mounted) return;

    final hasExistingData = _package != null;
    final shouldShowFullLoader =
        showFullLoader || (!hasExistingData && !silent);

    setState(() {
      if (shouldShowFullLoader) {
        _isLoading = true;
      } else {
        _isRefreshing = true;
      }

      if (!silent) {
        _errorMessage = null;
        _needsBaseApplication = false;
      }
    });

    try {
      final payload = await _service.fetchMyDocuments();
      if (!mounted) return;

      setState(() {
        _package = payload;
        _errorMessage = null;
        _needsBaseApplication = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      if (silent && _package != null) return;

      setState(() {
        _needsBaseApplication =
            error.statusCode == 404 || error.statusCode == 409;
        _errorMessage = error.message.trim();
        if (!hasExistingData) _package = null;
      });
    } catch (_) {
      if (!mounted) return;
      if (silent && _package != null) return;

      setState(() {
        _errorMessage =
            'Unable to load your documents. Check your connection and try again.';
      });
    } finally {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _isRefreshing = false;
      });
    }
  }

  void _handleRealtimeUpdates() {
    final provider = _notificationProvider;
    if (provider == null) return;
    if (provider.applicationRevision == _lastApplicationRevision) return;

    _lastApplicationRevision = provider.applicationRevision;

    if (mounted &&
        !_isLoading &&
        !_isRefreshing &&
        _uploadingDocuments.isEmpty) {
      _loadPackage(silent: true);
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _notificationProvider?.removeListener(_handleRealtimeUpdates);
    super.dispose();
  }

  List<ApplicantRequirementDocument> _orderedDocuments(
    List<ApplicantRequirementDocument> documents,
  ) {
    final items = List<ApplicantRequirementDocument>.from(documents);

    items.sort((a, b) {
      if (a.isRequired != b.isRequired) return a.isRequired ? -1 : 1;

      final orderA = _documentOrder(a.documentType);
      final orderB = _documentOrder(b.documentType);
      if (orderA != orderB) return orderA.compareTo(orderB);

      return a.documentType.toLowerCase().compareTo(
        b.documentType.toLowerCase(),
      );
    });

    return items;
  }

  int _documentOrder(String type) {
    final text = type.trim().toLowerCase();
    if (text.contains('birth') || text == 'psa' || text == 'nso') return 1;
    if (text.contains('registration') || text == 'cor') return 2;
    if (text.contains('indigency')) return 3;
    if (text.contains('grade')) return 4;
    if (text.contains('request')) return 5;
    return 99;
  }

  void _showUploadMessage(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red.shade700 : null,
      ),
    );
  }

  // SMART_PDM_REQUIRED_DOCUMENT_REPLACE_UI_V1
  Future<bool> _confirmDocumentReplacement(
    ApplicantRequirementDocument document,
  ) async {
    if (!document.isSubmitted) return true;
    if (!mounted) return false;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        final theme = Theme.of(dialogContext);
        final isDark = theme.brightness == Brightness.dark;
        final titleColor = isDark
            ? AppColors.applicantDarkText
            : AppColors.darkBrown;
        final bodyColor = isDark
            ? AppColors.applicantDarkTextMuted
            : Colors.black54;

        return AlertDialog(
          title: const Text('Replace Document?'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'You are replacing ${document.documentType}.',
                style: TextStyle(
                  color: titleColor,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Your current uploaded file will remain available until the '
                'replacement finishes successfully. After replacement, the new '
                'file becomes the current document and returns to Pending Review.',
                style: TextStyle(
                  color: bodyColor,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Previous document versions are preserved for review history.',
                style: TextStyle(
                  color: bodyColor,
                  height: 1.4,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Keep Current'),
            ),
            FilledButton.icon(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              icon: const Icon(Icons.swap_horiz_rounded),
              label: const Text('Choose Replacement'),
            ),
          ],
        );
      },
    );

    return confirmed == true;
  }

  Future<void> _pickAndUploadDocument(
    ApplicantRequirementDocument document,
  ) async {
    final package = _package;

    if (package?.uploadsLocked == true) {
      _showUploadMessage(
        package?.uploadLockReason ??
            'Your verified documents are locked unless Admin requests a correction.',
        isError: true,
      );
      return;
    }

    final canContinue = await _confirmDocumentReplacement(document);
    if (!canContinue || !mounted) return;

    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
      allowMultiple: false,
      withData: kIsWeb,
    );

    if (result == null || result.files.isEmpty) return;

    final pickedFile = result.files.single;
    final fileName = pickedFile.name;
    final filePath = kIsWeb ? null : pickedFile.path;
    final fileBytes = pickedFile.bytes;
    final extension = fileName.split('.').last.toLowerCase();

    const maxFileSizeBytes = 10 * 1024 * 1024;
    if (pickedFile.size > maxFileSizeBytes) {
      _showUploadMessage(
        'File is too large. Maximum size is 10 MB.',
        isError: true,
      );
      return;
    }

    const allowedExtensions = {'pdf', 'jpg', 'jpeg', 'png', 'webp'};
    if (!allowedExtensions.contains(extension)) {
      _showUploadMessage(
        'Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.',
        isError: true,
      );
      return;
    }

    if (kIsWeb && (fileBytes == null || fileBytes.isEmpty)) {
      _showUploadMessage(
        'The selected file could not be read. Try another file.',
        isError: true,
      );
      return;
    }

    if (!kIsWeb && (filePath == null || filePath.trim().isEmpty)) {
      _showUploadMessage(
        'The selected file could not be accessed. Choose the file again.',
        isError: true,
      );
      return;
    }

    setState(() => _uploadingDocuments[document.id] = true);

    try {
      final payload = await _service.uploadDocument(
        documentRouteParam: document.routeParam,
        fileName: fileName,
        filePath: filePath,
        fileBytes: fileBytes,
      );

      if (!mounted) return;
      setState(() {
        _package = payload;
        _errorMessage = null;
      });

      _showUploadMessage(
        document.isSubmitted
            ? '${document.documentType} replaced successfully. The new document is pending review.'
            : '${document.documentType} uploaded successfully.',
      );
    } catch (error) {
      if (!mounted) return;
      _showUploadMessage(
        error.toString().replaceFirst('Exception: ', '').trim(),
        isError: true,
      );
    } finally {
      if (!mounted) return;
      setState(() => _uploadingDocuments.remove(document.id));
      unawaited(_loadPackage(silent: true));
    }
  }

  Future<void> _showDocumentPreview(
    ApplicantRequirementDocument document,
  ) async {
    final fileUrl = document.fileUrl?.trim() ?? '';
    if (fileUrl.isEmpty) {
      _showUploadMessage('No uploaded file is available yet.', isError: true);
      return;
    }

    final uri = Uri.tryParse(fileUrl);
    if (uri == null || !uri.hasScheme) {
      _showUploadMessage('The uploaded file URL is invalid.', isError: true);
      return;
    }

    final path = uri.path.toLowerCase();
    final isImage =
        path.endsWith('.jpg') ||
        path.endsWith('.jpeg') ||
        path.endsWith('.png') ||
        path.endsWith('.webp');
    final isPdf = path.endsWith('.pdf');

    final shouldReplace = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        final size = MediaQuery.sizeOf(dialogContext);
        final previewHeight = (size.height * 0.48).clamp(240.0, 430.0);

        return Dialog(
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 22,
            vertical: 28,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          document.documentType,
                          style: Theme.of(dialogContext).textTheme.titleLarge
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Close',
                        onPressed: () => Navigator.of(dialogContext).pop(false),
                        icon: const Icon(Icons.close),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: double.infinity,
                    height: previewHeight,
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      color: Theme.of(
                        dialogContext,
                      ).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: isImage
                        ? InteractiveViewer(
                            minScale: 0.8,
                            maxScale: 4,
                            child: Image.network(
                              fileUrl,
                              fit: BoxFit.contain,
                              loadingBuilder: (context, child, progress) =>
                                  progress == null
                                  ? child
                                  : const Center(
                                      child: CircularProgressIndicator(),
                                    ),
                              errorBuilder: (_, _, _) =>
                                  const _PreviewUnavailable(
                                    message:
                                        'The image preview could not be loaded.',
                                  ),
                            ),
                          )
                        : _PreviewUnavailable(
                            icon: isPdf
                                ? Icons.picture_as_pdf_outlined
                                : Icons.insert_drive_file_outlined,
                            message: isPdf
                                ? 'PDF uploaded successfully. In-app PDF rendering is not available on this screen.'
                                : 'This uploaded file type cannot be previewed here.',
                          ),
                  ),
                  const SizedBox(height: 12),
                  Text('Uploaded: ${_formatTimestamp(document.uploadedAt)}'),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () =>
                              Navigator.of(dialogContext).pop(false),
                          child: const Text('Close'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _package?.uploadsLocked == true
                              ? null
                              : () => Navigator.of(dialogContext).pop(true),
                          icon: Icon(
                            _package?.uploadsLocked == true
                                ? Icons.lock_outline_rounded
                                : Icons.upload_file,
                          ),
                          label: Text(
                            _package?.uploadsLocked == true
                                ? 'Verified — Locked'
                                : 'Replace Document',
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );

    if (shouldReplace == true && mounted) {
      await _pickAndUploadDocument(document);
    }
  }

  Color _statusColor(ApplicantRequirementDocument document) {
    if (document.isVerified) return Colors.green;
    if (document.needsReplacement) return Colors.red.shade700;
    if (document.isMissing) return Colors.red.shade600;
    if (document.isUnderReview) return const Color(0xFFC76917);
    return primaryColor;
  }

  String _statusLabel(ApplicantRequirementDocument document) {
    if (document.isVerified) return 'Verified';
    if (document.status == 'reupload_required') return 'Needs Re-upload';
    if (document.isRejected) return 'Rejected';
    if (document.isMissing) return 'Missing';
    if (document.isUnderReview) return 'Uploaded — Pending Review';
    return document.status
        .replaceAll('_', ' ')
        .split(' ')
        .map(
          (part) => part.isEmpty
              ? part
              : '${part[0].toUpperCase()}${part.substring(1)}',
        )
        .join(' ');
  }

  String _summaryText(ApplicantDocumentsPackage package) {
    final applicationStatus = package.applicationStatus.trim().toLowerCase();
    if (applicationStatus == 'rejected') {
      final reason = package.rejectionReason?.trim() ?? '';
      return reason.isEmpty
          ? 'Your application was rejected by Admin. Document uploads are locked.'
          : 'Your application was rejected by Admin. Feedback: $reason';
    }

    if (package.uploadsLocked) {
      return package.uploadLockReason ??
          'All required documents are verified and locked.';
    }

    if (package.needsReplacementCount > 0) {
      return '${package.needsReplacementCount} document${package.needsReplacementCount == 1 ? '' : 's'} need replacement before review can continue.';
    }

    if (package.missingCount > 0) {
      return '${package.uploadedCount} of ${package.requiredCount} required documents uploaded. Upload the remaining ${package.missingCount} document${package.missingCount == 1 ? '' : 's'} below.';
    }

    if (package.requiredCount > 0 &&
        package.verifiedCount == package.requiredCount) {
      return 'All required documents are verified.';
    }

    if (package.allRequiredUploaded) {
      return 'All required documents are uploaded and waiting for review.';
    }

    return 'Upload all required scholarship documents below.';
  }

  String _formatTimestamp(DateTime? value) {
    if (value == null) return 'Not uploaded yet';
    return DateFormat('MMM d, yyyy • h:mm a').format(value.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    final package = _package;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark
        ? AppColors.applicantDarkText
        : AppColors.darkBrown;
    final subtitleColor = isDark
        ? AppColors.applicantDarkTextMuted
        : Colors.black54;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;
    final applicationRejected =
        package?.applicationStatus.trim().toLowerCase() == 'rejected';
    final lockStateColor = applicationRejected ? Colors.red : Colors.green;

    final documents = package == null
        ? const <ApplicantRequirementDocument>[]
        : _orderedDocuments(package.documents);
    final requiredDocuments = documents
        .where((document) => document.isRequired)
        .toList();
    final optionalDocuments = documents
        .where((document) => !document.isRequired)
        .toList();

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Required Documents'),
        backgroundColor: primaryColor,
        foregroundColor: AppColors.darkBrown,
      ),
      selectedIndex: 0,
      child: RefreshIndicator(
        onRefresh: () => _loadPackage(silent: true),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (_isRefreshing && !_isLoading)
              const Padding(
                padding: EdgeInsets.only(bottom: 8),
                child: LinearProgressIndicator(minHeight: 2),
              ),
            _HeaderCard(
              title:
                  package?.contextTitle ??
                  widget.initialTitle ??
                  'Scholarship Requirements',
              programName:
                  package?.programName ??
                  widget.initialProgramName ??
                  'Current Application',
              description: package == null
                  ? (_needsBaseApplication
                        ? 'Submit your scholarship application first before uploading requirements.'
                        : 'Loading your scholarship requirements...')
                  : _summaryText(package),
              titleColor: titleColor,
              subtitleColor: subtitleColor,
              accentColor: accentColor,
              package: package,
            ),
            if (package?.uploadsLocked == true) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: lockStateColor.withValues(
                    alpha: isDark ? 0.12 : 0.07,
                  ),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: lockStateColor.withValues(alpha: 0.24),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      applicationRejected
                          ? Icons.cancel_outlined
                          : Icons.lock_outline_rounded,
                      color: lockStateColor,
                      size: 20,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        applicationRejected
                            ? ((package?.rejectionReason?.trim().isNotEmpty ?? false)
                                  ? 'Application rejected. Admin feedback: ${package!.rejectionReason}'
                                  : 'Application rejected by Admin. Document upload and replacement are locked.')
                            : (package?.uploadLockReason ??
                                  'Documents verified by Admin. Upload and replacement are locked unless a correction is requested.'),
                        style: TextStyle(
                          color: isDark
                              ? AppColors.applicantDarkText
                              : AppColors.darkBrown,
                          height: 1.4,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            if (package != null)
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => Navigator.pushNamed(
                        context,
                        AppRoutes.applicationFormPreview,
                      ),
                      icon: const Icon(Icons.description_outlined, size: 20),
                      label: const Text(
                        'View Application Form',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size(0, 54),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 14,
                        ),
                        backgroundColor: accentColor,
                        foregroundColor: isDark
                            ? AppColors.darkBrown
                            : Colors.white,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () =>
                          AppNavigator.goToTopLevel(context, AppRoutes.home),
                      icon: const Icon(Icons.dashboard_outlined, size: 20),
                      label: const Text(
                        'Back to Dashboard',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 54),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 14,
                        ),
                        foregroundColor: accentColor,
                        side: BorderSide(
                          color: accentColor.withValues(alpha: 0.72),
                          width: 1.2,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ],
              )
            else
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () =>
                      AppNavigator.goToTopLevel(context, AppRoutes.home),
                  icon: const Icon(Icons.dashboard_outlined, size: 20),
                  label: const Text('Back to Dashboard'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 54),
                    foregroundColor: accentColor,
                    side: BorderSide(
                      color: accentColor.withValues(alpha: 0.72),
                      width: 1.2,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    textStyle: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 18),
            if (_isLoading && package == null)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_needsBaseApplication)
              _NeedApplicationCard(
                message: _errorMessage,
                onOpenOpenings: () {
                  Navigator.pushNamed(context, AppRoutes.scholarshipOpenings);
                },
              )
            else if (_errorMessage != null && package == null)
              _ErrorCard(message: _errorMessage!, onRetry: _loadPackage)
            else if (package != null) ...[
              Text(
                'Required Documents',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: titleColor,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'All documents in this section are required. Accepted formats: PDF, JPG, JPEG, PNG, and WEBP. Maximum file size: 10 MB.',
                style: TextStyle(color: subtitleColor, height: 1.45),
              ),
              const SizedBox(height: 12),
              if (requiredDocuments.isEmpty)
                _ErrorCard(
                  message:
                      'No required document slots were returned for this application.',
                  onRetry: _loadPackage,
                )
              else
                ...requiredDocuments.map(
                  (document) => _DocumentCard(
                    document: document,
                    statusColor: _statusColor(document),
                    titleColor: titleColor,
                    subtitleColor: subtitleColor,
                    statusLabel: _statusLabel(document),
                    uploadedText: _formatTimestamp(document.uploadedAt),
                    isUploading: _uploadingDocuments[document.id] == true,
                    onUpload: package.uploadsLocked
                        ? null
                        : () => _pickAndUploadDocument(document),
                    onOpen: document.isSubmitted && document.fileUrl != null
                        ? () => _showDocumentPreview(document)
                        : null,
                  ),
                ),
              if (optionalDocuments.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text(
                  'Optional Documents',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: titleColor,
                  ),
                ),
                const SizedBox(height: 8),
                ...optionalDocuments.map(
                  (document) => _DocumentCard(
                    document: document,
                    statusColor: _statusColor(document),
                    titleColor: titleColor,
                    subtitleColor: subtitleColor,
                    statusLabel: _statusLabel(document),
                    uploadedText: _formatTimestamp(document.uploadedAt),
                    isUploading: _uploadingDocuments[document.id] == true,
                    onUpload: package.uploadsLocked
                        ? null
                        : () => _pickAndUploadDocument(document),
                    onOpen: document.isSubmitted && document.fileUrl != null
                        ? () => _showDocumentPreview(document)
                        : null,
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({
    required this.title,
    required this.programName,
    required this.description,
    required this.titleColor,
    required this.subtitleColor,
    required this.accentColor,
    required this.package,
  });

  final String title;
  final String programName;
  final String description;
  final Color titleColor;
  final Color subtitleColor;
  final Color accentColor;
  final ApplicantDocumentsPackage? package;

  @override
  Widget build(BuildContext context) {
    final uploaded = package?.uploadedCount ?? 0;
    final total = package?.requiredCount ?? 0;
    final progress = total == 0 ? 0.0 : uploaded / total;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF2D1E12)
            : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: accentColor.withOpacity(0.16)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
              color: titleColor,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            programName,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: accentColor,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            description,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              height: 1.45,
              color: subtitleColor,
            ),
          ),
          if (package != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 8,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '$uploaded/$total uploaded',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: accentColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _InfoChip(
                  label: 'Application',
                  value: package!.applicationStatus,
                  accentColor: accentColor,
                ),
                _InfoChip(
                  label: 'Verified',
                  value: '${package!.verifiedCount}/${package!.requiredCount}',
                  accentColor: accentColor,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _NeedApplicationCard extends StatelessWidget {
  const _NeedApplicationCard({
    required this.message,
    required this.onOpenOpenings,
  });

  final String? message;
  final VoidCallback onOpenOpenings;

  @override
  Widget build(BuildContext context) {
    return _SimpleCard(
      title: 'Submit an application first',
      message:
          message ??
          'You need a submitted scholarship application before document upload becomes available.',
      buttonLabel: 'View Scholarship Openings',
      onPressed: onOpenOpenings,
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return _SimpleCard(
      title: 'Unable to load documents',
      message: message,
      buttonLabel: 'Try Again',
      onPressed: onRetry,
    );
  }
}

class _SimpleCard extends StatelessWidget {
  const _SimpleCard({
    required this.title,
    required this.message,
    required this.buttonLabel,
    required this.onPressed,
  });

  final String title;
  final String message;
  final String buttonLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2D1E12) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: primaryColor.withOpacity(0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(message, style: const TextStyle(height: 1.45)),
          const SizedBox(height: 14),
          ElevatedButton(onPressed: onPressed, child: Text(buttonLabel)),
        ],
      ),
    );
  }
}

class _DocumentCard extends StatelessWidget {
  const _DocumentCard({
    required this.document,
    required this.statusColor,
    required this.titleColor,
    required this.subtitleColor,
    required this.statusLabel,
    required this.uploadedText,
    required this.isUploading,
    required this.onUpload,
    required this.onOpen,
  });

  final ApplicantRequirementDocument document;
  final Color statusColor;
  final Color titleColor;
  final Color subtitleColor;
  final String statusLabel;
  final String uploadedText;
  final bool isUploading;
  final VoidCallback? onUpload;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xFF2D1E12)
            : Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: statusColor.withOpacity(
            document.needsReplacement ? 0.42 : 0.18,
          ),
          width: document.needsReplacement ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isUploading) ...[
            Row(
              children: [
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Uploading ${document.documentType}...',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: primaryColor,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                backgroundColor: statusColor.withOpacity(0.12),
                child: Icon(
                  _iconForDocument(document.documentType),
                  color: statusColor,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      document.documentType,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      document.isRequired ? 'Required' : 'Optional',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: subtitleColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: _StatusPill(label: statusLabel, color: statusColor),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            document.isSubmitted
                ? 'Uploaded: $uploadedText'
                : 'No file uploaded yet.',
            style: TextStyle(color: subtitleColor, height: 1.35),
          ),
          if ((document.adminComment ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: document.needsReplacement
                    ? Colors.red.withOpacity(0.06)
                    : statusColor.withOpacity(0.06),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'Reviewer note: ${document.adminComment!}',
                style: TextStyle(
                  color: document.needsReplacement
                      ? Colors.red.shade700
                      : subtitleColor,
                  height: 1.4,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              ElevatedButton.icon(
                onPressed: isUploading || onUpload == null ? null : onUpload,
                icon: Icon(
                  onUpload == null
                      ? Icons.lock_outline_rounded
                      : document.isSubmitted
                          ? Icons.swap_horiz_rounded
                          : Icons.upload_file,
                ),
                label: Text(
                  onUpload == null
                      ? 'Verified — Locked'
                      : isUploading
                          ? (document.isSubmitted
                                ? 'Replacing...'
                                : 'Uploading...')
                          : document.isSubmitted
                              ? 'Replace Document'
                              : 'Upload File',
                ),
              ),
              if (onOpen != null)
                OutlinedButton.icon(
                  onPressed: isUploading ? null : onOpen,
                  icon: const Icon(Icons.visibility_outlined),
                  label: const Text('View File'),
                ),
            ],
          ),
        ],
      ),
    );
  }

  IconData _iconForDocument(String type) {
    final text = type.toLowerCase();
    if (text.contains('birth') || text == 'psa') {
      return Icons.badge_outlined;
    }
    if (text.contains('registration') || text == 'cor') {
      return Icons.assignment_outlined;
    }
    if (text.contains('indigency')) return Icons.home_work_outlined;
    if (text.contains('grade')) return Icons.school_outlined;
    if (text.contains('request')) return Icons.mail_outline;
    return Icons.description_outlined;
  }
}

class _PreviewUnavailable extends StatelessWidget {
  const _PreviewUnavailable({
    required this.message,
    this.icon = Icons.broken_image_outlined,
  });

  final String message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: primaryColor),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                height: 1.4,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
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
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.label,
    required this.value,
    required this.accentColor,
  });

  final String label;
  final String value;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: accentColor.withOpacity(0.12),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: accentColor,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}
