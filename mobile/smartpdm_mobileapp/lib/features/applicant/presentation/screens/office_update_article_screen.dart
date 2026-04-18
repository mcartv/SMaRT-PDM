import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/shared/widgets/smart_pdm_page_scaffold.dart';

class OfficeUpdateArticleScreen extends StatelessWidget {
  const OfficeUpdateArticleScreen({
    super.key,
    required this.notification,
    this.showBottomNav = true,
  });

  final AppNotification notification;
  final bool showBottomNav;

  void _openOpenings(BuildContext context) {
    Navigator.pushNamed(context, AppRoutes.scholarshipOpenings);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDark ? Colors.white : AppColors.darkBrown;
    final bodyColor = isDark ? Colors.white70 : Colors.black87;
    final surfaceColor = isDark ? const Color(0xFF2D1E12) : Colors.white;

    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Office Update')),
      selectedIndex: 2,
      showBottomNav: showBottomNav,
      showDrawer: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: surfaceColor,
                borderRadius: BorderRadius.circular(22),
                border: Border.all(
                  color: notification.accentColor.withOpacity(0.32),
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x12000000),
                    blurRadius: 12,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 7,
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
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    notification.title,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                      height: 1.1,
                      color: titleColor,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(
                        Icons.schedule_outlined,
                        size: 18,
                        color: isDark ? Colors.white54 : Colors.grey,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _formatArticleTimestamp(notification.createdAt),
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark ? Colors.white60 : Colors.grey[700],
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  Text(
                    notification.previewText,
                    style: TextStyle(
                      fontSize: 16,
                      height: 1.7,
                      color: bodyColor,
                    ),
                  ),
                  if (notification.isOpeningUpdate) ...[
                    const SizedBox(height: 28),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: notification.accentColor.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Ready to apply?',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: titleColor,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'View available scholarship openings and continue your application flow from there.',
                            style: TextStyle(color: bodyColor, height: 1.45),
                          ),
                          const SizedBox(height: 14),
                          Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              ElevatedButton(
                                onPressed: () => _openOpenings(context),
                                child: const Text('Apply Now'),
                              ),
                              OutlinedButton(
                                onPressed: () => _openOpenings(context),
                                child: const Text('View Scholarship Openings'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
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

  if (month < 1 || month > 12) {
    return 'Date';
  }

  return labels[month - 1];
}
