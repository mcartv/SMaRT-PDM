// SMaRT-PDM: Messaging — message Reply Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const replyService = require('../services/messageReplyCompatibility');
const messageHistoryService = require('../services/messageHistoryService');
const { getSafeStatusCode } = require('../utils/httpStatus');

// userId: handles user id for the Messaging flow.
function userId(req) {
  return (
    req.user?.userId ||
    req.user?.user_id ||
    req.user?.id ||
    req.userId ||
    ''
  );
}

// messageBody: handles message body for the Messaging flow.
function messageBody(req) {
  return String(req.body?.messageBody ?? req.body?.message_body ?? '').trim();
}

// replyToMessageId: handles reply to message id for the Messaging flow.
function replyToMessageId(req) {
  return String(
    req.body?.replyToMessageId ?? req.body?.reply_to_message_id ?? ''
  ).trim();
}

exports.sendThreadReply = async (req, res) => {
  try {
    const body = messageBody(req);
    if (!body) return res.status(400).json({ error: 'Message body is required.' });

    const currentUserId = userId(req);
    const supportCounterpartyId = await messageHistoryService.resolveSupportCounterpartyId(
      currentUserId,
      req.body?.counterpartyId ?? req.body?.counterparty_id ?? null
    );
    const payload = await replyService.sendPrivateReply({
      userId: currentUserId,
      messageBody: body,
      replyToMessageId: replyToMessageId(req),
      counterpartyId: supportCounterpartyId,
    });
    return res.status(201).json(payload);
  } catch (error) {
    console.error('SEND PRIVATE MESSAGE REPLY ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to send reply.',
    });
  }
};

exports.sendRoomReply = async (req, res) => {
  try {
    const body = messageBody(req);
    if (!body) return res.status(400).json({ error: 'Message body is required.' });

    const payload = await replyService.sendRoomReply({
      userId: userId(req),
      roomId: req.params.roomId,
      messageBody: body,
      replyToMessageId: replyToMessageId(req),
    });
    return res.status(201).json(payload);
  } catch (error) {
    console.error('SEND GROUP MESSAGE REPLY ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to send reply.',
    });
  }
};
