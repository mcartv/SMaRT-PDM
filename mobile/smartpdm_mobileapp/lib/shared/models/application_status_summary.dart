class ApplicationStatusSummary {
  const ApplicationStatusSummary({
    required this.hasApplication,
    this.applicationId,
    this.applicationStatus,
    this.documentStatus,
    this.openingId,
    this.openingTitle,
    this.programId,
    this.programName,
    this.submissionDate,
    this.workflow,
  });

  final bool hasApplication;
  final String? applicationId;
  final String? applicationStatus;
  final String? documentStatus;
  final String? openingId;
  final String? openingTitle;
  final String? programId;
  final String? programName;
  final DateTime? submissionDate;
  final ApplicationWorkflowSummary? workflow;

  factory ApplicationStatusSummary.fromJson(Map<String, dynamic> json) {
    final application = _asMap(json['application']);

    return ApplicationStatusSummary(
      hasApplication:
          json['has_application'] == true || json['hasApplication'] == true,
      applicationId: application['application_id']?.toString(),
      applicationStatus: application['application_status']?.toString(),
      documentStatus: application['document_status']?.toString(),
      openingId: application['opening_id']?.toString(),
      openingTitle: application['opening_title']?.toString(),
      programId: application['program_id']?.toString(),
      programName: application['program_name']?.toString(),
      submissionDate: DateTime.tryParse(
        application['submission_date']?.toString() ?? '',
      ),
      workflow: json['workflow'] is Map
          ? ApplicationWorkflowSummary.fromJson(_asMap(json['workflow']))
          : null,
    );
  }
}

class ApplicationWorkflowSummary {
  const ApplicationWorkflowSummary({
    required this.stage,
    required this.stageLabel,
    required this.requirements,
    required this.endorsement,
    required this.scholarActivation,
    required this.officeReviews,
    required this.blockers,
    this.primaryBlocker,
  });

  final String stage;
  final String stageLabel;
  final WorkflowStateSummary requirements;
  final EndorsementStateSummary endorsement;
  final WorkflowStateSummary scholarActivation;
  final Map<String, OfficeReviewSummary> officeReviews;
  final List<WorkflowBlocker> blockers;
  final WorkflowBlocker? primaryBlocker;

  factory ApplicationWorkflowSummary.fromJson(Map<String, dynamic> json) {
    final endorsement = EndorsementStateSummary.fromJson(
      _asMap(json['endorsement']),
    );
    final workflowOfficeReviews = _asMap(json['office_reviews']);
    final rawOfficeReviews = workflowOfficeReviews.isNotEmpty
        ? workflowOfficeReviews
        : _asMap(_asMap(json['endorsement'])['office_reviews']);

    return ApplicationWorkflowSummary(
      stage: _stringValue(json['stage'], fallback: 'application_submitted'),
      stageLabel: _stringValue(
        json['stage_label'],
        fallback: 'Application Submitted',
      ),
      requirements: WorkflowStateSummary.fromJson(_asMap(json['requirements'])),
      endorsement: endorsement,
      scholarActivation: WorkflowStateSummary.fromJson(
        _asMap(json['scholar_activation']),
      ),
      officeReviews: {
        'sdo': OfficeReviewSummary.fromJson(_asMap(rawOfficeReviews['sdo'])),
        'guidance': OfficeReviewSummary.fromJson(
          _asMap(rawOfficeReviews['guidance']),
        ),
        'pd': OfficeReviewSummary.fromJson(_asMap(rawOfficeReviews['pd'])),
      },
      blockers: (_asList(
        json['blockers'],
      )).map((item) => WorkflowBlocker.fromJson(_asMap(item))).toList(),
      primaryBlocker: json['primary_blocker'] is Map
          ? WorkflowBlocker.fromJson(_asMap(json['primary_blocker']))
          : null,
    );
  }
}

class WorkflowStateSummary {
  const WorkflowStateSummary({
    required this.status,
    required this.statusLabel,
    this.remarks,
    this.activatedAt,
    this.extra = const {},
  });

  final String status;
  final String statusLabel;
  final String? remarks;
  final DateTime? activatedAt;
  final Map<String, dynamic> extra;

  factory WorkflowStateSummary.fromJson(Map<String, dynamic> json) {
    final status = _stringValue(json['status'], fallback: 'not_ready');

    return WorkflowStateSummary(
      status: status,
      statusLabel: _stringValue(json['status_label'], fallback: status),
      remarks: _nullableString(json['remarks']),
      activatedAt: DateTime.tryParse(json['activated_at']?.toString() ?? ''),
      extra: json,
    );
  }
}

class EndorsementStateSummary extends WorkflowStateSummary {
  const EndorsementStateSummary({
    required super.status,
    required super.statusLabel,
    super.remarks,
    required this.currentStage,
    this.currentOffice,
    this.completedAt,
    required this.slip,
    super.extra = const {},
  });

  final String currentStage;
  final String? currentOffice;
  final DateTime? completedAt;
  final EndorsementSlipSummary slip;

  factory EndorsementStateSummary.fromJson(Map<String, dynamic> json) {
    final status = _stringValue(json['status'], fallback: 'pending_sdo');

    return EndorsementStateSummary(
      status: status,
      statusLabel: _stringValue(json['status_label'], fallback: status),
      remarks: _nullableString(json['remarks']),
      currentStage: _stringValue(json['current_stage'], fallback: status),
      currentOffice: _nullableString(json['current_office']),
      completedAt: DateTime.tryParse(json['completed_at']?.toString() ?? ''),
      slip: EndorsementSlipSummary.fromJson(_asMap(json['slip'])),
      extra: json,
    );
  }
}

class EndorsementSlipSummary {
  const EndorsementSlipSummary({
    required this.available,
    this.slipId,
    this.slipCode,
    this.downloadUrl,
    this.fileName,
    this.completedAt,
  });

  final bool available;
  final String? slipId;
  final String? slipCode;
  final String? downloadUrl;
  final String? fileName;
  final DateTime? completedAt;

  factory EndorsementSlipSummary.fromJson(Map<String, dynamic> json) {
    return EndorsementSlipSummary(
      available: json['available'] == true,
      slipId: _nullableString(json['slip_id']),
      slipCode: _nullableString(json['slip_code']),
      downloadUrl: _nullableString(json['download_url']),
      fileName: _nullableString(json['file_name']),
      completedAt: DateTime.tryParse(json['completed_at']?.toString() ?? ''),
    );
  }
}

class OfficeReviewSummary {
  const OfficeReviewSummary({
    this.office,
    this.decision,
    this.actedAt,
    this.actedByName,
    this.remarks,
    this.offenseDetail = const {},
  });

  final String? office;
  final String? decision;
  final DateTime? actedAt;
  final String? actedByName;
  final String? remarks;
  final Map<String, dynamic> offenseDetail;

  factory OfficeReviewSummary.fromJson(Map<String, dynamic> json) {
    return OfficeReviewSummary(
      office: _nullableString(json['office']),
      decision: _nullableString(json['decision']),
      actedAt: DateTime.tryParse(json['acted_at']?.toString() ?? ''),
      actedByName: _nullableString(json['acted_by_name']),
      remarks: _nullableString(json['remarks']),
      offenseDetail: _asMap(json['offense_detail']),
    );
  }
}

class WorkflowBlocker {
  const WorkflowBlocker({
    required this.code,
    required this.source,
    required this.message,
  });

  final String code;
  final String source;
  final String message;

  factory WorkflowBlocker.fromJson(Map<String, dynamic> json) {
    final code = _stringValue(json['code']);

    return WorkflowBlocker(
      code: code,
      source: _stringValue(json['source']),
      message: _stringValue(json['message'], fallback: code),
    );
  }
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return value.map((key, mapValue) => MapEntry('$key', mapValue));
  }
  return <String, dynamic>{};
}

List<dynamic> _asList(dynamic value) {
  if (value is List) return value;
  return const [];
}

String _stringValue(dynamic value, {String fallback = ''}) {
  final text = value?.toString().trim() ?? '';
  return text.isEmpty ? fallback : text;
}

String? _nullableString(dynamic value) {
  final text = value?.toString().trim() ?? '';
  return text.isEmpty ? null : text;
}
