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

  Future<void> _handleGeneratePdf({
    required String applicationId,
    required Map<String, dynamic>? submissionPayload,
  }) async {
    setState(() => _isGeneratingPdf = true);

    try {
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
      
      final directory = await getApplicationDocumentsDirectory();
      
      final exportFile = File('${directory.path}/$fileName');
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

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required Color backgroundColor,
    required Color textColor,
    required Color iconColor,
    required VoidCallback? onTap,
    Color? borderColor,
    bool isLoading = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: InkWell(
        onTap: isLoading ? null : onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(16),
            border: borderColor != null
                ? Border.all(color: borderColor, width: 1)
                : null,
            boxShadow: backgroundColor == Colors.white
                ? [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    )
                  ]
                : [],
          ),
          child: Row(
            children: [
              isLoading
                  ? SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: iconColor),
                    )
                  : Icon(icon, color: iconColor),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: textColor,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Icon(Icons.chevron_right, color: textColor.withOpacity(0.8)),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)?.settings.arguments;
    final payload = args is Map<String, dynamic> ? args : const {};
    final rawTitle =
        payload['title']?.toString() ?? 'Application Submitted Successfully!';
    
    // Format the title to split nicely like in the design if it's the default string
    String title = rawTitle;
    if (title == 'Application Submitted Successfully!') {
      title = 'Application Submitted\nSuccessfully!';
    }

    final message =
        payload['message']?.toString() ??
        'Your scholarship application was submitted.\nYou can continue in Documents to upload\nthe required files for this opening.';
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
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(
          appBarTitle,
          style: const TextStyle(
            color: Colors.black,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: AppColors.gold, size: 20),
          onPressed: () {
             Navigator.maybePop(context);
          },
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Checkmark Graphic
              const SizedBox(height: 20),
              Center(
                child: SizedBox(
                  width: 200,
                  height: 160,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Faint glow background
                      Container(
                        width: 140,
                        height: 140,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            colors: [
                              AppColors.gold.withOpacity(0.15),
                              Colors.transparent,
                            ],
                            stops: const [0.3, 1.0],
                          ),
                        ),
                      ),
                      // The gold circle with checkmark
                      Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.gold, width: 5),
                          color: Colors.white,
                        ),
                        child: const Center(
                          child: Icon(
                            Icons.check,
                            color: AppColors.gold,
                            size: 50,
                          ),
                        ),
                      ),
                      // Sparkles
                      const Positioned(
                        top: 20,
                        left: 40,
                        child: Icon(Icons.star, color: AppColors.gold, size: 14),
                      ),
                      Positioned(
                        top: 45,
                        left: 20,
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.gold,
                          ),
                        ),
                      ),
                      const Positioned(
                        top: 30,
                        right: 40,
                        child: Icon(Icons.star_border, color: AppColors.gold, size: 18),
                      ),
                      Positioned(
                        top: 70,
                        right: 15,
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.gold,
                          ),
                        ),
                      ),
                      const Positioned(
                        bottom: 25,
                        left: 45,
                        child: Icon(Icons.star_border, color: AppColors.gold, size: 16),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 30),
              
              // Title
              Text(
                title,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.black,
                  height: 1.3,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              
              // Subtitle
              Text(
                message,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey.shade600,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),
              
              // Action Buttons
              if (canGeneratePdf)
                _buildActionTile(
                  icon: Icons.file_download_outlined,
                  title: _isGeneratingPdf ? 'Generating PDF...' : 'Export Application Form',
                  backgroundColor: AppColors.gold,
                  textColor: Colors.black,
                  iconColor: Colors.black,
                  isLoading: _isGeneratingPdf,
                  onTap: _isGeneratingPdf
                      ? null
                      : () => _handleGeneratePdf(
                            applicationId: applicationId,
                            submissionPayload: submissionPayload,
                          ),
                ),
                
              if (canUploadRequirements)
                _buildActionTile(
                  icon: Icons.description_outlined,
                  title: 'View Documents',
                  backgroundColor: Colors.white,
                  textColor: Colors.black,
                  iconColor: AppColors.gold,
                  borderColor: Colors.grey.shade200,
                  onTap: () {
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
                ),
                
              _buildActionTile(
                icon: Icons.home_outlined,
                title: 'Back to Dashboard',
                backgroundColor: Colors.white,
                textColor: Colors.black,
                iconColor: AppColors.gold,
                borderColor: Colors.grey.shade200,
                onTap: () {
                  Navigator.pushNamedAndRemoveUntil(
                    context,
                    AppRoutes.home,
                    (route) => false,
                  );
                },
              ),
              
              const SizedBox(height: 24),
              
              // Bottom Banner
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [
                      Color(0xFFFFF9E6),
                      Color(0xFFFFF0C2),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.gold.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 20,
                          height: 20,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: Colors.white,
                          ),
                        ),
                        const Icon(
                          Icons.info,
                          color: AppColors.gold,
                          size: 24,
                        ),
                      ],
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        "You can track your application status anytime in your dashboard.",
                        style: TextStyle(
                          color: Colors.grey.shade800,
                          fontSize: 13,
                          height: 1.4,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Icon(
                      Icons.fact_check_outlined, 
                      color: AppColors.gold.withOpacity(0.8),
                      size: 48,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }
}
