const programOpeningService = require('../services/programOpeningService');

exports.getProgramOpenings = async (req, res) => {
    try {
        const data = await programOpeningService.getProgramOpenings();
        res.status(200).json(data);
    } catch (err) {
        console.error('GET PROGRAM OPENINGS ERROR:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.createProgramOpening = async (req, res) => {
    try {
        const data = await programOpeningService.createProgramOpening(req.body);
        res.status(201).json(data);
    } catch (err) {
        console.error('CREATE PROGRAM OPENING ERROR:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.updateProgramOpening = async (req, res) => {
    try {
        const data = await programOpeningService.updateProgramOpening(req.params.id, req.body);
        res.status(200).json(data);
    } catch (err) {
        console.error('UPDATE PROGRAM OPENING ERROR:', err);
        res.status(500).json({ error: err.message });
    }
};