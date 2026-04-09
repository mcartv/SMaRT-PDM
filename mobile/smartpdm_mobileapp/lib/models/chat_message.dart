class ChatMessage {
  final String messageId;
  final String senderId;
  final String receiverId;
  final String messageBody;
  final DateTime sentAt;
  final bool isRead;
  final String? subject;
  final String? attachmentUrl;

  const ChatMessage({
    required this.messageId,
    required this.senderId,
    required this.receiverId,
    required this.messageBody,
    required this.sentAt,
    required this.isRead,
    this.subject,
    this.attachmentUrl,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      messageId: json['messageId']?.toString() ?? '',
      senderId: json['senderId']?.toString() ?? '',
      receiverId: json['receiverId']?.toString() ?? '',
      messageBody: json['messageBody']?.toString() ?? '',
      sentAt:
          DateTime.tryParse(json['sentAt']?.toString() ?? '') ?? DateTime.now(),
      isRead: json['isRead'] == true,
      subject: json['subject']?.toString(),
      attachmentUrl: json['attachmentUrl']?.toString(),
    );
  }

  ChatMessage copyWith({
    String? messageId,
    String? senderId,
    String? receiverId,
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
      messageBody: messageBody ?? this.messageBody,
      sentAt: sentAt ?? this.sentAt,
      isRead: isRead ?? this.isRead,
      subject: subject ?? this.subject,
      attachmentUrl: attachmentUrl ?? this.attachmentUrl,
    );
  }
}
