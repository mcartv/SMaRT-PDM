import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:smartpdm_mobileapp/app/motion/app_motion.dart';
import 'package:smartpdm_mobileapp/app/settings/interaction_settings_provider.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/theme_provider.dart';

Future<void> showAppearanceSheet(BuildContext context) {
  AppHaptics.selection(context);

  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => const _AppearanceSheet(),
  );
}

// Backward-compatible alias for any older caller.
Future<void> showAppSettingsSheet(BuildContext context) {
  return showAppearanceSheet(context);
}

class _AppearanceSheet extends StatelessWidget {
  const _AppearanceSheet();

  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final sheetColor = isDark
        ? const Color(0xFF24180F)
        : backgroundColor;
    final handleColor = isDark
        ? Colors.white24
        : AppColors.lightGray;
    final titleColor = isDark
        ? Colors.white
        : AppColors.darkBrown;
    final tileColor = isDark
        ? const Color(0xFF332216)
        : Colors.white;
    final borderColor = isDark
        ? Colors.white12
        : AppColors.lightGray;

    final options = <({
      ThemeMode mode,
      IconData icon,
      String title,
      String subtitle,
    })>[
      (
        mode: ThemeMode.system,
        icon: Icons.settings_suggest_outlined,
        title: 'System',
        subtitle: 'Follow your phone appearance',
      ),
      (
        mode: ThemeMode.light,
        icon: Icons.light_mode_outlined,
        title: 'Light',
        subtitle: 'Always use the light palette',
      ),
      (
        mode: ThemeMode.dark,
        icon: Icons.dark_mode_outlined,
        title: 'Dark',
        subtitle: 'Always use the dark palette',
      ),
    ];

    return DraggableScrollableSheet(
      initialChildSize: 0.48,
      minChildSize: 0.40,
      maxChildSize: 0.62,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: sheetColor,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(28),
            ),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 52,
                height: 5,
                decoration: BoxDecoration(
                  color: handleColor,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Appearance',
                    style: Theme.of(context)
                        .textTheme
                        .displayLarge
                        ?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: titleColor,
                        ),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Choose how SMaRT-PDM looks on this device.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: isDark
                          ? AppColors.applicantDarkTextMuted
                          : AppColors.brown.withValues(alpha: 0.65),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView.separated(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                  itemCount: options.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final option = options[index];
                    final selected =
                        themeProvider.themeMode == option.mode;

                    return AppMotionReveal(
                      delay: Duration(milliseconds: 45 * index),
                      child: Material(
                        color: tileColor,
                        borderRadius: BorderRadius.circular(16),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () {
                            AppHaptics.selection(context);
                            themeProvider.setThemeMode(option.mode);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 13,
                            ),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: selected
                                    ? AppColors.gold
                                    : borderColor,
                                width: selected ? 1.4 : 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 42,
                                  height: 42,
                                  decoration: BoxDecoration(
                                    color: AppColors.gold.withValues(
                                      alpha: isDark ? 0.18 : 0.14,
                                    ),
                                    borderRadius: BorderRadius.circular(13),
                                  ),
                                  child: Icon(
                                    option.icon,
                                    color: AppColors.gold,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        option.title,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall
                                            ?.copyWith(
                                              color: titleColor,
                                              fontWeight: FontWeight.w800,
                                            ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        option.subtitle,
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall
                                            ?.copyWith(
                                              color: isDark
                                                  ? AppColors
                                                      .applicantDarkTextMuted
                                                  : AppColors.brown
                                                      .withValues(alpha: 0.62),
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                                AnimatedSwitcher(
                                  duration: AppMotion.fast,
                                  child: selected
                                      ? const Icon(
                                          Icons.check_circle_rounded,
                                          key: ValueKey('selected'),
                                          color: AppColors.gold,
                                        )
                                      : const SizedBox(
                                          key: ValueKey('unselected'),
                                          width: 24,
                                        ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
