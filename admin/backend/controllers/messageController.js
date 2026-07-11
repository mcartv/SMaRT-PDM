const messageService = require('../services/messageService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getCurrentUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function normalizeId(value) {
  return String(value || '').trim();
}

function uniqueIds(...values) {
  return [
    ...new Set(
      values
        .flat()
        .map((value) => normalizeId(value))
        .filter(Boolean)
    ),
  ];
}

function buildMessageSocketPayload(message) {
  return {
    message_id: message.message_id,
    sender_id: message.sender_id,
    receiver_id: message.receiver_id || null,
    room_id: message.room_id || null,
    subject: message.subject || null,
    message_body: message.message_body,
    attachment_url: message.attachment_url || null,
    sent_at: message.sent_at,
    is_read: message.is_read,
    sender_name: message.sender_name || '',
    sender_profile_photo_url: message.sender_profile_photo_url || null,
    sender_avatar_url: message.sender_avatar_url || null,
    created_at: new Date().toISOString(),
  };
}

async function getRoomMemberUserIds(roomId) {
  try {
    return await messageService.fetchRoomMemberUserIds(roomId);
  } catch (err) {
    console.error('FETCH ROOM MEMBER IDS ERROR:', err.message);
    return [];
  }
}

exports.getConversations = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const items = await messageService.fetchConversations(currentUserId);
    return res.json({ items });
  } catch (err) {
    console.error('GET CONVERSATIONS ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to load conversations',
      error: err.message,
    });
  }
};

exports.getConversationMessages = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const items = await messageService.fetchConversationMessages(
      currentUserId,
      counterpartyId
    );

    return res.json({ items });
  } catch (err) {
    console.error('GET CONVERSATION MESSAGES ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to load messages',
      error: err.message,
    });
  }
};

exports.markConversationRead = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messageIds = await messageService.markConversationRead(
      currentUserId,
      counterpartyId
    );

    const io = req.app.get('io');

    if (messageIds.length) {
      socketEvents.messageRead(
        io,
        {
          reader_id: currentUserId,
          counterparty_id: counterpartyId,
          room_id: null,
          message_ids: messageIds,
          updated_at: new Date().toISOString(),
        },
        {
          targetUserIds: uniqueIds(currentUserId, counterpartyId),
        }
      );
    }

    return res.json({ messageIds });
  } catch (err) {
    console.error('MARK CONVERSATION READ ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to mark conversation as read',
      error: err.message,
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const senderId = getCurrentUserId(req);
    const { counterpartyId } = req.params;
    const { subject, messageBody, attachmentUrl } = req.body || {};

    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!messageBody || !String(messageBody).trim()) {
      return res.status(400).json({ message: 'Message body is required' });
    }

    const message = await messageService.sendMessage({
      senderId,
      receiverId: counterpartyId,
      subject: subject || null,
      messageBody: String(messageBody).trim(),
      attachmentUrl: attachmentUrl || null,
    });

    const io = req.app.get('io');
    const payload = buildMessageSocketPayload(message);

    socketEvents.messageCreated(io, payload, {
      targetUserIds: uniqueIds(senderId, counterpartyId),
    });

    return res.status(201).json(message);
  } catch (err) {
    console.error('SEND MESSAGE ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to send message',
      error: err.message,
    });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const items = await messageService.fetchRooms(currentUserId);
    return res.json({ items });
  } catch (err) {
    console.error('GET ROOMS ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to load chat rooms',
      error: err.message,
    });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomName, memberIds = [] } = req.body || {};

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const room = await messageService.createRoom({
      creatorId: currentUserId,
      roomName: roomName || null,
      memberIds,
    });

    const targetUserIds = uniqueIds(room.member_ids || [], currentUserId);
    const io = req.app.get('io');

    socketEvents.roomCreated(
      io,
      {
        room_id: room.room_id,
        room_name: room.room_name,
        created_by: room.created_by,
        created_at: room.created_at,
        member_ids: targetUserIds,
      },
      {
        targetUserIds,
      }
    );

    return res.status(201).json(room);
  } catch (err) {
    console.error('CREATE ROOM ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to create chat room',
      error: err.message,
    });
  }
};

exports.getRoomMessages = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const items = await messageService.fetchRoomMessages(currentUserId, roomId);
    return res.json({ items });
  } catch (err) {
    console.error('GET ROOM MESSAGES ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to load room messages',
      error: err.message,
    });
  }
};

exports.sendRoomMessage = async (req, res) => {
  try {
    const senderId = getCurrentUserId(req);
    const { roomId } = req.params;
    const { subject, messageBody, attachmentUrl } = req.body || {};

    if (!senderId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!messageBody || !String(messageBody).trim()) {
      return res.status(400).json({ message: 'Message body is required' });
    }

    const message = await messageService.sendRoomMessage({
      senderId,
      roomId,
      subject: subject || null,
      messageBody: String(messageBody).trim(),
      attachmentUrl: attachmentUrl || null,
    });

    const memberIds = await getRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(memberIds, senderId);

    const io = req.app.get('io');
    const payload = buildMessageSocketPayload(message);

    socketEvents.messageCreated(io, payload, {
      targetUserIds,
    });

    return res.status(201).json(message);
  } catch (err) {
    console.error('SEND ROOM MESSAGE ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to send room message',
      error: err.message,
    });
  }
};

exports.addRoomMembers = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;
    const { memberIds = [] } = req.body || {};

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await messageService.addRoomMembers({
      actorId: currentUserId,
      roomId,
      memberIds,
    });

    const allRoomMemberIds = await getRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(allRoomMemberIds, currentUserId);

    const io = req.app.get('io');

    socketEvents.roomMembersAdded(
      io,
      {
        room_id: roomId,
        actor_id: currentUserId,
        added_count: result.added_count,
        members: result.members || [],
        updated_at: new Date().toISOString(),
      },
      {
        targetUserIds,
      }
    );

    return res.json(result);
  } catch (err) {
    console.error('ADD ROOM MEMBERS ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to add room members',
      error: err.message,
    });
  }
};

exports.markRoomMessagesRead = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messageIds = await messageService.markRoomMessagesRead(
      currentUserId,
      roomId
    );

    const memberIds = await getRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(memberIds, currentUserId);

    const io = req.app.get('io');

    if (messageIds.length) {
      socketEvents.messageRead(
        io,
        {
          reader_id: currentUserId,
          room_id: roomId,
          counterparty_id: null,
          message_ids: messageIds,
          updated_at: new Date().toISOString(),
        },
        {
          targetUserIds,
        }
      );
    }

    return res.json({ messageIds });
  } catch (err) {
    console.error('MARK ROOM MESSAGES READ ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to mark room messages as read',
      error: err.message,
    });
  }
};

exports.getScholarMembers = async (req, res) => {
  try {
    const items = await messageService.fetchScholarMembers();
    return res.json({ items });
  } catch (err) {
    console.error('GET SCHOLAR MEMBERS ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to load scholar member list',
      error: err.message,
    });
  }
};