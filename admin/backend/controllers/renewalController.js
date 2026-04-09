const renewalService = require('../services/renewalService');

exports.getRenewals = async (req, res) => {
    try {
        const payload = await renewalService.fetchRenewals();
        res.status(200).json(payload);
    } catch (error) {
        console.error('RENEWAL CONTROLLER ERROR:', error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.getRenewalDetails = async (req, res) => {
    try {
        const payload = await renewalService.fetchRenewalDetailsById(req.params.id);
        res.status(200).json(payload);
    } catch (error) {
        console.error('RENEWAL DETAIL CONTROLLER ERROR:', error.message);
        res.status(500).json({ error: error.message });
    }
};

exports.saveRenewalReview = async (req, res) => {
    try {
        const payload = await renewalService.saveRenewalReview(
            req.params.id,
            req.body,
            req.user
        );

        res.status(200).json({
            message: 'Renewal review saved successfully.',
            data: payload,
        });
    } catch (error) {
        console.error('RENEWAL REVIEW CONTROLLER ERROR:', error.message);
        res.status(500).json({ error: error.message });
    }
};
