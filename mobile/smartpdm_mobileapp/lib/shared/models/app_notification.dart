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

  static String _pickString(Map<String, dynamic> json, List<String> keys) {
    for (final key in keys) {
      final value = json[key];

      if (value == null) continue;

      final text = value.toString().trim();

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

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    final parsedType = _pickString(json, [
      'type',
      'notificationType',
      'notification_type',
    ]);

    final parsedTitle = _pickString(json, [
      'title',
      'notificationTitle',
      'notification_title',
    ]);

    return AppNotification(
      notificationId: _pickString(json, [
        'notificationId',
        'notification_id',
        'id',
      ]),
      userId: _pickString(json, ['userId', 'user_id']),
      type: parsedType.isEmpty ? 'Notification' : parsedType,
      title: parsedTitle.isEmpty ? 'Notification' : parsedTitle,
      message: _pickString(json, ['message', 'body', 'content', 'description']),
      referenceId: _pickNullableString(json, [
        'referenceId',
        'reference_id',
        'roId',
        'ro_id',
        'applicationId',
        'application_id',
        'openingId',
        'opening_id',
        'payoutBatchId',
        'payout_batch_id',
      ]),
      referenceType: _pickNullableString(json, [
        'referenceType',
        'reference_type',
      ]),
      isRead: _pickBool(json, ['isRead', 'is_read', 'read']),
      pushSent: _pickBool(json, ['pushSent', 'push_sent']),
      createdAt:
          DateTime.tryParse(
            _pickString(json, ['createdAt', 'created_at', 'date', 'timestamp']),
          ) ??
          DateTime.now(),
    );
  }

  AppNotification copyWith({
    String? notificationId,
    String? userId,
    String? type,
    String? title,
    String? message,
    String? referenceId,
    String? referenceType,
    bool? isRead,
    bool? pushSent,
    DateTime? createdAt,
  }) {
    return AppNotification(
      notificationId: notificationId ?? this.notificationId,
      userId: userId ?? this.userId,
      type: type ?? this.type,
      title: title ?? this.title,
      message: message ?? this.message,
      referenceId: referenceId ?? this.referenceId,
      referenceType: referenceType ?? this.referenceType,
      isRead: isRead ?? this.isRead,
      pushSent: pushSent ?? this.pushSent,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  factory AppNotification.fromLatestOpening(Map<String, dynamic> json) {
    final openingId = json['opening_id']?.toString() ?? '';

    final openingTitle =
        json['opening_title']?.toString().trim().isNotEmpty == true
        ? json['opening_title']!.toString().trim()
        : 'Scholarship';

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
          ? 'A new scholarship is now available for $programName applicants.'
          : 'A new scholarship is now available for applicants.',
      referenceId: openingId.isNotEmpty ? openingId : null,
      referenceType: 'program_opening',
      isRead: true,
      pushSent: false,
      createdAt:
          DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  String get normalizedType => type.trim().toLowerCase();

  String get normalizedTitle => title.trim().toLowerCase();

  String get normalizedMessage => message.trim().toLowerCase();

  String get normalizedReferenceType =>
      (referenceType ?? '').trim().toLowerCase();

  bool get isOfficeUpdate {
    return normalizedReferenceType == 'announcement' ||
        normalizedReferenceType == 'program_opening' ||
        normalizedType == 'announcement' ||
        normalizedType == 'opening';
  }

  bool get isOpeningUpdate {
    return normalizedReferenceType == 'program_opening' ||
        normalizedType == 'opening';
  }

  bool get isAnnouncementNotification {
    return normalizedReferenceType == 'announcement' ||
        normalizedType == 'announcement';
  }

  bool get isPayoutNotification {
    return normalizedType == 'payout_released' ||
        normalizedType == 'payout_scheduled' ||
        normalizedType.contains('payout') ||
        normalizedReferenceType == 'payout_batch' ||
        normalizedTitle.contains('payout');
  }

  bool get isRoNotification {
    return normalizedReferenceType == 'return_of_obligation' ||
        normalizedReferenceType == 'return-of-obligation' ||
        normalizedReferenceType == 'ro' ||
        normalizedType == 'ro_assignment' ||
        normalizedType == 'return_of_obligation' ||
        normalizedType == 'return-of-obligation' ||
        normalizedType.contains('ro_') ||
        normalizedType.contains('return') ||
        normalizedType.contains('obligation') ||
        normalizedTitle.contains('return of obligation') ||
        normalizedTitle.contains('obligation');
  }

  bool get isApplicationNotification {
    return normalizedReferenceType == 'application' ||
        normalizedType.contains('application') ||
        normalizedTitle.contains('application');
  }

  bool get isDocumentNotification {
    return normalizedReferenceType == 'application_document' ||
        normalizedType.contains('document') ||
        normalizedTitle.contains('document');
  }

  String get officeUpdateLabel {
    if (isOpeningUpdate) return 'SCHOLARSHIP';
    return 'ANNOUNCEMENT';
  }

  String get badgeLabel {
    if (isRoNotification) return 'RO ASSIGNMENT';

    if (isPayoutNotification) {
      if (normalizedType.contains('scheduled')) return 'PAYOUT SCHEDULED';
      if (normalizedType.contains('released')) return 'PAYOUT RELEASED';
      return 'PAYOUT';
    }

    if (isOpeningUpdate) return 'SCHOLARSHIP';
    if (isAnnouncementNotification) return 'ANNOUNCEMENT';
    if (isApplicationNotification) return 'APPLICATION';
    if (isDocumentNotification) return 'DOCUMENT';

    return type.trim().isEmpty ? 'NOTIFICATION' : type.trim().toUpperCase();
  }

  String get previewText {
    final trimmedMessage = message.trim();

    if (trimmedMessage.isNotEmpty) return trimmedMessage;

    if (isRoNotification) {
      return 'You have a Return of Obligation update.';
    }

    if (isOpeningUpdate) {
      return 'A scholarship has been posted for applicants.';
    }

    if (isPayoutNotification) {
      return 'Your scholarship payout has an update.';
    }

    if (isAnnouncementNotification) {
      return 'A new office update has been posted.';
    }

    return 'You have a new notification.';
  }

  IconData get icon {
    if (isRoNotification) {
      return Icons.assignment_turned_in_outlined;
    }

    if (isPayoutNotification) {
      return Icons.payments_outlined;
    }

    if (isOpeningUpdate) {
      return Icons.auto_awesome_motion_outlined;
    }

    if (isAnnouncementNotification) {
      return Icons.campaign_outlined;
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
    if (isRoNotification) {
      return Colors.amber;
    }

    if (isPayoutNotification) {
      return Colors.green;
    }

    if (isOpeningUpdate) {
      return Colors.deepOrange;
    }

    if (isAnnouncementNotification) {
      return Colors.orange;
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
