import 'package:smartpdm_mobileapp/core/networking/api_client.dart';

class MobileAnnouncement {
  const MobileAnnouncement({
    required this.announcementId,
    required this.title,
    required this.content,
    required this.audienceKey,
    required this.date,
  });

  final String announcementId;
  final String title;
  final String content;
  final String audienceKey;
  final DateTime date;

  factory MobileAnnouncement.fromJson(Map<String, dynamic> json) {
    return MobileAnnouncement(
      announcementId: json['announcementId']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Announcement',
      content: json['content']?.toString() ?? '',
      audienceKey: json['audienceKey']?.toString() ?? 'all',
      date:
          DateTime.tryParse(json['date']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}

class AnnouncementService {
  AnnouncementService({ApiClient? apiClient})
    : _apiClient = apiClient ?? ApiClient();

  final ApiClient _apiClient;

  Future<List<MobileAnnouncement>> fetchAnnouncements() async {
    final response = await _apiClient.getObject('/api/announcements');
    final items = response['items'] as List<dynamic>? ?? const [];

    return items
        .whereType<Map>()
        .map(
          (item) => MobileAnnouncement.fromJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .toList();
  }
}
