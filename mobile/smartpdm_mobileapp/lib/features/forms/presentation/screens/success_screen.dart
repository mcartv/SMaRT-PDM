import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:share_plus/share_plus.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/printable_application_service.dart';

class SuccessScreen extends StatefulWidget {
  const SuccessScreen({super.key, this.printableApplicationService});

  final PrintableApplicationService? printableApplicationService;

  @override
  State<SuccessScreen> createState() => _SuccessScreenState();
}

class _SuccessScreenState extends State<SuccessScreen> {
  late final PrintableApplicationService _printableApplicationService;
  bool _isGeneratingPdf = false;

  @override
  void initState() {
    super.initState();
    _printableApplicationService =
        widget.printableApplicationService ?? PrintableApplicationService();
  }

  Map<String, dynamic>? _mapPayload(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) {
      return value.map((key, mapValue) => MapEntry('$key', mapValue));
    }
    return null;
  }

  Future<bool> _requestStoragePermission() async {
    if (Platform.isIOS) return true;
    
    // For Android 11+ (API 30+)
    if (await Permission.manageExternalStorage.isRestricted) {
      // Manage external storage is not restricted on older OS, but needed for new ones
    }
    
    var status = await Permission.storage.status;
    if (!status.isGranted) {
      status = await Permission.storage.request();
    }
    
    // If storage is permanently denied on Android 11+, we might need manageExternalStorage
    if (status.isPermanentlyDenied || status.isRestricted) {
      var manageStatus = await Permission.manageExternalStorage.request();
      return manageStatus.isGranted;
    }
    
    return status.isGranted;
  }

  Future<void> _handleGeneratePdf({
    required String applicationId,
    required Map<String, dynamic>? submissionPayload,
  }) async {
    setState(() => _isGeneratingPdf = true);

    try {
      if (!await _requestStoragePermission()) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Storage permission required to save PDF'))
        );
        return;
      }

      File generatedFile;
      if (submissionPayload != null) {
        debugPrint('Generating PDF from raw submission payload...');
        generatedFile = await _printableApplicationService.generateFromSubmissionPayload(
          submissionPayload,
        );
      } else {
        debugPrint('Generating PDF from application ID: $applicationId...');
        generatedFile = await _printableApplicationService.generateFromApplicationId(
          applicationId,
        );
      }
      debugPrint('PDF generation successful. Copying to downloads...');

      final safeAppId = applicationId.isNotEmpty ? applicationId : 'Guest';
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      String fileName = 'Scholarship_Application_${safeAppId}_$timestamp.pdf';
      
      Directory? directory;
      if (Platform.isAndroid) {
        final dirs = await getExternalStorageDirectories(type: StorageDirectory.downloads);
        directory = (dirs != null && dirs.isNotEmpty) ? dirs.first : await getExternalStorageDirectory();
      } else {
        directory = await getApplicationDocumentsDirectory();
      }
      
      final exportFile = File('${directory!.path}/$fileName');
      await generatedFile.copy(exportFile.path);
      
      // Cleanup temporary file
      if (generatedFile.existsSync()) {
        await generatedFile.delete();
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Application form saved to downloads.'),
          duration: const Duration(seconds: 5),
          action: SnackBarAction(
            label: 'Share',
            onPressed: () async {
              await Share.shareXFiles([XFile(exportFile.path)],
                  text: 'SMaRT-PDM Scholarship Application');
            },
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to export PDF: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _isGeneratingPdf = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments;
    final payload = args is Map<String, dynamic> ? args : const {};
    final title =
        payload['title']?.toString() ?? 'Application Submitted Successfully!';
    final message =
        payload['message']?.toString() ??
        'Your scholarship application was submitted. You can continue in Documents to upload the required files for this opening.';
    final appBarTitle =
        payload['appBarTitle']?.toString() ?? 'Application Submitted';
    final applicationId = payload['applicationId']?.toString() ?? '';
    final openingId = payload['openingId']?.toString() ?? '';
    final openingTitle = payload['openingTitle']?.toString();
    final programName = payload['programName']?.toString();
    final submissionPayload = _mapPayload(payload['submissionPayload']);
    final canGeneratePdf =
        submissionPayload != null || applicationId.trim().isNotEmpty;
    final canUploadRequirements =
        payload['canUploadRequirements'] == true ||
        openingId.trim().isNotEmpty ||
        applicationId.trim().isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: Text(appBarTitle),
        backgroundColor: primaryColor,
        automaticallyImplyLeading: false, // Prevent back button
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(padding),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.check_circle_outline,
                color: Colors.green,
                size: 100,
              ),
              const SizedBox(height: 20),
              Text(
                title,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              if (canGeneratePdf) ...[
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _isGeneratingPdf
                      ? null
                      : () => _handleGeneratePdf(
                          applicationId: applicationId,
                          submissionPayload: submissionPayload,
                        ),
                  icon: _isGeneratingPdf
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.file_download_outlined),
                  label: Text(
                    _isGeneratingPdf
                        ? 'Generating PDF...'
                        : 'Export Application Form',
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFC9A84C), // PDM gold
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  ),
                ),
              ],
              if (canUploadRequirements) ...[
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pushNamed(
                      context,
                      AppRoutes.documents,
                      arguments: <String, dynamic>{
                        'initialTitle': openingId.trim().isNotEmpty
                            ? openingTitle
                            : 'Scholarship Requirements',
                        'initialProgramName': programName,
                      },
                    );
                  },
                  icon: const Icon(Icons.upload_file_outlined),
                  label: Text('View Documents'),
                ),
              ],
              const SizedBox(height: 30),
              ElevatedButton(
                onPressed: () {
                  Navigator.pushNamedAndRemoveUntil(
                    context,
                    AppRoutes.home,
                    (route) => false,
                  ); // Go back to dashboard
                },
                child: Text('Back to Dashboard'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
