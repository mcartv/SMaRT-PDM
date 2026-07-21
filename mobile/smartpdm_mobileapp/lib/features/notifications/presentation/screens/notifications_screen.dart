import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_events.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:smartpdm_mobileapp/features/applicant/presentation/screens/office_update_article_screen.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

enum _NotificationFilter { all, unread, officeUpdates, payouts, ro }

class NotificationsScreen extends StatefulWidget {
  final bool showBottomNav;

  const NotificationsScreen({super.key, this.showBottomNav = true});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  _NotificationFilter _selectedFilter = _NotificationFilter.all;

  VoidCallback? _stopRealtimeListener;
  Timer? _realtimeRefreshDebounce;
  bool _isRefreshingFromRealtime = false;

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;

      final provider = context.read<NotificationProvider>();
      await provider.initialize();

      _stopRealtimeListener ??= MobileRealtimeService.instance.listenTo(
        MobileRealtimeEvents.notificationProviderEvents,
        (event) {
          debugPrint('[NotificationsScreen] realtime event: ${event.name}');
          _scheduleRealtimeRefresh();
        },
      );
    });
  }

  void _scheduleRealtimeRefresh() {
    _realtimeRefreshDebounce?.cancel();

    _realtimeRefreshDebounce = Timer(
      const Duration(milliseconds: 450),
      () async {
        await _refreshFromRealtime();
      },
    );
  }

  Future<void> _refreshFromRealtime() async {
    if (_isRefreshingFromRealtime) return;

    _isRefreshingFromRealtime = true;

    try {
      if (!mounted) return;
      await context.read<NotificationProvider>().refresh(silent: true);
    } catch (error) {
      debugPrint('NOTIFICATIONS SCREEN REALTIME REFRESH ERROR: $error');
    } finally {
      _isRefreshingFromRealtime = false;
    }
  }

  @override
  void dispose() {
    _realtimeRefreshDebounce?.cancel();
    _realtimeRefreshDebounce = null;

    _stopRealtimeListener?.call();
    _stopRealtimeListener = null;

    super.dispose();
  }

  bool _isRoNotification(AppNotification item) {
    final type = item.type.toLowerCase();
    final title = item.title.toLowerCase();
    final message = item.message.toLowerCase();
    final referenceType = (item.referenceType ?? '').toLowerCase();

    return type.contains('ro') ||
        type.contains('obligation') ||
        type.contains('return of obligation') ||
        referenceType.contains('return_of_obligation') ||
        referenceType.contains('ro') ||
        title.contains('return') ||
        title.contains('obligation') ||
        message.contains('return of obligation');
  }

  List<AppNotification> _filteredItems(NotificationProvider provider) {
    final items = [...provider.notifications];

    items.sort((a, b) => b.createdAt.compareTo(a.createdAt));

    switch (_selectedFilter) {
      case _NotificationFilter.all:
        return items;

      case _NotificationFilter.unread:
        return items.where((item) => !item.isRead).toList();

      case _NotificationFilter.officeUpdates:
        return items.where((item) => item.isOfficeUpdate).toList();

      case _NotificationFilter.payouts:
        return items.where((item) => item.isPayoutNotification).toList();

      case _NotificationFilter.ro:
        return items.where(_isRoNotification).toList();
    }
  }

  String _filterLabel(_NotificationFilter filter) {
    switch (filter) {
      case _NotificationFilter.all:
        return 'All';
      case _NotificationFilter.unread:
        return 'Unread';
      case _NotificationFilter.officeUpdates:
        return 'Updates';
      case _NotificationFilter.payouts:
        return 'Payouts';
      case _NotificationFilter.ro:
        return 'RO';
    }
  }

  IconData _iconFor(AppNotification notification) {
    final type = notification.type.toLowerCase();
    final title = notification.title.toLowerCase();
    final referenceType = (notification.referenceType ?? '').toLowerCase();

    if (notification.isPayoutNotification ||
        type.contains('payout') ||
        title.contains('payout')) {
      return Icons.payments_rounded;
    }

    if (notification.isOpeningUpdate ||
        referenceType.contains('opening') ||
        type.contains('opening') ||
        title.contains('opening')) {
      return Icons.school_rounded;
    }

    if (notification.isAnnouncementNotification ||
        referenceType.contains('announcement') ||
        type.contains('announcement')) {
      return Icons.campaign_rounded;
    }

    if (type.contains('document') || title.contains('document')) {
      return Icons.description_rounded;
    }

    if (type.contains('application') || title.contains('application')) {
      return Icons.assignment_turned_in_rounded;
    }

    if (_isRoNotification(notification)) {
      return Icons.timer_rounded;
    }

    return Icons.notifications_rounded;
  }

  Color _accentFor(AppNotification notification) {
    final type = notification.type.toLowerCase();
    final title = notification.title.toLowerCase();

    if (notification.isPayoutNotification ||
        type.contains('payout') ||
        title.contains('payout')) {
      return const Color(0xFF16A34A);
    }

    if (type.contains('rejected') ||
        title.contains('rejected') ||
        title.contains('failed')) {
      return const Color(0xFFDC2626);
    }

    if (type.contains('warning') ||
        title.contains('required') ||
        title.contains('missing')) {
      return const Color(0xFFD97706);
    }

    if (_isRoNotification(notification)) {
      return AppColors.gold;
    }

    return AppColors.gold;
  }

  String _formatTime(DateTime value) {
    final now = DateTime.now();
    final diff = now.difference(value);

    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays == 1) return '1d ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';

    return '${value.month.toString().padLeft(2, '0')}/${value.day.toString().padLeft(2, '0')}/${value.year}';
  }

  String _sectionLabel(DateTime value) {
    final now = DateTime.now();

    final today = DateTime(now.year, now.month, now.day);
    final itemDay = DateTime(value.year, value.month, value.day);
    final diff = today.difference(itemDay).inDays;

    if (diff <= 0) return 'Today';
    if (diff == 1) return 'Yesterday';
    if (diff <= 7) return 'Earlier';

    return 'Older';
  }

  Map<String, List<AppNotification>> _groupItems(List<AppNotification> items) {
    final grouped = <String, List<AppNotification>>{};

    for (final item in items) {
      final label = _sectionLabel(item.createdAt);
      grouped.putIfAbsent(label, () => []);
      grouped[label]!.add(item);
    }

    return grouped;
  }

  Future<void> _openNotification(AppNotification notification) async {
    if (!notification.isRead) {
      await context.read<NotificationProvider>().markAsRead(
        notification.notificationId,
      );
    }

    if (!mounted) return;

    final referenceType = (notification.referenceType ?? '').toLowerCase();
    final type = notification.type.toLowerCase();
    final title = notification.title.toLowerCase();

    if (_isRoNotification(notification)) {
      Navigator.pushNamed(
        context,
        AppRoutes.roAssignment,
        arguments: {'roId': notification.referenceId},
      );
      return;
    }

    if (notification.isOfficeUpdate ||
        referenceType.contains('announcement') ||
        referenceType.contains('opening') ||
        type.contains('announcement') ||
        type.contains('opening')) {
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

    if (notification.isPayoutNotification ||
        type.contains('payout') ||
        title.contains('payout')) {
      Navigator.pushNamed(context, AppRoutes.payouts);
      return;
    }

    if (type.contains('document') || title.contains('document')) {
      Navigator.pushNamed(context, AppRoutes.documents);
      return;
    }

    if (type.contains('application') || title.contains('application')) {
      Navigator.pushNamed(context, AppRoutes.status);
      return;
    }
  }

  Future<void> _markAllAsRead(NotificationProvider provider) async {
    await provider.markAllAsRead();

    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('All notifications marked as read.'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _deleteNotification(
    NotificationProvider provider,
    AppNotification notification,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Delete notification?'),
          content: const Text(
            'This will remove the notification from your list.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626),
                foregroundColor: Colors.white,
              ),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Delete'),
            ),
          ],
        );
      },
    );

    if (confirmed != true) return;

    try {
      await provider.deleteNotification(notification.notificationId);
      await provider.refresh(silent: true);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Notification deleted.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to delete notification: $error'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  int _countForFilter(
    NotificationProvider provider,
    _NotificationFilter filter,
  ) {
    switch (filter) {
      case _NotificationFilter.all:
        return provider.notifications.length;

      case _NotificationFilter.unread:
        return provider.notifications.where((item) => !item.isRead).length;

      case _NotificationFilter.officeUpdates:
        return provider.notifications
            .where((item) => item.isOfficeUpdate)
            .length;

      case _NotificationFilter.payouts:
        return provider.notifications
            .where((item) => item.isPayoutNotification)
            .length;

      case _NotificationFilter.ro:
        return provider.notifications.where(_isRoNotification).length;
    }
  }

  Widget _buildFilterChips(NotificationProvider provider) {
    return SizedBox(
      height: 56,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 8),
        itemCount: _NotificationFilter.values.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final filter = _NotificationFilter.values[index];
          final selected = _selectedFilter == filter;
          final count = _countForFilter(provider, filter);

          return _FilterButton(
            label: _filterLabel(filter),
            count: count,
            selected: selected,
            onTap: () {
              setState(() => _selectedFilter = filter);
            },
          );
        },
      ),
    );
  }

  Widget _buildEmptyState(NotificationProvider provider) {
    final title = provider.isLoading
        ? 'Loading notifications...'
        : 'No notifications found';

    final message = provider.isLoading
        ? 'Please wait while your latest notifications are being loaded.'
        : 'New announcements, payouts, application updates, and office notices will appear here.';

    return RefreshIndicator(
      onRefresh: () => provider.refresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(
            height: MediaQuery.of(context).size.height * 0.62,
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      height: 72,
                      width: 72,
                      decoration: BoxDecoration(
                        color: AppColors.gold.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: provider.isLoading
                          ? const Padding(
                              padding: EdgeInsets.all(22),
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                              ),
                            )
                          : Icon(
                              Icons.notifications_none_rounded,
                              color: AppColors.gold,
                              size: 34,
                            ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      title,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: AppColors.black,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      message,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF8A8378),
                        height: 1.4,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 18),
                    OutlinedButton.icon(
                      onPressed: () => provider.refresh(),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Refresh'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationCard(
    NotificationProvider provider,
    AppNotification notification,
  ) {
    final accent = _accentFor(notification);
    final icon = _iconFor(notification);
    final isUnread = !notification.isRead;

    return Material(
      color: isUnread ? const Color(0xFFFFFBEB) : Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: () => _openNotification(notification),
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 14, 4, 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: isUnread
                  ? AppColors.gold.withOpacity(0.45)
                  : const Color(0xFFE8E2D8),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x09000000),
                blurRadius: 10,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: accent.withOpacity(0.13),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(icon, color: accent, size: 23),
                  ),
                  if (isUnread)
                    Positioned(
                      right: -2,
                      top: -2,
                      child: Container(
                        width: 9,
                        height: 9,
                        decoration: BoxDecoration(
                          color: AppColors.gold,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title.trim().isEmpty
                          ? 'Notification'
                          : notification.title.trim(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppColors.black,
                        fontSize: 15,
                        fontWeight: isUnread
                            ? FontWeight.w900
                            : FontWeight.w700,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      notification.message.trim().isEmpty
                          ? 'Open this notification for more details.'
                          : notification.message.trim(),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF8A8378),
                        fontSize: 13,
                        height: 1.35,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 7,
                      runSpacing: 5,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        _MetaChip(
                          label: notification.type.trim().isEmpty
                              ? 'General'
                              : notification.type.trim(),
                          color: accent,
                        ),
                        Text(
                          _formatTime(notification.createdAt),
                          style: Theme.of(context).textTheme.labelMedium
                              ?.copyWith(
                                color: const Color(0xFF9A948C),
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                tooltip: 'Notification options',
                icon: const Icon(Icons.more_vert_rounded),
                onSelected: (value) async {
                  if (value == 'read') {
                    await provider.markAsRead(notification.notificationId);
                  }

                  if (value == 'delete') {
                    await _deleteNotification(provider, notification);
                  }
                },
                itemBuilder: (context) => [
                  if (!notification.isRead)
                    const PopupMenuItem(
                      value: 'read',
                      child: Row(
                        children: [
                          Icon(Icons.mark_email_read_rounded, size: 18),
                          SizedBox(width: 10),
                          Text('Mark as read'),
                        ],
                      ),
                    ),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(Icons.delete_outline_rounded, size: 18),
                        SizedBox(width: 10),
                        Text('Delete'),
                      ],
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

  Widget _buildNotificationList(
    NotificationProvider provider,
    List<AppNotification> items,
  ) {
    if (items.isEmpty) {
      return _buildEmptyState(provider);
    }

    final grouped = _groupItems(items);
    final sectionOrder = ['Today', 'Yesterday', 'Earlier', 'Older'];

    return RefreshIndicator(
      onRefresh: () => provider.refresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          for (final section in sectionOrder)
            if ((grouped[section] ?? const []).isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(0, 12, 0, 10),
                child: Row(
                  children: [
                    Text(
                      section,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.black,
                        fontWeight: FontWeight.w900,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.gold.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        '${grouped[section]!.length}',
                        style: Theme.of(context).textTheme.labelMedium
                            ?.copyWith(
                              color: AppColors.brown,
                              fontWeight: FontWeight.w900,
                            ),
                      ),
                    ),
                  ],
                ),
              ),
              ...grouped[section]!.map(
                (notification) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _buildNotificationCard(provider, notification),
                ),
              ),
            ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SmartPdmPageScaffold(
      selectedIndex: 0,
      showDrawer: false,
      showBottomNav: widget.showBottomNav,
      applyPadding: false,
      appBar: AppBar(
        elevation: 0,
        centerTitle: false,
        backgroundColor: Colors.white,
        foregroundColor: AppColors.black,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.maybePop(context),
        ),
        title: const Text(
          'Notifications',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20),
        ),
        actions: [
          Consumer<NotificationProvider>(
            builder: (context, provider, _) {
              final hasUnread = provider.notifications.any(
                (item) => !item.isRead,
              );

              return TextButton(
                onPressed: hasUnread ? () => _markAllAsRead(provider) : null,
                child: Text(
                  hasUnread ? 'Mark all as read' : 'All read',
                  style: TextStyle(
                    color: hasUnread ? AppColors.gold : const Color(0xFFAAA49B),
                    fontWeight: FontWeight.w900,
                  ),
                ),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      child: Consumer<NotificationProvider>(
        builder: (context, provider, _) {
          final items = _filteredItems(provider);

          return Container(
            color: const Color(0xFFF7F7F6),
            child: Column(
              children: [
                if (provider.errorMessage != null &&
                    provider.errorMessage!.trim().isNotEmpty)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.fromLTRB(20, 14, 20, 0),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFFECACA)),
                    ),
                    child: Text(
                      provider.errorMessage!,
                      style: const TextStyle(
                        color: Color(0xFFB91C1C),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                _buildFilterChips(provider),
                Expanded(child: _buildNotificationList(provider, items)),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final borderColor = selected
        ? AppColors.gold.withOpacity(0.75)
        : const Color(0xFFE8E2D8);

    final backgroundColor = selected
        ? AppColors.gold.withOpacity(0.26)
        : Colors.white;

    final textColor = selected ? AppColors.darkBrown : const Color(0xFF625B52);

    return Material(
      color: backgroundColor,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          height: 38,
          constraints: const BoxConstraints(minWidth: 64, maxWidth: 132),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (selected) ...[
                Icon(Icons.check_rounded, size: 15, color: textColor),
                const SizedBox(width: 5),
              ],
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: textColor,
                    fontSize: 12,
                    fontWeight: selected ? FontWeight.w900 : FontWeight.w700,
                  ),
                ),
              ),
              if (count > 0) ...[
                const SizedBox(width: 6),
                Container(
                  constraints: const BoxConstraints(
                    minWidth: 18,
                    minHeight: 18,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 1,
                  ),
                  decoration: BoxDecoration(
                    color: selected
                        ? Colors.white.withOpacity(0.9)
                        : AppColors.gold.withOpacity(0.16),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    count > 99 ? '99+' : '$count',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: selected ? AppColors.darkBrown : AppColors.brown,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      height: 1.2,
                    ),
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

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final normalized = label.trim().isEmpty ? 'General' : label.trim();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        normalized.toUpperCase(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.25,
        ),
      ),
    );
  }
}
