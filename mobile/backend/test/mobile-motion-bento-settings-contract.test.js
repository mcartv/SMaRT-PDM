'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');

function source(rel) {
  return fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\r\n/g, '\n');
}

test('mobile motion, bento dashboard, and menu settings contract', () => {
  const dashboard = source(
    'mobile/frontend/lib/features/dashboard/presentation/screens/dashboard_screen.dart'
  );
  const menu = source(
    'mobile/frontend/lib/features/menu/presentation/screens/mobile_menu_screen.dart'
  );
  const settings = source(
    'mobile/frontend/lib/shared/widgets/app_settings_sheet.dart'
  );
  const themeProvider = source(
    'mobile/frontend/lib/app/theme/theme_provider.dart'
  );
  const appTheme = source(
    'mobile/frontend/lib/app/theme/app_theme.dart'
  );
  const app = source(
    'mobile/frontend/lib/app/app.dart'
  );
  const bootstrap = source(
    'mobile/frontend/lib/app/bootstrap.dart'
  );
  const bottomNav = source(
    'mobile/frontend/lib/shared/widgets/smart_pdm_bottom_nav.dart'
  );
  const motion = source(
    'mobile/frontend/lib/app/motion/app_motion.dart'
  );
  const interaction = source(
    'mobile/frontend/lib/app/settings/interaction_settings_provider.dart'
  );

  // Existing Welcome hero is preserved.
  assert.ok(
    dashboard.includes(
      "'Welcome, ${_displayFirstName()}'"
    )
  );
  assert.ok(
    dashboard.includes(
      '// The existing Welcome card remains intentionally unchanged.'
    )
  );

  // Dashboard uses responsive bento cards and no longer exposes the old
  // manual guide button outside Menu > Information.
  assert.ok(
    dashboard.includes('SMART-PDM_MOBILE_BENTO_DASHBOARD_V1')
  );
  assert.ok(dashboard.includes('_DashboardBentoTile'));
  assert.ok(dashboard.includes('final useTwoColumns ='));
  assert.equal(
    dashboard.includes("label: const Text('How to use SMaRT-PDM')"),
    false
  );
  assert.equal(
    dashboard.includes('Future<void> _openGuide()'),
    false
  );

  // Route motion is global and respects accessibility motion preferences.
  assert.ok(appTheme.includes('AppMotion.pageTransitionsTheme'));
  assert.ok(motion.includes('mediaQuery?.disableAnimations == true'));
  assert.ok(app.includes('themeAnimationDuration'));

  // Existing Menu structure remains.
  assert.ok(menu.includes("'Account Settings'"));
  assert.ok(menu.includes("'Information'"));

  // Requested Menu settings.
  assert.ok(menu.includes("title: 'Appearance'"));
  assert.ok(menu.includes("title: 'Haptic Feedback'"));
  assert.ok(menu.includes("title: 'Getting Started Guide'"));
  assert.ok(settings.includes("title: 'System'"));
  assert.ok(settings.includes("title: 'Light'"));
  assert.ok(settings.includes("title: 'Dark'"));
  assert.ok(themeProvider.includes('ThemeMode.system'));

  // Haptic setting is persisted and wired into primary navigation.
  assert.ok(interaction.includes('smart_pdm_haptic_feedback_enabled'));
  assert.ok(bootstrap.includes('InteractionSettingsProvider'));
  assert.ok(bottomNav.includes('AppHaptics.selection(context);'));
  assert.ok(bottomNav.includes('AnimatedScale('));
});
