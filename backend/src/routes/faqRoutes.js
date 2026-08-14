const express = require('express');
const faqController = require('../controllers/faqController');

const router = express.Router();

// Public read-only FAQ catalog used by the mobile help center.
router.get('/', faqController.getFaqs);

module.exports = router;
