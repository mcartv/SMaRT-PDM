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
      context.read<MessagingProvider>().fetchGroups();
      context.read<MessagingProvider>().refreshUnreadCount();
    });
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

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagingProvider>();

    return SmartPdmPageScaffold(
      appBar: AppBar(
        backgroundColor: _messagingAccentColor,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => AppNavigator.goBackOrHome(context),
        ),
        title: Text('Chats', style: Theme.of(context).textTheme.titleLarge?.copyWith(
 fontWeight: FontWeight.w500
)),
      ),
      selectedIndex: 0,
      showBottomNav: false,
      applyPadding: false,
      child: Column(
        children: [
          ListTile(
            leading: CircleAvatar(
              backgroundColor: _messagingAccentColor,
              child: const Icon(Icons.support_agent, color: Colors.white),
            ),
            title: Text('OSFA Support Admin', style: TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('Direct messaging'),
            onTap: _openAdminThread,
            trailing: provider.unreadCount > 0 
              ? Container(
                  padding: const EdgeInsets.all(6),
                  decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                  child: Text(
                    '${provider.unreadCount}', 
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
color: Colors.white
)
                  )
                ) 
              : const Icon(Icons.chevron_right),
          ),
          const Divider(),
          if (provider.isLoading)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (provider.rooms.isEmpty)
            const Expanded(child: Center(child: Text('No group chats found.')))
          else
            Expanded(
              child: ListView.separated(
                itemCount: provider.rooms.length,
                separatorBuilder: (context, index) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final group = provider.rooms[index];
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.grey.shade300,
                      child: const Icon(Icons.group, color: Colors.white),
                    ),
                    title: Text(group.roomName, style: const TextStyle(fontWeight: FontWeight.bold)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => _openGroupThread(group.roomId, group.roomName),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}
