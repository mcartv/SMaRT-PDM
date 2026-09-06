import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ScholarshipOpeningsScreen extends StatefulWidget {
  const ScholarshipOpeningsScreen({super.key});

  @override
  State<ScholarshipOpeningsScreen> createState() =>
      _ScholarshipOpeningsScreenState();
}

class _ScholarshipOpeningsScreenState extends State<ScholarshipOpeningsScreen> {
  static const int _defaultRequiredDocumentCount = 5;
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
  void initState() {
    super.initState();
    _loadOpenings();
    _liveSyncTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
      // Realtime remains the immediate path, while this inexpensive
      // reconciliation covers events missed between the admin and mobile
      // backend services even when the socket itself still looks healthy.
      _requestLiveRefresh();
    });
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

    _requestLiveRefresh();
  }

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
    } catch (error) {
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

  void _requestLiveRefresh() {
    if (!mounted) return;
    if (_fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }
    _loadOpenings(silent: true);
  }

  @override
  void dispose() {
    _liveSyncTimer?.cancel();
    _notificationProvider?.removeListener(_handleRealtimeOpenings);
    super.dispose();
  }

  String _applicationPeriodLabel(ProgramOpening opening) {
    final databaseLabel = opening.applicationPeriodLabel.trim();
    if (databaseLabel.isNotEmpty) {
      return databaseLabel;
    }

    final databaseParts = <String>[
      opening.academicYearLabel.trim(),
      opening.academicTerm.trim(),
    ].where((item) => item.isNotEmpty).toList(growable: false);

    if (databaseParts.isNotEmpty) {
      return databaseParts.join(' · ');
    }

    // Compatibility fallback only for older API payloads that actually
    // provide calendar dates.
    String format(String value) {
      if (value.trim().isEmpty) return '';
      final parsed = DateTime.tryParse(value);
      if (parsed == null) return value.trim();
      return DateFormat('MMM d, yyyy').format(parsed);
    }

    final start = format(opening.applicationStart);
    final end = format(opening.applicationEnd);

    if (start.isNotEmpty && end.isNotEmpty) {
      return '$start - $end';
    }
    if (start.isNotEmpty) return start;
    if (end.isNotEmpty) return end;

    return 'Not specified';
  }

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
      return;
    }

    if (result?.hasSavedDraft == true &&
        result!.draftOpeningId.trim().isNotEmpty &&
        result.draftOpeningId != opening.openingId) {
      final replaceDraft = await showDialog<bool>(
        context: context,
        builder: (dialogContext) {
          return AlertDialog(
            title: Text('Saved application found'),
            content: Text(
              'You already have a saved application for ${result.draftOpeningTitle.isNotEmpty ? result.draftOpeningTitle : 'another scholarship'}. Continue it or replace it with ${opening.openingTitle}?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: Text('Continue Application'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: Text('Replace Application'),
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
                color: titleColor,
              ),
            ),
            const Spacer(),
            Text(
              '$uploadedCount/$requiredCount',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: subtitleColor,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: AppRadii.status,
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 10,
            backgroundColor: AppSurfacePalette.surfaceMuted(context),
            valueColor: AlwaysStoppedAnimation<Color>(accentColor),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          '$uploadedCount of $requiredCount required documents uploaded.',
          style: Theme.of(
            context,
          ).textTheme.labelMedium?.copyWith(color: subtitleColor),
        ),
      ],
    );
  }

  @override
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
          padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, AppSpacing.xxl),
          children: [
            AppSectionHeading(
              title: 'Open scholarships',
              subtitle:
                  'Choose an eligible scholarship to begin. If you already started an application, continue that work before starting another.',
            ),
            const SizedBox(height: AppSpacing.md),
            if (result?.hasSavedDraft == true)
              AppSurfaceCard(
                margin: const EdgeInsets.only(bottom: AppSpacing.lg),
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
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Saved application available',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: titleColor,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Continue your saved application for ${result?.draftOpeningTitle.isNotEmpty == true ? result!.draftOpeningTitle : 'the selected scholarship'}, or choose another scholarship to replace it.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: subtitleColor,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    FilledButton.icon(
                      onPressed: () => _openApplicationForm(),
                      icon: const Icon(Icons.edit_document, size: 18),
                      label: const Text('Continue Application'),
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
                        'You are already an approved scholar. Only eligible TES scholarships are shown here.',
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
                  children: [
                    const AppIconTile(icon: Icons.cloud_off_rounded),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: subtitleColor,
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
                      result?.isApprovedScholar == true
                          ? 'No TES scholarships are currently available.'
                          : 'No scholarships are currently available.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: subtitleColor,
                      ),
                    ),
                  ],
                ),
              )
            else
              ..._openings.map((opening) {
                final showUploadProgress = opening.hasApplied;

                return AppSurfaceCard(
                  margin: const EdgeInsets.only(bottom: AppSpacing.md),
                  backgroundColor: cardColor,
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
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleLarge
                                        ?.copyWith(
                                          fontWeight: FontWeight.w800,
                                          color: titleColor,
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
                                    const AppStatusCapsule(
                                      label: 'TES',
                                      tone: AppStatusTone.brand,
                                      compact: true,
                                    ),
                                ],
                              ),
                          ],
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
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelMedium
                                        ?.copyWith(
                                          color: subtitleColor,
                                          fontWeight: FontWeight.w700,
                                        ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    _applicationPeriodLabel(opening),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(
                                          color: titleColor,
                                          fontWeight: FontWeight.w800,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        if (opening.announcementText.trim().isNotEmpty &&
                            !_isRedundantOpeningCopy(
                              opening,
                              opening.announcementText,
                            )) ...[
                          const SizedBox(height: 10),
                          Text(
                            opening.announcementText,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(height: 1.4, color: subtitleColor),
                          ),
                        ],
                        if (opening.programDescription.trim().isNotEmpty &&
                            !_isRedundantOpeningCopy(
                              opening,
                              opening.programDescription,
                              compareWith: opening.announcementText,
                            )) ...[
                          const SizedBox(height: 10),
                          Text(
                            opening.programDescription.trim(),
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(height: 1.4, color: subtitleColor),
                          ),
                        ],
                        if ((opening.benefactorName ?? '')
                            .trim()
                            .isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppSurfacePalette.surfaceMuted(context),
                              borderRadius: AppRadii.control,
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
                                if ((opening.benefactorDescription ?? '')
                                    .trim()
                                    .isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    opening.benefactorDescription!.trim(),
                                    maxLines: 3,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: subtitleColor,
                                      height: 1.35,
                                    ),
                                  ),
                                ],
                              ],
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
                          const SizedBox(height: 8),
                          Text(
                            'Open Manage Documents to upload, replace, or review your submitted requirements.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: subtitleColor, height: 1.35),
                          ),
                        ],
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              minimumSize: const Size.fromHeight(48),
                            ),
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
                );
              }),
          ],
        ),
      ),
    );
  }
}
