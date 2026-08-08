'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const controllerPath = path.resolve(__dirname, '../controllers/reportController.js');

function loadController({ hasRoAssignment = false } = {}) {
  delete require.cache[controllerPath];

  const captured = { previewQuery: null };
  const reportService = {
    async getReportMetadata() {
      return {
        reportTypes: [
          { id: 'applications' },
          { id: 'sdo' },
          { id: 'guidance' },
          { id: 'pd' },
          { id: 'ro' },
        ],
        programs: [],
        academicYears: [],
        semesters: [],
        benefactors: [],
      };
    },
    async previewReport(query) {
      captured.previewQuery = query;
      return { rows: [], total: 0, summary: {} };
    },
    async generateCsvReport() {
      return { filename: 'report.csv', content: '' };
    },
    async generateExcelReport() {
      return {
        filename: 'report.xlsx',
        workbook: { xlsx: { write: async () => {} } },
      };
    },
  };

  const auditLogService = { logAudit: async () => {} };
  const accountService = {
    hasActiveRoCoordinatorAssignment: async () => hasRoAssignment,
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (parent?.filename === controllerPath && request === '../services/reportService') return reportService;
    if (parent?.filename === controllerPath && request === '../services/auditLogService') return auditLogService;
    if (parent?.filename === controllerPath && request === '../services/accountService') return accountService;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const controller = require(controllerPath);
    return { controller, captured };
  } finally {
    Module._load = originalLoad;
  }
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    send(body) { this.body = body; return this; },
    end() { return this; },
  };
}

test('PD with active RO assignment sees both PD and RO report metadata', async () => {
  const { controller } = loadController({ hasRoAssignment: true });
  const req = { user: { role: 'pd', user_id: 'user-pd' }, query: { silent: '1' } };
  const res = createResponse();

  await controller.getReportMetadata(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.reportTypes.map((item) => item.id), ['pd', 'ro']);
});

test('Guidance without RO assignment keeps only Guidance report', async () => {
  const { controller } = loadController({ hasRoAssignment: false });
  const req = { user: { role: 'guidance', user_id: 'user-guidance' }, query: { silent: '1' } };
  const res = createResponse();

  await controller.getReportMetadata(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.reportTypes.map((item) => item.id), ['guidance']);
});

test('Dedicated RO Coordinator without active assignment is rejected', async () => {
  const { controller } = loadController({ hasRoAssignment: false });
  const req = { user: { role: 'ro_coordinator', user_id: 'user-ro' }, query: { silent: '1' } };
  const res = createResponse();

  await controller.getReportMetadata(req, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /active RO Area coordinator assignment/i);
});

test('SDO with active RO assignment previews RO report scoped to own user id', async () => {
  const { controller, captured } = loadController({ hasRoAssignment: true });
  const req = {
    user: { role: 'sdo', user_id: 'user-sdo' },
    query: { reportType: 'ro', silent: '1' },
  };
  const res = createResponse();

  await controller.previewReport(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(captured.previewQuery.reportType, 'ro');
  assert.equal(captured.previewQuery.roUserId, 'user-sdo');
});

test('Guidance without active RO assignment cannot preview RO report', async () => {
  const { controller } = loadController({ hasRoAssignment: false });
  const req = {
    user: { role: 'guidance', user_id: 'user-guidance' },
    query: { reportType: 'ro', silent: '1' },
  };
  const res = createResponse();

  await controller.previewReport(req, res);

  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /active RO Area coordinator assignment/i);
});
