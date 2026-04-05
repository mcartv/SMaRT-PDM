const benefactorService = require('../services/benefactorService');

exports.getBenefactors = async (req, res) => {
    try {
        const data = await benefactorService.getBenefactors();
        res.status(200).json(data);
    } catch (err) {
        console.error('GET BENEFACTORS ERROR:', err.message);
        res.status(500).json({ error: err.message });
    }
};