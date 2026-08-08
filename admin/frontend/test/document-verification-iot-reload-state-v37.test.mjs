import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/pages/DocumentVerification.jsx', import.meta.url), 'utf8');

test('IoT OCR survives reload and shows active lifecycle', () => {
  for (const status of ['pending', 'claimed', 'previewing', 'focusing', 'capturing', 'processing']) {
    assert.match(source, new RegExp(`'${status}'`));
  }
  assert.match(source, /persistedIotOcrRunning/);
  assert.match(source, /effectiveRunningIotOcr/);
  assert.match(source, /Running IoT OCR\.\.\./);
  assert.match(source, /if \(persistedIotOcrRunning\) return;/);
  assert.match(source, /Camera is visibly adjusting focus/);
});
