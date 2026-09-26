import 'dart:async';
import 'dart:collection';

import 'package:flutter/material.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_events.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';

enum _InAppBannerKind {
  notification,
  message,
}

class _InAppBannerItem {
  const _InAppBannerItem({
    required this.id,
    required this.kind,
    required this.title,
    required this.message,
    this.roomId,
  });

  final String id;
  final _InAppBannerKind kind;
  final String title;
  final String message;
  final String? roomId;
}

class InAppRealtimeBannerHost extends StatefulWidget {
  const InAppRealtimeBannerHost({
    super.key,
    required this.navigatorKey,
    required this.child,
  });

  final GlobalKey<NavigatorState> navigatorKey;
  final Widget child;

  @override
  State<InAppRealtimeBannerHost> createState() =>
      _InAppRealtimeBannerHostState();
}

class _InAppRealtimeBannerHostState extends State<InAppRealtimeBannerHost> {
  static const Duration _visibleDuration = Duration(seconds: 3);
  static const Duration _betweenBannerDelay = Duration(milliseconds: 180);
  static const int _maxQueuedBanners = 6;
  static const int _maxRememberedIds = 120;

  final Queue<_InAppBannerItem> _queue = Queue<_InAppBannerItem>();
  final Set<String> _seenIds = <String>{};
  final List<String> _seenIdOrder = <String>[];

  VoidCallback? _stopRealtimeListener;
  Timer? _dismissTimer;
  Timer? _nextBannerTimer;
  _InAppBannerItem? _activeItem;

  @override
  void initState() {
    super.initState();

    _stopRealtimeListener = MobileRealtimeService.instance.listenTo(
      const <String>{
        MobileRealtimeEvents.notificationNew,
        MobileRealtimeEvents.messageNew,
      },
      _handleRealtimeEvent,
    );
  }

  @override
  void dispose() {
    _stopRealtimeListener?.call();
    _dismissTimer?.cancel();
    _nextBannerTimer?.cancel();
    _queue.clear();
    super.dispose();
  }

  Future<void> _handleRealtimeEvent(MobileRealtimeEvent event) async {
    if (!mounted) return;

    final currentUserId = MobileRealtimeService.instance.userId.trim();
    if (currentUserId.isEmpty) return;

    if (event.name == MobileRealtimeEvents.notificationNew) {
      final item = _notificationItemFromEvent(event, currentUserId);
      if (item != null) _enqueue(item);
      return;
    }

    if (event.name == MobileRealtimeEvents.messageNew) {
      final item = _messageItemFromEvent(event, currentUserId);
      if (item != null) _enqueue(item);
    }
  }

  _InAppBannerItem? _notificationItemFromEvent(
    MobileRealtimeEvent event,
    String currentUserId,
  ) {
    final payload = _unwrapPayload(event.payload, 'notification');

    final targetUserId = _firstText(payload, const <String>[
      'user_id',
      'userId',
    ]);

    if (targetUserId.isNotEmpty && targetUserId != currentUserId) {
      return null;
    }

    final notificationId = _firstText(payload, const <String>[
      'notification_id',
      'notificationId',
      'id',
    ]);

    final title = _firstText(payload, const <String>[
      'title',
      'type',
    ]);

    final message = _firstText(payload, const <String>[
      'message',
      'body',
      'description',
    ]);

    if (title.isEmpty && message.isEmpty) return null;

    final id = notificationId.isNotEmpty
        ? 'notification:$notificationId'
        : 'notification:${event.receivedAt.microsecondsSinceEpoch}:$title:$message';

    return _InAppBannerItem(
      id: id,
      kind: _InAppBannerKind.notification,
      title: title.isEmpty ? 'New notification' : title,
      message: message.isEmpty ? 'You have a new SMaRT-PDM update.' : message,
    );
  }

  _InAppBannerItem? _messageItemFromEvent(
    MobileRealtimeEvent event,
    String currentUserId,
  ) {
    final payload = _unwrapPayload(event.payload, 'message');

    final senderId = _firstText(payload, const <String>[
      'sender_id',
      'senderId',
    ]);

    if (senderId.isNotEmpty && senderId == currentUserId) {
      return null;
    }

    final messageId = _firstText(payload, const <String>[
      'message_id',
      'messageId',
      'id',
    ]);

    final senderName = _firstText(payload, const <String>[
      'sender_name',
      'senderName',
    ]);

    final roomId = _firstText(payload, const <String>[
      'room_id',
      'roomId',
    ]);

    final messageBody = _firstText(payload, const <String>[
      'message_body',
      'messageBody',
      'message',
      'body',
    ]);

    final isUnsent = _readBool(payload, const <String>[
      'is_unsent',
      'isUnsent',
    ]);

    if (isUnsent) return null;

    final safeBody = messageBody.trim().isEmpty
        ? 'You received a new message.'
        : messageBody.trim();

    final id = messageId.isNotEmpty
        ? 'message:$messageId'
        : 'message:${event.receivedAt.microsecondsSinceEpoch}:$senderId:$safeBody';

    return _InAppBannerItem(
      id: id,
      kind: _InAppBannerKind.message,
      title: senderName.isEmpty ? 'New message' : senderName,
      message: safeBody,
      roomId: roomId.isEmpty ? null : roomId,
    );
  }

  void _enqueue(_InAppBannerItem item) {
    if (!_remember(item.id)) return;

    if (_activeItem == null) {
      _show(item);
      return;
    }

    if (_queue.length >= _maxQueuedBanners) {
      _queue.removeFirst();
    }

    _queue.addLast(item);
  }

  bool _remember(String id) {
    if (_seenIds.contains(id)) return false;

    _seenIds.add(id);
    _seenIdOrder.add(id);

    while (_seenIdOrder.length > _maxRememberedIds) {
      final oldest = _seenIdOrder.removeAt(0);
      _seenIds.remove(oldest);
    }

    return true;
  }

  void _show(_InAppBannerItem item) {
    _nextBannerTimer?.cancel();
    _dismissTimer?.cancel();

    if (!mounted) return;

    setState(() {
      _activeItem = item;
    });

    _dismissTimer = Timer(_visibleDuration, _dismissActive);
  }

  void _dismissActive() {
    _dismissTimer?.cancel();
    _dismissTimer = null;

    if (!mounted || _activeItem == null) return;

    setState(() {
      _activeItem = null;
    });

    _nextBannerTimer?.cancel();
    _nextBannerTimer = Timer(_betweenBannerDelay, () {
      if (!mounted || _activeItem != null || _queue.isEmpty) return;
      _show(_queue.removeFirst());
    });
  }

  void _handleTap(_InAppBannerItem item) {
    _dismissActive();

    final navigator = widget.navigatorKey.currentState;
    if (navigator == null) return;

    if (item.kind == _InAppBannerKind.message) {
      navigator.pushNamed(
        AppRoutes.chatThread,
        arguments: <String, dynamic>{
          if (item.roomId != null) 'roomId': item.roomId,
          'title': item.title,
        },
      );
      return;
    }

    navigator.pushNamed(AppRoutes.notifications);
  }

  static Map<String, dynamic> _unwrapPayload(
    Map<String, dynamic> payload,
    String nestedKey,
  ) {
    final nested = payload[nestedKey];

    if (nested is Map<String, dynamic>) {
      return nested;
    }

    if (nested is Map) {
      return nested.map(
        (key, value) => MapEntry(key.toString(), value),
      );
    }

    return payload;
  }

  static String _firstText(
    Map<String, dynamic> payload,
    List<String> keys,
  ) {
    for (final key in keys) {
      final value = payload[key];
      if (value == null) continue;

      final text = value.toString().trim();
      if (text.isNotEmpty) return text;
    }

    return '';
  }

  static bool _readBool(
    Map<String, dynamic> payload,
    List<String> keys,
  ) {
    for (final key in keys) {
      final value = payload[key];

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

  @override
  Widget build(BuildContext context) {
    final item = _activeItem;

    return Stack(
      fit: StackFit.expand,
      children: <Widget>[
        widget.child,
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            bottom: false,
            child: IgnorePointer(
              ignoring: item == null,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 220),
                  reverseDuration: const Duration(milliseconds: 170),
                  switchInCurve: Curves.easeOutCubic,
                  switchOutCurve: Curves.easeInCubic,
                  transitionBuilder: (child, animation) {
                    final slide = Tween<Offset>(
                      begin: const Offset(0, -0.30),
                      end: Offset.zero,
                    ).animate(
                      CurvedAnimation(
                        parent: animation,
                        curve: Curves.easeOutCubic,
                        reverseCurve: Curves.easeInCubic,
                      ),
                    );

                    return FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: slide,
                        child: child,
                      ),
                    );
                  },
                  child: item == null
                      ? const SizedBox.shrink(
                          key: ValueKey<String>('banner-empty'),
                        )
                      : _RealtimeBannerCard(
                          key: ValueKey<String>(item.id),
                          item: item,
                          onTap: () => _handleTap(item),
                          onDismiss: _dismissActive,
                        ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _RealtimeBannerCard extends StatelessWidget {
  const _RealtimeBannerCard({
    super.key,
    required this.item,
    required this.onTap,
    required this.onDismiss,
  });

  final _InAppBannerItem item;
  final VoidCallback onTap;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final isDark = theme.brightness == Brightness.dark;
    final isMessage = item.kind == _InAppBannerKind.message;

    final accent = isMessage ? scheme.secondary : scheme.primary;
    final background =
        isDark ? scheme.surfaceContainerHigh : scheme.surface;
    final borderColor = isDark
        ? scheme.outlineVariant.withValues(alpha: 0.85)
        : scheme.outlineVariant.withValues(alpha: 0.65);

    return Dismissible(
      key: ValueKey<String>('dismiss-${item.id}'),
      direction: DismissDirection.up,
      onDismissed: (_) => onDismiss(),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            constraints: const BoxConstraints(
              minHeight: 72,
              maxWidth: 620,
            ),
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: borderColor),
              boxShadow: <BoxShadow>[
                BoxShadow(
                  color: Colors.black.withValues(
                    alpha: isDark ? 0.28 : 0.12,
                  ),
                  blurRadius: 18,
                  offset: const Offset(0, 7),
                ),
              ],
            ),
            padding: const EdgeInsets.fromLTRB(12, 11, 8, 11),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: isDark ? 0.18 : 0.10),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    isMessage
                        ? Icons.chat_bubble_outline_rounded
                        : Icons.notifications_none_rounded,
                    size: 22,
                    color: accent,
                  ),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              item.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.titleSmall?.copyWith(
                                color: scheme.onSurface,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'NOW',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: scheme.onSurfaceVariant,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.6,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.message,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                          fontWeight: FontWeight.w500,
                          height: 1.28,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                Semantics(
                  button: true,
                  label: 'Dismiss notification',
                  child: IconButton(
                    onPressed: onDismiss,
                    visualDensity: VisualDensity.compact,
                    iconSize: 18,
                    color: scheme.onSurfaceVariant,
                    icon: const Icon(Icons.close_rounded),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
