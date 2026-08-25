'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const sourceRoots = [
  path.join(projectRoot, 'admin', 'backend'),
  path.join(projectRoot, 'admin', 'frontend', 'src'),
  path.join(projectRoot, 'backend', 'src'),
  path.join(projectRoot, 'mobile', 'smartpdm_mobileapp', 'lib'),
  path.join(projectRoot, 'ocr-scanner'),
];
const textExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.dart', '.py', '.sql', '.css', '.json']);
const badSequences = ['•', '—', '–', '’', '“', 'â€', '₱', 'ï»¿', 'Ã', 'Â'];

function shouldSkip(filePath) {
  const name = path.basename(filePath).toLowerCase();
  return (
    name === 'encoding-mojibake-regression.test.js' ||
    name.includes('.backup') ||
    name.includes('.bak') ||
    name.includes('.before-') ||
    filePath.includes(`${path.sep}node_modules${path.sep}`) ||
    filePath.includes(`${path.sep}dist${path.sep}`) ||
    filePath.includes(`${path.sep}build${path.sep}`) ||
    filePath.includes(`${path.sep}.dart_tool${path.sep}`)
  );
}

function collectFiles(root, output = []) {
  if (!fs.existsSync(root)) return output;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (shouldSkip(fullPath)) continue;
    if (entry.isDirectory()) collectFiles(fullPath, output);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) output.push(fullPath);
  }

  return output;
}

test('active project source contains no common visible mojibake sequences', () => {
  const problems = [];

  for (const filePath of sourceRoots.flatMap((root) => collectFiles(root))) {
    const text = fs.readFileSync(filePath, 'utf8');
    const relative = path.relative(projectRoot, filePath);


    for (const sequence of badSequences) {
      if (text.includes(sequence)) problems.push(`${relative}: ${JSON.stringify(sequence)}`);
    }
  }

  assert.deepEqual(problems, []);
});
