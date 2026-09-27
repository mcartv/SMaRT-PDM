import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.resolve(here, '../src/pages/DocumentVerification.jsx'), 'utf8');

test('Birth review uses a clean large clickable image without permanent source-region grid', () => {
  assert.match(source, /Open captured Birth certificate preview/);
  assert.match(source, /cursor-zoom-in/);
  assert.match(source, /min-h-\[520px\]/);
  assert.match(source, /style=\{\{\s*width: '100%',\s*height: '100%',[\s\S]*objectFit: 'cover',[\s\S]*objectPosition: 'center center'/);
  assert.match(source, /relative h-full min-h-\[520px\] min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow/);
  assert.match(source, /grid items-stretch gap-5/);
  assert.doesNotMatch(source, /Birth scan-region legend/);
  assert.doesNotMatch(source, /All scan cells remain visible/);
});

test('Birth image click opens a full preview with an explicit exit control', () => {
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-label="Exit document preview"/);
  assert.match(source, /setPreviewOpen\(true\)/);
  assert.match(source, /setPreviewOpen\(false\)/);
  assert.match(source, /onWheel=\{\(event\) =>/);
  assert.match(source, /setPreviewZoom/);
  assert.match(source, /Math\.min\(4/);
  assert.match(source, /onPointerDown=\{\(event\) =>/);
  assert.match(source, /cursor-grab/);
  assert.match(source, /translate3d\(/);
  assert.match(source, /Scroll to zoom/);
  assert.match(source, /Drag to move/);
  assert.match(source, /color-mix\(in srgb, var\(--portal-base\)/);
});

test('Grade and Indigency preview component remains on its existing code path', () => {
  assert.match(source, /\['student_grade_forms', 'certificate_of_indigency'\]\.includes\(activeDoc\?\.id\).*<ScannedDocumentPreview/);
});

test('redundant OCR status and evidence summary cards are removed from all document reviews', () => {
  assert.doesNotMatch(source, />OCR status</);
  assert.doesNotMatch(source, />Evidence state</i);
  assert.doesNotMatch(source, /aria-label="OCR evidence states"/);
  assert.doesNotMatch(source, />Technical details</);
});
