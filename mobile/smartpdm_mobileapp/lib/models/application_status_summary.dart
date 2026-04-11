class ApplicationStatusSummary {
  const ApplicationStatusSummary({
    required this.hasApplication,
    this.applicationId,
    this.applicationStatus,
    this.documentStatus,
    this.programId,
    this.programName,
    this.submissionDate,
  });

  final bool hasApplication;
  final String? applicationId;
  final String? applicationStatus;
  final String? documentStatus;
  final String? programId;
  final String? programName;
  final DateTime? submissionDate;

  factory ApplicationStatusSummary.fromJson(Map<String, dynamic> json) {
    final application =
        json['application'] as Map<String, dynamic>? ?? const {};

    return ApplicationStatusSummary(
      hasApplication: json['has_application'] == true,
      applicationId: application['application_id']?.toString(),
      applicationStatus: application['application_status']?.toString(),
      documentStatus: application['document_status']?.toString(),
      programId: application['program_id']?.toString(),
      programName: application['program_name']?.toString(),
      submissionDate: DateTime.tryParse(
        application['submission_date']?.toString() ?? '',
      ),
    );
  }
}
