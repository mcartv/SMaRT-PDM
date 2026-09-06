import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

String read(String path) => File(path).readAsStringSync();

void main() {
  test('application dropdowns use dark-aware text and popup colors', () {
    final personal = read(
      'lib/features/forms/presentation/screens/step_personal_intake.dart',
    );
    final family = read(
      'lib/features/forms/presentation/screens/step_family_intake.dart',
    );
    final academic = read(
      'lib/features/forms/presentation/screens/step_academic_intake.dart',
    );

    expect(personal, contains('dropdownColor: intakeSurfaceColor(context)'));

    for (final source in [personal, family, academic]) {
      if (source.contains('DropdownButtonFormField<String>(')) {
        expect(
          source,
          contains('style: Theme.of(context).textTheme.bodyLarge?.copyWith('),
        );
      }
    }
  });

  test('Getting Started popup explicitly supports dark mode', () {
    final source = read(
      'lib/features/dashboard/presentation/screens/dashboard_screen.dart',
    );

    expect(source, contains('final dialogSurface = isDark'));
    expect(source, contains('final bodyColor = isDark'));
    expect(source, contains('isDark ? AppColors.gold : AppColors.brown'));
  });

  test('menu uses applicant dark text palette', () {
    final source = read(
      'lib/features/menu/presentation/screens/mobile_menu_screen.dart',
    );

    expect(source, contains('AppSurfacePalette.text(context)'));
    expect(source, contains('AppSurfacePalette.mutedText(context)'));
  });

  test('global dark theme covers dialogs and menus', () {
    final source = read('lib/app/theme/app_theme.dart');

    expect(source, contains('dialogTheme: const DialogThemeData('));
    expect(source, contains('dropdownMenuTheme: const DropdownMenuThemeData('));
    expect(source, contains('menuTheme: const MenuThemeData('));
  });
}
