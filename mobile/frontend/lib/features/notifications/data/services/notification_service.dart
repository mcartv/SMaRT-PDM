import 'package:flutter/foundation.dart';

import 'package:smartpdm_mobileapp/core/networking/api_client.dart';
import 'package:smartpdm_mobileapp/core/storage/session_service.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';

class NotificationListResult {
  final List<AppNotification> items;
  final int total;
  final int limit;
  final int offset;

  const NotificationListResult({
    required this.items,
    required this.total,
    required this.limit,
    required this.offset,
  });
}

class NotificationService {
  NotificationService({ApiClient? apiClient, SessionService? sessionService})
    : _apiClient = apiClient ?? ApiClient(),
      _sessionService = sessionService ?? const SessionService();

  final ApiClient _apiClient;
  final SessionService _sessionService;

  Future<NotificationListResult> fetchNotifications({
    int limit = 50,
    int offset = 0,
  }) async {
    final response = await _apiClient.getObject(
      '/api/notifications?limit=$limit&offset=$offset',
    );

    final rawItems =
        response['items'] ??
        response['notifications'] ??
        response['data'] ??
        const <dynamic>[];

    final items = rawItems is List
        ? rawItems
              .map((item) {
                if (item is Map<String, dynamic>) {
                  return item;
                }

                if (item is Map) {
                  return item.map(
                    (key, value) => MapEntry(key.toString(), value),
                  );
                }

                return <String, dynamic>{};
              })
              .where((item) => item.isNotEmpty)
              .map(AppNotification.fromJson)
              .toList(growable: false)
        : <AppNotification>[];

    return NotificationListResult(
      items: items,
      total: (response['total'] as num?)?.toInt() ?? items.length,
      limit: (response['limit'] as num?)?.toInt() ?? limit,
      offset: (response['offset'] as num?)?.toInt() ?? offset,
    );
  }

  Future<int> fetchUnreadCount() async {
    try {
      final response = await _apiClient.getObject(
        '/api/notifications/unread-count',
      );

      final rawCount = response['unreadCount'] ?? response['count'] ?? 0;

      if (rawCount is int) {
        return rawCount < 0 ? 0 : rawCount;
      }

      if (rawCount is num) {
        final parsed = rawCount.toInt();
        return parsed < 0 ? 0 : parsed;
      }

      final parsed = int.tryParse(rawCount.toString()) ?? 0;
      return parsed < 0 ? 0 : parsed;
    } catch (_) {
      final result = await fetchNotifications();
      return result.items.where((item) => !item.isRead).length;
    }
  }

  Future<AppNotification> markAsRead(String notificationId) async {
    final response = await _apiClient.patchJson(
      '/api/notifications/$notificationId/read',
      body: <String, dynamic>{},
    );

    final notification = response['notification'];

    if (notification is Map<String, dynamic>) {
      return AppNotification.fromJson(notification);
    }

    if (notification is Map) {
      return AppNotification.fromJson(
        notification.map((key, value) => MapEntry(key.toString(), value)),
      );
    }

    return AppNotification.fromJson(response);
  }

  Future<int> markAllAsRead() async {
    try {
      await _apiClient.patchJson(
        '/api/notifications/read-all',
        body: <String, dynamic>{},
      );
    } catch (_) {
      await _apiClient.patchJson(
        '/api/notifications/me/read-all',
        body: <String, dynamic>{},
      );
    }

    return 0;
  }

  Future<void> deleteNotification(String notificationId) async {
    await _apiClient.deleteJson('/api/notifications/$notificationId');
  }

  Future<void> registerStoredDeviceToken() async {
    final stored = await _sessionService.getPushDeviceToken();

    final token = stored['token'];
    final platform =
        stored['platform'] ?? (kIsWeb ? 'web' : defaultTargetPlatform.name);

    if (token == null || token.trim().isEmpty) return;

    await _apiClient.postJson(
      '/api/notifications/device-token',
      body: <String, dynamic>{'deviceToken': token, 'platform': platform},
    );
  }
}
