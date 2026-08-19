'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

const fixer = path.resolve(__dirname, 'fix_mojibake.cjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'smartpdm-encoding-test-'));
const file = path.join(temp, 'sample.jsx');

fs.writeFileSync(file, [
  "const a = 'Kaizen Scholarship â€¢ Kaizen Foundation';",
  "const b = '2026â€“2027 â€¢ Aug 15';",
  "const c = 'â‚±75,000';",
  "const d = 'No value â€”';",
  "const e = 'JosÃ©';",
].join('\n'), 'utf8');

const result = spawnSync(process.execPath, [fixer, temp], { encoding: 'utf8' });
const fixed = fs.readFileSync(file, 'utf8');

assert.match(fixed, /Kaizen Scholarship • Kaizen Foundation/);
assert.match(fixed, /2026–2027 • Aug 15/);
assert.match(fixed, /₱75,000/);
assert.match(fixed, /No value —/);
assert.match(fixed, /José/);

console.log('Encoding cleanup self-test passed.');
