import 'package:flutter/material.dart';
import 'package:smartpdm_mobileapp/app/theme/app_colors.dart';
import 'package:smartpdm_mobileapp/app/theme/app_design_tokens.dart';

Future<void> showLegalDocumentSheet(
  BuildContext context, {
  required String title,
  required String content,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) {
      final isDark = Theme.of(sheetContext).brightness == Brightness.dark;
      final sheetColor = isDark ? AppColors.applicantDarkSurface : Colors.white;
      final sheetText = isDark
          ? AppColors.applicantDarkText
          : AppColors.darkBrown;
      final sheetMuted = isDark
          ? AppColors.applicantDarkTextMuted
          : Colors.grey.shade800;
      final outline = isDark
          ? AppColors.applicantDarkOutline
          : Colors.grey.shade300;

      return DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.82,
        minChildSize: 0.52,
        maxChildSize: 0.95,
        builder: (context, controller) {
          return Material(
            color: sheetColor,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(24),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                const SizedBox(height: 10),
                Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(
                    color: sheetMuted.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 10, 10),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.gold.withValues(alpha: 0.14),
                          borderRadius: AppRadii.control,
                        ),
                        child: const Icon(
                          Icons.gavel_outlined,
                          size: 20,
                          color: AppColors.gold,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          title,
                          maxLines: 2,
                          softWrap: true,
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: sheetText,
                            fontWeight: FontWeight.w900,
                            height: 1.2,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Close',
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                ),
                Divider(height: 1, color: outline),
                Expanded(
                  child: SingleChildScrollView(
                    controller: controller,
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 22),
                    child: SelectableText(
                      content,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: sheetMuted,
                        height: 1.65,
                      ),
                    ),
                  ),
                ),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 14),
                  decoration: BoxDecoration(
                    color: sheetColor,
                    border: Border(top: BorderSide(color: outline)),
                  ),
                  child: SafeArea(
                    top: false,
                    child: SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () => Navigator.of(context).pop(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.gold,
                          foregroundColor: AppColors.darkBrown,
                          minimumSize: const Size.fromHeight(52),
                          shape: RoundedRectangleBorder(
                            borderRadius: AppRadii.control,
                          ),
                          elevation: 0,
                        ),
                        child: const Text(
                          'Close',
                          style: TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      );
    },
  );
}
