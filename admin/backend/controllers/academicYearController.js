const academicYearService = require('../services/academicYearService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function sendError(res, err, fallbackMessage) {
    const message = err?.message || fallbackMessage || 'Unknown backend error';

    const validationMessages = [
        'Start year is required',
        'End year is required',
        'Start year must be a valid number',
        'End year must be a valid number',
        'End year must be exactly start year + 1',
        'That academic year already exists',
        'Academic year not found',
        'Cannot archive the active academic year. Set another academic year as active first.',
        'Cannot activate an archived academic year. Restore it first.',
        'Cannot update an archived academic year. Restore it first.',
    ];

    const statusCode = validationMessages.includes(message) ? 400 : 500;

    return res.status(statusCode).json({
        message,
        error: message,
    });
}

function emitAcademicYearUpdate(req, action, row = null) {
    const io = req.app.get('io');

    const payload = {
        module: 'academic_years',
        action,
        id: row?.academic_year_id || null,
        academic_year: row,
        updated_at: new Date().toISOString(),
    };

    if (socketEvents?.maintenanceUpdated) {
        socketEvents.maintenanceUpdated(io, payload);
        return;
    }

    if (io) {
        io.emit('maintenance:updated', payload);
    }
}

exports.getAcademicYears = async (req, res) => {
    try {
        const rows = await academicYearService.getAcademicYears();
        return res.status(200).json(rows);
    } catch (err) {
        console.error('GET ACADEMIC YEARS ERROR:', err);
        return sendError(res, err, 'Failed to fetch academic years');
    }
};

exports.createAcademicYear = async (req, res) => {
    await auditLogService.logAudit({
        req,
        actionTaken: 'CREATE_ACADEMIC_YEAR',
        module: 'Academic Years',
        entityType: 'academic_year',
        entityId: academicYear?.academic_year_id || null,
        description: `Created academic year: ${academicYear?.label || `${academicYear?.start_year}-${academicYear?.end_year}`}.`,
        metadata: {
            academic_year_id: academicYear?.academic_year_id || null,
            label: academicYear?.label || null,
            start_year: academicYear?.start_year || null,
            end_year: academicYear?.end_year || null,
        },
    });

    try {
        const created = await academicYearService.createAcademicYear(req.body);

        emitAcademicYearUpdate(req, 'create', created);

        return res.status(201).json(created);
    } catch (err) {
        console.error('CREATE ACADEMIC YEAR ERROR:', err);
        return sendError(res, err, 'Failed to create academic year');
    }
};

exports.updateAcademicYear = async (req, res) => {
    await auditLogService.logAudit({
        req,
        actionTaken: 'UPDATE_ACADEMIC_YEAR',
        module: 'Academic Years',
        entityType: 'academic_year',
        entityId: academicYear?.academic_year_id || req.params.id,
        description: `Updated academic year: ${academicYear?.label || req.params.id}.`,
        metadata: {
            academic_year_id: academicYear?.academic_year_id || req.params.id,
            changes: req.body,
        },
    });

    try {
        const updated = await academicYearService.updateAcademicYear(
            req.params.id,
            req.body
        );

        if (!updated) {
            return res.status(404).json({
                message: 'Academic year not found',
                error: 'Academic year not found',
            });
        }

        emitAcademicYearUpdate(req, 'update', updated);

        return res.status(200).json(updated);
    } catch (err) {
        console.error('UPDATE ACADEMIC YEAR ERROR:', err);
        return sendError(res, err, 'Failed to update academic year');
    }
};

exports.activateAcademicYear = async (req, res) => {
    await auditLogService.logAudit({
        req,
        actionTaken: 'ACTIVATE_ACADEMIC_YEAR',
        module: 'Academic Years',
        entityType: 'academic_year',
        entityId: academicYear?.academic_year_id || req.params.id,
        description: `Activated academic year: ${academicYear?.label || req.params.id}.`,
        metadata: {
            academic_year_id: academicYear?.academic_year_id || req.params.id,
            label: academicYear?.label || null,
            is_active: academicYear?.is_active,
        },
    });

    try {
        const updated = await academicYearService.activateAcademicYear(req.params.id);

        if (!updated) {
            return res.status(404).json({
                message: 'Academic year not found',
                error: 'Academic year not found',
            });
        }

        emitAcademicYearUpdate(req, 'activate', updated);

        return res.status(200).json(updated);
    } catch (err) {
        console.error('ACTIVATE ACADEMIC YEAR ERROR:', err);
        return sendError(res, err, 'Failed to activate academic year');
    }
};

exports.archiveAcademicYear = async (req, res) => {
    await auditLogService.logAudit({
        req,
        actionTaken: academicYear?.is_archived ? 'ARCHIVE_ACADEMIC_YEAR' : 'RESTORE_ACADEMIC_YEAR',
        module: 'Academic Years',
        entityType: 'academic_year',
        entityId: academicYear?.academic_year_id || req.params.id,
        description: `${academicYear?.is_archived ? 'Archived' : 'Restored'} academic year: ${academicYear?.label || req.params.id}.`,
        metadata: {
            academic_year_id: academicYear?.academic_year_id || req.params.id,
            is_archived: academicYear?.is_archived,
        },
    });

    try {
        const archived = await academicYearService.archiveAcademicYear(req.params.id);

        if (!archived) {
            return res.status(404).json({
                message: 'Academic year not found',
                error: 'Academic year not found',
            });
        }

        emitAcademicYearUpdate(req, 'archive', archived);

        return res.status(200).json(archived);
    } catch (err) {
        console.error('ARCHIVE ACADEMIC YEAR ERROR:', err);
        return sendError(res, err, 'Failed to archive academic year');
    }
};

exports.restoreAcademicYear = async (req, res) => {
    await auditLogService.logAudit({
        req,
        actionTaken: academicYear?.is_archived ? 'ARCHIVE_ACADEMIC_YEAR' : 'RESTORE_ACADEMIC_YEAR',
        module: 'Academic Years',
        entityType: 'academic_year',
        entityId: academicYear?.academic_year_id || req.params.id,
        description: `${academicYear?.is_archived ? 'Archived' : 'Restored'} academic year: ${academicYear?.label || req.params.id}.`,
        metadata: {
            academic_year_id: academicYear?.academic_year_id || req.params.id,
            is_archived: academicYear?.is_archived,
        },
    });
    
    try {
        const restored = await academicYearService.restoreAcademicYear(req.params.id);

        if (!restored) {
            return res.status(404).json({
                message: 'Academic year not found',
                error: 'Academic year not found',
            });
        }

        emitAcademicYearUpdate(req, 'restore', restored);

        return res.status(200).json(restored);
    } catch (err) {
        console.error('RESTORE ACADEMIC YEAR ERROR:', err);
        return sendError(res, err, 'Failed to restore academic year');
    }
};