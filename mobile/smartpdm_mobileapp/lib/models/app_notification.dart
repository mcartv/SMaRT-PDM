import 'package:flutter/material.dart';

class AppNotification {
  final String notificationId;
  final String userId;
  final String type;
  final String title;
  final String message;
  final String? referenceId;
  final String? referenceType;
  final bool isRead;
  final bool pushSent;
  final DateTime createdAt;

  const AppNotification({
    required this.notificationId,
    required this.userId,
    required this.type,
    required this.title,
    required this.message,
    required this.referenceId,
    required this.referenceType,
    required this.isRead,
    required this.pushSent,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      notificationId: json['notificationId']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      type: json['type']?.toString() ?? 'Notification',
      title: json['title']?.toString() ?? 'Notification',
      message: json['message']?.toString() ?? '',
      referenceId: json['referenceId']?.toString(),
      referenceType: json['referenceType']?.toString(),
      isRead: json['isRead'] == true,
      pushSent: json['pushSent'] == true,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  AppNotification copyWith({
    bool? isRead,
  }) {
    return AppNotification(
      notificationId: notificationId,
      userId: userId,
      type: type,
      title: title,
      message: message,
      referenceId: referenceId,
      referenceType: referenceType,
      isRead: isRead ?? this.isRead,
      pushSent: pushSent,
      createdAt: createdAt,
    );
  }

  IconData get icon {
    final normalizedType = type.toLowerCase();
    final normalizedReference = (referenceType ?? '').toLowerCase();

    if (normalizedReference == 'announcement' || normalizedType == 'announcement') {
      return Icons.campaign_outlined;
    }

    if (normalizedType.contains('interview')) {
      return Icons.calendar_today;
    }

    if (normalizedType.contains('warning') || normalizedType.contains('action')) {
      return Icons.warning_amber_rounded;
    }

    if (normalizedType.contains('status') || normalizedType.contains('update')) {
      return Icons.info_outline;
    }

    return Icons.notifications_outlined;
  }

  Color get accentColor {
    final normalizedType = type.toLowerCase();
    final normalizedReference = (referenceType ?? '').toLowerCase();

    if (normalizedReference == 'announcement' || normalizedType == 'announcement') {
      return Colors.orange;
    }

    if (normalizedType.contains('interview')) {
      return Colors.green;
    }

    if (normalizedType.contains('warning') || normalizedType.contains('action')) {
      return Colors.red;
    }

    return Colors.blue;
  }
}
