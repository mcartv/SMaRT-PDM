class SupportTicket {
  const SupportTicket({
    required this.ticketId,
    required this.studentId,
    required this.issueCategory,
    required this.description,
    required this.status,
    required this.createdAt,
    this.handledBy,
    this.resolvedAt,
  });

  final String ticketId;
  final String studentId;
  final String issueCategory;
  final String description;
  final String status;
  final DateTime? createdAt;
  final String? handledBy;
  final DateTime? resolvedAt;

  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    DateTime? parseDate(dynamic value) {
      final raw = value?.toString().trim() ?? '';
      if (raw.isEmpty) return null;
      return DateTime.tryParse(raw);
    }

    return SupportTicket(
      ticketId: json['ticket_id']?.toString() ?? '',
      studentId: json['student_id']?.toString() ?? '',
      issueCategory: json['issue_category']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      status: json['status']?.toString() ?? 'Open',
      createdAt: parseDate(json['created_at']),
      handledBy: json['handled_by']?.toString(),
      resolvedAt: parseDate(json['resolved_at']),
    );
  }
}
