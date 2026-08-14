const express = require('express');
const faqController = require('../controllers/faqController');

const router = express.Router();

// Public read-only endpoint for the mobile FAQ/help center.
// Data comes from the same general_settings.landing_faqs JSON edited by Admin.
router.get('/', faqController.getFaqs);

module.exports = router;
