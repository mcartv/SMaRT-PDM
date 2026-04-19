const messageService = require('../services/messageService');
const socketEvents = require('../utils/socketEvents');

exports.getConversations = async (req, res) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || req.user?.id;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const items = await messageService.fetchConversations(currentUserId);
    res.json({ items });
  } catch (err) {
    console.error('GET CONVERSATIONS ERROR:', err.message);
    res.status(500).json({
      message: 'Failed to load conversations',
      error: err.message,
    });
  }
};

exports.getConversationMessages = async (req, res) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || req.user?.id;
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const items = await messageService.fetchConversationMessages(currentUserId, counterpartyId);
    res.json({ items });
  } catch (err) {
    console.error('GET CONVERSATION MESSAGES ERROR:', err.message);
    res.status(500).json({
      message: 'Failed to load messages',
      error: err.message,
    });
  }
};

exports.markConversationRead = async (req, res) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || req.user?.id;
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messageIds = await messageService.markConversationRead(currentUserId, counterpartyId);
    res.json({ messageIds });
  } catch (err) {
    console.error('MARK CONVERSATION READ ERROR:', err.message);
    res.status(500).json({
      message: 'Failed to mark conversation as read',
      error: err.message,
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user?.userId || req.user?.user_id || req.user?.id;
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
    socketEvents.messageCreated(io, {
      message_id: message.message_id,
      sender_id: senderId,
      receiver_id: counterpartyId,
      created_at: new Date().toISOString()
    });

    res.status(201).json(message);
  } catch (err) {
    console.error('SEND MESSAGE ERROR:', err.message);
    res.status(500).json({
      message: 'Failed to send message',
      error: err.message,
    });
  }
};

exports.getRooms = async (req, res) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || req.user?.id;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const items = await messageService.fetchRooms(currentUserId);
    res.json({ items });
  } catch (err) {
    console.error('GET ROOMS ERROR:', err.message);
    res.status(500).json({
      message: 'Failed to load chat rooms',
      error: err.message,
    });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || req.user?.id;
    const { roomName, memberIds = [] } = req.body || {};

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const room = await messageService.createRoom({
      creatorId: currentUserId,
      roomName: roomName || null,
      memberIds,
    });

    res.status(201).json(room);
  } catch (err) {
    console.error('CREATE ROOM ERROR:', err.message);
    res.status(500).json({
      message: 'Failed to create chat room',
      error: err.message,
    });
  }
};

exports.getRoomMessages = async (req, res) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || req.user?.id;
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const items = await messageService.fetchRoomMessages(currentUserId, roomId);
    res.json({ items });
  } catch (err) {
    console.error('GET ROOM MESSAGES ERROR:', err.message);
    res.status(500).json({
      message: 'Failed to load room messages',
      error: err.message,
    });
  }
};

exports.sendRoomMessage = async (req, res) => {
  try {
    const senderId = req.user?.userId || req.user?.user_id || req.user?.id;
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

    res.status(201).json(message);
  } catch (err) {
    console.error('SEND ROOM MESSAGE ERROR:', err.message);
    res.status(500).json({
      message: 'Failed to send room message',
      error: err.message,
    });
  }
};

exports.addRoomMembers = async (req, res) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || req.user?.id;
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

    res.json(result);
  } catch (err) {
    console.error('ADD ROOM MEMBERS ERROR:', err.message);
    res.status(500).json({
      message: 'Failed to add room members',
      error: err.message,
    });
  }
};

exports.markRoomMessagesRead = async (req, res) => {
  try {
    const currentUserId = req.user?.userId || req.user?.user_id || req.user?.id;
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messageIds = await messageService.markRoomMessagesRead(currentUserId, roomId);
    res.json({ messageIds });
  } catch (err) {
    console.error('MARK ROOM MESSAGES READ ERROR:', err.message);
    res.status(500).json({
      message: 'Failed to mark room messages as read',
      error: err.message,
    });
  }
};

exports.getScholarMembers = async (req, res) => {
  try {
    const items = await messageService.fetchScholarMembers();
    res.json({ items });
  } catch (err) {
    console.error('GET SCHOLAR MEMBERS ERROR:', err.message);
    res.status(500).json({
      message: 'Failed to load scholar member list',
      error: err.message,
    });
  }
};