import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:smartpdm_mobileapp/app/routes/app_navigator.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_button_styles.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/app/theme/app_status_colors.dart';
import 'package:smartpdm_mobileapp/core/realtime/mobile_realtime_service.dart';
import 'package:smartpdm_mobileapp/features/messaging/data/services/message_service.dart';
import 'package:smartpdm_mobileapp/features/messaging/presentation/providers/messaging_provider.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

String _messagePreview(String? value, String fallback) {
  final normalized = (value ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();
  return normalized.isEmpty ? fallback : normalized;
}

String _groupMessagePreview(ChatRoom room, String currentUserId) {
  final message = _messagePreview(
    room.lastMessage,
    room.readOnly ? 'Previous group · read-only history' : 'Group chat',
  );
  if (room.readOnly ||
      room.lastMessage.trim().isEmpty ||
      room.lastSenderId.trim().isEmpty ||
      room.lastMessageSubject.toLowerCase() == 'system') {
    return message;
  }

  if (room.lastSenderId == currentUserId) return 'You: $message';
  final senderName = room.lastSenderName.trim();
  final firstName = senderName.isEmpty
      ? 'Member'
      : senderName.split(RegExp(r'\s+')).first;
  return '$firstName: $message';
}

// SMART-PDM_MOBILE_MESSAGING_LIST_RESPONSIVE_PHASE5_V1
// SMART-PDM_MOBILE_MESSAGING_REFACTOR_FINAL_V2
// SMART-PDM_MOBILE_MESSAGING_REFACTOR_FINAL_V3

enum _MessageListFilter { all, unread, groups }

class _ConversationListEntry {
  const _ConversationListEntry.support(this.support) : room = null;
  const _ConversationListEntry.room(this.room) : support = null;

  final SupportConversation? support;
  final ChatRoom? room;

  DateTime? get lastSentAt => support?.lastSentAt ?? room?.lastSentAt;
}

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  final MessageService _messageService = MessageService();
  final TextEditingController _searchController = TextEditingController();

  MessagingProvider? _provider;
  Timer? _liveSyncTimer;
  Timer? _supportRefreshDebounce;
  bool _refreshing = false;
  bool _supportRefreshing = false;
  String _searchQuery = '';
  String? _supportError;
  _MessageListFilter _selectedFilter = _MessageListFilter.all;
  List<SupportConversation> _supportConversations = const [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await _refreshMessaging();
      _startLiveSyncWatchdog();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final provider = context.read<MessagingProvider>();
    if (identical(provider, _provider)) return;

    _provider?.removeListener(_handleMessagingChanged);
    _provider = provider;
    _provider?.addListener(_handleMessagingChanged);
  }

  void _handleMessagingChanged() {
    _supportRefreshDebounce?.cancel();
    _supportRefreshDebounce = Timer(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      unawaited(_refreshSupportConversations());
    });
  }

  void _startLiveSyncWatchdog() {
    _liveSyncTimer?.cancel();
    _liveSyncTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
      if (MobileRealtimeService.instance.isRealtimeHealthy) {
        unawaited(_refreshSupportConversations());
      } else {
        unawaited(_refreshMessaging());
      }
    });
  }

  Future<void> _refreshSupportConversations() async {
    if (_supportRefreshing) return;
    _supportRefreshing = true;
    try {
      final items = await _messageService.fetchSupportConversations();
      if (!mounted) return;
      setState(() {
        _supportConversations = items;
        _supportError = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _supportError = 'We could not load private conversations. Try again.';
      });
    } finally {
      _supportRefreshing = false;
    }
  }

  Future<void> _refreshMessaging() async {
    if (_refreshing) return;
    _refreshing = true;
    try {
      final provider = _provider ?? context.read<MessagingProvider>();
      await provider.initializeChat();
      await provider.fetchArchivedThreads(notify: false);
      await provider.fetchGroups(notify: false);
      await provider.refreshUnreadCount(notify: false);
      await _refreshSupportConversations();
    } finally {
      _refreshing = false;
    }
  }

  @override
  void dispose() {
    _provider?.removeListener(_handleMessagingChanged);
    _supportRefreshDebounce?.cancel();
    _liveSyncTimer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openSupportThread(SupportConversation conversation) async {
    MessageService.selectSupportConversation(conversation);
    await AppNavigator.pushDetail(
      context,
      AppRoutes.chatThread,
      arguments: {
        'counterpartyId': conversation.counterpartyId,
        'title': conversation.title,
      },
    );
    if (!mounted) return;
    await (_provider ?? context.read<MessagingProvider>()).refreshUnreadCount(
      notify: false,
    );
    await _refreshSupportConversations();
  }

  Future<void> _openGroupThread(String roomId, String roomName) async {
    MessageService.selectSupportConversation(null);
    await AppNavigator.pushDetail(
      context,
      AppRoutes.chatThread,
      arguments: {'roomId': roomId, 'title': roomName},
    );
    if (!mounted) return;
    final provider = _provider ?? context.read<MessagingProvider>();
    await provider.fetchGroups(notify: false);
    await provider.refreshUnreadCount(notify: false);
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

  Future<void> _archiveSupport(SupportConversation conversation) async {
    if (!await _confirmArchive(conversation.title) || !mounted) return;
    try {
      await _messageService.archiveSupportConversation(
        conversation.counterpartyId,
      );
      await _refreshSupportConversations();
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
      await (_provider ?? context.read<MessagingProvider>()).archiveRoom(
        room.roomId,
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to archive group conversation.')),
      );
    }
  }

  Future<void> _showArchivedThreads() async {
    final provider = _provider ?? context.read<MessagingProvider>();
    List<SupportConversation> supportItems = const [];
    try {
      supportItems = await _messageService.fetchArchivedSupportConversations();
    } catch (_) {
      supportItems = const [];
    }
    await provider.fetchArchivedThreads(notify: false);
    if (!mounted) return;

    final groupItems = provider.archivedThreads
        .where((item) => item.isGroup)
        .toList(growable: false);

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => _ArchivedThreadsSheet(
        supportItems: supportItems,
        groupItems: groupItems,
        onRestoreSupport: (item) async {
          await _messageService.restoreSupportConversation(item.counterpartyId);
          await _refreshSupportConversations();
        },
        onRestoreGroup: (item) async {
          await provider.restoreArchivedThread(item);
          await _refreshMessaging();
        },
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

  IconData _supportIcon(SupportConversation conversation) {
    switch (conversation.role.toLowerCase()) {
      case 'sdo':
        return Icons.gavel_rounded;
      case 'guidance':
        return Icons.psychology_rounded;
      case 'pd':
        return Icons.school_rounded;
      case 'ro_coordinator':
        return Icons.assignment_turned_in_rounded;
      default:
        return Icons.support_agent_rounded;
    }
  }

  Color _supportAccent(BuildContext context, SupportConversation conversation) {
    switch (conversation.role.toLowerCase()) {
      case 'sdo':
        return Theme.of(context).extension<AppStatusColors>()!.dangerOutline;
      case 'guidance':
        return AppColors.teal;
      case 'pd':
        return AppColors.magenta;
      case 'ro_coordinator':
        return AppColors.orange;
      default:
        return AppColors.gold;
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<MessagingProvider>();
    final mutedColor = AppSurfacePalette.mutedText(context);

    final visibleSupport = _selectedFilter == _MessageListFilter.groups
        ? const <SupportConversation>[]
        : _supportConversations.where((conversation) {
            if (_selectedFilter == _MessageListFilter.unread &&
                conversation.unreadCount <= 0) {
              return false;
            }
            final preview = _messagePreview(
              conversation.lastMessage,
              'Private conversation',
            );
            return _matchesSearch(conversation.title, preview) ||
                _matchesSearch(conversation.personName, preview);
          }).toList(growable: false);

    SupportConversation? pinnedConversation;
    for (final conversation in visibleSupport) {
      if (conversation.pinned) {
        pinnedConversation = conversation;
        break;
      }
    }
    final otherSupport = visibleSupport
        .where((conversation) => !conversation.pinned)
        .toList(growable: false);

    final visibleRooms = provider.rooms.where((room) {
      if (_selectedFilter == _MessageListFilter.unread &&
          room.unreadCount <= 0) {
        return false;
      }
      final preview = _groupMessagePreview(room, provider.currentUserId);
      return _matchesSearch(room.roomName, preview);
    }).toList(growable: false);

    final remainingConversations = <_ConversationListEntry>[
      ...otherSupport.map(_ConversationListEntry.support),
      ...visibleRooms.map(_ConversationListEntry.room),
    ]..sort((left, right) {
        final leftTime = left.lastSentAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        final rightTime = right.lastSentAt ?? DateTime.fromMillisecondsSinceEpoch(0);
        return rightTime.compareTo(leftTime);
      });

    final totalUnread = _supportConversations.fold<int>(
          0,
          (sum, conversation) => sum + conversation.unreadCount,
        ) +
        provider.rooms.fold<int>(
          0,
          (sum, room) => sum + (room.readOnly ? 0 : room.unreadCount),
        );

    final hasOtherConversations = remainingConversations.isNotEmpty;
    final hasVisibleConversation =
        pinnedConversation != null || hasOtherConversations;
    final errorMessage = _supportError ?? provider.errorMessage;

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
        foregroundColor: AppSurfacePalette.text(context),
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
                    borderRadius: BorderRadius.circular(18),
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(18),
                    borderSide: const BorderSide(
                      color: AppColors.gold,
                      width: 1.2,
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
                    count: totalUnread,
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
              if (pinnedConversation != null)
                _ConversationTile(
                  icon: _supportIcon(pinnedConversation),
                  title: pinnedConversation.title,
                  subtitle: _messagePreview(
                    pinnedConversation.lastMessage,
                    'Start a private conversation',
                  ),
                  timeLabel: _conversationTime(pinnedConversation.lastSentAt),
                  unreadCount: pinnedConversation.unreadCount,
                  accentColor: _supportAccent(context, pinnedConversation),
                  schoolLogo: true,
                  pinned: true,
                  onTap: () => _openSupportThread(pinnedConversation!),
                  onArchive: () => _archiveSupport(pinnedConversation!),
                ),
              if (pinnedConversation != null && hasOtherConversations) ...[
                const SizedBox(height: 14),
                Divider(color: AppSurfacePalette.outline(context)),
                const SizedBox(height: 6),
              ],
              ...remainingConversations.map((entry) {
                final conversation = entry.support;
                if (conversation != null) {
                  return _ConversationTile(
                    icon: _supportIcon(conversation),
                    title: conversation.title,
                    subtitle: _messagePreview(
                      conversation.lastMessage,
                      conversation.position.isNotEmpty
                          ? conversation.position
                          : 'Private conversation',
                    ),
                    timeLabel: _conversationTime(conversation.lastSentAt),
                    unreadCount: conversation.unreadCount,
                    accentColor: _supportAccent(context, conversation),
                    onTap: () => _openSupportThread(conversation),
                    onArchive: () => _archiveSupport(conversation),
                  );
                }

                final room = entry.room!;
                return _ConversationTile(
                  icon: room.readOnly
                      ? Icons.history_rounded
                      : Icons.groups_rounded,
                  title: room.roomName,
                  subtitle: _groupMessagePreview(
                    room,
                    provider.currentUserId,
                  ),
                  timeLabel: _conversationTime(room.lastSentAt),
                  unreadCount: room.readOnly ? 0 : room.unreadCount,
                  accentColor: room.readOnly
                      ? AppColors.lightGray
                      : AppColors.brown,
                  readOnly: room.readOnly,
                  onTap: () => _openGroupThread(room.roomId, room.roomName),
                  onArchive: room.readOnly ? null : () => _archiveGroup(room),
                );
              }),
              if ((provider.isLoading || _supportRefreshing) &&
                  !hasVisibleConversation)
                const Padding(
                  padding: EdgeInsets.only(top: 42),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (!hasVisibleConversation)
                _EmptyConversationState(
                  filter: _selectedFilter,
                  hasSearch: _searchQuery.trim().isNotEmpty,
                  errorMessage: errorMessage,
                  onRetry: _refreshMessaging,
                ),
              if ((provider.isLoading || _supportRefreshing) &&
                  hasVisibleConversation) ...[
                const SizedBox(height: 8),
                const Center(
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              ],
              if (errorMessage != null && hasVisibleConversation) ...[
                const SizedBox(height: 12),
                Text(
                  errorMessage,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: mutedColor,
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
          ? (isDark ? AppColors.gold : AppColors.brown)
          : AppSurfacePalette.surfaceMuted(context),
      borderRadius: AppRadii.status,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.status,
        child: Container(
          constraints: const BoxConstraints(minHeight: 38),
          padding: const EdgeInsets.symmetric(horizontal: 17, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: AppRadii.status,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: selected
                      ? (isDark ? AppColors.darkBrown : Colors.white)
                      : AppSurfacePalette.text(context),
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (count > 0) ...[
                const SizedBox(width: 7),
                Container(
                  constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
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
    this.accentColor,
    this.schoolLogo = false,
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
  final Color? accentColor;
  final bool schoolLogo;

  @override
  Widget build(BuildContext context) {
    final hasUnread = unreadCount > 0;
    final status = Theme.of(context).extension<AppStatusColors>()!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = accentColor ?? AppColors.gold;
    final iconForeground = accent.computeLuminance() > 0.52
        ? AppColors.darkBrown
        : Colors.white;
    final tileColor = pinned
        ? AppColors.gold.withValues(alpha: isDark ? 0.20 : 0.12)
        : Colors.transparent;

    return Material(
      color: tileColor,
      borderRadius: pinned ? AppRadii.card : BorderRadius.zero,
      child: InkWell(
        onTap: onTap,
        onLongPress: onArchive == null ? null : () => unawaited(onArchive!()),
        borderRadius: pinned ? AppRadii.card : BorderRadius.zero,
        child: Container(
          padding: EdgeInsets.fromLTRB(
            pinned ? 12 : 4,
            pinned ? 12 : 10,
            pinned ? 10 : 2,
            pinned ? 12 : 10,
          ),
          decoration: BoxDecoration(
            borderRadius: pinned ? AppRadii.card : BorderRadius.zero,
            border: pinned
                ? Border.all(color: AppColors.gold.withValues(alpha: 0.48))
                : Border(
                    bottom: BorderSide(
                      color: AppSurfacePalette.outline(context).withValues(alpha: 0.70),
                    ),
                  ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              CircleAvatar(
                radius: pinned ? 25 : 23,
                backgroundColor: schoolLogo
                    ? accent.withValues(alpha: isDark ? 0.28 : 0.16)
                    : accent,
                child: schoolLogo
                    ? Padding(
                        padding: const EdgeInsets.all(4),
                        child: Image.asset(
                          'assets/images/school_logo.png',
                          fit: BoxFit.contain,
                        ),
                      )
                    : Icon(
                        icon,
                        size: pinned ? 23 : 21,
                        color: iconForeground,
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                  color: AppSurfacePalette.text(context),
                                  fontWeight: hasUnread || pinned
                                      ? FontWeight.w900
                                      : FontWeight.w800,
                                ),
                          ),
                        ),
                        if (pinned) ...[
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.push_pin_rounded,
                            size: 15,
                            color: AppColors.gold,
                          ),
                        ],
                      ],
                    ),
                    if (readOnly) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Read only',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: AppColors.gold,
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                    ],
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      maxLines: pinned ? 2 : 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: hasUnread
                                ? AppSurfacePalette.text(context)
                                : AppSurfacePalette.mutedText(context),
                            fontWeight: hasUnread ? FontWeight.w700 : FontWeight.w500,
                            height: 1.3,
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (timeLabel.isNotEmpty)
                    Text(
                      timeLabel,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: AppSurfacePalette.mutedText(context),
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  const SizedBox(height: 7),
                  if (unreadCount > 0)
                    Container(
                      constraints: const BoxConstraints(minWidth: 23, minHeight: 23),
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      decoration: BoxDecoration(
                        color: pinned ? status.dangerOutline : AppColors.gold,
                        shape: unreadCount < 10 ? BoxShape.circle : BoxShape.rectangle,
                        borderRadius: unreadCount < 10 ? null : AppRadii.status,
                      ),
                      child: Text(
                        unreadCount > 99 ? '99+' : '$unreadCount',
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: pinned ? Colors.white : AppColors.darkBrown,
                              fontWeight: FontWeight.w900,
                            ),
                      ),
                    )
                  else
                    Icon(
                      readOnly ? Icons.history_rounded : Icons.chevron_right_rounded,
                      size: 21,
                      color: readOnly
                          ? AppColors.gold
                          : AppSurfacePalette.mutedText(context),
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

class _ArchivedThreadsSheet extends StatefulWidget {
  const _ArchivedThreadsSheet({
    required this.supportItems,
    required this.groupItems,
    required this.onRestoreSupport,
    required this.onRestoreGroup,
  });

  final List<SupportConversation> supportItems;
  final List<ArchivedMessageThread> groupItems;
  final Future<void> Function(SupportConversation item) onRestoreSupport;
  final Future<void> Function(ArchivedMessageThread item) onRestoreGroup;

  @override
  State<_ArchivedThreadsSheet> createState() => _ArchivedThreadsSheetState();
}

class _ArchivedThreadsSheetState extends State<_ArchivedThreadsSheet> {
  late final List<SupportConversation> _supportItems = [
    ...widget.supportItems,
  ];
  late final List<ArchivedMessageThread> _groupItems = [...widget.groupItems];
  final Set<String> _restoring = <String>{};

  Future<void> _restoreSupport(SupportConversation item) async {
    final key = 'private:${item.counterpartyId}';
    if (_restoring.contains(key)) return;
    setState(() => _restoring.add(key));
    try {
      await widget.onRestoreSupport(item);
      if (!mounted) return;
      setState(() => _supportItems.remove(item));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Conversation restored.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to restore conversation.')),
      );
    } finally {
      if (mounted) setState(() => _restoring.remove(key));
    }
  }

  Future<void> _restoreGroup(ArchivedMessageThread item) async {
    final key = 'group:${item.roomId ?? item.archiveId}';
    if (_restoring.contains(key)) return;
    setState(() => _restoring.add(key));
    try {
      await widget.onRestoreGroup(item);
      if (!mounted) return;
      setState(() => _groupItems.remove(item));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Conversation restored.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to restore conversation.')),
      );
    } finally {
      if (mounted) setState(() => _restoring.remove(key));
    }
  }

  @override
  Widget build(BuildContext context) {
    final total = _supportItems.length + _groupItems.length;
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
                    'Archived Messages',
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
            if (total == 0)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 28),
                child: Center(child: Text('No archived conversations.')),
              )
            else
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(context).height * 0.55,
                ),
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    ..._supportItems.map(
                      (item) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.support_agent_rounded),
                        title: Text(item.title),
                        subtitle: Text(
                          item.position.isNotEmpty
                              ? item.position
                              : 'Private conversation',
                        ),
                        trailing: TextButton(
                          onPressed: _restoring.contains(
                            'private:${item.counterpartyId}',
                          )
                              ? null
                              : () => _restoreSupport(item),
                          child: const Text('Restore'),
                        ),
                      ),
                    ),
                    ..._groupItems.map(
                      (item) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.groups_rounded),
                        title: Text(item.name),
                        subtitle: const Text('Group conversation'),
                        trailing: TextButton(
                          onPressed: _restoring.contains(
                            'group:${item.roomId ?? item.archiveId}',
                          )
                              ? null
                              : () => _restoreGroup(item),
                          child: const Text('Restore'),
                        ),
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
