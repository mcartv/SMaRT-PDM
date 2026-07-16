import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_events.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/chat_message.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

const Color _messagingAccentColor = Color(0xFFF6B60C);

class MessagingScreen extends StatefulWidget {
  final String? roomId;
  final String? title;

  const MessagingScreen({super.key, this.roomId, this.title});

  @override
  State<MessagingScreen> createState() => _MessagingScreenState();
}

class _MessagingScreenState extends State<MessagingScreen> {
  final TextEditingController _messageController = TextEditingController();

  MessagingProvider? _messagingProvider;
  VoidCallback? _stopRealtimeListener;
  Timer? _realtimeDebounce;
  Timer? _liveRefreshTimer;

  bool _isRefreshingThread = false;

  bool get _isGroupChat =>
      widget.roomId != null && widget.roomId!.trim().isNotEmpty;

  String? get _normalizedRoomId {
    final value = widget.roomId?.trim();
    if (value == null || value.isEmpty) {
      return null;
    }
    return value;
  }

  @override
  void initState() {
    super.initState();

    _messageController.addListener(_onTextChanged);

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;

      final provider = context.read<MessagingProvider>();
      _messagingProvider = provider;

      await _openCurrentThread();

      if (!mounted) return;

      _attachRealtimeListener();
      _startLiveRefreshFallback();
    });
  }

  @override
  void dispose() {
    _realtimeDebounce?.cancel();
    _realtimeDebounce = null;

    _liveRefreshTimer?.cancel();
    _liveRefreshTimer = null;

    _stopRealtimeListener?.call();
    _stopRealtimeListener = null;

    _messageController.removeListener(_onTextChanged);
    _messageController.dispose();

    _messagingProvider?.leaveThread(notify: false);
    _messagingProvider = null;

    super.dispose();
  }

  void _onTextChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _attachRealtimeListener() {
    _stopRealtimeListener ??= MobileRealtimeService.instance.listenTo(
      MobileRealtimeEvents.messageEvents,
      (event) {
        debugPrint('[MessagingScreen] realtime received: ${event.name}');

        switch (event.name) {
          case MobileRealtimeEvents.messageNew:
          case MobileRealtimeEvents.messageCreated:
          case MobileRealtimeEvents.messageUpdated:
          case MobileRealtimeEvents.messageRead:
          case MobileRealtimeEvents.messageUnread:
            _scheduleThreadReload();
            return;

          default:
            return;
        }
      },
    );
  }

  void _scheduleThreadReload() {
    _realtimeDebounce?.cancel();

    _realtimeDebounce = Timer(const Duration(milliseconds: 150), () {
      _reloadOpenThread();
    });
  }

  void _startLiveRefreshFallback() {
    _liveRefreshTimer?.cancel();

    /*
      Safety fallback:
      Your socket is already receiving events, but the chat page has been
      missing rebuilds. This keeps the open chat synced while the page is open.
    */
    _liveRefreshTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      _reloadOpenThread();
    });
  }

  Future<void> _openCurrentThread() async {
    final provider = _messagingProvider;
    if (provider == null) return;

    if (_isGroupChat) {
      await provider.enterRoom(_normalizedRoomId!);
    } else {
      await provider.enterThread();
    }
  }

  Future<void> _reloadOpenThread() async {
    if (!mounted) return;

    final provider = _messagingProvider;
    if (provider == null) return;

    if (_isRefreshingThread) return;

    _isRefreshingThread = true;

    try {
      debugPrint('[MessagingScreen] reload open thread');

      if (_isGroupChat) {
        await provider.enterRoom(_normalizedRoomId!);
      } else {
        await provider.enterThread();
      }
    } catch (error) {
      debugPrint('[MessagingScreen] reload open thread error: $error');
    } finally {
      _isRefreshingThread = false;
    }
  }

  Future<void> _refreshThread() async {
    await _reloadOpenThread();
  }

  Future<void> _sendMessage() async {
    if (_messageController.text.trim().isEmpty) return;

    final messageText = _messageController.text.trim();

    try {
      final provider = _messagingProvider ?? context.read<MessagingProvider>();
      await provider.sendMessage(messageText);

      _messageController.clear();
    } catch (_) {
      if (!mounted) return;

      final provider = _messagingProvider ?? context.read<MessagingProvider>();
      final message = provider.errorMessage ?? 'Failed to send message.';

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    }
  }

  String _formatMessageTime(DateTime value) {
    final local = value.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';

    return '$hour:$minute $period';
  }

  String _formatMessageDate(DateTime value) {
    final local = value.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final target = DateTime(local.year, local.month, local.day);
    final difference = today.difference(target).inDays;

    if (difference == 0) {
      return 'Today';
    }

    if (difference == 1) {
      return 'Yesterday';
    }

    const months = <String>[
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return '${months[local.month - 1]} ${local.day}, ${local.year}';
  }

  Widget _buildConnectionChip(BuildContext context, bool isConnected) {
    final color = isConnected
        ? const Color(0xFF1B8F4B)
        : const Color(0xFFB7791F);

    final label = isConnected ? 'Live conversation' : 'Reconnecting';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withOpacity(0.24)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildThreadHeader(BuildContext context, MessagingProvider provider) {
    final title = widget.title ?? 'OSFA Support Admin';

    final subtitle = _isGroupChat
        ? 'Group conversation'
        : 'Direct support conversation';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0x14000000))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: Colors.black54),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _buildConnectionChip(context, provider.isConnected),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagingProvider>();
    final messages = provider.messages;

    debugPrint(
      '[MessagingScreen] build: '
      'messageCount=${messages.length}, '
      'currentUserId=${provider.currentUserId}, '
      'activeGroupId=${provider.activeGroupId}',
    );

    return SmartPdmPageScaffold(
      appBar: AppBar(
        backgroundColor: _messagingAccentColor,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => AppNavigator.goBackOrHome(context),
        ),
        title: Text(
          'Messages',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      ),
      selectedIndex: 0,
      showBottomNav: false,
      applyPadding: false,
      child: Column(
        children: [
          _buildThreadHeader(context, provider),
          Expanded(
            child: provider.isLoading && messages.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : provider.errorMessage != null && messages.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.wifi_off_rounded,
                            size: 36,
                            color: Colors.black45,
                          ),
                          const SizedBox(height: 14),
                          Text(
                            provider.errorMessage!,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 14),
                          FilledButton(
                            onPressed: _refreshThread,
                            style: FilledButton.styleFrom(
                              backgroundColor: _messagingAccentColor,
                              foregroundColor: Colors.white,
                            ),
                            child: const Text('Try again'),
                          ),
                        ],
                      ),
                    ),
                  )
                : RefreshIndicator(
                    color: _messagingAccentColor,
                    onRefresh: _refreshThread,
                    child: messages.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.symmetric(horizontal: 24),
                            children: [
                              SizedBox(
                                height:
                                    MediaQuery.of(context).size.height * 0.18,
                              ),
                              Container(
                                width: 72,
                                height: 72,
                                margin: const EdgeInsets.only(bottom: 18),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFFF1C3),
                                  borderRadius: BorderRadius.circular(26),
                                ),
                                child: const Icon(
                                  Icons.chat_bubble_outline_rounded,
                                  size: 34,
                                  color: _messagingAccentColor,
                                ),
                              ),
                              Text(
                                'No messages yet',
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.titleMedium
                                    ?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: Colors.black87,
                                    ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Start the conversation here. New replies should appear automatically while this thread is open.',
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(color: Colors.black54),
                              ),
                            ],
                          )
                        : ListView.builder(
                            reverse: true,
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                            itemCount: messages.length,
                            itemBuilder: (context, index) {
                              final message = messages[index];
                              final isMe =
                                  message.senderId == provider.currentUserId;

                              final previousMessage =
                                  index + 1 < messages.length
                                  ? messages[index + 1]
                                  : null;

                              final showDateLabel =
                                  previousMessage == null ||
                                  previousMessage.sentAt.year !=
                                      message.sentAt.year ||
                                  previousMessage.sentAt.month !=
                                      message.sentAt.month ||
                                  previousMessage.sentAt.day !=
                                      message.sentAt.day;

                              return Column(
                                children: [
                                  if (showDateLabel)
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 16,
                                      ),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 6,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius: BorderRadius.circular(
                                            999,
                                          ),
                                          border: Border.all(
                                            color: Colors.black.withOpacity(
                                              0.06,
                                            ),
                                          ),
                                        ),
                                        child: Text(
                                          _formatMessageDate(message.sentAt),
                                          style: Theme.of(context)
                                              .textTheme
                                              .labelMedium
                                              ?.copyWith(
                                                color: Colors.black54,
                                                fontWeight: FontWeight.w700,
                                              ),
                                        ),
                                      ),
                                    ),
                                  _buildMessageBubble(
                                    message,
                                    isMe: isMe,
                                    timeLabel: _formatMessageTime(
                                      message.sentAt,
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                  ),
          ),
          _buildMessageInput(),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(
    ChatMessage message, {
    required bool isMe,
    required String timeLabel,
  }) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Row(
        mainAxisAlignment: isMe
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe)
            Padding(
              padding: const EdgeInsets.only(right: 8, bottom: 12),
              child: message.senderAvatarUrl != null
                  ? CircleAvatar(
                      radius: 16,
                      backgroundImage: NetworkImage(message.senderAvatarUrl!),
                    )
                  : CircleAvatar(
                      radius: 16,
                      backgroundColor: Colors.grey.shade300,
                      child: const Icon(
                        Icons.person,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
            ),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (!isMe && _isGroupChat && message.senderName != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 4, bottom: 4),
                    child: Text(
                      message.senderName!,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Colors.black54,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: isMe ? _messagingAccentColor : Colors.white,
                    borderRadius: BorderRadius.circular(20).copyWith(
                      bottomRight: isMe ? Radius.zero : null,
                      bottomLeft: !isMe ? Radius.zero : null,
                    ),
                    border: isMe
                        ? null
                        : Border.all(color: Colors.black.withOpacity(0.06)),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x10000000),
                        blurRadius: 14,
                        offset: Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        message.messageBody,
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          color: isMe ? Colors.white : Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            timeLabel,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: isMe ? Colors.white70 : Colors.black45,
                                  fontWeight: FontWeight.w600,
                                ),
                          ),
                          if (isMe) ...[
                            const SizedBox(width: 6),
                            Icon(
                              message.isRead
                                  ? Icons.done_all_rounded
                                  : Icons.check_rounded,
                              size: 14,
                              color: Colors.white70,
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageInput() {
    final canSend = _messageController.text.trim().isNotEmpty;

    return SafeArea(
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border(
            top: BorderSide(color: Colors.black.withOpacity(0.06)),
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x08000000),
              blurRadius: 12,
              offset: Offset(0, -2),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF7F7F5),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.black.withOpacity(0.06)),
                ),
                child: TextField(
                  controller: _messageController,
                  minLines: 1,
                  maxLines: 5,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(
                    hintText: 'Write a message...',
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            SizedBox(
              height: 48,
              width: 48,
              child: FilledButton(
                onPressed: canSend ? _sendMessage : null,
                style: FilledButton.styleFrom(
                  backgroundColor: _messagingAccentColor,
                  disabledBackgroundColor: const Color(0xFFE8E5DA),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  padding: EdgeInsets.zero,
                ),
                child: Icon(
                  Icons.send_rounded,
                  color: canSend ? Colors.white : Colors.black38,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
