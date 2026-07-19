const roService = require('../services/roService');
const adminRealtimeRelayService = require('../services/adminRealtimeRelayService');

function getUserId(req) {
  return (
    req.user?.userId ||
    req.user?.user_id ||
    req.user?.id ||
    req.user?.sub ||
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

function emitLocalRoUpdate(req, action, payload = {}) {
  const io = req.app?.get?.('io');

  if (!io) return;

  const data = {
    source: 'mobile',
    action,
    updated_at: new Date().toISOString(),
    ...payload,
  };

  io.emit('ro:updated', data);
  io.emit('roUpdated', data);

  if (
    action === 'acknowledge' ||
    action === 'conflict' ||
    action === 'assign' ||
    action === 'clear'
  ) {
    io.emit('ro:assignment-updated', data);
  }

  if (
    action === 'time-in' ||
    action === 'time-out' ||
    action === 'auto-time-out' ||
    action === 'submit-progress'
  ) {
    io.emit('ro:time-log-updated', data);
  }

  if (action === 'upload-proof') {
    io.emit('ro:proof-updated', data);
  }
}

function relayAdminRoUpdate(action, payload = {}) {
  adminRealtimeRelayService
    .relayRoUpdated({
      action,
      ...payload,
    })
    .catch((error) => {
      console.error('[RO Admin Realtime Relay] async error:', error.message);
    });
}

function emitAndRelayRoUpdate(req, action, payload = {}) {
  const data = {
    action,
    updated_at: new Date().toISOString(),
    ...payload,
  };

  emitLocalRoUpdate(req, action, data);
  relayAdminRoUpdate(action, data);
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

    emitAndRelayRoUpdate(req, 'acknowledge', {
      roId: req.params.roId,
      ro_id: req.params.roId,

      studentId: data?.student?.student_id || data?.assignment?.student_id || null,
      student_id: data?.student?.student_id || data?.assignment?.student_id || null,

      assignment_status:
        data?.assignment?.assignment_status ||
        data?.ro?.assignment_status ||
        'Acknowledged',
      assignmentStatus:
        data?.assignment?.assignment_status ||
        data?.ro?.assignment_status ||
        'Acknowledged',

      progress_status:
        data?.assignment?.progress_status ||
        data?.ro?.progress_status ||
        null,
      progressStatus:
        data?.assignment?.progress_status ||
        data?.ro?.progress_status ||
        null,

      ro_status:
        data?.assignment?.ro_status ||
        data?.ro?.ro_status ||
        null,
      roStatus:
        data?.assignment?.ro_status ||
        data?.ro?.ro_status ||
        null,

      data,
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

    emitAndRelayRoUpdate(req, 'conflict', {
      roId: req.params.roId,
      ro_id: req.params.roId,

      studentId: data?.student?.student_id || data?.assignment?.student_id || null,
      student_id: data?.student?.student_id || data?.assignment?.student_id || null,

      assignment_status:
        data?.assignment?.assignment_status ||
        data?.ro?.assignment_status ||
        'Conflict Reported',
      assignmentStatus:
        data?.assignment?.assignment_status ||
        data?.ro?.assignment_status ||
        'Conflict Reported',

      progress_status:
        data?.assignment?.progress_status ||
        data?.ro?.progress_status ||
        null,
      progressStatus:
        data?.assignment?.progress_status ||
        data?.ro?.progress_status ||
        null,

      ro_status:
        data?.assignment?.ro_status ||
        data?.ro?.ro_status ||
        null,
      roStatus:
        data?.assignment?.ro_status ||
        data?.ro?.ro_status ||
        null,

      data,
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
      req.body || {},
      req.file || null
    );

    emitAndRelayRoUpdate(req, 'time-in', {
      roId: req.params.roId,
      ro_id: req.params.roId,

      studentId:
        data?.realtime?.student_id ||
        data?.realtime?.studentId ||
        data?.log?.student_id ||
        null,
      student_id:
        data?.realtime?.student_id ||
        data?.realtime?.studentId ||
        data?.log?.student_id ||
        null,

      logId: data?.log?.log_id || data?.logId || null,
      log_id: data?.log?.log_id || data?.logId || null,

      assignment_status:
        data?.ro?.assignment_status ||
        data?.assignment?.assignment_status ||
        'In Progress',
      assignmentStatus:
        data?.ro?.assignment_status ||
        data?.assignment?.assignment_status ||
        'In Progress',

      progress_status:
        data?.ro?.progress_status ||
        data?.assignment?.progress_status ||
        'In Progress',
      progressStatus:
        data?.ro?.progress_status ||
        data?.assignment?.progress_status ||
        'In Progress',

      ro_status:
        data?.ro?.ro_status ||
        data?.assignment?.ro_status ||
        null,
      roStatus:
        data?.ro?.ro_status ||
        data?.assignment?.ro_status ||
        null,

      ...(data.realtime || {}),
      data,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('MOBILE RO TIME IN ERROR:', err.message);

    return res.status(getSafeStatusCode(err)).json({
      message: err.message || 'Failed to time in.',
      error: err.message,
    });
  }
};

exports.timeOutMyRo = async (req, res) => {
  try {
    const data = await roService.timeOutMyRo(
      getUserId(req),
      req.params.roId,
      req.body || {},
      req.file || null
    );

    const action =
      data?.log?.auto_timed_out === true ||
        data?.log?.autoTimedOut === true ||
        data?.auto_timed_out === true
        ? 'auto-time-out'
        : 'time-out';

    emitAndRelayRoUpdate(req, action, {
      roId: req.params.roId,
      ro_id: req.params.roId,

      studentId:
        data?.realtime?.student_id ||
        data?.realtime?.studentId ||
        data?.log?.student_id ||
        null,
      student_id:
        data?.realtime?.student_id ||
        data?.realtime?.studentId ||
        data?.log?.student_id ||
        null,

      logId: data?.log?.log_id || data?.logId || null,
      log_id: data?.log?.log_id || data?.logId || null,

      assignment_status:
        data?.ro?.assignment_status ||
        data?.assignment?.assignment_status ||
        'For Validation',
      assignmentStatus:
        data?.ro?.assignment_status ||
        data?.assignment?.assignment_status ||
        'For Validation',

      progress_status:
        data?.ro?.progress_status ||
        data?.assignment?.progress_status ||
        'For Validation',
      progressStatus:
        data?.ro?.progress_status ||
        data?.assignment?.progress_status ||
        'For Validation',

      ro_status:
        data?.ro?.ro_status ||
        data?.assignment?.ro_status ||
        null,
      roStatus:
        data?.ro?.ro_status ||
        data?.assignment?.ro_status ||
        null,

      ...(data.realtime || {}),
      data,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('MOBILE RO TIME OUT ERROR:', err.message);

    return res.status(getSafeStatusCode(err)).json({
      message: err.message || 'Failed to time out.',
      error: err.message,
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

    emitAndRelayRoUpdate(req, 'submit-progress', {
      roId: req.params.roId,
      ro_id: req.params.roId,

      studentId:
        data?.realtime?.student_id ||
        data?.realtime?.studentId ||
        data?.student?.student_id ||
        null,
      student_id:
        data?.realtime?.student_id ||
        data?.realtime?.studentId ||
        data?.student?.student_id ||
        null,

      assignment_status:
        data?.ro?.assignment_status ||
        data?.assignment?.assignment_status ||
        'For Validation',
      assignmentStatus:
        data?.ro?.assignment_status ||
        data?.assignment?.assignment_status ||
        'For Validation',

      progress_status:
        data?.ro?.progress_status ||
        data?.assignment?.progress_status ||
        'For Validation',
      progressStatus:
        data?.ro?.progress_status ||
        data?.assignment?.progress_status ||
        'For Validation',

      ...(data.realtime || {}),
      data,
    });

    return res.status(200).json(data);
  } catch (err) {
    console.error('SUBMIT RO ERROR:', err);

    return res.status(getSafeStatusCode(err)).json({
      error: err.message || 'Failed to submit RO progress.',
    });
  }
};