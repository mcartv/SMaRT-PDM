'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('landing keeps expanded desktop hero while tightening small-screen navigation and content padding', () => {
  const landing = read('frontend/src/pages/SmartPDMLanding.jsx');

  assert.match(landing, /min-h-\[calc\(90svh-7rem\)\]/);
  assert.match(landing, /px-3 sm:px-5 md:px-8 lg:px-10/);
  assert.match(landing, /text-\[11px\][\s\S]*sm:text-xs/);
  assert.match(landing, /px-4 py-10 sm:px-5 sm:py-12 md:px-8 md:py-16/);
  assert.match(landing, /w-\[calc\(100vw-5\.5rem\)\][\s\S]*sm:w-\[320px\][\s\S]*lg:w-\[350px\]/);
  assert.match(landing, /landing-footer[\s\S]*px-4[\s\S]*sm:px-5[\s\S]*md:px-8/);
});

test('login fills the available viewport and hides large decorative wedges below desktop widths', () => {
  const login = read('frontend/src/pages/UnifiedLogin.jsx');
  const card = read('frontend/src/components/auth/UnifiedUserLoginCard.jsx');

  assert.match(login, /flex min-h-screen flex-col/);
  assert.match(login, /minHeight:\s*'100dvh'/);
  assert.match(login, /<main className="smartpdm-auth-main relative flex min-h-0 flex-1 overflow-x-hidden overflow-y-auto">/);
  assert.match(login, /hidden w-\[21vw\][\s\S]*lg:block/);
  assert.match(login, /bottom-0 right-\[-24px\][\s\S]*hidden[\s\S]*lg:block/);
  assert.match(login, /smartpdm-auth-grid[\s\S]*px-4 py-8 sm:px-6 sm:py-10 md:px-8/);
  assert.match(login, /prefers-reduced-motion: reduce/);
  assert.match(card, /mx-auto w-full max-w-\[430px\]/);
});
