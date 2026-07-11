import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

const Color _messagingAccentColor = Color(0xFFF6B60C);

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<MessagingProvider>().initializeChat().then((_) {
        if (!mounted) return;
        context.read<MessagingProvider>().refresh();
      });
    });
  }

  Future<void> _refreshMessaging() {
    return context.read<MessagingProvider>().refresh();
  }

  void _openAdminThread() {
    AppNavigator.pushDetail(context, AppRoutes.chatThread);
  }

  void _openGroupThread(String roomId, String roomName) {
    Navigator.of(context).pushNamed(AppRoutes.chatThread, arguments: {
      'roomId': roomId,
      'title': roomName,
    });
  }

  Widget _buildUnreadBadge(BuildContext context, int count) {
    if (count <= 0) {
      return const Icon(Icons.chevron_right_rounded, color: Colors.black45);
    }

    final label = count > 99 ? '99+' : '$count';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: const BoxDecoration(
        color: Color(0xFFE53935),
        borderRadius: BorderRadius.all(Radius.circular(999)),
      ),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.labelMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w700),
      ),
    );
  }

  Widget _buildConnectionChip(BuildContext context, bool isConnected) {
    final color = isConnected ? const Color(0xFF1B8F4B) : const Color(0xFFB7791F);
    final label = isConnected ? 'Live' : 'Syncing';

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

  Widget _buildSectionHeader(BuildContext context, String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w700,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildThreadCard({
    required BuildContext context,
    required Widget leading,
    required String title,
    required String subtitle,
    required int unreadCount,
    required VoidCallback onTap,
    String? helper,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: Colors.black.withOpacity(0.06)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x12000000),
                  blurRadius: 18,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              children: [
                leading,
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.black54,
                        ),
                      ),
                      if (helper != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          helper,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.black45,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                _buildUnreadBadge(context, unreadCount),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagingProvider>();

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
      child: RefreshIndicator(
        color: _messagingAccentColor,
        onRefresh: _refreshMessaging,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
                decoration: const BoxDecoration(
                  color: Color(0xFFFFF7DE),
                  border: Border(
                    bottom: BorderSide(color: Color(0x14000000)),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Stay updated with OSFA and your scholarship groups.',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Colors.black87,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Pull down anytime to refresh your conversations and unread counts.',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.black54,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    _buildConnectionChip(context, provider.isConnected),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: _buildSectionHeader(
                context,
                'Support Chat',
                'Use this for direct concerns, questions, and follow-ups.',
              ),
            ),
            SliverToBoxAdapter(
              child: _buildThreadCard(
                context: context,
                leading: const CircleAvatar(
                  radius: 24,
                  backgroundColor: _messagingAccentColor,
                  child: Icon(Icons.support_agent_rounded, color: Colors.white),
                ),
                title: 'OSFA Support Admin',
                subtitle: 'Direct messaging',
                helper: provider.privateUnreadCount > 0
                    ? '${provider.privateUnreadCount} unread message${provider.privateUnreadCount == 1 ? '' : 's'}'
                    : 'No unread direct messages',
                unreadCount: provider.privateUnreadCount,
                onTap: _openAdminThread,
              ),
            ),
            SliverToBoxAdapter(
              child: _buildSectionHeader(
                context,
                'Group Chats',
                'Announcements, updates, and coordination with your scholarship group.',
              ),
            ),
            if (provider.isLoading && provider.rooms.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (provider.rooms.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 28),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 68,
                          height: 68,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF1C3),
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: const Icon(
                            Icons.forum_outlined,
                            size: 32,
                            color: _messagingAccentColor,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No group chats yet',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Once you are included in a scholarship group conversation, it will appear here.',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate((context, index) {
                  final group = provider.rooms[index];
                  final unreadCount = group.unreadCount;

                  return _buildThreadCard(
                    context: context,
                    leading: CircleAvatar(
                      radius: 24,
                      backgroundColor: const Color(0xFF2F4858).withOpacity(0.12),
                      child: const Icon(Icons.groups_rounded, color: Color(0xFF2F4858)),
                    ),
                    title: group.roomName,
                    subtitle: unreadCount > 0
                        ? '$unreadCount unread message${unreadCount == 1 ? '' : 's'}'
                        : 'Open group conversation',
                    unreadCount: unreadCount,
                    onTap: () => _openGroupThread(group.roomId, group.roomName),
                  );
                }, childCount: provider.rooms.length),
              ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }
}
