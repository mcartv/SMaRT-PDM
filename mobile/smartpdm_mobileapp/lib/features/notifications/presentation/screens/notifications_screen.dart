import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/office_update_article_screen.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

enum _NotificationViewFilter { officeUpdates, notifications }

class NotificationsScreen extends StatefulWidget {
  final bool showBottomNav;

  const NotificationsScreen({super.key, this.showBottomNav = false});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  _NotificationViewFilter _selectedFilter =
      _NotificationViewFilter.officeUpdates;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<NotificationProvider>().initialize();
    });
  }

  Future<void> _handleDelete(
    BuildContext context,
    NotificationProvider notificationProvider,
    String notificationId,
  ) async {
    await notificationProvider.deleteNotification(notificationId);
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Notification deleted')));
  }

  void _openNotification(AppNotification notification) {
    if (!mounted) return;

    final provider = context.read<NotificationProvider>();
    if (!notification.isRead) {
      provider.markAsRead(notification.notificationId);
    }

    if (notification.isOfficeUpdate) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => OfficeUpdateArticleScreen(
            notification: notification,
            showBottomNav: false,
          ),
        ),
      );
      return;
    }

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
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
        final officeUpdates = notificationProvider.officeUpdatesItems;
        final generalNotifications =
            notificationProvider.generalNotificationItems;
        final unreadCount = notificationProvider.unreadCount;
        final activeItems =
            _selectedFilter == _NotificationViewFilter.officeUpdates
            ? officeUpdates
            : generalNotifications;

        return SmartPdmPageScaffold(
          appBar: AppBar(
            title: const Text('Notifications'),
            backgroundColor: isDark ? const Color(0xFF24180F) : Colors.white,
            foregroundColor: isDark ? Colors.white : AppColors.darkBrown,
            elevation: 0,
            actions: [
              if (_selectedFilter == _NotificationViewFilter.notifications &&
                  unreadCount > 0)
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
          selectedIndex: 0,
          unreadNotifications: unreadCount,
          showBottomNav: widget.showBottomNav,
          showDrawer: false,
          child: RefreshIndicator(
            onRefresh: notificationProvider.refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.only(top: 12, bottom: 12),
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _NotificationFilterChips(
                    selectedFilter: _selectedFilter,
                    onChanged: (value) {
                      setState(() => _selectedFilter = value);
                    },
                  ),
                ),
                const SizedBox(height: 12),
                if (notificationProvider.isLoading && activeItems.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 48),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (notificationProvider.errorMessage != null &&
                    activeItems.isEmpty)
                  _NotificationsErrorState(
                    message: notificationProvider.errorMessage!,
                    onRetry: notificationProvider.refresh,
                  )
                else if (activeItems.isEmpty)
                  _NotificationsEmptyState(
                    isDark: isDark,
                    label:
                        _selectedFilter == _NotificationViewFilter.officeUpdates
                        ? 'No office updates'
                        : 'No notifications',
                  )
                else if (_selectedFilter ==
                    _NotificationViewFilter.officeUpdates)
                  ...officeUpdates.map(
                    (notification) => Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      child: _OfficeUpdatePreviewCard(
                        notification: notification,
                        onTap: () => _openNotification(notification),
                      ),
                    ),
                  )
                else
                  ...generalNotifications.map(
                    (notification) => Dismissible(
                      key: Key(notification.notificationId),
                      background: Container(
                        margin: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 8,
                        ),
                        color: Colors.red,
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.only(right: 16),
                        child: const Icon(Icons.delete, color: Colors.white),
                      ),
                      onDismissed: (_) => _handleDelete(
                        context,
                        notificationProvider,
                        notification.notificationId,
                      ),
                      child: _NotificationTile(
                        notification: notification,
                        onTap: () => _openNotification(notification),
                        onDelete: () => _handleDelete(
                          context,
                          notificationProvider,
                          notification.notificationId,
                        ),
                        onMarkRead: notification.isRead
                            ? null
                            : () => notificationProvider.markAsRead(
                                notification.notificationId,
                              ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _NotificationFilterChips extends StatelessWidget {
  const _NotificationFilterChips({
    required this.selectedFilter,
    required this.onChanged,
  });

  final _NotificationViewFilter selectedFilter;
  final ValueChanged<_NotificationViewFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        ChoiceChip(
          label: const Text('Office Updates'),
          selected: selectedFilter == _NotificationViewFilter.officeUpdates,
          onSelected: (_) => onChanged(_NotificationViewFilter.officeUpdates),
          selectedColor: isDark ? const Color(0xFF4C3318) : AppColors.gold,
          labelStyle: TextStyle(
            fontWeight: FontWeight.w700,
            color: selectedFilter == _NotificationViewFilter.officeUpdates
                ? AppColors.darkBrown
                : (isDark ? Colors.white70 : Colors.black87),
          ),
        ),
        ChoiceChip(
          label: const Text('Notifications'),
          selected: selectedFilter == _NotificationViewFilter.notifications,
          onSelected: (_) => onChanged(_NotificationViewFilter.notifications),
          selectedColor: isDark ? const Color(0xFF4C3318) : AppColors.gold,
          labelStyle: TextStyle(
            fontWeight: FontWeight.w700,
            color: selectedFilter == _NotificationViewFilter.notifications
                ? AppColors.darkBrown
                : (isDark ? Colors.white70 : Colors.black87),
          ),
        ),
      ],
    );
  }
}

class _OfficeUpdatePreviewCard extends StatelessWidget {
  const _OfficeUpdatePreviewCard({
    required this.notification,
    required this.onTap,
  });

  final AppNotification notification;
  final VoidCallback onTap;

  void _openOpenings(BuildContext context) {
    Navigator.pushNamed(context, AppRoutes.scholarshipOpenings);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final bodyColor = isDark ? Colors.white70 : Colors.black87;
    final surfaceColor = isDark ? const Color(0xFF332216) : Colors.white;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        decoration: BoxDecoration(
          color: surfaceColor,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: notification.accentColor.withOpacity(0.28)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x12000000),
              blurRadius: 10,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: notification.accentColor.withOpacity(0.14),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      notification.officeUpdateLabel,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: notification.accentColor,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    'READ MORE',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: notification.accentColor,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                notification.title,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: titleColor,
                  height: 1.12,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                notification.previewText,
                style: TextStyle(fontSize: 14, color: bodyColor, height: 1.45),
              ),
              const SizedBox(height: 14),
              Text(
                _formatTimestamp(notification.createdAt),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isDark ? Colors.white54 : Colors.grey[700],
                ),
              ),
              if (notification.isOpeningUpdate) ...[
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => _openOpenings(context),
                    child: const Text('Apply Now'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
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
                  fontWeight: notification.isRead
                      ? FontWeight.normal
                      : FontWeight.bold,
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
            const PopupMenuItem<String>(value: 'delete', child: Text('Delete')),
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
                      color: notification.accentColor.withOpacity(0.2),
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
                  'Reference: ${notification.referenceType ?? 'notification'} ${notification.referenceId ?? ''}'
                      .trim(),
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
  const _NotificationsEmptyState({required this.isDark, required this.label});

  final bool isDark;
  final String label;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
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
              label,
              style: TextStyle(
                fontSize: 18,
                color: isDark ? Colors.white70 : Colors.grey[600],
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
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
    return SizedBox(
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
  final hour = local.hour > 12
      ? local.hour - 12
      : (local.hour == 0 ? 12 : local.hour);
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
