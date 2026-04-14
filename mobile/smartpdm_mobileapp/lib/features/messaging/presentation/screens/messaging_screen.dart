import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/shared/models/chat_message.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class MessagingScreen extends StatefulWidget {
  const MessagingScreen({super.key});

  @override
  State<MessagingScreen> createState() => _MessagingScreenState();
}

class _MessagingScreenState extends State<MessagingScreen> {
  final TextEditingController _messageController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _messageController.addListener(_onTextChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<MessagingProvider>().enterThread();
    });
  }

  void _onTextChanged() {
    setState(() {});
  }

  @override
  void dispose() {
    _messageController.removeListener(_onTextChanged);
    _messageController.dispose();
    if (mounted) {
      context.read<MessagingProvider>().leaveThread();
    }
    super.dispose();
  }

  Future<void> _sendMessage() async {
    if (_messageController.text.trim().isEmpty) return;

    final messageText = _messageController.text.trim();

    try {
      await context.read<MessagingProvider>().sendMessage(messageText);
      _messageController.clear();
    } catch (_) {
      if (!mounted) return;
      final message =
          context.read<MessagingProvider>().errorMessage ??
          'Failed to send message.';
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagingProvider>();
    final messages = provider.messages;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => AppNavigator.goBackOrHome(context),
        ),
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text(
              'John Smith',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w500),
            ),
            Text(
              'Active now',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.normal,
                color: Colors.white70,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(icon: const Icon(Icons.videocam), onPressed: () {}),
          IconButton(icon: const Icon(Icons.call), onPressed: () {}),
          IconButton(icon: const Icon(Icons.info), onPressed: () {}),
        ],
      ),
      selectedIndex: 0,
      showBottomNav: false,
      applyPadding: false,
      child: Column(
        children: [
          Expanded(
            child: provider.isLoading && messages.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : provider.errorMessage != null && messages.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Text(
                        provider.errorMessage!,
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                : ListView.builder(
                    reverse: true,
                    padding: const EdgeInsets.all(16),
                    itemCount: messages.length,
                    itemBuilder: (context, index) {
                      final msg = messages[index];
                      final isMe = msg.senderId == provider.currentUserId;
                      return Column(
                        children: [
                          if (index == messages.length - 1)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              child: Text(
                                '9:24 PM',
                                style: TextStyle(
                                  color: Colors.grey.shade500,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          _buildMessageBubble(msg, isMe: isMe),
                        ],
                      );
                    },
                  ),
          ),
          _buildMessageInput(),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage message, {required bool isMe}) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Row(
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe)
            Padding(
              padding: const EdgeInsets.only(right: 8.0, bottom: 12),
              child: CircleAvatar(
                radius: 16,
                backgroundColor: Colors.grey.shade300,
                child: const Icon(Icons.person, color: Colors.white, size: 20),
              ),
            ),
          Flexible(
            child: Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: isMe ? primaryColor : Colors.grey.shade200,
                borderRadius: BorderRadius.circular(20).copyWith(
                  bottomRight: isMe ? const Radius.circular(0) : null,
                  bottomLeft: !isMe ? const Radius.circular(0) : null,
                ),
              ),
              child: Text(
                message.messageBody,
                style: TextStyle(
                  color: isMe ? Colors.white : Colors.black87,
                  fontSize: 16,
                ),
              ),
            ),
          ),
          if (isMe)
            Padding(
              padding: const EdgeInsets.only(left: 4.0, bottom: 12),
              child: Container(
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.check_circle,
                  size: 14,
                  color: primaryColor,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMessageInput() {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Divider(height: 1, color: Colors.grey.shade300),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                IconButton(
                  icon: const Icon(Icons.format_size),
                  color: Colors.grey.shade600,
                  onPressed: () {},
                ),
                IconButton(
                  icon: const Icon(Icons.image),
                  color: Colors.grey.shade600,
                  onPressed: () {},
                ),
                IconButton(
                  icon: const Icon(Icons.camera_alt),
                  color: Colors.grey.shade600,
                  onPressed: () {},
                ),
                IconButton(
                  icon: const Icon(Icons.sentiment_satisfied_alt),
                  color: Colors.grey.shade600,
                  onPressed: () {},
                ),
                IconButton(
                  icon: const Icon(Icons.mic),
                  color: Colors.grey.shade600,
                  onPressed: () {},
                ),
                IconButton(
                  icon: const Icon(Icons.attach_file),
                  color: Colors.grey.shade600,
                  onPressed: () {},
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 16.0, right: 8.0, bottom: 8.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      hintText: 'Write a message...',
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
                IconButton(
                  icon: Icon(
                    _messageController.text.trim().isEmpty
                        ? Icons.thumb_up
                        : Icons.send,
                  ),
                  color: primaryColor,
                  onPressed: () {
                    if (_messageController.text.trim().isEmpty) {
                      // Handle thumb up behavior
                    } else {
                      _sendMessage();
                    }
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
