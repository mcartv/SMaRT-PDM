'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) =>
    fs.readFileSync(path.join(root, relative), 'utf8');

test('program opening create and update routes enforce uniqueness', () => {
    const source = read('backend/routes/programOpeningRoutes.js');

    assert.match(source, /validateOpeningUniqueness/);
    assert.match(
        source,
        /router\.post\([\s\S]*validateOpeningUniqueness[\s\S]*createProgramOpening/
    );
    assert.match(
        source,
        /router\.patch\([\s\S]*validateOpeningUniqueness[\s\S]*updateProgramOpening/
    );
});

test('uniqueness is scoped to program and academic period', () => {
    const source = read(
        'backend/middleware/programOpeningUniquenessMiddleware.js'
    );

    assert.match(source, /\.eq\('program_id', programId\)/);
    assert.match(source, /\.eq\('period_id', periodId\)/);
    assert.match(source, /academic_year_id/);
    assert.match(source, /resolvePeriodIdFromAcademicYear/);
});

test('draft and open are the only statuses treated as active for duplicate blocking', () => {
    const source = read(
        'backend/middleware/programOpeningUniquenessMiddleware.js'
    );

    assert.match(
        source,
        /ACTIVE_OPENING_STATUSES = new Set\(\['draft', 'open'\]\)/
    );
    assert.match(source, /is_archived/);
});

test('closed and archived openings do not block later openings', () => {
    const source = read(
        'backend/middleware/programOpeningUniquenessMiddleware.js'
    );

    assert.match(source, /openingWouldBeActive/);
    assert.match(source, /if \(isArchived === true\) return false/);
});

test('duplicate active opening returns conflict instead of creating another record', () => {
    const source = read(
        'backend/middleware/programOpeningUniquenessMiddleware.js'
    );

    assert.match(source, /res\.status\(409\)/);
    assert.match(
        source,
        /Only one Draft or Open opening is allowed per scholarship program/
    );
});
