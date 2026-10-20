'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const servicePath = path.resolve(__dirname, '..', 'src', 'services', 'applicationSigningService.js');
const source = fs.readFileSync(servicePath, 'utf8');
const hashSection = source.slice(0, source.indexOf('function fileType'));
const sandbox = {
    process: { env: {} },
    require: (name) => {
        if (name === 'crypto') return require('crypto');
        if (name === '../config/supabase') return {};
        throw new Error(`Unexpected module: ${name}`);
    },
    module: { exports: {} },
};
vm.runInNewContext(`${hashSection}\nmodule.exports = { hashApplicationForm, canonicalizeApplicationForm };`, sandbox);
const { hashApplicationForm, canonicalizeApplicationForm } = sandbox.module.exports;

test('signing hash is deterministic across object key ordering', () => {
    assert.equal(
        hashApplicationForm({ opening_id: 'opening-1', personal: { first_name: 'Ada', age: 18 } }),
        hashApplicationForm({ personal: { age: 18, first_name: 'Ada' }, opening_id: 'opening-1' })
    );
});

test('optional family mobile empty forms canonicalize to the submitted N/A representation', () => {
    const blank = { family: { father: { mobile: '  ' }, mother: { mobile: null }, guardian: { mobile: 'n/a' } } };
    const submitted = { family: { guardian: { mobile: 'N/A' }, mother: { mobile: 'N/A' }, father: { mobile: 'N/A' } } };
    assert.deepEqual(canonicalizeApplicationForm(blank), canonicalizeApplicationForm(submitted));
    assert.equal(hashApplicationForm(blank), hashApplicationForm(submitted));
});

test('numeric form values canonicalize across transport formatting', () => {
    assert.equal(
        hashApplicationForm({ personal: { age: '018' }, academic: { gwa: '1.00' } }),
        hashApplicationForm({ personal: { age: 18 }, academic: { gwa: 1 } })
    );
});

test('a material application edit remains hash-distinct', () => {
    assert.notEqual(
        hashApplicationForm({ personal: { first_name: 'Ada' } }),
        hashApplicationForm({ personal: { first_name: 'Grace' } })
    );
});

test('submission continues to send the canonical signing hash to the atomic RPC', () => {
    assert.match(source, /p_application_form_hash:\s*hashApplicationForm\(applicationForm\)/);
});
