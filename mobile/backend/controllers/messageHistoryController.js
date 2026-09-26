'use strict';

const messageHistoryService = require('../services/messageHistoryService');
const { getSafeStatusCode } = require('../utils/httpStatus');

function getCurrentUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

function readWindowOptions(req) {
  return {
    limit: req.query?.limit,
    beforeSentAt:
      req.query?.beforeSentAt ?? req.query?.before_sent_at ?? null,
    beforeMessageId:
      req.query?.beforeMessageId ?? req.query?.before_message_id ?? null,
    counterpartyId:
      req.query?.counterpartyId ?? req.query?.counterparty_id ?? null,
  };
}

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
