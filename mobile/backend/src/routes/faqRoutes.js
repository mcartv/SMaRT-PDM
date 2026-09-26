const express = require('express');
const faqController = require('../controllers/faqController');
const { cacheJsonResponse } = require('../middleware/appCacheMiddleware');

const router = express.Router();

const faqCache = cacheJsonResponse({
    namespace: 'mobile-faqs',
    ttlMs: 15000,
    scope: 'public',
});

// Public read-only endpoint for the mobile FAQ/help center.
// Data comes from the same general_settings.landing_faqs JSON edited by Admin.
router.get('/', faqCache, faqController.getFaqs);

module.exports = router;
