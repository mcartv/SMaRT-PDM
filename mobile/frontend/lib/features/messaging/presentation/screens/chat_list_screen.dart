import 'dart:async';

import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:provider/provider.dart';

import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_button_styles.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/features/messaging/data/services/message_service.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

String _messagePreview(String? value, String fallback) {
  final normalized = (value ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();
  return normalized.isEmpty ? fallback : normalized;
}

// SMART-PDM_MOBILE_MESSAGING_LIST_RESPONSIVE_PHASE5_V1
// SMART-PDM_MOBILE_MESSAGING_REFACTOR_FINAL_V1

enum _MessageListFilter { all, unread, groups }

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});
  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  Timer? _liveSyncTimer;
  bool _refreshing = false;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  _MessageListFilter _selectedFilter = _MessageListFilter.all;

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
    _liveSyncTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
      if (MobileRealtimeService.instance.isRealtimeHealthy) return;
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
    _searchController.dispose();
    super.dispose();
  }

  void _openAdminThread() =>
      AppNavigator.pushDetail(context, AppRoutes.chatThread);

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
            content: Text(
              '$title will be hidden from your conversation list. A new message will automatically bring it back.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                style: AppButtonStyles.destructiveText(dialogContext),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                style: AppButtonStyles.destructiveFilled(dialogContext),
                child: const Text('Archive'),
              ),
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to archive conversation.')),
      );
    }
  }

  Future<void> _archiveGroup(ChatRoom room) async {
    if (room.readOnly) return;
    if (!await _confirmArchive(room.roomName) || !mounted) return;
    try {
      await context.read<MessagingProvider>().archiveRoom(room.roomId);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to archive group conversation.')),
      );
    }
  }

  Future<void> _showArchivedThreads() async {
    final provider = context.read<MessagingProvider>();
    await provider.fetchArchivedThreads();
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) =>
          ChangeNotifierProvider<MessagingProvider>.value(
            value: provider,
            child: const _ArchivedThreadsSheet(),
          ),
    );
  }

  String _conversationTime(DateTime? value) {
    if (value == null) return '';
    final local = value.toLocal();
    final now = DateTime.now();
    final sameDay =
        local.year == now.year &&
        local.month == now.month &&
        local.day == now.day;
    if (sameDay) {
      final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
      final minute = local.minute.toString().padLeft(2, '0');
      return '$hour:$minute ${local.hour >= 12 ? 'PM' : 'AM'}';
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
    return '${months[local.month - 1]} ${local.day}';
  }

  bool _matchesSearch(String title, String preview) {
    final query = _searchQuery.trim().toLowerCase();
    if (query.isEmpty) return true;
    return title.toLowerCase().contains(query) ||
        preview.toLowerCase().contains(query);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagingProvider>();
    final titleColor = AppSurfacePalette.text(context);
    final mutedColor = AppSurfacePalette.mutedText(context);
    final privatePreview = _messagePreview(
      provider.privatePreview?.messageBody,
      'Start a private conversation',
    );
    final privateMatches = _matchesSearch('OSFA Administrator', privatePreview);
    final showPrivate =
        !provider.isPrivateThreadArchived &&
        _selectedFilter != _MessageListFilter.groups &&
        (_selectedFilter != _MessageListFilter.unread ||
            provider.privateUnreadCount > 0) &&
        privateMatches;

    final visibleRooms = provider.rooms
        .where((room) {
          if (_selectedFilter == _MessageListFilter.unread &&
              room.unreadCount <= 0) {
            return false;
          }
          final preview = _messagePreview(
            room.lastMessage,
            room.readOnly ? 'Previous group · read-only history' : 'Group chat',
          );
          return _matchesSearch(room.roomName, preview);
        })
        .toList(growable: false);

    final showArchivedPrivateHint =
        provider.isPrivateThreadArchived &&
        _selectedFilter == _MessageListFilter.all &&
        _searchQuery.trim().isEmpty;
    final hasVisibleConversation =
        showPrivate || visibleRooms.isNotEmpty || showArchivedPrivateHint;

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
        backgroundColor: AppSurfacePalette.surface(context),
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
        color: AppSurfacePalette.background(context),
        child: RefreshIndicator(
          color: AppColors.gold,
          onRefresh: _refreshMessaging,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.xxl,
            ),
            children: [
              TextField(
                controller: _searchController,
                onChanged: (value) => setState(() => _searchQuery = value),
                decoration: InputDecoration(
                  hintText: 'Search messages',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _searchQuery.trim().isEmpty
                      ? null
                      : IconButton(
                          tooltip: 'Clear search',
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _searchQuery = '');
                          },
                          icon: const Icon(Icons.close_rounded),
                        ),
                  filled: true,
                  fillColor: AppSurfacePalette.surfaceMuted(context),
                  border: OutlineInputBorder(
                    borderRadius: AppRadii.control,
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: AppRadii.control,
                    borderSide: BorderSide(
                      color: AppSurfacePalette.outline(context),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _MessageFilterChip(
                    label: 'All',
                    selected: _selectedFilter == _MessageListFilter.all,
                    onTap: () => setState(
                      () => _selectedFilter = _MessageListFilter.all,
                    ),
                  ),
                  _MessageFilterChip(
                    label: 'Unread',
                    count: provider.unreadCount,
                    selected: _selectedFilter == _MessageListFilter.unread,
                    onTap: () => setState(
                      () => _selectedFilter = _MessageListFilter.unread,
                    ),
                  ),
                  _MessageFilterChip(
                    label: 'Groups',
                    selected: _selectedFilter == _MessageListFilter.groups,
                    onTap: () => setState(
                      () => _selectedFilter = _MessageListFilter.groups,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (showPrivate)
                _ConversationTile(
                  icon: Icons.support_agent_rounded,
                  title: 'OSFA Administrator',
                  subtitle: privatePreview,
                  timeLabel: _conversationTime(provider.privatePreview?.sentAt),
                  unreadCount: provider.privateUnreadCount,
                  pinned: true,
                  onTap: _openAdminThread,
                  onArchive: _archivePrivateThread,
                )
              else if (showArchivedPrivateHint)
                _ArchivedHint(onOpenArchived: _showArchivedThreads),
              if (showPrivate && visibleRooms.isNotEmpty) ...[
                const SizedBox(height: 14),
                Divider(color: AppSurfacePalette.outline(context)),
                const SizedBox(height: 6),
              ],
              if (provider.isLoading && !hasVisibleConversation)
                const Padding(
                  padding: EdgeInsets.only(top: 42),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (visibleRooms.isNotEmpty)
                ...visibleRooms.map(
                  (room) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _ConversationTile(
                      icon: room.readOnly
                          ? Icons.history_rounded
                          : Icons.groups_rounded,
                      title: room.roomName,
                      subtitle: _messagePreview(
                        room.lastMessage,
                        room.readOnly
                            ? 'Previous group · read-only history'
                            : 'Group chat',
                      ),
                      timeLabel: _conversationTime(room.lastSentAt),
                      unreadCount: room.readOnly ? 0 : room.unreadCount,
                      readOnly: room.readOnly,
                      onTap: () => _openGroupThread(room.roomId, room.roomName),
                      onArchive: room.readOnly
                          ? null
                          : () => _archiveGroup(room),
                    ),
                  ),
                )
              else if (!hasVisibleConversation)
                _EmptyConversationState(
                  filter: _selectedFilter,
                  hasSearch: _searchQuery.trim().isNotEmpty,
                  errorMessage: provider.errorMessage,
                  onRetry: _refreshMessaging,
                ),
              if (provider.isLoading && hasVisibleConversation) ...[
                const SizedBox(height: 8),
                Center(
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              ],
              if (provider.errorMessage != null && hasVisibleConversation) ...[
                const SizedBox(height: 12),
                Text(
                  provider.errorMessage!,
                  textAlign: TextAlign.center,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: mutedColor),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MessageFilterChip extends StatelessWidget {
  const _MessageFilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.count = 0,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final int count;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: selected
          ? AppColors.gold.withValues(alpha: isDark ? 0.28 : 0.20)
          : AppSurfacePalette.surface(context),
      borderRadius: AppRadii.status,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.status,
        child: Container(
          constraints: const BoxConstraints(minHeight: 42),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          decoration: BoxDecoration(
            borderRadius: AppRadii.status,
            border: Border.all(
              color: selected
                  ? AppColors.gold.withValues(alpha: 0.65)
                  : AppSurfacePalette.outline(context),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: selected
                      ? (isDark
                            ? AppColors.applicantDarkText
                            : AppColors.darkBrown)
                      : AppSurfacePalette.text(context),
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (count > 0) ...[
                const SizedBox(width: 7),
                Container(
                  constraints: const BoxConstraints(
                    minWidth: 20,
                    minHeight: 20,
                  ),
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 5),
                  decoration: BoxDecoration(
                    color: AppColors.gold,
                    borderRadius: AppRadii.status,
                  ),
                  child: Text(
                    count > 99 ? '99+' : '$count',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.darkBrown,
                      fontWeight: FontWeight.w900,
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

class _EmptyConversationState extends StatelessWidget {
  const _EmptyConversationState({
    required this.filter,
    required this.hasSearch,
    required this.errorMessage,
    required this.onRetry,
  });

  final _MessageListFilter filter;
  final bool hasSearch;
  final String? errorMessage;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final title = errorMessage != null
        ? 'Unable to load messages'
        : hasSearch
        ? 'No matching conversations'
        : filter == _MessageListFilter.unread
        ? 'No unread messages'
        : filter == _MessageListFilter.groups
        ? 'No group chats yet'
        : 'No conversations yet';
    final detail =
        errorMessage ??
        (hasSearch
            ? 'Try another name or message.'
            : filter == _MessageListFilter.groups
            ? 'Group chats assigned to you will appear here.'
            : filter == _MessageListFilter.unread
            ? 'New unread conversations will appear here.'
            : 'Your conversations will appear here.');

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 44, 12, 20),
      child: Column(
        children: [
          AppIconTile(
            icon: errorMessage != null
                ? Icons.cloud_off_rounded
                : Icons.chat_bubble_outline_rounded,
          ),
          const SizedBox(height: 12),
          Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: AppSurfacePalette.text(context),
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            detail,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppSurfacePalette.mutedText(context),
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

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.unreadCount,
    required this.onTap,
    this.timeLabel = '',
    this.onArchive,
    this.readOnly = false,
    this.pinned = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final int unreadCount;
  final VoidCallback onTap;
  final String timeLabel;
  final Future<void> Function()? onArchive;
  final bool readOnly;
  final bool pinned;

  @override
  Widget build(BuildContext context) {
    final hasUnread = unreadCount > 0;
    final status = Theme.of(context).extension<AppStatusColors>()!;

    return Material(
      color: pinned
          ? AppColors.gold.withValues(
              alpha: Theme.of(context).brightness == Brightness.dark
                  ? 0.16
                  : 0.10,
            )
          : hasUnread
          ? AppColors.gold.withValues(
              alpha: Theme.of(context).brightness == Brightness.dark
                  ? 0.12
                  : 0.08,
            )
          : AppSurfacePalette.surface(context),
      borderRadius: AppRadii.card,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.card,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: AppRadii.card,
            border: Border.all(
              color: pinned
                  ? AppColors.gold.withValues(alpha: 0.58)
                  : AppSurfacePalette.outline(context),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppIconTile(icon: icon),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            softWrap: true,
                            style: Theme.of(context).textTheme.titleSmall
                                ?.copyWith(
                                  color: AppSurfacePalette.text(context),
                                  fontWeight: hasUnread || pinned
                                      ? FontWeight.w900
                                      : FontWeight.w700,
                                ),
                          ),
                        ),
                        if (pinned) ...[
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.push_pin_rounded,
                            size: 16,
                            color: AppColors.gold,
                          ),
                        ],
                      ],
                    ),
                    if (readOnly) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.gold.withValues(alpha: 0.13),
                          borderRadius: AppRadii.status,
                        ),
                        child: Text(
                          'REMOVED · READ ONLY',
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: AppColors.gold,
                                fontWeight: FontWeight.w900,
                                fontSize: 9,
                              ),
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: hasUnread
                            ? AppSurfacePalette.text(context)
                            : AppSurfacePalette.mutedText(context),
                        fontWeight: hasUnread
                            ? FontWeight.w700
                            : FontWeight.w500,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (timeLabel.isNotEmpty) ...[
                    Text(
                      timeLabel,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AppSurfacePalette.mutedText(context),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                  ],
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
                        color: status.dangerOutline,
                        borderRadius: AppRadii.status,
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
                      itemBuilder: (context) => [
                        PopupMenuItem<String>(
                          value: 'archive',
                          child: Row(
                            children: [
                              Icon(
                                Icons.archive_outlined,
                                size: 19,
                                color: AppButtonStyles.destructiveColor(
                                  context,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Text(
                                'Archive',
                                style: TextStyle(
                                  color: AppButtonStyles.destructiveColor(
                                    context,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    )
                  else if (unreadCount == 0)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.sm),
                      child: Icon(
                        readOnly
                            ? Icons.history_rounded
                            : Icons.chevron_right_rounded,
                        color: readOnly
                            ? AppColors.gold
                            : AppSurfacePalette.mutedText(context),
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

class _ArchivedHint extends StatelessWidget {
  const _ArchivedHint({required this.onOpenArchived});
  final VoidCallback onOpenArchived;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: const Icon(Icons.archive_outlined),
    title: const Text('Support conversation archived'),
    subtitle: const Text(
      'It will return automatically when a new message arrives.',
    ),
    trailing: TextButton(onPressed: onOpenArchived, child: const Text('View')),
  );
}

class _ArchivedThreadsSheet extends StatelessWidget {
  const _ArchivedThreadsSheet();
  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagingProvider>();
    final items = provider.archivedThreads;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          18,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Archived chats',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (items.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 28),
                child: Center(child: Text('No archived conversations.')),
              )
            else
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(context).height * 0.55,
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = items[index];
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(
                        item.isGroup
                            ? Icons.groups_rounded
                            : Icons.support_agent_rounded,
                      ),
                      title: Text(item.name),
                      subtitle: Text(
                        item.isGroup
                            ? 'Group conversation'
                            : 'Private conversation',
                      ),
                      trailing: TextButton(
                        onPressed: () async {
                          try {
                            await provider.restoreArchivedThread(item);
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Conversation restored.'),
                              ),
                            );
                          } catch (_) {
                            if (!context.mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Unable to restore conversation.',
                                ),
                              ),
                            );
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
