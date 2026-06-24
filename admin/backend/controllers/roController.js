const roService = require('../services/roService');
const socketEvents = require('../utils/socketEvents');

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
        const io = req.app.get('io');
        socketEvents.roUpdated(io, {
            updated_at: new Date().toISOString(),
            source: 'config',
            action: 'update',
            data,
        });
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
        const io = req.app.get('io');
        socketEvents.roUpdated(io, {
            updated_at: new Date().toISOString(),
            source: 'ro',
            action: 'create',
            ro_id: data?.ro_id ?? data?.id ?? null,
            data,
        });
        res.status(201).json(data);
    } catch (err) {
        console.error('CREATE RO ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.approveRO = async (req, res) => {
    try {
        const data = await roService.approveRO(req.params.id, req.user);
        const io = req.app.get('io');
        socketEvents.roUpdated(io, {
            updated_at: new Date().toISOString(),
            source: 'ro',
            action: 'approve',
            ro_id: req.params.id,
            data,
        });
        res.status(200).json(data);
    } catch (err) {
        console.error('APPROVE RO ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.rejectRO = async (req, res) => {
    try {
        const data = await roService.rejectRO(req.params.id, req.body, req.user);
        const io = req.app.get('io');
        socketEvents.roUpdated(io, {
            updated_at: new Date().toISOString(),
            source: 'ro',
            action: 'reject',
            ro_id: req.params.id,
            data,
        });
        res.status(200).json(data);
    } catch (err) {
        console.error('REJECT RO ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.assignDepartment = async (req, res) => {
    try {
        const data = await roService.assignDepartment(req.params.id, req.body, req.user);
        const io = req.app.get('io');
        socketEvents.roUpdated(io, {
            updated_at: new Date().toISOString(),
            source: 'ro',
            action: 'assign_department',
            ro_id: req.params.id,
            data,
        });
        res.status(200).json(data);
    } catch (err) {
        console.error('ASSIGN DEPARTMENT ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};
