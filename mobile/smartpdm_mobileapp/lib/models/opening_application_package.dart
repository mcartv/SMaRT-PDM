class OpeningApplicationDocument {
  const OpeningApplicationDocument({
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

  factory OpeningApplicationDocument.fromJson(Map<String, dynamic> json) {
    return OpeningApplicationDocument(
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

class OpeningApplicationPackage {
  const OpeningApplicationPackage({
    required this.applicationId,
    required this.openingId,
    required this.openingTitle,
    required this.programName,
    required this.applicationStatus,
    required this.documentStatus,
    required this.documents,
  });

  final String applicationId;
  final String openingId;
  final String openingTitle;
  final String programName;
  final String applicationStatus;
  final String documentStatus;
  final List<OpeningApplicationDocument> documents;

  int get uploadedCount =>
      documents.where((document) => document.isSubmitted).length;

  bool get allRequiredUploaded =>
      documents.isNotEmpty &&
      documents.every((document) => document.isSubmitted);

  factory OpeningApplicationPackage.fromJson(Map<String, dynamic> json) {
    final application =
        json['application'] as Map<String, dynamic>? ?? const {};
    final opening = json['opening'] as Map<String, dynamic>? ?? const {};
    final documents = (json['documents'] as List<dynamic>? ?? const [])
        .whereType<Map>()
        .map(
          (item) => OpeningApplicationDocument.fromJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .toList();

    return OpeningApplicationPackage(
      applicationId: application['application_id']?.toString() ?? '',
      openingId:
          application['opening_id']?.toString() ??
          opening['opening_id']?.toString() ??
          '',
      openingTitle:
          opening['opening_title']?.toString() ?? 'Scholarship Opening',
      programName: opening['program_name']?.toString() ?? 'Scholarship Program',
      applicationStatus:
          application['application_status']?.toString() ?? 'Pending Review',
      documentStatus:
          application['document_status']?.toString() ?? 'Missing Docs',
      documents: documents,
    );
  }
}
