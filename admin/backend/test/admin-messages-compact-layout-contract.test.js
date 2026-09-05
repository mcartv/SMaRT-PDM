const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const source = fs.readFileSync(
  path.join(repoRoot, 'admin', 'frontend', 'src', 'pages', 'AdminMessages.jsx'),
  'utf8'
);

test('conversation list supports full and avatar-only compact widths', () => {
  assert.match(source, /conversationPaneMode/);
  assert.match(source, /:\s*'lg:grid-cols-\[340px_minmax\(0,1fr\)\]'/);
  assert.match(source, /conversationPaneMode === 'compact'[\s\S]*lg:grid-cols-\[76px_minmax\(0,1fr\)\]/);
});

test('chat list width control toggles the two supported modes', () => {
  assert.match(source, /conversationPaneModes = \['full', 'compact'\]/);
  assert.match(source, /Compact chat list/);
  assert.match(source, /Expand chat list/);
  assert.match(source, /setConversationPaneMode/);
});

test('avatar-only mode hides thread text and thread options', () => {
  assert.match(source, /const iconOnly = density === 'compact'/);
  assert.match(source, /!iconOnly \? \(/);
  assert.match(source, /!item\.isSearchResult && !iconOnly/);
  assert.match(source, /title=\{iconOnly \? item\.name : undefined\}/);
});

test('compact mode keeps identity but removes full metadata density', () => {
  assert.match(source, /const compact = density === 'compact'/);
  assert.match(source, /!compact \? \(/);
  assert.match(source, /density=\{conversationPaneMode\}/);
});

test('group info is embedded beside the conversation on desktop', () => {
  assert.match(source, /conversationWithInfoGridClass/);
  assert.match(source, /groupInfoOpen \? 'hidden lg:flex'/);
  assert.match(source, /renderGroupInfo\(\{ embedded: true \}\)/);
});

test('group information no longer renders as a fixed right drawer', () => {
  assert.match(source, /aria-label="Group information"/);
  assert.match(source, /group-info-panel flex h-full min-h-0 w-full flex-col/);
  assert.doesNotMatch(source, /fixed inset-y-0 right-0 z-\[90\]/);
});

test('Search members regression is removed and Search chat is restored', () => {
  assert.doesNotMatch(source, /placeholder="Search members"/);
  assert.doesNotMatch(source, /aria-label="Search group members"/);
  assert.match(source, />Search chat</);
  assert.match(source, /onSearchChat/);
});

test('group info keeps member actions and leave group', () => {
  assert.match(source, /Make group admin/);
  assert.match(source, /Remove member/);
  assert.match(source, /Add To Group/);
  assert.match(source, /Leave group/);
});

test('small header actions hide long labels on narrow screens', () => {
  assert.match(source, /hidden sm:inline">Archived/);
  assert.match(source, /hidden sm:inline">Group/);
});
