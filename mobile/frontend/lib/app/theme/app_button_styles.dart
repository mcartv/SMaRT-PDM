import 'package:flutter/material.dart';

class AppButtonStyles {
  static Color destructiveColor(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFFFF8A80)
        : const Color(0xFFB42318);
  }

  static Color _destructiveFillColor(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFFC63C3C)
        : const Color(0xFFB42318);
  }

  static Color confirmColor(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? const Color(0xFF388E3C)
        : const Color(0xFF2E7D32);
  }

  static ButtonStyle destructiveText(BuildContext context) {
    final color = destructiveColor(context);
    return ButtonStyle(
      foregroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return color.withValues(alpha: 0.45);
        }
        return color;
      }),
      overlayColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.pressed)) {
          return color.withValues(alpha: 0.16);
        }
        if (states.contains(WidgetState.hovered) ||
            states.contains(WidgetState.focused)) {
          return color.withValues(alpha: 0.10);
        }
        return Colors.transparent;
      }),
    );
  }

  static ButtonStyle destructiveOutlined(BuildContext context) {
    final color = destructiveColor(context);
    return ButtonStyle(
      foregroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return color.withValues(alpha: 0.45);
        }
        return color;
      }),
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.hovered) ||
            states.contains(WidgetState.focused)) {
          return color.withValues(alpha: 0.08);
        }
        if (states.contains(WidgetState.pressed)) {
          return color.withValues(alpha: 0.12);
        }
        return Colors.transparent;
      }),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
      side: WidgetStateProperty.resolveWith((states) {
        final alpha = states.contains(WidgetState.disabled) ? 0.25 : 0.52;
        return BorderSide(color: color.withValues(alpha: alpha), width: 1);
      }),
    );
  }

  static ButtonStyle destructiveFilled(BuildContext context) {
    final color = _destructiveFillColor(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hover = Color.alphaBlend(
      (isDark ? Colors.white : Colors.black).withValues(alpha: 0.08),
      color,
    );
    final pressed = Color.alphaBlend(
      (isDark ? Colors.white : Colors.black).withValues(alpha: 0.14),
      color,
    );

    return ButtonStyle(
      foregroundColor: const WidgetStatePropertyAll(Colors.white),
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return color.withValues(alpha: 0.42);
        }
        if (states.contains(WidgetState.pressed)) return pressed;
        if (states.contains(WidgetState.hovered) ||
            states.contains(WidgetState.focused)) {
          return hover;
        }
        return color;
      }),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
    );
  }

  static ButtonStyle confirmFilled(BuildContext context) {
    final color = confirmColor(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hover = Color.alphaBlend(
      (isDark ? Colors.white : Colors.black).withValues(alpha: 0.07),
      color,
    );
    final pressed = Color.alphaBlend(
      (isDark ? Colors.white : Colors.black).withValues(alpha: 0.12),
      color,
    );

    return ButtonStyle(
      foregroundColor: const WidgetStatePropertyAll(Colors.white),
      backgroundColor: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.disabled)) {
          return color.withValues(alpha: 0.42);
        }
        if (states.contains(WidgetState.pressed)) return pressed;
        if (states.contains(WidgetState.hovered) ||
            states.contains(WidgetState.focused)) {
          return hover;
        }
        return color;
      }),
      overlayColor: const WidgetStatePropertyAll(Colors.transparent),
    );
  }
}
