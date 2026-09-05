import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/announcement_service.dart';
import 'package:smartpdm_mobileapp/features/notifications/presentation/providers/notification_provider.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class AnnouncementsScreen extends StatefulWidget {
  const AnnouncementsScreen({super.key});

  @override
  State<AnnouncementsScreen> createState() => _AnnouncementsScreenState();
}

class _AnnouncementsScreenState extends State<AnnouncementsScreen> {
  final AnnouncementService _announcementService = AnnouncementService();

  String _selectedFilter = 'All';
  bool _isLoading = true;
  String? _errorMessage;
  List<MobileAnnouncement> _announcements = const [];
  NotificationProvider? _notificationProvider;
  int _lastAnnouncementRevision = 0;
  Timer? _liveSyncTimer;
  bool _fetchInProgress = false;
  bool _pendingLiveRefresh = false;

  @override
  void initState() {
    super.initState();
    _loadAnnouncements();
    _liveSyncTimer = Timer.periodic(const Duration(seconds: 6), (_) {
      if (!mounted || ModalRoute.of(context)?.isCurrent != true) return;
      _requestLiveRefresh();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    final provider = context.read<NotificationProvider>();
    if (_notificationProvider == provider) return;

    _notificationProvider?.removeListener(_handleRealtimeAnnouncements);
    _notificationProvider = provider;
    _lastAnnouncementRevision = provider.announcementRevision;
    _notificationProvider?.addListener(_handleRealtimeAnnouncements);
  }

  Future<void> _loadAnnouncements({bool silent = false}) async {
    if (_fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }

    _fetchInProgress = true;
    if (!silent && mounted) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final items = await _announcementService.fetchAnnouncements();
      if (!mounted) return;
      setState(() {
        _announcements = items;
        _errorMessage = null;
      });
    } catch (error) {
      if (!mounted) return;
      if (!silent || _announcements.isEmpty) {
        setState(() {
          _errorMessage = error.toString().replaceFirst('Exception: ', '').trim();
        });
      }
    } finally {
      _fetchInProgress = false;
      if (mounted && !silent) setState(() => _isLoading = false);
      if (_pendingLiveRefresh && mounted) {
        _pendingLiveRefresh = false;
        scheduleMicrotask(() => _loadAnnouncements(silent: true));
      }
    }
  }

  void _requestLiveRefresh() {
    if (!mounted) return;
    if (_fetchInProgress) {
      _pendingLiveRefresh = true;
      return;
    }
    _loadAnnouncements(silent: true);
  }

  void _handleRealtimeAnnouncements() {
    final provider = _notificationProvider;
    if (provider == null ||
        provider.announcementRevision == _lastAnnouncementRevision) {
      return;
    }
    _lastAnnouncementRevision = provider.announcementRevision;
    _requestLiveRefresh();
  }

  @override
  void dispose() {
    _liveSyncTimer?.cancel();
    _notificationProvider?.removeListener(_handleRealtimeAnnouncements);
    super.dispose();
  }

  List<MobileAnnouncement> _getFilteredAnnouncements() {
    if (_selectedFilter == 'All') return _announcements;
    return _announcements
        .where((item) => _labelForAudience(item.audienceKey) == _selectedFilter)
        .toList();
  }

  String _labelForAudience(String audienceKey) {
    switch (audienceKey.toLowerCase()) {
      case 'applicants':
        return 'Applicants';
      case 'scholars':
      case 'tes':
      case 'tdp':
        return 'Scholars';
      case 'all':
        return 'All';
      default:
        return 'Targeted';
    }
  }

  AppStatusTone _toneForAudience(String category) {
    switch (category) {
      case 'Applicants':
        return AppStatusTone.inProgress;
      case 'Scholars':
        return AppStatusTone.brand;
      case 'Targeted':
        return AppStatusTone.actionRequired;
      default:
        return AppStatusTone.neutral;
    }
  }

  String _formatDate(DateTime value) =>
      DateFormat('MMMM d, yyyy').format(value.toLocal());

  @override
  Widget build(BuildContext context) {
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    final selectedTabIndex = args?['selectedTabIndex'] as int? ?? 0;
    final filtered = _getFilteredAnnouncements();

    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Announcements')),
      selectedIndex: selectedTabIndex,
      child: ColoredBox(
        color: AppSurfacePalette.background(context),
        child: RefreshIndicator(
          onRefresh: _loadAnnouncements,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg,
              AppSpacing.md,
              AppSpacing.lg,
              AppSpacing.xxl,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip('All'),
                      _buildFilterChip('Applicants'),
                      _buildFilterChip('Scholars'),
                      _buildFilterChip('Targeted'),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                if (_isLoading)
                  const Padding(
                    padding: EdgeInsets.only(top: AppSpacing.jumbo),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (_errorMessage != null)
                  _buildErrorState()
                else ...[
                  AppSectionHeading(
                    title: 'Latest announcements',
                    subtitle: '${filtered.length} announcement${filtered.length == 1 ? '' : 's'} in this view',
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (filtered.isEmpty)
                    AppSurfaceCard(
                      child: Text(
                        'No announcements are available for this filter right now.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppSurfacePalette.mutedText(context),
                            ),
                      ),
                    )
                  else
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: filtered.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(height: AppSpacing.md),
                      itemBuilder: (context, index) {
                        final announcement = filtered[index];
                        return _AnnouncementListCard(
                          announcement: announcement,
                          category: _labelForAudience(announcement.audienceKey),
                          categoryTone: _toneForAudience(
                            _labelForAudience(announcement.audienceKey),
                          ),
                          dateLabel: _formatDate(announcement.date),
                          onTap: () => _openAnnouncement(announcement),
                        );
                      },
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    final isSelected = _selectedFilter == label;
    return Padding(
      padding: const EdgeInsets.only(right: AppSpacing.sm),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        showCheckmark: false,
        onSelected: (_) => setState(() => _selectedFilter = label),
      ),
    );
  }

  Widget _buildErrorState() {
    return AppSurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppIconTile(icon: Icons.cloud_off_rounded),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Unable to load announcements',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: AppSurfacePalette.text(context),
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            _errorMessage ?? '',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppSurfacePalette.mutedText(context),
                ),
          ),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: _loadAnnouncements,
            child: const Text('Try Again'),
          ),
        ],
      ),
    );
  }

  Future<void> _openAnnouncement(MobileAnnouncement announcement) async {
    _announcementService.markViewed(announcement.announcementId).catchError(
      (error) => debugPrint('ANNOUNCEMENT VIEW TRACKING ERROR: $error'),
    );

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _buildAnnouncementDetail(announcement),
    );
  }

  Widget _buildAnnouncementDetail(MobileAnnouncement announcement) {
    final category = _labelForAudience(announcement.audienceKey);
    return DraggableScrollableSheet(
      expand: false,
      minChildSize: 0.36,
      initialChildSize: 0.68,
      maxChildSize: 0.92,
      builder: (context, scrollController) => SingleChildScrollView(
        controller: scrollController,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.xl,
          AppSpacing.sm,
          AppSpacing.xl,
          AppSpacing.xxl,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    announcement.title,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: AppSurfacePalette.text(context),
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                AppStatusCapsule(
                  label: category,
                  tone: _toneForAudience(category),
                  compact: true,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              _formatDate(announcement.date),
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: AppSurfacePalette.mutedText(context),
                  ),
            ),
            const SizedBox(height: AppSpacing.xl),
            SelectableText(
              announcement.content,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppSurfacePalette.text(context),
                    height: 1.6,
                  ),
            ),
            const SizedBox(height: AppSpacing.xxl),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Close'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnnouncementListCard extends StatelessWidget {
  const _AnnouncementListCard({
    required this.announcement,
    required this.category,
    required this.categoryTone,
    required this.dateLabel,
    required this.onTap,
  });

  final MobileAnnouncement announcement;
  final String category;
  final AppStatusTone categoryTone;
  final String dateLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppSurfaceCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AppIconTile(icon: Icons.campaign_rounded),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  announcement.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppSurfacePalette.text(context),
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              AppStatusCapsule(
                label: category,
                tone: categoryTone,
                compact: true,
              ),
              const Spacer(),
              Text(
                dateLabel,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      color: AppSurfacePalette.mutedText(context),
                    ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            announcement.content,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppSurfacePalette.mutedText(context),
                  height: 1.4,
                ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            'Read announcement',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w800,
                ),
          ),
        ],
      ),
    );
  }
}
