const faqService = require('../services/faqService');

async function getFaqs(_req, res) {
    try {
        const items = await faqService.getActiveFaqs();
        return res.status(200).json(items);
    } catch (error) {
        console.error('FAQ ROUTE ERROR:', error);
        return res.status(500).json({
            error: 'Failed to fetch FAQs.',
        });
    }
}

module.exports = {
    getFaqs,
};
