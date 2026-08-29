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

test('Mobile Dashboard/Menu disabled-module feedback contract', () => {
  const accessService = source(
    'mobile/frontend/lib/features/scholar/data/services/scholar_access_service.dart'
  );
  const accessGate = source(
    'mobile/frontend/lib/features/scholar/presentation/widgets/scholar_access_gate.dart'
  );
  const bottomNav = source(
    'mobile/frontend/lib/shared/widgets/smart_pdm_bottom_nav.dart'
  );
  const shell = source(
    'mobile/frontend/lib/app/shell/presentation/screens/top_level_shell_screen.dart'
  );
  const scaffold = source(
    'mobile/frontend/lib/shared/widgets/smart_pdm_page_scaffold.dart'
  );
  const dashboard = source(
    'mobile/frontend/lib/features/dashboard/presentation/screens/dashboard_screen.dart'
  );
  const menu = source(
    'mobile/frontend/lib/features/menu/presentation/screens/mobile_menu_screen.dart'
  );
  const provider = source(
    'mobile/frontend/lib/features/notifications/presentation/providers/notification_provider.dart'
  );
  const router = source(
    'mobile/frontend/lib/app/routes/app_router.dart'
  );

  // All three disabled scholar modules are defined consistently.
  assert.ok(accessService.includes('AppRoutes.payouts'));
  assert.ok(accessService.includes('AppRoutes.roAssignment'));
  assert.ok(accessService.includes('AppRoutes.renewalDocuments'));
  assert.ok(
    accessService.includes(
      "is unavailable until your scholarship is approved and activated."
    )
  );

  // A route guard must never create an unsolicited toast.
  assert.ok(accessGate.includes('redirectWhenDenied'));
  assert.equal(
    accessGate.includes('ScholarAccessService.showLockedMessage(context'),
    false
  );

  // Direct/deep scholar routes remain protected.
  assert.ok(
    router.includes(
      "const ScholarAccessGate(\n            child: TopLevelShellScreen(initialIndex: 1)"
    )
  );
  assert.ok(
    router.includes(
      "const ScholarAccessGate(\n            child: TopLevelShellScreen(initialIndex: 3)"
    )
  );

  // Shell page gates are passive so merely opening Dashboard/Menu cannot
  // trigger redirect/toast behavior from adjacent PageView children.
  assert.equal(
    (shell.match(/redirectWhenDenied: false/g) || []).length,
    3
  );

  // Only explicit shell/bottom-nav navigation can show disabled feedback.
  assert.equal(
    (shell.match(/ScholarAccessService\.showLockedMessage\(/g) || []).length,
    1
  );
  assert.ok(shell.includes('route: _routeForIndex(targetIndex)'));
  assert.ok(bottomNav.includes('route: _routes[index]'));

  // Applicants cannot swipe into locked pages and accidentally produce
  // availability feedback without tapping a disabled module.
  assert.ok(shell.includes('const NeverScrollableScrollPhysics()'));

  // Enabled navigation clears old feedback instead of creating another toast.
  assert.ok(
    bottomNav.includes('ScholarAccessService.dismissLockedMessage(context);')
  );
  assert.ok(
    shell.includes('ScholarAccessService.dismissLockedMessage(context);')
  );

  // Repeated taps cannot stack multiple messages.
  assert.ok(accessService.includes('_lockedMessageCooldown'));
  assert.ok(accessService.includes('messenger.clearSnackBars();'));
  assert.ok(accessService.includes('messenger.removeCurrentSnackBar();'));

  // Toast stays responsive/non-blocking and above Scaffold navigation geometry.
  assert.ok(accessService.includes('SnackBarBehavior.floating'));
  assert.ok(
    accessService.includes(
      'margin: const EdgeInsets.fromLTRB(16, 8, 16, 12)'
    )
  );
  assert.ok(accessService.includes('dismissDirection: DismissDirection.down'));

  // Realtime access becomes authoritative after account/application changes.
  assert.ok(shell.includes('provider.scholarAccessRevision > 0'));
  assert.ok(scaffold.includes('notificationProvider.scholarAccessRevision > 0'));
  assert.ok(dashboard.includes('_lastScholarAccessRevision'));
  assert.ok(dashboard.includes('final accessChanged ='));
  assert.ok(menu.includes('context.watch<NotificationProvider>()'));
  assert.ok(menu.includes('scholarAccessRevision > 0'));

  // Status transitions refresh profile-backed access without a re-login.
  assert.ok(
    provider.includes(
      "case MobileRealtimeEvents.applicationUpdated:\n      case MobileRealtimeEvents.applicationRejected:\n      case MobileRealtimeEvents.applicationDisqualified:\n      case MobileRealtimeEvents.applicationApproved:"
    )
  );
  assert.ok(provider.includes('await _refreshScholarAccessFromProfile();'));

  // If access is revoked while a locked tab is open, return to Dashboard
  // silently instead of leaving a disabled module visible.
  assert.ok(shell.includes('_redirectLockedCurrentTabIfNeeded'));
  assert.ok(shell.includes('setState(() => _currentIndex = 0);'));
});
