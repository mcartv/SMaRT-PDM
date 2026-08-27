const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const dashboard = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'dashboard',
    'presentation',
    'screens',
    'dashboard_screen.dart'
  )
);

const menu = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'menu',
    'presentation',
    'screens',
    'mobile_menu_screen.dart'
  )
);

const router = read(
  path.join(frontendRoot, 'lib', 'app', 'routes', 'app_router.dart')
);

const endorsement = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'forms',
    'presentation',
    'screens',
    'endorsement_screen.dart'
  )
);

test('Endorsement has a dedicated protected mobile route', () => {
  assert.match(router, /case AppRoutes\.endorsement:/);
  assert.match(router, /child: EndorsementScreen\(\)/);
});

test('Mobile Menu exposes a permanent Endorsement entry', () => {
  assert.match(menu, /'Application'/);
  assert.match(menu, /title: 'Endorsement'/);
  assert.match(
    menu,
    /subtitle: 'Track office review and access your official slip'/
  );
  assert.match(menu, /_openRoute\(AppRoutes\.endorsement\)/);
});

test('Dashboard current-status card keeps Manage Documents', () => {
  assert.match(dashboard, /'Manage Documents'/);
  assert.match(dashboard, /AppRoutes\.documents/);
});

test('Dashboard current-status card adds View Endorsement beside Manage Documents', () => {
  assert.match(dashboard, /'View Endorsement'/);
  assert.match(
    dashboard,
    /Navigator\.pushNamed\(context, AppRoutes\.endorsement\)/
  );
});

test('Dashboard actions remain responsive on narrow screens', () => {
  assert.match(dashboard, /LayoutBuilder\(/);
  assert.match(dashboard, /constraints\.maxWidth < 360/);
  assert.match(dashboard, /Expanded\(child: manageDocumentsButton\)/);
  assert.match(dashboard, /Expanded\(child: endorsementButton\)/);
  assert.match(dashboard, /manageDocumentsButton,[\s\S]*endorsementButton/);
});

test('Endorsement screen remains the source of endorsement state', () => {
  assert.match(endorsement, /final workflow = summary\.workflow/);
  assert.match(endorsement, /final endorsement = workflow\?\.endorsement/);
  assert.match(endorsement, /final slip = endorsement\.slip/);
  assert.match(endorsement, /Current Step/);
  assert.match(endorsement, /Slip Status/);
  assert.match(
    endorsement,
    /Your endorsement moves in this order: SDO, Guidance, then Program Director\./
  );
});

test('Endorsement screen remains the place for official slip access', () => {
  assert.match(
    endorsement,
    /View Endorsement Slip|Download My Endorsement Slip|Download PDF/
  );
  assert.match(endorsement, /slip\.available/);
});

test('Dashboard does not duplicate endorsement state UI', () => {
  assert.doesNotMatch(
    dashboard,
    /class _DashboardEndorsementScreen|class EndorsementScreen/
  );
});
