import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_events.dart';

typedef MobileRealtimeCallback =
    FutureOr<void> Function(MobileRealtimeEvent event);

class MobileRealtimeEvent {
  final String name;
  final Map<String, dynamic> payload;
  final DateTime receivedAt;

  const MobileRealtimeEvent({
    required this.name,
    required this.payload,
    required this.receivedAt,
  });

  String get referenceId {
    return payload['reference_id']?.toString() ??
        payload['referenceId']?.toString() ??
        payload['announcement_id']?.toString() ??
        payload['announcementId']?.toString() ??
        payload['opening_id']?.toString() ??
        payload['openingId']?.toString() ??
        payload['application_id']?.toString() ??
        payload['applicationId']?.toString() ??
        payload['ro_id']?.toString() ??
        payload['roId']?.toString() ??
        payload['payout_batch_id']?.toString() ??
        payload['payoutBatchId']?.toString() ??
        payload['notification_id']?.toString() ??
        payload['notificationId']?.toString() ??
        payload['message_id']?.toString() ??
        payload['messageId']?.toString() ??
        '';
  }

  @override
  String toString() {
    return 'MobileRealtimeEvent(name: $name, payload: $payload)';
  }
}

class _RealtimeSubscription {
  final Set<String> eventNames;
  final MobileRealtimeCallback callback;

  const _RealtimeSubscription({
    required this.eventNames,
    required this.callback,
  });
}

class MobileRealtimeService extends ChangeNotifier {
  MobileRealtimeService._internal();

  static final MobileRealtimeService instance =
      MobileRealtimeService._internal();

  IO.Socket? _socket;

  final StreamController<MobileRealtimeEvent> _eventController =
      StreamController<MobileRealtimeEvent>.broadcast();

  final Map<String, _RealtimeSubscription> _subscriptions = {};

  String _socketBaseUrl = '';
  String _token = '';
  String _userId = '';
  bool _isConnecting = false;
  bool _isConnected = false;
  int _revision = 0;
  MobileRealtimeEvent? _lastEvent;

  Stream<MobileRealtimeEvent> get events => _eventController.stream;

  bool get isConnected => _isConnected;
  bool get isConnecting => _isConnecting;
  int get revision => _revision;
  String get socketBaseUrl => _socketBaseUrl;
  String get userId => _userId;
  MobileRealtimeEvent? get lastEvent => _lastEvent;

  static final Set<String> defaultEventNames = MobileRealtimeEvents.all;

  Future<void> connectFromPrefs({
    required String backendBaseUrl,
    bool forceReconnect = false,
  }) async {
    final prefs = await SharedPreferences.getInstance();

    final token = _firstNonEmpty([
      prefs.getString('token'),
      prefs.getString('auth_token'),
      prefs.getString('access_token'),
      prefs.getString('studentToken'),
      prefs.getString('student_token'),
      prefs.getString('mobileToken'),
      prefs.getString('mobile_token'),
      prefs.getString('user_token'),
      prefs.getString('jwt'),
    ]);

    final userId = _firstNonEmpty([
      prefs.getString('user_id'),
      prefs.getString('userId'),
      prefs.getString('student_user_id'),
      prefs.getString('auth_user_id'),
      _userIdFromJwt(token),
    ]);

    await connect(
      backendBaseUrl: backendBaseUrl,
      token: token,
      userId: userId,
      forceReconnect: forceReconnect,
    );
  }

  Future<void> connect({
    required String backendBaseUrl,
    String? token,
    String? userId,
    bool forceReconnect = false,
  }) async {
    final nextBaseUrl = _normalizeSocketBaseUrl(backendBaseUrl);
    final nextToken = token?.trim() ?? '';
    final nextUserId = userId?.trim() ?? '';

    if (nextBaseUrl.isEmpty) {
      debugPrint('[Realtime] Missing backendBaseUrl.');
      return;
    }

    if (_isConnected &&
        !forceReconnect &&
        _socketBaseUrl == nextBaseUrl &&
        _token == nextToken &&
        _userId == nextUserId) {
      return;
    }

    if (_isConnecting && !forceReconnect) {
      return;
    }

    _isConnecting = true;
    notifyListeners();

    await disconnect(silent: true);

    _socketBaseUrl = nextBaseUrl;
    _token = nextToken;
    _userId = nextUserId;

    final options = <String, dynamic>{
      'transports': ['websocket', 'polling'],
      'autoConnect': false,
      'reconnection': true,
      'reconnectionAttempts': 999999,
      'reconnectionDelay': 1000,
      'reconnectionDelayMax': 5000,
      'forceNew': true,
      if (_token.isNotEmpty) 'auth': {'token': _token},
      if (_token.isNotEmpty) 'query': {'token': _token},
      if (_token.isNotEmpty)
        'extraHeaders': {'Authorization': 'Bearer $_token'},
    };

    final socket = IO.io(_socketBaseUrl, options);
    _socket = socket;

    _registerCoreHandlers(socket);
    _registerAppEventHandlers(socket);

    socket.connect();
  }

  Future<void> disconnect({bool silent = false}) async {
    final socket = _socket;

    if (socket != null) {
      try {
        socket.clearListeners();
        socket.disconnect();
        socket.dispose();
      } catch (error) {
        debugPrint('[Realtime] Disconnect error: $error');
      }
    }

    _socket = null;
    _isConnected = false;
    _isConnecting = false;

    if (!silent) notifyListeners();
  }

  void reconnect() {
    final socket = _socket;
    if (socket == null) return;

    try {
      socket.disconnect();
      socket.connect();
    } catch (error) {
      debugPrint('[Realtime] Reconnect error: $error');
    }
  }

  void emitClientEvent(String eventName, [Map<String, dynamic>? payload]) {
    final socket = _socket;
    if (socket == null || !_isConnected) return;

    socket.emit(eventName, payload ?? {});
  }

  VoidCallback listenTo(
    Iterable<String> eventNames,
    MobileRealtimeCallback callback,
  ) {
    final normalized = eventNames
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toSet();

    final id =
        '${DateTime.now().microsecondsSinceEpoch}-${_subscriptions.length}';

    _subscriptions[id] = _RealtimeSubscription(
      eventNames: normalized,
      callback: callback,
    );

    return () {
      _subscriptions.remove(id);
    };
  }

  VoidCallback listenToAll(MobileRealtimeCallback callback) {
    return listenTo(defaultEventNames, callback);
  }

  void _registerCoreHandlers(IO.Socket socket) {
    socket.onConnect((_) {
      _isConnected = true;
      _isConnecting = false;

      debugPrint('[Realtime] Connected: ${socket.id}');
      _joinUserRoom();

      _emitLocalEvent('socket:connected', {
        'socket_id': socket.id,
        'user_id': _userId,
      });

      notifyListeners();
    });

    socket.onDisconnect((reason) {
      _isConnected = false;
      _isConnecting = false;

      debugPrint('[Realtime] Disconnected: $reason');

      _emitLocalEvent('socket:disconnected', {
        'reason': reason?.toString() ?? '',
      });

      notifyListeners();
    });

    socket.onConnectError((error) {
      _isConnected = false;
      _isConnecting = false;

      debugPrint('[Realtime] Connect error: $error');

      _emitLocalEvent('socket:error', {
        'error': error?.toString() ?? 'Connection error',
      });

      notifyListeners();
    });

    socket.onError((error) {
      debugPrint('[Realtime] Socket error: $error');

      _emitLocalEvent('socket:error', {
        'error': error?.toString() ?? 'Socket error',
      });
    });

    socket.onReconnect((attempt) {
      debugPrint('[Realtime] Reconnected after attempt: $attempt');
      _joinUserRoom();

      _emitLocalEvent('socket:reconnected', {
        'attempt': attempt?.toString() ?? '',
      });
    });
  }

  void _registerAppEventHandlers(IO.Socket socket) {
    for (final eventName in defaultEventNames) {
      socket.on(eventName, (data) {
        _handleServerEvent(eventName, data);
      });
    }
  }

  void _joinUserRoom() {
    final socket = _socket;
    if (socket == null) return;

    if (_token.isNotEmpty) {
      socket.emit('user-join', {'token': _token, 'user_id': _userId});
    }

    if (_userId.isNotEmpty) {
      socket.emit('user-join', _userId);
    }
  }

  void _handleServerEvent(String eventName, dynamic data) {
    final event = MobileRealtimeEvent(
      name: eventName,
      payload: _payloadToMap(data),
      receivedAt: DateTime.now(),
    );

    debugPrint('[Realtime] $event');

    _lastEvent = event;
    _revision += 1;

    if (!_eventController.isClosed) {
      _eventController.add(event);
    }

    final subscriptions = List<_RealtimeSubscription>.from(
      _subscriptions.values,
    );

    for (final subscription in subscriptions) {
      if (!subscription.eventNames.contains(eventName)) continue;

      Future<void>.microtask(() async {
        try {
          await subscription.callback(event);
        } catch (error) {
          debugPrint('[Realtime] Listener error for $eventName: $error');
        }
      });
    }

    notifyListeners();
  }

  void _emitLocalEvent(String eventName, Map<String, dynamic> payload) {
    final event = MobileRealtimeEvent(
      name: eventName,
      payload: payload,
      receivedAt: DateTime.now(),
    );

    _lastEvent = event;
    _revision += 1;

    if (!_eventController.isClosed) {
      _eventController.add(event);
    }
  }

  static Map<String, dynamic> _payloadToMap(dynamic data) {
    if (data == null) return {};

    if (data is Map<String, dynamic>) {
      return Map<String, dynamic>.from(data);
    }

    if (data is Map) {
      return data.map((key, value) => MapEntry(key.toString(), value));
    }

    if (data is List) {
      return {'items': data};
    }

    if (data is String) {
      final text = data.trim();

      if (text.isEmpty) return {};

      try {
        final decoded = jsonDecode(text);

        if (decoded is Map<String, dynamic>) {
          return decoded;
        }

        if (decoded is Map) {
          return decoded.map((key, value) => MapEntry(key.toString(), value));
        }

        if (decoded is List) {
          return {'items': decoded};
        }
      } catch (_) {
        return {'value': text};
      }
    }

    return {'value': data.toString()};
  }

  static String _normalizeSocketBaseUrl(String value) {
    var url = value.trim();

    if (url.isEmpty) return '';

    while (url.endsWith('/')) {
      url = url.substring(0, url.length - 1);
    }

    if (url.endsWith('/api')) {
      url = url.substring(0, url.length - 4);
    }

    return url;
  }

  static String _firstNonEmpty(List<String?> values) {
    for (final value in values) {
      final text = value?.trim() ?? '';
      if (text.isNotEmpty) return text;
    }

    return '';
  }

  static String _userIdFromJwt(String token) {
    try {
      final parts = token.split('.');
      if (parts.length < 2) return '';

      final normalized = base64Url.normalize(parts[1]);
      final decoded = utf8.decode(base64Url.decode(normalized));
      final payload = jsonDecode(decoded);

      if (payload is! Map) return '';

      return payload['user_id']?.toString() ??
          payload['userId']?.toString() ??
          payload['sub']?.toString() ??
          payload['id']?.toString() ??
          '';
    } catch (_) {
      return '';
    }
  }

  @override
  void dispose() {
    disconnect(silent: true);
    _eventController.close();
    _subscriptions.clear();
    super.dispose();
  }
}
