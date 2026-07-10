const academicYearService = require('../services/academicYearService');
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