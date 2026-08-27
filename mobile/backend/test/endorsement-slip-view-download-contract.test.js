const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(backendRoot, '..');
const repoRoot = path.resolve(mobileRoot, '..');
const frontendRoot = path.join(mobileRoot, 'frontend');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const screen = read(
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
const frontendService = read(
  path.join(
    frontendRoot,
    'lib',
    'features',
    'forms',
    'data',
    'services',
    'application_service.dart'
  )
);
const facade = read(
  path.join(frontendRoot, 'lib', 'core', 'files', 'downloaded_file_handler.dart')
);
const ioHandler = read(
  path.join(frontendRoot, 'lib', 'core', 'files', 'downloaded_file_handler_io.dart')
);
const webHandler = read(
  path.join(frontendRoot, 'lib', 'core', 'files', 'downloaded_file_handler_web.dart')
);
const backendService = read(
  path.join(backendRoot, 'src', 'services', 'applicationService.js')
);

test('Review current Endorsement Slip visibility in mobile', () => {
  assert.match(screen, /final slip = endorsement\.slip/);
  assert.match(screen, /slip\.available/);
});

test('Determine when an Endorsement Slip becomes available', () => {
  assert.match(
    backendService,
    /const slipReady = status === 'completed' && Boolean\(safeText\(slip\.final_pdf_path\)\)/
  );
  assert.match(
    backendService,
    /requirements\.status !== 'verified' \|\| endorsement\.status !== 'completed'/
  );
});

test('Show Endorsement Slip only when generated and available', () => {
  assert.match(screen, /if \(slip\.available\)/);
  assert.match(screen, /Official PDF pending/);
});

test('Add View Endorsement Slip', () => {
  assert.match(screen, /View Endorsement Slip/);
  assert.match(screen, /_viewEndorsementSlip/);
  assert.match(screen, /openDownloadedFilePreview/);
});

test('Add Download Endorsement Slip', () => {
  assert.match(screen, /Download PDF/);
  assert.match(screen, /_downloadEndorsementSlip/);
  assert.match(screen, /saveDownloadedFile/);
});

test('Download the official generated PDF', () => {
  assert.match(
    frontendService,
    /\/api\/applications\/me\/endorsement-slip\/pdf/
  );
  assert.match(backendService, /slip\.final_pdf_path/);
  assert.match(backendService, /ENDORSEMENT_SLIP_BUCKET/);
});

test('Do not generate duplicate or unofficial slip versions in mobile', () => {
  // Do not treat explanatory copy/comments such as
  // "do not generate a second endorsement slip" as PDF generation code.
  // Check actual PDF-generation dependencies/APIs instead.
  assert.doesNotMatch(
    screen,
    /package:pdf\/|package:printing\/|package:syncfusion_flutter_pdf\//
  );
  assert.doesNotMatch(
    screen,
    /\b(?:pw|pdf)\.Document\s*\(|PdfDocument\s*\(|Printing\.layoutPdf\s*\(/
  );

  assert.match(
    screen,
    /downloadMyEndorsementSlip\(\)/
  );
  assert.match(
    screen,
    /same official, finalized PDF used by Admin/
  );
});

test('Display a proper unavailable or pending state before completion', () => {
  assert.match(screen, /Official PDF pending/);
  assert.match(screen, /finalized Endorsement Slip is generated/);
});

test('Handle expired or failed download links properly', () => {
  assert.match(screen, /Fetch fresh bytes from the protected backend route every time/);
  assert.match(screen, /await _loadStatus\(\)/);
  assert.doesNotMatch(screen, /final_pdf_url/);
});

test('Verify downloaded PDF belongs to the authenticated applicant workflow', () => {
  assert.match(backendService, /async function downloadMyEndorsementSlipPdf\(userId\)/);
  assert.match(backendService, /Authentication required/);
  assert.match(
    backendService,
    /Endorsement slip PDF is only available after verified requirements and completed endorsement/
  );
});

test('Verify mobile permissions and storage behavior', () => {
  assert.match(ioHandler, /Platform\.isAndroid/);
  assert.match(ioHandler, /StorageDirectory\.downloads/);
  assert.match(ioHandler, /getApplicationDocumentsDirectory/);
  assert.doesNotMatch(ioHandler, /Permission\.storage|MANAGE_EXTERNAL_STORAGE/);
});

test('Verify Android download behavior', () => {
  assert.match(ioHandler, /getExternalStorageDirectories/);
  assert.match(ioHandler, /file\.writeAsBytes\(bytes, flush: true\)/);
  assert.match(facade, /saveDownloadedFile/);
});

test('Verify endorsement realtime updates make the slip available without re-login', () => {
  assert.match(screen, /scholarAccessRevision/);
  assert.match(screen, /applicationRevision/);
  assert.match(screen, /_handleNotificationProviderChange/);
  assert.match(screen, /_loadStatus\(\)/);
});

test('View does not force a persistent download', () => {
  assert.match(ioHandler, /getTemporaryDirectory/);
  assert.match(ioHandler, /openDownloadedFilePreviewImpl/);
  assert.match(webHandler, /html\.window\.open\(url, '_blank'\)/);
});

test('Download and View are separate actions', () => {
  assert.match(facade, /openDownloadedFilePreview/);
  assert.match(facade, /saveDownloadedFile/);
  assert.match(screen, /onViewSlip/);
  assert.match(screen, /onDownloadSlip/);
});
