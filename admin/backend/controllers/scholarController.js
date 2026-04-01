const scholarService = require('../services/scholarService');

exports.getStats = async (req, res) => {
    try {
        const stats = await scholarService.fetchScholarStats();
        res.json(stats);
    } catch (err) {
        console.error('SCHOLAR STATS CONTROLLER ERROR:', err.message);
        res.status(500).json({
            message: 'Failed to fetch scholar stats',
            error: err.message
        });
    }
};

exports.getAllScholars = async (req, res) => {
    try {
        const scholars = await scholarService.fetchAllScholars();
        res.json(scholars);
    } catch (err) {
        console.error('SCHOLAR LIST CONTROLLER ERROR:', err.message);
        res.status(500).json({
            message: 'Failed to fetch scholars',
            error: err.message
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
        res.status(500).json({
            message: 'Failed to fetch scholar profile',
            error: err.message,
        });
    }
};