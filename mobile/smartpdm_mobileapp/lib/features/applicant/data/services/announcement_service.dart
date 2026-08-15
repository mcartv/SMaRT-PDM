import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';

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
      date: DateTime.tryParse(json['date']?.toString() ?? '') ?? DateTime.now(),
    );
  }

  AppNotification toNotification() {
    final id = announcementId.trim();

    return AppNotification(
      notificationId: id.isEmpty
          ? 'announcement-${date.microsecondsSinceEpoch}'
          : 'announcement-$id',
      userId: '',
      type: 'Announcement',
      title: title.trim().isEmpty ? 'Announcement' : title.trim(),
      message: content.trim(),
      referenceId: id.isEmpty ? null : id,
      referenceType: 'announcement',
      isRead: true,
      pushSent: false,
      createdAt: date,
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

    final now = DateTime.now();

    final announcements = items
        .whereType<Map>()
        .map(
          (item) =>
              MobileAnnouncement.fromJson(Map<String, dynamic>.from(item)),
        )
        // Defensive client-side guard: a scheduled item with a future
        // publication date must not appear early even if the API returns it.
        .where((item) => !item.date.toLocal().isAfter(now))
        .toList(growable: false);

    final sorted = List<MobileAnnouncement>.from(announcements)
      ..sort((a, b) => b.date.compareTo(a.date));

    return sorted;
  }
}
