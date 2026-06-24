const roService = require('../services/roService');

function getRequestUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function getSafeStatusCode(error) {
  const parsed = Number.parseInt(error?.statusCode, 10);
  return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
    ? parsed
    : 500;
}

async function getMyAssignments(req, res) {
  try {
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const result = await roService.getMyAssignments(userId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('RO ASSIGNMENTS ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load RO assignments.',
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

    return res.status(200).json(result);
  } catch (error) {
    console.error('RO COMPLETION SUBMIT ERROR:', error);
    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to submit RO completion.',
    });
  }
}

module.exports = {
  getMyAssignments,
  submitMyCompletion,
};
