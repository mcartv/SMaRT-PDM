const programOpeningService = require('../services/programOpeningService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function sendError(res, err, fallbackMessage) {
    const message = err?.message || fallbackMessage || 'Unknown backend error';

    const validationMessages = [
        'Program ID is required',
        'Opening title is required',
        'Academic year is required',
        'Allocated slots must be greater than 0',
        'Filled slots cannot be greater than allocated slots',
        'No academic period found for the selected academic year',
    ];

    if (validationMessages.includes(message)) {
        return res.status(400).json({
            message,
            error: message,
        });
    }

    if (message === 'Program opening not found') {
        return res.status(404).json({
            message,
            error: message,
        });
    }

    return res.status(err?.statusCode || 500).json({
        message,
        error: message,
    });
}

function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function buildOpeningPayload(opening = {}, action = 'updated') {
    return {
        module: 'scholarship_openings',
        action,
        opening_id: opening.opening_id || null,
        program_id: opening.program_id || null,
        program_name: opening.program_name || null,
        benefactor_id: opening.benefactor_id || null,
        benefactor_name: opening.benefactor_name || null,
        academic_year_id: opening.academic_year_id || null,
        academic_year: opening.academic_year || opening.academic_year_label || null,
        opening_title: opening.opening_title || opening.title || 'Untitled Opening',
        posting_status: opening.posting_status || opening.status || 'draft',
        computed_status: opening.computed_status || opening.posting_status || opening.status || 'draft',
        is_archived: !!opening.is_archived,
        allocated_slots: Number(opening.allocated_slots || 0),
        filled_slots: Number(opening.filled_slots || 0),
        remaining_slots: Number(opening.remaining_slots || 0),
        financial_allocation: opening.financial_allocation ?? null,
        per_scholar_amount: opening.per_scholar_amount ?? null,
        updated_at: opening.updated_at || opening.created_at || new Date().toISOString(),
    };
}

function emitOpeningRealtime(req, eventName, opening, action = 'updated') {
    const io = req.app.get('io');

    if (!io || !opening) return;

    const payload = buildOpeningPayload(opening, action);

    if (eventName === 'opening:created') {
        if (socketEvents?.openingCreated) {
            socketEvents.openingCreated(io, payload);
        } else {
            io.emit('opening:created', payload);
        }
    }

    if (eventName === 'opening:updated') {
        if (socketEvents?.openingUpdated) {
            socketEvents.openingUpdated(io, payload);
        } else {
            io.emit('opening:updated', payload);
        }
    }

    if (eventName === 'opening:closed') {
        if (socketEvents?.openingClosed) {
            socketEvents.openingClosed(io, payload);
        } else {
            io.emit('opening:closed', payload);
        }
    }

    if (socketEvents?.maintenanceUpdated) {
        socketEvents.maintenanceUpdated(io, payload);
    } else {
        io.emit('maintenance:updated', payload);
    }

    if (socketEvents?.reportUpdated) {
        socketEvents.reportUpdated(io, {
            module: 'reports',
            source: 'scholarship_openings',
            action,
            opening_id: opening.opening_id || null,
            updated_at: payload.updated_at,
        });
    } else {
        io.emit('report:updated', {
            module: 'reports',
            source: 'scholarship_openings',
            action,
            opening_id: opening.opening_id || null,
            updated_at: payload.updated_at,
        });
    }
}

async function writeOpeningAudit(req, actionTaken, description, opening = null, metadata = {}) {
    try {
        if (typeof auditLogService?.logAudit !== 'function') {
            console.warn('PROGRAM OPENING AUDIT WARNING: auditLogService.logAudit is not available.');
            return;
        }

        await auditLogService.logAudit({
            req,
            userId: getActorUserId(req),
            actionTaken,
            module: 'Scholarship Openings',
            entityType: 'program_opening',
            entityId: opening?.opening_id || metadata?.opening_id || null,
            description,
            metadata: {
                opening_id: opening?.opening_id || metadata?.opening_id || null,
                program_id: opening?.program_id || metadata?.program_id || null,
                program_name: opening?.program_name || metadata?.program_name || null,
                benefactor_id: opening?.benefactor_id || metadata?.benefactor_id || null,
                benefactor_name: opening?.benefactor_name || metadata?.benefactor_name || null,
                academic_year_id: opening?.academic_year_id || metadata?.academic_year_id || null,
                academic_year:
                    opening?.academic_year ||
                    opening?.academic_year_label ||
                    metadata?.academic_year ||
                    null,
                opening_title:
                    opening?.opening_title ||
                    opening?.title ||
                    metadata?.opening_title ||
                    null,
                allocated_slots:
                    opening?.allocated_slots ??
                    metadata?.allocated_slots ??
                    null,
                filled_slots:
                    opening?.filled_slots ??
                    metadata?.filled_slots ??
                    null,
                remaining_slots:
                    opening?.remaining_slots ??
                    metadata?.remaining_slots ??
                    null,
                financial_allocation:
                    opening?.financial_allocation ??
                    metadata?.financial_allocation ??
                    null,
                per_scholar_amount:
                    opening?.per_scholar_amount ??
                    metadata?.per_scholar_amount ??
                    null,
                posting_status:
                    opening?.posting_status ||
                    opening?.status ||
                    metadata?.posting_status ||
                    null,
                computed_status:
                    opening?.computed_status ||
                    metadata?.computed_status ||
                    null,
                is_archived:
                    opening?.is_archived ??
                    metadata?.is_archived ??
                    false,
                changes: metadata?.changes || undefined,
            },
        });
    } catch (err) {
        console.error('PROGRAM OPENING AUDIT LOG ERROR:', err.message);
    }
}

function resolveAuditAction(updated, body = {}) {
    const status = String(updated?.posting_status || updated?.status || '').toLowerCase();
    const isArchived = updated?.is_archived === true || status === 'archived';

    if (isArchived) {
        return {
            actionTaken: 'ARCHIVE_PROGRAM_OPENING',
            eventAction: 'archived',
            description: `Archived scholarship opening: ${updated?.opening_title || updated?.title || 'Untitled Opening'}.`,
        };
    }

    if (body?.is_archived === false) {
        return {
            actionTaken: 'RESTORE_PROGRAM_OPENING',
            eventAction: 'restored',
            description: `Restored scholarship opening: ${updated?.opening_title || updated?.title || 'Untitled Opening'}.`,
        };
    }

    if (status === 'closed') {
        return {
            actionTaken: 'CLOSE_PROGRAM_OPENING',
            eventAction: 'closed',
            description: `Closed scholarship opening: ${updated?.opening_title || updated?.title || 'Untitled Opening'}.`,
        };
    }

    if (status === 'draft') {
        return {
            actionTaken: 'MOVE_PROGRAM_OPENING_TO_DRAFT',
            eventAction: 'draft',
            description: `Moved scholarship opening to draft: ${updated?.opening_title || updated?.title || 'Untitled Opening'}.`,
        };
    }

    if (status === 'open') {
        return {
            actionTaken: 'OPEN_PROGRAM_OPENING',
            eventAction: 'opened',
            description: `Opened scholarship opening: ${updated?.opening_title || updated?.title || 'Untitled Opening'}.`,
        };
    }

    return {
        actionTaken: 'UPDATE_PROGRAM_OPENING',
        eventAction: 'updated',
        description: `Updated scholarship opening: ${updated?.opening_title || updated?.title || 'Untitled Opening'}.`,
    };
}

const getAllProgramOpenings = async (req, res) => {
    try {
        const rows = await programOpeningService.fetchAllProgramOpenings();
        return res.status(200).json(rows);
    } catch (err) {
        console.error('GET ALL PROGRAM OPENINGS CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to fetch program openings');
    }
};

const getMobileOpenings = async (req, res) => {
    try {
        const rows = await programOpeningService.fetchMobileOpenings();
        return res.status(200).json(rows);
    } catch (err) {
        console.error('GET MOBILE OPENINGS CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to fetch mobile openings');
    }
};

const getOpeningsApplicationSummary = async (req, res) => {
    try {
        const rows = await programOpeningService.fetchOpeningsApplicationSummary();
        return res.status(200).json(rows);
    } catch (err) {
        console.error('GET OPENINGS APPLICATION SUMMARY CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to fetch scholarship openings summary');
    }
};

const getProgramOpeningById = async (req, res) => {
    try {
        const { openingId } = req.params;
        const row = await programOpeningService.fetchProgramOpeningById(openingId);

        if (!row) {
            return res.status(404).json({
                message: 'Program opening not found',
                error: 'Program opening not found',
            });
        }

        return res.status(200).json(row);
    } catch (err) {
        console.error('GET PROGRAM OPENING BY ID CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to fetch program opening');
    }
};

const getApplicationsByOpeningId = async (req, res) => {
    try {
        const { openingId } = req.params;
        const rows = await programOpeningService.fetchApplicationsByOpeningId(openingId);
        return res.status(200).json(rows);
    } catch (err) {
        console.error('GET APPLICATIONS BY OPENING ID CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to fetch opening applicants');
    }
};

const createProgramOpening = async (req, res) => {
    try {
        const created = await programOpeningService.createProgramOpening(req.body);

        const status = String(created?.posting_status || created?.status || 'draft').toLowerCase();

        const createAction =
            status === 'open'
                ? 'CREATE_AND_OPEN_PROGRAM_OPENING'
                : 'CREATE_PROGRAM_OPENING_DRAFT';

        const eventAction =
            status === 'open'
                ? 'created-open'
                : 'created-draft';

        emitOpeningRealtime(req, 'opening:created', created, eventAction);
        emitOpeningRealtime(req, 'opening:updated', created, eventAction);

        await writeOpeningAudit(
            req,
            createAction,
            `Created scholarship opening: ${created?.opening_title || created?.title || req.body?.opening_title || 'Untitled Opening'}.`,
            created,
            {
                ...req.body,
            }
        );

        return res.status(201).json(created);
    } catch (err) {
        console.error('CREATE PROGRAM OPENING CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to create program opening');
    }
};

const updateProgramOpening = async (req, res) => {
    try {
        const { openingId } = req.params;
        const updated = await programOpeningService.updateProgramOpening(openingId, req.body);

        if (!updated) {
            return res.status(404).json({
                message: 'Program opening not found',
                error: 'Program opening not found',
            });
        }

        const audit = resolveAuditAction(updated, req.body);

        emitOpeningRealtime(req, 'opening:updated', updated, audit.eventAction);

        const status = String(updated?.posting_status || updated?.status || '').toLowerCase();

        if (status === 'closed' || updated?.is_archived === true || status === 'archived') {
            emitOpeningRealtime(req, 'opening:closed', updated, audit.eventAction);
        }

        await writeOpeningAudit(
            req,
            audit.actionTaken,
            audit.description,
            updated,
            {
                opening_id: openingId,
                changes: req.body,
            }
        );

        return res.status(200).json(updated);
    } catch (err) {
        console.error('UPDATE PROGRAM OPENING CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to update program opening');
    }
};

const closeProgramOpening = async (req, res) => {
    try {
        const { openingId } = req.params;
        const closed = await programOpeningService.closeProgramOpening(openingId);

        if (!closed) {
            return res.status(404).json({
                message: 'Program opening not found',
                error: 'Program opening not found',
            });
        }

        emitOpeningRealtime(req, 'opening:closed', closed, 'closed');
        emitOpeningRealtime(req, 'opening:updated', closed, 'closed');

        await writeOpeningAudit(
            req,
            'CLOSE_PROGRAM_OPENING',
            `Closed scholarship opening: ${closed?.opening_title || closed?.title || openingId}.`,
            closed,
            {
                opening_id: openingId,
            }
        );

        return res.status(200).json(closed);
    } catch (err) {
        console.error('CLOSE PROGRAM OPENING CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to close program opening');
    }
};

module.exports = {
    getAllProgramOpenings,
    getMobileOpenings,
    getOpeningsApplicationSummary,
    getProgramOpeningById,
    getApplicationsByOpeningId,
    createProgramOpening,
    updateProgramOpening,
    closeProgramOpening,
};