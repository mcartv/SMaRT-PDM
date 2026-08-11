const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

test('application verification route runs the SDO notification middleware before save verification', () => {
  const source = read('admin/backend/routes/applicationRoutes.js');

  assert.match(source, /notifySdoAfterSuccessfulVerification/);
  assert.match(
    source,
    /router\.post\([\s\S]*?'\/:id\/verify'[\s\S]*?notifySdoAfterSuccessfulVerification[\s\S]*?applicationController\.saveApplicationVerification/
  );
});

test('initial SDO notification only follows a successful verified transition still pending in SDO', () => {
  const source = read('admin/backend/middleware/endorsementNotificationMiddleware.js');

  assert.match(source, /verification_status\) !== 'verified'/);
  assert.match(source, /res\.statusCode < 200 \|\| res\.statusCode >= 300/);
  assert.match(source, /LOWER\(COALESCE\(a\.verification_status, ''\)\) = 'verified'/);
  assert.match(source, /es\.current_stage = 'pending_sdo'/);
});

test('initial SDO notification targets only SDO and is deduplicated per account and slip', () => {
  const middleware = read('admin/backend/middleware/endorsementNotificationMiddleware.js');
  const notifications = read('admin/backend/services/notificationService.js');

  assert.match(middleware, /getStaffTargets\(\{ roles: \['sdo'\] \}\)/);
  assert.match(middleware, /title: 'Applicant Ready for SDO Review'/);
  assert.match(middleware, /referenceType: 'endorsement_slip'/);
  assert.match(middleware, /createUserNotificationOnce/);

  assert.match(notifications, /async function createUserNotificationOnce/);
  assert.match(notifications, /WHERE NOT EXISTS/);
  assert.match(notifications, /existing\.user_id = \$1/);
  assert.match(notifications, /existing\.reference_id IS NOT DISTINCT FROM \$5/);
  assert.match(notifications, /exports\.createUserNotificationOnce = createUserNotificationOnce/);
});

test('current endorsement progression remains SDO to Guidance to assigned PD and terminal outcome to Admin', () => {
  const source = read('admin/backend/services/endorsementSlipService.js');

  assert.match(source, /sdo:\s*\{[\s\S]*?nextRole: 'guidance'[\s\S]*?nextTitle: 'Guidance clearance pending'/);
  assert.match(source, /guidance:\s*\{[\s\S]*?nextRole: 'pd'[\s\S]*?nextTitle: 'PD approval pending'/);
  assert.match(source, /WHERE course_id = \$1 AND is_active = true/);
  assert.match(source, /roles: \['admin'\]/);
});

test('portal notification filtering is role-specific for endorsement work', () => {
  const source = read('admin/frontend/src/hooks/usePortalNotifications.js');

  assert.match(source, /function isEndorsementNotificationForPortal/);
  assert.match(source, /portalRootPath === '\/sdo'[\s\S]*?descriptor\.includes\('sdo'\)/);
  assert.match(source, /portalRootPath === '\/guidance'[\s\S]*?descriptor\.includes\('guidance'\)/);
  assert.match(source, /portalRootPath === '\/pd'[\s\S]*?descriptor\.includes\('pd'\)[\s\S]*?descriptor\.includes\('program director'\)/);

  const commonBlock = source.match(/const common = new Set\(\[([\s\S]*?)\]\);/)?.[1] || '';
  assert.doesNotMatch(commonBlock, /announcement/);
});

test('RO notifications are shown in department portals only with active RO coordinator capability', () => {
  const source = read('admin/frontend/src/hooks/usePortalNotifications.js');

  assert.match(source, /buildApiUrl\('\/api\/accounts\/me'\)/);
  assert.match(source, /payload\?\.data\?\.has_ro_coordinator_access === true/);
  assert.doesNotMatch(source, /payload\?\.has_ro_coordinator_access === true/);
  assert.match(source, /hasRoCoordinatorAccess === true/);
  assert.match(source, /'return_of_obligation'/);
  assert.match(source, /'ro_time_log'/);
  assert.match(source, /'ro_scholar_request'/);
});

test('RO coordinator request notifications remain assignment-specific and user-targeted', () => {
  const source = read('admin/backend/services/roService.js');

  assert.match(source, /FROM ro_area_coordinators rac/);
  assert.match(source, /rac\.is_active = true/);
  assert.match(source, /rd\.is_active = true/);
  assert.match(source, /COALESCE\(ap\.is_archived, false\) = false/);
  assert.match(source, /userId: coordinator\.user_id/);
  assert.match(source, /referenceType: 'return_of_obligation'/);
});

test('RO scholar request status notification remains direct to the requesting coordinator', () => {
  const source = read('admin/backend/controllers/roController.js');

  assert.match(source, /if \(request\?\.requested_by_user_id\)/);
  assert.match(source, /userId: request\.requested_by_user_id/);
  assert.match(source, /referenceType: 'ro_scholar_request'/);
});
