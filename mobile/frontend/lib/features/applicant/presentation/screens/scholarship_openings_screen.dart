// SMaRT-PDM: Scholars — scholarship openings screen (mobile screen); loads state, handles user actions, and renders the screen.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ScholarshipOpeningsScreen extends StatefulWidget {
  const ScholarshipOpeningsScreen({super.key});

  @override
  // createState: creates create state for the Scholars flow.
  State<ScholarshipOpeningsScreen> createState() =>
      _ScholarshipOpeningsScreenState();
}

class _ScholarshipOpeningsScreenState extends State<ScholarshipOpeningsScreen> {
  final ProgramOpeningService _programOpeningService = ProgramOpeningService();

  bool _isLoading = true;
  ProgramOpeningsResult? _result;
  String? _error;
  List<ProgramOpening> _openings = const [];
  NotificationProvider? _notificationProvider;
  int _lastOpeningRevision = 0;
  Timer? _liveSyncTimer;
  bool _fetchInProgress = false;
  bool _pendingLiveRefresh = false;

  @override
  // initState: handles init state for the Scholars flow.
  void initState() {
    super.initState();
    _loadOpenings();
    _liveSyncTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
      _requestLiveRefresh();
    });
  }

  @override
  // didChangeDependencies: handles did change dependencies for the Scholars flow.
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (_notificationProvider == provider) return;

    _notificationProvider?.removeListener(_handleRealtimeOpenings);
    _notificationProvider = provider;
    _lastOpeningRevision = provider.openingRevision;
    _notificationProvider?.addListener(_handleRealtimeOpenings);
  }

  // _handleRealtimeOpenings: handles handle realtime openings for the Scholars flow.
  void _handleRealtimeOpenings() {
    final provider = _notificationProvider;
    if (provider == null || provider.openingRevision == _lastOpeningRevision) {
      return;
    }

    _lastOpeningRevision = provider.openingRevision;
    _requestLiveRefresh();
  }

  // _loadOpenings: handles load openings for the Scholars flow.
  Future<void> _loadOpenings({bool silent = false}) async {
    if (_fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }

    _fetchInProgress = true;
    if (!silent && mounted) {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    }

    try {
      final result = await _programOpeningService.fetchAvailableOpenings();
      if (!mounted) return;

      setState(() {
        _result = result;
        _openings = result.items;
        _error = null;
      });
    } catch (_) {
      if (!mounted) return;
      if (!silent || _openings.isEmpty) {
        setState(() {
          _error =
              'Unable to load scholarships. Check your connection and try again.';
        });
      }
    } finally {
      _fetchInProgress = false;
      if (mounted && !silent) {
        setState(() => _isLoading = false);
      }

      if (_pendingLiveRefresh && mounted) {
        _pendingLiveRefresh = false;
        scheduleMicrotask(() => _loadOpenings(silent: true));
      }
    }
  }

  // _requestLiveRefresh: handles request live refresh for the Scholars flow.
  void _requestLiveRefresh() {
    if (!mounted) return;
    if (_fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }
    _loadOpenings(silent: true);
  }

  @override
  // dispose: handles dispose for the Scholars flow.
  void dispose() {
    _liveSyncTimer?.cancel();
    _notificationProvider?.removeListener(_handleRealtimeOpenings);
    super.dispose();
  }

  // _applicationPeriodLabel: handles application period label for the Scholars flow.
  String _applicationPeriodLabel(ProgramOpening opening) {
    final databaseLabel = opening.applicationPeriodLabel.trim();
    if (databaseLabel.isNotEmpty) return databaseLabel;

    final databaseParts = <String>[
      opening.academicYearLabel.trim(),
      opening.academicTerm.trim(),
    ].where((item) => item.isNotEmpty).toList(growable: false);

    if (databaseParts.isNotEmpty) return databaseParts.join(' · ');

    // format: formats format for the Scholars flow.
    String format(String value) {
      if (value.trim().isEmpty) return '';
      final parsed = DateTime.tryParse(value);
      if (parsed == null) return value.trim();
      return DateFormat('MMM d, yyyy').format(parsed);
    }

    final start = format(opening.applicationStart);
    final end = format(opening.applicationEnd);
    if (start.isNotEmpty && end.isNotEmpty) return '$start - $end';
    if (start.isNotEmpty) return start;
    if (end.isNotEmpty) return end;
    return 'Not specified';
  }

  // _displayScholarshipTitle: handles display scholarship title for the Scholars flow.
  String _displayScholarshipTitle(ProgramOpening opening) {
    const fallback = 'Scholarship';
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

  // _normalizeOpeningCopy: handles normalize opening copy for the Scholars flow.
  String _normalizeOpeningCopy(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'\bscholarship\b'), '')
        .replaceAll(RegExp(r'\bopening\b'), '')
        .replaceAll(RegExp(r'[^a-z0-9]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  // _isRedundantOpeningCopy: handles is redundant opening copy for the Scholars flow.
  bool _isRedundantOpeningCopy(
    ProgramOpening opening,
    String value, {
    String? compareWith,
  }) {
    final normalized = _normalizeOpeningCopy(value);
    if (normalized.isEmpty) return true;

    final knownLabels = <String>{
      _normalizeOpeningCopy(opening.openingTitle),
      _normalizeOpeningCopy(opening.programName),
      _normalizeOpeningCopy(opening.benefactorName ?? ''),
      if (compareWith != null) _normalizeOpeningCopy(compareWith),
    }..removeWhere((item) => item.isEmpty);

    return knownLabels.contains(normalized);
  }

  // _formatGwa: handles format gwa for the Scholars flow.
  String _formatGwa(double value) {
    if (value == value.roundToDouble()) return value.toStringAsFixed(0);
    return value
        .toStringAsFixed(2)
        .replaceFirst(RegExp(r'0+$'), '')
        .replaceFirst(RegExp(r'\.$'), '');
  }

  // _displayApplyLabel: handles display apply label for the Scholars flow.
  String _displayApplyLabel(ProgramOpening opening) {
    final label = opening.applyLabel.trim();
    final normalized = label.toLowerCase();
    if (label.isEmpty ||
        normalized == 'apply' ||
        normalized == 'apply for scholarship' ||
        normalized == 'apply scholarship') {
      return 'Apply Now';
    }
    return label;
  }

  // _isDraftOpening: handles is draft opening for the Scholars flow.
  bool _isDraftOpening(ProgramOpening opening) {
    final result = _result;
    return result?.hasSavedDraft == true &&
        result!.draftOpeningId.trim().isNotEmpty &&
        result.draftOpeningId == opening.openingId;
  }

  // _openApplicationForm: handles open application form for the Scholars flow.
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

  // _confirmDraftChoice: handles confirm draft choice for the Scholars flow.
  Future<bool?> _confirmDraftChoice(
    ProgramOpeningsResult result,
    ProgramOpening opening,
  ) {
    final draftName = result.draftOpeningTitle.isNotEmpty
        ? result.draftOpeningTitle
        : 'another scholarship';

    return showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          scrollable: true,
          title: const Text('Saved application draft found'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'You already have a saved draft for $draftName. Continue that draft or use ${opening.openingTitle} instead?',
              ),
              const SizedBox(height: 18),
              OutlinedButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text(
                  'Continue Saved Draft',
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text(
                  'Use This Scholarship',
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  // _handleApply: handles handle apply for the Scholars flow.
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

    if (!opening.canApply) return;

    if (result?.hasSavedDraft == true &&
        result!.draftOpeningId.trim().isNotEmpty &&
        result.draftOpeningId != opening.openingId) {
      final replaceDraft = await _confirmDraftChoice(result, opening);
      if (replaceDraft == null) return;

      await _openApplicationForm(
        opening: replaceDraft ? opening : null,
        replaceExistingDraft: replaceDraft,
      );
      return;
    }

    await _openApplicationForm(opening: opening);
  }

  // _buildUploadProgress: handles build upload progress for the Scholars flow.
  Widget _buildUploadProgress({
    required ProgramOpening opening,
    required Color accentColor,
    required Color subtitleColor,
    required Color titleColor,
  }) {
    final requiredCount = opening.requiredDocumentCount > 0
        ? opening.requiredDocumentCount
        : ProgramOpening.applicationUploadRequirementCount;
    final uploadedCount = opening.uploadedDocumentCount
        .clamp(0, requiredCount)
        .toInt();
    final remainingCount = (requiredCount - uploadedCount)
        .clamp(0, requiredCount)
        .toInt();
    final progress = requiredCount <= 0
        ? 0.0
        : (uploadedCount / requiredCount).clamp(0.0, 1.0).toDouble();

    final requirementLabel = Text(
      'Requirements',
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
        fontWeight: FontWeight.w800,
        color: titleColor,
      ),
    );
    final uploadCountLabel = Text(
      '$uploadedCount of $requiredCount uploaded',
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
        fontWeight: FontWeight.w800,
        color: subtitleColor,
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            final textScale = MediaQuery.textScalerOf(context).scale(1);
            final stackSummary = constraints.maxWidth < 300 || textScale > 1.25;

            if (stackSummary) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  requirementLabel,
                  const SizedBox(height: 4),
                  uploadCountLabel,
                ],
              );
            }

            return Row(
              children: [
                Expanded(child: requirementLabel),
                const SizedBox(width: 12),
                uploadCountLabel,
              ],
            );
          },
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: AppRadii.status,
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 8,
            backgroundColor: AppSurfacePalette.surfaceMuted(context),
            valueColor: AlwaysStoppedAnimation<Color>(accentColor),
          ),
        ),
        const SizedBox(height: 7),
        Text(
          remainingCount == 0
              ? 'All required digital uploads are complete.'
              : '$remainingCount required document${remainingCount == 1 ? '' : 's'} remaining.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: subtitleColor,
            height: 1.35,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  // _buildOpeningCard: handles build opening card for the Scholars flow.
  Widget _buildOpeningCard(
    ProgramOpening opening, {
    required Color titleColor,
    required Color subtitleColor,
    required Color cardColor,
    required Color accentColor,
  }) {
    final isApplied = opening.hasApplied;
    final isDraft = _isDraftOpening(opening);
    final gwaThreshold = opening.gwaThreshold;
    final announcement = opening.announcementText.trim();
    final description = opening.programDescription.trim();

    final title = Text(
      _displayScholarshipTitle(opening),
      softWrap: true,
      style: Theme.of(context).textTheme.titleLarge?.copyWith(
        fontWeight: FontWeight.w900,
        color: titleColor,
        height: 1.18,
      ),
    );
    final status = isApplied || isDraft
        ? AppStatusCapsule(
            label: isApplied ? 'Applied' : 'Draft',
            tone: isApplied
                ? AppStatusTone.success
                : AppStatusTone.actionRequired,
            compact: true,
          )
        : null;

    return AppSurfaceCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.md),
      padding: const EdgeInsets.all(16),
      backgroundColor: cardColor,
      borderColor: isApplied
          ? AppColors.gold.withValues(alpha: 0.34)
          : AppSurfacePalette.outline(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final textScale = MediaQuery.textScalerOf(context).scale(1);
              final stackHeader =
                  status != null &&
                  (constraints.maxWidth < 320 || textScale > 1.25);

              if (status == null) return title;

              if (stackHeader) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [title, const SizedBox(height: 8), status],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: title),
                  const SizedBox(width: 10),
                  status,
                ],
              );
            },
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.calendar_month_outlined,
                size: 18,
                color: subtitleColor,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Application period',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: subtitleColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _applicationPeriodLabel(opening),
                      softWrap: true,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: titleColor,
                        fontWeight: FontWeight.w800,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (!isApplied && gwaThreshold != null) ...[
            const SizedBox(height: 11),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.school_outlined, size: 18, color: subtitleColor),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'GWA requirement: ${_formatGwa(gwaThreshold)} or better',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: titleColor,
                      fontWeight: FontWeight.w700,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (!isApplied &&
              announcement.isNotEmpty &&
              !_isRedundantOpeningCopy(opening, announcement)) ...[
            const SizedBox(height: 11),
            Text(
              announcement,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                height: 1.4,
                color: subtitleColor,
              ),
            ),
          ],
          if (!isApplied &&
              description.isNotEmpty &&
              !_isRedundantOpeningCopy(
                opening,
                description,
                compareWith: announcement,
              )) ...[
            const SizedBox(height: 9),
            Text(
              description,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                height: 1.4,
                color: subtitleColor,
              ),
            ),
          ],
          if (isApplied) ...[
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
            child: FilledButton(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
              ),
              onPressed: opening.hasApplied || opening.canApply
                  ? () => _handleApply(opening)
                  : null,
              child: Text(
                opening.hasApplied
                    ? 'Manage Documents'
                    : _displayApplyLabel(opening),
                textAlign: TextAlign.center,
                maxLines: 2,
                softWrap: true,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  // build: builds build for the Scholars flow.
  Widget build(BuildContext context) {
    final titleColor = AppSurfacePalette.text(context);
    final subtitleColor = AppSurfacePalette.mutedText(context);
    final cardColor = AppSurfacePalette.surface(context);
    final accentColor = AppColors.gold;
    final result = _result;

    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Available Scholarships')),
      selectedIndex: 0,
      child: RefreshIndicator(
        onRefresh: _loadOpenings,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
          children: [
            const AppSectionHeading(
              title: 'Open scholarships',
              subtitle:
                  'Choose an eligible scholarship to begin. If you already started an application, continue that work before starting another.',
            ),
            const SizedBox(height: AppSpacing.md),
            if (result?.hasSavedDraft == true)
              AppSurfaceCard(
                margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                padding: const EdgeInsets.all(16),
                backgroundColor: AppColors.gold.withValues(alpha: 0.10),
                borderColor: AppColors.gold.withValues(alpha: 0.32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const AppStatusCapsule(
                      label: 'Continue application',
                      tone: AppStatusTone.actionRequired,
                      compact: true,
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Saved application available',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      result?.draftOpeningTitle.isNotEmpty == true
                          ? result!.draftOpeningTitle
                          : 'Your saved scholarship application is ready to continue.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: subtitleColor,
                        height: 1.35,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: () => _openApplicationForm(),
                        icon: const Icon(Icons.edit_document, size: 18),
                        label: const Text('Continue Application'),
                      ),
                    ),
                  ],
                ),
              ),
            if (result?.isApprovedScholar == true)
              AppSurfaceCard(
                margin: const EdgeInsets.only(bottom: AppSpacing.lg),
                backgroundColor: AppSurfacePalette.surfaceMuted(context),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const AppIconTile(icon: Icons.workspace_premium_rounded),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Text(
                        'You are already an approved scholar. Scholarships available to your account are shown here.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: subtitleColor,
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              AppSurfaceCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const AppIconTile(icon: Icons.cloud_off_rounded),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Unable to load scholarships',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: titleColor,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: subtitleColor,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    FilledButton.icon(
                      onPressed: _loadOpenings,
                      icon: const Icon(Icons.refresh_rounded, size: 18),
                      label: const Text('Try Again'),
                    ),
                  ],
                ),
              )
            else if (_openings.isEmpty)
              AppSurfaceCard(
                child: Column(
                  children: [
                    const AppIconTile(icon: Icons.school_outlined),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'No scholarships available right now',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: titleColor,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'New scholarship openings will appear here once published by OSFA.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: subtitleColor,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              )
            else
              ..._openings.map(
                (opening) => _buildOpeningCard(
                  opening,
                  titleColor: titleColor,
                  subtitleColor: subtitleColor,
                  cardColor: cardColor,
                  accentColor: accentColor,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
