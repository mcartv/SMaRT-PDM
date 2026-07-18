const roService = require('../services/roService');

function getUserId(req) {
  return (
    req.user?.userId ||
    req.user?.user_id ||
    req.user?.id ||
    null
  );
}

function getSafeStatusCode(error) {
  const statusCode = Number(error?.statusCode || error?.status || 500);

  if (statusCode < 400 || statusCode > 599) {
    return 500;
  }

  return statusCode;
}

function emitRoUpdate(req, action, payload = {}) {
  const io = req.app.get('io');

  if (!io) return;

  const data = {
    action,
    updated_at: new Date().toISOString(),
    ...payload,
  };

  io.emit('ro:updated', data);
  io.emit('roUpdated', data);
}

exports.getMyAssignments = async (req, res) => {
  try {
    const data = await roService.getMyAssignments(getUserId(req));

    return res.status(200).json(data);
  } catch (err) {
    console.error('GET MY RO ERROR:', err);

    return res.status(getSafeStatusCode(err)).json({
      error: err.message || 'Failed to load RO assignments.',
    });
  }
};

exports.acknowledgeMyRo = async (req, res) => {
  try {
    const data = await roService.acknowledgeMyRo(
      getUserId(req),
      req.params.roId
    );

    emitRoUpdate(req, 'acknowledge', {
      roId: req.params.roId,
      ro_id: req.params.roId,
      studentId: data?.student?.student_id || null,
      student_id: data?.student?.student_id || null,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('ACKNOWLEDGE RO ERROR:', err);

    return res.status(getSafeStatusCode(err)).json({
      error: err.message || 'Failed to acknowledge RO assignment.',
    });
  }
};

exports.reportMyRoConflict = async (req, res) => {
  try {
    const data = await roService.reportMyRoConflict(
      getUserId(req),
      req.params.roId,
      req.body || {}
    );

    emitRoUpdate(req, 'conflict', {
      roId: req.params.roId,
      ro_id: req.params.roId,
      studentId: data?.student?.student_id || null,
      student_id: data?.student?.student_id || null,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('REPORT RO CONFLICT ERROR:', err);

    return res.status(getSafeStatusCode(err)).json({
      error: err.message || 'Failed to report RO concern.',
    });
  }
};

exports.timeInMyRo = async (req, res) => {
  try {
    const data = await roService.timeInMyRo(
      getUserId(req),
      req.params.roId,
      req.body || {}
    );

    emitRoUpdate(req, 'time-in', data.realtime || {
      roId: req.params.roId,
      ro_id: req.params.roId,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('TIME IN RO ERROR:', err);

    return res.status(getSafeStatusCode(err)).json({
      error: err.message || 'Failed to time in.',
    });
  }
};

exports.timeOutMyRo = async (req, res) => {
  try {
    const data = await roService.timeOutMyRo(
      getUserId(req),
      req.params.roId,
      req.body || {}
    );

    emitRoUpdate(req, 'time-out', data.realtime || {
      roId: req.params.roId,
      ro_id: req.params.roId,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('TIME OUT RO ERROR:', err);

    return res.status(getSafeStatusCode(err)).json({
      error: err.message || 'Failed to time out.',
    });
  }
};

exports.submitMyCompletion = async (req, res) => {
  try {
    const data = await roService.submitMyCompletion(
      getUserId(req),
      req.params.roId,
      req.body || {},
      req.file || null
    );

    emitRoUpdate(req, 'submit-progress', data.realtime || {
      roId: req.params.roId,
      ro_id: req.params.roId,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('SUBMIT RO ERROR:', err);

    return res.status(getSafeStatusCode(err)).json({
      error: err.message || 'Failed to submit RO progress.',
    });
  }
};