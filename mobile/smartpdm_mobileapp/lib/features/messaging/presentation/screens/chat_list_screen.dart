import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await _refreshMessaging();
    });
  }

  Future<void> _refreshMessaging() async {
    final provider = context.read<MessagingProvider>();
    await provider.initializeChat();
    await provider.fetchGroups(notify: false);
    await provider.refreshUnreadCount();
  }

  void _openAdminThread() {
    AppNavigator.pushDetail(context, AppRoutes.chatThread);
  }

  void _openGroupThread(String roomId, String roomName) {
    AppNavigator.pushDetail(
      context,
      AppRoutes.chatThread,
      arguments: {
        'roomId': roomId,
        'title': roomName,
      },
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
        title: const Text('Messages'),
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: titleColor,
      ),
      selectedIndex: 0,
      showBottomNav: false,
      showDrawer: false,
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
              _MessagesHeader(
                isConnected: provider.isConnected,
                totalUnread: provider.unreadCount,
              ),
              const SizedBox(height: 20),
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
              _ConversationTile(
                icon: Icons.support_agent_rounded,
                title: 'OSFA Support Admin',
                subtitle: provider.privateUnreadCount > 0
                    ? '${provider.privateUnreadCount} unread message${provider.privateUnreadCount == 1 ? '' : 's'}'
                    : 'Direct support conversation',
                unreadCount: provider.privateUnreadCount,
                onTap: _openAdminThread,
              ),
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
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: mutedColor,
                    ),
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
                      subtitle: room.unreadCount > 0
                          ? '${room.unreadCount} unread message${room.unreadCount == 1 ? '' : 's'}'
                          : 'Open group conversation',
                      unreadCount: room.unreadCount,
                      onTap: () => _openGroupThread(
                        room.roomId,
                        room.roomName,
                      ),
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
  const _MessagesHeader({
    required this.isConnected,
    required this.totalUnread,
  });

  final bool isConnected;
  final int totalUnread;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final statusColor = isConnected
        ? const Color(0xFF2E9B61)
        : const Color(0xFFB7791F);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF2E1600), Color(0xFF4A2600)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.darkBrown.withValues(alpha: 0.18),
            blurRadius: 20,
            offset: const Offset(0, 9),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(
              Icons.forum_rounded,
              color: AppColors.gold,
              size: 28,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your Conversations',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                ),
                const SizedBox(height: 5),
                Text(
                  totalUnread > 0
                      ? '$totalUnread unread message${totalUnread == 1 ? '' : 's'}'
                      : 'You are all caught up.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white70,
                      ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: isDark ? 0.25 : 0.18),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: statusColor.withValues(alpha: 0.45),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: statusColor,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  isConnected ? 'Live' : 'Syncing',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
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
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final int unreadCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Material(
      color: isDark ? const Color(0xFF2B1D13) : Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.08)
                  : AppColors.brown.withValues(alpha: 0.09),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.14),
                  borderRadius: BorderRadius.circular(16),
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
                            fontWeight: FontWeight.w900,
                          ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: isDark
                                ? Colors.white60
                                : AppColors.brown.withValues(alpha: 0.64),
                            height: 1.3,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              if (unreadCount > 0)
                Container(
                  constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
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
                )
              else
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
