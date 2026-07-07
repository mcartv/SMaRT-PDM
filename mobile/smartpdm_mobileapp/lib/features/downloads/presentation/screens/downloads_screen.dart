import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/printable_application_service.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';

class DownloadsScreen extends StatefulWidget {
  const DownloadsScreen({super.key, this.initialApplicationId});

  final String? initialApplicationId;

  @override
  State<DownloadsScreen> createState() => _DownloadsScreenState();
}

class _DownloadsScreenState extends State<DownloadsScreen> {
  final ApplicationService _applicationService = ApplicationService();
  final PrintableApplicationService _printableApplicationService =
      PrintableApplicationService();

  bool _isLoading = true;
  bool _isGenerating = false;
  String? _errorMessage;
  ApplicationStatusSummary? _summary;

  String get _applicationId {
    final explicit = widget.initialApplicationId?.trim() ?? '';
    if (explicit.isNotEmpty) return explicit;
    return _summary?.applicationId?.trim() ?? '';
  }

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final payload = await _applicationService.fetchMyApplicationStatusSummary();
      if (!mounted) return;
      setState(() {
        _summary = payload;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _summary = null;
        _errorMessage = error.toString().replaceFirst('Exception: ', '').trim();
        _isLoading = false;
      });
    }
  }

  Future<void> _downloadScholarshipForm() async {
    final applicationId = _applicationId;
    if (applicationId.isEmpty || _isGenerating) return;

    setState(() => _isGenerating = true);

    try {
      await _printableApplicationService.generateOpenFromApplicationId(
        applicationId,
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to generate PDF: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _isGenerating = false);
      }
    }
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return _StatePanel(
        icon: Icons.cloud_off_outlined,
        title: 'Unable to load downloads',
        message: _errorMessage!,
        actionLabel: 'Try Again',
        onAction: _loadSummary,
      );
    }

    if (_applicationId.isEmpty) {
      return _StatePanel(
        icon: Icons.assignment_late_outlined,
        title: 'No downloads available',
        message:
            'Submit a scholarship application before downloading filled templates.',
        actionLabel: 'Refresh',
        onAction: _loadSummary,
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Available Templates',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w900,
            color: AppColors.darkBrown,
          ),
        ),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFFEFE5D8)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.gold.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.picture_as_pdf_outlined,
                      color: primaryColor,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Scholarship Application Form',
                          style: Theme.of(context).textTheme.bodyLarge
                              ?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: textColor,
                              ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          _summary?.openingTitle?.trim().isNotEmpty == true
                              ? _summary!.openingTitle!
                              : _summary?.programName?.trim().isNotEmpty == true
                              ? _summary!.programName!
                              : 'Submitted scholarship application',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: Colors.black54,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _isGenerating ? null : _downloadScholarshipForm,
                  icon: _isGenerating
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.download_rounded),
                  label: Text(
                    _isGenerating
                        ? 'Generating PDF...'
                        : 'Download Filled PDF',
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: AppColors.darkBrown,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFFCF6),
      appBar: AppBar(
        title: const Text('Downloads'),
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(child: _buildBody()),
    );
  }
}

class _StatePanel extends StatelessWidget {
  const _StatePanel({
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 42, color: AppColors.brown),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w900,
                color: AppColors.darkBrown,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: Colors.black54,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 18),
            OutlinedButton(
              onPressed: onAction,
              child: Text(actionLabel),
            ),
          ],
        ),
      ),
    );
  }
}
