const personalToolService = require('../services/personalToolService');
const socketEvents = require('../utils/socketEvents');

function getActorUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.sub || null;
}

function getSafeStatusCode(error) {
  const parsed = Number.parseInt(error?.statusCode, 10);
  return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599 ? parsed : 500;
}

function sendError(res, error, fallbackMessage) {
  return res.status(getSafeStatusCode(error)).json({
    message: error.message || fallbackMessage,
  });
}

function emitWorkspace(req, userId, action, workspace) {
  socketEvents.personalToolsUpdated(req.app.get('io'), userId, {
    action,
    workspace,
  });
}

async function getWorkspace(req, res) {
  try {
    const workspace = await personalToolService.getWorkspace(getActorUserId(req));
    return res.status(200).json(workspace);
  } catch (error) {
    console.error('GET PERSONAL TOOLS ERROR:', error);
    return sendError(res, error, 'Failed to load your notes and reminders.');
  }
}

async function updateNote(req, res) {
  try {
    const userId = getActorUserId(req);
    const workspace = await personalToolService.updateNote(userId, req.body?.note);
    emitWorkspace(req, userId, 'note_updated', workspace);
    return res.status(200).json(workspace);
  } catch (error) {
    console.error('UPDATE PERSONAL NOTE ERROR:', error);
    return sendError(res, error, 'Failed to save your note.');
  }
}

async function addEvent(req, res) {
  try {
    const userId = getActorUserId(req);
    const workspace = await personalToolService.addEvent(userId, req.body || {});
    emitWorkspace(req, userId, 'event_added', workspace);
    return res.status(201).json(workspace);
  } catch (error) {
    console.error('ADD PERSONAL REMINDER ERROR:', error);
    return sendError(res, error, 'Failed to add your reminder.');
  }
}

async function deleteEvent(req, res) {
  try {
    const userId = getActorUserId(req);
    const workspace = await personalToolService.deleteEvent(userId, req.params.eventId);
    emitWorkspace(req, userId, 'event_deleted', workspace);
    return res.status(200).json(workspace);
  } catch (error) {
    console.error('DELETE PERSONAL REMINDER ERROR:', error);
    return sendError(res, error, 'Failed to remove your reminder.');
  }
}

module.exports = {
  getWorkspace,
  updateNote,
  addEvent,
  deleteEvent,
};
