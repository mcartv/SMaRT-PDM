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

test('phase 7 About page presents PDM identity without developer branding', () => {
  const about = source(
    'mobile/frontend/lib/features/profile/presentation/screens/about_pdm_screen.dart'
  );
  const menu = source(
    'mobile/frontend/lib/features/menu/presentation/screens/mobile_menu_screen.dart'
  );
  const router = source('mobile/frontend/lib/app/routes/app_router.dart');

  assert.ok(about.includes('SMART-PDM_MOBILE_ABOUT_BRANDING_PHASE7_V1'));
  assert.ok(about.includes("title: 'PDM Mission'"));
  assert.ok(about.includes("title: 'PDM Vision'"));
  assert.ok(about.includes('class _MissionVisionSection'));
  assert.ok(about.includes('ExpansionTile'));

  assert.equal(about.includes('Production Version'), false);
  assert.equal(about.includes('Version 1.0.0'), false);
  assert.equal(about.includes('GALE'), false);
  assert.equal(about.includes('Jerry Geoff Bho'), false);
  assert.equal(about.includes('Carl Arthur Buenavidez'), false);
  assert.equal(about.includes('Leo Lawrence Galve'), false);
  assert.equal(about.includes('Venice Eve Pelima'), false);
  assert.ok(about.includes('© 2026 SMaRT-PDM. All rights reserved.'));

  assert.ok(menu.includes("title: 'About SMaRT-PDM'"));
  assert.ok(menu.includes('AppRoutes.about'));
  assert.ok(router.includes('case AppRoutes.about:'));
  assert.ok(router.includes('const AboutPdmScreen()'));
});
