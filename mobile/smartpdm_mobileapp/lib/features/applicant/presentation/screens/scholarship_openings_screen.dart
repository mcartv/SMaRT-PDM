import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ScholarshipOpeningsScreen extends StatefulWidget {
  const ScholarshipOpeningsScreen({super.key});

  @override
  State<ScholarshipOpeningsScreen> createState() =>
      _ScholarshipOpeningsScreenState();
}

class _ScholarshipOpeningsScreenState extends State<ScholarshipOpeningsScreen> {
  static const int _defaultRequiredDocumentCount = 4;
  final ProgramOpeningService _programOpeningService = ProgramOpeningService();

  bool _isLoading = true;
  ProgramOpeningsResult? _result;
  String? _error;
  List<ProgramOpening> _openings = const [];
  NotificationProvider? _notificationProvider;
  int _lastOpeningRevision = 0;

  @override
  void initState() {
    super.initState();
    _loadOpenings();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (_notificationProvider == provider) {
      return;
    }

    _notificationProvider?.removeListener(_handleRealtimeOpenings);
    _notificationProvider = provider;
    _lastOpeningRevision = provider.openingRevision;
    _notificationProvider?.addListener(_handleRealtimeOpenings);
  }

  void _handleRealtimeOpenings() {
    final provider = _notificationProvider;
    if (provider == null) {
      return;
    }

    if (provider.openingRevision == _lastOpeningRevision) {
      return;
    }

    _lastOpeningRevision = provider.openingRevision;

    if (mounted) {
      _loadOpenings();
    }
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
        _error = 'Unable to load scholarships. Check your connection and try again.';
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

  String _displayScholarshipTitle(ProgramOpening opening) {
    final fallback = opening.programName.trim().isEmpty
        ? 'Scholarship'
        : opening.programName.trim();

    final cleaned = opening.openingTitle
        .replaceAll(
          RegExp(r'\bscholarship\s+opening\b', caseSensitive: false),
          '',
        )
        .replaceAll(RegExp(r'\bopening\b', caseSensitive: false), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    return cleaned.isEmpty ? fallback : cleaned;
  }


  List<String> _scholarshipRules(ProgramOpening opening) {
    final rules = <String>[];
    if (opening.gwaThreshold != null) {
      rules.add('Required GWA: ${opening.gwaThreshold!.toStringAsFixed(2)} or better');
    }
    if (opening.targetAudience.trim().isNotEmpty) {
      rules.add('For: ${opening.targetAudience.trim()}');
    }
    if (opening.renewalCycle.trim().isNotEmpty &&
        opening.renewalCycle.toLowerCase() != 'none') {
      rules.add('Renewal: ${opening.renewalCycle.trim()}');
    }
    rules.add('${opening.availableSlots} slot${opening.availableSlots == 1 ? '' : 's'} available');
    if (opening.waitingListEnabled) {
      rules.add('Waiting list available when slots are filled');
    }
    return rules;
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
            title: Text('Existing draft found'),
            content: Text(
              'You already have a saved draft for ${result.draftOpeningTitle.isNotEmpty ? result.draftOpeningTitle : 'another scholarship'}. Continue that draft or replace it with ${opening.openingTitle}?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text('Continue Draft'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: Text('Replace Draft'),
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
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(

                fontWeight: FontWeight.w700,
                color: titleColor
),
            ),
            const Spacer(),
            Text(
              '$uploadedCount/$requiredCount',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(

                fontWeight: FontWeight.w700,
                color: subtitleColor
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
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
 color: subtitleColor
),
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
      appBar: AppBar(title: Text('Available Scholarships')),
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
                    'Available Scholarships',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(

                      fontWeight: FontWeight.w800,
                      color: titleColor
),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Select a scholarship to start your application. After applying, only your selected scholarship will remain visible until that application is completed.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(

                      height: 1.45,
                      color: subtitleColor
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
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(

                        fontWeight: FontWeight.w700,
                        color: titleColor
),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Continue your draft for ${result?.draftOpeningTitle.isNotEmpty == true ? result!.draftOpeningTitle : 'the selected scholarship'} or choose a different scholarship to replace it.',
                      style: TextStyle(color: subtitleColor, height: 1.4),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => _openApplicationForm(),
                      child: Text('Continue Draft'),
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
                  'You are already an approved scholar. Only eligible TES scholarships are shown here.',
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
                      child: Text('Try Again'),
                    ),
                  ],
                ),
              )
            else if (_openings.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 32),
                child: Text(
                  result?.isApprovedScholar == true
                      ? 'No TES scholarships are currently available.'
                      : 'No scholarships are currently available.',
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
                                    _displayScholarshipTitle(opening),
                                    style: Theme.of(context).textTheme.titleLarge?.copyWith(

                                      fontWeight: FontWeight.w800,
                                      color: titleColor
),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    opening.programName,
                                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(

                                      fontWeight: FontWeight.w700,
                                      color: accentColor
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
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(

                              height: 1.4,
                              color: subtitleColor
),
                          ),
                        ],
                        if (opening.programDescription.trim().isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Text(
                            opening.programDescription.trim(),
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              height: 1.4,
                              color: subtitleColor,
                            ),
                          ),
                        ],
                        if ((opening.benefactorName ?? '').trim().isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: accentColor.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Supported by ${opening.benefactorName}',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    color: titleColor,
                                  ),
                                ),
                                if ((opening.benefactorDescription ?? '').trim().isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    opening.benefactorDescription!.trim(),
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: subtitleColor, height: 1.35),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _scholarshipRules(opening)
                              .map((rule) => Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: accentColor.withOpacity(0.10),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text(
                                      rule,
                                      style: TextStyle(
                                        color: titleColor,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ))
                              .toList(),
                        ),
                        if (showUploadProgress) ...[
                          const SizedBox(height: 14),
                          _buildUploadProgress(
                            opening: opening,
                            accentColor: accentColor,
                            subtitleColor: subtitleColor,
                            titleColor: titleColor,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Open Manage Documents to upload, replace, or review your submitted requirements.',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: subtitleColor,
                                  height: 1.35,
                                ),
                          ),
                        ],
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: opening.hasApplied || opening.canApply
                                ? () => _handleApply(opening)
                                : null,
                            child: Text(
                              opening.hasApplied
                                  ? 'Manage Documents'
                                  : opening.applyLabel,
                            ),
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

  @override
  void dispose() {
    _notificationProvider?.removeListener(_handleRealtimeOpenings);
    super.dispose();
  }
}
