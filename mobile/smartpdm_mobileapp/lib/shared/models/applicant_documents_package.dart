class ApplicantRequirementDocument {
  final String id;
  final String documentType;
  final String routeParam;
  final bool isSubmitted;
  final String status;
  final String? fileUrl;
  final String? adminComment;
  final DateTime? uploadedAt;

  const ApplicantRequirementDocument({
    required this.id,
    required this.documentType,
    required this.routeParam,
    required this.isSubmitted,
    required this.status,
    this.fileUrl,
    this.adminComment,
    this.uploadedAt,
  });

  factory ApplicantRequirementDocument.fromJson(Map<String, dynamic> json) {
    final documentId = (json['document_id'] ?? json['id'] ?? '')
        .toString()
        .trim();

    final documentType = (json['document_type'] ?? json['documentType'] ?? '')
        .toString()
        .trim();

    final reviewStatus = (json['review_status'] ?? json['status'] ?? '')
        .toString()
        .trim();

    final submittedAtRaw =
        json['submitted_at'] ?? json['uploaded_at'] ?? json['uploadedAt'];

    return ApplicantRequirementDocument(
      id: documentId,
      documentType: documentType,
      routeParam: documentId,
      isSubmitted: json['is_submitted'] == true,
      status: json['is_submitted'] == true
          ? (reviewStatus.isEmpty ? 'uploaded' : reviewStatus)
          : 'pending',
      fileUrl: (json['file_url'] ?? '').toString().trim().isEmpty
          ? null
          : json['file_url'].toString(),
      adminComment: (json['remarks'] ?? json['notes'] ?? '').toString(),
      uploadedAt: submittedAtRaw == null
          ? null
          : DateTime.tryParse(submittedAtRaw.toString()),
    );
  }
}

class ApplicantDocumentsPackage {
  const ApplicantDocumentsPackage({
    required this.applicationId,
    required this.contextId,
    required this.contextTitle,
    required this.programName,
    required this.applicationStatus,
    required this.documentStatus,
    required this.documents,
  });

  final String applicationId;
  final String contextId;
  final String contextTitle;
  final String programName;
  final String applicationStatus;
  final String documentStatus;
  final List<ApplicantRequirementDocument> documents;

  int get uploadedCount =>
      documents.where((document) => document.isSubmitted).length;

  bool get allRequiredUploaded =>
      documents.isNotEmpty &&
      documents.every((document) => document.isSubmitted);

  factory ApplicantDocumentsPackage.fromJson(Map<String, dynamic> json) {
    final application =
        json['application'] as Map<String, dynamic>? ?? const {};
    final context =
        json['context'] as Map<String, dynamic>? ??
        json['opening'] as Map<String, dynamic>? ??
        const {};
    final documents = (json['documents'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map(
          (item) => ApplicantRequirementDocument.fromJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .toList();

    return ApplicantDocumentsPackage(
      applicationId: application['application_id']?.toString() ?? '',
      contextId:
          application['opening_id']?.toString() ??
          context['opening_id']?.toString() ??
          '',
      contextTitle:
          context['opening_title']?.toString() ?? 'Scholarship Requirements',
      programName:
          context['program_name']?.toString() ?? 'Unassigned Application',
      applicationStatus:
          application['application_status']?.toString() ?? 'Pending Review',
      documentStatus:
          application['document_status']?.toString() ?? 'Missing Docs',
      documents: documents,
    );
  }
}
