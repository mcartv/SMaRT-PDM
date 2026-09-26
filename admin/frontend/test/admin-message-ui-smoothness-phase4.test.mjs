import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(
  path.resolve(import.meta.dirname, '../src/pages/AdminMessages.jsx'),
  'utf8'
)

test('admin messaging animates only the newest mounted message with reduced-motion support', () => {
  assert.match(source, /lastAnimatedMessageIdRef\s*=\s*useRef\(''\)/)
  assert.match(source, /prefers-reduced-motion:\s*reduce/)
  assert.match(source, /element\.animate\(/)
  assert.match(source, /duration:\s*170/)
})

test('admin thread changes use a lightweight transition instead of a layout rewrite', () => {
  assert.match(source, /lastAnimatedThreadKeyRef\s*=\s*useRef\(''\)/)
  assert.match(source, /const threadKey = `\$\{activeType\}:\$\{activeId\}`/)
  assert.match(source, /surface\.animate\(/)
  assert.match(source, /duration:\s*150/)
})

test('optimistic and confirmed messages keep a stable React key', () => {
  assert.match(source, /key=\{message\.clientMessageId \|\| message\.messageId\}/)
  assert.match(source, /data-message-id=\{message\.messageId\}/)
})
