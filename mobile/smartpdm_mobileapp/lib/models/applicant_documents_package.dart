class ApplicantRequirementDocument {
  const ApplicantRequirementDocument({
    required this.id,
    required this.documentType,
    required this.status,
    required this.isSubmitted,
    this.fileUrl,
    this.adminComment,
    this.uploadedAt,
  });

  final String id;
  final String documentType;
  final String status;
  final bool isSubmitted;
  final String? fileUrl;
  final String? adminComment;
  final DateTime? uploadedAt;

  String get routeParam => id.replaceAll('_', '-');

  factory ApplicantRequirementDocument.fromJson(Map<String, dynamic> json) {
    return ApplicantRequirementDocument(
      id: json['id']?.toString() ?? '',
      documentType:
          json['document_type']?.toString() ??
          json['name']?.toString() ??
          'Document',
      status: json['status']?.toString() ?? 'pending',
      isSubmitted: json['is_submitted'] == true || json['file_url'] != null,
      fileUrl: json['file_url']?.toString(),
      adminComment: json['admin_comment']?.toString(),
      uploadedAt: DateTime.tryParse(json['uploaded_at']?.toString() ?? ''),
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
