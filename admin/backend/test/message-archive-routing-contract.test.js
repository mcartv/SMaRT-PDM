const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerSource = fs.readFileSync(
  path.join(__dirname, '../controllers/messageController.js'),
  'utf8'
);
const serviceSource = fs.readFileSync(
  path.join(__dirname, '../services/messageService.js'),
  'utf8'
);

test('active private conversation query excludes per-user archived threads', () => {
  assert.match(controllerSource, /FROM message_thread_archives mta/);
  assert.match(controllerSource, /mta\.thread_type = 'private'/);
  assert.match(controllerSource, /mta\.counterparty_id = CASE/);
});

test('active room queries exclude per-user archived room threads', () => {
  assert.match(controllerSource, /mta\.thread_type = 'group'/);
  assert.match(controllerSource, /mta\.room_id = cr\.room_id/);
});

test('archive and restore controller handlers persist through messageService', () => {
  assert.match(
    controllerSource,
    /messageService\.archiveConversation\(\s*currentUserId,\s*counterpartyId\s*\)/
  );
  assert.match(
    controllerSource,
    /messageService\.restoreConversation\(\s*currentUserId,\s*counterpartyId\s*\)/
  );
  assert.match(
    controllerSource,
    /messageService\.fetchArchivedThreads\(currentUserId\)/
  );
  assert.match(
    controllerSource,
    /messageService\.archiveRoom\(currentUserId,\s*roomId,\s*\{/
  );
  assert.match(
    controllerSource,
    /messageService\.restoreRoom\(currentUserId,\s*roomId,\s*\{/
  );

  assert.doesNotMatch(
    controllerSource,
    /exports\.getArchivedThreads = async \(req, res\) => \{\s*return res\.json\(\{\s*items: \[\],\s*archived: \[\]/
  );
});

test('room archive service preserves membership checks except for explicit system-admin bypass', () => {
  assert.match(
    serviceSource,
    /exports\.archiveRoom = async \(\s*currentUserId,\s*roomId,\s*\{ skipMembershipCheck = false \} = \{\}\s*\)/
  );
  assert.match(
    serviceSource,
    /if \(!skipMembershipCheck\) \{\s*await ensureRoomMembership\(currentUserId, roomId\);/
  );
  assert.match(
    serviceSource,
    /exports\.restoreRoom = async \(\s*currentUserId,\s*roomId,\s*\{ skipMembershipCheck = false \} = \{\}\s*\)/
  );
});
