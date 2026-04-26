import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/applicant_documents_service.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';
import 'package:url_launcher/url_launcher.dart';

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

  ApplicantDocumentsPackage? _package;
  bool _isLoading = true;
  bool _needsBaseApplication = false;
  String? _errorMessage;
  final Map<String, bool> _uploadingDocuments = <String, bool>{};

  static const Set<String> _allowedDocumentTypes = {
    'certificate of registration',
    'cor',
    'certificate of indigency',
    'indigency',
    'grade report',
    'grade',
    'letter of request',
    'request letter',
  };

  @override
  void initState() {
    super.initState();
    _loadPackage();
  }

  Future<void> _loadPackage() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _needsBaseApplication = false;
    });

    try {
      final payload = await _service.fetchMyDocuments();
      if (!mounted) return;
      setState(() => _package = payload);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _needsBaseApplication =
            error.statusCode == 404 || error.statusCode == 409;
        _errorMessage = error.message.trim();
        _package = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorMessage = error.toString().replaceFirst('Exception: ', '').trim();
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  List<ApplicantRequirementDocument> _visibleDocuments(
    List<ApplicantRequirementDocument> documents,
  ) {
    final filtered = documents.where((document) {
      final type = document.documentType.trim().toLowerCase();
      return _allowedDocumentTypes.contains(type);
    }).toList();

    filtered.sort((a, b) {
      final orderA = _documentOrder(a.documentType);
      final orderB = _documentOrder(b.documentType);
      return orderA.compareTo(orderB);
    });

    return filtered;
  }

  int _documentOrder(String type) {
    final text = type.toLowerCase();

    if (text.contains('registration') || text == 'cor') return 1;
    if (text.contains('indigency')) return 2;
    if (text.contains('grade')) return 3;
    if (text.contains('request')) return 4;

    return 99;
  }

  Future<void> _pickAndUploadDocument(
    ApplicantRequirementDocument document,
  ) async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      allowMultiple: false,
      withData: kIsWeb,
    );

    if (result == null || result.files.isEmpty) return;

    final pickedFile = result.files.single;
    final fileName = pickedFile.name;
    final filePath = kIsWeb ? null : pickedFile.path;
    final fileBytes = pickedFile.bytes;
    final extension = fileName.split('.').last.toLowerCase();

    const allowedExtensions = {'pdf', 'jpg', 'jpeg', 'png'};

    if (!allowedExtensions.contains(extension)) {
      _showSnackBar('Only PDF, JPG, JPEG, and PNG files are allowed.');
      return;
    }

    if (kIsWeb && (fileBytes == null || fileBytes.isEmpty)) {
      _showSnackBar('The selected file could not be read. Try another file.');
      return;
    }

    setState(() => _uploadingDocuments[document.id] = true);

    try {
      final payload = await _service.uploadDocument(
        documentRouteParam: document.id,
        fileName: fileName,
        filePath: filePath,
        fileBytes: fileBytes,
      );

      if (!mounted) return;
      setState(() => _package = payload);
      _showSnackBar('${document.documentType} uploaded successfully.');
    } catch (error) {
      if (!mounted) return;
      _showSnackBar(error.toString().replaceFirst('Exception: ', '').trim());
    } finally {
      if (mounted) {
        setState(() => _uploadingDocuments.remove(document.id));
      }
    }
  }

  Future<void> _openFile(ApplicantRequirementDocument document) async {
    final fileUrl = document.fileUrl;

    if (fileUrl == null || fileUrl.trim().isEmpty) {
      _showSnackBar('No uploaded file is available yet.');
      return;
    }

    final uri = Uri.tryParse(fileUrl);
    if (uri == null) {
      _showSnackBar('The uploaded file URL is invalid.');
      return;
    }

    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!mounted) return;
      _showSnackBar('Unable to open the uploaded file.');
    }
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
      case 'flagged':
        return Colors.red;
      case 'pending':
      default:
        return primaryColor;
    }
  }

  String _statusLabel(ApplicantRequirementDocument document) {
    switch (document.status) {
      case 'verified':
        return 'Verified';
      case 'uploaded':
        return 'Uploaded';
      case 'rejected':
      case 'flagged':
        return 'Needs Re-upload';
      case 'pending':
      default:
        return 'Required';
    }
  }

  String _summaryText(ApplicantDocumentsPackage package) {
    if (package.documentStatus == 'Documents Ready') {
      return 'All required documents have been uploaded and are ready for review.';
    }

    return 'Upload the four required documents below. Make sure every file is clear and readable.';
  }

  String _formatTimestamp(DateTime? value) {
    if (value == null) return 'Not uploaded yet';
    return DateFormat('MMM d, yyyy • h:mm a').format(value.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    final package = _package;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.black54;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;

    final documents = package == null
        ? const <ApplicantRequirementDocument>[]
        : _visibleDocuments(package.documents);

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Scholarship Documents'),
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
      ),
      selectedIndex: 0,
      showDrawer: false,
      child: RefreshIndicator(
        onRefresh: _loadPackage,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
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
              uploadedCount: documents.where((doc) => doc.isSubmitted).length,
              totalCount: documents.length,
            ),
            const SizedBox(height: 12),
            _ActionPanel(
              onBackToApplication: () {
                Navigator.pushNamed(context, AppRoutes.newApplicant);
              },
              onBackToDashboard: () {
                AppNavigator.goToTopLevel(context, AppRoutes.home);
              },
            ),
            const SizedBox(height: 18),
            if (_isLoading)
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
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: titleColor,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Required: COR, Certificate of Indigency, Grade Report, and Letter of Request.',
                style: TextStyle(color: subtitleColor, height: 1.4),
              ),
              const SizedBox(height: 12),
              if (documents.isEmpty)
                _ErrorCard(
                  message:
                      'No required document slots were found for this application.',
                  onRetry: _loadPackage,
                )
              else
                ...documents.map((document) {
                  final statusColor = _statusColor(document.status);
                  final isUploading = _uploadingDocuments[document.id] == true;

                  return _DocumentCard(
                    document: document,
                    statusColor: statusColor,
                    titleColor: titleColor,
                    subtitleColor: subtitleColor,
                    statusLabel: _statusLabel(document),
                    uploadedText: _formatTimestamp(document.uploadedAt),
                    isUploading: isUploading,
                    onUpload: () => _pickAndUploadDocument(document),
                    onOpen: document.isSubmitted
                        ? () => _openFile(document)
                        : null,
                  );
                }),
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
    required this.uploadedCount,
    required this.totalCount,
  });

  final String title;
  final String programName;
  final String description;
  final Color titleColor;
  final Color subtitleColor;
  final Color accentColor;
  final ApplicantDocumentsPackage? package;
  final int uploadedCount;
  final int totalCount;

  @override
  Widget build(BuildContext context) {
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
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: titleColor,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            programName,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: accentColor,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            description,
            style: TextStyle(fontSize: 14, height: 1.45, color: subtitleColor),
          ),
          if (package != null) ...[
            const SizedBox(height: 16),
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
                  label: 'Documents',
                  value: package!.documentStatus,
                  accentColor: accentColor,
                ),
                _InfoChip(
                  label: 'Uploaded',
                  value: '$uploadedCount/$totalCount',
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

class _ActionPanel extends StatelessWidget {
  const _ActionPanel({
    required this.onBackToApplication,
    required this.onBackToDashboard,
  });

  final VoidCallback onBackToApplication;
  final VoidCallback onBackToDashboard;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: onBackToApplication,
            icon: const Icon(Icons.edit_document),
            label: const Text('Back to Application Form'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: ElevatedButton.icon(
            onPressed: onBackToDashboard,
            icon: const Icon(Icons.dashboard_outlined),
            label: const Text('Back to Dashboard'),
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              foregroundColor: Colors.white,
            ),
          ),
        ),
      ],
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
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
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
  final VoidCallback onUpload;
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
        border: Border.all(color: statusColor.withOpacity(0.18)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.035),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
                child: Text(
                  document.documentType,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: titleColor,
                  ),
                ),
              ),
              _StatusPill(label: statusLabel, color: statusColor),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Uploaded: $uploadedText',
            style: TextStyle(color: subtitleColor, height: 1.35),
          ),
          if ((document.adminComment ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              document.adminComment!,
              style: TextStyle(color: subtitleColor, height: 1.4),
            ),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              ElevatedButton.icon(
                onPressed: isUploading ? null : onUpload,
                icon: isUploading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        document.isSubmitted ? Icons.sync : Icons.upload_file,
                      ),
                label: Text(
                  isUploading
                      ? 'Uploading...'
                      : document.isSubmitted
                      ? 'Replace File'
                      : 'Upload File',
                ),
              ),
              if (onOpen != null)
                OutlinedButton.icon(
                  onPressed: onOpen,
                  icon: const Icon(Icons.open_in_new),
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

    if (text.contains('registration') || text == 'cor') {
      return Icons.assignment_outlined;
    }
    if (text.contains('indigency')) return Icons.home_work_outlined;
    if (text.contains('grade')) return Icons.school_outlined;
    if (text.contains('request')) return Icons.mail_outline;

    return Icons.description_outlined;
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
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 12,
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
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: accentColor,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}
