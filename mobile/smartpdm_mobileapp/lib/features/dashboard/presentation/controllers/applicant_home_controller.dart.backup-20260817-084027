import 'dart:async';

import 'package:flutter/foundation.dart';

import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/mappers/applicant_home_mapper.dart';
import 'package:smartpdm_mobileapp/features/dashboard/presentation/models/applicant_home_presentation.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/models/applicant_documents_package.dart';
import 'package:smartpdm_mobileapp/shared/models/application_status_summary.dart';
import 'package:smartpdm_mobileapp/shared/models/program_opening.dart';

typedef ApplicantHomeIdentityLoader = Future<SessionUser> Function();
typedef ApplicantHomeOpeningsLoader = Future<ProgramOpeningsResult> Function();
typedef ApplicantHomeDocumentsLoader =
    Future<ApplicantDocumentsPackage> Function();
typedef ApplicantHomeStatusLoader = Future<ApplicationStatusSummary> Function();
typedef ApplicantHomeLatestUpdateLoader = Future<AppNotification?> Function();

/// Owns Applicant Home loading, caching, refresh sequencing, and retries.
///
/// Widgets consume only [state]. Navigation and provider wiring stay outside
/// this class. Errors are reduced to a fixed presentation failure and never
/// expose exception or server text.
class ApplicantHomeController extends ChangeNotifier {
  ApplicantHomeController({
    required ApplicantHomeIdentityLoader loadIdentity,
    required ApplicantHomeOpeningsLoader loadOpenings,
    required ApplicantHomeDocumentsLoader loadDocuments,
    required ApplicantHomeStatusLoader loadStatus,
    required ApplicantHomeLatestUpdateLoader loadLatestUpdate,
    ApplicantHomeMapper mapper = const ApplicantHomeMapper(),
    this.refreshInterval = const Duration(seconds: 8),
  }) : _loadIdentity = loadIdentity,
       _loadOpenings = loadOpenings,
       _loadDocuments = loadDocuments,
       _loadStatus = loadStatus,
       _loadLatestUpdate = loadLatestUpdate,
       _mapper = mapper;

  static const Set<ApplicantHomeSectionKey> allSections = {
    ApplicantHomeSectionKey.identity,
    ApplicantHomeSectionKey.applicationStatus,
    ApplicantHomeSectionKey.documents,
    ApplicantHomeSectionKey.openings,
    ApplicantHomeSectionKey.latestUpdate,
  };

  static const Set<ApplicantHomeSectionKey> applicationSections = {
    ApplicantHomeSectionKey.applicationStatus,
    ApplicantHomeSectionKey.documents,
  };

  final ApplicantHomeIdentityLoader _loadIdentity;
  final ApplicantHomeOpeningsLoader _loadOpenings;
  final ApplicantHomeDocumentsLoader _loadDocuments;
  final ApplicantHomeStatusLoader _loadStatus;
  final ApplicantHomeLatestUpdateLoader _loadLatestUpdate;
  final ApplicantHomeMapper _mapper;

  /// Pass null to disable periodic refreshes, primarily in tests.
  final Duration? refreshInterval;

  ApplicantHomeState _state = ApplicantHomeState.initial();
  ApplicantHomeState get state => _state;

  final Map<ApplicantHomeSectionKey, Future<void>> _inFlight = {};
  final Set<ApplicantHomeSectionKey> _queuedSections = {};
  final Map<ApplicantHomeSectionKey, Completer<void>> _queuedCompletions = {};
  final Map<ApplicantHomeSectionKey, int> _generation = {};
  Future<void>? _fullRefreshInFlight;
  Timer? _timer;
  bool _started = false;
  bool _disposed = false;

  ProgramOpeningsResult? _openingsSource;
  ApplicantDocumentsPackage? _documentsSource;
  ApplicationStatusSummary? _statusSource;

  bool get isDisposed => _disposed;
  bool get isStarted => _started;

  /// Starts the initial load and the optional periodic cadence exactly once.
  Future<void> start() {
    if (_disposed) return Future<void>.value();
    if (_started) return _fullRefreshInFlight ?? Future<void>.value();
    _started = true;

    final interval = refreshInterval;
    if (interval != null && interval > Duration.zero) {
      _timer = Timer.periodic(interval, (_) {
        unawaited(refresh());
      });
    }

    return refresh();
  }

  /// Refreshes every section. Concurrent full triggers share one future, and
  /// section requests already running are reused rather than duplicated.
  Future<void> refresh() {
    if (_disposed) return Future<void>.value();

    final existing = _fullRefreshInFlight;
    if (existing != null) return existing;

    late final Future<void> operation;
    operation = refreshSections(allSections);
    _fullRefreshInFlight = operation;
    unawaited(
      operation.whenComplete(() {
        if (identical(_fullRefreshInFlight, operation)) {
          _fullRefreshInFlight = null;
        }
      }),
    );
    return operation;
  }

  /// Explicit entry point for socket/provider revision events.
  Future<void> refreshForExternalChange({
    Set<ApplicantHomeSectionKey> sections = applicationSections,
  }) async {
    if (_disposed || sections.isEmpty) return;
    await Future.wait(
      sections.map(
        (section) => _requestSection(section, queueIfInFlight: true),
      ),
    );
  }

  Future<void> refreshSections(Set<ApplicantHomeSectionKey> sections) async {
    if (_disposed || sections.isEmpty) return;
    await Future.wait(sections.map(_requestSection));
  }

  Future<void> retryIdentity() =>
      _requestSection(ApplicantHomeSectionKey.identity);
  Future<void> retryApplicationStatus() =>
      _requestSection(ApplicantHomeSectionKey.applicationStatus);
  Future<void> retryDocuments() =>
      _requestSection(ApplicantHomeSectionKey.documents);
  Future<void> retryOpenings() =>
      _requestSection(ApplicantHomeSectionKey.openings);
  Future<void> retryLatestUpdate() =>
      _requestSection(ApplicantHomeSectionKey.latestUpdate);

  Future<void> retrySection(ApplicantHomeSectionKey section) =>
      _requestSection(section);

  Future<void> _requestSection(
    ApplicantHomeSectionKey section, {
    bool queueIfInFlight = false,
  }) {
    if (_disposed) return Future<void>.value();

    final existing = _inFlight[section];
    if (existing != null) {
      if (!queueIfInFlight) return existing;
      _queuedSections.add(section);
      return _queuedCompletions
          .putIfAbsent(section, Completer<void>.new)
          .future;
    }

    final generation = (_generation[section] ?? 0) + 1;
    _generation[section] = generation;

    late final Future<void> request;
    request = _runSection(section, generation);
    _inFlight[section] = request;
    _syncRefreshFlag();

    unawaited(
      request.whenComplete(() {
        if (identical(_inFlight[section], request)) {
          _inFlight.remove(section);
          if (!_disposed && _queuedSections.remove(section)) {
            final completion = _queuedCompletions.remove(section);
            final trailing = _requestSection(section);
            unawaited(
              trailing.whenComplete(() {
                if (completion != null && !completion.isCompleted) {
                  completion.complete();
                }
              }),
            );
          } else {
            final completion = _queuedCompletions.remove(section);
            if (completion != null && !completion.isCompleted) {
              completion.complete();
            }
            _syncRefreshFlag();
          }
        }
      }),
    );
    return request;
  }

  Future<void> _runSection(
    ApplicantHomeSectionKey section,
    int generation,
  ) async {
    _markLoading(section);

    try {
      switch (section) {
        case ApplicantHomeSectionKey.identity:
          final source = await _loadIdentity();
          if (!_isCurrent(section, generation)) return;
          _state = _state.copyWith(
            identity: ApplicantHomeSectionState(
              data: _mapper.mapIdentity(source),
              hasLoaded: true,
            ),
          );
        case ApplicantHomeSectionKey.applicationStatus:
          final source = await _loadStatus();
          if (!_isCurrent(section, generation)) return;
          _statusSource = source;
          _state = _state.copyWith(
            applicationStatus: ApplicantHomeSectionState(
              data: _mapper.mapApplicationStatus(
                source,
                openings: _openingsSource,
                documents: _documentsSource,
              ),
              hasLoaded: true,
            ),
            progress: _mapper.mapProgress(source),
          );
        case ApplicantHomeSectionKey.documents:
          final source = await _loadDocuments();
          if (!_isCurrent(section, generation)) return;
          _documentsSource = source;
          _state = _state.copyWith(
            documents: ApplicantHomeSectionState(
              data: _mapper.mapDocuments(source),
              hasLoaded: true,
            ),
          );
          _rebuildApplicationPresentation();
        case ApplicantHomeSectionKey.openings:
          final source = await _loadOpenings();
          if (!_isCurrent(section, generation)) return;
          _openingsSource = source;
          _state = _state.copyWith(
            openings: ApplicantHomeSectionState(
              data: _mapper.mapOpenings(source),
              hasLoaded: true,
            ),
          );
          _rebuildApplicationPresentation();
        case ApplicantHomeSectionKey.latestUpdate:
          final source = await _loadLatestUpdate();
          if (!_isCurrent(section, generation)) return;
          _state = _state.copyWith(
            latestUpdate: ApplicantHomeSectionState(
              data: _mapper.mapLatestUpdate(source),
              hasLoaded: true,
            ),
          );
      }

      _publish();
    } catch (_) {
      if (!_isCurrent(section, generation)) return;
      _markFailure(section);
    }
  }

  void _markLoading(ApplicantHomeSectionKey section) {
    if (_disposed) return;

    switch (section) {
      case ApplicantHomeSectionKey.identity:
        _state = _state.copyWith(
          identity: _state.identity.copyWith(isLoading: true, failure: null),
        );
      case ApplicantHomeSectionKey.applicationStatus:
        _state = _state.copyWith(
          applicationStatus: _state.applicationStatus.copyWith(
            isLoading: true,
            failure: null,
          ),
        );
      case ApplicantHomeSectionKey.documents:
        _state = _state.copyWith(
          documents: _state.documents.copyWith(isLoading: true, failure: null),
        );
      case ApplicantHomeSectionKey.openings:
        _state = _state.copyWith(
          openings: _state.openings.copyWith(isLoading: true, failure: null),
        );
      case ApplicantHomeSectionKey.latestUpdate:
        _state = _state.copyWith(
          latestUpdate: _state.latestUpdate.copyWith(
            isLoading: true,
            failure: null,
          ),
        );
    }
    _publish();
  }

  void _markFailure(ApplicantHomeSectionKey section) {
    if (_disposed) return;
    const failure = ApplicantHomeSectionFailure.unavailable;

    switch (section) {
      case ApplicantHomeSectionKey.identity:
        _state = _state.copyWith(
          identity: _state.identity.copyWith(
            isLoading: false,
            hasLoaded: true,
            failure: failure,
          ),
        );
      case ApplicantHomeSectionKey.applicationStatus:
        _state = _state.copyWith(
          applicationStatus: _state.applicationStatus.copyWith(
            isLoading: false,
            hasLoaded: true,
            failure: failure,
          ),
        );
      case ApplicantHomeSectionKey.documents:
        _state = _state.copyWith(
          documents: _state.documents.copyWith(
            isLoading: false,
            hasLoaded: true,
            failure: failure,
          ),
        );
      case ApplicantHomeSectionKey.openings:
        _state = _state.copyWith(
          openings: _state.openings.copyWith(
            isLoading: false,
            hasLoaded: true,
            failure: failure,
          ),
        );
      case ApplicantHomeSectionKey.latestUpdate:
        _state = _state.copyWith(
          latestUpdate: _state.latestUpdate.copyWith(
            isLoading: false,
            hasLoaded: true,
            failure: failure,
          ),
        );
    }
    _publish();
  }

  void _rebuildApplicationPresentation() {
    final status = _statusSource;
    if (status == null) return;

    _state = _state.copyWith(
      applicationStatus: _state.applicationStatus.copyWith(
        data: _mapper.mapApplicationStatus(
          status,
          openings: _openingsSource,
          documents: _documentsSource,
        ),
      ),
      progress: _mapper.mapProgress(status),
    );
  }

  bool _isCurrent(ApplicantHomeSectionKey section, int generation) =>
      !_disposed && _generation[section] == generation;

  void _syncRefreshFlag() {
    if (_disposed) return;
    final hasPreviouslyLoadedContent =
        _state.identity.hasLoaded ||
        _state.applicationStatus.hasLoaded ||
        _state.documents.hasLoaded ||
        _state.openings.hasLoaded ||
        _state.latestUpdate.hasLoaded;
    final next = hasPreviouslyLoadedContent && _inFlight.isNotEmpty;
    if (_state.isRefreshing == next) return;
    _state = _state.copyWith(isRefreshing: next);
    _publish();
  }

  void _publish() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _timer?.cancel();
    _timer = null;
    for (final section in ApplicantHomeSectionKey.values) {
      _generation[section] = (_generation[section] ?? 0) + 1;
    }
    _inFlight.clear();
    _queuedSections.clear();
    for (final completion in _queuedCompletions.values) {
      if (!completion.isCompleted) completion.complete();
    }
    _queuedCompletions.clear();
    _fullRefreshInFlight = null;
    super.dispose();
  }
}
