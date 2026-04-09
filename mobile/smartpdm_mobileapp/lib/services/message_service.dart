import 'package:smartpdm_mobileapp/models/chat_message.dart';
import 'package:smartpdm_mobileapp/services/api_client.dart';

class MessageThreadResult {
  final String counterpartyId;
  final List<ChatMessage> items;

  const MessageThreadResult({
    required this.counterpartyId,
    required this.items,
  });
}

class MessageReadResult {
  final int updatedCount;
  final List<String> messageIds;

  const MessageReadResult({
    required this.updatedCount,
    required this.messageIds,
  });
}

class MessageService {
  MessageService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<MessageThreadResult> fetchThread() async {
    final response = await _apiClient.getObject('/api/messages/thread');
    return MessageThreadResult(
      counterpartyId: response['counterpartyId']?.toString() ?? '',
      items: _parseItems(response['items']),
    );
  }

  Future<ChatMessage> sendThreadMessage(String messageBody) async {
    final response = await _apiClient.postJson(
      '/api/messages/thread',
      body: {'messageBody': messageBody},
    );

    return ChatMessage.fromJson(response);
  }

  Future<MessageReadResult> markThreadRead() async {
    final response = await _apiClient.patchJson('/api/messages/thread/read');
    return MessageReadResult(
      updatedCount: (response['updatedCount'] as num?)?.toInt() ?? 0,
      messageIds: ((response['messageIds'] as List<dynamic>?) ?? const [])
          .map((item) => item.toString())
          .where((item) => item.isNotEmpty)
          .toList(),
    );
  }

  Future<int> fetchUnreadCount() async {
    final response = await _apiClient.getObject('/api/messages/unread-count');
    return (response['unreadCount'] as num?)?.toInt() ?? 0;
  }

  List<ChatMessage> _parseItems(dynamic rawItems) {
    final items = rawItems as List<dynamic>? ?? const [];
    final parsedItems = <ChatMessage>[];

    for (final item in items) {
      if (item is Map<String, dynamic>) {
        parsedItems.add(ChatMessage.fromJson(item));
        continue;
      }

      if (item is Map) {
        parsedItems.add(
          ChatMessage.fromJson(
            item.map((key, value) => MapEntry(key.toString(), value)),
          ),
        );
      }
    }

    return parsedItems.where((item) => item.messageId.isNotEmpty).toList();
  }
}
