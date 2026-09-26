const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const publicSettingsController = require('../controllers/publicSettingsController');
const { cacheJsonResponse } = require('../middleware/appCacheMiddleware');

const router = express.Router();

const scholarshipProgramCache = cacheJsonResponse({
    namespace: 'mobile-scholarship-programs',
    ttlMs: 60000,
});

router.get('/', protect, scholarshipProgramCache, publicSettingsController.getScholarshipPrograms);

module.exports = router;
