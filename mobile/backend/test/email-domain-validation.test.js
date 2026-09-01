const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GMAIL_TYPO_ERROR,
  isValidEmail,
  normalizeEmail,
  validateEmail,
} = require('../src/utils/emailValidation');

test('accepts normal email domains and canonical Gmail', () => {
  assert.equal(isValidEmail('student@gmail.com'), true);
  assert.equal(isValidEmail('student@pdm.edu.ph'), true);
  assert.equal(normalizeEmail('  Student@GMAIL.COM  '), 'student@gmail.com');
});

test('rejects common Gmail typo domains', () => {
  const typoDomains = [
    'gmai.com',
    'gamil.com',
    'gmial.com',
    'gmali.com',
    'gmal.com',
    'gmaill.com',
    'gmail.co',
    'gmail.cm',
    'gmail.cmo',
    'gmail.con',
    'gmail.comm',
    'gmail.om',
    'gnail.com',
  ];

  for (const domain of typoDomains) {
    const result = validateEmail(`student@${domain}`);
    assert.equal(result.valid, false, domain);
    assert.equal(result.error, GMAIL_TYPO_ERROR, domain);
  }
});

test('rejects malformed email addresses', () => {
  assert.equal(isValidEmail('student@'), false);
  assert.equal(isValidEmail('student@gmail.c'), false);
  assert.equal(isValidEmail('student gmail.com'), false);
});
