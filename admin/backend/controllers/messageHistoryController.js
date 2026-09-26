'use strict';

const messageController = require('./messageController');
const messageService = require('../services/messageService');
const messageHistoryService = require('../services/messageHistoryService');

function getCurrentUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function getStatusCode(error) {
  const parsed = Number(error?.statusCode || error?.status || 500);
  return Number.isFinite(parsed) && parsed >= 400 && parsed <= 599 ? parsed : 500;
}

function wantsWindow(req) {
  return String(req.query?.view || '').trim().toLowerCase() === 'window';
}

exports.getConversationMessages = async (req, res) => {
  if (!wantsWindow(req)) {
    return messageController.getConversationMessages(req, res);
  }

  try {
    const currentUserId = getCurrentUserId(req);
    const { counterpartyId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const [window, counterparty] = await Promise.all([
      messageHistoryService.fetchPrivateWindow(currentUserId, counterpartyId, {
        limit: req.query?.limit,
        before: req.query?.before,
      }),
      messageService.fetchUserSummary(counterpartyId),
    ]);

    return res.json({
      counterpartyId,
      counterparty_id: counterpartyId,
      counterparty: counterparty
        ? {
            user_id: counterparty.user_id,
            name: counterparty.display_name || 'Unknown User',
            is_disabled: counterparty.is_disabled === true,
          }
        : null,
      items: window.items,
      messages: window.items,
      pagination: window.pagination,
      hasMore: window.pagination.hasMore,
      has_more: window.pagination.hasMore,
      nextCursor: window.pagination.nextCursor,
      next_cursor: window.pagination.nextCursor,
    });
  } catch (error) {
    console.error('GET CONVERSATION MESSAGE WINDOW ERROR:', error.message);
    return res.status(getStatusCode(error)).json({
      message: 'Failed to load messages',
      error: error.message,
    });
  }
};

exports.getRoomMessages = async (req, res) => {
  if (!wantsWindow(req)) {
    return messageController.getRoomMessages(req, res);
  }

  try {
    const currentUserId = getCurrentUserId(req);
    const { roomId } = req.params;

    if (!currentUserId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // The paginated history service performs a lightweight membership check.
    // Member profiles are intentionally not bundled with every message batch;
    // Group Info uses the dedicated /rooms/:roomId/members endpoint instead.
    const window = await messageHistoryService.fetchRoomWindow(currentUserId, roomId, {
      limit: req.query?.limit,
      before: req.query?.before,
    });

    return res.json({
      roomId,
      room_id: roomId,
      items: window.items,
      messages: window.items,
      pagination: window.pagination,
      hasMore: window.pagination.hasMore,
      has_more: window.pagination.hasMore,
      nextCursor: window.pagination.nextCursor,
      next_cursor: window.pagination.nextCursor,
    });
  } catch (error) {
    console.error('GET ROOM MESSAGE WINDOW ERROR:', error.message);
    return res.status(getStatusCode(error)).json({
      message: 'Failed to load room messages',
      error: error.message,
    });
  }
};
