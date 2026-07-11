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

async function logMessageAudit({
  req,
  actionTaken,
  entityType,
  entityId = null,
  description,
  metadata = {},
}) {
  try {
    await auditLogService.logAudit({
      req,
      actionTaken,
      module: 'Messages',
      entityType,
      entityId,
      description,
      metadata,
    });
  } catch (err) {
    console.error('MESSAGE AUDIT LOG ERROR:', err.message);
  }
}

function emitMessageUnread(io, payload, targetUserIds = []) {
  if (!io) return;

  uniqueIds(targetUserIds).forEach((userId) => {
    io.to(`user:${userId}`).emit('message:unread', payload);
  });
}

function emitThreadArchived(io, payload, targetUserIds = []) {
  if (!io) return;

  uniqueIds(targetUserIds).forEach((userId) => {
    io.to(`user:${userId}`).emit('message:thread-archived', payload);
  });
}

function emitThreadRestored(io, payload, targetUserIds = []) {
  if (!io) return;

  uniqueIds(targetUserIds).forEach((userId) => {
    io.to(`user:${userId}`).emit('message:thread-restored', payload);
  });
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

exports.getArchivedThreads = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const items = await messageService.fetchArchivedThreads(currentUserId);

    return res.json({ items });
  } catch (err) {
    console.error('GET ARCHIVED THREADS ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to load archived threads',
      error: err.message,
    });
  }
};

exports.restoreConversation = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const restored = await messageService.restoreConversation(
      currentUserId,
      counterpartyId
    );

    const io = req.app.get('io');

    emitThreadRestored(
      io,
      {
        thread_type: 'private',
        counterparty_id: counterpartyId,
        restored_by: currentUserId,
        restored_at: new Date().toISOString(),
      },
      [currentUserId]
    );

    await logMessageAudit({
      req,
      actionTaken: 'RESTORE_PRIVATE_CONVERSATION',
      entityType: 'conversation',
      entityId: counterpartyId,
      description: 'Restored archived private conversation.',
      metadata: {
        counterparty_id: counterpartyId,
        restored,
      },
    });

    return res.json({
      success: true,
      restored,
    });
  } catch (err) {
    console.error('RESTORE CONVERSATION ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to restore conversation',
      error: err.message,
    });
  }
};

exports.restoreRoom = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const restored = await messageService.restoreRoom(currentUserId, roomId);

    const io = req.app.get('io');

    emitThreadRestored(
      io,
      {
        thread_type: 'group',
        room_id: roomId,
        restored_by: currentUserId,
        restored_at: new Date().toISOString(),
      },
      [currentUserId]
    );

    await logMessageAudit({
      req,
      actionTaken: 'RESTORE_CHAT_ROOM_THREAD',
      entityType: 'chat_room',
      entityId: roomId,
      description: 'Restored archived group chat thread.',
      metadata: {
        room_id: roomId,
        restored,
      },
    });

    return res.json({
      success: true,
      restored,
    });
  } catch (err) {
    console.error('RESTORE ROOM ERROR:', err.message);

    return res.status(500).json({
      message: 'Failed to restore room thread',
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

    await logMessageAudit({
      req,
      actionTaken: 'MARK_CONVERSATION_READ',
      entityType: 'conversation',
      entityId: counterpartyId,
      description: 'Marked private conversation as read.',
      metadata: {
        counterparty_id: counterpartyId,
        message_ids: messageIds,
        is_read: true,
      },
    });

    return res.json({
      messageIds,
      isRead: true,
      unreadCount: 0,
    });
  } catch (err) {
    console.error('MARK CONVERSATION READ ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to mark conversation as read',
      error: err.message,
    });
  }
};

exports.markConversationUnread = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messageIds = await messageService.markConversationUnread(
      currentUserId,
      counterpartyId
    );

    const io = req.app.get('io');

    if (messageIds.length) {
      emitMessageUnread(
        io,
        {
          reader_id: currentUserId,
          counterparty_id: counterpartyId,
          room_id: null,
          message_ids: messageIds,
          is_read: false,
          updated_at: new Date().toISOString(),
        },
        uniqueIds(currentUserId, counterpartyId)
      );
    }

    await logMessageAudit({
      req,
      actionTaken: 'MARK_CONVERSATION_UNREAD',
      entityType: 'conversation',
      entityId: counterpartyId,
      description: 'Marked private conversation as unread.',
      metadata: {
        counterparty_id: counterpartyId,
        message_ids: messageIds,
        is_read: false,
      },
    });

    return res.json({
      messageIds,
      isRead: false,
      unreadCount: messageIds.length ? 1 : 0,
    });
  } catch (err) {
    console.error('MARK CONVERSATION UNREAD ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to mark conversation as unread',
      error: err.message,
    });
  }
};

exports.setConversationReadState = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;
    const isRead = req.body?.isRead === true;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messageIds = isRead
      ? await messageService.markConversationRead(currentUserId, counterpartyId)
      : await messageService.markConversationUnread(currentUserId, counterpartyId);

    const io = req.app.get('io');

    if (messageIds.length && isRead) {
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

    if (messageIds.length && !isRead) {
      emitMessageUnread(
        io,
        {
          reader_id: currentUserId,
          counterparty_id: counterpartyId,
          room_id: null,
          message_ids: messageIds,
          is_read: false,
          updated_at: new Date().toISOString(),
        },
        uniqueIds(currentUserId, counterpartyId)
      );
    }

    await logMessageAudit({
      req,
      actionTaken: isRead ? 'MARK_CONVERSATION_READ' : 'MARK_CONVERSATION_UNREAD',
      entityType: 'conversation',
      entityId: counterpartyId,
      description: isRead
        ? 'Marked private conversation as read.'
        : 'Marked private conversation as unread.',
      metadata: {
        counterparty_id: counterpartyId,
        message_ids: messageIds,
        is_read: isRead,
      },
    });

    return res.json({
      messageIds,
      isRead,
      unreadCount: isRead ? 0 : messageIds.length ? 1 : 0,
    });
  } catch (err) {
    console.error('SET CONVERSATION READ STATE ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to update conversation read state',
      error: err.message,
    });
  }
};

exports.archiveConversation = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const archive = await messageService.archiveConversation(
      currentUserId,
      counterpartyId
    );

    const io = req.app.get('io');

    emitThreadArchived(
      io,
      {
        thread_type: 'private',
        counterparty_id: counterpartyId,
        archived_by: currentUserId,
        archived_at: archive.archived_at,
      },
      [currentUserId]
    );

    await logMessageAudit({
      req,
      actionTaken: 'ARCHIVE_PRIVATE_CONVERSATION',
      entityType: 'conversation',
      entityId: counterpartyId,
      description: 'Archived private conversation.',
      metadata: {
        counterparty_id: counterpartyId,
        archive_id: archive.archive_id,
      },
    });

    return res.json({
      success: true,
      archive,
    });
  } catch (err) {
    console.error('ARCHIVE CONVERSATION ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to archive conversation',
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

    const cleanMessageBody = String(messageBody).trim();

    const message = await messageService.sendMessage({
      senderId,
      receiverId: counterpartyId,
      subject: subject || null,
      messageBody: cleanMessageBody,
      attachmentUrl: attachmentUrl || null,
    });

    const io = req.app.get('io');
    const payload = buildMessageSocketPayload(message);

    socketEvents.messageCreated(io, payload, {
      targetUserIds: uniqueIds(senderId, counterpartyId),
    });

    await logMessageAudit({
      req,
      actionTaken: 'SEND_PRIVATE_MESSAGE',
      entityType: 'message',
      entityId: message.message_id,
      description: 'Sent a private message.',
      metadata: {
        message_id: message.message_id,
        sender_id: senderId,
        receiver_id: counterpartyId,
        has_attachment: Boolean(attachmentUrl),
        message_length: cleanMessageBody.length,
      },
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

    await logMessageAudit({
      req,
      actionTaken: 'CREATE_CHAT_ROOM',
      entityType: 'chat_room',
      entityId: room.room_id,
      description: `Created chat room: ${room.room_name || 'Untitled Group'}.`,
      metadata: {
        room_id: room.room_id,
        room_name: room.room_name,
        created_by: currentUserId,
        member_count: targetUserIds.length,
        member_ids: targetUserIds,
      },
    });

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

    const cleanMessageBody = String(messageBody).trim();

    const message = await messageService.sendRoomMessage({
      senderId,
      roomId,
      subject: subject || null,
      messageBody: cleanMessageBody,
      attachmentUrl: attachmentUrl || null,
    });

    const memberIds = await getRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(memberIds, senderId);

    const io = req.app.get('io');
    const payload = buildMessageSocketPayload(message);

    socketEvents.messageCreated(io, payload, {
      targetUserIds,
    });

    await logMessageAudit({
      req,
      actionTaken: 'SEND_ROOM_MESSAGE',
      entityType: 'message',
      entityId: message.message_id,
      description: 'Sent a group chat message.',
      metadata: {
        message_id: message.message_id,
        sender_id: senderId,
        room_id: roomId,
        has_attachment: Boolean(attachmentUrl),
        message_length: cleanMessageBody.length,
      },
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

    await logMessageAudit({
      req,
      actionTaken: 'ADD_CHAT_ROOM_MEMBERS',
      entityType: 'chat_room',
      entityId: roomId,
      description: `Added ${result.added_count || 0} member(s) to a group chat.`,
      metadata: {
        room_id: roomId,
        added_count: result.added_count || 0,
        requested_member_ids: memberIds,
        inserted_members: result.members || [],
      },
    });

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

    await logMessageAudit({
      req,
      actionTaken: 'MARK_ROOM_READ',
      entityType: 'chat_room',
      entityId: roomId,
      description: 'Marked group chat as read.',
      metadata: {
        room_id: roomId,
        message_ids: messageIds,
        is_read: true,
      },
    });

    return res.json({
      messageIds,
      isRead: true,
      unreadCount: 0,
    });
  } catch (err) {
    console.error('MARK ROOM MESSAGES READ ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to mark room messages as read',
      error: err.message,
    });
  }
};

exports.markRoomMessagesUnread = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messageIds = await messageService.markRoomMessagesUnread(
      currentUserId,
      roomId
    );

    const memberIds = await getRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(memberIds, currentUserId);

    const io = req.app.get('io');

    if (messageIds.length) {
      emitMessageUnread(
        io,
        {
          reader_id: currentUserId,
          room_id: roomId,
          counterparty_id: null,
          message_ids: messageIds,
          is_read: false,
          updated_at: new Date().toISOString(),
        },
        targetUserIds
      );
    }

    await logMessageAudit({
      req,
      actionTaken: 'MARK_ROOM_UNREAD',
      entityType: 'chat_room',
      entityId: roomId,
      description: 'Marked group chat as unread.',
      metadata: {
        room_id: roomId,
        message_ids: messageIds,
        is_read: false,
      },
    });

    return res.json({
      messageIds,
      isRead: false,
      unreadCount: messageIds.length ? 1 : 0,
    });
  } catch (err) {
    console.error('MARK ROOM MESSAGES UNREAD ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to mark room messages as unread',
      error: err.message,
    });
  }
};

exports.setRoomReadState = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;
    const isRead = req.body?.isRead === true;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messageIds = isRead
      ? await messageService.markRoomMessagesRead(currentUserId, roomId)
      : await messageService.markRoomMessagesUnread(currentUserId, roomId);

    const memberIds = await getRoomMemberUserIds(roomId);
    const targetUserIds = uniqueIds(memberIds, currentUserId);

    const io = req.app.get('io');

    if (messageIds.length && isRead) {
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

    if (messageIds.length && !isRead) {
      emitMessageUnread(
        io,
        {
          reader_id: currentUserId,
          room_id: roomId,
          counterparty_id: null,
          message_ids: messageIds,
          is_read: false,
          updated_at: new Date().toISOString(),
        },
        targetUserIds
      );
    }

    await logMessageAudit({
      req,
      actionTaken: isRead ? 'MARK_ROOM_READ' : 'MARK_ROOM_UNREAD',
      entityType: 'chat_room',
      entityId: roomId,
      description: isRead
        ? 'Marked group chat as read.'
        : 'Marked group chat as unread.',
      metadata: {
        room_id: roomId,
        message_ids: messageIds,
        is_read: isRead,
      },
    });

    return res.json({
      messageIds,
      isRead,
      unreadCount: isRead ? 0 : messageIds.length ? 1 : 0,
    });
  } catch (err) {
    console.error('SET ROOM READ STATE ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to update room read state',
      error: err.message,
    });
  }
};

exports.archiveRoom = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const archive = await messageService.archiveRoom(currentUserId, roomId);
    const io = req.app.get('io');

    emitThreadArchived(
      io,
      {
        thread_type: 'group',
        room_id: roomId,
        archived_by: currentUserId,
        archived_at: archive.archived_at,
      },
      [currentUserId]
    );

    await logMessageAudit({
      req,
      actionTaken: 'ARCHIVE_CHAT_ROOM_THREAD',
      entityType: 'chat_room',
      entityId: roomId,
      description: 'Archived group chat thread.',
      metadata: {
        room_id: roomId,
        archive_id: archive.archive_id,
      },
    });

    return res.json({
      success: true,
      archive,
    });
  } catch (err) {
    console.error('ARCHIVE ROOM ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to archive room thread',
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