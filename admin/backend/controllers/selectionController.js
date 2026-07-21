const selectionService = require('../services/selectionService');
const socketEvents = require('../utils/socketEvents');

function emit(req, eventName, payload) {
  const io = req.app.get('io');
  if (!io) return;
  io.emit(eventName, payload);
  if (socketEvents?.applicationUpdated) {
    socketEvents.applicationUpdated(io, payload);
  }
}

exports.getPreview = async (req, res) => {
  try {
    const result = await selectionService.getSelectionPreview(req.params.openingId);
    res.status(200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      code: error.code || null,
      message: error.message || 'Failed to load final selection preview.',
    });
  }
};

exports.finalize = async (req, res) => {
  try {
    const result = await selectionService.finalizeSelection(
      req.params.openingId,
      req.user,
      req.body?.notes
    );
    emit(req, 'selection:finalized', {
      opening_id: req.params.openingId,
      selected_count: result.summary?.selected_count ?? result.batch?.selected_count ?? 0,
      waitlisted_count: result.summary?.waitlisted_count ?? result.batch?.waitlisted_count ?? 0,
      updated_at: new Date().toISOString(),
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      code: error.code || null,
      message: error.message || 'Failed to finalize applicant selection.',
    });
  }
};

exports.markQualified = async (req, res) => {
  try {
    const result = await selectionService.markApplicationQualified(
      req.params.applicationId,
      req.user
    );
    emit(req, 'selection:queue-updated', {
      application_id: req.params.applicationId,
      opening_id: result.application?.opening_id || null,
      queue_position: result.queue_position,
      updated_at: new Date().toISOString(),
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      code: error.code || null,
      message: error.message || 'Failed to mark applicant as qualified.',
    });
  }
};

exports.promote = async (req, res) => {
  try {
    const result = await selectionService.promoteNextWaitlisted({
      openingId: req.params.openingId,
      actor: req.user,
      reason: req.body?.reason || 'A scholarship slot became available.',
    });
    emit(req, 'selection:waitlist-promoted', {
      opening_id: req.params.openingId,
      ...result,
      updated_at: new Date().toISOString(),
    });
    res.status(200).json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({
      code: error.code || null,
      message: error.message || 'Failed to promote the next waiting applicant.',
    });
  }
};
