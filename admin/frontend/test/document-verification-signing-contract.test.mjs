import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = fs.readFileSync(
  path.resolve('src/pages/DocumentVerification.jsx'),
  'utf8',
);

test('signing evidence has correct labels and non-blocking review configuration', () => {
  assert.match(source, /id: 'student_signature',[\s\S]*name: 'Student Signature',[\s\S]*required: false/);
  assert.match(source, /id: 'guardian_signature',[\s\S]*name: 'Parent \/ Guardian Signature',[\s\S]*required: false/);
  assert.match(source, /id: 'guardian_id',[\s\S]*name: 'Parent \/ Guardian Valid ID',[\s\S]*required: false/);
});

test('signing evidence is grouped and guardian metadata is displayed', () => {
  assert.match(source, /key: 'signing'/);
  assert.match(source, /application\?\.signing_metadata\?\.guardian_name/);
  assert.match(source, /Compare signatures manually only/);
  assert.match(source, /no visible signature/);
});

test('guardian evidence defaults to an individual preview and exposes an optional split view', () => {
  assert.match(source, /const \[signingViewMode, setSigningViewMode\] = useState\('preview'\)/);
  assert.match(source, /function GuardianEvidenceViewer\(\{ activeDoc, documents, application, viewMode \}\)/);
  assert.match(source, /viewMode=\{signingViewMode\}/);
  assert.match(source, /aria-label="Guardian signing evidence view"/);
  assert.match(source, /onClick=\{\(\) => setSigningViewMode\('preview'\)\}/);
  assert.match(source, /onClick=\{\(\) => setSigningViewMode\('split'\)\}/);
  assert.match(source, /const isSplit = viewMode === 'split'/);
  assert.match(source, /\{isSplit \? <DocumentPreviewPanel activeDoc=\{counterpart\} application=\{application\} \/> : null\}/);
});

test('guardian split view retains independent secure preview states and responsive layout', () => {
  assert.match(source, /grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4/);
  assert.match(source, /<DocumentPreviewPanel activeDoc=\{activeDoc\} application=\{application\} \/>/);
  assert.match(source, /<DocumentPreviewPanel activeDoc=\{counterpart\} application=\{application\} \/>/);
  assert.match(source, /No document uploaded/);
  assert.match(source, /Preview unavailable/);
  assert.match(source, /Open larger preview of/);
});

test('switching document tabs resets only the signing comparison mode', () => {
  assert.match(source, /const handleDocumentSelection = useCallback\(\(documentId\) => \{\s*setActiveDocId\(documentId\);\s*setSigningViewMode\('preview'\);\s*\}, \[\]\)/);
  assert.match(source, /onSelectDoc=\{handleDocumentSelection\}/);
  assert.match(source, /onClick=\{\(\) => handleDocumentSelection\(document\.id\)\}/);
  assert.match(source, /useEffect\(\(\) => \{\s*setSigningViewMode\('preview'\);\s*\}, \[activeDocId\]\)/);
  assert.match(source, /const \[viewMode, setViewMode\] = useState\('preview'\)/);
  assert.match(source, /viewMode === 'ocr'/);
  assert.match(source, /activeDocumentSupportsOcr && \(/);
});

test('student signatures remain individual previews without guardian split controls', () => {
  assert.match(source, /GUARDIAN_EVIDENCE_DOCUMENT_IDS = new Set\(\['guardian_signature', 'guardian_id'\]\)/);
  assert.match(source, /SIGNING_DOCUMENT_KEYS\.has\(activeDoc\?\.id\)/);
  assert.doesNotMatch(source, /student_signature'.{0,200}GuardianEvidenceViewer/s);
});

test('previews use the authorized backend signed-url route rather than storage paths', () => {
  assert.match(source, /\/documents\/\$\{encodeURIComponent\(activeDoc\.id\)\}\/view-url/);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('current version is shown when the backend returns it', () => {
  assert.match(source, /Current document version: v\{activeDoc\.current_version_number\}/);
});
