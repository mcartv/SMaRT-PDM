const supabase = require('../config/supabase');
const messageService = require('./messageService');
const adminRealtimeRelayService = require('./adminRealtimeRelayService');

let installed = false;

function safeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function messageIdOf(message = {}) {
  return safeText(message.messageId || message.message_id);
}

async function loadDisplayNames(userIds) {
  const ids = Array.from(new Set(userIds.map(safeText).filter(Boolean)));
  const names = new Map();
  if (!ids.length) return names;

  const [studentsResult, adminsResult, usersResult] = await Promise.all([
    supabase
      .from('students')
      .select('user_id, first_name, last_name')
      .in('user_id', ids),
    supabase
      .from('admin_profiles')
      .select('user_id, first_name, last_name, position, department')
      .in('user_id', ids),
    supabase
      .from('users')
      .select('user_id, username, email')
      .in('user_id', ids),
  ]);

  for (const row of studentsResult.data || []) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    if (name) names.set(row.user_id, name);
  }
  for (const row of adminsResult.data || []) {
    if (names.has(row.user_id)) continue;
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    if (name) names.set(row.user_id, name);
  }
  for (const row of usersResult.data || []) {
    if (names.has(row.user_id)) continue;
    const fallback = safeText(row.username) || safeText(row.email);
    if (fallback) names.set(row.user_id, fallback);
  }

  return names;
}

async function enrichReplyContexts(items) {
  if (!Array.isArray(items) || !items.length) return items || [];

  const ids = items.map(messageIdOf).filter(Boolean);
  if (!ids.length) return items;

  const { data: rows, error } = await supabase
    .from('messages')
    .select('message_id, reply_to_message_id')
    .in('message_id', ids);

  if (error) {
    console.error('MESSAGE REPLY CONTEXT LOOKUP ERROR:', error);
    return items;
  }

  const replyIdByMessage = new Map();
  for (const row of rows || []) {
    if (row.reply_to_message_id) {
      replyIdByMessage.set(row.message_id, row.reply_to_message_id);
    }
  }

  const replyIds = Array.from(new Set(replyIdByMessage.values()));
  if (!replyIds.length) return items;

  const { data: replyRows, error: replyError } = await supabase
    .from('messages')
    .select('message_id, sender_id, message_body, unsent_at')
    .in('message_id', replyIds);

  if (replyError) {
    console.error('MESSAGE REPLY TARGET LOOKUP ERROR:', replyError);
    return items;
  }

  const names = await loadDisplayNames(
    (replyRows || []).map((row) => row.sender_id).filter(Boolean)
  );
  const replyById = new Map((replyRows || []).map((row) => [row.message_id, row]));

  return items.map((item) => {
    const id = messageIdOf(item);
    const replyId = replyIdByMessage.get(id);
    if (!replyId) return item;
    const reply = replyById.get(replyId);
    if (!reply) {
      return {
        ...item,
        replyToMessageId: replyId,
        reply_to_message_id: replyId,
      };
    }

    const replyBody = reply.unsent_at
      ? 'This message was unsent'
      : safeText(reply.message_body);
    const replySenderName = names.get(reply.sender_id) || '';

    return {
      ...item,
      replyToMessageId: replyId,
      reply_to_message_id: replyId,
      replyMessageBody: replyBody,
      reply_message_body: replyBody,
      replySenderId: reply.sender_id || null,
      reply_sender_id: reply.sender_id || null,
      replySenderName,
      reply_sender_name: replySenderName,
    };
  });
}

async function loadReplyTarget(replyToMessageId) {
  const replyId = safeText(replyToMessageId);
  if (!replyId) throw httpError(400, 'Reply target is required.');

  const { data, error } = await supabase
    .from('messages')
    .select('message_id, sender_id, receiver_id, room_id, subject, message_body, unsent_at')
    .eq('message_id', replyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw httpError(404, 'The message you are replying to was not found.');
  if (safeText(data.subject).toLowerCase() === 'system') {
    throw httpError(409, 'Conversation activity messages cannot be replied to.');
  }
  if (data.unsent_at) {
    throw httpError(409, 'This message was unsent and cannot be replied to.');
  }
  return data;
}

async function sendPrivateReply({
  userId,
  messageBody,
  replyToMessageId,
  counterpartyId,
}) {
  const currentUserId = safeText(userId);
  if (!currentUserId) throw httpError(401, 'Authentication required.');

  const target = await loadReplyTarget(replyToMessageId);
  if (target.room_id) {
    throw httpError(400, 'That reply target belongs to a group conversation.');
  }

  if (target.sender_id !== currentUserId && target.receiver_id !== currentUserId) {
    throw httpError(403, 'You can reply only to messages in your conversation.');
  }

  const inferredCounterparty =
    target.sender_id === currentUserId ? target.receiver_id : target.sender_id;
  const requestedCounterparty = safeText(counterpartyId);
  if (requestedCounterparty && requestedCounterparty !== inferredCounterparty) {
    throw httpError(409, 'The reply target does not belong to this conversation.');
  }

  const sent = await messageService.sendToFixedThreadReply(
    currentUserId,
    messageBody,
    inferredCounterparty,
    target.message_id
  );
  const [enriched = sent] = await enrichReplyContexts([sent]);

  adminRealtimeRelayService.relayMessageEvent(
    'message:updated',
    enriched,
    [currentUserId, inferredCounterparty].filter(Boolean)
  ).catch((error) => {
    console.error('[Admin Realtime Relay] reply update error:', error.message);
  });

  return enriched;
}

async function sendRoomReply({ userId, roomId, messageBody, replyToMessageId }) {
  const currentUserId = safeText(userId);
  const normalizedRoomId = safeText(roomId);
  if (!currentUserId) throw httpError(401, 'Authentication required.');
  if (!normalizedRoomId) throw httpError(400, 'roomId is required.');

  const target = await loadReplyTarget(replyToMessageId);
  if (safeText(target.room_id) !== normalizedRoomId) {
    throw httpError(409, 'The reply target does not belong to this group.');
  }

  const sent = await messageService.sendRoomMessageReply(
    currentUserId,
    normalizedRoomId,
    messageBody,
    target.message_id
  );
  const [enriched = sent] = await enrichReplyContexts([sent]);

  let memberIds = [currentUserId];
  try {
    const members = await messageService.fetchRoomMembers(
      currentUserId,
      normalizedRoomId
    );
    memberIds = members.map((member) => member.userId || member.user_id).filter(Boolean);
  } catch (error) {
    console.warn('MESSAGE REPLY MEMBER ENRICHMENT SKIPPED:', error.message);
  }

  adminRealtimeRelayService.relayMessageEvent(
    'message:updated',
    enriched,
    memberIds
  ).catch((error) => {
    console.error('[Admin Realtime Relay] group reply update error:', error.message);
  });

  return enriched;
}

function installMessageReplyCompatibility() {
  if (installed) return;
  installed = true;

  const wrapList = (name) => {
    const original = messageService[name];
    if (typeof original !== 'function') return;
    messageService[name] = async (...args) => {
      const items = await original(...args);
      return enrichReplyContexts(items);
    };
  };

  const wrapResultItems = (name) => {
    const original = messageService[name];
    if (typeof original !== 'function') return;
    messageService[name] = async (...args) => {
      const result = await original(...args);
      if (!result || !Array.isArray(result.items)) return result;
      return {
        ...result,
        items: await enrichReplyContexts(result.items),
      };
    };
  };

  wrapResultItems('listFixedThread');
  wrapResultItems('listAdminConversation');
  wrapList('fetchAdminConversationMessages');
  wrapList('fetchRoomThread');
  wrapList('fetchSharedConversationMessages');
}

module.exports = {
  installMessageReplyCompatibility,
  enrichReplyContexts,
  sendPrivateReply,
  sendRoomReply,
};
