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

exports.getROScholars = async (req, res) => {
    try {
        const data = await roService.getROScholars(req.query);
        res.status(200).json({ scholars: data });
    } catch (err) {
        console.error('GET RO SCHOLARS ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};

exports.clearScholarRO = async (req, res) => {
    try {
        const data = await roService.clearScholarRO(
            req.params.studentId,
            req.body,
            req.user
        );

        const io = req.app.get('io');

        socketEvents.roUpdated(io, {
            updated_at: new Date().toISOString(),
            source: 'ro-clearance',
            action: 'clear',
            student_id: req.params.studentId,
            application_id: req.body?.applicationId || null,
            opening_id: req.body?.openingId || null,
            data,
        });

        res.status(200).json(data);
    } catch (err) {
        console.error('CLEAR STUDENT RO ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};