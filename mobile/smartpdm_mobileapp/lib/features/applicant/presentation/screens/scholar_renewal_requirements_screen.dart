import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/models/scholar_renewal.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/scholar/data/services/renewal_service.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_nav_chips.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';
import 'package:url_launcher/url_launcher.dart';

class ScholarRenewalRequirementsScreen extends StatefulWidget {
  const ScholarRenewalRequirementsScreen({super.key});

  @override
  State<ScholarRenewalRequirementsScreen> createState() =>
      _ScholarRenewalRequirementsScreenState();
}

class _ScholarRenewalRequirementsScreenState
    extends State<ScholarRenewalRequirementsScreen> {
  final RenewalService _renewalService = RenewalService();

  ScholarRenewalPackage? _renewalPackage;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _errorMessage;
  final Map<String, bool> _uploadingDocuments = <String, bool>{};

  @override
  void initState() {
    super.initState();
    _loadRenewal();
  }

  Future<void> _loadRenewal() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final payload = await _renewalService.fetchCurrentRenewal();
      if (!mounted) return;
      setState(() => _renewalPackage = payload);
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

  void _handleScholarChipTap(String label) {
    switch (label) {
      case 'Payout Schedule':
        AppNavigator.goToTopLevel(context, AppRoutes.payouts);
        break;
      case 'Renewal Documents':
        break;
      case 'RO Assignment':
        Navigator.pushNamed(context, AppRoutes.roAssignment);
        break;
      case 'RO Completion':
        Navigator.pushNamed(context, AppRoutes.roCompletion);
        break;
    }
  }

  Future<void> _pickAndUploadDocument(ScholarRenewalDocument document) async {
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
      }
    }
  }

  Future<void> _submitRenewal() async {
    if (_renewalPackage == null || !_renewalPackage!.allRequiredUploaded) {
      _showSnackBar('Please upload both required renewal documents first.');
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final payload = await _renewalService.submitRenewal();
      if (!mounted) return;
      setState(() => _renewalPackage = payload);
      await showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Renewal Submitted'),
          content: const Text(
            'Your renewal requirements have been submitted for admin review.',
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                AppNavigator.goToTopLevel(context, AppRoutes.payouts);
              },
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
      }
    }
  }

  Future<void> _openFile(ScholarRenewalDocument document) async {
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
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
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

  String _statusLabel(ScholarRenewalDocument document) {
    switch (document.status) {
      case 'verified':
        return 'Verified';
      case 'uploaded':
        return 'Uploaded';
      case 'rejected':
        return 'Re-upload';
      case 'pending':
      default:
        return 'Required';
    }
  }

  String _renewalSummary(ScholarRenewalPackage package) {
    final status = package.renewal.renewalStatus;
    if (status == 'Approved') {
      return 'Your renewal package has been approved for this cycle.';
    }
    if (status == 'Under Review') {
      return 'Your renewal package is now pending admin review.';
    }
    if (status == 'Failed') {
      return 'Admin requested a re-upload. Replace the flagged file and submit again.';
    }
    return 'Upload both required documents to maintain your scholarship for the current release cycle.';
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.black54;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Renewal Documents'),
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
        elevation: 0,
      ),
      selectedIndex: 1,
      showDrawer: false,
      child: RefreshIndicator(
        onRefresh: _loadRenewal,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ScholarNavChips(
              selectedLabel: 'Renewal Documents',
              onTap: _handleScholarChipTap,
            ),
            const SizedBox(height: 20),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 80),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_errorMessage != null)
              _RenewalErrorCard(
                message: _errorMessage!,
                onRetry: _loadRenewal,
              )
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
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: titleColor,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Upload your Certificate of Registration and latest Grade Form / Transcript. Allowed files: PDF, JPG, and PNG.',
                style: TextStyle(fontSize: 12, color: subtitleColor),
              ),
              const SizedBox(height: 14),
              ..._renewalPackage!.documents.map(
                (document) => _buildDocumentRow(
                  document: document,
                  package: _renewalPackage!,
                  isDark: isDark,
                  titleColor: titleColor,
                  subtitleColor: subtitleColor,
                  accentColor: accentColor,
                ),
              ),
              if ((_renewalPackage!.renewal.adminComment ?? '').trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.orange.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.orange.withOpacity(0.18)),
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
                  onPressed:
                      _isSubmitting ||
                              _renewalPackage!.renewal.isLockedForReview ||
                              !_renewalPackage!.allRequiredUploaded
                          ? null
                          : _submitRenewal,
                  icon: _isSubmitting
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send),
                  label: Text(
                    _isSubmitting
                        ? 'Submitting...'
                        : _renewalPackage!.renewal.isLockedForReview
                        ? 'Awaiting Admin Review'
                        : 'Submit Renewal Requirements',
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
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
        color: isDark ? const Color(0xFF2D1E12) : primaryColor.withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: primaryColor.withOpacity(0.12)),
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
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _renewalSummary(package),
                      style: TextStyle(
                        fontSize: 12,
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
                style: TextStyle(
                  fontSize: 22,
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
                    '${package.programName} • ${package.semesterLabel} Sem AY ${package.schoolYearLabel}',
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
    final canUpload =
        !package.renewal.isLockedForReview ||
        package.renewal.renewalStatus == 'Failed';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF332216) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: primaryColor.withOpacity(0.10)),
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
                  : primaryColor.withOpacity(0.08),
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
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: titleColor,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  document.documentType == 'Certificate of Registration'
                      ? 'Official COR from the registrar for the current term.'
                      : 'Latest semester grades or transcript for renewal validation.',
                  style: TextStyle(fontSize: 12, color: subtitleColor),
                ),
                if (document.hasFile || document.submittedAt != null) ...[
                  const SizedBox(height: 6),
                  if (document.hasFile)
                    Text(
                      'Submitted file available',
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? Colors.white60 : Colors.grey.shade700,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  if (document.submittedAt != null)
                    Text(
                      document.submittedAt!,
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? Colors.white54 : Colors.black45,
                      ),
                    ),
                  if (document.adminComment.trim().isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      document.adminComment,
                      style: TextStyle(
                        fontSize: 11,
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
                        onPressed:
                            isUploading || !canUpload
                                ? null
                                : () => _pickAndUploadDocument(document),
                        icon: isUploading
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2),
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
                          side: BorderSide(color: accentColor.withOpacity(0.35)),
                          backgroundColor: isDark
                              ? const Color(0xFF3A2718)
                              : primaryColor.withOpacity(0.04),
                        ),
                      ),
                      if (document.hasFile)
                        TextButton.icon(
                          onPressed: () => _openFile(document),
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
              color: statusColor.withOpacity(0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              _statusLabel(document),
              style: TextStyle(
                color: statusColor,
                fontWeight: FontWeight.w700,
                fontSize: 11,
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
        color: Colors.white.withOpacity(0.75),
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
              style: const TextStyle(
                fontSize: 11,
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
        color: Colors.red.withOpacity(0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.red.withOpacity(0.18)),
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
