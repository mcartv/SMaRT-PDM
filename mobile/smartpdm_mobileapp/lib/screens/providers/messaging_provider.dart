import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smartpdm_mobileapp/config/app_config.dart';
import 'package:smartpdm_mobileapp/services/session_service.dart';

// A simple model to represent a message
class ChatMessage {
  final String id;
  final String text;
  final bool isMe; // True if sent by the current user
  final DateTime timestamp;

  ChatMessage({
    required this.id,
    required this.text,
    required this.isMe,
    required this.timestamp,
  });
}

class MessagingProvider extends ChangeNotifier {
  final List<ChatMessage> _messages = [];
  int _unreadCount = 0;
  io.Socket? _socket;
  String? _currentRoom;
  String? _currentUserId;
  final SessionService _sessionService = const SessionService();

  List<ChatMessage> get messages => _messages;
  int get unreadCount => _unreadCount;

  // Initialize the user and connect to the socket
  Future<void> initializeChat() async {
    if (_socket != null && _socket!.connected) return; // Already connected

    final prefs = await SharedPreferences.getInstance();
    final studentId = prefs.getString('user_student_id');

    if (studentId != null) {
      _currentRoom = studentId;
      _currentUserId = studentId;

      await loadChatHistory(studentId, studentId);
      _connectSocket();
    }
  }

  void _connectSocket() {
    _sessionService.getCurrentUser().then((session) {
      _socket = io.io(AppConfig.apiBaseUrl, <String, dynamic>{
        'transports': ['websocket'],
        'autoConnect': false,
        'auth': {'token': session.token},
      });

      _socket!.connect();

      _socket!.onConnect((_) {
        debugPrint('Socket connected for user $_currentUserId');
        _socket!.emit('join_room', _currentRoom);
      });

      // Listen for incoming messages from the backend
      _socket!.on('receive_message', (data) {
        receiveMessage(data['text'] ?? '');
      });
    });
  }

  // Fetch chat history from the backend REST API
  Future<void> loadChatHistory(String room, String currentUserId) async {
    try {
      final url = Uri.parse('${AppConfig.apiBaseUrl}/api/messages/$room');
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        _messages.clear();

        for (var msg in data) {
          _messages.add(
            ChatMessage(
              id: msg['id']?.toString() ?? DateTime.now().toString(),
              text: msg['text'] ?? '',
              isMe: msg['sender_id'] == currentUserId,
              timestamp: msg['created_at'] != null
                  ? DateTime.parse(msg['created_at'])
                  : DateTime.now(),
            ),
          );
        }
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Error loading chat history: $e');
    }
  }

  void sendMessage(String text) {
    if (_currentRoom == null) return;

    _messages.insert(
      0,
      ChatMessage(
        id: DateTime.now().toString(),
        text: text,
        isMe: true,
        timestamp: DateTime.now(),
      ),
    );

    _socket?.emit('send_message', {
      'room': _currentRoom,
      'sender_id': _currentUserId,
      'text': text,
    });

    notifyListeners();
  }

  void clearUnread() {
    _unreadCount = 0;
    notifyListeners();
  }

  void receiveMessage(String text) {
    _messages.insert(
      0,
      ChatMessage(
        id: DateTime.now().toString(),
        text: text,
        isMe: false,
        timestamp: DateTime.now(),
      ),
    );

    _unreadCount++;
    notifyListeners();
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _socket?.dispose();
    super.dispose();
  }
}
