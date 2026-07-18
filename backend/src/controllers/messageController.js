const messageService = require('../services/messageService');
const { getSafeStatusCode } = require('../utils/httpStatus');
const adminRealtimeRelayService = require('../services/adminRealtimeRelayService');

function getCurrentUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function getCurrentRole(req) {
  return String(req.user?.role || '').trim().toLowerCase();
}

function isAdminLike(req) {
  const role = getCurrentRole(req);
  return ['admin', 'osfa_admin', 'sdo', 'guidance', 'pd'].includes(role);
}

function getMessageBody(req) {
  return req.body?.messageBody ?? req.body?.message_body ?? req.body?.message;
}

exports.getUnreadCount = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const unreadCount = await messageService.getUnreadCount(currentUserId);

    return res.status(200).json({ unreadCount });
  } catch (error) {
    console.error('GET MESSAGE UNREAD COUNT ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load unread message count.',
    });
  }
};

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

exports.sendThreadMessage = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const messageBody = getMessageBody(req);

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

exports.getConversations = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const items = await messageService.listAdminConversations(currentUserId);

    /*
      Keep raw array response because the admin web widget likely already expects it.
    */
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

    return res.status(200).json({
      counterpartyId,
      items,
    });
  } catch (error) {
    console.error('GET MESSAGE CONVERSATION ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load conversation.',
    });
  }
};

exports.sendConversationMessage = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;
    const messageBody = getMessageBody(req);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!messageBody || !String(messageBody).trim()) {
      return res.status(400).json({ error: 'Message body is required.' });
    }

    const payload = await messageService.sendAdminConversationMessage(
      currentUserId,
      counterpartyId,
      String(messageBody).trim()
    );

    return res.status(201).json(payload);
  } catch (error) {
    console.error('SEND MESSAGE CONVERSATION ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to send conversation message.',
    });
  }
};

exports.markConversationRead = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const payload = await messageService.markAdminConversationRead(
      currentUserId,
      counterpartyId
    );

    return res.status(200).json(payload);
  } catch (error) {
    console.error('MARK MESSAGE CONVERSATION READ ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to mark conversation as read.',
    });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const items = isAdminLike(req)
      ? await messageService.listRoomsForAdmin(currentUserId)
      : await messageService.listRoomsForUser(currentUserId);

    return res.status(200).json({ items });
  } catch (error) {
    console.error('GET MESSAGE ROOMS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load message rooms.',
    });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!isAdminLike(req)) {
      return res.status(403).json({ error: 'Only administrators can create group chats.' });
    }

    const roomName =
      req.body?.roomName ||
      req.body?.room_name ||
      req.body?.name ||
      'Group Chat';

    const userIds =
      req.body?.userIds ||
      req.body?.user_ids ||
      req.body?.memberIds ||
      req.body?.member_ids ||
      [];

    const payload = await messageService.createRoom(
      currentUserId,
      String(roomName).trim(),
      Array.isArray(userIds) ? userIds : []
    );

    return res.status(201).json(payload);
  } catch (error) {
    console.error('CREATE MESSAGE ROOM ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to create room.',
    });
  }
};

exports.getRoomThread = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const items = await messageService.fetchRoomThread(currentUserId, roomId);

    return res.status(200).json({
      roomId,
      items,
    });
  } catch (error) {
    console.error('GET MESSAGE ROOM THREAD ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load room messages.',
    });
  }
};

exports.sendRoomMessage = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;
    const messageBody = getMessageBody(req);

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!messageBody || !String(messageBody).trim()) {
      return res.status(400).json({ error: 'Message body is required.' });
    }

    const payload = await messageService.sendRoomMessage(
      currentUserId,
      roomId,
      String(messageBody).trim()
    );

    return res.status(201).json(payload);
  } catch (error) {
    console.error('SEND MESSAGE ROOM ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to send room message.',
    });
  }
};

exports.markRoomThreadRead = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const payload = await messageService.markRoomThreadRead(currentUserId, roomId);

    return res.status(200).json(payload);
  } catch (error) {
    console.error('MARK MESSAGE ROOM READ ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to mark room messages as read.',
    });
  }
};

exports.addRoomMembers = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!isAdminLike(req)) {
      return res.status(403).json({ error: 'Only administrators can add room members.' });
    }

    const memberIds =
      req.body?.memberIds ||
      req.body?.member_ids ||
      req.body?.userIds ||
      req.body?.user_ids ||
      [];

    const payload = await messageService.addGroupMembers(
      currentUserId,
      roomId,
      Array.isArray(memberIds) ? memberIds : []
    );

    return res.status(201).json({
      items: payload,
    });
  } catch (error) {
    console.error('ADD MESSAGE ROOM MEMBERS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to add room members.',
    });
  }
};

exports.removeRoomMember = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId, memberId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!isAdminLike(req)) {
      return res.status(403).json({ error: 'Only administrators can remove room members.' });
    }

    const payload = await messageService.removeGroupMember(
      currentUserId,
      roomId,
      memberId
    );

    return res.status(200).json(payload);
  } catch (error) {
    console.error('REMOVE MESSAGE ROOM MEMBER ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to remove room member.',
    });
  }
};