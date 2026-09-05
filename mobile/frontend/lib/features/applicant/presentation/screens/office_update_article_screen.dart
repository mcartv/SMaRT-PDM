import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';
import 'package:smartpdm_mobileapp/features/applicant/data/services/announcement_service.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/shared/widgets/app_surface_widgets.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class OfficeUpdateArticleScreen extends StatefulWidget {
  const OfficeUpdateArticleScreen({
    super.key,
    required this.notification,
    this.showBottomNav = true,
  });

  final AppNotification notification;
  final bool showBottomNav;

  @override
  State<OfficeUpdateArticleScreen> createState() =>
      _OfficeUpdateArticleScreenState();
}

class _OfficeUpdateArticleScreenState extends State<OfficeUpdateArticleScreen> {
  final AnnouncementService _announcementService = AnnouncementService();

  @override
  void initState() {
    super.initState();
    final referenceId = widget.notification.referenceId?.trim() ?? '';
    if (widget.notification.isAnnouncementNotification &&
        referenceId.isNotEmpty) {
      _announcementService.markViewed(referenceId).catchError((error) {
        debugPrint('ANNOUNCEMENT VIEW TRACKING ERROR: $error');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final notification = widget.notification;
    final fullMessage = notification.message.trim();

    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Office Update')),
      selectedIndex: 2,
      showBottomNav: widget.showBottomNav,
      child: ColoredBox(
        color: AppSurfacePalette.background(context),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const AppIconTile(icon: Icons.campaign_rounded),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: AppStatusCapsule(
                      label: notification.officeUpdateLabel,
                      tone: notification.isOpeningUpdate
                          ? AppStatusTone.brand
                          : AppStatusTone.neutral,
                      compact: true,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                notification.title,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      color: AppSurfacePalette.text(context),
                      fontWeight: FontWeight.w900,
                      height: 1.12,
                    ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Icon(
                    Icons.calendar_month_outlined,
                    size: 18,
                    color: AppSurfacePalette.mutedText(context),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    _formatArticleTimestamp(notification.createdAt),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppSurfacePalette.mutedText(context),
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xxl),
              AppSectionHeading(
                title: notification.isOpeningUpdate
                    ? 'Scholarship opening'
                    : 'Announcement details',
              ),
              const SizedBox(height: AppSpacing.md),
              AppSurfaceCard(
                backgroundColor: AppSurfacePalette.surfaceMuted(context),
                child: SelectableText(
                  fullMessage.isEmpty
                      ? 'No additional announcement details were provided.'
                      : fullMessage,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: AppSurfacePalette.text(context),
                        height: 1.58,
                      ),
                ),
              ),
              if (notification.isOpeningUpdate) ...[
                const SizedBox(height: AppSpacing.lg),
                AppSurfaceCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const AppIconTile(
                            icon: Icons.description_outlined,
                            size: 52,
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Ready to apply?',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(
                                        color: AppSurfacePalette.text(context),
                                        fontWeight: FontWeight.w800,
                                      ),
                                ),
                                const SizedBox(height: AppSpacing.xs),
                                Text(
                                  'Review the available scholarship openings, eligibility, slots, and requirements before starting your application.',
                                  style: Theme.of(context)
                                      .textTheme
                                      .bodyMedium
                                      ?.copyWith(
                                        color: AppSurfacePalette.mutedText(
                                          context,
                                        ),
                                        height: 1.45,
                                      ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          onPressed: () => Navigator.pushNamed(
                            context,
                            AppRoutes.scholarshipOpenings,
                          ),
                          icon: const Icon(Icons.school_rounded),
                          label: const Text('View Scholarship Openings'),
                        ),
                      ),
                    ],
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

String _formatArticleTimestamp(DateTime timestamp) {
  final local = timestamp.toLocal();
  final month = _monthLabel(local.month);
  final minute = local.minute.toString().padLeft(2, '0');
  final hour = local.hour > 12
      ? local.hour - 12
      : (local.hour == 0 ? 12 : local.hour);
  final period = local.hour >= 12 ? 'PM' : 'AM';
  return '$month ${local.day}, ${local.year} at $hour:$minute $period';
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
  if (month < 1 || month > 12) return 'Date';
  return labels[month - 1];
}
