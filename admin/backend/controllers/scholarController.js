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

exports.getScholarRenewalDocuments = async (req, res) => {
    try {
        const { id } = req.params;
        const documents = await scholarService.fetchScholarRenewalDocuments(id);
        res.json(documents);
    } catch (err) {
        console.error('SCHOLAR RENEWAL DOCUMENTS CONTROLLER ERROR:', err.message);
        res.status(500).json({
            message: 'Failed to fetch scholar renewal documents',
            error: err.message,
        });
    }
};

exports.getSdoStats = async (req, res) => {
    try {
        const stats = await scholarService.fetchSdoStats();
        res.json(stats);
    } catch (err) {
        console.error('SDO STATS CONTROLLER ERROR:', err.message);
        res.status(500).json({
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

        res.json({
            message: 'Scholar probation status updated successfully',
            scholar: updated,
        });
    } catch (err) {
        console.error('SDO UPDATE CONTROLLER ERROR:', err.message);

        if (err.message === 'Invalid SDO status value') {
            return res.status(400).json({ message: err.message });
        }

        res.status(500).json({
            message: 'Failed to update scholar probation status',
            error: err.message,
        });
    }
};