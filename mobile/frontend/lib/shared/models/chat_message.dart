class ChatMessage {
  final String messageId;
  final String senderId;
  final String? receiverId;
  final String? roomId;
  final String? senderName;
  final String? senderAvatarUrl;
  final String messageBody;
  final DateTime sentAt;
  final bool isRead;
  final String? subject;
  final String? attachmentUrl;
  final bool isUnsent;
  final DateTime? unsentAt;
  final String? replyToMessageId;
  final String? replyMessageBody;
  final String? replySenderId;
  final String? replySenderName;

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
    this.isUnsent = false,
    this.unsentAt,
    this.replyToMessageId,
    this.replyMessageBody,
    this.replySenderId,
    this.replySenderName,
  });

  bool get isReply => (replyToMessageId ?? '').trim().isNotEmpty;

  static String _pickString(Map<String, dynamic> json, List<String> keys) {
    for (final key in keys) {
      final value = json[key];
      if (value == null) continue;
      final text = value.toString();
      if (text.isNotEmpty) return text;
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
      if (value is bool) return value;
      if (value is num) return value != 0;
      if (value is String) {
        final normalized = value.trim().toLowerCase();
        if (normalized == 'true' || normalized == '1') return true;
        if (normalized == 'false' || normalized == '0') return false;
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
      isUnsent: _pickBool(json, ['isUnsent', 'is_unsent']) ||
          _pickString(json, ['unsentAt', 'unsent_at']).isNotEmpty ||
          _pickString(json, ['messageBody', 'message_body']).trim() ==
              'This message was unsent',
      unsentAt: DateTime.tryParse(_pickString(json, ['unsentAt', 'unsent_at'])),
      replyToMessageId: _pickNullableString(json, [
        'replyToMessageId',
        'reply_to_message_id',
      ]),
      replyMessageBody: _pickNullableString(json, [
        'replyMessageBody',
        'reply_message_body',
      ]),
      replySenderId: _pickNullableString(json, [
        'replySenderId',
        'reply_sender_id',
      ]),
      replySenderName: _pickNullableString(json, [
        'replySenderName',
        'reply_sender_name',
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
    bool? isUnsent,
    DateTime? unsentAt,
    String? replyToMessageId,
    String? replyMessageBody,
    String? replySenderId,
    String? replySenderName,
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
      isUnsent: isUnsent ?? this.isUnsent,
      unsentAt: unsentAt ?? this.unsentAt,
      replyToMessageId: replyToMessageId ?? this.replyToMessageId,
      replyMessageBody: replyMessageBody ?? this.replyMessageBody,
      replySenderId: replySenderId ?? this.replySenderId,
      replySenderName: replySenderName ?? this.replySenderName,
    );
  }
}
