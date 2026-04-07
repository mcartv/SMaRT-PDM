import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/models/app_notification.dart';
import 'package:smartpdm_mobileapp/screens/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/widgets/app_theme.dart';
import 'package:smartpdm_mobileapp/widgets/smart_pdm_page_scaffold.dart';

class NotificationsScreen extends StatefulWidget {
  final bool showBottomNav;

  const NotificationsScreen({super.key, this.showBottomNav = true});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<NotificationProvider>().initialize();
    });
  }

  Future<void> _openNotification(AppNotification notification) async {
    final provider = context.read<NotificationProvider>();
    if (!notification.isRead) {
      await provider.markAsRead(notification.notificationId);
    }

    if (!mounted) return;

    showModalBottomSheet<void>(
      context: context,
      builder: (context) =>
          _NotificationDetailSheet(notification: notification),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = isDark ? const Color(0xFFFFD54F) : AppColors.darkBrown;

    return Consumer<NotificationProvider>(
      builder: (context, notificationProvider, child) {
        final notifications = notificationProvider.notifications;
        final unreadCount = notificationProvider.unreadCount;

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
                      onPressed: notificationProvider.markAllAsRead,
                      child: Text(
                        'Mark all as read',
                        style: TextStyle(color: accentColor, fontSize: 12),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          selectedIndex: 2,
          unreadNotifications: unreadCount,
          showBottomNav: widget.showBottomNav,
          showDrawer: false,
          child: RefreshIndicator(
            onRefresh: notificationProvider.refresh,
            child: Builder(
              builder: (context) {
                if (notificationProvider.isLoading && notifications.isEmpty) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (notificationProvider.errorMessage != null &&
                    notifications.isEmpty) {
                  return _NotificationsErrorState(
                    message: notificationProvider.errorMessage!,
                    onRetry: notificationProvider.refresh,
                  );
                }

                if (notifications.isEmpty) {
                  return _NotificationsEmptyState(isDark: isDark);
                }

                return ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  itemCount: notifications.length,
                  itemBuilder: (context, index) {
                    final notification = notifications[index];
                    return Dismissible(
                      key: Key(notification.notificationId),
                      background: Container(
                        color: Colors.red,
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.only(right: 16),
                        child: const Icon(Icons.delete, color: Colors.white),
                      ),
                      onDismissed: (_) async {
                        await notificationProvider.deleteNotification(
                          notification.notificationId,
                        );
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Notification deleted'),
                          ),
                        );
                      },
                      child: _NotificationTile(
                        notification: notification,
                        onTap: () => _openNotification(notification),
                        onDelete: () async {
                          await notificationProvider.deleteNotification(
                            notification.notificationId,
                          );
                        },
                        onMarkRead: notification.isRead
                            ? null
                            : () => notificationProvider.markAsRead(
                                  notification.notificationId,
                                ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        );
      },
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.notification,
    required this.onTap,
    required this.onDelete,
    required this.onMarkRead,
  });

  final AppNotification notification;
  final VoidCallback onTap;
  final VoidCallback onDelete;
  final VoidCallback? onMarkRead;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? const Color(0xFF332216) : Colors.white;
    final unreadCardColor = isDark ? const Color(0xFF3A2718) : Colors.blue[50]!;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final subtitleColor = isDark ? Colors.white70 : Colors.grey;
    final accentColor = isDark ? const Color(0xFFFFD54F) : AppColors.darkBrown;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      color: notification.isRead ? cardColor : unreadCardColor,
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: notification.accentColor.withOpacity(0.18),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(notification.icon, color: notification.accentColor),
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                notification.title,
                style: TextStyle(
                  fontWeight:
                      notification.isRead ? FontWeight.normal : FontWeight.bold,
                  color: titleColor,
                ),
              ),
            ),
            if (!notification.isRead)
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
              notification.message,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: subtitleColor),
            ),
            const SizedBox(height: 4),
            Text(
              _formatTimestamp(notification.createdAt),
              style: TextStyle(fontSize: 11, color: subtitleColor),
            ),
          ],
        ),
        onTap: onTap,
        trailing: PopupMenuButton<String>(
          iconColor: accentColor,
          onSelected: (value) {
            if (value == 'read' && onMarkRead != null) {
              onMarkRead!();
            }
            if (value == 'delete') {
              onDelete();
            }
          },
          itemBuilder: (context) => [
            if (onMarkRead != null)
              const PopupMenuItem<String>(
                value: 'read',
                child: Text('Mark as read'),
              ),
            const PopupMenuItem<String>(
              value: 'delete',
              child: Text('Delete'),
            ),
          ],
        ),
      ),
    );
  }
}

class _NotificationDetailSheet extends StatelessWidget {
  const _NotificationDetailSheet({required this.notification});

  final AppNotification notification;

  @override
  Widget build(BuildContext context) {
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
                      color: notification.accentColor.withOpacity(0.18),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      notification.icon,
                      color: notification.accentColor,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          notification.title,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: titleColor,
                          ),
                        ),
                        Text(
                          _formatTimestamp(notification.createdAt),
                          style: TextStyle(color: subtitleColor, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                notification.message,
                style: TextStyle(fontSize: 14, height: 1.6, color: titleColor),
              ),
              if ((notification.referenceType ?? '').isNotEmpty ||
                  (notification.referenceId ?? '').isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  'Reference: ${notification.referenceType ?? 'notification'} ${notification.referenceId ?? ''}'.trim(),
                  style: TextStyle(fontSize: 12, color: subtitleColor),
                ),
              ],
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Close'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationsEmptyState extends StatelessWidget {
  const _NotificationsEmptyState({required this.isDark});

  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.55,
          child: Center(
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
          ),
        ),
      ],
    );
  }
}

class _NotificationsErrorState extends StatelessWidget {
  const _NotificationsErrorState({
    required this.message,
    required this.onRetry,
  });

  final String message;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.55,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.cloud_off, size: 52, color: Colors.redAccent),
                  const SizedBox(height: 12),
                  Text(
                    'Unable to load notifications',
                    style: Theme.of(context).textTheme.titleMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(message, textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: onRetry,
                    child: const Text('Try again'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

String _formatTimestamp(DateTime timestamp) {
  final local = timestamp.toLocal();
  final now = DateTime.now();
  final difference = now.difference(local);

  if (difference.inMinutes < 1) {
    return 'Just now';
  }

  if (difference.inHours < 1) {
    return '${difference.inMinutes}m ago';
  }

  if (difference.inDays < 1) {
    return '${difference.inHours}h ago';
  }

  if (difference.inDays < 7) {
    return '${difference.inDays}d ago';
  }

  final month = _monthLabel(local.month);
  final minute = local.minute.toString().padLeft(2, '0');
  final hour =
      local.hour > 12 ? local.hour - 12 : (local.hour == 0 ? 12 : local.hour);
  final period = local.hour >= 12 ? 'PM' : 'AM';
  return '$month ${local.day}, ${local.year} $hour:$minute $period';
}

String _monthLabel(int month) {
  const labels = [
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

  if (month < 1 || month > 12) {
    return 'Date';
  }

  return labels[month - 1];
}
