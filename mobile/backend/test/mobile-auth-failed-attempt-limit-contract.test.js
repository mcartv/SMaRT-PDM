'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(
    path.resolve(__dirname, '../src/app.js'),
    'utf8'
);

function limiterBlock(name, nextName) {
    const start = appSource.indexOf(`const ${name} = rateLimit({`);
    const end = appSource.indexOf(`const ${nextName} = rateLimit({`, start);

    assert.notEqual(start, -1, `${name} is missing`);
    assert.notEqual(end, -1, `${nextName} boundary is missing`);

    return appSource.slice(start, end);
}

test('mobile login limits failed attempts without counting successful logins', () => {
    const block = limiterBlock('loginLimiter', 'registrationLimiter');

    assert.match(block, /windowMs:\s*15 \* 60 \* 1000/);
    assert.match(block, /max:\s*10/);
    assert.match(block, /skipSuccessfulRequests:\s*true/);
    assert.match(appSource, /app\.use\('\/api\/auth\/login', loginLimiter\)/);
});

test('mobile registration limits failed attempts without counting successful sign-ups', () => {
    const block = limiterBlock('registrationLimiter', 'recoveryLimiter');

    assert.match(block, /windowMs:\s*15 \* 60 \* 1000/);
    assert.match(block, /max:\s*5/);
    assert.match(block, /skipSuccessfulRequests:\s*true/);
    assert.match(appSource, /app\.use\('\/api\/auth\/register', registrationLimiter\)/);
});
