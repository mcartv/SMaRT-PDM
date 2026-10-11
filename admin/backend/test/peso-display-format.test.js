'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read } = require('./_current-system-test-utils');

test('peso displays use thousands commas and no decimal places', () => {
  const context = vm.createContext({});
  vm.runInContext(read('frontend/src/utils/currency.js').replace('export function', 'function'), context);
  for (const [value, expected] of [
    [0, '₱0'], [999, '₱999'], [1000, '₱1,000'], ['1234567', '₱1,234,567'],
    [1250.25, '₱1,250'], [1250.75, '₱1,251'], [-1000, '-₱1,000'],
    [null, '—'], ['', '—'], ['invalid', '—'], [Infinity, '—'],
  ]) {
    assert.equal(context.formatPeso(value), expected);
  }
});
