const scholarService = require('../services/scholarService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');
const notificationService = require('../services/notificationService');
const studentRealtimeRelayService = require('../services/studentRealtimeRelayService');

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
    const data = {
        ...payload,
        updated_at: new Date().toISOString(),
    };

    if (io) {
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

    // students/scholars are not currently published through Supabase realtime.
    // Send refresh-only metadata so the mobile app immediately reloads the
    // authenticated scholar state after an Admin/SDO decision.
    studentRealtimeRelayService
        .relayModuleEvent({
            event: 'scholar:updated',
            payload: {
                student_id: data.student_id || data.scholar_id || null,
                action: data.action || 'updated',
                updated_at: data.updated_at,
            },
        })
        .catch((error) => {
            console.error('SCHOLAR STUDENT REALTIME RELAY ERROR:', error.message);
        });
}

async function notifyAdminsOfSdoStatusChange(req, scholar = {}) {
    try {
        if (typeof notificationService?.createStaffNotifications !== 'function') return;

        const studentName = scholar.student_name || scholar.student_id || 'Scholar';
        const statusLabel = scholar.sdo_status || 'Updated';
        const notifications = await notificationService.createStaffNotifications({
            roles: ['admin'],
            type: 'Scholar Status',
            title: 'Scholar probation status updated',
            message: `SDO updated ${studentName}'s disciplinary standing to ${statusLabel}.`,
            referenceId: scholar.student_id || scholar.scholar_id || null,
            referenceType: 'scholar',
        });

        const io = req.app.get('io');
        if (!io || !Array.isArray(notifications)) return;

        for (const notification of notifications) {
            const targetUserId = notification?.target_user_id || notification?.user_id;
            if (!targetUserId) continue;
            socketEvents.notificationCreated(io, targetUserId, notification);
        }
    } catch (err) {
        // The scholar update is already committed. Notification delivery must
        // never turn a successful SDO status update into a failed request.
        console.error('SDO SCHOLAR STATUS ADMIN NOTIFICATION ERROR:', err.message);
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


exports.getRemovedScholars = async (req, res) => {
    try {
        const scholars = await scholarService.fetchRemovedScholars();
        res.json(scholars);
    } catch (err) {
        console.error('REMOVED SCHOLAR LIST CONTROLLER ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            message: 'Failed to fetch removed scholars',
            error: err.message,
        });
    }
};

exports.getScholarById = async (req, res) => {
    try {
        const { id } = req.params;
        const scholar = await scholarService.fetchScholarById(id, {
            includeRemoved: String(req.query?.includeRemoved || '').toLowerCase() === 'true',
        });

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

        await notifyAdminsOfSdoStatusChange(req, updated);

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


exports.archiveScholar = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await scholarService.archiveScholarAndReleaseSlot(
            id,
            req.body || {},
            req.user
        );

        emitScholarUpdated(req, {
            scholar_id: id,
            student_id: id,
            action: 'privilege_removed',
            scholar_status: result.scholar_status || 'Removed',
            opening_id: result.opening_id,
        });

        if (result.user_id && typeof notificationService?.createUserNotification === 'function') {
            try {
                const notification = await notificationService.createUserNotification({
                    userId: result.user_id,
                    type: 'Scholarship Status',
                    title: 'Scholarship privilege removed',
                    message: `Your scholarship privilege has been removed. Reason: ${result.removal_reason}. Your previous scholarship record remains on file. Contact OSFA for an eligibility review before applying again.`,
                    referenceId: id,
                    referenceType: 'student_scholar',
                });
                const notificationIo = req.app.get('io');
                if (notificationIo && notification) {
                    socketEvents.notificationCreated(notificationIo, result.user_id, {
                        ...notification,
                        target_user_id: result.user_id,
                    });
                }
            } catch (notificationError) {
                console.error('REMOVE SCHOLAR PRIVILEGE NOTIFICATION ERROR:', notificationError.message);
            }
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('scholar:archived', {
                scholar_id: id,
                student_id: id,
                opening_id: result.opening_id,
                promotion: result.promotion || null,
                updated_at: new Date().toISOString(),
            });
            if (result.promotion?.promoted) {
                io.emit('selection:waitlist-promoted', {
                    opening_id: result.opening_id,
                    ...result.promotion,
                    updated_at: new Date().toISOString(),
                });
            }
        }

        await writeScholarAudit(
            req,
            'REMOVE_SCHOLAR_PRIVILEGE_RELEASE_SLOT',
            `Removed scholarship privilege and released a scholarship slot: ${id}.`,
            null,
            {
                student_id: id,
                changes: req.body || {},
                promotion: result.promotion || null,
            }
        );

        res.status(200).json({
            message: result.promotion?.promoted
                ? `Scholarship privilege removed. ${result.promotion.applicant_name || 'The next applicant'} was promoted from the waiting list.`
                : 'Scholarship privilege removed and the scholarship slot was released.',
            data: result,
        });
    } catch (err) {
        console.error('REMOVE SCHOLAR PRIVILEGE ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            message: err.message || 'Failed to remove scholarship privilege.',
            error: err.message || 'Unknown backend error',
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
