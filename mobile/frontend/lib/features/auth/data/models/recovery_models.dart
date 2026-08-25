enum RecoveryChannel { email, sms }

extension RecoveryChannelX on RecoveryChannel {
  String get wireValue => this == RecoveryChannel.email ? 'email' : 'sms';

  String get title =>
      this == RecoveryChannel.email ? 'Get code via email' : 'Get code via SMS';

  String get subtitlePrefix => this == RecoveryChannel.email
      ? 'Use your email'
      : 'Use your mobile number';

  static RecoveryChannel fromWireValue(String rawValue) {
    switch (rawValue.trim().toLowerCase()) {
      case 'email':
        return RecoveryChannel.email;
      case 'sms':
        return RecoveryChannel.sms;
      default:
        throw ArgumentError('Unsupported recovery channel: $rawValue');
    }
  }
}

class RecoveryAccount {
  const RecoveryAccount({
    required this.userId,
    required this.displayName,
    required this.studentId,
    required this.hasEmail,
    required this.hasPhone,
    this.avatarUrl,
    this.maskedEmail,
    this.maskedPhone,
  });

  final String userId;
  final String displayName;
  final String studentId;
  final String? avatarUrl;
  final String? maskedEmail;
  final String? maskedPhone;
  final bool hasEmail;
  final bool hasPhone;

  factory RecoveryAccount.fromJson(Map<String, dynamic> json) {
    return RecoveryAccount(
      userId: json['user_id']?.toString() ?? '',
      displayName: json['display_name']?.toString() ?? '',
      studentId: json['student_id']?.toString() ?? '',
      avatarUrl: json['avatar_url']?.toString(),
      maskedEmail: json['masked_email']?.toString(),
      maskedPhone: json['masked_phone']?.toString(),
      hasEmail: json['has_email'] == true,
      hasPhone: json['has_phone'] == true,
    );
  }
}

class RecoverySession {
  const RecoverySession({
    required this.sessionId,
    required this.channel,
    required this.maskedDestination,
    this.expiresAt,
    this.resendAvailableAt,
  });

  final String sessionId;
  final RecoveryChannel channel;
  final String? maskedDestination;
  final DateTime? expiresAt;
  final DateTime? resendAvailableAt;

  factory RecoverySession.fromJson(Map<String, dynamic> json) {
    return RecoverySession(
      sessionId: json['session_id']?.toString() ?? '',
      channel: RecoveryChannelX.fromWireValue(
        json['channel']?.toString() ?? 'email',
      ),
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
