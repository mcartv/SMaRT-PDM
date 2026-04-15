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

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      messageId: json['messageId']?.toString() ?? '',
      senderId: json['senderId']?.toString() ?? '',
      receiverId: json['receiverId']?.toString(),
      roomId: json['roomId']?.toString(),
      senderName: json['senderName']?.toString(),
      senderAvatarUrl: json['senderAvatarUrl']?.toString(),
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
