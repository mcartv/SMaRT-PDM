import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/models/opening_application_package.dart';
import 'package:smartpdm_mobileapp/services/opening_application_service.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';
import 'package:url_launcher/url_launcher.dart';

class OpeningApplicationDocumentsScreen extends StatefulWidget {
  const OpeningApplicationDocumentsScreen({
    super.key,
    required this.openingId,
    this.initialApplicationId,
    this.initialOpeningTitle,
    this.initialProgramName,
  });

  final String openingId;
  final String? initialApplicationId;
  final String? initialOpeningTitle;
  final String? initialProgramName;

  @override
  State<OpeningApplicationDocumentsScreen> createState() =>
      _OpeningApplicationDocumentsScreenState();
}

class _OpeningApplicationDocumentsScreenState
    extends State<OpeningApplicationDocumentsScreen> {
  final OpeningApplicationService _service = OpeningApplicationService();

  OpeningApplicationPackage? _package;
  bool _isLoading = true;
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
    });

    try {
      final payload = await _service.fetchOpeningApplication(widget.openingId);
      if (!mounted) return;
      setState(() => _package = payload);
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
    OpeningApplicationDocument document,
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
        openingId: widget.openingId,
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

  Future<void> _openFile(OpeningApplicationDocument document) async {
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

  String _statusLabel(OpeningApplicationDocument document) {
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

  String _summaryText(OpeningApplicationPackage package) {
    if (package.documentStatus == 'Documents Ready') {
      return 'All scholarship requirements are already on file and ready for review.';
    }

    if (package.documentStatus == 'Under Review' &&
        !package.allRequiredUploaded) {
      return 'Continue uploading the remaining scholarship requirements so admin can finish reviewing your application.';
    }

    return 'Upload the remaining scholarship requirements for this opening so your application can move toward scholar approval.';
  }

  String _formatTimestamp(DateTime? value) {
    if (value == null) return 'Not uploaded yet';
    return DateFormat('MMM d, yyyy • h:mm a').format(value.toLocal());
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
                    package?.openingTitle ??
                        widget.initialOpeningTitle ??
                        'Scholarship Opening',
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
                        'Scholarship Program',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: accentColor,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    package == null
                        ? 'Loading your scholarship requirements...'
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
                        _StatusBadge(
                          label:
                              '${package.uploadedCount}/${package.documents.length} Uploaded',
                          color: accentColor,
                        ),
                        _StatusBadge(
                          label: package.documentStatus,
                          color: _statusColor(
                            package.documentStatus == 'Documents Ready'
                                ? 'verified'
                                : package.documentStatus == 'Missing Docs'
                                ? 'pending'
                                : 'uploaded',
                          ),
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
            else if (_errorMessage != null)
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.red.withOpacity(0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Unable to load scholarship requirements',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _errorMessage!,
                      style: TextStyle(color: subtitleColor, height: 1.4),
                    ),
                    const SizedBox(height: 14),
                    OutlinedButton.icon(
                      onPressed: _loadPackage,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry'),
                    ),
                  ],
                ),
              )
            else if (package == null || package.documents.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 32),
                child: Text(
                  'No scholarship requirements are available for this opening yet.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: subtitleColor),
                ),
              )
            else
              ...package.documents.map((document) {
                final isUploading = _uploadingDocuments[document.id] == true;

                return Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? const Color(0xFF2D1E12) : Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x12000000),
                        blurRadius: 10,
                        offset: Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              document.documentType,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: titleColor,
                              ),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: _statusColor(
                                document.status,
                              ).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              _statusLabel(document),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: _statusColor(document.status),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        document.isSubmitted
                            ? 'Uploaded ${_formatTimestamp(document.uploadedAt)}'
                            : 'This requirement is still missing from your opening application.',
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.4,
                          color: subtitleColor,
                        ),
                      ),
                      if ((document.adminComment ?? '').trim().isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.orange.withOpacity(0.08),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            document.adminComment!.trim(),
                            style: TextStyle(
                              color: isDark
                                  ? Colors.orange.shade100
                                  : Colors.orange.shade900,
                              height: 1.35,
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
                                        ? Icons.refresh
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
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}
