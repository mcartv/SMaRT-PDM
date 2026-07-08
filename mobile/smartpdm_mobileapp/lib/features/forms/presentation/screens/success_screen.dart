import 'package:flutter/material.dart';
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

  Future<void> _handleGeneratePdf({
    required String applicationId,
    required Map<String, dynamic>? submissionPayload,
  }) async {
    setState(() => _isGeneratingPdf = true);

    try {
      if (submissionPayload != null) {
        await _printableApplicationService.generateOpenFromSubmissionPayload(
          submissionPayload,
        );
      } else {
        await _printableApplicationService.generateOpenFromApplicationId(
          applicationId,
        );
      }
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to generate printable PDF: $error')),
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
                OutlinedButton.icon(
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
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.picture_as_pdf_outlined),
                  label: Text(
                    _isGeneratingPdf
                        ? 'Generating PDF...'
                        : 'Download Printable PDF',
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
