import 'package:flutter/material.dart';

/// Semantic workflow colors installed by the scoped Applicant Home theme.
///
/// Widgets should retrieve this extension with [of] instead of selecting a
/// light or dark palette themselves.
@immutable
class AppStatusColors extends ThemeExtension<AppStatusColors> {
  const AppStatusColors({
    required this.neutralContainer,
    required this.onNeutralContainer,
    required this.neutralOutline,
    required this.inProgressContainer,
    required this.onInProgressContainer,
    required this.inProgressOutline,
    required this.actionRequiredContainer,
    required this.onActionRequiredContainer,
    required this.actionRequiredOutline,
    required this.successContainer,
    required this.onSuccessContainer,
    required this.successOutline,
    required this.dangerContainer,
    required this.onDangerContainer,
    required this.dangerOutline,
  });

  static const AppStatusColors light = AppStatusColors(
    neutralContainer: Color(0xFFF1EDE8),
    onNeutralContainer: Color(0xFF493C32),
    neutralOutline: Color(0xFFB8A99D),
    inProgressContainer: Color(0xFFFFF3C8),
    onInProgressContainer: Color(0xFF664500),
    inProgressOutline: Color(0xFFB87B00),
    actionRequiredContainer: Color(0xFFFFEBDD),
    onActionRequiredContainer: Color(0xFF713000),
    actionRequiredOutline: Color(0xFFC45B12),
    successContainer: Color(0xFFE5F4EA),
    onSuccessContainer: Color(0xFF14522E),
    successOutline: Color(0xFF2A7E4D),
    dangerContainer: Color(0xFFFDE9EA),
    onDangerContainer: Color(0xFF821E25),
    dangerOutline: Color(0xFFB9363F),
  );

  static const AppStatusColors dark = AppStatusColors(
    neutralContainer: Color(0xFF3A3028),
    onNeutralContainer: Color(0xFFF4EDE5),
    neutralOutline: Color(0xFF8A796A),
    inProgressContainer: Color(0xFF403516),
    onInProgressContainer: Color(0xFFFFE49A),
    inProgressOutline: Color(0xFFE8B83A),
    actionRequiredContainer: Color(0xFF482A18),
    onActionRequiredContainer: Color(0xFFFFD3AF),
    actionRequiredOutline: Color(0xFFE88D45),
    successContainer: Color(0xFF183B29),
    onSuccessContainer: Color(0xFFBDEBCB),
    successOutline: Color(0xFF53B978),
    dangerContainer: Color(0xFF4A2225),
    onDangerContainer: Color(0xFFFFC9CC),
    dangerOutline: Color(0xFFE96F76),
  );

  final Color neutralContainer;
  final Color onNeutralContainer;
  final Color neutralOutline;

  final Color inProgressContainer;
  final Color onInProgressContainer;
  final Color inProgressOutline;

  final Color actionRequiredContainer;
  final Color onActionRequiredContainer;
  final Color actionRequiredOutline;

  final Color successContainer;
  final Color onSuccessContainer;
  final Color successOutline;

  final Color dangerContainer;
  final Color onDangerContainer;
  final Color dangerOutline;

  /// Reads the semantic palette from the active Material theme.
  static AppStatusColors of(BuildContext context) {
    final theme = Theme.of(context);
    final extension = theme.extension<AppStatusColors>();
    assert(
      extension != null,
      'AppStatusColors must be installed above Applicant Home.',
    );
    return extension ??
        (theme.brightness == Brightness.dark
            ? AppStatusColors.dark
            : AppStatusColors.light);
  }

  @override
  AppStatusColors copyWith({
    Color? neutralContainer,
    Color? onNeutralContainer,
    Color? neutralOutline,
    Color? inProgressContainer,
    Color? onInProgressContainer,
    Color? inProgressOutline,
    Color? actionRequiredContainer,
    Color? onActionRequiredContainer,
    Color? actionRequiredOutline,
    Color? successContainer,
    Color? onSuccessContainer,
    Color? successOutline,
    Color? dangerContainer,
    Color? onDangerContainer,
    Color? dangerOutline,
  }) {
    return AppStatusColors(
      neutralContainer: neutralContainer ?? this.neutralContainer,
      onNeutralContainer: onNeutralContainer ?? this.onNeutralContainer,
      neutralOutline: neutralOutline ?? this.neutralOutline,
      inProgressContainer: inProgressContainer ?? this.inProgressContainer,
      onInProgressContainer:
          onInProgressContainer ?? this.onInProgressContainer,
      inProgressOutline: inProgressOutline ?? this.inProgressOutline,
      actionRequiredContainer:
          actionRequiredContainer ?? this.actionRequiredContainer,
      onActionRequiredContainer:
          onActionRequiredContainer ?? this.onActionRequiredContainer,
      actionRequiredOutline:
          actionRequiredOutline ?? this.actionRequiredOutline,
      successContainer: successContainer ?? this.successContainer,
      onSuccessContainer: onSuccessContainer ?? this.onSuccessContainer,
      successOutline: successOutline ?? this.successOutline,
      dangerContainer: dangerContainer ?? this.dangerContainer,
      onDangerContainer: onDangerContainer ?? this.onDangerContainer,
      dangerOutline: dangerOutline ?? this.dangerOutline,
    );
  }

  @override
  AppStatusColors lerp(covariant AppStatusColors? other, double t) {
    if (other == null) {
      return this;
    }

    return AppStatusColors(
      neutralContainer: Color.lerp(
        neutralContainer,
        other.neutralContainer,
        t,
      )!,
      onNeutralContainer: Color.lerp(
        onNeutralContainer,
        other.onNeutralContainer,
        t,
      )!,
      neutralOutline: Color.lerp(neutralOutline, other.neutralOutline, t)!,
      inProgressContainer: Color.lerp(
        inProgressContainer,
        other.inProgressContainer,
        t,
      )!,
      onInProgressContainer: Color.lerp(
        onInProgressContainer,
        other.onInProgressContainer,
        t,
      )!,
      inProgressOutline: Color.lerp(
        inProgressOutline,
        other.inProgressOutline,
        t,
      )!,
      actionRequiredContainer: Color.lerp(
        actionRequiredContainer,
        other.actionRequiredContainer,
        t,
      )!,
      onActionRequiredContainer: Color.lerp(
        onActionRequiredContainer,
        other.onActionRequiredContainer,
        t,
      )!,
      actionRequiredOutline: Color.lerp(
        actionRequiredOutline,
        other.actionRequiredOutline,
        t,
      )!,
      successContainer: Color.lerp(
        successContainer,
        other.successContainer,
        t,
      )!,
      onSuccessContainer: Color.lerp(
        onSuccessContainer,
        other.onSuccessContainer,
        t,
      )!,
      successOutline: Color.lerp(successOutline, other.successOutline, t)!,
      dangerContainer: Color.lerp(dangerContainer, other.dangerContainer, t)!,
      onDangerContainer: Color.lerp(
        onDangerContainer,
        other.onDangerContainer,
        t,
      )!,
      dangerOutline: Color.lerp(dangerOutline, other.dangerOutline, t)!,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is AppStatusColors &&
            neutralContainer == other.neutralContainer &&
            onNeutralContainer == other.onNeutralContainer &&
            neutralOutline == other.neutralOutline &&
            inProgressContainer == other.inProgressContainer &&
            onInProgressContainer == other.onInProgressContainer &&
            inProgressOutline == other.inProgressOutline &&
            actionRequiredContainer == other.actionRequiredContainer &&
            onActionRequiredContainer == other.onActionRequiredContainer &&
            actionRequiredOutline == other.actionRequiredOutline &&
            successContainer == other.successContainer &&
            onSuccessContainer == other.onSuccessContainer &&
            successOutline == other.successOutline &&
            dangerContainer == other.dangerContainer &&
            onDangerContainer == other.onDangerContainer &&
            dangerOutline == other.dangerOutline;
  }

  @override
  int get hashCode => Object.hashAll(<Object>[
    neutralContainer,
    onNeutralContainer,
    neutralOutline,
    inProgressContainer,
    onInProgressContainer,
    inProgressOutline,
    actionRequiredContainer,
    onActionRequiredContainer,
    actionRequiredOutline,
    successContainer,
    onSuccessContainer,
    successOutline,
    dangerContainer,
    onDangerContainer,
    dangerOutline,
  ]);
}
