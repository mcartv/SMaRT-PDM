const roService = require('../services/roService');

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
  const statusCode = Number(
    error?.statusCode ||
    error?.status ||
    500
  );

  if (
    !Number.isInteger(statusCode) ||
    statusCode < 400 ||
    statusCode > 599
  ) {
    return 500;
  }

  return statusCode;
}

function buildErrorResponse(error, fallbackMessage) {
  const message =
    error?.message ||
    fallbackMessage;

  return {
    message,
    error: message,
  };
}

function emitRoUpdate(req, action, payload = {}) {
  try {
    const io = req.app?.get?.('io');

    if (!io) {
      return;
    }

    const data = {
      source: 'mobile',
      action,
      updated_at: new Date().toISOString(),
      ...payload,
    };

    /*
     * Emit both event names because the existing admin/frontend code may
     * listen to either one.
     */
    io.emit('ro:updated', data);
    io.emit('roUpdated', data);

    if (
      action === 'time-in' ||
      action === 'time-out'
    ) {
      io.emit('ro:time-log-updated', data);
    }

    if (
      action === 'acknowledge' ||
      action === 'conflict' ||
      action === 'submit-progress'
    ) {
      io.emit('ro:assignment-updated', data);
    }
  } catch (error) {
    console.error(
      'MOBILE RO REALTIME EMIT ERROR:',
      error.message
    );
  }
}

exports.getMyAssignments = async (req, res) => {
  try {
    const data = await roService.getMyAssignments(
      getUserId(req)
    );

    return res.status(200).json(data);
  } catch (error) {
    console.error('GET MY RO ERROR:', error);

    return res
      .status(getSafeStatusCode(error))
      .json(
        buildErrorResponse(
          error,
          'Failed to load RO assignments.'
        )
      );
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

      studentId:
        data?.student?.student_id ||
        data?.realtime?.student_id ||
        null,

      student_id:
        data?.student?.student_id ||
        data?.realtime?.student_id ||
        null,

      data,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error(
      'ACKNOWLEDGE RO ERROR:',
      error
    );

    return res
      .status(getSafeStatusCode(error))
      .json(
        buildErrorResponse(
          error,
          'Failed to acknowledge RO assignment.'
        )
      );
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

      studentId:
        data?.student?.student_id ||
        data?.realtime?.student_id ||
        null,

      student_id:
        data?.student?.student_id ||
        data?.realtime?.student_id ||
        null,

      data,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error(
      'REPORT RO CONFLICT ERROR:',
      error
    );

    return res
      .status(getSafeStatusCode(error))
      .json(
        buildErrorResponse(
          error,
          'Failed to report RO concern.'
        )
      );
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

    emitRoUpdate(req, 'time-in', {
      roId: req.params.roId,
      ro_id: req.params.roId,
      ...(data.realtime || {}),
      data,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error(
      'MOBILE RO TIME IN ERROR:',
      error
    );

    return res
      .status(getSafeStatusCode(error))
      .json(
        buildErrorResponse(
          error,
          'Failed to time in.'
        )
      );
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

    emitRoUpdate(req, 'time-out', {
      roId: req.params.roId,
      ro_id: req.params.roId,
      ...(data.realtime || {}),
      data,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error(
      'MOBILE RO TIME OUT ERROR:',
      error
    );

    return res
      .status(getSafeStatusCode(error))
      .json(
        buildErrorResponse(
          error,
          'Failed to time out.'
        )
      );
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

    emitRoUpdate(req, 'submit-progress', {
      roId: req.params.roId,
      ro_id: req.params.roId,
      ...(data.realtime || {}),
      data,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error(
      'SUBMIT RO ERROR:',
      error
    );

    return res
      .status(getSafeStatusCode(error))
      .json(
        buildErrorResponse(
          error,
          'Failed to submit RO progress.'
        )
      );
  }
};