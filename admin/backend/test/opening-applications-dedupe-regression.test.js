'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const source = read('backend/services/programOpeningService.js');

test(
    'Opening Applications deduplicates active rows by student and opening',
    () => {
        assert.match(
            source,
            /function dedupeOpeningApplications\(rows = \[\]\)/i
        );

        assert.match(
            source,
            /studentId[\s\S]*openingId/i
        );

        assert.match(
            source,
            /current_application_id/i
        );

        assert.match(
            source,
            /dedupeOpeningApplications\(operationalApplications\)/i
        );
    }
);

test(
    'Opening Applications prefers current_application_id before timestamp fallback',
    () => {
        const currentApplicationCheck =
            source.indexOf('rowIsCurrent');

        const timestampCheck =
            source.indexOf('applicationSortTimestamp(row)');

        assert.notEqual(
            currentApplicationCheck,
            -1,
            'current application preference must exist'
        );

        assert.notEqual(
            timestampCheck,
            -1,
            'timestamp fallback must exist'
        );

        assert.ok(
            currentApplicationCheck < timestampCheck,
            'current_application_id must be preferred before timestamp fallback'
        );
    }
);

test(
    'Opening Applications still excludes archived application and student rows',
    () => {
        assert.match(
            source,
            /app\.is_archived !== true/i
        );

        assert.match(
            source,
            /app\.students\.is_archived !== true/i
        );
    }
);