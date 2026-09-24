'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(repo, relativePath), 'utf8').replace(/\r\n/g, '\n');

test('report template naming and organization use the approved report groups', () => {
  const service = read('admin/backend/services/reportService.js');
  const page = read('admin/frontend/src/pages/ReportGeneration.jsx');

  assert.match(service, /name:\s*'Scholarship Slot Report'/);
  assert.doesNotMatch(service, /name:\s*'Scholarship Slot Utilization Report'/);
  assert.match(page, /label:\s*'Scholarship & Applications'[\s\S]*slot_utilization[\s\S]*applications[\s\S]*endorsements/);
  assert.match(page, /label:\s*'Scholar Management'[\s\S]*scholars[\s\S]*scholars_by_benefactor[\s\S]*renewals/);
  assert.match(page, /label:\s*'Scholar Operations'[\s\S]*payouts[\s\S]*ro_compliance/);
});

test('report filters are report-specific and renewal intentionally excludes gender', () => {
  const page = read('admin/frontend/src/pages/ReportGeneration.jsx');
  const filterConfig = page.match(/const REPORT_FILTER_FIELDS = \{([\s\S]*?)\n\};/)?.[1] || '';
  const renewalConfig = filterConfig.match(/renewals:\s*\[([^\]]+)\]/)?.[1] || '';

  assert.match(page, /applications:[\s\S]*applicationStatus[\s\S]*documentStatus[\s\S]*verificationStatus/);
  assert.match(page, /payouts:[\s\S]*batchStatus[\s\S]*releaseStatus[\s\S]*paymentMode/);
  assert.match(page, /ro_compliance:[^\n]+roArea[^\n]+gender[^\n]+result/);
  assert.match(renewalConfig, /course/);
  assert.match(renewalConfig, /yearLevel/);
  assert.match(renewalConfig, /result/);
  assert.doesNotMatch(renewalConfig, /gender/);
});

test('backend consumes application and payout report-specific filters', () => {
  const service = read('admin/backend/services/reportService.js');
  const controller = read('admin/backend/controllers/reportController.js');

  for (const field of [
    'applicationStatus', 'documentStatus', 'verificationStatus',
    'batchStatus', 'releaseStatus', 'paymentMode',
  ]) {
    assert.match(service, new RegExp(field));
    assert.match(controller, new RegExp(field));
  }

  assert.match(service, /appendTextEqualityFilter\(where, params, 'a\.application_status', applicationStatus\)/);
  assert.match(service, /appendTextEqualityFilter\(where, params, 'pb\.batch_status', batchStatus\)/);
  assert.match(service, /appendTextEqualityFilter\(where, params, 'pbs\.release_status', releaseStatus\)/);
});

test('individual scholar reports expose gender while renewal remains gender-free', () => {
  const service = read('admin/backend/services/reportService.js');
  const renewalQuery = service.match(/async function getRenewalRows\(\{([\s\S]*?)\n\}\) \{/)?.[1] || '';
  const renewalDefinition = service.match(/normalized\.reportType === 'renewals'([\s\S]*?)normalized\.reportType === 'slot_utilization'/)?.[1] || '';

  assert.match(service, /getApplicationsRows[\s\S]*AS gender/);
  assert.match(service, /getScholarsRows[\s\S]*AS gender/);
  assert.match(service, /getPayoutRows[\s\S]*AS gender/);
  assert.match(service, /getPdRows[\s\S]*AS gender/);
  assert.doesNotMatch(renewalQuery, /gender/);
  assert.doesNotMatch(renewalDefinition, /header:\s*'Gender'/);
});

test('RO compliance exposes the assigned PIC name in preview/export data', () => {
  const service = read('admin/backend/services/reportService.js');
  const page = read('admin/frontend/src/pages/ReportGeneration.jsx');

  assert.match(service, /placement_details\.personnel_in_charge/);
  assert.match(service, /header:\s*'PIC Name',\s*key:\s*'personnel_in_charge'/);
  assert.match(page, /personnel_in_charge:\s*'PIC Name'/);
});

test('all Excel reports use the clean institutional banner/title while preserving report-specific tables', () => {
  const service = read('admin/backend/services/reportService.js');

  assert.match(service, /pdm-excel-header\.png/);
  assert.match(service, /APPLICATION REGISTRY REPORT/);
  assert.match(service, /FINANCIAL ASSISTANCE BENEFICIARIES/);
  assert.match(service, /PAYOUT BATCH REPORT/);
  assert.match(service, /STATUS AND RECOMMENDED FINANCIAL ASSISTANCE BENEFICIARIES/);
  assert.match(service, /SCHOLARSHIP SLOT REPORT/);
  assert.match(service, /ENDORSEMENT REPORT/);
  assert.match(service, /RO SCHOLAR COMPLIANCE REPORT/);
  assert.match(service, /sectionLabel:\s*'FOR RENEWAL'/);
  assert.match(service, /if \(!institutional\) \{[\s\S]*title: getInstitutionalReportTitle\(normalized\.reportType\)/);
  assert.match(service, /filename = 'active_scholars_master_list\.xlsx'/);
  assert.match(service, /filename = 'scholarship_renewal_report\.xlsx'/);
  assert.match(service, /filename = 'scholarship_slot_report\.xlsx'/);
  assert.match(service, /styleInstitutionalTable/);
  assert.match(service, /ext:\s*\{\s*width:\s*662,\s*height:\s*140\s*\}/);
  assert.match(service, /INSTITUTIONAL_EXCEL_COLUMN_MAX_WIDTHS/);
  assert.match(service, /state:\s*'normal'[\s\S]*showGridLines:\s*true[\s\S]*zoomScale:\s*85/);
  assert.match(service, /freezeRow:\s*0/);
  assert.match(service, /autoFilter:\s*true/);
});

test('Scholar Count by Benefactor remains a PDF bar-graph export using the PDM template', () => {
  const controller = read('admin/backend/controllers/reportController.js');
  const pdfService = read('admin/backend/services/benefactorReportPdfService.js');
  const page = read('admin/frontend/src/pages/ReportGeneration.jsx');

  assert.match(controller, /scholars_by_benefactor/);
  assert.match(controller, /EXPORT_REPORT_PDF/);
  assert.match(controller, /Scholar Count by Benefactor is available as PDF only\./);
  assert.match(pdfService, /pdm-report-template\.png/);
  assert.match(pdfService, /drawChartPage/);
  assert.match(page, /isScholarCountReport \? 'Download PDF' : 'Download Excel'/);
});

test('report export download spam is blocked in the frontend and backend', () => {
  const controller = read('admin/backend/controllers/reportController.js');
  const page = read('admin/frontend/src/pages/ReportGeneration.jsx');

  assert.match(controller, /const reportExportLocks = new Map\(\)/);
  assert.match(controller, /acquireExportLock/);
  assert.match(controller, /releaseExportLock/);
  assert.match(controller, /statusCode = 429/);
  assert.match(controller, /This report is already being generated\./);
  assert.match(page, /const exportLocksRef = useRef\(new Set\(\)\)/);
  assert.match(page, /acquireClientExportLock/);
  assert.match(page, /EXPORT_COOLDOWN_MS/);
  assert.match(page, /EXPORT_TIMEOUT_MS/);
  assert.match(page, /This report is already being generated\./);
});

test('date validation and responsive report UI safeguards remain present', () => {
  const page = read('admin/frontend/src/pages/ReportGeneration.jsx');

  assert.match(page, /isDateRangeInvalid = Boolean\(dateFrom && dateTo && dateFrom > dateTo\)/);
  assert.match(page, /Date From cannot be later than Date To\./);
  assert.match(page, /grid-cols-1[^"]*xl:grid-cols-12/);
  assert.match(page, /md:grid-cols-2/);
  assert.match(page, /max-h-\[420px\][^\"]*overflow-auto/);
  assert.match(page, /w-full[^"]*sm:w-auto/);
  assert.doesNotMatch(page, /Total assigned/);
});

test('downloadable report layouts adapt column widths, wrapped row heights, and print scaling', () => {
  const service = read('admin/backend/services/reportService.js');
  const pdfService = read('admin/backend/services/benefactorReportPdfService.js');

  assert.match(service, /function applyAdaptiveWorksheetLayout/);
  assert.match(service, /function visualTextWidth/);
  assert.match(service, /function estimateWrappedLines/);
  assert.match(service, /column\.width = Math\.min\(maxWidth, Math\.max\(minWidth, bestWidth\)\)/);
  assert.match(service, /row\.height = Math\.max\(18, Math\.min\(institutional \? 42 : 84,/);
  assert.match(service, /fitToPage:\s*true/);
  assert.match(service, /fitToWidth:\s*1/);
  assert.match(service, /printArea:/);
  assert.match(service, /printTitlesRow:/);
  assert.match(service, /paperSize:\s*veryWide \? 8 : 9/);
  assert.match(service, /institutional[\s\S]*state:\s*'normal'/);
  assert.match(pdfService, /function resolveChartLayout/);
  assert.match(pdfService, /rowsPerPage = Math\.max\(8,/);
  assert.match(pdfService, /fitSingleLineText/);
  assert.match(pdfService, /labelWidth = clamp/);
});
