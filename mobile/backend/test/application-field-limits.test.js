'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
    APPLICATION_FIELD_LIMITS,
    validateApplicationFieldLimits,
} = require('../src/validation/applicationFieldLimits');

test('backend field limits match the Flutter field-limit contract', () => {
    const dartSource = fs.readFileSync(
        path.join(
            __dirname,
            '..',
            '..',
            'frontend',
            'lib',
            'features',
            'forms',
            'domain',
            'validation',
            'application_field_limits.dart'
        ),
        'utf8'
    );

    for (const [name, value] of Object.entries(APPLICATION_FIELD_LIMITS)) {
        assert.match(
            dartSource,
            new RegExp(`static const int ${name} = ${value};`)
        );
    }
});

test('valid application text remains accepted', () => {
    assert.doesNotThrow(() =>
        validateApplicationFieldLimits({
            personal: { first_name: 'Dina', last_name: 'Caradonna' },
            academic: { current_section: 'B', lrn: '123456789012' },
            essays: {
                describe_yourself_essay: 'Short answer.',
                aims_and_ambition_essay: 'Another short answer.',
            },
        })
    );
});

test('oversized name returns a 400 validation error', () => {
    assert.throws(
        () =>
            validateApplicationFieldLimits({
                personal: {
                    first_name: 'A'.repeat(APPLICATION_FIELD_LIMITS.name + 1),
                },
            }),
        (error) =>
            error?.statusCode === 400 &&
            error?.code === 'APPLICATION_FIELD_TOO_LONG'
    );
});

test('oversized essay returns a 400 validation error', () => {
    assert.throws(
        () =>
            validateApplicationFieldLimits({
                essays: {
                    describe_yourself_essay: 'A'.repeat(
                        APPLICATION_FIELD_LIMITS.essay + 1
                    ),
                },
            }),
        (error) => error?.statusCode === 400
    );
});

test('family company/address uses the shared long-address cap', () => {
    assert.throws(
        () =>
            validateApplicationFieldLimits({
                family: {
                    father: {
                        company_name_and_address: 'A'.repeat(
                            APPLICATION_FIELD_LIMITS.longAddress + 1
                        ),
                    },
                },
            }),
        (error) => error?.statusCode === 400
    );
});

test('LRN cannot exceed the 12-digit field cap', () => {
    assert.throws(
        () =>
            validateApplicationFieldLimits({
                academic: { lrn: '1234567890123' },
            }),
        (error) => error?.statusCode === 400
    );
});
