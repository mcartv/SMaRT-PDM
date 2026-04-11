const benefactorService = require('../services/benefactorService');

exports.getBenefactors = async (req, res) => {
    try {
        const benefactors = await benefactorService.getBenefactors();

        res.status(200).json(benefactors);
    } catch (err) {
        console.error('GET BENEFACTORS CONTROLLER ERROR:', err);

        res.status(500).json({
            message: err.message || 'Failed to fetch benefactors',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.createBenefactor = async (req, res) => {
    try {
        const created = await benefactorService.createBenefactor(req.body);

        res.status(201).json(created);
    } catch (err) {
        console.error('CREATE BENEFACTOR CONTROLLER ERROR:', err);

        res.status(500).json({
            message: err.message || 'Failed to create benefactor',
            error: err.message || 'Unknown backend error',
        });
    }
};

exports.updateBenefactor = async (req, res) => {
    try {
        const { benefactorId } = req.params;
        const updated = await benefactorService.updateBenefactor(benefactorId, req.body);

        if (!updated) {
            return res.status(404).json({
                message: 'Benefactor not found',
                error: 'Benefactor not found',
            });
        }

        res.status(200).json(updated);
    } catch (err) {
        console.error('UPDATE BENEFACTOR CONTROLLER ERROR:', err);

        res.status(500).json({
            message: err.message || 'Failed to update benefactor',
            error: err.message || 'Unknown backend error',
        });
    }
};