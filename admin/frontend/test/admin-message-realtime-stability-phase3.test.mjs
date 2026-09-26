import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(
  path.resolve(__dirname, '../src/pages/AdminMessages.jsx'),
  'utf8'
)

test('admin creation compatibility events share one message-id dedupe guard', () => {
  assert.match(source, /processedRealtimeMessageIdsRef = useRef\(new Set\(\)\)/)
  assert.match(source, /useSocketEvent\(\s*'message:new'/s)
  assert.match(source, /useSocketEvent\(\s*'message:created'/s)
  assert.match(source, /if \(processedIds\.has\(messageId\)\) return/)
})

test('admin realtime list reconciliation is debounced and uses current thread refs', () => {
  assert.match(source, /realtimeListSyncTimerRef = useRef\(null\)/)
  assert.match(source, /const scheduleRealtimeListSync = useCallback/)
  assert.match(source, /fetchConversations\(activeConversationRef\.current\)/)
  assert.match(source, /fetchRooms\(activeRoomRef\.current\)/)
  assert.match(source, /\}, 180\)/)
})

test('admin message mutation/read events use the coalesced list sync path', () => {
  for (const eventName of ['message:updated', 'message:read', 'message:unread', 'message:hidden']) {
    const eventIndex = source.indexOf(`'${eventName}'`)
    assert.notEqual(eventIndex, -1, `${eventName} handler should exist`)
    const window = source.slice(eventIndex, eventIndex + 5000)
    assert.match(window, /scheduleRealtimeListSync\(\)/, `${eventName} should schedule one coalesced list sync`)
  }
})

test('admin realtime callbacks do not keep stale hook dependencies or unused event aliases', () => {
  assert.doesNotMatch(source, /async \(rawPayload = \{\},\s*eventName\s*=/)

  const incomingStart = source.indexOf('const handleIncomingMessageRealtime = useCallback')
  assert.notEqual(incomingStart, -1)
  const incomingEnd = source.indexOf("useSocketEvent(\n    'message:typing'", incomingStart)
  assert.notEqual(incomingEnd, -1)
  const incomingWindow = source.slice(incomingStart, incomingEnd)
  assert.doesNotMatch(incomingWindow, /\n\s*fetchConversations,\s*\n/)
  assert.doesNotMatch(incomingWindow, /\n\s*fetchRooms,\s*\n/)

  const readStart = source.indexOf("useSocketEvent(\n    'message:read'")
  assert.notEqual(readStart, -1)
  const readEnd = source.indexOf("useSocketEvent(\n    'message:unread'", readStart)
  assert.notEqual(readEnd, -1)
  const readWindow = source.slice(readStart, readEnd)
  const dependencyStart = readWindow.lastIndexOf('    [')
  const dependencyWindow = dependencyStart >= 0 ? readWindow.slice(dependencyStart) : ''
  assert.doesNotMatch(dependencyWindow, /activeConversationId/)
  assert.doesNotMatch(dependencyWindow, /activeRoomId/)
})
