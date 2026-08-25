const roService = require('../services/roService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getRequestUserId(req) {
  return req.user?.user_id || req.user?.userId || req.user?.id || req.user?.sub || null;
}

function getSafeStatusCode(error) {
  const parsed = Number.parseInt(error?.statusCode, 10);

  return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
    ? parsed
    : 500;
}

function emitRoUpdated(req, action, payload = {}) {
  try {
    const io = req.app?.get?.('io');
    if (!io) return;

    const data = {
      source: 'ro-admin',
      action,
      updated_at: new Date().toISOString(),
      ...payload,
    };

    if (typeof socketEvents?.roUpdated === 'function') {
      socketEvents.roUpdated(io, data);
    } else if (typeof socketEvents?.emitEvent === 'function') {
      socketEvents.emitEvent(io, 'ro:updated', data);
      socketEvents.emitEvent(io, 'roUpdated', data);
    } else {
      io.emit('ro:updated', data);
      io.emit('roUpdated', data);
    }

    io.emit('ro:updated', data);
    io.emit('roUpdated', data);

    if (action === 'validate-log') {
      io.emit('ro:time-log-updated', data);
    }

    if (action === 'review-proof') {
      io.emit('ro:proof-updated', data);
    }

    if (
      action === 'assign' ||
      action === 'batch-assign' ||
      action === 'clear'
    ) {
      io.emit('ro:assignment-updated', data);
    }
  } catch (error) {
    console.error('RO REALTIME EMIT ERROR:', error.message);
  }
}

function writeAudit(req, actionTaken, entityId, description, metadata = {}) {
  try {
    if (typeof auditLogService?.logAudit !== 'function') return;

    auditLogService
      .logAudit({
        req,
        userId: getRequestUserId(req),
        actionTaken,
        module: 'Return of Obligation',
        entityType: 'return_of_obligation',
        entityId: entityId ? String(entityId) : null,
        description,
        metadata,
      })
      .catch((error) => {
        console.error('RO AUDIT LOG ERROR:', error.message);
      });
  } catch (error) {
    console.error('RO AUDIT WRAPPER ERROR:', error.message);
  }
}

exports.getSummary = async (req, res) => {
  try {
    const data = await roService.getSummary();
    return res.status(200).json(data);
  } catch (err) {
    console.error('GET RO SUMMARY ERROR:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

exports.getROScholars = async (req, res) => {
  try {
    const data = await roService.getROScholars(req.query);
    return res.status(200).json({ scholars: data });
  } catch (err) {
    console.error('GET RO SCHOLARS ERROR:', err.message);
    return res.status(getSafeStatusCode(err)).json({ error: err.message });
  }
};

exports.assignScholarRO = async (req, res) => {
  try {
    const data = await roService.assignScholarRO(
      req.params.studentId,
      req.body || {},
      req.user || {}
    );

    emitRoUpdated(req, 'assign', {
      student_id: req.params.studentId,
      ro_id: data?.assignment?.ro_id || null,
      data,
    });

    writeAudit(
      req,
      'ASSIGN_RO',
      data?.assignment?.ro_id || req.params.studentId,
      'Assigned Return of Obligation to scholar.',
      {
        student_id: req.params.studentId,
        body_keys: Object.keys(req.body || {}),
      }
    );

    return res.status(200).json(data);
  } catch (err) {
    console.error('ASSIGN SCHOLAR RO ERROR:', err.message);
    return res.status(getSafeStatusCode(err)).json({ error: err.message });
  }
};

exports.batchAssignScholarsRO = async (req, res) => {
  try {
    const data = await roService.batchAssignScholarsRO(
      req.body || {},
      req.user || {}
    );

    emitRoUpdated(req, 'batch-assign', {
      total: data.total,
      success_count: data.success_count,
      failed_count: data.failed_count,
      data,
    });

    writeAudit(
      req,
      'BATCH_ASSIGN_RO',
      null,
      'Batch assigned Return of Obligation notices to scholars.',
      {
        total: data.total,
        success_count: data.success_count,
        failed_count: data.failed_count,
        selected_student_ids: req.body?.studentIds || req.body?.student_ids || [],
      }
    );

    return res.status(200).json(data);
  } catch (err) {
    console.error('BATCH ASSIGN RO ERROR:', err.message);
    return res.status(getSafeStatusCode(err)).json({ error: err.message });
  }
};

exports.validateTimeLog = async (req, res) => {
  try {
    const data = await roService.validateTimeLog(
      req.params.logId,
      req.body || {},
      req.user || {}
    );

    emitRoUpdated(req, 'validate-log', {
      log_id: req.params.logId,
      ro_id: data?.log?.ro_id || null,
      student_id: data?.log?.student_id || null,
      validation_status: data?.log?.validation_status || null,
      validated_minutes: data?.log?.validated_minutes || 0,
      data,
    });

    writeAudit(
      req,
      'VALIDATE_RO_TIME_LOG',
      req.params.logId,
      'Validated Return of Obligation time log.',
      {
        log_id: req.params.logId,
        validation_status: req.body?.validationStatus || req.body?.validation_status,
        validated_minutes: req.body?.validatedMinutes || req.body?.validated_minutes,
      }
    );

    return res.status(200).json(data);
  } catch (err) {
    console.error('VALIDATE RO TIME LOG ERROR:', err.message);
    return res.status(getSafeStatusCode(err)).json({ error: err.message });
  }
};

exports.reviewTimeLogProof = async (req, res) => {
  try {
    const data = await roService.reviewTimeLogProof(
      req.params.proofId,
      req.body || {},
      req.user || {}
    );

    emitRoUpdated(req, 'review-proof', {
      proof_id: req.params.proofId,
      log_id: data?.proof?.log_id || null,
      ro_id: data?.proof?.ro_id || null,
      student_id: data?.proof?.student_id || null,
      proof_status: data?.proof?.proof_status || null,
      data,
    });

    writeAudit(
      req,
      'REVIEW_RO_TIME_LOG_PROOF',
      req.params.proofId,
      'Reviewed Return of Obligation photo proof.',
      {
        proof_id: req.params.proofId,
        proof_status: req.body?.proofStatus || req.body?.proof_status,
      }
    );

    return res.status(200).json(data);
  } catch (err) {
    console.error('REVIEW RO TIME LOG PROOF ERROR:', err.message);
    return res.status(getSafeStatusCode(err)).json({ error: err.message });
  }
};

exports.clearScholarRO = async (req, res) => {
  try {
    const data = await roService.clearScholarRO(
      req.params.studentId,
      req.body || {},
      req.user || {}
    );

    emitRoUpdated(req, 'clear', {
      student_id: req.params.studentId,
      application_id: req.body?.applicationId || null,
      opening_id: req.body?.openingId || null,
      ro_id: data?.clearance?.ro_id || null,
      data,
    });

    writeAudit(
      req,
      'CLEAR_RO',
      data?.clearance?.ro_id || req.params.studentId,
      'Marked scholar Return of Obligation as cleared.',
      {
        student_id: req.params.studentId,
        application_id: req.body?.applicationId || null,
        opening_id: req.body?.openingId || null,
      }
    );

    return res.status(200).json(data);
  } catch (err) {
    console.error('CLEAR STUDENT RO ERROR:', err.message);
    return res.status(getSafeStatusCode(err)).json({ error: err.message });
  }
};