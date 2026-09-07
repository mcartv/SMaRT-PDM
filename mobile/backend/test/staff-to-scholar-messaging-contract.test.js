'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');

test('scholar support thread follows the latest active staff conversation', () => {
  const service = read('mobile', 'backend', 'src', 'services', 'messageService.js');

  assert.match(service, /resolveSupportCounterpartyId/);
  assert.match(service, /latestActiveSupportId/);
  assert.match(service, /isActiveSupportProfile/);
  assert.match(service, /sendToFixedThread\(userId, messageBody, counterpartyId = null\)/);
  assert.match(service, /markFixedThreadRead\(userId, counterpartyId = null\)/);
});

test('mobile preserves the selected staff counterparty for replies and read receipts', () => {
  const controller = read('mobile', 'backend', 'src', 'controllers', 'messageController.js');
  const client = read(
    'mobile',
    'frontend',
    'lib',
    'features',
    'messaging',
    'data',
    'services',
    'message_service.dart'
  );

  assert.match(controller, /getSupportCounterpartyId\(req\)/);
  assert.match(client, /_lastConversationCounterpartyId\s*=\s*response\['counterpartyId'\]/);
  assert.match(client, /'counterpartyId': _lastConversationCounterpartyId/);
});
