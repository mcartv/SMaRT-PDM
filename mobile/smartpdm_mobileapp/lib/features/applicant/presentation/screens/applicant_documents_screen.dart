import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/applicant_documents_service.dart';
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
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
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

    if (result == null || result.files.isEmpty) {
      return;
    }

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
      _showSnackBar(
        'The selected file could not be read in the browser. Please try another file.',
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
      return 'All scholarship requirements are already on file and ready for review.';
    }

    if (package.documentStatus == 'Under Review' &&
        !package.allRequiredUploaded) {
      return 'Continue uploading the remaining scholarship requirements so admin can finish reviewing your application.';
    }

    return 'Upload the required scholarship documents for your submitted opening-specific application here.';
  }

  String _formatTimestamp(DateTime? value) {
    if (value == null) return 'Not uploaded yet';
    return DateFormat('MMM d, yyyy - h:mm a').format(value.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.black54;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;
    final package = _package;

    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Scholarship Requirements')),
      selectedIndex: 0,
      showDrawer: false,
      child: RefreshIndicator(
        onRefresh: _loadPackage,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF2D1E12) : Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: accentColor.withOpacity(0.16)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    package?.contextTitle ??
                        widget.initialTitle ??
                        'Scholarship Requirements',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: titleColor,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    package?.programName ??
                        widget.initialProgramName ??
                        'Unassigned Application',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: accentColor,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    package == null
                        ? (_needsBaseApplication
                              ? 'Choose a scholarship opening and submit your application first, then come back here to upload your requirements.'
                              : 'Loading your scholarship requirements...')
                        : _summaryText(package),
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.45,
                      color: subtitleColor,
                    ),
                  ),
                  if (package != null) ...[
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _InfoChip(
                          label: 'Application',
                          value: package.applicationStatus,
                          accentColor: accentColor,
                        ),
                        _InfoChip(
                          label: 'Documents',
                          value: package.documentStatus,
                          accentColor: accentColor,
                        ),
                        _InfoChip(
                          label: 'Uploaded',
                          value:
                              '${package.uploadedCount}/${package.documents.length}',
                          accentColor: accentColor,
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_needsBaseApplication)
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF2D1E12) : Colors.white,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Submit an application first',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _errorMessage ??
                          'You need a submitted scholarship application before document upload becomes available.',
                      style: TextStyle(color: subtitleColor, height: 1.45),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton(
                      onPressed: () => Navigator.pushNamed(
                        context,
                        AppRoutes.scholarshipOpenings,
                      ),
                      child: const Text('View Scholarship Openings'),
                    ),
                  ],
                ),
              )
            else if (_errorMessage != null && package == null)
              Padding(
                padding: const EdgeInsets.only(top: 32),
                child: Column(
                  children: [
                    Text(
                      _errorMessage!,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: subtitleColor),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _loadPackage,
                      child: const Text('Try Again'),
                    ),
                  ],
                ),
              )
            else if (package != null) ...[
              Text(
                'Required Documents',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: titleColor,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Allowed files: PDF, JPG, JPEG, and PNG.',
                style: TextStyle(color: subtitleColor, height: 1.4),
              ),
              const SizedBox(height: 12),
              ...package.documents.map((document) {
                final statusColor = _statusColor(document.status);
                final isUploading = _uploadingDocuments[document.id] == true;

                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF2D1E12) : Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: statusColor.withOpacity(0.18)),
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
                                  document.documentType,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: titleColor,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: statusColor.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: Text(
                                    _statusLabel(document),
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      color: statusColor,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Uploaded: ${_formatTimestamp(document.uploadedAt)}',
                        style: TextStyle(color: subtitleColor),
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
                            onPressed: isUploading
                                ? null
                                : () => _pickAndUploadDocument(document),
                            icon: isUploading
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Icon(
                                    document.isSubmitted
                                        ? Icons.sync
                                        : Icons.upload_file,
                                  ),
                            label: Text(
                              isUploading
                                  ? 'Uploading...'
                                  : document.isSubmitted
                                  ? 'Replace File'
                                  : 'Upload File',
                            ),
                          ),
                          if (document.isSubmitted)
                            OutlinedButton.icon(
                              onPressed: () => _openFile(document),
                              icon: const Icon(Icons.open_in_new),
                              label: const Text('View File'),
                            ),
                        ],
                      ),
                    ],
                  ),
                );
              }),
            ],
          ],
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
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
