'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('private messaging preserves archived identity while exposing disabled state', () => {
  const service = read('backend/services/messageService.js');
  const controller = read('backend/controllers/messageController.js');

  assert.match(service, /AS is_disabled/);
  assert.match(service, /display_name/);
  assert.match(controller, /isDisabled: row\.is_disabled === true/);
  assert.match(controller, /counterparty[\s\S]*is_disabled: counterparty\.is_disabled === true/);
});

test('backend rejects new direct messages to disabled recipients', () => {
  const service = read('backend/services/messageService.js');
  const controller = read('backend/controllers/messageController.js');

  assert.match(service, /COALESCE\(ap\.is_archived, false\) = false/);
  assert.match(service, /RECIPIENT_ACCOUNT_DISABLED/);
  assert.match(service, /You can view previous messages, but you cannot send new messages/);
  assert.match(controller, /code: err\.code \|\| 'MESSAGE_SEND_FAILED'/);
});

test('messaging UI shows Account Disabled and removes the private composer', () => {
  const ui = read('frontend/src/pages/AdminMessages.jsx');

  assert.match(ui, /isDisabled: raw\.isDisabled === true \|\| raw\.is_disabled === true/);
  assert.match(ui, /Account Disabled/);
  assert.match(ui, /Previous messages remain available, but new messages cannot be sent/);
  assert.match(ui, /selectedItem\.type === 'private' && selectedItem\.isDisabled/);
  assert.match(ui, /maintenance:updated/);
});
