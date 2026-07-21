import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/chat_message.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class MessagingScreen extends StatefulWidget {
  const MessagingScreen({
    super.key,
    this.roomId,
    this.title,
  });

  final String? roomId;
  final String? title;

  @override
  State<MessagingScreen> createState() => _MessagingScreenState();
}

class _MessagingScreenState extends State<MessagingScreen> {
  final TextEditingController _messageController = TextEditingController();

  MessagingProvider? _provider;
  Timer? _refreshFallback;
  bool _isSending = false;
  bool _isRefreshing = false;

  bool get _isGroupChat => _normalizedRoomId != null;

  String? get _normalizedRoomId {
    final value = widget.roomId?.trim();
    return value == null || value.isEmpty ? null : value;
  }

  @override
  void initState() {
    super.initState();
    _messageController.addListener(_handleComposerChanged);

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;

      _provider = context.read<MessagingProvider>();
      await _openThread();
      _startRefreshFallback();
    });
  }

  void _handleComposerChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _openThread() async {
    final provider = _provider ?? context.read<MessagingProvider>();

    if (_isGroupChat) {
      await provider.enterRoom(_normalizedRoomId!);
    } else {
      await provider.enterThread();
    }
  }

  void _startRefreshFallback() {
    _refreshFallback?.cancel();
    _refreshFallback = Timer.periodic(const Duration(seconds: 8), (_) async {
      if (!mounted || _isRefreshing) return;

      _isRefreshing = true;
      try {
        await (_provider ?? context.read<MessagingProvider>())
            .reloadOpenThread(markAsRead: true);
      } finally {
        _isRefreshing = false;
      }
    });
  }

  Future<void> _refreshThread() async {
    if (_isRefreshing) return;

    setState(() => _isRefreshing = true);
    try {
      await _openThread();
    } finally {
      if (mounted) setState(() => _isRefreshing = false);
    }
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _isSending) return;

    setState(() => _isSending = true);

    try {
      final provider = _provider ?? context.read<MessagingProvider>();
      await provider.sendMessage(text);
      _messageController.clear();
    } catch (_) {
      if (!mounted) return;

      final provider = _provider ?? context.read<MessagingProvider>();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(provider.errorMessage ?? 'Failed to send message.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  String _formatTime(DateTime value) {
    final local = value.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }

  String _formatDate(DateTime value) {
    final local = value.toLocal();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final target = DateTime(local.year, local.month, local.day);
    final difference = today.difference(target).inDays;

    if (difference == 0) return 'Today';
    if (difference == 1) return 'Yesterday';

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

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagingProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final background = isDark
        ? const Color(0xFF17110B)
        : const Color(0xFFF4EFE8);
    final conversationTitle = widget.title?.trim().isNotEmpty == true
        ? widget.title!.trim()
        : 'OSFA Support Admin';

    return SmartPdmPageScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => AppNavigator.goBackOrHome(context),
        ),
        titleSpacing: 2,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              conversationTitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: isDark ? Colors.white : AppColors.darkBrown,
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 2),
            Text(
              provider.isConnected
                  ? (_isGroupChat ? 'Group conversation · Live' : 'OSFA support · Live')
                  : 'Reconnecting...',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: provider.isConnected
                        ? const Color(0xFF2E9B61)
                        : const Color(0xFFB7791F),
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh conversation',
            onPressed: _isRefreshing ? null : _refreshThread,
            icon: _isRefreshing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 4),
        ],
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
      ),
      selectedIndex: 0,
      showBottomNav: false,
      showDrawer: false,
      applyPadding: false,
      child: ColoredBox(
        color: background,
        child: Column(
          children: [
            Expanded(
              child: _buildMessageArea(provider, isDark),
            ),
            _MessageComposer(
              controller: _messageController,
              isSending: _isSending,
              onSend: _sendMessage,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageArea(MessagingProvider provider, bool isDark) {
    final messages = provider.messages;

    if (provider.isLoading && messages.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (provider.errorMessage != null && messages.isEmpty) {
      return _MessageErrorState(
        message: provider.errorMessage!,
        onRetry: _refreshThread,
      );
    }

    if (messages.isEmpty) {
      return RefreshIndicator(
        color: AppColors.gold,
        onRefresh: _refreshThread,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 28),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.17),
            Container(
              width: 76,
              height: 76,
              margin: const EdgeInsets.only(bottom: 18),
              decoration: BoxDecoration(
                color: AppColors.gold.withValues(alpha: isDark ? 0.16 : 0.13),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.chat_bubble_outline_rounded,
                size: 34,
                color: AppColors.gold,
              ),
            ),
            Text(
              'No messages yet',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: isDark ? Colors.white : AppColors.darkBrown,
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              _isGroupChat
                  ? 'Send a message to start this scholarship group conversation.'
                  : 'Send a message to contact the OSFA support admin.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: isDark
                        ? Colors.white60
                        : AppColors.brown.withValues(alpha: 0.66),
                    height: 1.45,
                  ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.gold,
      onRefresh: _refreshThread,
      child: ListView.builder(
        reverse: true,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 24),
        itemCount: messages.length,
        itemBuilder: (context, index) {
          final message = messages[index];
          final isMe = message.senderId == provider.currentUserId;
          final previous = index + 1 < messages.length
              ? messages[index + 1]
              : null;
          final showDate = previous == null ||
              previous.sentAt.year != message.sentAt.year ||
              previous.sentAt.month != message.sentAt.month ||
              previous.sentAt.day != message.sentAt.day;

          return Column(
            children: [
              if (showDate)
                _DateDivider(label: _formatDate(message.sentAt)),
              _MessageBubble(
                message: message,
                isMe: isMe,
                isGroupChat: _isGroupChat,
                timeLabel: _formatTime(message.sentAt),
              ),
            ],
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _refreshFallback?.cancel();
    _messageController.removeListener(_handleComposerChanged);
    _messageController.dispose();
    _provider?.leaveThread(notify: false);
    _provider = null;
    super.dispose();
  }
}

class _DateDivider extends StatelessWidget {
  const _DateDivider({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          Expanded(
            child: Divider(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.10)
                  : AppColors.brown.withValues(alpha: 0.10),
            ),
          ),
          const SizedBox(width: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: isDark ? const Color(0xFF2B1D13) : Colors.white,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: isDark
                        ? Colors.white60
                        : AppColors.brown.withValues(alpha: 0.62),
                    fontWeight: FontWeight.w800,
                  ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Divider(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.10)
                  : AppColors.brown.withValues(alpha: 0.10),
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isMe,
    required this.isGroupChat,
    required this.timeLabel,
  });

  final ChatMessage message;
  final bool isMe;
  final bool isGroupChat;
  final String timeLabel;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final incomingSurface = isDark ? const Color(0xFF2B1D13) : Colors.white;

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          mainAxisAlignment:
              isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!isMe) ...[
              _SenderAvatar(message: message),
              const SizedBox(width: 8),
            ],
            Flexible(
              child: Column(
                crossAxisAlignment:
                    isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  if (!isMe && isGroupChat && message.senderName != null) ...[
                    Padding(
                      padding: const EdgeInsets.only(left: 5, bottom: 4),
                      child: Text(
                        message.senderName!,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: isDark
                                  ? Colors.white60
                                  : AppColors.brown.withValues(alpha: 0.64),
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ),
                  ],
                  Container(
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.of(context).size.width * 0.76,
                    ),
                    padding: const EdgeInsets.fromLTRB(14, 11, 12, 8),
                    decoration: BoxDecoration(
                      color: isMe ? AppColors.darkBrown : incomingSurface,
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(18),
                        topRight: const Radius.circular(18),
                        bottomLeft: Radius.circular(isMe ? 18 : 4),
                        bottomRight: Radius.circular(isMe ? 4 : 18),
                      ),
                      border: Border.all(
                        color: isMe
                            ? AppColors.gold.withValues(alpha: 0.42)
                            : (isDark
                                ? Colors.white.withValues(alpha: 0.07)
                                : AppColors.brown.withValues(alpha: 0.08)),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.06),
                          blurRadius: 12,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          message.messageBody,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: isMe
                                    ? Colors.white
                                    : (isDark ? Colors.white : AppColors.darkBrown),
                                height: 1.38,
                              ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              timeLabel,
                              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: isMe
                                        ? Colors.white60
                                        : (isDark
                                            ? Colors.white54
                                            : AppColors.brown.withValues(alpha: 0.52)),
                                    fontWeight: FontWeight.w700,
                                  ),
                            ),
                            if (isMe) ...[
                              const SizedBox(width: 5),
                              Icon(
                                message.isRead
                                    ? Icons.done_all_rounded
                                    : Icons.check_rounded,
                                size: 14,
                                color: message.isRead
                                    ? AppColors.gold
                                    : Colors.white60,
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
      ),
    );
  }
}

class _SenderAvatar extends StatelessWidget {
  const _SenderAvatar({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final avatarUrl = message.senderAvatarUrl?.trim();

    return CircleAvatar(
      radius: 16,
      backgroundColor: AppColors.gold.withValues(alpha: 0.18),
      backgroundImage: avatarUrl != null && avatarUrl.isNotEmpty
          ? NetworkImage(avatarUrl)
          : null,
      child: avatarUrl == null || avatarUrl.isEmpty
          ? const Icon(
              Icons.person_rounded,
              color: AppColors.gold,
              size: 18,
            )
          : null,
    );
  }
}

class _MessageComposer extends StatelessWidget {
  const _MessageComposer({
    required this.controller,
    required this.isSending,
    required this.onSend,
  });

  final TextEditingController controller;
  final bool isSending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final canSend = controller.text.trim().isNotEmpty && !isSending;

    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF24180F) : Colors.white,
          border: Border(
            top: BorderSide(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.08)
                  : AppColors.brown.withValues(alpha: 0.08),
            ),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                minLines: 1,
                maxLines: 5,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Write a message...',
                  filled: true,
                  fillColor: isDark
                      ? Colors.white.withValues(alpha: 0.06)
                      : const Color(0xFFF7F3ED),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: BorderSide(
                      color: isDark
                          ? Colors.white.withValues(alpha: 0.07)
                          : AppColors.brown.withValues(alpha: 0.07),
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: const BorderSide(
                      color: AppColors.gold,
                      width: 1.4,
                    ),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 9),
            SizedBox(
              width: 48,
              height: 48,
              child: FilledButton(
                onPressed: canSend ? onSend : null,
                style: FilledButton.styleFrom(
                  padding: EdgeInsets.zero,
                  backgroundColor: AppColors.gold,
                  foregroundColor: AppColors.darkBrown,
                  disabledBackgroundColor: isDark
                      ? Colors.white.withValues(alpha: 0.08)
                      : const Color(0xFFE4DED5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: isSending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.darkBrown,
                        ),
                      )
                    : const Icon(Icons.send_rounded),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageErrorState extends StatelessWidget {
  const _MessageErrorState({
    required this.message,
    required this.onRetry,
  });

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              size: 42,
              color: Colors.redAccent,
            ),
            const SizedBox(height: 12),
            Text(
              'Unable to load conversation',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: isDark ? Colors.white : AppColors.darkBrown,
                    fontWeight: FontWeight.w900,
                  ),
            ),
            const SizedBox(height: 7),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? Colors.white60
                        : AppColors.brown.withValues(alpha: 0.64),
                    height: 1.4,
                  ),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}
