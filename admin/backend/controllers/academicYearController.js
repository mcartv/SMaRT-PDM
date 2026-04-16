const academicYearService = require('../services/academicYearService');

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
    ];

    const statusCode = validationMessages.includes(message) ? 400 : 500;

    return res.status(statusCode).json({
        message,
        error: message,
    });
}

exports.getAcademicYears = async (req, res) => {
    try {
        const rows = await academicYearService.getAcademicYears();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET ACADEMIC YEARS ERROR:', err);
        return sendError(res, err, 'Failed to fetch academic years');
    }
};

exports.createAcademicYear = async (req, res) => {
    try {
        const created = await academicYearService.createAcademicYear(req.body);
        res.status(201).json(created);
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

        res.status(200).json(updated);
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

        res.status(200).json(updated);
    } catch (err) {
        console.error('ACTIVATE ACADEMIC YEAR ERROR:', err);
        return sendError(res, err, 'Failed to activate academic year');
    }
};