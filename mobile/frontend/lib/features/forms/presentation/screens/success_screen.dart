import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/core/files/downloaded_file_handler.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/printable_application_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';

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
    if (_isGeneratingPdf) return;

    setState(() => _isGeneratingPdf = true);

    try {
      // Export the persisted form whenever it is available. This is the
      // source of truth after submission and includes the complete saved
      // application rather than a possibly stale route payload.
      final bytes = applicationId.trim().isNotEmpty
          ? await _printableApplicationService
                .generateBytesFromMySubmittedApplicationForm()
          : await _printableApplicationService
                .generateBytesFromSubmissionPayload(submissionPayload ?? const {});

      if (!mounted) return;

      final message = await saveAndOpenDownloadedFile(
        bytes: bytes,
        fileName: 'SMaRT-PDM_Application_Form.pdf',
        contentType: 'application/pdf',
      );

      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Failed to export PDF: $error')));
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
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: InkWell(
        onTap: isLoading ? null : onTap,
        borderRadius: AppRadii.card,
        child: Container(
          constraints: const BoxConstraints(minHeight: AppSizes.minimumTapTarget),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.md),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: AppRadii.card,
            border: borderColor != null
                ? Border.all(color: borderColor, width: 1)
                : null,
            boxShadow: backgroundColor == Colors.white
                ? [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
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
                        strokeWidth: 2,
                        color: iconColor,
                      ),
                    )
                  : Icon(icon, color: iconColor),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: textColor,
                    fontWeight: FontWeight.w800,
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final pageColor = AppSurfacePalette.background(context);
    final surfaceColor = AppSurfacePalette.surface(context);
    final secondarySurface = AppSurfacePalette.surface(context);
    final outlineColor = AppSurfacePalette.outline(context);
    final titleColor = AppSurfacePalette.text(context);
    final bodyColor = AppSurfacePalette.mutedText(context);

    final args = ModalRoute.of(context)?.settings.arguments;
    final payload = args is Map<String, dynamic> ? args : const {};
    final rawTitle =
        payload['title']?.toString() ?? 'Application Submitted Successfully!';

    final title = rawTitle;

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
      backgroundColor: pageColor,
      appBar: AppBar(
        title: Text(
          appBarTitle,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        backgroundColor: AppSurfacePalette.surface(context),
        foregroundColor: AppSurfacePalette.text(context),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios,
            color: AppColors.gold,
            size: 20,
          ),
          onPressed: () {
            Navigator.maybePop(context);
          },
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            MediaQuery.sizeOf(context).width < 360 ? 14 : 22,
            18,
            MediaQuery.sizeOf(context).width < 360 ? 14 : 22,
            28,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 680),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: EdgeInsets.all(
                      MediaQuery.sizeOf(context).width < 360 ? 18 : 26,
                    ),
                    decoration: BoxDecoration(
                      color: surfaceColor,
                      borderRadius: AppRadii.card,
                      border: Border.all(color: outlineColor),
                      boxShadow: isDark
                          ? const []
                          : const [
                              BoxShadow(
                                color: Color(0x0D000000),
                                blurRadius: 18,
                                offset: Offset(0, 8),
                              ),
                            ],
                    ),
                    child: Column(
                      children: [
                        const SizedBox(height: 4),
                        Center(
                          child: SizedBox(
                            width: 176,
                            height: 142,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                Container(
                                  width: 128,
                                  height: 128,
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
                                Container(
                                  width: 92,
                                  height: 92,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                      color: AppColors.gold,
                                      width: 5,
                                    ),
                                    color: isDark
                                        ? AppColors.applicantDarkSurfaceMuted
                                        : Colors.white,
                                  ),
                                  child: const Center(
                                    child: Icon(
                                      Icons.check,
                                      color: AppColors.gold,
                                      size: 46,
                                    ),
                                  ),
                                ),
                                const Positioned(
                                  top: 20,
                                  left: 40,
                                  child: Icon(
                                    Icons.star,
                                    color: AppColors.gold,
                                    size: 14,
                                  ),
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
                                  child: Icon(
                                    Icons.star_border,
                                    color: AppColors.gold,
                                    size: 18,
                                  ),
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
                                  child: Icon(
                                    Icons.star_border,
                                    color: AppColors.gold,
                                    size: 16,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        Text(
                          title,
                          style: Theme.of(context)
                              .textTheme
                              .headlineSmall
                              ?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: titleColor,
                                height: 1.2,
                              ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 14),
                        Text(
                          message,
                          textAlign: TextAlign.center,
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(color: bodyColor, height: 1.5),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 26),

                  // Action Buttons
                  if (canGeneratePdf)
                    _buildActionTile(
                      icon: Icons.file_download_outlined,
                      title: _isGeneratingPdf
                          ? 'Generating PDF...'
                          : 'Export Application Form',
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
                      backgroundColor: secondarySurface,
                      textColor: titleColor,
                      iconColor: AppColors.gold,
                      borderColor: outlineColor,
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
                    backgroundColor: secondarySurface,
                    textColor: titleColor,
                    iconColor: AppColors.gold,
                    borderColor: outlineColor,
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
                      color: AppStatusColors.of(context).inProgressContainer,
                      borderRadius: AppRadii.card,
                      border: Border.all(
                        color: AppStatusColors.of(context).inProgressOutline,
                      ),
                    ),
                    child: Row(
                      children: [
                        Stack(
                          alignment: Alignment.center,
                          children: [
                            Container(
                              width: 20,
                              height: 20,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isDark
                                    ? AppColors.applicantDarkSurface
                                    : Colors.white,
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
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(
                                  color: AppStatusColors.of(context)
                                      .onInProgressContainer,
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
        ),
      ),
    );
  }
}
