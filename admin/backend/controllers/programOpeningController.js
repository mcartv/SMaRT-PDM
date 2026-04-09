const programOpeningService = require('../services/programOpeningService');

exports.getAllProgramOpenings = async (req, res) => {
    try {
        const rows = await programOpeningService.fetchAllProgramOpenings();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET ALL PROGRAM OPENINGS CONTROLLER ERROR:', err.message);
        res.status(500).json({
            message: 'Failed to fetch program openings',
            error: err.message,
        });
    }
};

exports.getMobileOpenings = async (req, res) => {
    try {
        const rows = await programOpeningService.fetchMobileOpenings();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET MOBILE OPENINGS CONTROLLER ERROR:', err.message);
        res.status(500).json({
            message: 'Failed to fetch mobile openings',
            error: err.message,
        });
    }
};

exports.getOpeningsApplicationSummary = async (req, res) => {
    try {
        const rows = await programOpeningService.fetchOpeningsApplicationSummary();
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET OPENINGS APPLICATION SUMMARY CONTROLLER ERROR:', err);

        res.status(500).json({
            message: err.message || 'Failed to fetch scholarship openings summary',
            error: err.message || 'Unknown backend error',
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        });
    }
};

exports.getProgramOpeningById = async (req, res) => {
    try {
        const { openingId } = req.params;

        const row = await programOpeningService.fetchProgramOpeningById(openingId);

        if (!row) {
            return res.status(404).json({
                message: 'Program opening not found',
            });
        }

        res.status(200).json(row);
    } catch (err) {
        console.error('GET PROGRAM OPENING BY ID CONTROLLER ERROR:', err.message);
        res.status(500).json({
            message: 'Failed to fetch program opening',
            error: err.message,
        });
    }
};

exports.getApplicationsByOpeningId = async (req, res) => {
    try {
        const { openingId } = req.params;
        const rows = await programOpeningService.fetchApplicationsByOpeningId(openingId);
        res.status(200).json(rows);
    } catch (err) {
        console.error('GET APPLICATIONS BY OPENING ID CONTROLLER ERROR:', err.message);
        res.status(500).json({
            message: 'Failed to fetch opening applicants',
            error: err.message,
        });
    }
};

exports.createProgramOpening = async (req, res) => {
    try {
        const created = await programOpeningService.createProgramOpening(req.body);
        res.status(201).json(created);
    } catch (err) {
        console.error('CREATE PROGRAM OPENING CONTROLLER ERROR:', err.message);
        res.status(500).json({
            message: 'Failed to create program opening',
            error: err.message,
        });
    }
};

exports.updateProgramOpening = async (req, res) => {
    try {
        const { openingId } = req.params;
        const updated = await programOpeningService.updateProgramOpening(openingId, req.body);

        if (!updated) {
            return res.status(404).json({
                message: 'Program opening not found',
            });
        }

        res.status(200).json(updated);
    } catch (err) {
        console.error('UPDATE PROGRAM OPENING CONTROLLER ERROR:', err.message);
        res.status(500).json({
            message: 'Failed to update program opening',
            error: err.message,
        });
    }
};

exports.closeProgramOpening = async (req, res) => {
    try {
        const { openingId } = req.params;
        const updated = await programOpeningService.closeProgramOpening(openingId);

        if (!updated) {
            return res.status(404).json({
                message: 'Program opening not found',
            });
        }

        res.status(200).json(updated);
    } catch (err) {
        console.error('CLOSE PROGRAM OPENING CONTROLLER ERROR:', err.message);
        res.status(500).json({
            message: 'Failed to close program opening',
            error: err.message,
        });
    }
};