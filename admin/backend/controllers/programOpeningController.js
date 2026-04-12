const programOpeningService = require('../services/programOpeningService');

function sendError(res, err, fallbackMessage) {
    const message = err?.message || fallbackMessage || 'Unknown backend error';

    const validationMessages = [
        'Program ID is required',
        'Opening title is required',
        'Semester is required',
        'Academic year is required',
        'Allocated slots must be greater than 0',
        'Filled slots cannot be greater than allocated slots',
    ];

    if (validationMessages.includes(message)) {
        return res.status(400).json({
            message,
            error: message,
        });
    }

    return res.status(500).json({
        message,
        error: message,
    });
}

const getAllProgramOpenings = async (req, res) => {
    try {
        const rows = await programOpeningService.fetchAllProgramOpenings();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET ALL PROGRAM OPENINGS CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to fetch program openings');
    }
};

const getMobileOpenings = async (req, res) => {
    try {
        const rows = await programOpeningService.fetchMobileOpenings();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET MOBILE OPENINGS CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to fetch mobile openings');
    }
};

const getOpeningsApplicationSummary = async (req, res) => {
    try {
        const rows = await programOpeningService.fetchOpeningsApplicationSummary();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET OPENINGS APPLICATION SUMMARY CONTROLLER ERROR:', err);
        return res.status(500).json({
            message: err.message || 'Failed to fetch scholarship openings summary',
            error: err.message || 'Unknown backend error',
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        });
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

        res.status(200).json(row);
    } catch (err) {
        console.error('GET PROGRAM OPENING BY ID CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to fetch program opening');
    }
};

const getApplicationsByOpeningId = async (req, res) => {
    try {
        const { openingId } = req.params;
        const rows = await programOpeningService.fetchApplicationsByOpeningId(openingId);
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET APPLICATIONS BY OPENING ID CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to fetch opening applicants');
    }
};

const createProgramOpening = async (req, res) => {
    try {
        const created = await programOpeningService.createProgramOpening(req.body);
        res.status(201).json(created);
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

        res.status(200).json(updated);
    } catch (err) {
        console.error('UPDATE PROGRAM OPENING CONTROLLER ERROR:', err);
        return sendError(res, err, 'Failed to update program opening');
    }
};

const closeProgramOpening = async (req, res) => {
    try {
        const { openingId } = req.params;
        const updated = await programOpeningService.closeProgramOpening(openingId);

        if (!updated) {
            return res.status(404).json({
                message: 'Program opening not found',
                error: 'Program opening not found',
            });
        }

        res.status(200).json(updated);
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