const express = require('express');
const publicSettingsController = require('../controllers/publicSettingsController');
const { cacheJsonResponse } = require('../middleware/appCacheMiddleware');

const router = express.Router();

const settingsCache = cacheJsonResponse({
    namespace: 'mobile-general-settings',
    ttlMs: 15000,
    scope: 'public',
});

router.get('/public', settingsCache, publicSettingsController.getPublicGeneralSettings);

module.exports = router;
