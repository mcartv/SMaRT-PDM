'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');

function source(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

test('Renewal Availability by Semester checklist remains enforced across the stack', () => {
  const mobileService = source(
    'mobile/backend/src/services/renewalService.js'
  );
  const mobileModel = source(
    'mobile/frontend/lib/shared/models/scholar_renewal.dart'
  );
  const mobileScreen = source(
    'mobile/frontend/lib/features/applicant/presentation/screens/scholar_renewal_requirements_screen.dart'
  );
  const notifications = source(
    'mobile/frontend/lib/features/notifications/presentation/providers/notification_provider.dart'
  );
  const academicService = source(
    'admin/backend/services/academicYearService.js'
  );
  const academicController = source(
    'admin/backend/controllers/academicYearController.js'
  );
  const adminService = source(
    'admin/backend/services/renewalService.js'
  );
  const adminController = source(
    'admin/backend/controllers/renewalController.js'
  );
  const migration = source(
    'supabase/migrations/20260828_enforce_renewal_student_period_uniqueness.sql'
  );

  assert.ok(mobileService.includes(".from('academic_period')"));
  assert.ok(mobileService.includes(".eq('is_active', true)"));
  assert.ok(
    mobileService.includes(
      'CURRENT_SCHOLARSHIP_SEMESTER_STILL_ACTIVE'
    )
  );

  const backendGuardCount =
    mobileService.split('await assertRenewalAvailable(student);').length - 1;
  assert.ok(
    backendGuardCount >= 2,
    'upload and submit must both validate renewal availability'
  );

  assert.ok(
    mobileService.includes(
      'This renewal package is already submitted or locked.'
    )
  );

  assert.ok(mobileModel.includes('final bool isRenewalAvailable;'));
  assert.ok(mobileModel.includes('final String availabilityReason;'));
  assert.ok(mobileScreen.includes('Renewal Not Yet Available'));
  assert.ok(mobileScreen.includes('availabilityReason'));

  assert.ok(
    academicService.includes(
      'SMART-PDM_RENEWAL_SAME_PERIOD_GUARD_V1'
    )
  );
  assert.ok(
    academicController.includes('relayRenewalEvent')
  );
  assert.ok(
    notifications.includes(
      'case MobileRealtimeEvents.renewalUpdated:'
    )
  );

  assert.ok(
    adminService.includes(
      'SMART-PDM_RENEWAL_PERIOD_ELIGIBILITY_V2'
    )
  );
  assert.ok(
    adminService.includes(
      'await assertRenewalPeriodEligible(renewal);'
    )
  );
  assert.ok(
    adminController.includes(
      'renewal?.is_renewal_period !== false'
    )
  );

  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS uq_renewals_student_period/
  );
  assert.match(
    migration,
    /ON public\.renewals \(student_id, period_id\)/
  );
});
