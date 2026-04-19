import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/scholar/presentation/widgets/scholar_nav_chips.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class RenewalRequirementsScreen extends StatefulWidget {
  const RenewalRequirementsScreen({super.key});

  @override
  State<RenewalRequirementsScreen> createState() =>
      _RenewalRequirementsScreenState();
}

class _RenewalRequirementsScreenState extends State<RenewalRequirementsScreen> {
  final List<_RenewalDocument> _requirements = [
    _RenewalDocument(
      title: 'Certificate of Registration',
      description: 'Official COR from the registrar for the current term',
      status: 'uploaded',
      fileName: 'COR_2ndSem_2026.pdf',
      updatedAt: 'Uploaded Apr 01',
      icon: Icons.assignment_outlined,
    ),
    _RenewalDocument(
      title: 'Grade Form / Transcript',
      description: 'Latest semester grades for renewal validation',
      status: 'uploaded',
      fileName: 'Grades_1stSem_2026.pdf',
      updatedAt: 'Uploaded Mar 28',
      icon: Icons.grade_outlined,
    ),
    _RenewalDocument(
      title: 'Enrollment Certification',
      description: 'Proof of current enrollment from your school',
      status: 'pending',
      icon: Icons.school_outlined,
    ),
  ];

  int get _uploadedCount =>
      _requirements.where((doc) => doc.status != 'pending').length;

  bool get _allRequiredUploaded =>
      _requirements.every((doc) => doc.status != 'pending');

  List<_RenewalDocument> get _sortedRequirements {
    final sorted = List<_RenewalDocument>.from(_requirements);
    sorted.sort((a, b) {
      final aUploaded = a.status != 'pending';
      final bUploaded = b.status != 'pending';
      if (aUploaded == bUploaded) {
        return 0;
      }
      return aUploaded ? 1 : -1;
    });
    return sorted;
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

  Future<void> _handleDocumentAction(_RenewalDocument document) async {
    final messenger = ScaffoldMessenger.of(context);

    if (document.status == 'review') {
      messenger.showSnackBar(
        SnackBar(content: Text('Viewing ${document.title} submission...')),
      );
      return;
    }

    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      allowMultiple: false,
    );

    if (result == null || result.files.isEmpty) {
      return;
    }

    final pickedFile = result.files.single;
    final fileName = pickedFile.name;
    final extension = fileName.split('.').last.toLowerCase();
    const allowedExtensions = {'pdf', 'jpg', 'jpeg', 'png'};

    if (!allowedExtensions.contains(extension)) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Only PDF, JPG, JPEG, and PNG files are allowed.'),
        ),
      );
      return;
    }

    final hadExistingFile = document.fileName != null;

    setState(() {
      document.status = 'uploaded';
      document.fileName = fileName;
      document.filePath = pickedFile.path;
      document.updatedAt = hadExistingFile
          ? 'Replaced just now'
          : 'Uploaded just now';
    });

    messenger.showSnackBar(
      SnackBar(
        content: Text(
          '${document.title} ${hadExistingFile ? 'replaced' : 'uploaded'} successfully.',
        ),
      ),
    );
  }

  Future<void> _viewSubmittedFile(_RenewalDocument document) async {
    final messenger = ScaffoldMessenger.of(context);

    if (document.filePath == null || document.filePath!.isEmpty) {
      messenger.showSnackBar(
        const SnackBar(
          content: Text('This sample file is not available to open yet.'),
        ),
      );
      return;
    }

    final result = await OpenFilex.open(document.filePath!);
    if (result.type != ResultType.done && mounted) {
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            result.message.isNotEmpty
                ? result.message
                : 'Unable to open the submitted file.',
          ),
        ),
      );
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'uploaded':
        return Colors.green;
      case 'review':
        return const Color(0xFFC76917);
      case 'pending':
      default:
        return primaryColor;
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'uploaded':
        return 'Uploaded';
      case 'review':
        return 'Pending Review';
      case 'pending':
      default:
        return 'Required';
    }
  }

  @override
  Widget build(BuildContext context) {
    final progress = _uploadedCount / _requirements.length;
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
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ScholarNavChips(
              selectedLabel: 'Renewal Documents',
              onTap: _handleScholarChipTap,
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: isDark
                    ? const Color(0xFF2D1E12)
                    : primaryColor.withOpacity(0.08),
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
                              'Submit all required documents to maintain your scholarship for the next release cycle.',
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
                        '$_uploadedCount/${_requirements.length}',
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
                      backgroundColor: isDark
                          ? const Color(0xFF24180F)
                          : Colors.white,
                      valueColor: AlwaysStoppedAnimation<Color>(accentColor),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(
                        Icons.event_outlined,
                        size: 16,
                        color: Colors.orange.shade700,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Renewal deadline: April 30, 2026',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.orange.shade800,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
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
              'Upload each document below. Allowed files: PDF, JPG, and PNG. You can replace files before final submission.',
              style: TextStyle(fontSize: 12, color: subtitleColor),
            ),
            const SizedBox(height: 14),
            ..._sortedRequirements.map(_buildDocumentRow),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _allRequiredUploaded
                    ? () {
                        showDialog<void>(
                          context: context,
                          builder: (context) => AlertDialog(
                            title: const Text('Renewal Submitted'),
                            content: const Text(
                              'Your renewal requirements have been submitted for review.',
                            ),
                            actions: [
                              TextButton(
                                onPressed: () {
                                  Navigator.pop(context);
                                  AppNavigator.goToTopLevel(
                                    context,
                                    AppRoutes.payouts,
                                  );
                                },
                                child: const Text('OK'),
                              ),
                            ],
                          ),
                        );
                      }
                    : null,
                icon: const Icon(Icons.send),
                label: const Text('Submit Renewal Requirements'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDocumentRow(_RenewalDocument document) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final statusColor = _statusColor(document.status);
    final hasFile = document.fileName != null;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.black54;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF332216) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: primaryColor.withOpacity(0.10)),
      ),
      child: Row(
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
            child: Icon(document.icon, color: accentColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  document.title,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                    color: titleColor,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  document.description,
                  style: TextStyle(fontSize: 12, color: subtitleColor),
                ),
                if (hasFile || document.updatedAt != null) ...[
                  const SizedBox(height: 6),
                  if (hasFile)
                    Text(
                      'Submitted file',
                      style: TextStyle(
                        fontSize: 10,
                        color: isDark ? Colors.white60 : Colors.grey.shade600,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.3,
                      ),
                    ),
                  if (hasFile) ...[
                    const SizedBox(height: 2),
                    Text(
                      document.fileName!,
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? Colors.white70 : Colors.grey.shade700,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  if (document.updatedAt != null)
                    Text(
                      document.updatedAt!,
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? Colors.white54 : Colors.black45,
                      ),
                    ),
                ],
                _buildDocumentActions(document),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  _statusLabel(document.status),
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentActions(_RenewalDocument document) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasFile = document.fileName != null;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          OutlinedButton.icon(
            onPressed: () => _handleDocumentAction(document),
            icon: Icon(
              document.status == 'uploaded' ? Icons.sync : Icons.upload_file,
              size: 16,
            ),
            label: Text(
              document.status == 'uploaded' ? 'Replace file' : 'Upload file',
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: accentColor,
              side: BorderSide(color: accentColor.withOpacity(0.35)),
              backgroundColor: isDark
                  ? const Color(0xFF3A2718)
                  : primaryColor.withOpacity(0.04),
            ),
          ),
          if (hasFile)
            TextButton.icon(
              onPressed: () => _viewSubmittedFile(document),
              icon: const Icon(Icons.visibility_outlined, size: 16),
              label: const Text('View file'),
              style: TextButton.styleFrom(
                foregroundColor: isDark ? accentColor : AppColors.darkBrown,
              ),
            ),
        ],
      ),
    );
  }
}

class _RenewalDocument {
  _RenewalDocument({
    required this.title,
    required this.description,
    required this.status,
    required this.icon,
    this.fileName,
    this.updatedAt,
  });

  final String title;
  final String description;
  String status;
  String? fileName;
  String? filePath;
  String? updatedAt;
  final IconData icon;
}
