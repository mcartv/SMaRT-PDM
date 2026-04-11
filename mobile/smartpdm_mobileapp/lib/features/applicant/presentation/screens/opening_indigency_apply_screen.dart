
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class OpeningIndigencyApplyScreen extends StatefulWidget {
  const OpeningIndigencyApplyScreen({super.key, required this.opening});

  final ProgramOpening opening;

  @override
  State<OpeningIndigencyApplyScreen> createState() =>
      _OpeningIndigencyApplyScreenState();
}

class _OpeningIndigencyApplyScreenState
    extends State<OpeningIndigencyApplyScreen> {
  final ProgramOpeningService _programOpeningService = ProgramOpeningService();

  String? _selectedFileName;
  String? _selectedFilePath;
  Uint8List? _selectedFileBytes;
  bool _isSubmitting = false;
  String? _submissionError;

  Future<void> _pickFile() async {
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
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Only PDF, JPG, JPEG, and PNG files are allowed.'),
        ),
      );
      return;
    }

    if (kIsWeb && (fileBytes == null || fileBytes.isEmpty)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'The selected file could not be read in the browser. Please try another file.',
          ),
        ),
      );
      return;
    }

    if (!mounted) return;

    setState(() {
      _selectedFileName = fileName;
      _selectedFilePath = filePath;
      _selectedFileBytes = fileBytes;
      _submissionError = null;
    });
  }

  Future<void> _submit() async {
    if (_selectedFileName == null ||
        ((_selectedFilePath == null || _selectedFilePath!.isEmpty) &&
            _selectedFileBytes == null)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please upload your Certificate of Indigency first.'),
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
      _submissionError = null;
    });

    try {
      final response = await _programOpeningService.applyToOpening(
        openingId: widget.opening.openingId,
        fileName: _selectedFileName!,
        filePath: _selectedFilePath,
        fileBytes: _selectedFileBytes,
      );

      if (!mounted) return;
      final application =
          response['application'] as Map<String, dynamic>? ?? const {};
      final applicationId = application['application_id']?.toString() ?? '';
      final message =
          response['message']?.toString() ??
          'Application submitted successfully.';

      Navigator.pushReplacementNamed(
        context,
        AppRoutes.success,
        arguments: {
          'appBarTitle': 'Application Submitted',
          'title': widget.opening.canReapply && widget.opening.hasApplied
              ? 'TES Application Re-submitted!'
              : 'Application Submitted Successfully!',
          'message': message,
          'applicationId': applicationId,
          'openingId': widget.opening.openingId,
          'openingTitle': widget.opening.openingTitle,
          'programName': widget.opening.programName,
        },
      );
    } catch (error) {
      if (!mounted) return;
      final message = error.toString().replaceFirst('Exception: ', '').trim();
      setState(() => _submissionError = message);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final cardColor = isDark ? const Color(0xFF2D1E12) : Colors.white;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;

    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Upload Indigency')),
      selectedIndex: 0,
      showDrawer: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: cardColor,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: accentColor.withOpacity(0.18)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.opening.openingTitle,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: titleColor,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    widget.opening.programName,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: accentColor,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Upload your Certificate of Indigency to start this application. After submission, you can continue uploading the rest of your scholarship requirements from Documents.',
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.4,
                      color: isDark ? Colors.white70 : Colors.black87,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: cardColor,
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
                  Text(
                    'Accepted formats',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: titleColor,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'PDF, JPG, JPEG, or PNG',
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? Colors.white70 : Colors.black54,
                    ),
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: _isSubmitting ? null : _pickFile,
                    icon: const Icon(Icons.upload_file),
                    label: Text(
                      _selectedFileName == null
                          ? 'Choose Certificate of Indigency'
                          : 'Replace File',
                    ),
                  ),
                  if (_selectedFileName != null) ...[
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Icon(Icons.description_outlined, color: accentColor),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _selectedFileName!,
                            style: TextStyle(
                              color: titleColor,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  if (_submissionError != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.red.withOpacity(0.18)),
                      ),
                      child: Text(
                        _submissionError!,
                        style: TextStyle(
                          color: isDark
                              ? Colors.red.shade200
                              : Colors.red.shade700,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _submit,
                icon: _isSubmitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.check_circle_outline),
                label: Text(
                  _isSubmitting ? 'Submitting...' : widget.opening.applyLabel,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
