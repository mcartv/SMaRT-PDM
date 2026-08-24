import 'package:flutter/foundation.dart';

const Object _applicantHomeUnset = Object();

/// Independently loadable sections owned by [ApplicantHomeController].
enum ApplicantHomeSectionKey {
  identity,
  applicationStatus,
  documents,
  openings,
  latestUpdate,
}

/// Deliberately contains no server or exception detail.
enum ApplicantHomeSectionFailure { unavailable }

extension ApplicantHomeSectionFailureMessage on ApplicantHomeSectionFailure {
  String get userMessage => switch (this) {
    ApplicantHomeSectionFailure.unavailable =>
      'This section is unavailable right now.',
  };
}

@immutable
class ApplicantHomeSectionState<T> {
  const ApplicantHomeSectionState({
    this.data,
    this.isLoading = false,
    this.hasLoaded = false,
    this.failure,
  });

  const ApplicantHomeSectionState.initial()
    : data = null,
      isLoading = false,
      hasLoaded = false,
      failure = null;

  final T? data;
  final bool isLoading;
  final bool hasLoaded;
  final ApplicantHomeSectionFailure? failure;

  bool get isInitialLoading => isLoading && !hasLoaded && data == null;
  bool get isRefreshing => isLoading && (hasLoaded || data != null);
  bool get hasError => failure != null;
  bool get hasData => data != null;
  bool get isStale => data != null && failure != null;

  ApplicantHomeSectionState<T> copyWith({
    Object? data = _applicantHomeUnset,
    bool? isLoading,
    bool? hasLoaded,
    Object? failure = _applicantHomeUnset,
  }) {
    return ApplicantHomeSectionState<T>(
      data: identical(data, _applicantHomeUnset) ? this.data : data as T?,
      isLoading: isLoading ?? this.isLoading,
      hasLoaded: hasLoaded ?? this.hasLoaded,
      failure: identical(failure, _applicantHomeUnset)
          ? this.failure
          : failure as ApplicantHomeSectionFailure?,
    );
  }
}

enum ApplicantHomeTone { neutral, inProgress, actionRequired, success, danger }

enum ApplicantHomeStage {
  noApplication,
  draft,
  submitted,
  requirements,
  endorsement,
  activation,
  active,
  attention,
}

/// Navigation intent only. Route names remain outside the presentation layer.
enum ApplicantHomeActionTarget {
  scholarships,
  application,
  documents,
  status,
  endorsement,
  notifications,
}

@immutable
class ApplicantHomeActionPresentation {
  const ApplicantHomeActionPresentation({
    required this.label,
    required this.target,
    this.openingId,
    this.applicationId,
    this.openingTitle,
    this.programName,
  });

  final String label;
  final ApplicantHomeActionTarget target;

  /// Opaque navigation data. Widgets must never render these identifiers.
  final String? openingId;

  /// Opaque navigation data. Widgets must never render these identifiers.
  final String? applicationId;

  /// Display-safe context passed only to the existing application route.
  final String? openingTitle;
  final String? programName;
}

@immutable
class ApplicantHomeIdentityPresentation {
  const ApplicantHomeIdentityPresentation({
    required this.displayName,
    required this.studentNumber,
    required this.hasScholarAccess,
  });

  final String displayName;
  final String studentNumber;
  final bool hasScholarAccess;
}

@immutable
class ApplicantHomeApplicationPresentation {
  const ApplicantHomeApplicationPresentation({
    required this.stage,
    required this.title,
    required this.description,
    required this.semanticLabel,
    required this.tone,
    required this.primaryAction,
    this.stepLabel,
  });

  final ApplicantHomeStage stage;
  final String title;
  final String description;
  final String? stepLabel;
  final String semanticLabel;
  final ApplicantHomeTone tone;
  final ApplicantHomeActionPresentation primaryAction;
}

@immutable
class ApplicantHomeProgressPresentation {
  const ApplicantHomeProgressPresentation({
    required this.label,
    required this.status,
    required this.tone,
    this.description,
    this.action,
  });

  final String label;
  final String status;
  final String? description;
  final ApplicantHomeTone tone;
  final ApplicantHomeActionPresentation? action;
}

@immutable
class ApplicantHomeDocumentsPresentation {
  const ApplicantHomeDocumentsPresentation({
    required this.uploadedCount,
    required this.requiredCount,
    required this.missingCount,
  });

  final int uploadedCount;
  final int requiredCount;
  final int missingCount;
}

@immutable
class ApplicantHomeOpeningPresentation {
  const ApplicantHomeOpeningPresentation({
    required this.openingId,
    required this.title,
    required this.programName,
    required this.canApply,
    required this.actionLabel,
    required this.action,
    this.applicationPeriod,
  });

  /// Opaque callback data. Widgets must never render this identifier.
  final String openingId;
  final String title;
  final String programName;
  final String? applicationPeriod;
  final bool canApply;
  final String actionLabel;
  final ApplicantHomeActionPresentation action;
}

@immutable
class ApplicantHomeOpeningsPresentation {
  ApplicantHomeOpeningsPresentation({
    required List<ApplicantHomeOpeningPresentation> items,
    required this.hasSavedDraft,
    this.draftOpeningId,
    this.draftApplicationId,
  }) : items = List<ApplicantHomeOpeningPresentation>.unmodifiable(items);

  final List<ApplicantHomeOpeningPresentation> items;
  final bool hasSavedDraft;

  /// Opaque callback data. Widgets must never render these identifiers.
  final String? draftOpeningId;
  final String? draftApplicationId;
}

@immutable
class ApplicantHomeUpdatePresentation {
  const ApplicantHomeUpdatePresentation({
    required this.title,
    required this.summary,
    required this.categoryLabel,
    required this.action,
    this.publishedLabel,
  });

  final String title;
  final String summary;
  final String? publishedLabel;
  final String categoryLabel;
  final ApplicantHomeActionPresentation action;
}

@immutable
class ApplicantHomeState {
  ApplicantHomeState({
    required this.identity,
    required this.applicationStatus,
    required this.documents,
    required this.openings,
    required this.latestUpdate,
    required List<ApplicantHomeProgressPresentation> progress,
    required this.isRefreshing,
  }) : progress = List<ApplicantHomeProgressPresentation>.unmodifiable(
         progress,
       );

  factory ApplicantHomeState.initial() => ApplicantHomeState(
    identity: ApplicantHomeSectionState.initial(),
    applicationStatus: ApplicantHomeSectionState.initial(),
    documents: ApplicantHomeSectionState.initial(),
    openings: ApplicantHomeSectionState.initial(),
    latestUpdate: ApplicantHomeSectionState.initial(),
    progress: <ApplicantHomeProgressPresentation>[],
    isRefreshing: false,
  );

  final ApplicantHomeSectionState<ApplicantHomeIdentityPresentation> identity;
  final ApplicantHomeSectionState<ApplicantHomeApplicationPresentation>
  applicationStatus;
  final ApplicantHomeSectionState<ApplicantHomeDocumentsPresentation> documents;
  final ApplicantHomeSectionState<ApplicantHomeOpeningsPresentation> openings;
  final ApplicantHomeSectionState<ApplicantHomeUpdatePresentation> latestUpdate;
  final List<ApplicantHomeProgressPresentation> progress;
  final bool isRefreshing;

  bool get isInitialLoading =>
      identity.isInitialLoading ||
      applicationStatus.isInitialLoading ||
      documents.isInitialLoading ||
      openings.isInitialLoading ||
      latestUpdate.isInitialLoading;

  ApplicantHomeState copyWith({
    ApplicantHomeSectionState<ApplicantHomeIdentityPresentation>? identity,
    ApplicantHomeSectionState<ApplicantHomeApplicationPresentation>?
    applicationStatus,
    ApplicantHomeSectionState<ApplicantHomeDocumentsPresentation>? documents,
    ApplicantHomeSectionState<ApplicantHomeOpeningsPresentation>? openings,
    ApplicantHomeSectionState<ApplicantHomeUpdatePresentation>? latestUpdate,
    List<ApplicantHomeProgressPresentation>? progress,
    bool? isRefreshing,
  }) {
    return ApplicantHomeState(
      identity: identity ?? this.identity,
      applicationStatus: applicationStatus ?? this.applicationStatus,
      documents: documents ?? this.documents,
      openings: openings ?? this.openings,
      latestUpdate: latestUpdate ?? this.latestUpdate,
      progress: progress ?? this.progress,
      isRefreshing: isRefreshing ?? this.isRefreshing,
    );
  }
}
