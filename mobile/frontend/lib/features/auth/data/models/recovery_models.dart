class RecoveryAccount {
  const RecoveryAccount({
    required this.userId,
    required this.displayName,
    required this.studentId,
    required this.hasEmail,
    this.avatarUrl,
    this.maskedEmail,
  });

  final String userId;
  final String displayName;
  final String studentId;
  final String? avatarUrl;
  final String? maskedEmail;
  final bool hasEmail;

  factory RecoveryAccount.fromJson(Map<String, dynamic> json) {
    return RecoveryAccount(
      userId: json['user_id']?.toString() ?? '',
      displayName: json['display_name']?.toString() ?? '',
      studentId: json['student_id']?.toString() ?? '',
      avatarUrl: json['avatar_url']?.toString(),
      maskedEmail: json['masked_email']?.toString(),
      hasEmail: json['has_email'] == true,
    );
  }
}

class RecoverySession {
  const RecoverySession({
    required this.sessionId,
    required this.maskedDestination,
    this.expiresAt,
    this.resendAvailableAt,
  });

  final String sessionId;
  final String? maskedDestination;
  final DateTime? expiresAt;
  final DateTime? resendAvailableAt;

  factory RecoverySession.fromJson(Map<String, dynamic> json) {
    return RecoverySession(
      sessionId: json['session_id']?.toString() ?? '',
      maskedDestination: json['masked_destination']?.toString(),
      expiresAt: DateTime.tryParse(json['expires_at']?.toString() ?? ''),
      resendAvailableAt: DateTime.tryParse(
        json['resend_available_at']?.toString() ?? '',
      ),
    );
  }
}

class PasswordResetGrant {
  const PasswordResetGrant({required this.resetToken, this.expiresAt});

  final String resetToken;
  final DateTime? expiresAt;

  factory PasswordResetGrant.fromJson(Map<String, dynamic> json) {
    return PasswordResetGrant(
      resetToken: json['reset_token']?.toString() ?? '',
      expiresAt: DateTime.tryParse(json['expires_at']?.toString() ?? ''),
    );
  }
}
