import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/shared/models/app_notification.dart';
import 'package:smartpdm_mobileapp/app/routes/app_routes.dart';
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
    final titleColor = isDark ? Colors.white : const Color(0xFF2A1608);
    final bodyColor = isDark ? Colors.white70 : const Color(0xFF5F5A55);
    final canvasColor = isDark
        ? const Color(0xFF1F140C)
        : const Color(0xFFF8F3ED);
    final accent = notification.accentColor;

    return SmartPdmPageScaffold(
      appBar: AppBar(title: const Text('Office Update'), centerTitle: false),
      selectedIndex: 2,
      showBottomNav: showBottomNav,
      showDrawer: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 6),
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: accent.withOpacity(0.14),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.school_rounded, color: accent, size: 22),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: accent.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    notification.officeUpdateLabel,
                    style: Theme.of(context).textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: titleColor,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              notification.title,
              style: Theme.of(context).textTheme.displayLarge?.copyWith(
                fontWeight: FontWeight.w900,
                color: titleColor,
                height: 1.08,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                _MetaPill(
                  icon: Icons.calendar_month_outlined,
                  label: _formatArticleTimestamp(notification.createdAt),
                  accent: accent,
                  textColor: bodyColor,
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text(
              notification.officeUpdateLabel == 'SCHOLARSHIP'
                  ? 'Scholarship'
                  : 'Office Update',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w700,
                color: titleColor.withOpacity(0.92),
              ),
            ),
            if (notification.isOpeningUpdate) ...[
              const SizedBox(height: 18),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: canvasColor,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 78,
                          height: 96,
                          decoration: BoxDecoration(
                            color: accent.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(22),
                          ),
                          child: Icon(
                            Icons.description_outlined,
                            size: 42,
                            color: accent.withOpacity(0.9),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Ready to apply?',
                                style: Theme.of(context).textTheme.titleLarge
                                    ?.copyWith(
                                      fontWeight: FontWeight.w800,
                                      color: titleColor,
                                    ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'View available scholarships and continue your application flow from there.',
                                style: Theme.of(context).textTheme.bodyLarge
                                    ?.copyWith(color: bodyColor, height: 1.45),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => _openOpenings(context),
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size.fromHeight(52),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                        child: const Text('Apply Now'),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => _openOpenings(context),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(52),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                        child: const Text('View Scholarships'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
            ],
          ],
        ),
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({
    required this.icon,
    required this.label,
    required this.accent,
    required this.textColor,
  });

  final IconData icon;
  final String label;
  final Color accent;
  final Color textColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: accent.withOpacity(0.12),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: accent, size: 18),
        ),
        const SizedBox(width: 12),
        Text(
          label,
          style: Theme.of(context).textTheme.bodyLarge?.copyWith(
            color: textColor,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
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
