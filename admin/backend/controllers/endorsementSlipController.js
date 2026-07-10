const endorsementSlipService = require('../services/endorsementSlipService');
const socketEvents = require('../utils/socketEvents');

exports.getAllSlips = async (req, res) => {
    try {
        const rows = await endorsementSlipService.fetchAllSlips(req.user);
        res.status(200).json(rows);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to load endorsement tracker.',
        });
    }
};

exports.getPdQueue = async (req, res) => {
    try {
        const rows = await endorsementSlipService.fetchQueue('pd', req.user);
        res.status(200).json(rows);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to load PD queue.',
        });
    }
};

exports.getGuidanceQueue = async (req, res) => {
    try {
        const rows = await endorsementSlipService.fetchQueue('guidance', req.user);
        res.status(200).json(rows);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to load Guidance queue.',
        });
    }
};

exports.getSdoQueue = async (req, res) => {
    try {
        const rows = await endorsementSlipService.fetchQueue('sdo', req.user);
        res.status(200).json(rows);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to load SDO queue.',
        });
    }
};

exports.getSlipDetail = async (req, res) => {
    try {
        const payload = await endorsementSlipService.fetchSlipDetail(req.params.slipId, req.user);
        res.status(200).json(payload);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to load endorsement slip.',
        });
    }
};

exports.downloadSlipPdf = async (req, res) => {
    try {
        const pdf = await endorsementSlipService.buildSlipPdfDownload(req.params.slipId, req.user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdf.fileName}"`);
        res.status(200).send(pdf.buffer);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to download endorsement slip PDF.',
        });
    }
};

exports.postPdAction = async (req, res) => {
    try {
        const result = await endorsementSlipService.applyStageAction('pd', req.params.slipId, req.body, req.user);
        const io = req.app.get('io');
        socketEvents.endorsementUpdated(io, {
            slip_id: req.params.slipId,
            current_stage: result.slip.current_stage,
            overall_status: result.slip.overall_status,
            queue: 'pd',
            action: result.action,
        });
        socketEvents.applicationUpdated(io, {
            application_id: result.slip.application_id,
            updated_at: new Date().toISOString(),
            source: 'endorsement',
        });

        (result.notifications || []).forEach((notification) => {
            socketEvents.notificationCreated(io, notification.target_user_id, notification);
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to update PD endorsement.',
        });
    }
};

exports.postGuidanceAction = async (req, res) => {
    try {
        const result = await endorsementSlipService.applyStageAction('guidance', req.params.slipId, req.body, req.user);
        const io = req.app.get('io');
        socketEvents.endorsementUpdated(io, {
            slip_id: req.params.slipId,
            current_stage: result.slip.current_stage,
            overall_status: result.slip.overall_status,
            queue: 'guidance',
            action: result.action,
        });
        socketEvents.applicationUpdated(io, {
            application_id: result.slip.application_id,
            updated_at: new Date().toISOString(),
            source: 'endorsement',
        });

        (result.notifications || []).forEach((notification) => {
            socketEvents.notificationCreated(io, notification.target_user_id, notification);
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to update Guidance clearance.',
        });
    }
};

exports.postSdoAction = async (req, res) => {
    try {
        const result = await endorsementSlipService.applyStageAction('sdo', req.params.slipId, req.body, req.user);
        const io = req.app.get('io');
        socketEvents.endorsementUpdated(io, {
            slip_id: req.params.slipId,
            current_stage: result.slip.current_stage,
            overall_status: result.slip.overall_status,
            queue: 'sdo',
            action: result.action,
        });
        socketEvents.applicationUpdated(io, {
            application_id: result.slip.application_id,
            updated_at: new Date().toISOString(),
            source: 'endorsement',
        });

        (result.notifications || []).forEach((notification) => {
            socketEvents.notificationCreated(io, notification.target_user_id, notification);
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to update SDO clearance.',
        });
    }
};

exports.verifySlip = async (req, res) => {
    try {
        const payload = await endorsementSlipService.fetchVerificationPayload(req.params.token);
        res.status(200).json(payload);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Failed to verify endorsement slip.',
        });
    }
};
