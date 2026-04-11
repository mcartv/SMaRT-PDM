import 'package:smartpdm_mobileapp/models/support_ticket.dart';
import 'package:smartpdm_mobileapp/services/api_client.dart';

class SupportTicketService {
  SupportTicketService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<List<SupportTicket>> fetchMyTickets() async {
    final response = await _apiClient.getObject('/api/support-tickets/me');
    final items = (response['items'] as List<dynamic>? ?? const []);

    return items
        .map((item) {
          if (item is Map<String, dynamic>) return item;
          if (item is Map) {
            return item.map((key, value) => MapEntry(key.toString(), value));
          }
          return <String, dynamic>{};
        })
        .where((item) => item.isNotEmpty)
        .map(SupportTicket.fromJson)
        .where((ticket) => ticket.ticketId.isNotEmpty)
        .toList();
  }

  Future<SupportTicket> createTicket({
    required String issueCategory,
    required String description,
  }) async {
    final response = await _apiClient.postJson(
      '/api/support-tickets',
      body: {
        'issue_category': issueCategory.trim(),
        'description': description.trim(),
      },
    );

    final payload = (response['data'] as Map<String, dynamic>?) ?? {};
    return SupportTicket.fromJson(payload);
  }
}
