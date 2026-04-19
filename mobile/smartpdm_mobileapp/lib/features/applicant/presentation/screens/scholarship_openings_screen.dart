import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ScholarshipOpeningsScreen extends StatefulWidget {
  const ScholarshipOpeningsScreen({super.key});

  @override
  State<ScholarshipOpeningsScreen> createState() =>
      _ScholarshipOpeningsScreenState();
}

class _ScholarshipOpeningsScreenState extends State<ScholarshipOpeningsScreen> {
  static const int _defaultRequiredDocumentCount = 8;
  final ProgramOpeningService _programOpeningService = ProgramOpeningService();

  bool _isLoading = true;
  ProgramOpeningsResult? _result;
  String? _error;
  List<ProgramOpening> _openings = const [];

  @override
  void initState() {
    super.initState();
    _loadOpenings();
  }

  Future<void> _loadOpenings() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final result = await _programOpeningService.fetchAvailableOpenings();
      if (!mounted) return;

      setState(() {
        _result = result;
        _openings = result.items;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  String _formatDateRange(ProgramOpening opening) {
    String format(String value) {
      if (value.isEmpty) return 'TBA';
      final parsed = DateTime.tryParse(value);
      if (parsed == null) return value;
      return DateFormat('MMM d, yyyy').format(parsed);
    }

    return '${format(opening.applicationStart)} - ${format(opening.applicationEnd)}';
  }

  Future<void> _openApplicationForm({
    ProgramOpening? opening,
    bool replaceExistingDraft = false,
  }) async {
    await Navigator.pushNamed(
      context,
      AppRoutes.newApplicant,
      arguments: opening == null
          ? null
          : <String, dynamic>{
              'openingId': opening.openingId,
              'openingTitle': opening.openingTitle,
              'programName': opening.programName,
              'replaceExistingDraft': replaceExistingDraft,
            },
    );

    if (!mounted) return;
    await _loadOpenings();
  }

  Future<void> _handleApply(ProgramOpening opening) async {
    final result = _result;

    if (opening.hasApplied &&
        (opening.existingApplicationId?.isNotEmpty ?? false)) {
      await Navigator.pushNamed(
        context,
        AppRoutes.documents,
        arguments: <String, dynamic>{
          'initialTitle': opening.openingTitle,
          'initialProgramName': opening.programName,
        },
      );

      if (!mounted) return;
      await _loadOpenings();
      return;
    }

    if (!opening.canApply) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(opening.applyLabel)));
      return;
    }

    if (result?.hasSavedDraft == true &&
        result!.draftOpeningId.trim().isNotEmpty &&
        result.draftOpeningId != opening.openingId) {
      final replaceDraft = await showDialog<bool>(
        context: context,
        builder: (dialogContext) {
          return AlertDialog(
            title: const Text('Existing draft found'),
            content: Text(
              'You already have a saved draft for ${result.draftOpeningTitle.isNotEmpty ? result.draftOpeningTitle : 'another scholarship opening'}. Continue that draft or replace it with ${opening.openingTitle}?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Continue Draft'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Replace Draft'),
              ),
            ],
          );
        },
      );

      if (replaceDraft == null) {
        return;
      }

      await _openApplicationForm(
        opening: replaceDraft ? opening : null,
        replaceExistingDraft: replaceDraft,
      );
      return;
    }

    await _openApplicationForm(opening: opening);
  }

  Widget _buildUploadProgress({
    required ProgramOpening opening,
    required Color accentColor,
    required Color subtitleColor,
    required Color titleColor,
  }) {
    final requiredCount = opening.requiredDocumentCount > 0
        ? opening.requiredDocumentCount
        : _defaultRequiredDocumentCount;
    final uploadedCount = opening.uploadedDocumentCount;
    final progress = requiredCount <= 0
        ? 0.0
        : (uploadedCount / requiredCount).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Uploaded',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: titleColor,
              ),
            ),
            const Spacer(),
            Text(
              '$uploadedCount/$requiredCount',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: subtitleColor,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 10,
            backgroundColor: const Color(0xFFE8E0D6),
            valueColor: AlwaysStoppedAnimation<Color>(accentColor),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '$uploadedCount of $requiredCount required documents uploaded.',
          style: TextStyle(fontSize: 12, color: subtitleColor),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.black54;
    final cardColor = isDark ? const Color(0xFF2D1E12) : Colors.white;
    final accentColor = isDark ? const Color(0xFFFFD54F) : primaryColor;
    final result = _result;

    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Scholarship Openings')),
      selectedIndex: 0,
      showDrawer: false,
      child: RefreshIndicator(
        onRefresh: _loadOpenings,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: cardColor,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: accentColor.withOpacity(0.14)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Available Scholarship Openings',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: titleColor,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Select an admin-posted scholarship opening to start or continue your application. One active application is allowed at a time.',
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.45,
                      color: subtitleColor,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (result?.hasSavedDraft == true)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Saved draft available',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Continue your draft for ${result?.draftOpeningTitle.isNotEmpty == true ? result!.draftOpeningTitle : 'the selected scholarship opening'} or choose a different opening to replace it.',
                      style: TextStyle(color: subtitleColor, height: 1.4),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => _openApplicationForm(),
                      child: const Text('Continue Draft'),
                    ),
                  ],
                ),
              ),
            if (result?.isApprovedScholar == true)
              Container(
                margin: const EdgeInsets.only(bottom: 16),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: accentColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  'You are already an approved scholar. Only TES scholarship openings are shown here.',
                  style: TextStyle(color: subtitleColor, height: 1.4),
                ),
              ),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 32),
                child: Column(
                  children: [
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: subtitleColor),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _loadOpenings,
                      child: const Text('Try Again'),
                    ),
                  ],
                ),
              )
            else if (_openings.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 32),
                child: Text(
                  result?.isApprovedScholar == true
                      ? 'No TES scholarship openings are currently available.'
                      : 'No scholarship openings are currently available.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: subtitleColor),
                ),
              )
            else
              ..._openings.map((opening) {
                final showUploadProgress = opening.hasApplied;

                return Container(
                  margin: const EdgeInsets.only(bottom: 14),
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
                  child: Padding(
                    padding: const EdgeInsets.all(16),
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
                                    opening.openingTitle,
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w800,
                                      color: titleColor,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    opening.programName,
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: accentColor,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (opening.isTes)
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  if (opening.isTes)
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: accentColor.withOpacity(0.12),
                                        borderRadius: BorderRadius.circular(
                                          999,
                                        ),
                                      ),
                                      child: Text(
                                        'TES',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                          color: accentColor,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Application period: ${_formatDateRange(opening)}',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: titleColor,
                          ),
                        ),
                        if (opening.announcementText.trim().isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Text(
                            opening.announcementText,
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.4,
                              color: subtitleColor,
                            ),
                          ),
                        ],
                        if (showUploadProgress) ...[
                          const SizedBox(height: 14),
                          _buildUploadProgress(
                            opening: opening,
                            accentColor: accentColor,
                            subtitleColor: subtitleColor,
                            titleColor: titleColor,
                          ),
                        ],
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: opening.canApply
                                ? () => _handleApply(opening)
                                : null,
                            child: Text(opening.applyLabel),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}
