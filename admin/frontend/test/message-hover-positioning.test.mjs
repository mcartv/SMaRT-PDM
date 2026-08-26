import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(testDirectory, '..', 'src', 'pages', 'AdminMessages.jsx'),
  'utf8',
);

test('message timestamp stays left unless the sender owns it and Info is open', () => {
  assert.match(source, /placement=\{isMine && infoPanelOpen \? 'right' : 'left'\}/);
  assert.match(source, /infoPanelOpen=\{groupInfoOpen\}/);
});

test('message options tooltip is rendered above the three-dot button', () => {
  assert.match(source, /open=\{optionsTooltipOpen && !actionsOpen\} placement="top"/);
  assert.match(source, />\s*Message options\s*<\/FloatingMessageTooltip>/);
});

test('hover tooltips render through a fixed document-body portal to avoid chat clipping', () => {
  assert.match(source, /createPortal\(/);
  assert.match(source, /pointer-events-none fixed z-\[200\]/);
  assert.match(source, /document\.body/);
});
