const test = require('node:test');
const assert = require('node:assert/strict');

const {
    calculateAcademicYearWindow,
} = require('../services/academicYearService');

test('academic year uses the Asia/Manila June 1 rollover', () => {
    assert.deepEqual(
        calculateAcademicYearWindow({ calendarYear: 2026, month: 5 }),
        {
            start_year: 2025,
            end_year: 2026,
            label: '2025-2026',
        }
    );
    assert.deepEqual(
        calculateAcademicYearWindow({ calendarYear: 2026, month: 6 }),
        {
            start_year: 2026,
            end_year: 2027,
            label: '2026-2027',
        }
    );
});

test('academic-year service exposes stable activation validation codes', async () => {
    const { assertCurrentAcademicYear } = require('../services/academicYearService');
    const client = {
        query: async () => ({ rows: [{ calendar_year: 2026, calendar_month: 9 }] }),
    };

    await assert.rejects(
        () => assertCurrentAcademicYear(client, 2025, 2026),
        (error) => error.code === 'ACADEMIC_YEAR_HISTORICAL'
    );
    await assert.rejects(
        () => assertCurrentAcademicYear(client, 2027, 2028),
        (error) => error.code === 'ACADEMIC_YEAR_NOT_YET_CURRENT'
    );
});
