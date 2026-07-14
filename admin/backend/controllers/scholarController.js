const scholarService = require('../services/scholarService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

async function writeScholarAudit(req, actionTaken, description, scholar = null, metadata = {}) {
    try {
        if (typeof auditLogService?.logAudit !== 'function') return;

        await auditLogService.logAudit({
            req,
            userId: getActorUserId(req),
            actionTaken,
            module: 'Scholar Management',
            entityType: 'student_scholar',
            entityId: scholar?.student_id || scholar?.scholar_id || metadata?.student_id || null,
            description,
            metadata: {
                student_id: scholar?.student_id || scholar?.scholar_id || metadata?.student_id || null,
                scholar_id: scholar?.scholar_id || scholar?.student_id || metadata?.student_id || null,
                student_name: scholar?.student_name || metadata?.student_name || null,
                student_number: scholar?.student_number || metadata?.student_number || null,
                program_id: scholar?.program_id || metadata?.program_id || null,
                program_name: scholar?.program_name || metadata?.program_name || null,
                scholarship_status: scholar?.status || metadata?.status || null,
                ro_status: scholar?.ro_status || metadata?.ro_status || null,
                sdo_status: scholar?.sdo_status || metadata?.sdo_status || null,
                changes: metadata?.changes || undefined,
            },
        });
    } catch (err) {
        console.error('SCHOLAR AUDIT LOG ERROR:', err.message);
    }
}

function emitScholarUpdated(req, payload = {}) {
    const io = req.app.get('io');
    if (!io) return;

    const data = {
        ...payload,
        updated_at: new Date().toISOString(),
    };

    if (socketEvents?.scholarUpdated) {
        socketEvents.scholarUpdated(io, data);
    } else {
        io.emit('scholar:updated', data);
    }

    if (socketEvents?.maintenanceUpdated) {
        socketEvents.maintenanceUpdated(io, {
            module: 'scholar_management',
            source: 'scholars',
            ...data,
        });
    } else {
        io.emit('maintenance:updated', {
            module: 'scholar_management',
            source: 'scholars',
            ...data,
        });
    }

    if (socketEvents?.reportUpdated) {
        socketEvents.reportUpdated(io, {
            module: 'reports',
            source: 'scholars',
            ...data,
        });
    } else {
        io.emit('report:updated', {
            module: 'reports',
            source: 'scholars',
            ...data,
        });
    }
}

exports.getStats = async (req, res) => {
    try {
        const stats = await scholarService.fetchScholarStats();
        res.json(stats);
    } catch (err) {
        console.error('SCHOLAR STATS CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            message: 'Failed to fetch scholar stats',
            error: err.message,
        });
    }
};

exports.getAllScholars = async (req, res) => {
    try {
        const scholars = await scholarService.fetchAllScholars();
        res.json(scholars);
    } catch (err) {
        console.error('SCHOLAR LIST CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            message: 'Failed to fetch scholars',
            error: err.message,
        });
    }
};

exports.getScholarById = async (req, res) => {
    try {
        const { id } = req.params;
        const scholar = await scholarService.fetchScholarById(id);

        if (!scholar) {
            return res.status(404).json({ message: 'Scholar not found' });
        }

        res.json(scholar);
    } catch (err) {
        console.error('SCHOLAR PROFILE CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            message: 'Failed to fetch scholar profile',
            error: err.message,
        });
    }
};

exports.getScholarRenewalDocuments = async (req, res) => {
    try {
        const { id } = req.params;
        const data = await scholarService.fetchScholarRenewalDocuments(id);

        res.status(200).json(data);
    } catch (err) {
        console.error('GET SCHOLAR RENEWAL DOCUMENTS ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            message: err.message || 'Failed to fetch renewal documents',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.getSdoStats = async (req, res) => {
    try {
        const stats = await scholarService.fetchSdoStats();
        res.json(stats);
    } catch (err) {
        console.error('SDO STATS CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            message: 'Failed to fetch SDO analytics',
            error: err.message,
        });
    }
};

exports.updateSdoStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await scholarService.updateScholarSdoStatus(id, req.body, req.user);

        if (!updated) {
            return res.status(404).json({ message: 'Scholar not found' });
        }

        emitScholarUpdated(req, {
            scholar_id: id,
            student_id: id,
            sdo_status: updated.sdo_status,
            ro_status: updated.ro_status || null,
            source: 'sdo_status_update',
        });

        await writeScholarAudit(
            req,
            'UPDATE_SDO_STATUS',
            `Updated SDO status for scholar: ${updated.student_name || id}.`,
            updated,
            {
                student_id: id,
                changes: req.body,
            }
        );

        res.json({
            message: 'Scholar probation status updated successfully',
            scholar: updated,
        });
    } catch (err) {
        console.error('SDO UPDATE CONTROLLER ERROR:', err.message);

        if (err.message === 'Invalid SDO status value') {
            return res.status(400).json({ message: err.message });
        }

        res.status(err.statusCode || 500).json({
            message: 'Failed to update scholar probation status',
            error: err.message,
        });
    }
};

exports.verifyScholarRenewalDocument = async (req, res) => {
    try {
        const { id, renewalDocumentId } = req.params;

        const data = await scholarService.verifyScholarRenewalDocument(
            id,
            renewalDocumentId,
            req.body,
            req.user
        );

        const io = req.app.get('io');

        if (io && socketEvents?.renewalUpdated) {
            socketEvents.renewalUpdated(io, {
                scholar_id: id,
                student_id: id,
                renewal_document_id: renewalDocumentId,
                verification_status:
                    data?.verification_status ??
                    data?.status ??
                    req.body?.verification_status ??
                    req.body?.ocr_status ??
                    null,
                updated_at: new Date().toISOString(),
                source: 'document_verification',
            });
        }

        emitScholarUpdated(req, {
            scholar_id: id,
            student_id: id,
            source: 'renewal_document_verification',
        });

        await writeScholarAudit(
            req,
            'VERIFY_RENEWAL_DOCUMENT',
            `Verified renewal document for scholar: ${id}.`,
            null,
            {
                student_id: id,
                renewal_document_id: renewalDocumentId,
                changes: req.body,
            }
        );

        res.status(200).json({
            message: 'Renewal document verified successfully',
            data,
        });
    } catch (err) {
        console.error('VERIFY SCHOLAR RENEWAL DOCUMENT ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            message: err.message || 'Failed to verify renewal document',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.saveScholarRenewalReview = async (req, res) => {
    try {
        const { id } = req.params;

        const data = await scholarService.saveScholarRenewalReview(
            id,
            req.body,
            req.user
        );

        const io = req.app.get('io');

        if (io && socketEvents?.renewalApproved) {
            socketEvents.renewalApproved(io, {
                scholar_id: id,
                student_id: id,
                renewal_status: data.renewal_status,
                updated_at: new Date().toISOString(),
            });
        }

        emitScholarUpdated(req, {
            scholar_id: id,
            student_id: id,
            scholar_status: data?.scholar_status ?? null,
            renewal_status: data?.renewal_status ?? null,
            ro_status: data?.ro_status ?? null,
            source: 'renewal_review',
        });

        await writeScholarAudit(
            req,
            'SAVE_RENEWAL_REVIEW',
            `Saved renewal review for scholar: ${data?.student_name || id}.`,
            data,
            {
                student_id: id,
                changes: req.body,
            }
        );

        res.status(200).json({
            message: 'Renewal review saved successfully',
            data,
        });
    } catch (err) {
        console.error('SAVE SCHOLAR RENEWAL REVIEW ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            message: err.message || 'Failed to save renewal review',
            error: err.message || 'Unknown backend error',
        });
    }
};