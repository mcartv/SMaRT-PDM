import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/constants.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';

class NotificationsScreen extends StatefulWidget {
  final bool showBottomNav;

  const NotificationsScreen({super.key, this.showBottomNav = true});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> notifications = [
    {
      'id': 1,
      'title': 'Document Verification In Progress',
      'message': 'Your Certificate of Registration is being verified.',
      'timestamp': 'Today, 2:30 PM',
      'icon': Icons.check_circle,
      'color': Colors.blue,
      'read': false,
    },
    {
      'id': 2,
      'title': 'Action Required',
      'message': 'Grade form is unclear. Please re-upload a clearer copy.',
      'timestamp': 'Today, 10:15 AM',
      'icon': Icons.warning,
      'color': Colors.red,
      'read': false,
    },
    {
      'id': 3,
      'title': 'Interview Scheduled',
      'message':
          'Your interview for TES 2025 is scheduled for Nov 15, 2:00 PM.',
      'timestamp': 'Yesterday, 11:20 AM',
      'icon': Icons.calendar_today,
      'color': Colors.green,
      'read': true,
    },
    {
      'id': 4,
      'title': 'Application Status Update',
      'message': 'Your application has moved to Admin Review stage.',
      'timestamp': 'Mar 25, 2025 3:45 PM',
      'icon': Icons.info,
      'color': Colors.purple,
      'read': true,
    },
    {
      'id': 5,
      'title': 'New Announcement',
      'message': 'BC Packaging Grant is now open for applications.',
      'timestamp': 'Mar 24, 2025 9:20 AM',
      'icon': Icons.newspaper,
      'color': Colors.orange,
      'read': true,
    },
  ];

  void _markAsRead(int id) {
    setState(() {
      final notification = notifications.firstWhere((n) => n['id'] == id);
      notification['read'] = true;
    });
  }

  void _deleteNotification(int id) {
    setState(() {
      notifications.removeWhere((n) => n['id'] == id);
    });
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Notification deleted')));
  }

  void _markAllAsRead() {
    setState(() {
      for (var notification in notifications) {
        notification['read'] = true;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = notifications.where((n) => !n['read']).length;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF332216) : Colors.white;
    final unreadCardColor = isDark ? const Color(0xFF3A2718) : Colors.blue[50]!;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.grey;
    final accentColor = isDark ? const Color(0xFFFFD54F) : AppColors.darkBrown;

    return SmartPdmPageScaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
        elevation: 0,
        actions: [
          if (unreadCount > 0)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Center(
                child: TextButton(
                  onPressed: _markAllAsRead,
                  child: Text(
                    'Mark all as read',
                    style: TextStyle(
                      color: isDark ? accentColor : AppColors.darkBrown,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      selectedIndex: 2,
      showBottomNav: widget.showBottomNav,
      showDrawer: false,
      child: notifications.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.notifications_off,
                    size: 64,
                    color: isDark ? Colors.white38 : Colors.grey[300],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No notifications',
                    style: TextStyle(
                      fontSize: 18,
                      color: isDark ? Colors.white70 : Colors.grey[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            )
          : ListView.builder(
              itemCount: notifications.length,
              itemBuilder: (context, index) {
                final notification = notifications[index];
                return Dismissible(
                  key: Key(notification['id'].toString()),
                  onDismissed: (_) => _deleteNotification(notification['id']),
                  background: Container(
                    color: Colors.red,
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 16),
                    child: const Icon(Icons.delete, color: Colors.white),
                  ),
                  child: Card(
                    margin: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 8,
                    ),
                    color: notification['read'] ? cardColor : unreadCardColor,
                    child: ListTile(
                      leading: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: notification['color'].withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(
                          notification['icon'],
                          color: notification['color'],
                        ),
                      ),
                      title: Row(
                        children: [
                          Expanded(
                            child: Text(
                              notification['title'],
                              style: TextStyle(
                                fontWeight: notification['read']
                                    ? FontWeight.normal
                                    : FontWeight.bold,
                                color: titleColor,
                              ),
                            ),
                          ),
                          if (!notification['read'])
                            Container(
                              width: 8,
                              height: 8,
                              decoration: const BoxDecoration(
                                color: Colors.blue,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Text(
                            notification['message'],
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: subtitleColor),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            notification['timestamp'],
                            style: TextStyle(
                              fontSize: 11,
                              color: subtitleColor,
                            ),
                          ),
                        ],
                      ),
                      onTap: () {
                        _markAsRead(notification['id']);
                        showModalBottomSheet(
                          context: context,
                          builder: (context) =>
                              _buildNotificationDetail(notification),
                        );
                      },
                      trailing: PopupMenuButton(
                        iconColor: accentColor,
                        itemBuilder: (context) => [
                          if (!notification['read'])
                            PopupMenuItem(
                              child: const Text('Mark as read'),
                              onTap: () => _markAsRead(notification['id']),
                            ),
                          PopupMenuItem(
                            child: const Text('Delete'),
                            onTap: () =>
                                _deleteNotification(notification['id']),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }

  Widget _buildNotificationDetail(Map<String, dynamic> notification) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.grey;

    return DraggableScrollableSheet(
      expand: false,
      builder: (context, scrollController) => SingleChildScrollView(
        controller: scrollController,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: notification['color'].withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      notification['icon'],
                      color: notification['color'],
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          notification['title'],
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: titleColor,
                          ),
                        ),
                        Text(
                          notification['timestamp'],
                          style: TextStyle(color: subtitleColor, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                notification['message'],
                style: TextStyle(fontSize: 14, height: 1.6, color: titleColor),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Close'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        _deleteNotification(notification['id']);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red,
                      ),
                      child: const Text(
                        'Delete',
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
