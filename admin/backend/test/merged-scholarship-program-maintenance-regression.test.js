'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) =>
    fs.readFileSync(path.join(root, relative), 'utf8');

test('Maintenance exposes one Scholarship Programs tab instead of separate Benefactors and Programs tabs', () => {
    const source = read('frontend/src/pages/maintenance/Maintenance.jsx');

    assert.match(source, /label: 'Scholarship Programs'/);
    assert.match(source, /ScholarshipProgramsPanel/);
    assert.doesNotMatch(source, /label: 'Benefactors'/);
    assert.doesNotMatch(source, /label: 'Programs'/);
    assert.doesNotMatch(source, /BenefactorsPanel/);
    assert.doesNotMatch(source, /ProgramsPanel/);
});

test('Merged scholarship panel creates a benefactor and its first program together', () => {
    const source = read(
        'frontend/src/pages/maintenance/ScholarshipProgramsPanel.jsx'
    );

    assert.match(source, /Add Benefactor & Program/);
    assert.match(source, /\/api\/benefactors\/with-program/);
    assert.match(source, /Benefactor Information/);
    assert.match(source, /First Program/);
    assert.match(source, /Add Program/);
});

test('Benefactor route exposes combined creation before the generic create route', () => {
    const source = read('backend/routes/benefactorRoutes.js');

    const combined = source.indexOf("router.post('/with-program'");
    const generic = source.indexOf("router.post('/',");

    assert.ok(combined >= 0);
    assert.ok(generic >= 0);
    assert.ok(combined < generic);
});

test('Combined creation rolls back a newly-created benefactor if program creation fails', () => {
    const source = read('backend/controllers/benefactorController.js');

    assert.match(source, /createBenefactorWithProgram/);
    assert.match(source, /deleteBenefactor\(createdBenefactor\.benefactor_id\)/);
    assert.match(source, /CREATE BENEFACTOR WITH PROGRAM ROLLBACK ERROR/);
});

test('Benefactor update uses the :id route parameter consistently', () => {
    const source = read('backend/controllers/benefactorController.js');

    assert.match(source, /const benefactorId = req\.params\.id;/);
    assert.doesNotMatch(source, /req\.params\.benefactorId/);
});
