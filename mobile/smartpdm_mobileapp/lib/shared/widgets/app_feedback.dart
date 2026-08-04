import 'package:flutter/material.dart';

enum AppFeedbackTone { success, error, warning, info }

class AppFeedback {
  const AppFeedback._();

  static void show(
    BuildContext context, {
    required String message,
    AppFeedbackTone tone = AppFeedbackTone.info,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;

    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(_icon(tone), color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text(message)),
          ],
        ),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        backgroundColor: _color(tone),
        duration: tone == AppFeedbackTone.error
            ? const Duration(seconds: 5)
            : const Duration(seconds: 3),
        action: actionLabel != null && onAction != null
            ? SnackBarAction(
                label: actionLabel,
                textColor: Colors.white,
                onPressed: onAction,
              )
            : null,
      ),
    );
  }

  static Color _color(AppFeedbackTone tone) => switch (tone) {
        AppFeedbackTone.success => const Color(0xFF2E7D32),
        AppFeedbackTone.error => const Color(0xFFB3261E),
        AppFeedbackTone.warning => const Color(0xFF9A5A00),
        AppFeedbackTone.info => const Color(0xFF5C2D0E),
      };

  static IconData _icon(AppFeedbackTone tone) => switch (tone) {
        AppFeedbackTone.success => Icons.check_circle_outline_rounded,
        AppFeedbackTone.error => Icons.error_outline_rounded,
        AppFeedbackTone.warning => Icons.warning_amber_rounded,
        AppFeedbackTone.info => Icons.info_outline_rounded,
      };
}
