const payoutService = require('../services/payoutService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function getActorLabel(req) {
    return (
        req.user?.email ||
        req.user?.username ||
        req.user?.role ||
        getActorUserId(req) ||
        'Unknown user'
    );
}

function getBatchId(batch) {
    return (
        batch?.payout_batch_id ||
        batch?.batch?.payout_batch_id ||
        batch?.data?.payout_batch_id ||
        batch?.id ||
        null
    );
}

function normalizeBatchPayload(row = {}, action = 'updated') {
    const batch = row?.batch || row?.data || row || {};

    return {
        module: 'payout_management',
        action,
        payout_batch_id: getBatchId(row),
        batch_id: getBatchId(row),
        opening_id: batch.opening_id || row.opening_id || null,
        program_id: batch.program_id || row.program_id || null,
        program_name: batch.program_name || row.program_name || null,
        benefactor_name: batch.benefactor_name || row.benefactor_name || null,
        academic_year_id: batch.academic_year_id || row.academic_year_id || null,
        period_id: batch.period_id || row.period_id || null,
        semester: batch.semester || row.semester || null,
        payout_title: batch.payout_title || row.payout_title || 'Payout Batch',
        payout_date: batch.payout_date || row.payout_date || null,
        payment_mode: batch.payment_mode || row.payment_mode || null,
        total_amount: batch.total_amount || row.total_amount || null,
        batch_status: batch.batch_status || row.batch_status || null,
        is_archived: batch.is_archived ?? row.is_archived ?? false,
        updated_at: batch.updated_at || row.updated_at || new Date().toISOString(),
    };
}

function normalizeEntryPayload(row = {}, action = 'entry_updated') {
    const entry = row?.entry || row?.data || row || {};

    return {
        module: 'payout_management',
        action,
        payout_entry_id: entry.payout_entry_id || entry.entry_id || entry.id || null,
        payout_batch_id: entry.payout_batch_id || null,
        student_id: entry.student_id || entry.scholar_id || null,
        scholar_id: entry.scholar_id || entry.student_id || null,
        student_name: entry.student_name || entry.scholar_name || null,
        amount_received: entry.amount_received || null,
        release_status: entry.release_status || entry.status || null,
        previous_status: row.previous_status || entry.previous_status || null,
        released_at: entry.released_at || null,
        check_number: entry.check_number || null,
        remarks: entry.remarks || null,
        updated_at: entry.updated_at || new Date().toISOString(),
    };
}

function emitFallback(io, eventName, data) {
    if (!io) return;
    io.emit(eventName, {
        ...data,
        emitted_at: new Date().toISOString(),
    });
}

function emitPayoutBatchRealtime(req, row, action = 'updated') {
    const io = req.app.get('io');
    if (!io || !row) return;

    const payload = normalizeBatchPayload(row, action);

    if (action === 'created') {
        if (socketEvents?.payoutCreated) {
            socketEvents.payoutCreated(io, payload);
        } else {
            emitFallback(io, 'payout:created', payload);
        }
    }

    if (action === 'updated') {
        if (socketEvents?.payoutUpdated) {
            socketEvents.payoutUpdated(io, payload);
        } else {
            emitFallback(io, 'payout:updated', payload);
        }
    }

    if (action === 'archived') {
        if (socketEvents?.payoutArchived) {
            socketEvents.payoutArchived(io, payload);
        } else {
            emitFallback(io, 'payout:archived', payload);
        }
    }



    if (action === 'restored') {
        if (socketEvents?.payoutRestored) {
            socketEvents.payoutRestored(io, payload);
        } else {
            emitFallback(io, 'payout:restored', payload);
        }
    }

    if (socketEvents?.maintenanceUpdated) {
        socketEvents.maintenanceUpdated(io, payload);
    } else {
        emitFallback(io, 'maintenance:updated', payload);
    }

    if (socketEvents?.reportUpdated) {
        socketEvents.reportUpdated(io, {
            module: 'reports',
            source: 'payout_management',
            action,
            payout_batch_id: payload.payout_batch_id,
            updated_at: payload.updated_at,
        });
    } else {
        emitFallback(io, 'report:updated', {
            module: 'reports',
            source: 'payout_management',
            action,
            payout_batch_id: payload.payout_batch_id,
            updated_at: payload.updated_at,
        });
    }
}

function emitPayoutEntryRealtime(req, row, action = 'entry_updated') {
    const io = req.app.get('io');
    if (!io || !row) return;

    const payload = normalizeEntryPayload(row, action);

    if (socketEvents?.payoutUpdated) {
        socketEvents.payoutUpdated(io, payload);
    } else {
        emitFallback(io, 'payout:updated', payload);
    }

    if (String(payload.release_status || '').toLowerCase() === 'released') {
        if (socketEvents?.scholarReleased) {
            socketEvents.scholarReleased(io, payload);
        } else {
            emitFallback(io, 'scholar:released', payload);
        }
    }

    if (socketEvents?.reportUpdated) {
        socketEvents.reportUpdated(io, {
            module: 'reports',
            source: 'payout_management',
            action,
            payout_batch_id: payload.payout_batch_id,
            payout_entry_id: payload.payout_entry_id,
            updated_at: payload.updated_at,
        });
    } else {
        emitFallback(io, 'report:updated', {
            module: 'reports',
            source: 'payout_management',
            action,
            payout_batch_id: payload.payout_batch_id,
            payout_entry_id: payload.payout_entry_id,
            updated_at: payload.updated_at,
        });
    }
}

async function writePayoutAudit(req, actionTaken, description, entity = null, metadata = {}) {
    try {
        if (typeof auditLogService?.logAudit !== 'function') {
            console.warn('PAYOUT AUDIT WARNING: auditLogService.logAudit is not available.');
            return;
        }

        const batchPayload = normalizeBatchPayload(entity || {}, metadata.action || 'audit');
        const entryPayload = normalizeEntryPayload(entity || {}, metadata.action || 'audit');

        await auditLogService.logAudit({
            req,
            userId: getActorUserId(req),
            actionTaken,
            module: 'Payout Management',
            entityType: metadata.entityType || 'payout_batch',
            entityId:
                metadata.entityId ||
                batchPayload.payout_batch_id ||
                entryPayload.payout_entry_id ||
                null,
            description,
            metadata: {
                actor: getActorLabel(req),
                payout_batch_id:
                    metadata.payout_batch_id ||
                    batchPayload.payout_batch_id ||
                    entryPayload.payout_batch_id ||
                    null,
                payout_entry_id:
                    metadata.payout_entry_id ||
                    entryPayload.payout_entry_id ||
                    null,
                opening_id: batchPayload.opening_id || metadata.opening_id || null,
                program_id: batchPayload.program_id || metadata.program_id || null,
                program_name: batchPayload.program_name || metadata.program_name || null,
                benefactor_name: batchPayload.benefactor_name || metadata.benefactor_name || null,
                payout_title: batchPayload.payout_title || metadata.payout_title || null,
                payout_date: batchPayload.payout_date || metadata.payout_date || null,
                payment_mode: batchPayload.payment_mode || metadata.payment_mode || null,
                total_amount: batchPayload.total_amount || metadata.total_amount || null,
                student_id: entryPayload.student_id || metadata.student_id || null,
                scholar_id: entryPayload.scholar_id || metadata.scholar_id || null,
                student_name: entryPayload.student_name || metadata.student_name || null,
                release_status: entryPayload.release_status || metadata.release_status || null,
                previous_status: entryPayload.previous_status || metadata.previous_status || null,
                changes: metadata.changes || undefined,
            },
        });
    } catch (err) {
        console.error('PAYOUT AUDIT LOG ERROR:', err.message);
    }
}

function sendError(res, err, fallbackMessage) {
    const statusCode = err?.statusCode || err?.status || 500;

    return res.status(statusCode).json({
        message: err?.message || fallbackMessage || 'Payout request failed',
        error: err?.message || fallbackMessage || 'Payout request failed',
    });
}

exports.getPayoutBatches = async (req, res) => {
    try {
        const rows = await payoutService.fetchPayoutBatches();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET PAYOUT BATCHES ERROR:', err);
        sendError(res, err, 'Failed to fetch payout batches');
    }
};

exports.getPayoutOpenings = async (req, res) => {
    try {
        const rows = await payoutService.fetchPayoutOpenings();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET PAYOUT OPENINGS ERROR:', err);
        sendError(res, err, 'Failed to fetch payout openings');
    }
};

exports.getEligibleScholarsByOpening = async (req, res) => {
    try {
        const { opening_id } = req.query;

        if (!opening_id) {
            return res.status(400).json({
                message: 'opening_id is required',
                error: 'opening_id is required',
            });
        }

        const payload = await payoutService.fetchEligibleScholarsByOpening(opening_id);
        res.status(200).json(payload);
    } catch (err) {
        console.error('GET ELIGIBLE SCHOLARS BY OPENING ERROR:', err);
        sendError(res, err, 'Failed to fetch eligible scholars');
    }
};

exports.createPayoutBatch = async (req, res) => {
    try {
        const row = await payoutService.createPayoutBatchFromOpening({
            ...req.body,
            adminUserId: getActorUserId(req),
            created_by: getActorUserId(req),
        });

        emitPayoutBatchRealtime(req, row, 'created');

        await writePayoutAudit(
            req,
            'CREATE_PAYOUT_BATCH',
            `Created payout batch: ${row?.payout_title || row?.batch?.payout_title || req.body?.payout_title || 'Payout Batch'}.`,
            row,
            {
                entityType: 'payout_batch',
                action: 'created',
                changes: req.body,
            }
        );

        res.status(201).json(row);
    } catch (err) {
        console.error('CREATE PAYOUT BATCH ERROR:', err);
        sendError(res, err, 'Failed to create payout batch');
    }
};

exports.updateScholarStatus = async (req, res) => {
    try {
        const processed_by = getActorUserId(req);
        const nextStatus =
            req.body?.release_status ||
            req.body?.status ||
            req.body?.next_status ||
            'Pending';

        const row = await payoutService.updateScholarPayoutStatus({
            payout_entry_id: req.params.payoutEntryId,
            next_status: nextStatus,
            processed_by,
            remarks: req.body?.remarks,
            check_number: req.body?.check_number,
        });

        emitPayoutEntryRealtime(req, row, 'entry_status_updated');

        await writePayoutAudit(
            req,
            'UPDATE_PAYOUT_ENTRY_STATUS',
            `Updated payout entry status to ${nextStatus}.`,
            row,
            {
                entityType: 'payout_entry',
                entityId: req.params.payoutEntryId,
                payout_entry_id: req.params.payoutEntryId,
                action: 'entry_status_updated',
                release_status: nextStatus,
                changes: req.body,
            }
        );

        res.status(200).json(row);
    } catch (err) {
        console.error('UPDATE PAYOUT STATUS ERROR:', err);
        sendError(res, err, 'Failed to update payout status');
    }
};

exports.archivePayoutBatch = async (req, res) => {
    try {
        const { payoutBatchId } = req.params;

        const row = await payoutService.archivePayoutBatch({
            payout_batch_id: payoutBatchId,
            archived_by: getActorUserId(req),
        });

        emitPayoutBatchRealtime(req, row?.batch || row, 'archived');
        emitPayoutBatchRealtime(req, row?.batch || row, 'updated');

        await writePayoutAudit(
            req,
            'ARCHIVE_PAYOUT_BATCH',
            `Archived payout batch: ${row?.batch?.payout_title || row?.payout_title || payoutBatchId}.`,
            row?.batch || row,
            {
                entityType: 'payout_batch',
                entityId: payoutBatchId,
                payout_batch_id: payoutBatchId,
                action: 'archived',
            }
        );

        res.status(200).json(row);
    } catch (err) {
        console.error('ARCHIVE PAYOUT BATCH ERROR:', err);
        sendError(res, err, 'Failed to archive payout batch');
    }
};

exports.restorePayoutBatch = async (req, res) => {
    try {
        const { payoutBatchId } = req.params;

        if (typeof payoutService.restorePayoutBatch !== 'function') {
            const error = new Error('payoutService.restorePayoutBatch is not implemented yet. Add the service function that sets payout_batches.is_archived = false.');
            error.statusCode = 501;
            throw error;
        }

        const row = await payoutService.restorePayoutBatch({
            payout_batch_id: payoutBatchId,
            restored_by: getActorUserId(req),
        });

        const batch = row?.batch || row;

        emitPayoutBatchRealtime(req, batch, 'restored');
        emitPayoutBatchRealtime(req, batch, 'updated');

        await writePayoutAudit(
            req,
            'RESTORE_PAYOUT_BATCH',
            `Restored payout batch: ${batch?.payout_title || payoutBatchId}.`,
            batch,
            {
                entityType: 'payout_batch',
                entityId: payoutBatchId,
                payout_batch_id: payoutBatchId,
                action: 'restored',
            }
        );

        res.status(200).json({
            message: 'Payout batch restored successfully',
            data: batch,
        });
    } catch (err) {
        console.error('RESTORE PAYOUT BATCH ERROR:', err);
        sendError(res, err, 'Failed to restore payout batch');
    }
};


exports.getPayoutProofs = async (req, res) => {
  try {
    const items = await payoutService.fetchPayoutProofs(req.query || {});
    res.status(200).json({ items });
  } catch (err) {
    console.error('GET PAYOUT PROOFS ERROR:', err.message);
    res.status(err.statusCode || 500).json({
      message: err.message || 'Failed to load payout proofs.',
    });
  }
};

exports.reviewPayoutProof = async (req, res) => {
  try {
    const proof = await payoutService.reviewPayoutProof({
      proofId: req.params.proofId,
      status: req.body?.status,
      comment: req.body?.comment || '',
      actorUserId: req.user?.user_id || req.user?.userId || req.user?.sub || null,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('payout:proof-reviewed', {
        payout_proof_id: proof.payout_proof_id,
        payout_entry_id: proof.payout_entry_id,
        proof_status: proof.proof_status,
        updated_at: new Date().toISOString(),
      });
    }

    res.status(200).json({
      message: 'Payout proof review saved.',
      proof,
    });
  } catch (err) {
    console.error('REVIEW PAYOUT PROOF ERROR:', err.message);
    res.status(err.statusCode || 500).json({
      message: err.message || 'Failed to review payout proof.',
    });
  }
};
