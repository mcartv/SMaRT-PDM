const messageService = require('../services/messageService');
const { getSafeStatusCode } = require('../utils/httpStatus');

function getCurrentUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

exports.getThread = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const payload = await messageService.listFixedThread(currentUserId);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('GET MESSAGE THREAD ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load messages.',
    });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const items = await messageService.listAdminConversations(currentUserId);
    return res.status(200).json(items);
  } catch (error) {
    console.error('GET MESSAGE CONVERSATIONS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load conversations.',
    });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const items = await messageService.fetchAdminConversationMessages(
      currentUserId,
      counterpartyId
    );

    return res.status(200).json({ items });
  } catch (error) {
    console.error('GET MESSAGE CONVERSATION ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load conversation.',
    });
  }
};

exports.sendThreadMessage = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const messageBody = req.body?.messageBody;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!messageBody || !String(messageBody).trim()) {
      return res.status(400).json({ error: 'Message body is required.' });
    }

    const payload = await messageService.sendToFixedThread(
      currentUserId,
      String(messageBody).trim()
    );

    return res.status(201).json(payload);
  } catch (error) {
    console.error('SEND MESSAGE THREAD ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to send message.',
    });
  }
};

exports.markThreadRead = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const payload = await messageService.markFixedThreadRead(currentUserId);
    return res.status(200).json(payload);
  } catch (error) {
    console.error('MARK MESSAGE THREAD READ ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to mark messages as read.',
    });
  }
};
