import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/navigation/app_routes.dart';
import 'package:smartpdm_mobileapp/services/printable_application_service.dart';

class SuccessScreen extends StatefulWidget {
  const SuccessScreen({super.key});

  @override
  State<SuccessScreen> createState() => _SuccessScreenState();
}

class _SuccessScreenState extends State<SuccessScreen> {
  final PrintableApplicationService _printableApplicationService =
      PrintableApplicationService();
  bool _isGeneratingPdf = false;

  Future<void> _handleGeneratePdf(String applicationId) async {
    setState(() => _isGeneratingPdf = true);

    try {
      await _printableApplicationService.generateOpenFromApplicationId(
        applicationId,
      );
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
        'Please check your email for a confirmation and a reminder of documentary requirements.';
    final appBarTitle =
        payload['appBarTitle']?.toString() ?? 'Application Submitted';
    final applicationId = payload['applicationId']?.toString() ?? '';
    final openingId = payload['openingId']?.toString() ?? '';
    final openingTitle = payload['openingTitle']?.toString();
    final programName = payload['programName']?.toString();
    final canGeneratePdf = applicationId.trim().isNotEmpty;
    final canUploadRequirements =
        payload['canUploadRequirements'] == true ||
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
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16),
              ),
              if (canGeneratePdf) ...[
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: _isGeneratingPdf
                      ? null
                      : () => _handleGeneratePdf(applicationId),
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
                  label: const Text('Upload Requirements'),
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
                child: const Text('Back to Dashboard'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
