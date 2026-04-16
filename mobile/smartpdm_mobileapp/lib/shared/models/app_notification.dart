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
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  AppNotification copyWith({bool? isRead}) {
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

  factory AppNotification.fromLatestOpening(Map<String, dynamic> json) {
    final openingId = json['opening_id']?.toString() ?? '';
    final openingTitle =
        json['opening_title']?.toString().trim().isNotEmpty == true
        ? json['opening_title']!.toString().trim()
        : 'Scholarship Opening';
    final programName = json['program_name']?.toString().trim() ?? '';
    final body = json['announcement_text']?.toString().trim() ?? '';

    return AppNotification(
      notificationId: openingId.isNotEmpty
          ? 'latest-opening-$openingId'
          : 'latest-opening',
      userId: '',
      type: 'Opening',
      title: openingTitle,
      message: body.isNotEmpty
          ? body
          : programName.isNotEmpty
          ? 'A new scholarship opening is now available for $programName applicants.'
          : 'A new scholarship opening is now available for applicants.',
      referenceId: openingId.isNotEmpty ? openingId : null,
      referenceType: 'program_opening',
      isRead: true,
      pushSent: false,
      createdAt:
          DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  bool get isOfficeUpdate {
    final normalizedType = type.toLowerCase();
    final normalizedReference = (referenceType ?? '').toLowerCase();

    return normalizedReference == 'announcement' ||
        normalizedReference == 'program_opening' ||
        normalizedType == 'announcement' ||
        normalizedType == 'opening';
  }

  bool get isOpeningUpdate {
    final normalizedType = type.toLowerCase();
    final normalizedReference = (referenceType ?? '').toLowerCase();
    return normalizedReference == 'program_opening' ||
        normalizedType == 'opening';
  }

  bool get isPayoutNotification {
    final normalizedType = type.toLowerCase();
    final normalizedReference = (referenceType ?? '').toLowerCase();
    return normalizedType == 'payout_released' ||
        normalizedReference == 'payout_batch' ||
        title.toLowerCase().contains('payout');
  }

  String get officeUpdateLabel {
    if (isOpeningUpdate) {
      return 'SCHOLARSHIP OPENING';
    }

    return 'ANNOUNCEMENT';
  }

  String get previewText {
    if (message.trim().isEmpty) {
      return isOpeningUpdate
          ? 'A scholarship opening has been posted for applicants.'
          : 'A new office update has been posted.';
    }

    return message.trim();
  }

  IconData get icon {
    final normalizedType = type.toLowerCase();
    final normalizedReference = (referenceType ?? '').toLowerCase();

    if (normalizedReference == 'program_opening' ||
        normalizedType == 'opening') {
      return Icons.auto_awesome_motion_outlined;
    }

    if (normalizedReference == 'announcement' ||
        normalizedType == 'announcement') {
      return Icons.campaign_outlined;
    }

    if (isPayoutNotification) {
      return Icons.payments_outlined;
    }

    if (normalizedType.contains('interview')) {
      return Icons.calendar_today;
    }

    if (normalizedType.contains('warning') ||
        normalizedType.contains('action')) {
      return Icons.warning_amber_rounded;
    }

    if (normalizedType.contains('status') ||
        normalizedType.contains('update')) {
      return Icons.info_outline;
    }

    return Icons.notifications_outlined;
  }

  Color get accentColor {
    final normalizedType = type.toLowerCase();
    final normalizedReference = (referenceType ?? '').toLowerCase();

    if (normalizedReference == 'program_opening' ||
        normalizedType == 'opening') {
      return Colors.deepOrange;
    }

    if (normalizedReference == 'announcement' ||
        normalizedType == 'announcement') {
      return Colors.orange;
    }

    if (isPayoutNotification) {
      return Colors.green;
    }

    if (normalizedType.contains('interview')) {
      return Colors.green;
    }

    if (normalizedType.contains('warning') ||
        normalizedType.contains('action')) {
      return Colors.red;
    }

    return Colors.blue;
  }
}
