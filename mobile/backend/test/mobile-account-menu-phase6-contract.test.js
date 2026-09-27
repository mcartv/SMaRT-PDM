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

test('phase 6 keeps account flows intact while making support surfaces responsive', () => {
  const menu = source(
    'mobile/frontend/lib/features/menu/presentation/screens/mobile_menu_screen.dart'
  );
  const profile = source(
    'mobile/frontend/lib/features/profile/presentation/screens/profile_screen.dart'
  );
  const appearance = source(
    'mobile/frontend/lib/shared/widgets/app_settings_sheet.dart'
  );
  const faqs = source(
    'mobile/frontend/lib/features/dashboard/presentation/screens/faqs_screen.dart'
  );

  assert.ok(menu.includes('SMART-PDM_MOBILE_MENU_RESPONSIVE_PHASE6_V1'));
  assert.ok(menu.includes('AppRoutes.profile'));
  assert.ok(menu.includes('AppRoutes.forgotPassword'));
  assert.ok(menu.includes('AppRoutes.changeEmail'));
  assert.ok(menu.includes('AppRoutes.faqs'));
  assert.ok(menu.includes("title: 'Getting Started Guide'"));
  assert.ok(menu.includes('_confirmLogout'));

  const profileSummary = menu.slice(
    menu.indexOf('class _ProfileSummaryCard'),
    menu.indexOf('class _ScholarResponsibilitiesScreen')
  );
  assert.equal(profileSummary.includes('TextOverflow.ellipsis'), false);

  assert.ok(profile.includes('SMART-PDM_MOBILE_PROFILE_RESPONSIVE_PHASE6_V1'));
  assert.ok(profile.includes('Future<void> _pickAvatar()'));
  assert.ok(profile.includes('Future<void> _saveProfile()'));
  assert.ok(profile.includes('final stackActions ='));
  assert.ok(profile.includes('constraints.maxWidth < 340 || textScale > 1.3'));
  assert.ok(profile.includes('final stackValues ='));

  assert.ok(
    appearance.includes('SMART-PDM_MOBILE_APPEARANCE_RESPONSIVE_PHASE6_V1')
  );
  assert.ok(appearance.includes('showAppearanceSheet'));
  assert.ok(appearance.includes("title: 'System'"));
  assert.ok(appearance.includes("title: 'Light'"));
  assert.ok(appearance.includes("title: 'Dark'"));
  assert.ok(appearance.includes('final largeText = textScale > 1.3'));
  assert.ok(appearance.includes('initialChildSize: largeText ? 0.72 : 0.48'));
  assert.ok(appearance.includes('maxChildSize: 0.92'));

  assert.ok(faqs.includes('SMART-PDM_MOBILE_FAQS_RESPONSIVE_PHASE6_V1'));
  assert.ok(faqs.includes('MobileRealtimeService.instance.listenTo'));
  assert.ok(faqs.includes('MobileRealtimeService.instance.isRealtimeHealthy'));
  assert.ok(faqs.includes("hintText: 'Search questions or answers'"));
  assert.ok(faqs.includes('ExpansionTile'));
});
