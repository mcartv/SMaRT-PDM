import 'package:flutter/material.dart';

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
  int _unreadCount = 3; // Initial mock count

  List<ChatMessage> get messages => _messages;
  int get unreadCount => _unreadCount;

  void sendMessage(String text) {
    _messages.insert(0, ChatMessage(
      id: DateTime.now().toString(),
      text: text,
      isMe: true,
      timestamp: DateTime.now(),
    ));
    
    // TODO: Actually send message to your backend here
    notifyListeners();
  }

  void clearUnread() {
    _unreadCount = 0;
    notifyListeners();
  }
  
  // Simulates receiving a message from a WebSocket/backend listener
  void receiveMessage(String text) {
    _messages.insert(0, ChatMessage(
      id: DateTime.now().toString(),
      text: text,
      isMe: false,
      timestamp: DateTime.now(),
    ));
    
    _unreadCount++;
    notifyListeners();
  }
}