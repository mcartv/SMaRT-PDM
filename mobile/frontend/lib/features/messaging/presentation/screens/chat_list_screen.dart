import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/messaging/data/services/message_service.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

String _messagePreview(String? value, String fallback) {
  final normalized = (value ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();
  return normalized.isEmpty ? fallback : normalized;
}

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  Timer? _liveSyncTimer;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await _refreshMessaging();
      _startLiveSyncWatchdog();
    });
  }

  void _startLiveSyncWatchdog() {
    _liveSyncTimer?.cancel();
    _liveSyncTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
      _refreshMessaging();
    });
  }

  Future<void> _refreshMessaging() async {
    if (_refreshing) return;
    _refreshing = true;

    try {
      final provider = context.read<MessagingProvider>();
      await provider.initializeChat();
      await provider.fetchArchivedThreads(notify: false);
      await provider.fetchGroups(notify: false);
      await provider.refreshUnreadCount();
    } finally {
      _refreshing = false;
    }
  }

  @override
  void dispose() {
    _liveSyncTimer?.cancel();
    _liveSyncTimer = null;
    super.dispose();
  }

  void _openAdminThread() {
    AppNavigator.pushDetail(context, AppRoutes.chatThread);
  }

  void _openGroupThread(String roomId, String roomName) {
    AppNavigator.pushDetail(
      context,
      AppRoutes.chatThread,
      arguments: {'roomId': roomId, 'title': roomName},
    );
  }

  Future<bool> _confirmArchive(String title) async {
    return await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Archive conversation?'),
            content: Text('$title will be hidden from your conversation list. A new message will automatically bring it back.'),
            actions: [
              TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Cancel')),
              FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Archive')),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _archivePrivateThread() async {
    if (!await _confirmArchive('OSFA Administrator') || !mounted) return;
    try {
      await context.read<MessagingProvider>().archivePrivateThread();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Unable to archive conversation.')));
    }
  }

  Future<void> _archiveGroup(ChatRoom room) async {
    if (!await _confirmArchive(room.roomName) || !mounted) return;
    try {
      await context.read<MessagingProvider>().archiveRoom(room.roomId);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Unable to archive group conversation.')));
    }
  }

  Future<void> _showArchivedThreads() async {
    final provider = context.read<MessagingProvider>();
    await provider.fetchArchivedThreads();
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => ChangeNotifierProvider<MessagingProvider>.value(
        value: provider,
        child: const _ArchivedThreadsSheet(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagingProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final background = isDark
        ? const Color(0xFF17110B)
        : const Color(0xFFF6F1EA);
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final mutedColor = isDark
        ? Colors.white60
        : AppColors.brown.withValues(alpha: 0.65);

    return SmartPdmPageScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => AppNavigator.goBackOrHome(context),
        ),
        title: const Text('Chats'),
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: titleColor,
        actions: [
          IconButton(
            tooltip: 'Archived messages',
            onPressed: _showArchivedThreads,
            icon: const Icon(Icons.archive_outlined),
          ),
        ],
      ),
      selectedIndex: 0,
      showBottomNav: false,
      applyPadding: false,
      child: ColoredBox(
        color: background,
        child: RefreshIndicator(
          color: AppColors.gold,
          onRefresh: _refreshMessaging,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 30),
            children: [
              _MessagesHeader(totalUnread: provider.unreadCount),
              const SizedBox(height: 18),
              Text(
                'OSFA Support',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: titleColor,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Use this private conversation for questions, document concerns, and application follow-ups.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: mutedColor,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 12),
              if (!provider.isPrivateThreadArchived)
                _ConversationTile(
                  icon: Icons.support_agent_rounded,
                  title: 'OSFA Administrator',
                  subtitle: _messagePreview(
                    provider.privatePreview?.messageBody,
                    'Direct support conversation',
                  ),
                  unreadCount: provider.privateUnreadCount,
                  onTap: _openAdminThread,
                  onArchive: _archivePrivateThread,
                )
              else
                _ArchivedHint(onOpenArchived: _showArchivedThreads),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'Scholarship Group Chats',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: titleColor,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  if (provider.isLoading)
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Groups assigned by OSFA will appear here.',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: mutedColor),
              ),
              const SizedBox(height: 12),
              if (provider.rooms.isEmpty)
                _EmptyGroupsCard(
                  isLoading: provider.isLoading,
                  errorMessage: provider.errorMessage,
                  onRetry: _refreshMessaging,
                )
              else
                ...provider.rooms.map(
                  (room) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _ConversationTile(
                      icon: Icons.groups_rounded,
                      title: room.roomName,
                      subtitle: _messagePreview(room.lastMessage, 'Group chat'),
                      unreadCount: room.unreadCount,
                      onTap: () => _openGroupThread(room.roomId, room.roomName),
                      onArchive: () => _archiveGroup(room),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MessagesHeader extends StatelessWidget {
  const _MessagesHeader({required this.totalUnread});

  final int totalUnread;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Row(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.14),
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.forum_rounded, color: AppColors.gold, size: 24),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Conversations',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: isDark ? Colors.white : AppColors.darkBrown,
                      fontWeight: FontWeight.w900,
                    ),
              ),
              const SizedBox(height: 3),
              Text(
                totalUnread > 0
                    ? '$totalUnread unread message${totalUnread == 1 ? '' : 's'}'
                    : 'You are all caught up.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isDark ? Colors.white60 : AppColors.brown.withValues(alpha: 0.62),
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.unreadCount,
    required this.onTap,
    this.onArchive,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final int unreadCount;
  final VoidCallback onTap;
  final Future<void> Function()? onArchive;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final hasUnread = unreadCount > 0;

    return Material(
      color: hasUnread
          ? AppColors.gold.withValues(alpha: isDark ? 0.12 : 0.09)
          : (isDark ? const Color(0xFF2B1D13) : Colors.white),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.14),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: AppColors.gold, size: 25),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: isDark ? Colors.white : AppColors.darkBrown,
                        fontWeight: hasUnread ? FontWeight.w900 : FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: hasUnread
                            ? (isDark ? Colors.white : AppColors.darkBrown)
                            : (isDark
                                  ? Colors.white60
                                  : AppColors.brown.withValues(alpha: 0.64)),
                        fontWeight: hasUnread ? FontWeight.w700 : FontWeight.w500,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              if (unreadCount > 0)
                Container(
                  constraints: const BoxConstraints(
                    minWidth: 24,
                    minHeight: 24,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE53935),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    unreadCount > 99 ? '99+' : '$unreadCount',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              if (onArchive != null)
                PopupMenuButton<String>(
                  tooltip: 'Conversation options',
                  onSelected: (value) {
                    if (value == 'archive') onArchive!();
                  },
                  itemBuilder: (context) => const [
                    PopupMenuItem<String>(
                      value: 'archive',
                      child: Row(children: [Icon(Icons.archive_outlined, size: 19), SizedBox(width: 10), Text('Archive')]),
                    ),
                  ],
                )
              else if (unreadCount == 0)
                Icon(
                  Icons.chevron_right_rounded,
                  color: isDark
                      ? Colors.white38
                      : AppColors.brown.withValues(alpha: 0.40),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ArchivedHint extends StatelessWidget {
  const _ArchivedHint({required this.onOpenArchived});
  final VoidCallback onOpenArchived;
  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: const Icon(Icons.archive_outlined),
      title: const Text('Support conversation archived'),
      subtitle: const Text('It will return automatically when a new message arrives.'),
      trailing: TextButton(onPressed: onOpenArchived, child: const Text('View')),
    );
  }
}

class _ArchivedThreadsSheet extends StatelessWidget {
  const _ArchivedThreadsSheet();
  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagingProvider>();
    final items = provider.archivedThreads;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text('Archived Messages', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900))),
              IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close_rounded)),
            ]),
            const SizedBox(height: 8),
            if (items.isEmpty)
              const Padding(padding: EdgeInsets.symmetric(vertical: 28), child: Center(child: Text('No archived conversations.')))
            else
              ConstrainedBox(
                constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.55),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: items.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = items[index];
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(item.isGroup ? Icons.groups_rounded : Icons.support_agent_rounded),
                      title: Text(item.name),
                      subtitle: Text(item.isGroup ? 'Group conversation' : 'Private conversation'),
                      trailing: TextButton(
                        onPressed: () async {
                          try {
                            await provider.restoreArchivedThread(item);
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Conversation restored.')));
                          } catch (_) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Unable to restore conversation.')));
                          }
                        },
                        child: const Text('Restore'),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _EmptyGroupsCard extends StatelessWidget {
  const _EmptyGroupsCard({
    required this.isLoading,
    required this.errorMessage,
    required this.onRetry,
  });

  final bool isLoading;
  final String? errorMessage;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF2B1D13) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : AppColors.brown.withValues(alpha: 0.09),
        ),
      ),
      child: Column(
        children: [
          Icon(
            errorMessage != null
                ? Icons.cloud_off_rounded
                : Icons.groups_outlined,
            color: errorMessage != null ? Colors.redAccent : AppColors.gold,
            size: 34,
          ),
          const SizedBox(height: 10),
          Text(
            isLoading
                ? 'Loading group chats...'
                : errorMessage != null
                ? 'Unable to load group chats'
                : 'No group chats yet',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: isDark ? Colors.white : AppColors.darkBrown,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            errorMessage ??
                'Once OSFA adds you to a scholarship group, it will appear here.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: isDark
                  ? Colors.white60
                  : AppColors.brown.withValues(alpha: 0.64),
              height: 1.4,
            ),
          ),
          if (errorMessage != null) ...[
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try Again'),
            ),
          ],
        ],
      ),
    );
  }
}
