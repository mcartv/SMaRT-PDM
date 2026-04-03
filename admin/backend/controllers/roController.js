const roService = require('../services/roService');

exports.getSummary = async (req, res) => {
    try {
        const data = await roService.getSummary();
        res.status(200).json(data);
    } catch (err) {
        console.error('GET RO SUMMARY ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getConfig = async (req, res) => {
    try {
        const data = await roService.getConfig();
        res.status(200).json(data);
    } catch (err) {
        console.error('GET RO CONFIG ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.updateConfig = async (req, res) => {
    try {
        const data = await roService.updateConfig(req.body, req.user);
        res.status(200).json(data);
    } catch (err) {
        console.error('UPDATE RO CONFIG ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.getROList = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;
        const data = await roService.getROList(status);
        res.status(200).json(data);
    } catch (err) {
        console.error('GET RO LIST ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.createRO = async (req, res) => {
    try {
        const data = await roService.createRO(req.body, req.user);
        res.status(201).json(data);
    } catch (err) {
        console.error('CREATE RO ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.approveRO = async (req, res) => {
    try {
        const data = await roService.approveRO(req.params.id, req.user);
        res.status(200).json(data);
    } catch (err) {
        console.error('APPROVE RO ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.rejectRO = async (req, res) => {
    try {
        const data = await roService.rejectRO(req.params.id, req.body, req.user);
        res.status(200).json(data);
    } catch (err) {
        console.error('REJECT RO ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.assignDepartment = async (req, res) => {
    try {
        const data = await roService.assignDepartment(req.params.id, req.body, req.user);
        res.status(200).json(data);
    } catch (err) {
        console.error('ASSIGN DEPARTMENT ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};