class ChatMessage {
  final String messageId;
  final String senderId;
  final String? receiverId; // Now nullable because group chats don't have a single receiver
  final String? roomId;
  final String? senderName;
  final String? senderAvatarUrl;
  final String messageBody;
  final DateTime sentAt;
  final bool isRead;
  final String? subject;
  final String? attachmentUrl;

  const ChatMessage({
    required this.messageId,
    required this.senderId,
    this.receiverId,
    this.roomId,
    this.senderName,
    this.senderAvatarUrl,
    required this.messageBody,
    required this.sentAt,
    required this.isRead,
    this.subject,
    this.attachmentUrl,
  });

  static String _pickString(Map<String, dynamic> json, List<String> keys) {
    for (final key in keys) {
      final value = json[key];
      if (value == null) {
        continue;
      }
      final text = value.toString();
      if (text.isNotEmpty) {
        return text;
      }
    }
    return '';
  }

  static String? _pickNullableString(
    Map<String, dynamic> json,
    List<String> keys,
  ) {
    final value = _pickString(json, keys);
    return value.isEmpty ? null : value;
  }

  static bool _pickBool(Map<String, dynamic> json, List<String> keys) {
    for (final key in keys) {
      final value = json[key];
      if (value is bool) {
        return value;
      }
      if (value is num) {
        return value != 0;
      }
      if (value is String) {
        final normalized = value.trim().toLowerCase();
        if (normalized == 'true' || normalized == '1') {
          return true;
        }
        if (normalized == 'false' || normalized == '0') {
          return false;
        }
      }
    }
    return false;
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final sentAtRaw = _pickString(json, ['sentAt', 'sent_at', 'created_at']);
    return ChatMessage(
      messageId: _pickString(json, ['messageId', 'message_id']),
      senderId: _pickString(json, ['senderId', 'sender_id']),
      receiverId: _pickNullableString(json, ['receiverId', 'receiver_id']),
      roomId: _pickNullableString(json, ['roomId', 'room_id']),
      senderName: _pickNullableString(json, ['senderName', 'sender_name']),
      senderAvatarUrl: _pickNullableString(json, [
        'senderAvatarUrl',
        'sender_avatar_url',
        'sender_profile_photo_url',
      ]),
      messageBody: _pickString(json, ['messageBody', 'message_body']),
      sentAt: DateTime.tryParse(sentAtRaw) ?? DateTime.now(),
      isRead: _pickBool(json, ['isRead', 'is_read']),
      subject: _pickNullableString(json, ['subject']),
      attachmentUrl: _pickNullableString(json, [
        'attachmentUrl',
        'attachment_url',
      ]),
    );
  }

  ChatMessage copyWith({
    String? messageId,
    String? senderId,
    String? receiverId,
    String? roomId,
    String? senderName,
    String? senderAvatarUrl,
    String? messageBody,
    DateTime? sentAt,
    bool? isRead,
    String? subject,
    String? attachmentUrl,
  }) {
    return ChatMessage(
      messageId: messageId ?? this.messageId,
      senderId: senderId ?? this.senderId,
      receiverId: receiverId ?? this.receiverId,
      roomId: roomId ?? this.roomId,
      senderName: senderName ?? this.senderName,
      senderAvatarUrl: senderAvatarUrl ?? this.senderAvatarUrl,
      messageBody: messageBody ?? this.messageBody,
      sentAt: sentAt ?? this.sentAt,
      isRead: isRead ?? this.isRead,
      subject: subject ?? this.subject,
      attachmentUrl: attachmentUrl ?? this.attachmentUrl,
    );
  }
}
