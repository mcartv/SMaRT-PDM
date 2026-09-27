'use strict';

const messageHistoryService = require('../services/messageHistoryService');
const messageService = require('../services/messageService');
const { getSafeStatusCode } = require('../utils/httpStatus');

function getCurrentUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function getMessageBody(req) {
  return req.body?.messageBody ?? req.body?.message_body ?? req.body?.message ?? '';
}

function readWindowOptions(req) {
  return {
    limit: req.query?.limit,
    beforeSentAt: req.query?.beforeSentAt ?? req.query?.before_sent_at ?? null,
    beforeMessageId:
      req.query?.beforeMessageId ?? req.query?.before_message_id ?? null,
    counterpartyId:
      req.query?.counterpartyId ?? req.query?.counterparty_id ?? null,
  };
}

exports.getUnreadCount = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const unreadCount = await messageHistoryService.getMobileUnreadCount(
      currentUserId
    );
    return res.status(200).json({ unreadCount });
  } catch (error) {
    console.error('GET MOBILE MESSAGE UNREAD COUNT ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load unread message count.',
    });
  }
};


exports.getArchivedThreads = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const items = await messageService.fetchArchivedThreads(currentUserId);
    return res.status(200).json({ items, archived: items });
  } catch (error) {
    console.error('GET MOBILE ARCHIVED MESSAGES ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load archived conversations.',
    });
  }
};


exports.getPrivateWindow = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const payload = await messageHistoryService.fetchPrivateWindow(
      currentUserId,
      readWindowOptions(req)
    );
    return res.status(200).json(payload);
  } catch (error) {
    console.error('GET MOBILE MESSAGE HISTORY WINDOW ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load messages.',
    });
  }
};

exports.getFixedThread = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const payload = await messageHistoryService.fetchPrivateWindow(
      currentUserId,
      {
        limit: 50,
        counterpartyId:
          req.query?.counterpartyId ?? req.query?.counterparty_id ?? null,
      }
    );
    return res.status(200).json(payload);
  } catch (error) {
    console.error('GET MOBILE FIXED MESSAGE THREAD ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load messages.',
    });
  }
};

exports.sendFixedThreadMessage = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    const messageBody = String(getMessageBody(req) || '').trim();

    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!messageBody) {
      return res.status(400).json({ error: 'Message body is required.' });
    }

    const supportCounterpartyId = await messageHistoryService.resolveSupportCounterpartyId(
      currentUserId,
      req.body?.counterpartyId ?? req.body?.counterparty_id ?? null
    );
    const payload = await messageService.sendToFixedThread(
      currentUserId,
      messageBody,
      supportCounterpartyId
    );
    return res.status(201).json(payload);
  } catch (error) {
    console.error('SEND MOBILE FIXED MESSAGE ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to send message.',
    });
  }
};

exports.markFixedThreadRead = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const supportCounterpartyId = await messageHistoryService.resolveSupportCounterpartyId(
      currentUserId,
      req.body?.counterpartyId ??
        req.body?.counterparty_id ??
        req.query?.counterpartyId ??
        req.query?.counterparty_id ??
        null
    );
    const payload = await messageService.markFixedThreadRead(
      currentUserId,
      supportCounterpartyId
    );

    // Keep the canonical per-user read-state table aligned with the legacy
    // messages.is_read flag. This also repairs rows created before this fix,
    // preventing an opened conversation from reappearing as unread.
    const synchronized = await messageHistoryService.syncPrivateReadState(
      currentUserId,
      supportCounterpartyId
    );

    const messageIds = Array.from(
      new Set([
        ...(payload.messageIds || payload.message_ids || []),
        ...synchronized.messageIds,
      ])
    );

    return res.status(200).json({
      ...payload,
      updatedCount: messageIds.length,
      updated_count: messageIds.length,
      messageIds,
      message_ids: messageIds,
    });
  } catch (error) {
    console.error('MARK MOBILE FIXED MESSAGE THREAD READ ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to mark messages as read.',
    });
  }
};

exports.getRoomWindow = async (req, res) => {
  try {
    const currentUserId = getCurrentUserId(req);
    if (!currentUserId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const payload = await messageHistoryService.fetchRoomWindow(
      currentUserId,
      req.params.roomId,
      readWindowOptions(req)
    );
    return res.status(200).json(payload);
  } catch (error) {
    console.error('GET MOBILE ROOM HISTORY WINDOW ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load room messages.',
    });
  }
};
