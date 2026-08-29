class ApplicantRequirementDocument {
  final String id;
  final String documentType;
  final String routeParam;
  final bool isSubmitted;
  final bool isRequired;
  final String status;
  final String? fileUrl;
  final String? adminComment;
  final DateTime? uploadedAt;

  const ApplicantRequirementDocument({
    required this.id,
    required this.documentType,
    required this.routeParam,
    required this.isSubmitted,
    this.isRequired = true,
    required this.status,
    this.fileUrl,
    this.adminComment,
    this.uploadedAt,
  });

  bool get isVerified => status == 'verified';

  bool get isRejected => status == 'rejected';

  bool get needsReplacement =>
      status == 'reupload_required' || status == 'rejected';

  bool get isMissing => !isSubmitted || status == 'missing';

  bool get isUnderReview =>
      isSubmitted &&
      (status == 'uploaded' || status == 'under_review' || status == 'pending');

  factory ApplicantRequirementDocument.fromJson(Map<String, dynamic> json) {
    final documentId = (json['document_id'] ?? json['id'] ?? '')
        .toString()
        .trim();

    final documentType = (json['document_type'] ?? json['documentType'] ?? '')
        .toString()
        .trim();

    final isSubmitted = json['is_submitted'] == true;
    final reviewStatus = (json['review_status'] ?? json['status'] ?? '')
        .toString()
        .trim();

    final submittedAtRaw =
        json['submitted_at'] ?? json['uploaded_at'] ?? json['uploadedAt'];

    return ApplicantRequirementDocument(
      id: documentId,
      documentType: documentType,
      routeParam: documentId,
      isSubmitted: isSubmitted,
      isRequired: json['required'] == null ? true : json['required'] == true,
      status: _normalizeStatus(
        reviewStatus: reviewStatus,
        isSubmitted: isSubmitted,
      ),
      fileUrl: (json['file_url'] ?? '').toString().trim().isEmpty
          ? null
          : json['file_url'].toString(),
      adminComment: _optionalText(json['remarks'] ?? json['notes']),
      uploadedAt: submittedAtRaw == null
          ? null
          : DateTime.tryParse(submittedAtRaw.toString()),
    );
  }

  static String _normalizeStatus({
    required String reviewStatus,
    required bool isSubmitted,
  }) {
    if (!isSubmitted) return 'missing';

    final normalized = reviewStatus
        .trim()
        .toLowerCase()
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .replaceAll(RegExp(r'\s+'), ' ');

    if (normalized == 'verified' || normalized == 'approved') {
      return 'verified';
    }

    if (normalized == 'rejected' ||
        normalized == 'denied' ||
        normalized == 'declined') {
      return 'rejected';
    }

    if (normalized == 'reupload required' ||
        normalized == 'requires reupload' ||
        normalized == 'requires re upload' ||
        normalized == 'reupload' ||
        normalized == 're upload' ||
        normalized == 'needs reupload' ||
        normalized == 'needs re upload' ||
        normalized == 'flagged') {
      return 'reupload_required';
    }

    if (normalized == 'under review' ||
        normalized == 'uploaded' ||
        normalized == 'pending' ||
        normalized.isEmpty) {
      return 'under_review';
    }

    return normalized.replaceAll(' ', '_');
  }

  static String? _optionalText(dynamic value) {
    final text = value?.toString().trim() ?? '';
    return text.isEmpty ? null : text;
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
    this.uploadsLocked = false,
    this.uploadLockReason,
    required this.documents,
  });

  final String applicationId;
  final String contextId;
  final String contextTitle;
  final String programName;
  final String applicationStatus;
  final String documentStatus;
  final bool uploadsLocked;
  final String? uploadLockReason;
  final List<ApplicantRequirementDocument> documents;

  List<ApplicantRequirementDocument> get requiredDocuments => documents
      .where((document) => document.isRequired)
      .toList(growable: false);

  List<ApplicantRequirementDocument> get optionalDocuments => documents
      .where((document) => !document.isRequired)
      .toList(growable: false);

  int get uploadedCount =>
      requiredDocuments.where((document) => document.isSubmitted).length;

  int get requiredCount => requiredDocuments.length;

  int get missingCount =>
      requiredDocuments.where((document) => document.isMissing).length;

  int get verifiedCount =>
      requiredDocuments.where((document) => document.isVerified).length;

  int get needsReplacementCount =>
      requiredDocuments.where((document) => document.needsReplacement).length;

  bool get allRequiredUploaded =>
      requiredDocuments.isNotEmpty &&
      requiredDocuments.every((document) => document.isSubmitted);

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
        .toList(growable: false);

    final uploadLockReasonRaw =
        json['upload_lock_reason'] ?? application['upload_lock_reason'];
    final uploadLockReasonText =
        uploadLockReasonRaw?.toString().trim() ?? '';

    final verificationStatus =
        application['verification_status']?.toString().trim().toLowerCase() ??
        '';

    final uploadsLocked =
        json['uploads_locked'] == true ||
        application['uploads_locked'] == true ||
        verificationStatus == 'verified';

    return ApplicantDocumentsPackage(
      applicationId: application['application_id']?.toString() ?? '',
      contextId:
          application['opening_id']?.toString() ??
          context['opening_id']?.toString() ??
          '',
      contextTitle:
          context['opening_title']?.toString() ?? 'Scholarship Requirements',
      programName: context['program_name']?.toString() ?? 'Current Application',
      applicationStatus:
          application['application_status']?.toString() ?? 'Pending Review',
      documentStatus:
          application['document_status']?.toString() ?? 'Missing Docs',
      uploadsLocked: uploadsLocked,
      uploadLockReason:
          uploadLockReasonText.isEmpty ? null : uploadLockReasonText,
      documents: documents,
    );
  }
}
