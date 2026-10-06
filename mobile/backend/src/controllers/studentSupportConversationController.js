// SMaRT-PDM: student Support Conversation Controller — student Support Conversation Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
'use strict';

const supportConversationService = require('../services/studentSupportConversationService');
const { getSafeStatusCode } = require('../utils/httpStatus');

// currentUserId: handles current user id for the student Support Conversation Controller flow.
function currentUserId(req) {
  return req.user?.userId || req.user?.user_id || req.user?.id || null;
}

exports.list = async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });
    const items = await supportConversationService.listSupportConversations(userId);
    return res.status(200).json({ items });
  } catch (error) {
    console.error('LIST STUDENT SUPPORT CONVERSATIONS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load conversations.',
    });
  }
};

exports.listArchived = async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });
    const items = await supportConversationService.listArchivedSupportConversations(userId);
    return res.status(200).json({ items });
  } catch (error) {
    console.error('LIST ARCHIVED STUDENT SUPPORT CONVERSATIONS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load archived conversations.',
    });
  }
};

exports.resolve = async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });
    const conversation = await supportConversationService.resolveSupportConversation(
      userId,
      req.query.referenceId ?? req.query.reference_id
    );
    return res.status(200).json({ conversation });
  } catch (error) {
    console.error('RESOLVE STUDENT SUPPORT CONVERSATION ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to resolve conversation.',
    });
  }
};

exports.archive = async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });
    const payload = await supportConversationService.archiveSupportConversation(
      userId,
      req.params.counterpartyId
    );
    return res.status(200).json(payload);
  } catch (error) {
    console.error('ARCHIVE STUDENT SUPPORT CONVERSATION ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to archive conversation.',
    });
  }
};

exports.restore = async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });
    const payload = await supportConversationService.restoreSupportConversation(
      userId,
      req.params.counterpartyId
    );
    return res.status(200).json(payload);
  } catch (error) {
    console.error('RESTORE STUDENT SUPPORT CONVERSATION ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to restore conversation.',
    });
  }
};
