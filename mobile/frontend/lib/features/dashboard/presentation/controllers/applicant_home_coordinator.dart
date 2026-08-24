import 'dart:async';

import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/theme/applicant_home_theme.dart';
import 'package:smartpdm_mobileapp/core/networking/api_exception.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/applicant_documents_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/program_opening_service.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/controllers/applicant_home_controller.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/widgets/applicant_home_view.dart';
import 'package:smartpdm_mobileapp/features/forms/data/services/application_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';

/// Connects existing data sources and provider revisions to the isolated
/// [ApplicantHomeController]. Navigation remains an injected callback.
class ApplicantHomeCoordinator extends StatefulWidget {
  const ApplicantHomeCoordinator({
    super.key,
    required this.notificationProvider,
    required this.onAction,
    required this.onViewAllOpenings,
    required this.onViewAllUpdates,
    this.sessionService = const SessionService(),
    this.controller,
  });

  final NotificationProvider notificationProvider;
  final SessionService sessionService;
  final ApplicantHomeController? controller;
  final ValueChanged<ApplicantHomeActionPresentation> onAction;
  final VoidCallback onViewAllOpenings;
  final VoidCallback onViewAllUpdates;

  @override
  State<ApplicantHomeCoordinator> createState() =>
      _ApplicantHomeCoordinatorState();
}

class _ApplicantHomeCoordinatorState extends State<ApplicantHomeCoordinator> {
  late final ApplicantDocumentsService _documentsService;
  late final ProgramOpeningService _openingService;
  late final ApplicationService _applicationService;
  late final ApplicantHomeController _controller;
  late final bool _ownsController;

  int _lastApplicationRevision = 0;
  int _lastOpeningRevision = 0;
  int _lastAnnouncementRevision = 0;
  bool _lastNotificationLoading = false;
  String _lastUpdateFingerprint = '';

  @override
  void initState() {
    super.initState();
    _documentsService = ApplicantDocumentsService();
    _openingService = ProgramOpeningService();
    _applicationService = ApplicationService();
    _ownsController = widget.controller == null;
    _controller = widget.controller ?? _createController();
    _captureProviderState(widget.notificationProvider);
    widget.notificationProvider.addListener(_handleProviderChange);
    unawaited(_controller.start());
  }

  ApplicantHomeController _createController() {
    return ApplicantHomeController(
      loadIdentity: widget.sessionService.getCurrentUser,
      loadOpenings: _openingService.fetchAvailableOpenings,
      loadDocuments: _loadDocuments,
      loadStatus: _applicationService.fetchMyApplicationStatusSummary,
      loadLatestUpdate: _loadLatestUpdate,
    );
  }

  Future<ApplicantDocumentsPackage> _loadDocuments() async {
    try {
      return await _documentsService.fetchMyDocuments();
    } on ApiException catch (error) {
      if (error.statusCode != 404 && error.statusCode != 409) rethrow;
      return const ApplicantDocumentsPackage(
        applicationId: '',
        contextId: '',
        contextTitle: 'Scholarship requirements',
        programName: 'Scholarship program',
        applicationStatus: '',
        documentStatus: '',
        documents: <ApplicantRequirementDocument>[],
      );
    }
  }

  Future<AppNotification?> _loadLatestUpdate() async {
    final provider = widget.notificationProvider;
    if (provider.errorMessage != null) {
      throw StateError('Latest update unavailable');
    }
    final updates = provider.officeUpdatesItems;
    return updates.isEmpty ? null : updates.first;
  }

  void _captureProviderState(NotificationProvider provider) {
    _lastApplicationRevision = provider.applicationRevision;
    _lastOpeningRevision = provider.openingRevision;
    _lastAnnouncementRevision = provider.announcementRevision;
    _lastNotificationLoading = provider.isLoading;
    _lastUpdateFingerprint = _updateFingerprint(provider);
  }

  String _updateFingerprint(NotificationProvider provider) {
    final updates = provider.officeUpdatesItems;
    if (updates.isEmpty) return '';
    final update = updates.first;
    return '${update.notificationId}|${update.createdAt.microsecondsSinceEpoch}|${update.isRead}';
  }

  void _handleProviderChange() {
    final provider = widget.notificationProvider;
    final sections = <ApplicantHomeSectionKey>{};

    if (provider.applicationRevision != _lastApplicationRevision) {
      _lastApplicationRevision = provider.applicationRevision;
      sections.addAll(ApplicantHomeController.applicationSections);
    }
    if (provider.openingRevision != _lastOpeningRevision) {
      _lastOpeningRevision = provider.openingRevision;
      sections
        ..add(ApplicantHomeSectionKey.openings)
        ..add(ApplicantHomeSectionKey.latestUpdate);
    }
    if (provider.announcementRevision != _lastAnnouncementRevision) {
      _lastAnnouncementRevision = provider.announcementRevision;
      sections.add(ApplicantHomeSectionKey.latestUpdate);
    }

    final updateFingerprint = _updateFingerprint(provider);
    final notificationLoadFinished =
        _lastNotificationLoading && !provider.isLoading;
    _lastNotificationLoading = provider.isLoading;
    if (notificationLoadFinished ||
        updateFingerprint != _lastUpdateFingerprint) {
      _lastUpdateFingerprint = updateFingerprint;
      sections.add(ApplicantHomeSectionKey.latestUpdate);
    }

    if (sections.isNotEmpty) {
      unawaited(_controller.refreshForExternalChange(sections: sections));
    }
  }

  Future<void> _refresh() async {
    await widget.notificationProvider.refresh();
    await _controller.refresh();
  }

  @override
  void didUpdateWidget(covariant ApplicantHomeCoordinator oldWidget) {
    super.didUpdateWidget(oldWidget);
    assert(
      oldWidget.controller == widget.controller,
      'ApplicantHomeCoordinator controller must not change after mounting.',
    );
    if (oldWidget.notificationProvider != widget.notificationProvider) {
      oldWidget.notificationProvider.removeListener(_handleProviderChange);
      _captureProviderState(widget.notificationProvider);
      widget.notificationProvider.addListener(_handleProviderChange);
      unawaited(
        _controller.refreshForExternalChange(
          sections: const {ApplicantHomeSectionKey.latestUpdate},
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return ApplicantHomeThemeScope(
      child: ListenableBuilder(
        listenable: _controller,
        builder: (context, _) {
          return ApplicantHomeView(
            state: _controller.state,
            onRefresh: _refresh,
            onAction: widget.onAction,
            onViewAllOpenings: widget.onViewAllOpenings,
            onViewAllUpdates: widget.onViewAllUpdates,
            onRetryIdentity: () => unawaited(_controller.retryIdentity()),
            onRetryApplicationStatus: () =>
                unawaited(_controller.retryApplicationStatus()),
            onRetryDocuments: () => unawaited(_controller.retryDocuments()),
            onRetryOpenings: () => unawaited(_controller.retryOpenings()),
            onRetryLatestUpdate: () =>
                unawaited(_controller.retryLatestUpdate()),
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    widget.notificationProvider.removeListener(_handleProviderChange);
    if (_ownsController) _controller.dispose();
    super.dispose();
  }
}
