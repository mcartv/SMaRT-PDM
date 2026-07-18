const roService = require('../services/roService');

function getRequestUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || req.user?.sub || null;
}

function getSafeStatusCode(error) {
  const parsed = Number.parseInt(error?.statusCode, 10);

  return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
    ? parsed
    : 500;
}

function stripInternalPayload(result = {}) {
  const { realtime, ...payload } = result;
  return payload;
}

function emitRoUpdate(req, realtime) {
  if (!realtime) return;

  try {
    const io = req.app?.get?.('io');

    if (!io) return;

    const payload = {
      ...realtime,
      updated_at: new Date().toISOString(),
    };

    io.emit('ro:updated', payload);
    io.emit('roUpdated', payload);
  } catch (error) {
    console.error('RO SOCKET EMIT SKIPPED:', error.message);
  }
}

async function getMyAssignments(req, res) {
  try {
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const result = await roService.getMyAssignments(userId);

    return res.status(200).json(stripInternalPayload(result));
  } catch (error) {
    console.error('RO ASSIGNMENTS ERROR:', error);

    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load RO assignments.',
    });
  }
}

async function timeInMyRo(req, res) {
  try {
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const result = await roService.timeInMyRo(
      userId,
      req.params.roId,
      req.body || {}
    );

    emitRoUpdate(req, result.realtime);

    return res.status(201).json(stripInternalPayload(result));
  } catch (error) {
    console.error('RO TIME IN ERROR:', error);

    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to time in.',
    });
  }
}

async function timeOutMyRo(req, res) {
  try {
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const result = await roService.timeOutMyRo(
      userId,
      req.params.roId,
      req.body || {}
    );

    emitRoUpdate(req, result.realtime);

    return res.status(200).json(stripInternalPayload(result));
  } catch (error) {
    console.error('RO TIME OUT ERROR:', error);

    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to time out.',
    });
  }
}

async function submitMyCompletion(req, res) {
  try {
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const result = await roService.submitMyCompletion(
      userId,
      req.params.roId,
      req.body || {},
      req.file || null
    );

    emitRoUpdate(req, result.realtime);

    return res.status(200).json(stripInternalPayload(result));
  } catch (error) {
    console.error('RO COMPLETION SUBMIT ERROR:', error);

    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to submit RO completion.',
    });
  }
}

module.exports = {
  getMyAssignments,
  timeInMyRo,
  timeOutMyRo,
  submitMyCompletion,
};