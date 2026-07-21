class PayoutProof {
  const PayoutProof({
    required this.proofId,
    required this.status,
    this.fileName,
    this.fileUrl,
    this.adminComment,
    this.rejectionReason,
    this.submittedAt,
    this.reviewedAt,
  });

  final String proofId;
  final String status;
  final String? fileName;
  final String? fileUrl;
  final String? adminComment;
  final String? rejectionReason;
  final DateTime? submittedAt;
  final DateTime? reviewedAt;

  bool get mayReplace {
    final normalized = status.trim().toLowerCase();
    return normalized == 'rejected' ||
        normalized == 'resubmission required';
  }

  factory PayoutProof.fromJson(Map<String, dynamic> json) {
    return PayoutProof(
      proofId: json['payout_proof_id']?.toString() ?? '',
      status: json['proof_status']?.toString() ?? 'Pending Review',
      fileName: json['file_name']?.toString(),
      fileUrl: json['file_url']?.toString(),
      adminComment: json['admin_comment']?.toString(),
      rejectionReason: json['rejection_reason']?.toString(),
      submittedAt: DateTime.tryParse(json['submitted_at']?.toString() ?? ''),
      reviewedAt: DateTime.tryParse(json['reviewed_at']?.toString() ?? ''),
    );
  }
}
