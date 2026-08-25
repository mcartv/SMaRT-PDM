class ScholarRenewalDocument {
  const ScholarRenewalDocument({
    required this.id,
    required this.routeParam,
    required this.documentType,
    required this.isSubmitted,
    required this.fileUrl,
    required this.status,
    required this.reviewStatus,
    required this.adminComment,
    required this.submittedAt,
    required this.reviewedAt,
    required this.remarks,
    this.renewalDocumentId,
  });

  final String id;
  final String routeParam;
  final String documentType;
  final bool isSubmitted;
  final String? fileUrl;
  final String status;
  final String reviewStatus;
  final String adminComment;
  final String? submittedAt;
  final String? reviewedAt;
  final String? remarks;
  final String? renewalDocumentId;

  bool get hasFile => fileUrl != null && fileUrl!.trim().isNotEmpty;

  factory ScholarRenewalDocument.fromJson(Map<String, dynamic> json) {
    return ScholarRenewalDocument(
      id: json['id']?.toString() ?? '',
      routeParam: json['route_param']?.toString() ?? '',
      documentType: json['document_type']?.toString() ?? 'Document',
      isSubmitted: json['is_submitted'] == true,
      fileUrl: json['file_url']?.toString(),
      status: json['status']?.toString() ?? 'pending',
      reviewStatus: json['review_status']?.toString() ?? 'pending',
      adminComment: json['admin_comment']?.toString() ?? '',
      submittedAt: json['submitted_at']?.toString(),
      reviewedAt: json['reviewed_at']?.toString(),
      remarks: json['remarks']?.toString(),
      renewalDocumentId: json['renewal_document_id']?.toString(),
    );
  }
}

class ScholarRenewal {
  const ScholarRenewal({
    required this.renewalId,
    required this.scholarId,
    required this.studentId,
    required this.programId,
    required this.semesterLabel,
    required this.schoolYearLabel,
    required this.renewalStatus,
    required this.documentStatus,
    required this.adminComment,
    required this.submittedAt,
    required this.reviewedAt,
  });

  final String renewalId;
  final String scholarId;
  final String studentId;
  final String programId;
  final String semesterLabel;
  final String schoolYearLabel;
  final String renewalStatus;
  final String documentStatus;
  final String? adminComment;
  final String? submittedAt;
  final String? reviewedAt;

  bool get isLockedForReview =>
      renewalStatus == 'Under Review' || renewalStatus == 'Approved';

  factory ScholarRenewal.fromJson(Map<String, dynamic> json) {
    return ScholarRenewal(
      renewalId: json['renewal_id']?.toString() ?? '',
      scholarId: json['scholar_id']?.toString() ?? '',
      studentId: json['student_id']?.toString() ?? '',
      programId: json['program_id']?.toString() ?? '',
      semesterLabel: json['semester_label']?.toString() ?? '',
      schoolYearLabel: json['school_year_label']?.toString() ?? '',
      renewalStatus:
          json['renewal_status']?.toString() ?? 'Pending Submission',
      documentStatus: json['document_status']?.toString() ?? 'Missing Docs',
      adminComment: json['admin_comment']?.toString(),
      submittedAt: json['submitted_at']?.toString(),
      reviewedAt: json['reviewed_at']?.toString(),
    );
  }
}

class ScholarRenewalPackage {
  const ScholarRenewalPackage({
    required this.renewal,
    required this.documents,
    required this.studentName,
    required this.studentNumber,
    required this.programName,
    required this.benefactorName,
    required this.semesterLabel,
    required this.schoolYearLabel,
  });

  final ScholarRenewal renewal;
  final List<ScholarRenewalDocument> documents;
  final String studentName;
  final String studentNumber;
  final String programName;
  final String? benefactorName;
  final String semesterLabel;
  final String schoolYearLabel;

  bool get allRequiredUploaded => documents.every((document) => document.hasFile);

  factory ScholarRenewalPackage.fromJson(Map<String, dynamic> json) {
    final renewalJson =
        json['renewal'] is Map<String, dynamic>
            ? json['renewal'] as Map<String, dynamic>
            : Map<String, dynamic>.from(
                (json['renewal'] as Map?) ?? const <String, dynamic>{},
              );
    final scholarJson =
        json['scholar'] is Map<String, dynamic>
            ? json['scholar'] as Map<String, dynamic>
            : Map<String, dynamic>.from(
                (json['scholar'] as Map?) ?? const <String, dynamic>{},
              );
    final studentJson =
        json['student'] is Map<String, dynamic>
            ? json['student'] as Map<String, dynamic>
            : Map<String, dynamic>.from(
                (json['student'] as Map?) ?? const <String, dynamic>{},
              );
    final cycleJson =
        json['cycle'] is Map<String, dynamic>
            ? json['cycle'] as Map<String, dynamic>
            : Map<String, dynamic>.from(
                (json['cycle'] as Map?) ?? const <String, dynamic>{},
              );

    final documents =
        (json['documents'] as List<dynamic>? ?? const [])
            .whereType<Map>()
            .map(
              (item) => ScholarRenewalDocument.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList();

    return ScholarRenewalPackage(
      renewal: ScholarRenewal.fromJson(renewalJson),
      documents: documents,
      studentName: studentJson['name']?.toString() ?? 'Scholar',
      studentNumber: studentJson['pdm_id']?.toString() ?? '',
      programName: scholarJson['program_name']?.toString() ?? 'Scholarship',
      benefactorName: scholarJson['benefactor_name']?.toString(),
      semesterLabel: cycleJson['semester_label']?.toString() ?? '',
      schoolYearLabel: cycleJson['school_year_label']?.toString() ?? '',
    );
  }
}
